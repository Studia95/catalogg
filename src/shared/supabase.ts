import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { cabins, categories, products, restaurant, themeSettings } from '../data/catalog';
import type { Cabin, CatalogTag, Category, Product, Restaurant, ThemeSettings } from '../entities/models';

type SupabaseConfig = {
  url?: string;
  anonKey?: string;
};

const config: SupabaseConfig = {
  url: import.meta.env.VITE_SUPABASE_URL as string | undefined,
  anonKey: (import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
    import.meta.env.VITE_SUPABASE_ANON_KEY) as string | undefined
};

export const supabase: SupabaseClient | null =
  config.url && config.anonKey ? createClient(config.url, config.anonKey) : null;

const legacyCatalogSlug = 'mangal';
let activePlatformCatalogId: string | null = null;

const normalizeCatalogSlug = (catalogSlug?: string) =>
  (catalogSlug || legacyCatalogSlug).trim().toLowerCase().replace(/^\/+|\/+$/g, '') || legacyCatalogSlug;

const isLegacyCatalog = (catalogSlug?: string) => normalizeCatalogSlug(catalogSlug) === legacyCatalogSlug;

const normalizeRestaurant = (value?: Restaurant | null): Restaurant => ({
  ...restaurant,
  ...(value ?? {}),
  mapLink: value?.mapLink ?? ''
});

type PlatformCatalogRow = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  logo_url: string | null;
  banner_url: string | null;
  whatsapp: string | null;
  instagram_url: string | null;
  address: string | null;
  map_url: string | null;
};

type PlatformCategoryRow = {
  id: string;
  name: string;
  image_url: string | null;
  icon: string | null;
};

type PlatformProductRow = {
  id: string;
  category_id: string | null;
  title: string;
  status: string;
  price: number;
  description: string;
  ingredients: string;
  weight: string;
  serving: string;
  stock_count: number;
  is_unlimited: boolean;
  is_popular: boolean;
  is_new: boolean;
  is_promo: boolean;
};

const mapPlatformRestaurant = (value: PlatformCatalogRow): Restaurant => ({
  ...restaurant,
  id: value.id,
  name: value.name,
  subtitle: value.description ?? '',
  logo_url: value.logo_url ?? '',
  banner_url: value.banner_url ?? '',
  whatsapp: value.whatsapp ?? '',
  instagram_url: value.instagram_url ?? '',
  address: value.address ?? '',
  mapLink: value.map_url ?? ''
});

const mapPlatformCategory = (value: PlatformCategoryRow): Category => ({
  id: value.id,
  name: value.name,
  image: value.image_url ?? '',
  icon: value.icon ?? '',
  kind: 'food'
});

const mapPlatformProduct = (value: PlatformProductRow): Product => ({
  id: value.id,
  title: value.title,
  price: value.price,
  description: value.description,
  image_url: '',
  ingredients: value.ingredients,
  weight: value.weight,
  spicy_level: 0,
  serving: value.serving,
  is_popular: value.is_popular,
  is_new: value.is_new,
  is_hit: value.is_promo,
  is_hidden: value.status !== 'active' && value.status !== 'sold_out',
  daily_stock: value.stock_count,
  current_stock: value.stock_count,
  is_unlimited: value.is_unlimited,
  stock_count: value.stock_count,
  category_id: value.category_id ?? '',
  category_ids: value.category_id ? [value.category_id] : [],
  pair_ids: []
});

async function getPlatformCatalogId(catalogSlug: string) {
  if (!supabase) return null;
  const { data, error } = await supabase
    .from('catalogs')
    .select('id')
    .eq('slug', normalizeCatalogSlug(catalogSlug))
    .maybeSingle();

  if (error || !data) return null;
  return data.id as string;
}

export async function signInAdmin(email: string, password: string, catalogSlug?: string) {
  if (!supabase) {
    return email.trim().toLowerCase() === 'admin' && password.trim() === '1234';
  }

  const { error } = await supabase.auth.signInWithPassword({
    email: email.trim().toLowerCase(),
    password
  });

  if (error) return false;

  const isAdmin = await hasAdminSession(catalogSlug);
  if (!isAdmin) {
    await supabase.auth.signOut();
  }
  return isAdmin;
}

export async function signOutAdmin() {
  if (!supabase) return;
  await supabase.auth.signOut();
}

export async function hasAdminSession(catalogSlug?: string) {
  if (!supabase) return false;
  const { data } = await supabase.auth.getSession();
  if (!data.session) return false;

  if (!isLegacyCatalog(catalogSlug)) {
    const catalogId = await getPlatformCatalogId(normalizeCatalogSlug(catalogSlug));
    if (!catalogId) return false;

    const { data: member } = await supabase
      .from('catalog_members')
      .select('role')
      .eq('catalog_id', catalogId)
      .eq('user_id', data.session.user.id)
      .in('role', ['owner', 'admin', 'editor'])
      .maybeSingle();

    return Boolean(member);
  }

  const { data: adminUser } = await supabase.from('admin_user').select('user_id').limit(1).maybeSingle();
  return Boolean(adminUser);
}

export function onAdminSessionChange(callback: (isAdmin: boolean) => void, catalogSlug?: string) {
  if (!supabase) return () => undefined;

  const { data } = supabase.auth.onAuthStateChange((_event, session) => {
    if (!session) {
      callback(false);
      return;
    }
    void hasAdminSession(catalogSlug).then(callback);
  });

  return () => data.subscription.unsubscribe();
}

export async function loadCatalog(catalogSlug?: string) {
  const normalizedSlug = normalizeCatalogSlug(catalogSlug);
  activePlatformCatalogId = null;

  if (!supabase) {
    return { restaurant, categories, products, cabins, tags: [], theme: themeSettings, source: 'demo' as const };
  }

  if (!isLegacyCatalog(normalizedSlug)) {
    const catalogResult = await supabase
      .from('catalogs')
      .select('id, slug, name, description, logo_url, banner_url, whatsapp, instagram_url, address, map_url')
      .eq('slug', normalizedSlug)
      .maybeSingle();

    if (!catalogResult.data || catalogResult.error) {
      return {
        restaurant: { ...restaurant, name: normalizedSlug, subtitle: '', logo_url: '', banner_url: '' },
        categories: [],
        products: [],
        cabins: [],
        tags: [],
        theme: themeSettings,
        source: 'supabase' as const
      };
    }

    const catalog = catalogResult.data as PlatformCatalogRow;
    activePlatformCatalogId = catalog.id;

    const [categoriesResult, productsResult, tagsResult, themeResult] = await Promise.all([
      supabase.from('categories').select('id, name, image_url, icon').eq('catalog_id', catalog.id).order('sort_order'),
      supabase
        .from('products')
        .select('id, category_id, title, status, price, description, ingredients, weight, serving, stock_count, is_unlimited, is_popular, is_new, is_promo')
        .eq('catalog_id', catalog.id)
        .order('sort_order'),
      supabase.from('tags').select('id, name, icon, color').eq('catalog_id', catalog.id).order('sort_order'),
      supabase.from('catalog_theme_settings').select('settings').eq('catalog_id', catalog.id).maybeSingle()
    ]);

    return {
      restaurant: mapPlatformRestaurant(catalog),
      categories: ((categoriesResult.data ?? []) as PlatformCategoryRow[]).map(mapPlatformCategory),
      products: ((productsResult.data ?? []) as PlatformProductRow[]).map(mapPlatformProduct),
      cabins: [],
      tags: (tagsResult.data ?? []) as CatalogTag[],
      theme: { ...themeSettings, ...((themeResult.data?.settings as Partial<ThemeSettings> | undefined) ?? {}) },
      source: 'supabase' as const
    };
  }

  const [restaurantResult, categoriesResult, productsResult, cabinsResult, tagsResult, themeResult] = await Promise.all([
    supabase.from('restaurant').select('*').limit(1).single(),
    supabase.from('category').select('*').order('sort_order', { ascending: true }).order('name'),
    supabase.from('product').select('*').order('sort_order', { ascending: true }).order('title'),
    supabase.from('cabin').select('*').order('sort_order', { ascending: true }).order('title'),
    supabase.from('catalog_tag').select('*').order('sort_order', { ascending: true }).order('name'),
    supabase.from('theme_settings').select('*').limit(1).single()
  ]);

  return {
    restaurant: normalizeRestaurant(restaurantResult.data),
    categories: categoriesResult.data ?? categories,
    products: productsResult.data ?? products,
    cabins: cabinsResult.data ?? cabins,
    tags: tagsResult.data ?? [],
    theme: themeResult.data ?? themeSettings,
    source: 'supabase' as const
  };
}

async function throwOnError<T>(request: PromiseLike<{ data: T | null; error: unknown }>) {
  const { data, error } = await request;
  if (error) {
    throw error;
  }
  return data;
}

const postgrestList = (values: string[]) => `(${values.map((value) => `"${value.replace(/"/g, '""')}"`).join(',')})`;
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const productToPlatformRow = (product: Product) => ({
  catalog_id: activePlatformCatalogId,
  category_id: product.category_id && uuidPattern.test(product.category_id) ? product.category_id : null,
  title: product.title,
  slug: product.id.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || crypto.randomUUID(),
  status: product.is_hidden ? 'hidden' : product.stock_count <= 0 && !product.is_unlimited ? 'sold_out' : 'active',
  price: product.price,
  description: product.description,
  ingredients: product.ingredients,
  weight: product.weight,
  serving: product.serving,
  stock_count: product.current_stock ?? product.stock_count ?? 0,
  is_unlimited: product.is_unlimited ?? false,
  is_popular: product.is_popular,
  is_new: product.is_new,
  is_promo: product.is_hit
});

const productPatchToPlatformRow = (patch: Partial<Product>) => {
  const row: Record<string, unknown> = {};
  if (patch.category_id !== undefined) row.category_id = patch.category_id && uuidPattern.test(patch.category_id) ? patch.category_id : null;
  if (patch.title !== undefined) row.title = patch.title;
  if (patch.price !== undefined) row.price = patch.price;
  if (patch.description !== undefined) row.description = patch.description;
  if (patch.ingredients !== undefined) row.ingredients = patch.ingredients;
  if (patch.weight !== undefined) row.weight = patch.weight;
  if (patch.serving !== undefined) row.serving = patch.serving;
  if (patch.current_stock !== undefined || patch.stock_count !== undefined || patch.daily_stock !== undefined) {
    row.stock_count = patch.current_stock ?? patch.stock_count ?? patch.daily_stock ?? 0;
  }
  if (patch.is_unlimited !== undefined) row.is_unlimited = patch.is_unlimited;
  if (patch.is_popular !== undefined) row.is_popular = patch.is_popular;
  if (patch.is_new !== undefined) row.is_new = patch.is_new;
  if (patch.is_hit !== undefined) row.is_promo = patch.is_hit;
  if (patch.is_hidden !== undefined) row.status = patch.is_hidden ? 'hidden' : 'active';
  return row;
};

export async function saveProductToSupabase(product: Product) {
  if (!supabase) return;
  if (activePlatformCatalogId) {
    const row = productToPlatformRow(product);
    if (uuidPattern.test(product.id)) {
      await throwOnError(supabase.from('products').upsert({ id: product.id, ...row }, { onConflict: 'id' }));
      return;
    }
    await throwOnError(supabase.from('products').insert(row));
    return;
  }
  await throwOnError(supabase.from('product').upsert(product, { onConflict: 'id' }));
}

export async function updateProductInSupabase(productId: string, patch: Partial<Product>) {
  if (!supabase) return;
  if (activePlatformCatalogId) {
    if (!uuidPattern.test(productId)) return;
    await throwOnError(supabase.from('products').update(productPatchToPlatformRow(patch)).eq('id', productId).eq('catalog_id', activePlatformCatalogId));
    return;
  }
  await throwOnError(supabase.from('product').update(patch).eq('id', productId));
}

export async function deleteProductFromSupabase(productId: string) {
  if (!supabase) return;
  if (activePlatformCatalogId) {
    if (!uuidPattern.test(productId)) return;
    await throwOnError(supabase.from('products').delete().eq('id', productId).eq('catalog_id', activePlatformCatalogId));
    return;
  }
  await throwOnError(supabase.from('product').delete().eq('id', productId));
}

export async function saveRestaurantToSupabase(value: Restaurant) {
  if (!supabase) return;
  if (activePlatformCatalogId) {
    await throwOnError(
      supabase
        .from('catalogs')
        .update({
          name: value.name,
          description: value.subtitle,
          logo_url: value.logo_url,
          banner_url: value.banner_url,
          whatsapp: value.whatsapp,
          instagram_url: value.instagram_url,
          address: value.address,
          map_url: value.mapLink
        })
        .eq('id', activePlatformCatalogId)
    );
    return;
  }
  await throwOnError(supabase.from('restaurant').upsert(normalizeRestaurant(value), { onConflict: 'id' }));
}

export async function saveThemeToSupabase(value: ThemeSettings) {
  if (!supabase) return;
  if (activePlatformCatalogId) {
    await throwOnError(
      supabase
        .from('catalog_theme_settings')
        .upsert({ catalog_id: activePlatformCatalogId, settings: value }, { onConflict: 'catalog_id' })
    );
    return;
  }
  await throwOnError(supabase.from('theme_settings').upsert(value, { onConflict: 'id' }));
}

export async function replaceCategoriesInSupabase(values: Category[]) {
  if (!supabase) return;
  if (activePlatformCatalogId) {
    const rows = values.map((value, index) => ({
      ...(uuidPattern.test(value.id) ? { id: value.id } : {}),
      catalog_id: activePlatformCatalogId,
      name: value.name,
      slug: value.id.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || crypto.randomUUID(),
      image_url: value.image,
      icon: value.icon,
      sort_order: index
    }));
    if (rows.length > 0) {
      await throwOnError(supabase.from('categories').upsert(rows, { onConflict: 'id' }));
    }
    return;
  }
  const ids = values.map((value) => value.id);
  await throwOnError(supabase.from('category').upsert(values.map((value, index) => ({ ...value, sort_order: index })), { onConflict: 'id' }));
  if (ids.length > 0) {
    await throwOnError(supabase.from('category').delete().not('id', 'in', postgrestList(ids)));
  } else {
    await throwOnError(supabase.from('category').delete().neq('id', ''));
  }
}

export async function replaceTagsInSupabase(values: CatalogTag[]) {
  if (!supabase) return;
  if (activePlatformCatalogId) {
    const rows = values.map((value, index) => ({
      ...(uuidPattern.test(value.id) ? { id: value.id } : {}),
      catalog_id: activePlatformCatalogId,
      name: value.name,
      slug: value.id.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || crypto.randomUUID(),
      icon: value.icon,
      color: value.color,
      sort_order: index
    }));
    if (rows.length > 0) {
      await throwOnError(supabase.from('tags').upsert(rows, { onConflict: 'id' }));
    }
    return;
  }
  const ids = values.map((value) => value.id);
  await throwOnError(supabase.from('catalog_tag').upsert(values.map((value, index) => ({ ...value, sort_order: index })), { onConflict: 'id' }));
  if (ids.length > 0) {
    await throwOnError(supabase.from('catalog_tag').delete().not('id', 'in', postgrestList(ids)));
  } else {
    await throwOnError(supabase.from('catalog_tag').delete().neq('id', ''));
  }
}

export async function replaceCabinsInSupabase(values: Cabin[]) {
  if (!supabase) return;
  if (activePlatformCatalogId) {
    const rows = values.map((value, index) => ({
      ...(uuidPattern.test(value.id) ? { id: value.id } : {}),
      catalog_id: activePlatformCatalogId,
      title: value.title,
      capacity: Number.parseInt(value.capacity, 10) || 1,
      image_url: value.image_url,
      sort_order: index
    }));
    if (rows.length > 0) {
      await throwOnError(supabase.from('bookable_resources').upsert(rows, { onConflict: 'id' }));
    }
    return;
  }
  const ids = values.map((value) => value.id);
  await throwOnError(supabase.from('cabin').upsert(values.map((value, index) => ({ ...value, sort_order: index })), { onConflict: 'id' }));
  if (ids.length > 0) {
    await throwOnError(supabase.from('cabin').delete().not('id', 'in', postgrestList(ids)));
  } else {
    await throwOnError(supabase.from('cabin').delete().neq('id', ''));
  }
}

export async function replaceProductsInSupabase(values: Product[]) {
  if (!supabase) return;
  if (activePlatformCatalogId) {
    const rows = values.map((value, index) => ({
      ...(uuidPattern.test(value.id) ? { id: value.id } : {}),
      ...productToPlatformRow(value),
      sort_order: index
    }));
    await throwOnError(supabase.from('products').delete().eq('catalog_id', activePlatformCatalogId));
    if (rows.length > 0) {
      await throwOnError(supabase.from('products').insert(rows));
    }
    return;
  }
  const ids = values.map((value) => value.id);
  if (values.length > 0) {
    await throwOnError(supabase.from('product').upsert(values.map((value, index) => ({ ...value, sort_order: index })), { onConflict: 'id' }));
  }
  if (ids.length > 0) {
    await throwOnError(supabase.from('product').delete().not('id', 'in', postgrestList(ids)));
  } else {
    await throwOnError(supabase.from('product').delete().neq('id', ''));
  }
}

export async function replaceCatalogInSupabase(payload: {
  restaurant?: Restaurant;
  categories?: Category[];
  tags?: CatalogTag[];
  products?: Product[];
  cabins?: Cabin[];
  theme?: ThemeSettings;
}) {
  if (!supabase) return;
  if (payload.restaurant) await saveRestaurantToSupabase(payload.restaurant);
  if (payload.theme) await saveThemeToSupabase(payload.theme);
  if (payload.categories) await replaceCategoriesInSupabase(payload.categories);
  if (payload.tags) await replaceTagsInSupabase(payload.tags);
  if (payload.cabins) {
    await replaceCabinsInSupabase(payload.cabins);
  }
  if (payload.products) {
    await replaceProductsInSupabase(payload.products);
  }
}
