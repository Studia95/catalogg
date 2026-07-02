-- Restaurant catalog templates.
-- Safe to run multiple times after catalog_supabase_schema.sql and platform_admin_setup.sql.

alter table public.catalogs add column if not exists is_template boolean not null default false;
alter table public.catalogs add column if not exists template_name text;

create index if not exists catalogs_is_template_idx on public.catalogs(is_template, created_at desc);

drop policy if exists "platform admins manage template catalogs" on public.catalogs;
create policy "platform admins manage template catalogs" on public.catalogs
for all using (public.is_platform_admin() and is_template = true)
with check (public.is_platform_admin() and is_template = true);

drop policy if exists "catalogs public read published" on public.catalogs;
create policy "catalogs public read published" on public.catalogs
for select using (
  (status = 'published' and is_template = false)
  or public.is_catalog_member(id, array['owner','admin','editor','viewer']::public.catalog_role[])
  or public.is_platform_admin()
);

create or replace function public.create_restaurant_template(
  template_display_name text,
  template_slug text,
  template_key text default null,
  base_template_version_id uuid default null,
  created_by_user_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  created_catalog_id uuid;
  selected_template_version_id uuid;
begin
  if not public.is_platform_admin() then
    raise exception 'Only platform admins can create templates.';
  end if;

  if nullif(trim(template_display_name), '') is null then
    raise exception 'Template name is required.';
  end if;

  if nullif(trim(template_slug), '') is null then
    raise exception 'Template slug is required.';
  end if;

  selected_template_version_id := base_template_version_id;

  if selected_template_version_id is null then
    select tv.id
      into selected_template_version_id
      from public.template_versions tv
      join public.templates t on t.id = tv.template_id
      where tv.status = 'published'
        and t.key = 'restaurant-modern'
      order by tv.version desc
      limit 1;
  end if;

  if selected_template_version_id is null then
    raise exception 'Published restaurant-modern template version was not found.';
  end if;

  insert into public.catalogs (
    template_version_id,
    slug,
    name,
    description,
    status,
    is_template,
    template_name,
    created_by
  )
  values (
    selected_template_version_id,
    lower(trim(template_slug)),
    trim(template_display_name),
    'Template catalog',
    'draft',
    true,
    coalesce(nullif(trim(template_key), ''), lower(trim(template_slug))),
    created_by_user_id
  )
  returning id into created_catalog_id;

  insert into public.catalog_theme_settings (catalog_id, settings)
  values (created_catalog_id, '{}'::jsonb)
  on conflict (catalog_id) do nothing;

  insert into public.catalog_sections (catalog_id, key, title, sort_order)
  values
    (created_catalog_id, 'hero', 'Главная', 10),
    (created_catalog_id, 'categories', 'Категории', 20),
    (created_catalog_id, 'products', 'Все позиции', 30),
    (created_catalog_id, 'contacts', 'Контакты', 40)
  on conflict (catalog_id, key) do nothing;

  return created_catalog_id;
end;
$$;

grant execute on function public.create_restaurant_template(text, text, text, uuid, uuid) to authenticated;

create or replace function public.create_restaurant_from_template(
  template_id uuid,
  new_restaurant_name text,
  new_restaurant_slug text default null,
  new_template_version_id uuid default null,
  created_by_user_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  new_restaurant_id uuid;
  template_catalog public.catalogs%rowtype;
begin
  if auth.uid() is not null and not public.is_platform_admin() then
    raise exception 'Only platform admins can create restaurants from templates.';
  end if;

  select *
    into template_catalog
    from public.catalogs
    where id = template_id
      and is_template = true;

  if template_catalog.id is null then
    raise exception 'Template catalog was not found.';
  end if;

  if nullif(trim(new_restaurant_name), '') is null then
    raise exception 'Restaurant name is required.';
  end if;

  insert into public.catalogs (
    template_version_id,
    slug,
    name,
    description,
    status,
    logo_url,
    banner_url,
    address,
    map_url,
    whatsapp,
    instagram_url,
    currency,
    language,
    timezone,
    order_settings,
    booking_settings,
    seo,
    pwa,
    is_template,
    template_name,
    created_by
  )
  values (
    coalesce(new_template_version_id, template_catalog.template_version_id),
    coalesce(nullif(trim(new_restaurant_slug), ''), lower(replace(trim(new_restaurant_name), ' ', '-'))),
    trim(new_restaurant_name),
    template_catalog.description,
    'published',
    template_catalog.logo_url,
    template_catalog.banner_url,
    template_catalog.address,
    template_catalog.map_url,
    template_catalog.whatsapp,
    template_catalog.instagram_url,
    template_catalog.currency,
    template_catalog.language,
    template_catalog.timezone,
    template_catalog.order_settings,
    template_catalog.booking_settings,
    template_catalog.seo,
    template_catalog.pwa,
    false,
    null,
    created_by_user_id
  )
  returning id into new_restaurant_id;

  create temp table temp_category_map (
    old_id uuid primary key,
    new_id uuid not null
  ) on commit drop;

  create temp table temp_tag_map (
    old_id uuid primary key,
    new_id uuid not null
  ) on commit drop;

  create temp table temp_product_map (
    old_id uuid primary key,
    new_id uuid not null
  ) on commit drop;

  create temp table temp_option_group_map (
    old_id uuid primary key,
    new_id uuid not null
  ) on commit drop;

  insert into temp_category_map (old_id, new_id)
  select id, gen_random_uuid()
  from public.categories
  where catalog_id = template_id;

  insert into public.categories (
    id,
    catalog_id,
    parent_id,
    name,
    slug,
    description,
    image_url,
    icon,
    is_hidden,
    sort_order
  )
  select
    m.new_id,
    new_restaurant_id,
    parent_map.new_id,
    c.name,
    c.slug,
    c.description,
    c.image_url,
    c.icon,
    c.is_hidden,
    c.sort_order
  from public.categories c
  join temp_category_map m on m.old_id = c.id
  left join temp_category_map parent_map on parent_map.old_id = c.parent_id
  where c.catalog_id = template_id;

  insert into temp_tag_map (old_id, new_id)
  select id, gen_random_uuid()
  from public.tags
  where catalog_id = template_id;

  insert into public.tags (
    id,
    catalog_id,
    name,
    slug,
    icon,
    color,
    sort_order
  )
  select
    m.new_id,
    new_restaurant_id,
    t.name,
    t.slug,
    t.icon,
    t.color,
    t.sort_order
  from public.tags t
  join temp_tag_map m on m.old_id = t.id
  where t.catalog_id = template_id;

  insert into temp_product_map (old_id, new_id)
  select id, gen_random_uuid()
  from public.products
  where catalog_id = template_id;

  insert into public.products (
    id,
    catalog_id,
    category_id,
    title,
    slug,
    sku,
    status,
    price,
    old_price,
    cost_price,
    description,
    ingredients,
    weight,
    serving,
    stock_count,
    is_unlimited,
    is_popular,
    is_new,
    is_promo,
    seo,
    custom_fields,
    sort_order
  )
  select
    m.new_id,
    new_restaurant_id,
    category_map.new_id,
    p.title,
    p.slug,
    p.sku,
    p.status,
    p.price,
    p.old_price,
    p.cost_price,
    p.description,
    p.ingredients,
    p.weight,
    p.serving,
    p.stock_count,
    p.is_unlimited,
    p.is_popular,
    p.is_new,
    p.is_promo,
    p.seo,
    p.custom_fields,
    p.sort_order
  from public.products p
  join temp_product_map m on m.old_id = p.id
  left join temp_category_map category_map on category_map.old_id = p.category_id
  where p.catalog_id = template_id;

  insert into public.product_images (
    catalog_id,
    product_id,
    url,
    alt,
    sort_order
  )
  select
    new_restaurant_id,
    product_map.new_id,
    image.url,
    image.alt,
    image.sort_order
  from public.product_images image
  join temp_product_map product_map on product_map.old_id = image.product_id
  where image.catalog_id = template_id;

  insert into public.product_tags (
    catalog_id,
    product_id,
    tag_id
  )
  select
    new_restaurant_id,
    product_map.new_id,
    tag_map.new_id
  from public.product_tags pt
  join temp_product_map product_map on product_map.old_id = pt.product_id
  join temp_tag_map tag_map on tag_map.old_id = pt.tag_id
  where pt.catalog_id = template_id;

  insert into temp_option_group_map (old_id, new_id)
  select id, gen_random_uuid()
  from public.product_option_groups
  where catalog_id = template_id;

  insert into public.product_option_groups (
    id,
    catalog_id,
    product_id,
    name,
    required,
    min_selected,
    max_selected,
    sort_order
  )
  select
    group_map.new_id,
    new_restaurant_id,
    product_map.new_id,
    group_row.name,
    group_row.required,
    group_row.min_selected,
    group_row.max_selected,
    group_row.sort_order
  from public.product_option_groups group_row
  join temp_option_group_map group_map on group_map.old_id = group_row.id
  join temp_product_map product_map on product_map.old_id = group_row.product_id
  where group_row.catalog_id = template_id;

  insert into public.product_options (
    catalog_id,
    group_id,
    name,
    price_delta,
    is_default,
    sort_order
  )
  select
    new_restaurant_id,
    group_map.new_id,
    option_row.name,
    option_row.price_delta,
    option_row.is_default,
    option_row.sort_order
  from public.product_options option_row
  join temp_option_group_map group_map on group_map.old_id = option_row.group_id
  where option_row.catalog_id = template_id;

  insert into public.catalog_theme_settings (catalog_id, settings)
  select new_restaurant_id, settings
  from public.catalog_theme_settings
  where catalog_id = template_id
  on conflict (catalog_id) do update set
    settings = excluded.settings,
    updated_at = now();

  insert into public.catalog_sections (
    catalog_id,
    key,
    title,
    enabled,
    sort_order,
    settings
  )
  select
    new_restaurant_id,
    key,
    title,
    enabled,
    sort_order,
    settings
  from public.catalog_sections
  where catalog_id = template_id;

  insert into public.bookable_resources (
    catalog_id,
    title,
    capacity,
    capacity_text,
    image_url,
    is_active,
    resource_type,
    sort_order
  )
  select
    new_restaurant_id,
    title,
    capacity,
    capacity_text,
    image_url,
    is_active,
    resource_type,
    sort_order
  from public.bookable_resources
  where catalog_id = template_id;

  insert into public.content_blocks (
    catalog_id,
    key,
    content
  )
  select
    new_restaurant_id,
    key,
    content
  from public.content_blocks
  where catalog_id = template_id;

  return new_restaurant_id;
end;
$$;

grant execute on function public.create_restaurant_from_template(uuid, text, text, uuid, uuid) to authenticated;
