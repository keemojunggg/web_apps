import test from 'node:test';
import assert from 'node:assert/strict';
import { completeTaskOccurrence, nextOccurrenceDate, reopenTaskOccurrence } from './recurrence.js';

const localDate = (dateKey, hour = 12, minute = 0) => {
  const [year, month, day] = dateKey.split('-').map(Number);
  return new Date(year, month - 1, day, hour, minute);
};

const recurringTask = (fields = {}) => ({
  id: 'series-root', title: 'Routine', dateKey: '2026-10-18', hour: 9, minute: 30,
  repeat: 'daily', priority: 'urgent', notify: true, done: false, createdAt: 10,
  description: 'Keep this description', attachments: [{ id: 'attachment-ref', name: 'note.txt' }],
  ...fields,
});

test('daily and weekly recurrence retain cadence and skip missed dates after late completion', () => {
  assert.equal(nextOccurrenceDate('2026-10-18', 'daily', '2026-10-18'), '2026-10-19');
  assert.equal(nextOccurrenceDate('2026-10-18', 'daily', '2026-10-22'), '2026-10-23');
  assert.equal(nextOccurrenceDate('2026-10-18', 'weekly', '2026-10-18'), '2026-10-25');
  assert.equal(nextOccurrenceDate('2026-10-18', 'weekly', '2026-11-02'), '2026-11-08');
  assert.equal(nextOccurrenceDate('invalid', 'daily', '2026-10-18'), '');
});

test('monthly recurrence keeps original anchor day through short months and leap day', () => {
  assert.equal(nextOccurrenceDate('2026-01-31', 'monthly', '2026-01-31'), '2026-02-28');
  assert.equal(nextOccurrenceDate('2026-01-31', 'monthly', '2026-02-28'), '2026-03-31');
  assert.equal(nextOccurrenceDate('2024-01-31', 'monthly', '2024-02-29'), '2024-03-31');
  assert.equal(nextOccurrenceDate('2024-02-29', 'monthly', '2024-02-29'), '2024-03-29');
});

test('late completion creates the first cadence date after the local completion date and preserves unrelated data', () => {
  const original = recurringTask({ dateKey: '2026-10-10' });
  const result = completeTaskOccurrence([original], original.id, localDate('2026-10-13', 20));
  assert.equal(result.changed, true);
  assert.equal(result.occurrenceCreated, true);
  assert.equal(result.tasks.length, 2);
  assert.equal(result.tasks[0].done, true);
  assert.equal(result.tasks[0].seriesId, original.id);
  assert.equal(result.tasks[0].recurrenceAnchorDate, '2026-10-10');
  const next = result.tasks[1];
  assert.equal(next.id, 'series-root@2026-10-14');
  assert.equal(next.dateKey, '2026-10-14');
  assert.equal(next.done, false);
  assert.equal(next.description, original.description);
  assert.deepEqual(next.attachments, original.attachments);
  assert.equal(next.notify, true);
  assert.equal(result.event.type, 'completed');
  assert.equal(result.event.nextOccurrenceDate, '2026-10-14');
});

test('completion repeated while already complete is a no-op and never duplicates an occurrence', () => {
  const original = recurringTask();
  const first = completeTaskOccurrence([original], original.id, localDate('2026-10-18'));
  assert.equal(first.occurrenceCreated, true);
  const repeated = completeTaskOccurrence(first.tasks, original.id, localDate('2026-10-18', 13));
  assert.equal(repeated.changed, false);
  assert.equal(repeated.event, null);
  assert.equal(repeated.tasks.length, 2);
});

test('reopening does not delete the successor and completing again reuses its stable ID', () => {
  const original = recurringTask();
  const first = completeTaskOccurrence([original], original.id, localDate('2026-10-18'));
  const successorId = first.tasks[1].id;
  const reopened = reopenTaskOccurrence(first.tasks, original.id, localDate('2026-10-19').getTime());
  assert.equal(reopened.changed, true);
  assert.equal(reopened.tasks.length, 2);
  assert.equal(reopened.tasks.find((task) => task.id === successorId).done, false);
  const completedAgain = completeTaskOccurrence(reopened.tasks, original.id, localDate('2026-10-18', 18));
  assert.equal(completedAgain.changed, true);
  assert.equal(completedAgain.occurrenceCreated, false);
  assert.equal(completedAgain.tasks.length, 2);
  assert.equal(completedAgain.tasks[1].id, successorId);
  assert.equal(reopenTaskOccurrence(completedAgain.tasks, original.id).changed, true);
});

test('late completion never creates a successor on or before completion day, even for an existing series', () => {
  const current = recurringTask({ dateKey: '2026-10-18', repeat: 'weekly', seriesId: 'series-stable', recurrenceAnchorDate: '2026-10-04' });
  const result = completeTaskOccurrence([current], current.id, localDate('2026-10-26'));
  assert.equal(result.occurrenceCreated, true);
  assert.equal(result.tasks[1].id, 'series-stable@2026-11-01');
  assert.ok(result.tasks[1].dateKey > '2026-10-26');
});
