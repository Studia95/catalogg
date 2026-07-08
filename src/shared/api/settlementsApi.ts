import {
  readLocalSettlementRequests,
  saveLocalSettlementRequest,
  type SettlementRequest,
  type SettlementRequestInput
} from '../clientIdentity';
import { supabase } from '../supabase';
import type { PlatformDeliverySettlement } from './platformTypes';

type SettlementRequestRow = {
  id: string;
  city_name: string;
  settlement_name: string;
  source: string | null;
  request_count: number | null;
  status: 'new' | 'approved' | 'dismissed' | null;
  created_at: string;
  last_seen_at: string;
};

type DeliverySettlementRow = {
  id: string;
  city_name: string;
  settlement_name: string;
  is_active: boolean | null;
  created_at: string;
};

const mapSettlementRequest = (row: SettlementRequestRow): SettlementRequest => ({
  id: row.id,
  cityName: row.city_name,
  settlementName: row.settlement_name,
  source: row.source ?? 'checkout',
  count: row.request_count ?? 1,
  status: row.status ?? 'new',
  createdAt: row.created_at,
  lastSeenAt: row.last_seen_at
});

const mapDeliverySettlement = (row: DeliverySettlementRow): PlatformDeliverySettlement => ({
  id: row.id,
  cityName: row.city_name,
  settlementName: row.settlement_name,
  isActive: row.is_active ?? true,
  createdAt: row.created_at
});

export async function getDeliverySettlements(): Promise<PlatformDeliverySettlement[]> {
  if (!supabase) return [];

  const { data, error } = await supabase
    .from('delivery_settlements')
    .select('id, city_name, settlement_name, is_active, created_at')
    .order('city_name', { ascending: true })
    .order('settlement_name', { ascending: true });

  if (error) {
    console.warn('Failed to load delivery settlements from Supabase', error);
    return [];
  }

  return ((data ?? []) as unknown as DeliverySettlementRow[]).map(mapDeliverySettlement);
}

export async function createDeliverySettlement(input: { cityName: string; settlementName: string }) {
  const cityName = input.cityName.trim();
  const settlementName = input.settlementName.trim();
  if (!settlementName) throw new Error('Введите село или город.');

  if (!supabase) {
    return {
      id: `local-settlement-${Date.now().toString(36)}`,
      cityName,
      settlementName,
      isActive: true,
      createdAt: new Date().toISOString()
    } satisfies PlatformDeliverySettlement;
  }

  const { data, error } = await supabase
    .from('delivery_settlements')
    .upsert(
      {
        city_name: cityName,
        settlement_name: settlementName,
        is_active: true
      },
      { onConflict: 'city_name,settlement_name' }
    )
    .select('id, city_name, settlement_name, is_active, created_at')
    .single();

  if (error) throw new Error(error.message);
  return mapDeliverySettlement(data as DeliverySettlementRow);
}

export async function submitSettlementRequest(input: SettlementRequestInput) {
  const localRequest = saveLocalSettlementRequest(input);
  if (!localRequest || !supabase) return localRequest;

  const { error } = await supabase.rpc('record_settlement_request', {
    city_name_input: localRequest.cityName,
    settlement_name_input: localRequest.settlementName,
    source_input: input.source
  });

  if (error) {
    console.warn('Failed to save settlement request to Supabase', error);
  }

  return localRequest;
}

export async function getSettlementRequests(): Promise<SettlementRequest[]> {
  if (!supabase) return readLocalSettlementRequests();

  const { data, error } = await supabase
    .from('settlement_requests')
    .select('id, city_name, settlement_name, source, request_count, status, created_at, last_seen_at')
    .eq('status', 'new')
    .order('last_seen_at', { ascending: false });

  if (error) {
    console.warn('Failed to load settlement requests from Supabase', error);
    return readLocalSettlementRequests();
  }

  return ((data ?? []) as unknown as SettlementRequestRow[]).map(mapSettlementRequest);
}
