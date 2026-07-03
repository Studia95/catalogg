import type { CartItem } from '../../entities/models';

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export const buildPublicRestaurantOrderItems = (items: CartItem[]) =>
  items.map((item) => ({
    product_id: item.product.id,
    quantity: Math.max(1, item.quantity),
    options: []
  }));

export const resolvePublicOrderRpcName = (items: CartItem[]) =>
  items.every((item) => uuidPattern.test(item.product.id))
    ? 'create_public_restaurant_order'
    : 'create_legacy_public_restaurant_order';
