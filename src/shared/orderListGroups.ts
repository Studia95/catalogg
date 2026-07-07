export type OrderDateSource = {
  createdAt: string;
};

export type OrderDateGroup<T extends OrderDateSource> = {
  key: string;
  label: string;
  orders: T[];
};

const dateKey = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const startOfDay = (date: Date) => new Date(date.getFullYear(), date.getMonth(), date.getDate());

export const formatOrderTime = (createdAt: string) =>
  new Date(createdAt).toLocaleTimeString('ru-RU', {
    hour: '2-digit',
    minute: '2-digit'
  });

export const formatOrderDateGroupLabel = (createdAt: string, now = new Date()) => {
  const date = new Date(createdAt);
  const currentDay = startOfDay(now);
  const orderDay = startOfDay(date);
  const dayDistance = Math.round((currentDay.getTime() - orderDay.getTime()) / 86_400_000);

  if (dayDistance === 0) return 'Сегодня';
  if (dayDistance === 1) return 'Вчера';

  return date.toLocaleDateString('ru-RU', {
    day: 'numeric',
    month: 'long'
  });
};

export const groupOrdersByDate = <T extends OrderDateSource>(orders: readonly T[], now = new Date()) => {
  const groups = new Map<string, OrderDateGroup<T>>();
  const sortedOrders = [...orders].sort(
    (left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime()
  );

  for (const order of sortedOrders) {
    const key = dateKey(new Date(order.createdAt));
    const group = groups.get(key) ?? {
      key,
      label: formatOrderDateGroupLabel(order.createdAt, now),
      orders: []
    };
    group.orders.push(order);
    groups.set(key, group);
  }

  return [...groups.values()];
};
