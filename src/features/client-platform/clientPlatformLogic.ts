import type {
  ClientCartLine,
  ClientCartSummary,
  ClientDeliveryProvider,
  ClientDish,
  ClientOrder,
  ClientOrderStatus,
  ClientOrderType,
  ClientPaymentMethod,
  ClientPaymentStatus,
  ClientRestaurant
} from './types';

type RestaurantFilter = {
  cityId: string;
  categorySlug?: string;
  query?: string;
};

type OrderPaymentNoticeInput = {
  id: string;
  restaurantSlug: string;
  restaurantName: string;
  orderType: ClientOrderType;
  deliveryProvider: ClientDeliveryProvider;
  paymentMethod: ClientPaymentMethod;
  totalAmount: number;
  addressLine: string;
  clientName: string;
  clientPhone: string;
  createdAt?: string;
  estimatedTimeMin?: number;
  estimatedTimeMax?: number;
  items?: ClientOrder['items'];
};

const normalizeText = (value: string) => value.trim().toLocaleLowerCase('ru-RU');

export const filterRestaurants = (
  restaurants: ClientRestaurant[],
  { cityId, categorySlug = 'all', query = '' }: RestaurantFilter
) => {
  const normalizedQuery = normalizeText(query);
  const hasCategory = categorySlug !== '' && categorySlug !== 'all';

  return restaurants.filter((restaurant) => {
    const inCity = restaurant.cityId === cityId;
    const inCategory = !hasCategory || restaurant.categorySlugs.includes(categorySlug);
    const matchesQuery =
      normalizedQuery.length === 0 ||
      normalizeText(`${restaurant.name} ${restaurant.description}`).includes(normalizedQuery);

    return inCity && inCategory && matchesQuery;
  });
};

export const calculateCartSummary = (
  lines: ClientCartLine[],
  dishes: ClientDish[],
  deliveryFee = 0
): ClientCartSummary => {
  const dishById = new Map(dishes.map((dish) => [dish.id, dish]));

  return lines.reduce<ClientCartSummary>(
    (summary, line) => {
      const dish = dishById.get(line.dishId);
      if (!dish) return summary;

      const lineSubtotal = dish.price * line.quantity;

      return {
        quantity: summary.quantity + line.quantity,
        subtotal: summary.subtotal + lineSubtotal,
        deliveryFee,
        total: summary.total + lineSubtotal
      };
    },
    { quantity: 0, subtotal: 0, deliveryFee, total: deliveryFee }
  );
};

export const getDeliveryProviderLabel = (
  deliveryProvider: ClientDeliveryProvider,
  orderType: ClientOrderType = 'delivery'
) => {
  if (orderType === 'dine_in' || deliveryProvider === 'dine_in') return 'Заказ в зале';
  if (orderType === 'pickup' || deliveryProvider === 'pickup') return 'Самовывоз';
  if (deliveryProvider === 'platform') return 'Доставляет водитель платформы';
  return 'Доставляет ресторан';
};

const resolveOrderStatus = (
  orderType: ClientOrderType,
  paymentMethod: ClientPaymentMethod
): { status: ClientOrderStatus; paymentStatus: ClientPaymentStatus } => {
  if (orderType === 'delivery' && paymentMethod !== 'cash') {
    return { status: 'waiting_payment_confirmation', paymentStatus: 'waiting_confirmation' };
  }

  return { status: 'new', paymentStatus: paymentMethod === 'cash' ? 'unpaid' : 'waiting_confirmation' };
};

export const buildOrderAfterClientPaymentNotice = (input: OrderPaymentNoticeInput): ClientOrder => {
  const { status, paymentStatus } = resolveOrderStatus(input.orderType, input.paymentMethod);

  return {
    id: input.id,
    restaurantSlug: input.restaurantSlug,
    restaurantName: input.restaurantName,
    orderType: input.orderType,
    deliveryProvider: input.deliveryProvider,
    paymentMethod: input.paymentMethod,
    status,
    paymentStatus,
    totalAmount: input.totalAmount,
    addressLine: input.addressLine,
    clientName: input.clientName,
    clientPhone: input.clientPhone,
    createdAt: input.createdAt ?? new Date().toISOString(),
    estimatedTimeMin: input.estimatedTimeMin ?? 30,
    estimatedTimeMax: input.estimatedTimeMax ?? 40,
    items: input.items ?? []
  };
};
