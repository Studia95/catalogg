import type { Session } from '@supabase/supabase-js';
import { supabase } from '../supabase';
import { clearPwaResumePath } from '../pwaSession';

export type PlatformAdminAccess = {
  hasSession: boolean;
  isPlatformAdmin: boolean;
  email: string | null;
};

export async function getPlatformAdminAccess(knownSession?: Session | null): Promise<PlatformAdminAccess> {
  if (!supabase) {
    return {
      hasSession: true,
      isPlatformAdmin: true,
      email: 'local@catalog.app'
    };
  }

  const session = knownSession !== undefined
    ? knownSession
    : (await supabase.auth.getSession()).data.session;
  if (!session) {
    return {
      hasSession: false,
      isPlatformAdmin: false,
      email: null
    };
  }

  const { data, error } = await supabase.rpc('is_platform_admin');
  return {
    hasSession: true,
    isPlatformAdmin: !error && Boolean(data),
    email: session.user.email ?? null
  };
}

export async function signInPlatformAdmin(email: string, password: string) {
  if (!supabase) return getPlatformAdminAccess();

  const { data, error } = await supabase.auth.signInWithPassword({
    email: email.trim().toLowerCase(),
    password
  });

  if (error) throw new Error(error.message);

  return getPlatformAdminAccess(data.session);
}

export async function signOutPlatformAdmin() {
  clearPwaResumePath();
  if (!supabase) return;
  await supabase.auth.signOut();
}
