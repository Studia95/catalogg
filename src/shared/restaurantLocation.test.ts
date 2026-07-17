import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { buildYandexMapLink, parseRestaurantCoordinatesFromMapLink } from './restaurantLocation';

describe('restaurant location links', () => {
  it('reads Yandex ll coordinates as longitude then latitude', () => {
    assert.deepEqual(
      parseRestaurantCoordinatesFromMapLink('https://yandex.ru/maps/?ll=45.6986000%2C43.3178000&z=16'),
      { lat: 43.3178, lng: 45.6986 }
    );
  });

  it('prefers Yandex point coordinates when both point and map center are present', () => {
    assert.deepEqual(
      parseRestaurantCoordinatesFromMapLink('https://yandex.ru/maps/?ll=45.1,43.1&pt=45.6807903,43.3198743,pm2rdm'),
      { lat: 43.3198743, lng: 45.6807903 }
    );
  });

  it('keeps pasted plain coordinates in latitude then longitude order', () => {
    assert.deepEqual(parseRestaurantCoordinatesFromMapLink('43.3198743, 45.6807903'), {
      lat: 43.3198743,
      lng: 45.6807903
    });
  });

  it('builds Yandex links in longitude then latitude order', () => {
    assert.equal(
      buildYandexMapLink(43.3178, 45.6986),
      'https://yandex.ru/maps/?ll=45.6986,43.3178&z=16&pt=45.6986,43.3178,pm2rdm'
    );
  });
});
