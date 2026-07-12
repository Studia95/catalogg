import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const appSource = readFileSync(resolve(repoRoot, 'src/app/App.tsx'), 'utf8');

describe('restaurant admin mobile order details', () => {
  it('opens an order through a handler that scrolls details into view', () => {
    assert.match(appSource, /const openOrderFromList = \(order: RestaurantOrder\) => \{/);
    assert.match(appSource, /setSelectedOrder\(order\)/);
    assert.match(appSource, /querySelector\('\.admin-order-details-panel'\)/);
    assert.match(appSource, /scrollIntoView\(\{ behavior: 'smooth', block: 'start' \}\)/);
    assert.match(appSource, /onClick=\{\(\) => openOrderFromList\(order\)\}/);
  });
});
