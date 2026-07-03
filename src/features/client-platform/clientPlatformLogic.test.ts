import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  buildOrderAfterClientPaymentNotice,
  calculateCartSummary,
  filterRestaurants,
  getDeliveryProviderLabel
} from './clientPlatformLogic';
import type { ClientCartLine, ClientDish, ClientRestaurant } from './types';

const restaurants: ClientRestaurant[] = [
  {
    id: 'restaurant-rizih',
    slug: 'rizih',
    name: 'Rizih',
    description: 'Суши и пицца',
    cityId: 'grozny',
    categorySlugs: ['sushi', 'pizza'],
    logoUrl: '',
    coverUrl: '',
    rating: 4.7,
    minOrderAmount: 500,
    freeDeliveryFrom: 900,
    deliveryTimeFrom: 30,
    deliveryTimeTo: 40,
    deliveryProvider: 'restaurant',
    theme: {
      accentColor: '#057a3d',
      backgroundColor: '#f2fbf6',
      buttonColor: '#057a3d',
      buttonTextColor: '#ffffff',
      cardColor: '#ffffff',
      textColor: '#10241a',
      mutedTextColor: '#577064'
    },
    orderTypes: ['dine_in', 'pickup', 'delivery'],
    paymentMethods: ['qr', 'bank_transfer', 'cash']
  },
  {
    id: 'restaurant-mangal',
    slug: 'mangal',
    name: 'Мангал',
    description: 'Шашлык',
    cityId: 'grozny',
    categorySlugs: ['kebab'],
    logoUrl: '',
    coverUrl: '',
    rating: 4.8,
    minOrderAmount: 700,
    freeDeliveryFrom: 1200,
    deliveryTimeFrom: 30,
    deliveryTimeTo: 40,
    deliveryProvider: 'platform',
    theme: {
      accentColor: '#8b4513',
      backgroundColor: '#fff8f1',
      buttonColor: '#8b4513',
      buttonTextColor: '#ffffff',
      cardColor: '#ffffff',
      textColor: '#241309',
      mutedTextColor: '#786154'
    },
    orderTypes: ['pickup', 'delivery'],
    paymentMethods: ['bank_transfer', 'cash']
  },
  {
    id: 'restaurant-berkat',
    slug: 'berkat',
    name: 'Баракат',
    description: 'Пицца и напитки',
    cityId: 'argun',
    categorySlugs: ['pizza', 'drinks'],
    logoUrl: '',
    coverUrl: '',
    rating: 4.6,
    minOrderAmount: 400,
    freeDeliveryFrom: 1000,
    deliveryTimeFrom: 25,
    deliveryTimeTo: 35,
    deliveryProvider: 'pickup',
    theme: {
      accentColor: '#5b3df4',
      backgroundColor: '#f6f4ff',
      buttonColor: '#5b3df4',
      buttonTextColor: '#ffffff',
      cardColor: '#ffffff',
      textColor: '#18112f',
      mutedTextColor: '#6f6686'
    },
    orderTypes: ['pickup'],
    paymentMethods: ['cash']
  }
];

const dishes: ClientDish[] = [
  {
    id: 'rolls',
    restaurantSlug: 'rizih',
    categorySlug: 'sushi',
    name: 'Роллы',
    description: 'Сет роллов',
    price: 520,
    imageUrl: '',
    tags: ['Хит'],
    isPopular: true,
    stockCount: 6
  },
  {
    id: 'pizza',
    restaurantSlug: 'rizih',
    categorySlug: 'pizza',
    name: 'Пицца',
    description: 'Пепперони',
    price: 450,
    imageUrl: '',
    tags: ['Острое'],
    isPopular: false,
    stockCount: 4
  }
];

describe('client platform restaurant filtering', () => {
  it('keeps restaurant search inside the selected city and platform category', () => {
    const result = filterRestaurants(restaurants, {
      cityId: 'grozny',
      categorySlug: 'pizza',
      query: 'riz'
    });

    assert.deepEqual(
      result.map((restaurant) => restaurant.slug),
      ['rizih']
    );
  });

  it('returns every restaurant in a city when category and search are empty', () => {
    const result = filterRestaurants(restaurants, { cityId: 'grozny', categorySlug: 'all', query: '' });

    assert.deepEqual(
      result.map((restaurant) => restaurant.slug),
      ['rizih', 'mangal']
    );
  });
});

describe('client platform cart summary', () => {
  it('calculates quantity, subtotal, delivery fee and total from restaurant-local cart lines', () => {
    const lines: ClientCartLine[] = [
      { dishId: 'rolls', quantity: 2 },
      { dishId: 'pizza', quantity: 1 }
    ];

    assert.deepEqual(calculateCartSummary(lines, dishes, 120), {
      quantity: 3,
      subtotal: 1490,
      deliveryFee: 120,
      total: 1610
    });
  });
});

describe('client platform order statuses', () => {
  it('keeps a delivery order waiting for restaurant payment confirmation after client marks it paid', () => {
    const order = buildOrderAfterClientPaymentNotice({
      id: 'order-1',
      restaurantSlug: 'rizih',
      restaurantName: 'Rizih',
      orderType: 'delivery',
      deliveryProvider: 'restaurant',
      paymentMethod: 'qr',
      totalAmount: 1470,
      addressLine: 'ул. Ленина, 123',
      clientName: 'Адам',
      clientPhone: '+7 928 123-45-67'
    });

    assert.equal(order.status, 'waiting_payment_confirmation');
    assert.equal(order.paymentStatus, 'waiting_confirmation');
    assert.equal(getDeliveryProviderLabel(order.deliveryProvider, order.orderType), 'Доставляет ресторан');
  });

  it('marks pickup cash orders as new and unpaid because delivery prepayment is not required', () => {
    const order = buildOrderAfterClientPaymentNotice({
      id: 'order-2',
      restaurantSlug: 'mangal',
      restaurantName: 'Мангал',
      orderType: 'pickup',
      deliveryProvider: 'pickup',
      paymentMethod: 'cash',
      totalAmount: 900,
      addressLine: '',
      clientName: 'Адам',
      clientPhone: '+7 928 123-45-67'
    });

    assert.equal(order.status, 'new');
    assert.equal(order.paymentStatus, 'unpaid');
    assert.equal(getDeliveryProviderLabel(order.deliveryProvider, order.orderType), 'Самовывоз');
  });
});
