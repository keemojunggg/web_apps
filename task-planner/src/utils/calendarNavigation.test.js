import test from 'node:test';
import assert from 'node:assert/strict';
import { moveCalendarDate } from './calendarNavigation.js';
import { toKey } from './dateUtils.js';

const localDate = (year, month, day) => new Date(year, month - 1, day, 12);

test('day and week arrows move selected date by one day or seven days', () => {
  const selected = localDate(2026, 10, 18);
  assert.equal(toKey(moveCalendarDate(selected, 'day', 1)), '2026-10-19');
  assert.equal(toKey(moveCalendarDate(selected, 'day', -1)), '2026-10-17');
  assert.equal(toKey(moveCalendarDate(selected, 'week', 1)), '2026-10-25');
  assert.equal(toKey(moveCalendarDate(selected, 'week', -1)), '2026-10-11');
});

test('month arrows keep the selected day when possible and clamp at month end/leap day', () => {
  assert.equal(toKey(moveCalendarDate(localDate(2026, 10, 18), 'month', 1)), '2026-11-18');
  assert.equal(toKey(moveCalendarDate(localDate(2026, 1, 31), 'month', 1)), '2026-02-28');
  assert.equal(toKey(moveCalendarDate(localDate(2024, 1, 31), 'month', 1)), '2024-02-29');
  assert.equal(toKey(moveCalendarDate(localDate(2026, 3, 31), 'month', -1)), '2026-02-28');
});
