export type WebPushRole = 'client' | 'restaurant' | 'driver' | 'super_admin';

export type WebPushContext = {
  role: WebPushRole;
  catalogId?: string | null;
  catalogSlug?: string | null;
  driverId?: string | null;
  orderId?: string | null;
};

export const canRestoreWebPushSubscription = (
  permission: NotificationPermission | 'unsupported',
  context: WebPushContext
) => {
  if (permission !== 'granted') return false;
  if (context.role === 'super_admin') return true;
  if (context.role === 'restaurant') return Boolean(context.catalogId || context.catalogSlug);
  if (context.role === 'driver') return Boolean(context.driverId);
  return Boolean(context.orderId);
};
