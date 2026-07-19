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
    where d.id::text = coalesce(auth.jwt() -> 'user_metadata' ->> 'driver_id', '')
  ) candidates
  order by priority
  limit 1
$$;

grant execute on function public.current_driver_id() to authenticated;
