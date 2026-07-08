export type PublicClientProfile = {
  name: string;
  phone: string;
  deliveryCity: string;
  deliverySettlement: string;
  deliveryAddress: string;
};

export type SettlementRequest = {
  id: string;
  cityName: string;
  settlementName: string;
  source: string;
  count: number;
  status: 'new' | 'approved' | 'dismissed';
  createdAt: string;
  lastSeenAt: string;
};

export type SettlementRequestInput = {
  cityName: string;
  settlementName: string;
  source: string;
};

export const settlementRequestsStorageKey = 'waycatalog:settlement-requests';

const profileStorageKey = (slug: string) => `waycatalog:${slug}:public-client-profile`;

const normalizeText = (value: string) => value.trim().replace(/\s+/g, ' ');

const titleCaseWord = (word: string) =>
  word ? `${word[0].toLocaleUpperCase('ru-RU')}${word.slice(1).toLocaleLowerCase('ru-RU')}` : word;

const titleCaseHyphenatedWord = (word: string) => word.split('-').map(titleCaseWord).join('-');

export const normalizeSettlementName = (value: string) =>
  normalizeText(value)
    .split(' ')
    .map(titleCaseHyphenatedWord)
    .join(' ');

const normalizeCityName = normalizeSettlementName;

const isProfile = (value: unknown): value is PublicClientProfile => {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Record<string, unknown>;
  return ['name', 'phone', 'deliveryCity', 'deliverySettlement', 'deliveryAddress'].every(
    (key) => typeof candidate[key] === 'string'
  );
};

export const loadPublicClientProfile = (slug: string, storage: Storage = localStorage): PublicClientProfile | null => {
  try {
    const stored = storage.getItem(profileStorageKey(slug));
    if (!stored) return null;
    const parsed: unknown = JSON.parse(stored);
    return isProfile(parsed) ? parsed : null;
  } catch {
    return null;
  }
};

export const savePublicClientProfile = (
  slug: string,
  profile: PublicClientProfile,
  storage: Storage = localStorage
) => {
  const nextProfile: PublicClientProfile = {
    name: normalizeText(profile.name),
    phone: normalizeText(profile.phone),
    deliveryCity: normalizeCityName(profile.deliveryCity),
    deliverySettlement: normalizeSettlementName(profile.deliverySettlement),
    deliveryAddress: normalizeText(profile.deliveryAddress)
  };

  storage.setItem(profileStorageKey(slug), JSON.stringify(nextProfile));
  return nextProfile;
};

const isSettlementRequest = (value: unknown): value is SettlementRequest => {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.id === 'string' &&
    typeof candidate.cityName === 'string' &&
    typeof candidate.settlementName === 'string' &&
    typeof candidate.source === 'string' &&
    typeof candidate.count === 'number' &&
    typeof candidate.createdAt === 'string' &&
    typeof candidate.lastSeenAt === 'string'
  );
};

export const readLocalSettlementRequests = (storage: Storage = localStorage): SettlementRequest[] => {
  try {
    const stored = storage.getItem(settlementRequestsStorageKey);
    if (!stored) return [];
    const parsed: unknown = JSON.parse(stored);
    return Array.isArray(parsed) ? parsed.filter(isSettlementRequest) : [];
  } catch {
    return [];
  }
};

export const saveLocalSettlementRequest = (
  input: SettlementRequestInput,
  storage: Storage = localStorage,
  now = new Date()
) => {
  const cityName = normalizeCityName(input.cityName);
  const settlementName = normalizeSettlementName(input.settlementName);
  if (!settlementName) return null;

  const current = readLocalSettlementRequests(storage);
  const requestKey = `${cityName.toLocaleLowerCase('ru-RU')}|${settlementName.toLocaleLowerCase('ru-RU')}`;
  const existing = current.find(
    (request) =>
      `${request.cityName.toLocaleLowerCase('ru-RU')}|${request.settlementName.toLocaleLowerCase('ru-RU')}` ===
      requestKey
  );

  const timestamp = now.toISOString();
  const nextRequest: SettlementRequest = existing
    ? {
        ...existing,
        count: existing.count + 1,
        lastSeenAt: timestamp
      }
    : {
        id: `settlement-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
        cityName,
        settlementName,
        source: input.source,
        count: 1,
        status: 'new',
        createdAt: timestamp,
        lastSeenAt: timestamp
      };

  const nextRequests = existing
    ? current.map((request) => (request.id === existing.id ? nextRequest : request))
    : [nextRequest, ...current];

  storage.setItem(settlementRequestsStorageKey, JSON.stringify(nextRequests));
  return nextRequest;
};
