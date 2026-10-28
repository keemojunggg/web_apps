import test from 'node:test';
import assert from 'node:assert/strict';
import { calculatePeriodMetrics, localReportDateRange } from './reportMetrics.js';

const timestamp = (dateKey, hour = 0, minute = 0) => {
  const [year, month, day] = dateKey.split('-').map(Number);
  return new Date(year, month - 1, day, hour, minute).getTime();
};

const snapshot = (dueDate, fields = {}) => ({
  dueDate,
  dueHour: 9,
  dueMinute: 0,
  priority: 'scheduled',
  repeat: 'none',
  done: false,
  archived: false,
  cancelled: false,
  snoozedUntil: null,
  deleted: false,
  ...fields,
});

const event = (id, taskId, type, occurredAt, fields = {}) => ({
  id,
  taskId,
  occurrenceId: taskId,
  type,
  eventVersion: 1,
  occurredAt,
  sequence: 1,
  snapshot: snapshot('', {}),
  ...fields,
});

const baseline = (taskId, dueDate, fields = {}, sequence = 1, capturedAt = timestamp('2026-10-01')) => event(
  `baseline-${taskId}`,
  taskId,
  'baseline-captured',
  capturedAt,
  { capturedAt, sequence, snapshot: snapshot(dueDate, fields) },
);

const metrics = (events, fields = {}) => calculatePeriodMetrics({
  events,
  startDate: '2026-10-10',
  endDate: '2026-10-11',
  asOf: timestamp('2026-10-11'),
  baselineCapturedAt: timestamp('2026-10-01'),
  baselineSequence: Math.max(0, ...events.filter((item) => item.type === 'baseline-captured').map((item) => item.sequence)),
  historyComplete: true,
  ...fields,
});

test('completion and on-time rates use due-date and first-completion denominators', () => {
  const first = baseline('first', '2026-10-10', { dueHour: 10 });
  const second = baseline('second', '2026-10-10', { dueHour: 12 }, 2);
  const moved = event('move-first', 'first', 'rescheduled', timestamp('2026-10-10', 8), {
    sequence: 3,
    snapshot: snapshot('2026-10-10', { dueHour: 11 }),
    before: snapshot('2026-10-10', { dueHour: 10 }),
  });
  const onTime = event('complete-first', 'first', 'completed', timestamp('2026-10-10', 10, 30), {
    sequence: 4,
    completedAt: timestamp('2026-10-10', 10, 30),
    snapshot: snapshot('2026-10-10', { dueHour: 11, done: true }),
  });
  const late = event('complete-second', 'second', 'completed', timestamp('2026-10-10', 13), {
    sequence: 5,
    completedAt: timestamp('2026-10-10', 13),
    snapshot: snapshot('2026-10-10', { dueHour: 12, done: true }),
  });

  const result = metrics([first, second, moved, onTime, late]);
  assert.deepEqual(result.completionRate, { numerator: 2, denominator: 2, value: 1, status: 'complete' });
  assert.deepEqual(result.onTimeRate, { numerator: 1, denominator: 2, value: 0.5, status: 'complete' });
  assert.deepEqual(result.plannedVsCompleted.planned, { value: 2, status: 'complete' });
  assert.deepEqual(result.plannedVsCompleted.completed, { value: 2, status: 'complete' });
  assert.deepEqual(result.remainingTasks, { value: 0, status: 'complete' });
  assert.deepEqual(result.statusBreakdown, {
    completed: { value: 2, status: 'complete' },
    notCompletedNotOverdue: { value: 0, status: 'complete' },
    notCompletedOverdue: { value: 0, status: 'complete' },
    total: { value: 2, status: 'complete' },
  });
  assert.equal(result.occurrences.find((item) => item.occurrenceId === 'first').completedInPeriod, true);
});

test('tasks created during the period enter its planned cohort and created count', () => {
  const createdAt = timestamp('2026-10-10', 8);
  const created = event('created-new', 'new-task', 'created', createdAt, {
    sequence: 1,
    snapshot: snapshot('2026-10-10', { dueHour: 9 }),
  });
  const completedAt = timestamp('2026-10-10', 8, 30);
  const completed = event('completed-new', 'new-task', 'completed', completedAt, {
    sequence: 2,
    completedAt,
    snapshot: snapshot('2026-10-10', { dueHour: 9, done: true }),
  });
  const result = metrics([created, completed]);
  assert.deepEqual(result.completionRate, { numerator: 1, denominator: 1, value: 1, status: 'complete' });
  assert.deepEqual(result.tasksCreated, { value: 1, status: 'complete' });
});

test('reopening changes as-of completion rate but not first-completion on-time history', () => {
  const captured = baseline('reopened-task', '2026-10-10', { dueHour: 9 });
  const completedAt = timestamp('2026-10-10', 8, 30);
  const completed = event('first-completion', 'reopened-task', 'completed', completedAt, {
    sequence: 2,
    completedAt,
    snapshot: snapshot('2026-10-10', { dueHour: 9, done: true }),
  });
  const reopened = event('reopen', 'reopened-task', 'reopened', timestamp('2026-10-10', 10), {
    sequence: 3,
    snapshot: snapshot('2026-10-10', { dueHour: 9, done: false }),
  });
  const result = metrics([captured, completed, reopened], { asOf: timestamp('2026-10-10', 11) });
  assert.deepEqual(result.completionRate, { numerator: 0, denominator: 1, value: 0, status: 'complete' });
  assert.deepEqual(result.onTimeRate, { numerator: 1, denominator: 1, value: 1, status: 'complete' });
  assert.deepEqual(result.overdueTasks, { value: 1, status: 'complete' });
});

test('duplicate and equal-time out-of-order events use sequence and count an occurrence once', () => {
  const captured = baseline('ordered', '2026-10-10', { dueHour: 9 });
  const sameTime = timestamp('2026-10-10', 10);
  const completed = event('ordered-complete', 'ordered', 'completed', sameTime, {
    sequence: 2,
    completedAt: sameTime,
    snapshot: snapshot('2026-10-10', { dueHour: 9, done: true }),
  });
  const reopened = event('ordered-reopen', 'ordered', 'reopened', sameTime, {
    sequence: 3,
    snapshot: snapshot('2026-10-10', { dueHour: 9, done: false }),
  });
  const result = metrics([reopened, completed, captured, completed]);
  assert.deepEqual(result.completionRate, { numerator: 0, denominator: 1, value: 0, status: 'complete' });
  assert.deepEqual(result.completionTrend, { value: 1, status: 'complete' });
});

test('delete-before-due and cancel-before-due withdraw obligations; archive does not', () => {
  const deleted = baseline('deleted', '2026-10-10', { dueHour: 10 }, 1);
  const cancelled = baseline('cancelled', '2026-10-10', { dueHour: 11 }, 2);
  const archived = baseline('archived', '2026-10-10', { dueHour: 12 }, 3);
  const active = baseline('active', '2026-10-10', { dueHour: 13 }, 4);
  const deletion = event('delete', 'deleted', 'deleted', timestamp('2026-10-10', 8), {
    sequence: 5,
    snapshot: snapshot('2026-10-10', { dueHour: 10, deleted: true }),
  });
  const cancellation = event('cancel', 'cancelled', 'cancelled', timestamp('2026-10-10', 8), {
    sequence: 6,
    snapshot: snapshot('2026-10-10', { dueHour: 11, cancelled: true }),
  });
  const archive = event('archive', 'archived', 'archived', timestamp('2026-10-10', 8), {
    sequence: 7,
    snapshot: snapshot('2026-10-10', { dueHour: 12, archived: true }),
  });
  const result = metrics([deleted, cancelled, archived, active, deletion, cancellation, archive]);
  assert.deepEqual(result.completionRate, { numerator: 0, denominator: 2, value: 0, status: 'complete' });
  assert.deepEqual(result.overdueTasks, { value: 1, status: 'complete' });
});

test('deletion after the due time does not erase the planned obligation', () => {
  const captured = baseline('deleted-late', '2026-10-10', { dueHour: 9 });
  const deletion = event('delete-late', 'deleted-late', 'deleted', timestamp('2026-10-10', 10), {
    sequence: 2,
    snapshot: snapshot('2026-10-10', { dueHour: 9, deleted: true }),
  });
  const result = metrics([captured, deletion]);
  assert.deepEqual(result.completionRate, { numerator: 0, denominator: 1, value: 0, status: 'complete' });
});

test('rescheduling an open task across periods moves its planned cohort', () => {
  const captured = baseline('moved-period', '2026-10-10', { dueHour: 15 });
  const rescheduled = event('move-next-day', 'moved-period', 'rescheduled', timestamp('2026-10-10', 8), {
    sequence: 2,
    before: snapshot('2026-10-10', { dueHour: 15 }),
    snapshot: snapshot('2026-10-11', { dueHour: 9 }),
  });
  const previousDay = metrics([captured, rescheduled]);
  const nextDay = metrics([captured, rescheduled], {
    startDate: '2026-10-11',
    endDate: '2026-10-12',
    asOf: timestamp('2026-10-12'),
  });
  assert.deepEqual(previousDay.completionRate, { numerator: 0, denominator: 0, value: null, status: 'complete' });
  assert.deepEqual(nextDay.completionRate, { numerator: 0, denominator: 1, value: 0, status: 'complete' });
});

test('delete, archive, and cancellation restorations replay as distinct actions', () => {
  const deleted = baseline('undo-delete', '2026-10-10', { dueHour: 10 }, 1);
  const archived = baseline('restore-archive', '2026-10-10', { dueHour: 11 }, 2);
  const cancelled = baseline('restore-cancel', '2026-10-10', { dueHour: 12 }, 3);
  const events = [
    event('delete-before-undo', 'undo-delete', 'deleted', timestamp('2026-10-10', 7), {
      sequence: 4, snapshot: snapshot('2026-10-10', { dueHour: 10, deleted: true }),
    }),
    event('undo-delete', 'undo-delete', 'delete-undone', timestamp('2026-10-10', 8), {
      sequence: 5, snapshot: snapshot('2026-10-10', { dueHour: 10 }),
    }),
    event('archive-before-restore', 'restore-archive', 'archived', timestamp('2026-10-10', 8, 10), {
      sequence: 6, snapshot: snapshot('2026-10-10', { dueHour: 11, archived: true }),
    }),
    event('restore-archive-event', 'restore-archive', 'archive-restored', timestamp('2026-10-10', 8, 20), {
      sequence: 7, snapshot: snapshot('2026-10-10', { dueHour: 11 }),
    }),
    event('cancel-before-restore', 'restore-cancel', 'cancelled', timestamp('2026-10-10', 8, 30), {
      sequence: 8, snapshot: snapshot('2026-10-10', { dueHour: 12, cancelled: true }),
    }),
    event('restore-cancel-event', 'restore-cancel', 'cancel-restored', timestamp('2026-10-10', 8, 40), {
      sequence: 9, snapshot: snapshot('2026-10-10', { dueHour: 12 }),
    }),
  ];
  const result = metrics([deleted, archived, cancelled, ...events]);
  assert.deepEqual(result.completionRate, { numerator: 0, denominator: 3, value: 0, status: 'complete' });
});

test('recurring occurrences are counted by occurrence ID, not completion or successor events', () => {
  const root = baseline('series-root', '2026-10-10', { repeat: 'daily', dueHour: 9 });
  const nextId = 'series-root@2026-10-10';
  const completedAt = timestamp('2026-10-10', 8);
  const completed = event('root-complete', 'series-root', 'completed', completedAt, {
    sequence: 2,
    seriesId: 'series-root',
    completedAt,
    snapshot: snapshot('2026-10-10', { dueHour: 9, done: true, repeat: 'daily' }),
  });
  const next = event('next-created', nextId, 'occurrence-created', completedAt, {
    sequence: 3,
    seriesId: 'series-root',
    snapshot: snapshot('2026-10-11', { dueHour: 9, repeat: 'daily' }),
  });
  const result = metrics([root, completed, next], { endDate: '2026-10-12' });
  assert.deepEqual(result.completionRate, { numerator: 1, denominator: 2, value: 0.5, status: 'complete' });
  assert.deepEqual(result.completionTrend, { value: 1, status: 'complete' });
  assert.deepEqual(result.tasksCreated, { value: 1, status: 'complete' });
});

test('empty complete periods return zero counts and N/A rates; untracked periods are unavailable', () => {
  const capturedAt = timestamp('2026-10-01');
  const empty = metrics([], { baselineCapturedAt: capturedAt });
  assert.deepEqual(empty.completionRate, { numerator: 0, denominator: 0, value: null, status: 'complete' });
  assert.deepEqual(empty.onTimeRate, { numerator: 0, denominator: 0, value: null, status: 'complete' });
  assert.deepEqual(empty.overdueTasks, { value: 0, status: 'complete' });
  assert.deepEqual(empty.remainingTasks, { value: 0, status: 'complete' });
  assert.deepEqual(empty.statusBreakdown, {
    completed: { value: 0, status: 'complete' },
    notCompletedNotOverdue: { value: 0, status: 'complete' },
    notCompletedOverdue: { value: 0, status: 'complete' },
    total: { value: 0, status: 'complete' },
  });
  const unavailable = metrics([], { baselineCapturedAt: null });
  assert.equal(unavailable.coverage.status, 'unavailable');
  assert.equal(unavailable.completionRate.value, null);
  assert.equal(unavailable.overdueTasks.value, null);
});

test('periods overlapping baseline or an unverified history stream remain incomplete', () => {
  const partial = metrics([], { baselineCapturedAt: timestamp('2026-10-10', 12) });
  assert.equal(partial.coverage.status, 'partial');
  assert.equal(partial.completionRate.denominator, null);
  const unverified = metrics([], { historyComplete: false });
  assert.equal(unverified.coverage.status, 'incomplete');
  assert.equal(unverified.completionTrend.value, null);
});

test('legacy and invalid post-baseline events make metrics incomplete', () => {
  const unsupported = event('old-format', 'task', 'completed', timestamp('2026-10-10'), {
    eventVersion: undefined,
    sequence: 2,
  });
  const result = metrics([baseline('task', '2026-10-10'), unsupported]);
  assert.equal(result.coverage.status, 'incomplete');
  assert.equal(result.onTimeRate.value, null);
});

test('pre-baseline events are ignored unless their sequence proves a post-baseline clock rollback', () => {
  const baselineAt = timestamp('2026-10-01');
  const captured = baseline('observed', '2026-10-10', {}, 2, baselineAt);
  const earlier = event('earlier-history', 'observed', 'edited', baselineAt - 1, {
    sequence: 1,
    snapshot: snapshot('2026-10-10'),
  });
  const complete = metrics([earlier, captured], {
    baselineCapturedAt: baselineAt,
    baselineSequence: 2,
  });
  assert.equal(complete.coverage.status, 'complete');

  const clockRollback = event('post-baseline-clock-rollback', 'observed', 'edited', baselineAt - 1, {
    sequence: 3,
    snapshot: snapshot('2026-10-10'),
  });
  const incomplete = metrics([earlier, captured, clockRollback], {
    baselineCapturedAt: baselineAt,
    baselineSequence: 2,
  });
  assert.equal(incomplete.coverage.status, 'incomplete');
});

test('non-monotonic event timestamps or reused sequence numbers invalidate history', () => {
  const captured = baseline('clock-change', '2026-10-10', { dueHour: 9 });
  const first = event('first-action', 'clock-change', 'rescheduled', timestamp('2026-10-10', 10), {
    sequence: 2,
    snapshot: snapshot('2026-10-11', { dueHour: 9 }),
  });
  const clockMovedBack = event('second-action', 'clock-change', 'rescheduled', timestamp('2026-10-10', 9), {
    sequence: 3,
    snapshot: snapshot('2026-10-10', { dueHour: 9 }),
  });
  const result = metrics([captured, first, clockMovedBack]);
  assert.equal(result.coverage.status, 'incomplete');
  assert.equal(result.completionRate.value, null);
});

test('local calendar boundaries include local midnight and exclude the next day', () => {
  const start = new Date(2026, 9, 10, 12);
  assert.deepEqual(localReportDateRange(start, 'day'), { startDate: '2026-10-10', endDate: '2026-10-11' });
  assert.deepEqual(localReportDateRange(start, 'week'), { startDate: '2026-10-05', endDate: '2026-10-12' });
  assert.deepEqual(localReportDateRange(start, 'month'), { startDate: '2026-10-01', endDate: '2026-11-01' });
  assert.deepEqual(localReportDateRange(start, 'year'), { startDate: '2026-01-01', endDate: '2027-01-01' });
  const midnight = timestamp('2026-10-10');
  const nextMidnight = timestamp('2026-10-11');
  const before = baseline('boundary-before', '2026-10-10', { dueHour: 0 }, 1);
  const nextTask = baseline('next-day', '2026-10-11', { dueHour: 0 }, 2);
  const onBoundary = event('boundary-complete', 'boundary-before', 'completed', midnight, {
    sequence: 3,
    completedAt: midnight,
    snapshot: snapshot('2026-10-10', { dueHour: 0, done: true }),
  });
  const atExclusiveEnd = event('next-day-complete', 'next-day', 'completed', nextMidnight, {
    sequence: 4,
    completedAt: nextMidnight,
    snapshot: snapshot('2026-10-11', { dueHour: 0, done: true }),
  });
  const result = metrics([before, onBoundary, nextTask, atExclusiveEnd], { asOf: nextMidnight });
  assert.equal(result.completionTrend.value, 1);
  assert.equal(result.period.asOf, nextMidnight - 1);
  assert.equal(result.period.timezone, Intl.DateTimeFormat().resolvedOptions().timeZone);
});

test('calendar periods follow local daylight-saving boundaries rather than fixed 24-hour days', () => {
  const previousTimezone = process.env.TZ;
  try {
    process.env.TZ = 'America/New_York';
    const range = localReportDateRange(new Date(2026, 2, 8, 12), 'day');
    const start = timestamp(range.startDate);
    const end = timestamp(range.endDate);
    assert.deepEqual(range, { startDate: '2026-03-08', endDate: '2026-03-09' });
    assert.equal(end - start, 23 * 60 * 60 * 1000);
  } finally {
    if (previousTimezone === undefined) delete process.env.TZ;
    else process.env.TZ = previousTimezone;
  }
});

test('invalid date ranges are rejected', () => {
  assert.throws(() => metrics([], { startDate: '2026-02-30' }), RangeError);
  assert.throws(() => metrics([], { asOf: timestamp('2026-10-09') }), RangeError);
});
