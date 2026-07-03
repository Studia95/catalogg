import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { CartItem, Product } from '../../entities/models';
import { buildPublicRestaurantOrderItems } from './restaurantOrderPayload';

const product = (overrides: Partial<Product> = {}): Product => ({
  id: 'product-1',
  title: 'Жижиг-галнаш',
  price: 380,
  description: '',
  image_url: '',
  ingredients: '',
  weight: '',
  spicy_level: 0,
  serving: '',
  is_popular: false,
  is_new: false,
  is_hit: false,
  is_unlimited: true,
  stock_count: 10,
  category_id: 'chechen',
  pair_ids: [],
  ...overrides
});

describe('public restaurant order payload', () => {
  it('serializes legacy cart lines with an explicit empty options array', () => {
    const items: CartItem[] = [{ product: product(), quantity: 2 }];

    assert.deepEqual(buildPublicRestaurantOrderItems(items), [
      {
        product_id: 'product-1',
        quantity: 2,
        options: []
      }
    ]);
  });

  it('clamps persisted invalid quantities before sending the order to Supabase', () => {
    const items: CartItem[] = [{ product: product({ id: 'product-2' }), quantity: 0 }];

    assert.deepEqual(buildPublicRestaurantOrderItems(items), [
      {
        product_id: 'product-2',
        quantity: 1,
        options: []
      }
    ]);
  });
});
