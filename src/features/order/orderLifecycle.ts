export type OrderType = 'dine_in' | 'pickup' | 'delivery';

export type OrderStatus =
  | 'new'
  | 'waiting_payment_confirmation'
  | 'payment_confirmed'
  | 'accepted'
  | 'cooking'
  | 'ready'
  | 'waiting_driver'
  | 'assigned_driver'
  | 'picked_up'
  | 'on_the_way'
  | 'completed'
  | 'canceled';

export type PaymentStatus = 'unpaid' | 'waiting_confirmation' | 'confirmed' | 'rejected';

export type DeliveryStatus =
  | 'not_required'
  | 'waiting_courier'
  | 'assigned'
  | 'arrived_to_restaurant'
  | 'handed_over'
  | 'on_the_way'
  | 'delivered'
  | 'failed';

export type DriverStatus =
  | 'offline'
  | 'online'
  | 'busy'
  | 'heading_to_restaurant'
  | 'at_restaurant'
  | 'picked_up'
  | 'heading_to_client'
  | 'at_client'
  | 'completed';

export type OrderLifecycleSnapshot = {
  readonly id: string;
  readonly orderType: OrderType;
  readonly status: OrderStatus;
  readonly paymentStatus: PaymentStatus;
  readonly clientName: string;
  readonly clientPhone: string;
  readonly deliveryAddress: string;
  readonly deliveryComment: string;
  readonly restaurantName: string;
  readonly restaurantAddress: string;
  readonly deliveryFee: number;
  readonly distanceKm: number;
};

export type DeliveryAssignment = {
  readonly orderId: string;
  readonly driverId: string;
  readonly status: DeliveryStatus;
  readonly pickupQrToken: string;
  readonly pickupQrExpiresAt: string;
  readonly assignedAt: string;
};

export type DriverDeliveryView = {
  readonly orderId: string;
  readonly restaurantName: string;
  readonly restaurantAddress: string;
  readonly deliveryAddress: string;
  readonly deliveryFee: number;
  readonly distanceKm: number;
  readonly status: DeliveryStatus;
  readonly isAssignedToViewer: boolean;
  readonly itemsVisible: boolean;
  readonly clientName?: string;
  readonly clientPhone?: string;
  readonly deliveryComment?: string;
  readonly pickupQrToken?: string;
};

type CreatePickupQrTokenInput = {
  readonly orderId: string;
  readonly driverId: string;
  readonly nonce: string;
};

type RotatePickupQrInput = {
  readonly assignment: DeliveryAssignment;
  readonly driverId: string;
  readonly nonce: string;
  readonly assignedAt: string;
  readonly expiresAt: string;
};

type VerifyPickupQrInput = {
  readonly assignment: DeliveryAssignment;
  readonly token: string;
  readonly now: string;
};

type BuildDriverDeliveryViewInput = {
  readonly order: OrderLifecycleSnapshot;
  readonly assignment: DeliveryAssignment | null;
  readonly viewerDriverId: string;
};

type VerifyPickupQrResult =
  | { readonly ok: true }
  | { readonly ok: false; readonly reason: 'mismatch' | 'expired' | 'not_assigned' };

export const canSendOrderToDelivery = (order: Pick<OrderLifecycleSnapshot, 'orderType' | 'status' | 'paymentStatus'>) =>
  order.orderType === 'delivery' && order.status === 'ready' && order.paymentStatus === 'confirmed';

export const createPickupQrToken = ({ orderId, driverId, nonce }: CreatePickupQrTokenInput) =>
  [orderId.trim(), driverId.trim(), nonce.trim()].join(':');

export const rotatePickupQr = ({
  assignment,
  driverId,
  nonce,
  assignedAt,
  expiresAt
}: RotatePickupQrInput): DeliveryAssignment => ({
  ...assignment,
  driverId,
  pickupQrToken: createPickupQrToken({ orderId: assignment.orderId, driverId, nonce }),
  pickupQrExpiresAt: expiresAt,
  assignedAt,
  status: 'assigned'
});

export const verifyPickupQr = ({ assignment, token, now }: VerifyPickupQrInput): VerifyPickupQrResult => {
  if (assignment.status !== 'assigned' && assignment.status !== 'arrived_to_restaurant') {
    return { ok: false, reason: 'not_assigned' };
  }

  if (Date.parse(now) > Date.parse(assignment.pickupQrExpiresAt)) {
    return { ok: false, reason: 'expired' };
  }

  if (token !== assignment.pickupQrToken) {
    return { ok: false, reason: 'mismatch' };
  }

  return { ok: true };
};

export const buildDriverDeliveryView = ({
  order,
  assignment,
  viewerDriverId
}: BuildDriverDeliveryViewInput): DriverDeliveryView => {
  const isAssignedToViewer = assignment?.driverId === viewerDriverId;

  return {
    orderId: order.id,
    restaurantName: order.restaurantName,
    restaurantAddress: order.restaurantAddress,
    deliveryAddress: order.deliveryAddress,
    deliveryFee: order.deliveryFee,
    distanceKm: order.distanceKm,
    status: assignment?.status ?? 'waiting_courier',
    isAssignedToViewer,
    itemsVisible: false,
    clientName: isAssignedToViewer ? order.clientName : undefined,
    clientPhone: isAssignedToViewer ? order.clientPhone : undefined,
    deliveryComment: isAssignedToViewer ? order.deliveryComment : undefined,
    pickupQrToken: isAssignedToViewer ? assignment.pickupQrToken : undefined
  };
};
