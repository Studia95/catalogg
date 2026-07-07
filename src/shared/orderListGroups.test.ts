import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

// @ts-expect-error Node's test runner executes stripped TypeScript files directly in this project.
const { formatOrderDateGroupLabel, formatOrderTime, groupOrdersByDate } = await import('./orderListGroups.ts');

describe('order list date grouping', () => {
  const now = new Date('2026-07-07T12:00:00');

  it('groups orders into today, yesterday, and older date buckets', () => {
    const groups = groupOrdersByDate(
      [
        { id: 'older', createdAt: '2026-07-05T15:21:00' },
        { id: 'today', createdAt: '2026-07-07T09:10:00' },
        { id: 'yesterday', createdAt: '2026-07-06T20:30:00' }
      ],
      now
    );

    assert.deepEqual(
      groups.map((group) => ({
        label: group.label,
        orderIds: group.orders.map((order) => order.id)
      })),
      [
        { label: 'Сегодня', orderIds: ['today'] },
        { label: 'Вчера', orderIds: ['yesterday'] },
        { label: '5 июля', orderIds: ['older'] }
      ]
    );
  });

  it('formats compact Russian order time', () => {
    assert.equal(formatOrderTime('2026-07-07T15:21:30'), '15:21');
  });

  it('formats older group labels as day and month', () => {
    assert.equal(formatOrderDateGroupLabel('2026-07-05T15:21:00', now), '5 июля');
  });
});
