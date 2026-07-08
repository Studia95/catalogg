import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

// @ts-expect-error Node's test runner executes stripped TypeScript files directly in this project.
const identity = await import('./clientIdentity.ts');

const {
  clientPlatformStorageKey,
  loadClientPlatformProfile,
  loadPublicClientCheckoutProfile,
  loadPublicClientProfile,
  normalizeSettlementName,
  savePublicClientProfile,
  saveLocalSettlementRequest,
  readLocalSettlementRequests
} = identity;

class MemoryStorage implements Storage {
  private values = new Map<string, string>();
  readonly length = 0;

  clear() {
    this.values.clear();
  }

  getItem(key: string) {
    return this.values.get(key) ?? null;
  }

  key(index: number) {
    return [...this.values.keys()][index] ?? null;
  }

  removeItem(key: string) {
    this.values.delete(key);
  }

  setItem(key: string, value: string) {
    this.values.set(key, value);
  }
}

describe('public client identity', () => {
  it('saves and reloads checkout identity for a restaurant slug', () => {
    const storage = new MemoryStorage();

    savePublicClientProfile(
      'mangal',
      {
        name: '  Адам ',
        phone: ' +7 928 123-45-67 ',
        deliveryCity: ' Грозный ',
        deliverySettlement: ' Цоци-Юрт ',
        deliveryAddress: ' ул. Ленина, 1 '
      },
      storage
    );

    assert.deepEqual(loadPublicClientProfile('mangal', storage), {
      name: 'Адам',
      phone: '+7 928 123-45-67',
      deliveryCity: 'Грозный',
      deliverySettlement: 'Цоци-Юрт',
      deliveryAddress: 'ул. Ленина, 1'
    });
  });

  it('loads registered client profile from the PWA client platform store', () => {
    const storage = new MemoryStorage();
    storage.setItem(
      clientPlatformStorageKey,
      JSON.stringify({
        state: {
          profile: { name: 'Амина', phone: '+7 999 111-22-33' },
          addresses: [
            {
              id: 'home',
              addressLine: 'ул. Мира, 7',
              isDefault: true
            }
          ],
          checkoutDrafts: {}
        },
        version: 2
      })
    );

    assert.deepEqual(loadClientPlatformProfile('mangal', storage), {
      name: 'Амина',
      phone: '+7 999 111-22-33',
      deliveryCity: '',
      deliverySettlement: '',
      deliveryAddress: 'ул. Мира, 7'
    });
  });

  it('merges restaurant checkout profile over the global PWA profile', () => {
    const storage = new MemoryStorage();
    storage.setItem(
      clientPlatformStorageKey,
      JSON.stringify({
        state: {
          profile: { name: 'Амина', phone: '+7 999 111-22-33' },
          addresses: [],
          checkoutDrafts: {}
        },
        version: 2
      })
    );
    savePublicClientProfile(
      'mangal',
      {
        name: '',
        phone: '',
        deliveryCity: 'Грозный',
        deliverySettlement: 'Цоци-Юрт',
        deliveryAddress: 'ул. Ленина, 1'
      },
      storage
    );

    assert.deepEqual(loadPublicClientCheckoutProfile('mangal', storage), {
      name: 'Амина',
      phone: '+7 999 111-22-33',
      deliveryCity: 'Грозный',
      deliverySettlement: 'Цоци-Юрт',
      deliveryAddress: 'ул. Ленина, 1'
    });
  });

  it('normalizes settlement names for matching and dedupe', () => {
    assert.equal(normalizeSettlementName('  цоци   юрт '), 'Цоци Юрт');
  });

  it('deduplicates local new-settlement requests and increments count', () => {
    const storage = new MemoryStorage();

    saveLocalSettlementRequest({ cityName: 'Грозный', settlementName: 'Цоци Юрт', source: 'checkout' }, storage);
    saveLocalSettlementRequest({ cityName: 'Грозный', settlementName: ' цоци   юрт ', source: 'checkout' }, storage);

    const requests = readLocalSettlementRequests(storage);
    assert.equal(requests.length, 1);
    assert.equal(requests[0].settlementName, 'Цоци Юрт');
    assert.equal(requests[0].count, 2);
  });
});
