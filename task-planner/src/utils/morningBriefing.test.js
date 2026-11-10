import test from 'node:test';
import assert from 'node:assert/strict';
import { dateFromLocalKey, dueMorningBriefingDate } from './morningBriefing.js';

const localTime = (key, hour, minute = 0) => {
  const [year, month, day] = key.split('-').map(Number);
  return new Date(year, month - 1, day, hour, minute);
};

test('morning briefing is due at the configured local time and targets the previous local date', () => {
  assert.equal(dueMorningBriefingDate(localTime('2026-10-26', 6, 59), '07:00'), null);
  assert.equal(dueMorningBriefingDate(localTime('2026-10-26', 7), '07:00'), '2026-10-25');
  assert.equal(dueMorningBriefingDate(localTime('2026-11-01', 7), '07:00'), '2026-10-31');
});

test('a missed briefing is eligible once and a shown report date is not repeated', () => {
  const afterConfiguredTime = localTime('2026-10-26', 16, 35);
  assert.equal(dueMorningBriefingDate(afterConfiguredTime, '07:00', '2026-10-24'), '2026-10-25');
  assert.equal(dueMorningBriefingDate(afterConfiguredTime, '07:00', '2026-10-25'), null);
  assert.equal(dueMorningBriefingDate(afterConfiguredTime, '17:00', '2026-10-24'), null);
  assert.equal(dueMorningBriefingDate(afterConfiguredTime, 'invalid', ''), null);
});

test('previous-report date keys parse as strict local calendar dates', () => {
  const date = dateFromLocalKey('2026-10-25');
  assert.equal(date.getFullYear(), 2026);
  assert.equal(date.getMonth(), 9);
  assert.equal(date.getDate(), 25);
  assert.equal(dateFromLocalKey('2026-02-30'), null);
});
