-- Repair UUID defaults for platform catalog tables.
-- Safe to run multiple times in Supabase SQL Editor.

create extension if not exists pgcrypto;

alter table public.categories
  alter column id set default gen_random_uuid();

alter table public.tags
  alter column id set default gen_random_uuid();

alter table public.products
  alter column id set default gen_random_uuid();

alter table public.product_images
  alter column id set default gen_random_uuid();

alter table public.bookable_resources
  alter column id set default gen_random_uuid();
