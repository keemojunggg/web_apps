import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateDailyTaskProgress } from './dailyProgress.js';
import { completeTaskOccurrence, reopenTaskOccurrence } from './recurrence.js';

test('daily progress updates as tasks complete and reopen without affecting other dates', () => {
  const tasks = [
    { id: 'today-a', dateKey: '2026-10-26', done: false },
    { id: 'today-b', dateKey: '2026-10-26', done: false },
    { id: 'tomorrow', dateKey: '2026-10-27', done: false },
  ];

  assert.deepEqual(calculateDailyTaskProgress(tasks, '2026-10-26'), {
    total: 2, completed: 0, remaining: 2, rate: 0,
  });
  const completed = completeTaskOccurrence(tasks, 'today-a', new Date(2026, 9, 26, 10)).tasks;
  assert.deepEqual(calculateDailyTaskProgress(completed, '2026-10-26'), {
    total: 2, completed: 1, remaining: 1, rate: 0.5,
  });
  assert.deepEqual(calculateDailyTaskProgress(completed, '2026-10-27'), {
    total: 1, completed: 0, remaining: 1, rate: 0,
  });
  const reopened = reopenTaskOccurrence(completed, 'today-a', new Date(2026, 9, 26, 11)).tasks;
  assert.deepEqual(calculateDailyTaskProgress(reopened, '2026-10-26'), {
    total: 2, completed: 0, remaining: 2, rate: 0,
  });
});

test('empty days and withdrawn tasks have no percentage instead of 0%', () => {
  assert.deepEqual(calculateDailyTaskProgress([], '2026-10-26'), {
    total: 0, completed: 0, remaining: 0, rate: null,
  });
  assert.equal(calculateDailyTaskProgress([
    { id: 'archived', dateKey: '2026-10-26', archived: true },
    { id: 'cancelled', dateKey: '2026-10-26', cancelled: true },
  ], '2026-10-26').rate, null);
});
