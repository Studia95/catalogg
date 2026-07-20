-- Keep driver auth/actions fast and make completed-delivery payouts match the offered driver fee.

alter table public.drivers
  add column if not exists payout_details text not null default '';

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
    where lower(coalesce(d.email, '')) = lower(coalesce(auth.jwt() ->> 'email', ''))

    union all

    select d.id as driver_id, 3 as priority
    from public.drivers d
    where d.id::text = coalesce(auth.jwt() -> 'app_metadata' ->> 'driver_id', '')

    union all

    select d.id as driver_id, 4 as priority
    from public.drivers d
    where d.id::text = coalesce(auth.jwt() -> 'user_metadata' ->> 'driver_id', '')
  ) candidates
  order by priority
  limit 1
$$;

revoke all on function public.current_driver_id() from public, anon;
grant execute on function public.current_driver_id() to authenticated;

create or replace function public.update_current_driver_profile(
  next_name text,
  next_phone text,
  next_vehicle_info text,
  next_car_number text,
  next_payout_details text,
  next_service_settlements text[]
)
returns uuid
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
  set name = coalesce(nullif(trim(next_name), ''), name),
      phone = coalesce(trim(next_phone), ''),
      vehicle_info = coalesce(trim(next_vehicle_info), ''),
      car_number = coalesce(trim(next_car_number), ''),
      payout_details = coalesce(trim(next_payout_details), ''),
      service_settlements = coalesce(next_service_settlements, '{}'::text[]),
      updated_at = now()
  where id = viewer_driver_id;

  if not found then
    raise exception 'Driver profile was not found';
  end if;

  return viewer_driver_id;
end;
$$;

revoke all on function public.update_current_driver_profile(text, text, text, text, text, text[]) from public, anon;
grant execute on function public.update_current_driver_profile(text, text, text, text, text, text[]) to authenticated;

create or replace function public.complete_driver_delivery(
  target_delivery_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  target_order_id uuid;
  viewer_driver_id uuid := public.current_driver_id();
  payout numeric(12,2);
begin
  if viewer_driver_id is null then
    raise exception 'Driver authentication is required';
  end if;

  select d.order_id,
         coalesce(nullif(d.offered_fee, 0), nullif(o.delivery_fee, 0), 0)
    into target_order_id, payout
  from public.deliveries d
  join public.orders o on o.id = d.order_id
  where d.id = target_delivery_id
    and d.driver_id = viewer_driver_id
    and d.status in ('handed_over', 'on_the_way', 'arrived_to_client')
  for update;

  if target_order_id is null then
    raise exception 'Delivery cannot be completed';
  end if;

  update public.deliveries
  set status = 'delivered',
      delivered_at = now(),
      updated_at = now()
  where id = target_delivery_id;

  update public.orders
  set status = 'completed',
      completed_at = now()
  where id = target_order_id;

  update public.drivers
  set status = 'online',
      is_online = true,
      updated_at = now()
  where id = viewer_driver_id;

  insert into public.delivery_status_history (delivery_id, status, comment)
  values (target_delivery_id, 'delivered', 'driver completed delivery');

  insert into public.earnings (driver_id, delivery_id, amount, commission)
  values (viewer_driver_id, target_delivery_id, payout, 0)
  on conflict (delivery_id) do update
  set amount = case
        when coalesce(public.earnings.amount, 0) = 0 and excluded.amount > 0 then excluded.amount
        else public.earnings.amount
      end;

  return target_delivery_id;
end;
$$;

revoke all on function public.complete_driver_delivery(uuid) from public, anon;
grant execute on function public.complete_driver_delivery(uuid) to authenticated;

update public.earnings e
set amount = d.offered_fee
from public.deliveries d
where e.delivery_id = d.id
  and coalesce(e.amount, 0) = 0
  and coalesce(d.offered_fee, 0) > 0;
