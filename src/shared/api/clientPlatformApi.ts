import { clientPlatformSnapshot } from '../../features/client-platform/mockData';
import type { ClientPlatformSnapshot } from '../../features/client-platform/types';
import { supabase } from '../supabase';

export async function getClientPlatformSnapshot(): Promise<ClientPlatformSnapshot> {
  if (!supabase) return clientPlatformSnapshot;

  const { data, error } = await supabase.from('cities').select('id').limit(1);
  if (error || !data?.length) return clientPlatformSnapshot;

  return clientPlatformSnapshot;
}
