import { supabase } from '../supabase';

export async function resolveLoginRedirect(email: string, password: string) {
  if (!supabase) {
    return email.trim().toLowerCase() === 'admin' && password.trim() === '1234' ? '/mangal/dashboard' : null;
  }

  const { error } = await supabase.auth.signInWithPassword({
    email: email.trim().toLowerCase(),
    password
  });
  if (error) throw new Error(error.message);

  const { data: isPlatformAdmin } = await supabase.rpc('is_platform_admin');
  if (isPlatformAdmin) return '/admin';

  const { data: sessionData } = await supabase.auth.getSession();
  const user = sessionData.session?.user;
  if (!user) return '/';

  const { data: client } = await supabase
    .from('clients')
    .select('catalogs(slug)')
    .eq('owner_user_id', user.id)
    .maybeSingle();

  const catalog = client?.catalogs as { slug?: string } | { slug?: string }[] | null | undefined;
  const slug = Array.isArray(catalog) ? catalog[0]?.slug : catalog?.slug;
  return slug ? `/${slug}/dashboard` : '/';
}
