import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { canRestoreWebPushSubscription } from './webPushContext';

describe('web push subscription restoration', () => {
  it('restores a granted restaurant subscription only with a restaurant context', () => {
    assert.equal(
      canRestoreWebPushSubscription('granted', { role: 'restaurant', catalogId: 'catalog-1' }),
      true
    );
    assert.equal(canRestoreWebPushSubscription('granted', { role: 'restaurant' }), false);
  });

  it('restores driver, administrator and client subscriptions only when their target is known', () => {
    assert.equal(canRestoreWebPushSubscription('granted', { role: 'driver', driverId: 'driver-1' }), true);
    assert.equal(canRestoreWebPushSubscription('granted', { role: 'driver' }), false);
    assert.equal(canRestoreWebPushSubscription('granted', { role: 'super_admin' }), true);
    assert.equal(canRestoreWebPushSubscription('granted', { role: 'client', orderId: 'order-1' }), true);
    assert.equal(canRestoreWebPushSubscription('granted', { role: 'client' }), false);
  });

  it('never restores a subscription when browser permission is not granted', () => {
    assert.equal(
      canRestoreWebPushSubscription('default', { role: 'restaurant', catalogSlug: 'mangal' }),
      false
    );
    assert.equal(canRestoreWebPushSubscription('denied', { role: 'super_admin' }), false);
  });
});
