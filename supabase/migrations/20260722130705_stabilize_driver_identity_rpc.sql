-- Stabilize driver identity resolution for browser refreshes and quick driver actions.
-- Some legacy driver rows point directly to auth.users.id in drivers.user_id,
-- while the standard path points drivers.user_id to public.users.id.
-- The RPC now supports both shapes and avoids user-editable metadata.

create index if not exists drivers_email_lower_idx
  on public.drivers (lower(email))
  where email is not null;

create or replace function public.current_driver_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  with auth_context as (
    select
      auth.uid() as auth_user_id,
      lower(coalesce(auth.jwt() ->> 'email', '')) as email,
      coalesce(auth.jwt() -> 'app_metadata' ->> 'driver_id', '') as app_driver_id
  )
  select driver_id
  from (
    select d.id as driver_id, 0 as priority
    from public.drivers d
    join public.users u on u.id = d.user_id
    join auth_context a on true
    where d.is_active is true
      and u.auth_user_id = a.auth_user_id

    union all

    select d.id as driver_id, 1 as priority
    from public.drivers d
    join auth_context a on true
    where d.is_active is true
      and d.user_id = a.auth_user_id

    union all

    select d.id as driver_id, 2 as priority
    from public.drivers d
    join public.users u on u.id = d.user_id
    join auth_context a on true
    where d.is_active is true
      and a.email <> ''
      and lower(u.email) = a.email
      and u.role = 'driver'

    union all

    select d.id as driver_id, 3 as priority
    from public.drivers d
    join auth_context a on true
    where d.is_active is true
      and a.email <> ''
      and lower(coalesce(d.email, '')) = a.email

    union all

    select d.id as driver_id, 4 as priority
    from public.drivers d
    join auth_context a on true
    where d.is_active is true
      and d.id::text = a.app_driver_id
  ) candidates
  order by priority
  limit 1
$$;

revoke all on function public.current_driver_id() from public, anon;
grant execute on function public.current_driver_id() to authenticated;
