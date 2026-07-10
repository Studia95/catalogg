-- Platform delivery tariffs and driver price negotiations.
-- Apply after waycatalog_delivery.sql.

create table if not exists public.delivery_pricing_rules (
  id uuid primary key default gen_random_uuid(),
  from_settlement text not null default '',
  to_settlement text not null,
  amount numeric(12,2) not null check (amount >= 0),
  is_active boolean not null default true,
  created_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (from_settlement, to_settlement)
);

create table if not exists public.delivery_price_requests (
  id uuid primary key default gen_random_uuid(),
  delivery_id uuid not null references public.deliveries(id) on delete cascade,
  driver_id uuid not null references public.drivers(id) on delete cascade,
  requested_amount numeric(12,2) not null check (requested_amount >= 0),
  current_amount numeric(12,2) not null default 0 check (current_amount >= 0),
  comment text not null default '',
  status text not null default 'new' check (status in ('new', 'approved', 'rejected')),
  reviewed_amount numeric(12,2),
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.deliveries add column if not exists offered_fee numeric(12,2) not null default 0;
alter table public.deliveries add column if not exists pricing_status text not null default 'pending'
  check (pricing_status in ('pending', 'offered', 'countered', 'accepted', 'rejected'));
alter table public.deliveries add column if not exists pricing_note text not null default '';

alter table public.delivery_pricing_rules enable row level security;
alter table public.delivery_price_requests enable row level security;

drop policy if exists "Public can read active delivery tariffs" on public.delivery_pricing_rules;
create policy "Public can read active delivery tariffs"
  on public.delivery_pricing_rules for select to anon, authenticated
  using (is_active or public.is_platform_admin());

drop policy if exists "Admins manage delivery tariffs" on public.delivery_pricing_rules;
create policy "Admins manage delivery tariffs"
  on public.delivery_pricing_rules for all to authenticated
  using (public.is_platform_admin() or exists (
    select 1 from public.users u
    where u.id = public.current_platform_user_id() and u.role = 'super_admin'
  ))
  with check (public.is_platform_admin() or exists (
    select 1 from public.users u
    where u.id = public.current_platform_user_id() and u.role = 'super_admin'
  ));

drop policy if exists "Drivers read own price requests" on public.delivery_price_requests;
create policy "Drivers read own price requests"
  on public.delivery_price_requests for select to authenticated
  using (public.is_platform_admin() or public.is_driver_profile(driver_id));

drop policy if exists "Drivers request delivery price" on public.delivery_price_requests;
create policy "Drivers request delivery price"
  on public.delivery_price_requests for insert to authenticated
  with check (public.is_driver_profile(driver_id));

drop policy if exists "Admins review delivery price requests" on public.delivery_price_requests;
create policy "Admins review delivery price requests"
  on public.delivery_price_requests for update to authenticated
  using (public.is_platform_admin() or exists (
    select 1 from public.users u
    where u.id = public.current_platform_user_id() and u.role = 'super_admin'
  ));

create or replace function public.request_delivery_price(
  target_delivery_id uuid,
  target_driver_id uuid,
  requested_amount_input numeric,
  comment_input text default ''
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  request_id uuid;
  current_fee numeric(12,2);
begin
  if not public.is_driver_profile(target_driver_id) then
    raise exception 'Driver is not authorized';
  end if;

  select coalesce(offered_fee, 0)
    into current_fee
    from public.deliveries
   where id = target_delivery_id
     and (driver_id = target_driver_id or driver_id is null)
     and status in ('waiting_courier', 'waiting_driver', 'assigned');

  if current_fee is null then
    raise exception 'Delivery is not available for price negotiation';
  end if;

  insert into public.delivery_price_requests (
    delivery_id, driver_id, requested_amount, current_amount, comment
  ) values (
    target_delivery_id, target_driver_id, greatest(0, requested_amount_input), current_fee, coalesce(comment_input, '')
  ) returning id into request_id;

  update public.deliveries
     set pricing_status = 'countered'
   where id = target_delivery_id;

  return request_id;
end;
$$;

grant execute on function public.request_delivery_price(uuid, uuid, numeric, text) to authenticated;

create or replace function public.review_delivery_price_request(
  target_request_id uuid,
  approved boolean,
  reviewed_amount_input numeric default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  request_record public.delivery_price_requests;
  next_amount numeric(12,2);
begin
  if not (public.is_platform_admin() or exists (
    select 1 from public.users u
    where u.id = public.current_platform_user_id() and u.role = 'super_admin'
  )) then
    raise exception 'Admin access is required';
  end if;

  select * into request_record
    from public.delivery_price_requests
   where id = target_request_id
   for update;

  if request_record.id is null then
    raise exception 'Price request not found';
  end if;

  next_amount := greatest(0, coalesce(reviewed_amount_input, request_record.requested_amount));

  update public.delivery_price_requests
     set status = case when approved then 'approved' else 'rejected' end,
         reviewed_amount = case when approved then next_amount else null end,
         reviewed_at = now()
   where id = target_request_id;

  update public.deliveries
     set offered_fee = case when approved then next_amount else offered_fee end,
         pricing_status = case when approved then 'accepted' else 'rejected' end,
         pricing_note = case when approved then 'Цена согласована супер-админом' else 'Цена отклонена супер-админом' end
   where id = request_record.delivery_id;

  update public.orders o
     set delivery_fee = case when approved then next_amount else o.delivery_fee end,
         total = case when approved then o.subtotal + next_amount else o.total end,
         total_amount = case when approved then o.subtotal_amount + next_amount else o.total_amount end
   where o.id = (select d.order_id from public.deliveries d where d.id = request_record.delivery_id);

  return request_record.delivery_id;
end;
$$;

grant execute on function public.review_delivery_price_request(uuid, boolean, numeric) to authenticated;

do $$
begin
  alter publication supabase_realtime add table public.delivery_price_requests;
exception
  when duplicate_object then null;
  when undefined_object then null;
end $$;
