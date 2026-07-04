import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  buildDriverDeliveryView,
  canSendOrderToDelivery,
  createPickupQrToken,
  rotatePickupQr,
  verifyPickupQr
} from './orderLifecycle';
import type { DeliveryAssignment, DriverDeliveryView, OrderLifecycleSnapshot } from './orderLifecycle';

const order = (overrides: Partial<OrderLifecycleSnapshot> = {}): OrderLifecycleSnapshot => ({
  id: 'order-1',
  orderType: 'delivery',
  status: 'ready',
  paymentStatus: 'confirmed',
  clientName: 'Адам М.',
  clientPhone: '+7 928 123-45-67',
  deliveryAddress: 'ул. Ленина, 123',
  deliveryComment: 'Подъезд 2',
  restaurantName: 'Rizih',
  restaurantAddress: 'пр-т Путина, 20',
  deliveryFee: 470,
  distanceKm: 1.8,
  ...overrides
});

const assignment = (overrides: Partial<DeliveryAssignment> = {}): DeliveryAssignment => ({
  orderId: 'order-1',
  driverId: 'driver-1',
  status: 'assigned',
  pickupQrToken: createPickupQrToken({ orderId: 'order-1', driverId: 'driver-1', nonce: 'nonce-a' }),
  pickupQrExpiresAt: '2026-07-04T12:10:00.000Z',
  assignedAt: '2026-07-04T12:00:00.000Z',
  ...overrides
});

describe('order delivery lifecycle', () => {
  it('does not send delivery orders to drivers before the restaurant confirms payment', () => {
    assert.equal(
      canSendOrderToDelivery(order({ paymentStatus: 'waiting_confirmation' })),
      false
    );

    assert.equal(canSendOrderToDelivery(order()), true);
  });

  it('does not request a driver for dine-in and pickup orders even when payment is confirmed', () => {
    assert.equal(canSendOrderToDelivery(order({ orderType: 'dine_in' })), false);
    assert.equal(canSendOrderToDelivery(order({ orderType: 'pickup' })), false);
  });

  it('rotates pickup QR when a delivery is reassigned and rejects the old token', () => {
    const firstAssignment = assignment();
    const nextAssignment = rotatePickupQr({
      assignment: firstAssignment,
      driverId: 'driver-2',
      nonce: 'nonce-b',
      assignedAt: '2026-07-04T12:05:00.000Z',
      expiresAt: '2026-07-04T12:15:00.000Z'
    });

    assert.notEqual(nextAssignment.pickupQrToken, firstAssignment.pickupQrToken);
    assert.equal(
      verifyPickupQr({
        assignment: nextAssignment,
        token: firstAssignment.pickupQrToken,
        now: '2026-07-04T12:06:00.000Z'
      }).ok,
      false
    );
    assert.deepEqual(
      verifyPickupQr({
        assignment: nextAssignment,
        token: nextAssignment.pickupQrToken,
        now: '2026-07-04T12:06:00.000Z'
      }),
      { ok: true }
    );
  });

  it('rejects expired pickup QR tokens', () => {
    assert.deepEqual(
      verifyPickupQr({
        assignment: assignment(),
        token: assignment().pickupQrToken,
        now: '2026-07-04T12:11:00.000Z'
      }),
      { ok: false, reason: 'expired' }
    );
  });

  it('hides customer contacts from drivers before they accept the delivery', () => {
    const availableView: DriverDeliveryView = buildDriverDeliveryView({
      order: order(),
      assignment: null,
      viewerDriverId: 'driver-1'
    });

    assert.equal(availableView.clientName, undefined);
    assert.equal(availableView.clientPhone, undefined);
    assert.equal(availableView.deliveryComment, undefined);
    assert.equal(availableView.itemsVisible, false);
  });

  it('shows customer contacts only to the assigned driver after acceptance', () => {
    const assignedView = buildDriverDeliveryView({
      order: order(),
      assignment: assignment(),
      viewerDriverId: 'driver-1'
    });
    const otherDriverView = buildDriverDeliveryView({
      order: order(),
      assignment: assignment(),
      viewerDriverId: 'driver-2'
    });

    assert.equal(assignedView.clientName, 'Адам М.');
    assert.equal(assignedView.clientPhone, '+7 928 123-45-67');
    assert.equal(assignedView.deliveryComment, 'Подъезд 2');
    assert.equal(otherDriverView.clientName, undefined);
  });
});
