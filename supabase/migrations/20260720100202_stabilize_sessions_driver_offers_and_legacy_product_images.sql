-- Stabilize driver auth/action performance and persist multiple photos for the legacy catalog.
-- This migration does not rewrite business data.

alter table public.product
  add column if not exists image_urls text[] not null default '{}';

update public.product
set image_urls = array[image_url]
where cardinality(image_urls) = 0
  and coalesce(image_url, '') <> '';

create index if not exists product_images_catalog_product_sort_idx
  on public.product_images (catalog_id, product_id, sort_order);

create index if not exists deliveries_driver_status_created_idx
  on public.deliveries (driver_id, status, created_at desc);

create index if not exists deliveries_open_status_created_idx
  on public.deliveries (status, created_at desc)
  where driver_id is null;

create index if not exists orders_delivery_location_idx
  on public.orders (delivery_city, delivery_settlement);

create or replace function public.current_driver_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select driver_id
  from (
    select d.id as driver_id, 0 as priority
    from public.drivers d
    join public.users u on u.id = d.user_id
    where u.auth_user_id = auth.uid()

    union all

    select d.id as driver_id, 1 as priority
    from public.drivers d
    join public.users u on u.id = d.user_id
    where lower(u.email) = lower(coalesce(auth.jwt() ->> 'email', ''))
      and u.role = 'driver'

    union all

    select d.id as driver_id, 2 as priority
    from public.drivers d
    where d.id::text = coalesce(auth.jwt() -> 'app_metadata' ->> 'driver_id', '')

    union all

    select d.id as driver_id, 3 as priority
    from public.drivers d
    where d.id::text = coalesce(auth.jwt() -> 'user_metadata' ->> 'driver_id', '')
  ) candidates
  order by priority
  limit 1
$$;

revoke all on function public.current_driver_id() from public, anon;
grant execute on function public.current_driver_id() to authenticated;

create or replace function public.set_current_driver_availability(next_is_online boolean)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  viewer_driver_id uuid := public.current_driver_id();
begin
  if viewer_driver_id is null then
    raise exception 'Driver authentication is required';
  end if;

  update public.drivers
  set is_online = next_is_online,
      status = case
        when next_is_online then 'online'
        else 'offline'
      end,
      updated_at = now()
  where id = viewer_driver_id;

  if not found then
    raise exception 'Driver profile was not found';
  end if;

  return next_is_online;
end;
$$;

revoke all on function public.set_current_driver_availability(boolean) from public, anon;
grant execute on function public.set_current_driver_availability(boolean) to authenticated;

create or replace function public.get_driver_delivery_offers()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  viewer_driver_id uuid := public.current_driver_id();
  offers jsonb;
begin
  if viewer_driver_id is null then
    raise exception 'Driver authentication is required';
  end if;

  with assigned_deliveries as (
    select d.*
    from public.deliveries d
    where d.driver_id = viewer_driver_id
      and d.status in ('assigned', 'arrived_to_restaurant', 'handed_over', 'on_the_way')
  ),
  open_deliveries as (
    select d.*
    from public.deliveries d
    join public.orders o on o.id = d.order_id
    where d.driver_id is null
      and d.status in ('waiting_courier', 'waiting_driver')
      and d.created_at >= now() - interval '2 days'
      and public.driver_serves_delivery_location(viewer_driver_id, o.delivery_city, o.delivery_settlement)
    order by created_at desc
    limit 80
  ),
  candidate_deliveries as (
    select * from assigned_deliveries
    union all
    select * from open_deliveries
  )
  select coalesce(jsonb_agg(
    jsonb_build_object(
      'id', d.id,
      'order_id', d.order_id,
      'driver_id', d.driver_id,
      'status', d.status,
      'delivery_provider', d.delivery_provider,
      'pickup_qr_token', case when d.driver_id = viewer_driver_id then d.pickup_qr_token else null end,
      'pickup_qr_expires_at', case when d.driver_id = viewer_driver_id then d.pickup_qr_expires_at else null end,
      'assigned_at', d.assigned_at,
      'route_to_restaurant_url', d.route_to_restaurant_url,
      'route_to_client_url', case when d.driver_id = viewer_driver_id then d.route_to_client_url else null end,
      'estimated_time_min', d.estimated_time_min,
      'estimated_time_max', d.estimated_time_max,
      'offered_fee', d.offered_fee,
      'pricing_status', d.pricing_status,
      'created_at', d.created_at,
      'orders', jsonb_build_object(
        'id', o.id,
        'order_type', case
          when o.fulfillment_type = 'delivery' then 'delivery'
          when o.fulfillment_type = 'takeaway' then 'pickup'
          else 'dine_in'
        end,
        'fulfillment_type', o.fulfillment_type,
        'status', o.status,
        'payment_status', o.payment_status,
        'client_name', case when d.driver_id = viewer_driver_id then o.client_name else '' end,
        'client_phone', case when d.driver_id = viewer_driver_id then o.client_phone else '' end,
        'customer_name', case when d.driver_id = viewer_driver_id then o.customer_name else '' end,
        'customer_phone', case when d.driver_id = viewer_driver_id then o.customer_phone else '' end,
        'delivery_address', o.delivery_address,
        'delivery_city', o.delivery_city,
        'delivery_settlement', o.delivery_settlement,
        'delivery_lat', o.delivery_lat,
        'delivery_lng', o.delivery_lng,
        'delivery_comment', case when d.driver_id = viewer_driver_id then o.delivery_comment else null end,
        'restaurant_address_snapshot', o.restaurant_address_snapshot,
        'restaurant_lat_snapshot', o.restaurant_lat_snapshot,
        'restaurant_lng_snapshot', o.restaurant_lng_snapshot,
        'delivery_fee', o.delivery_fee,
        'total', o.total,
        'total_amount', o.total_amount,
        'created_at', o.created_at,
        'order_items', coalesce((
          select jsonb_agg(jsonb_build_object('quantity', oi.quantity))
          from public.order_items oi
          where oi.order_id = o.id
        ), '[]'::jsonb),
        'restaurants', jsonb_build_object(
          'name', coalesce(r.name, c.name, 'Ресторан'),
          'logo_url', coalesce(r.logo_url, c.logo_url, ''),
          'cover_url', coalesce(r.cover_url, c.banner_url, ''),
          'description', coalesce(r.description, c.description, ''),
          'address_line', coalesce(r.address_line, o.restaurant_address_snapshot, ''),
          'lat', coalesce(r.lat, o.restaurant_lat_snapshot),
          'lng', coalesce(r.lng, o.restaurant_lng_snapshot)
        )
      )
    ) order by d.created_at desc
  ), '[]'::jsonb) into offers
  from candidate_deliveries d
  join public.orders o on o.id = d.order_id
  left join public.catalogs c on c.id = o.catalog_id
  left join lateral (
    select restaurant.*
    from public.restaurants restaurant
    where restaurant.id = o.restaurant_id
       or restaurant.catalog_id = o.catalog_id
    order by case when restaurant.id = o.restaurant_id then 0 else 1 end
    limit 1
  ) r on true;

  return offers;
end;
$$;

revoke all on function public.get_driver_delivery_offers() from public, anon;
grant execute on function public.get_driver_delivery_offers() to authenticated;
