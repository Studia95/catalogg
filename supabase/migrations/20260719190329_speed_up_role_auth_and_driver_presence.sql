-- Keep role resolution and driver presence updates fast without changing application data.
create index if not exists users_auth_user_id_idx
  on public.users (auth_user_id)
  where auth_user_id is not null;

create index if not exists users_email_lower_idx
  on public.users (lower(email));

create index if not exists drivers_user_id_idx
  on public.drivers (user_id);

create index if not exists catalogs_slug_lower_idx
  on public.catalogs (lower(slug));

create index if not exists admin_user_user_id_idx
  on public.admin_user (user_id);

create or replace function public.resolve_current_login_redirect()
returns text
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  viewer_user_id uuid := auth.uid();
  viewer_email text := lower(coalesce(auth.jwt() ->> 'email', ''));
  target_slug text;
begin
  if viewer_user_id is null then
    return null;
  end if;

  if public.current_driver_id() is not null then
    return '/driver';
  end if;

  select c.slug
  into target_slug
  from public.clients cl
  join public.catalogs c on c.id = cl.catalog_id
  where cl.owner_user_id = viewer_user_id
     or (viewer_email <> '' and lower(cl.email) = viewer_email)
  order by (cl.owner_user_id = viewer_user_id) desc
  limit 1;

  if target_slug is not null then
    return '/' || target_slug || '/dashboard';
  end if;

  select c.slug
  into target_slug
  from public.catalog_members cm
  join public.catalogs c on c.id = cm.catalog_id
  where cm.user_id = viewer_user_id
  order by c.created_at
  limit 1;

  if target_slug is not null then
    return '/' || target_slug || '/dashboard';
  end if;

  if public.is_platform_admin() then
    return '/admin';
  end if;

  if exists (select 1 from public.admin_user au where au.user_id = viewer_user_id) then
    return '/mangal/dashboard';
  end if;

  return '/';
end;
$$;

revoke all on function public.resolve_current_login_redirect() from public, anon;
grant execute on function public.resolve_current_login_redirect() to authenticated;

create or replace function public.update_current_driver_location(
  next_lat double precision,
  next_lng double precision,
  next_accuracy double precision default null
)
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

  if next_lat < -90 or next_lat > 90 or next_lng < -180 or next_lng > 180 then
    raise exception 'Invalid driver coordinates';
  end if;

  update public.drivers
  set last_lat = next_lat,
      last_lng = next_lng,
      last_location_accuracy = case
        when next_accuracy is null then null
        else greatest(next_accuracy, 0)
      end,
      last_location_at = now()
  where id = viewer_driver_id;

  if not found then
    raise exception 'Driver profile was not found';
  end if;

  return true;
end;
$$;

revoke all on function public.update_current_driver_location(double precision, double precision, double precision) from public, anon;
grant execute on function public.update_current_driver_location(double precision, double precision, double precision) to authenticated;
