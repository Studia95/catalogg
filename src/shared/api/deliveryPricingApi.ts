import { supabase } from '../supabase';
import { findDeliveryPrice } from '../../features/order/orderLifecycle';

export type DeliveryPricingRule = {
  id: string;
  fromSettlement: string;
  toSettlement: string;
  amount: number;
  isActive: boolean;
};

export type DeliveryPriceRequest = {
  id: string;
  deliveryId: string;
  driverId: string;
  driverName: string;
  requestedAmount: number;
  currentAmount: number;
  comment: string;
  status: 'new' | 'approved' | 'rejected';
  createdAt: string;
};

type PricingRuleRow = {
  id: string;
  from_settlement: string;
  to_settlement: string;
  amount: number;
  is_active: boolean;
};

type PriceRequestRow = {
  id: string;
  delivery_id: string;
  driver_id: string;
  requested_amount: number;
  current_amount: number;
  comment: string;
  status: DeliveryPriceRequest['status'];
  created_at: string;
  drivers?: { name: string | null } | Array<{ name: string | null }> | null;
};

const firstRelation = <T,>(value: T | T[] | null | undefined): T | null =>
  Array.isArray(value) ? value[0] ?? null : value ?? null;

const mapRule = (row: PricingRuleRow): DeliveryPricingRule => ({
  id: row.id,
  fromSettlement: row.from_settlement,
  toSettlement: row.to_settlement,
  amount: Number(row.amount),
  isActive: row.is_active
});

export async function getDeliveryPricingRules(): Promise<DeliveryPricingRule[]> {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from('delivery_pricing_rules')
    .select('id, from_settlement, to_settlement, amount, is_active')
    .order('from_settlement')
    .order('to_settlement');
  if (error) throw error;
  return ((data ?? []) as unknown as PricingRuleRow[]).map(mapRule);
}

export async function getConfiguredDeliveryPrice(fromSettlement: string, toSettlement: string): Promise<number | null> {
  try {
    return findDeliveryPrice(await getDeliveryPricingRules(), fromSettlement, toSettlement);
  } catch {
    return null;
  }
}

export async function saveDeliveryPricingRule(input: {
  id?: string;
  fromSettlement: string;
  toSettlement: string;
  amount: number;
}) {
  if (!supabase) return;
  const fromSettlement = input.fromSettlement.trim();
  const toSettlement = input.toSettlement.trim();
  const amount = Number(input.amount);
  if (!fromSettlement || !toSettlement || !Number.isFinite(amount) || amount < 0) {
    throw new Error('Укажите оба населённых пункта и корректную цену.');
  }

  const { error } = await supabase.from('delivery_pricing_rules').upsert({
    ...(input.id ? { id: input.id } : {}),
    from_settlement: fromSettlement,
    to_settlement: toSettlement,
    amount,
    is_active: true
  }, { onConflict: 'from_settlement,to_settlement' });
  if (error) throw error;
}

export async function getDeliveryPriceRequests(): Promise<DeliveryPriceRequest[]> {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from('delivery_price_requests')
    .select('id, delivery_id, driver_id, requested_amount, current_amount, comment, status, created_at, drivers(name)')
    .eq('status', 'new')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return ((data ?? []) as unknown as PriceRequestRow[]).map((row) => ({
    id: row.id,
    deliveryId: row.delivery_id,
    driverId: row.driver_id,
    driverName: firstRelation(row.drivers)?.name ?? 'Водитель',
    requestedAmount: Number(row.requested_amount),
    currentAmount: Number(row.current_amount),
    comment: row.comment,
    status: row.status,
    createdAt: row.created_at
  }));
}

export async function reviewDeliveryPriceRequest(input: {
  requestId: string;
  approved: boolean;
  amount?: number;
}) {
  if (!supabase) return;
  const { error } = await supabase.rpc('review_delivery_price_request', {
    target_request_id: input.requestId,
    approved: input.approved,
    reviewed_amount_input: input.amount ?? null
  });
  if (error) throw error;
}

export async function requestDriverDeliveryPrice(input: {
  deliveryId: string;
  driverId: string;
  amount: number;
  comment?: string;
}) {
  if (!supabase) return;
  const { error } = await supabase.rpc('request_delivery_price', {
    target_delivery_id: input.deliveryId,
    target_driver_id: input.driverId,
    requested_amount_input: input.amount,
    comment_input: input.comment ?? ''
  });
  if (error) throw error;
}
