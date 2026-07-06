import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  buildOsmTileGrid,
  mapPointToCoordinates,
  coordinatesToMapPoint,
  type DeliveryMapPoint
} from './deliveryMap';

describe('delivery map picker geometry', () => {
  it('round-trips delivery coordinates through a map point', () => {
    const center = { lat: 43.3181235, lng: 45.6987654 };
    const point = coordinatesToMapPoint(center, center, 16, 320);
    const next = mapPointToCoordinates(point, center, 16, 320);

    assert.deepEqual(point, { x: 160, y: 160 });
    assert.equal(Number(next.lat.toFixed(7)), center.lat);
    assert.equal(Number(next.lng.toFixed(7)), center.lng);
  });

  it('clamps dragged markers inside the map viewport', () => {
    const center = { lat: 43.3181235, lng: 45.6987654 };
    const point: DeliveryMapPoint = { x: 400, y: -40 };

    assert.deepEqual(coordinatesToMapPoint(mapPointToCoordinates(point, center, 16, 320), center, 16, 320), {
      x: 320,
      y: 0
    });
  });

  it('builds a non-empty free OSM tile grid around the current point', () => {
    const tiles = buildOsmTileGrid({ lat: 43.3181235, lng: 45.6987654 }, 16, 320);

    assert.equal(tiles.length > 0, true);
    assert.equal(tiles.every((tile) => tile.url.startsWith('https://tile.openstreetmap.org/16/')), true);
  });
});
