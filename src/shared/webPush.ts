import { supabase } from './supabase';
import type { WebPushContext } from './webPushContext';

export type { WebPushContext, WebPushRole } from './webPushContext';

const publicKey = () => import.meta.env.VITE_WEB_PUSH_PUBLIC_KEY?.trim() ?? '';

const base64UrlToUint8Array = (value: string) => {
  const padding = '='.repeat((4 - (value.length % 4)) % 4);
  const base64 = `${value.replace(/-/g, '+').replace(/_/g, '/')}${padding}`;
  const raw = window.atob(base64);
  return Uint8Array.from(raw, (character) => character.charCodeAt(0));
};

export const isWebPushSupported = () =>
  typeof window !== 'undefined' &&
  'Notification' in window &&
  'serviceWorker' in navigator &&
  'PushManager' in window;

export async function registerWebPushSubscription(context: WebPushContext): Promise<boolean> {
  if (!isWebPushSupported() || !supabase || !publicKey() || Notification.permission !== 'granted') return false;

  const registration = await navigator.serviceWorker.ready;
  let subscription = await registration.pushManager.getSubscription();
  if (!subscription) {
    subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: base64UrlToUint8Array(publicKey())
    });
  }

  const json = subscription.toJSON();
  const endpoint = json.endpoint ?? subscription.endpoint;
  const p256dh = json.keys?.p256dh;
  const auth = json.keys?.auth;
  if (!endpoint || !p256dh || !auth) return false;

  let catalogId = context.catalogId ?? null;
  if (!catalogId && context.catalogSlug) {
    const { data } = await supabase.from('catalogs').select('id').eq('slug', context.catalogSlug).maybeSingle();
    catalogId = typeof data?.id === 'string' ? data.id : null;
  }

  const { error } = await supabase.rpc('upsert_web_push_subscription', {
    subscription_endpoint: endpoint,
    p256dh_key: p256dh,
    auth_key: auth,
    role_name: context.role,
    catalog_id_input: catalogId,
    driver_id_input: context.driverId ?? null,
    order_id_input: context.orderId ?? null
  });

  if (error) throw error;
  return true;
}

export async function removeWebPushSubscription() {
  if (!isWebPushSupported() || !supabase) return;
  const registration = await navigator.serviceWorker.ready;
  const subscription = await registration.pushManager.getSubscription();
  if (!subscription) return;
  await supabase.rpc('delete_web_push_subscription', { subscription_endpoint: subscription.endpoint });
  await subscription.unsubscribe();
}
