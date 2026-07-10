-- Background Web Push subscriptions for installed PWAs.
-- Apply after the base Supabase schema and deploy send-web-push.

create table if not exists public.web_push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  role text not null check (role in ('client', 'restaurant', 'driver', 'super_admin')),
  catalog_id uuid references public.catalogs(id) on delete cascade,
  driver_id uuid references public.drivers(id) on delete cascade,
  order_id uuid references public.orders(id) on delete cascade,
  endpoint text not null,
  p256dh text not null,
  auth text not null,
  user_agent text not null default '',
  last_seen_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (user_id, endpoint)
);

create index if not exists web_push_subscriptions_catalog_idx
  on public.web_push_subscriptions(role, catalog_id);
create index if not exists web_push_subscriptions_driver_idx
  on public.web_push_subscriptions(role, driver_id);
create index if not exists web_push_subscriptions_order_idx
  on public.web_push_subscriptions(role, order_id);

alter table public.web_push_subscriptions enable row level security;

drop policy if exists "Users manage own web push subscriptions" on public.web_push_subscriptions;
create policy "Users manage own web push subscriptions"
  on public.web_push_subscriptions for all to authenticated
  using (user_id = auth.uid() or public.is_platform_admin())
  with check (user_id = auth.uid() or public.is_platform_admin());

create or replace function public.upsert_web_push_subscription(
  subscription_endpoint text,
  p256dh_key text,
  auth_key text,
  role_name text,
  catalog_id_input uuid default null,
  driver_id_input uuid default null,
  order_id_input uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  subscription_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Authentication is required';
  end if;

  if role_name not in ('client', 'restaurant', 'driver', 'super_admin') then
    raise exception 'Unsupported push role';
  end if;

  insert into public.web_push_subscriptions (
    user_id, role, catalog_id, driver_id, order_id, endpoint, p256dh, auth, user_agent, last_seen_at
  ) values (
    auth.uid(), role_name, catalog_id_input, driver_id_input, order_id_input,
    trim(subscription_endpoint), trim(p256dh_key), trim(auth_key),
    coalesce(current_setting('request.headers', true)::json ->> 'user-agent', ''), now()
  )
  on conflict (user_id, endpoint) do update set
    role = excluded.role,
    catalog_id = excluded.catalog_id,
    driver_id = excluded.driver_id,
    order_id = excluded.order_id,
    p256dh = excluded.p256dh,
    auth = excluded.auth,
    user_agent = excluded.user_agent,
    last_seen_at = now()
  returning id into subscription_id;

  return subscription_id;
end;
$$;

grant execute on function public.upsert_web_push_subscription(text, text, text, text, uuid, uuid, uuid)
  to authenticated;

create or replace function public.delete_web_push_subscription(subscription_endpoint text)
returns boolean
language sql
security definer
set search_path = public
as $$
  delete from public.web_push_subscriptions
   where user_id = auth.uid()
     and endpoint = trim(subscription_endpoint);
  select true;
$$;

grant execute on function public.delete_web_push_subscription(text) to authenticated;

do $$
begin
  alter publication supabase_realtime add table public.web_push_subscriptions;
exception
  when duplicate_object then null;
  when undefined_object then null;
end $$;
