import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildDailyReportData,
  buildMonthlyReportData,
  buildWeeklyReportData,
  buildYearlyReportData,
} from './reportData.js';

const timestamp = (key, hour = 0, minute = 0) => {
  const [year, month, day] = key.split('-').map(Number);
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

const baseline = (taskId, dueDate, sequence = 1, fields = {}) => ({
  id: `baseline-${taskId}`,
  taskId,
  occurrenceId: taskId,
  type: 'baseline-captured',
  eventVersion: 1,
  occurredAt: timestamp('2026-10-01'),
  capturedAt: timestamp('2026-10-01'),
  sequence,
  snapshot: snapshot(dueDate, fields),
});

const history = (events, fields = {}) => ({
  events,
  baselineCapturedAt: timestamp('2026-10-01'),
  baselineSequence: Math.max(0, ...events.filter((event) => event.type === 'baseline-captured').map((event) => event.sequence)),
  historyComplete: true,
  ...fields,
});

test('daily report uses the selected local day and excludes tasks created after it', () => {
  const captured = baseline('today', '2026-10-26');
  const completedAt = timestamp('2026-10-26', 8);
  const completed = {
    id: 'complete-today',
    taskId: 'today',
    occurrenceId: 'today',
    type: 'completed',
    eventVersion: 1,
    occurredAt: completedAt,
    completedAt,
    sequence: 2,
    snapshot: snapshot('2026-10-26', { done: true }),
  };
  const addedLater = {
    id: 'created-later',
    taskId: 'later',
    occurrenceId: 'later',
    type: 'created',
    eventVersion: 1,
    occurredAt: timestamp('2026-10-27', 9),
    sequence: 3,
    snapshot: snapshot('2026-10-27'),
  };
  const result = buildDailyReportData({
    date: new Date(2026, 9, 26, 13),
    now: timestamp('2026-10-26', 13),
    history: history([captured, completed, addedLater]),
  });
  assert.deepEqual(result.range, { startDate: '2026-10-26', endDate: '2026-10-27' });
  assert.equal(result.metrics.completionTrend.value, 1);
  assert.equal(result.metrics.tasksCreated.value, 0);
  assert.equal(result.metrics.remainingTasks.value, 0);
  assert.equal(result.metrics.occurrences.some((item) => item.occurrenceId === 'later'), false);
});

test('daily report rejects future dates and uses an exclusive next-midnight boundary', () => {
  const captured = baseline('boundary-task', '2026-10-26');
  const endAt = timestamp('2026-10-27');
  const boundaryCompletion = {
    id: 'next-day-completion',
    taskId: 'boundary-task',
    occurrenceId: 'boundary-task',
    type: 'completed',
    eventVersion: 1,
    occurredAt: endAt,
    completedAt: endAt,
    sequence: 2,
    snapshot: snapshot('2026-10-26', { done: true }),
  };
  const result = buildDailyReportData({
    date: new Date(2026, 9, 26),
    now: endAt,
    history: history([captured, boundaryCompletion]),
  });
  assert.equal(result.metrics.completionTrend.value, 0);
  assert.throws(() => buildDailyReportData({
    date: new Date(2026, 9, 27),
    now: endAt - 1,
    history: history([captured]),
  }), RangeError);
});

test('weekly report uses Monday-based local dates across a year boundary and compares only closed complete weeks', () => {
  const captured = baseline('week-task', '2026-12-28');
  const first = buildWeeklyReportData({
    date: new Date(2027, 0, 6),
    now: timestamp('2027-01-12'),
    history: history([captured]),
  });
  assert.deepEqual(first.range, { startDate: '2027-01-04', endDate: '2027-01-11' });
  assert.deepEqual(first.days.map((day) => day.startDate), [
    '2027-01-04', '2027-01-05', '2027-01-06', '2027-01-07', '2027-01-08', '2027-01-09', '2027-01-10',
  ]);
  assert.deepEqual(first.comparison?.period, {
    startDate: '2026-12-28',
    endDate: '2027-01-04',
    asOf: timestamp('2027-01-04') - 1,
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
  });

  const current = buildWeeklyReportData({
    date: new Date(2027, 0, 6),
    now: timestamp('2027-01-06', 12),
    history: history([captured]),
  });
  assert.equal(current.comparison, null);
  assert.match(current.comparisonReason, /ยังไม่สิ้นสุด/);
});

test('weekly report suppresses previous-week comparisons when either period lacks coverage', () => {
  const incomplete = history([], { historyComplete: false });
  const result = buildWeeklyReportData({
    date: new Date(2026, 9, 26),
    now: timestamp('2026-11-10'),
    history: incomplete,
  });
  assert.equal(result.comparison, null);
  assert.match(result.comparisonReason, /ข้อมูลย้อนหลัง/);
});

test('weekly daily rows mark dates after today as upcoming rather than zero productivity', () => {
  const result = buildWeeklyReportData({
    date: new Date(2026, 9, 26),
    now: timestamp('2026-10-27', 12),
    history: history([]),
  });
  assert.deepEqual(result.days.map((day) => day.future), [false, false, true, true, true, true, true]);
  assert.equal(result.days[2].metrics, null);
});

function monthHistory() {
  const capturedAt = timestamp('2022-01-01');
  const baselineAt = (taskId, dueDate, sequence, fields = {}) => ({
    id: `month-baseline-${taskId}`,
    taskId,
    occurrenceId: taskId,
    type: 'baseline-captured',
    eventVersion: 1,
    occurredAt: capturedAt,
    capturedAt,
    sequence,
    snapshot: snapshot(dueDate, fields),
  });
  const taskEvents = [
    baselineAt('oct-complete', '2024-10-10', 1),
    baselineAt('oct-open', '2024-10-11', 2),
    baselineAt('oct-recurring-a', '2024-10-12', 3, { repeat: 'daily' }),
    baselineAt('oct-recurring-b', '2024-10-13', 4, { repeat: 'daily' }),
    baselineAt('sep-task', '2024-09-10', 5),
    baselineAt('nov-task', '2024-11-10', 6),
    baselineAt('feb-task', '2024-02-29', 7),
    baselineAt('dec-task', '2024-12-31', 8),
    baselineAt('jan-next', '2025-01-01', 9),
    baselineAt('oct-archived', '2024-10-14', 10),
    baselineAt('oct-cancelled', '2024-10-15', 11),
    baselineAt('oct-deleted', '2024-10-16', 12),
  ];
  taskEvents.push({
    id: 'oct-cancel-before-due',
    taskId: 'oct-cancelled',
    occurrenceId: 'oct-cancelled',
    type: 'cancelled',
    eventVersion: 1,
    occurredAt: timestamp('2024-10-09', 8),
    sequence: 13,
    snapshot: snapshot('2024-10-15', { cancelled: true }),
  });
  taskEvents.push({
    id: 'oct-delete-before-due',
    taskId: 'oct-deleted',
    occurrenceId: 'oct-deleted',
    type: 'deleted',
    eventVersion: 1,
    occurredAt: timestamp('2024-10-09', 9),
    sequence: 14,
    snapshot: snapshot('2024-10-16', { deleted: true }),
  });
  taskEvents.push({
    id: 'oct-archive',
    taskId: 'oct-archived',
    occurrenceId: 'oct-archived',
    type: 'archived',
    eventVersion: 1,
    occurredAt: timestamp('2024-10-09', 10),
    sequence: 15,
    snapshot: snapshot('2024-10-14', { archived: true }),
  });
  const completeAt = timestamp('2024-10-10', 8);
  taskEvents.push({
    id: 'oct-completion',
    taskId: 'oct-complete',
    occurrenceId: 'oct-complete',
    type: 'completed',
    eventVersion: 1,
    occurredAt: completeAt,
    completedAt: completeAt,
    sequence: 16,
    snapshot: snapshot('2024-10-10', { done: true }),
  });
  taskEvents.push({
    id: 'oct-reopen',
    taskId: 'oct-complete',
    occurrenceId: 'oct-complete',
    type: 'reopened',
    eventVersion: 1,
    occurredAt: timestamp('2024-10-10', 10),
    sequence: 17,
    snapshot: snapshot('2024-10-10', { done: false }),
  });
  return {
    events: taskEvents,
    baselineCapturedAt: capturedAt,
    baselineSequence: 12,
    historyComplete: true,
  };
}

test('monthly report follows local month boundaries across year transitions and leap February', () => {
  const historyData = monthHistory();
  const february = buildMonthlyReportData({
    date: new Date(2024, 1, 5),
    now: timestamp('2025-01-15'),
    history: historyData,
  });
  assert.deepEqual(february.range, { startDate: '2024-02-01', endDate: '2024-03-01' });
  assert.equal(february.buckets.length, 29);
  assert.equal(february.buckets[28].startDate, '2024-02-29');
  assert.equal(february.periodClosed, true);

  const december = buildMonthlyReportData({
    date: new Date(2024, 11, 31),
    now: timestamp('2025-01-15'),
    history: historyData,
  });
  assert.deepEqual(december.range, { startDate: '2024-12-01', endDate: '2025-01-01' });
  assert.equal(december.buckets.length, 31);
  assert.equal(december.buckets.at(-1).startDate, '2024-12-31');
});

test('current month marks future days upcoming and withholds previous-month comparison until closed', () => {
  const result = buildMonthlyReportData({
    date: new Date(2024, 9, 20),
    now: timestamp('2024-10-20', 12),
    history: monthHistory(),
  });
  assert.equal(result.periodClosed, false);
  assert.equal(result.comparison, null);
  assert.match(result.comparisonReason, /ยังไม่สิ้นสุด/);
  assert.equal(result.buckets[19].future, false);
  assert.equal(result.buckets[20].future, true);
  assert.equal(result.buckets[20].metrics, null);
});

test('closed month reports reuse completion and on-time formulas and compare only complete adjacent months', () => {
  const result = buildMonthlyReportData({
    date: new Date(2024, 9, 1),
    now: timestamp('2025-01-15'),
    history: monthHistory(),
  });
  assert.equal(result.metrics.coverage.status, 'complete');
  assert.equal(result.metrics.completionRate.denominator, 5);
  assert.equal(result.metrics.completionRate.numerator, 0);
  assert.equal(result.metrics.onTimeRate.numerator, 1);
  assert.equal(result.metrics.statusBreakdown.notCompletedNotOverdue.value, 1);
  assert.equal(result.metrics.statusBreakdown.notCompletedOverdue.value, 4);
  assert.equal(result.metrics.statusBreakdown.total.value, 5);
  assert.equal(result.buckets[9].metrics.completionTrend.value, 1);
  assert.equal(result.buckets[9].metrics.completionRate.value, 0);
  assert.equal(result.comparison?.period.startDate, '2024-09-01');
  assert.equal(result.comparison?.plannedVsCompleted.planned.value, 1);

  const incomplete = buildMonthlyReportData({
    date: new Date(2024, 9, 1),
    now: timestamp('2025-01-15'),
    history: history(monthHistory().events, { historyComplete: false }),
  });
  assert.equal(incomplete.comparison, null);
  assert.match(incomplete.comparisonReason, /ไม่ครอบคลุมทั้งสองเดือน/);
});

test('yearly reports aggregate twelve local months and compare complete closed years', () => {
  const result = buildYearlyReportData({
    date: new Date(2024, 6, 15),
    now: timestamp('2025-02-01'),
    history: monthHistory(),
  });
  assert.deepEqual(result.range, { startDate: '2024-01-01', endDate: '2025-01-01' });
  assert.equal(result.buckets.length, 12);
  assert.equal(result.buckets[1].startDate, '2024-02-01');
  assert.equal(result.buckets[11].startDate, '2024-12-01');
  assert.equal(result.buckets[9].metrics.completionTrend.value, 1);
  assert.equal(result.buckets[9].metrics.completionRate.value, 0);
  assert.equal(result.comparison?.period.startDate, '2023-01-01');
  assert.equal(result.comparison?.period.endDate, '2024-01-01');

  const currentYear = buildYearlyReportData({
    date: new Date(2025, 5, 3),
    now: timestamp('2025-06-03', 12),
    history: monthHistory(),
  });
  assert.equal(currentYear.periodClosed, false);
  assert.equal(currentYear.comparison, null);
  assert.equal(currentYear.buckets[5].future, false);
  assert.equal(currentYear.buckets[6].future, true);
});

test('monthly and yearly reports withhold unavailable or incomplete bucket metrics', () => {
  const noHistory = { events: [], baselineCapturedAt: null, baselineSequence: null, historyComplete: false };
  const monthly = buildMonthlyReportData({ date: new Date(2024, 1, 1), now: timestamp('2024-03-01'), history: noHistory });
  const yearly = buildYearlyReportData({ date: new Date(2024, 0, 1), now: timestamp('2025-01-01'), history: noHistory });
  assert.equal(monthly.metrics.coverage.status, 'unavailable');
  assert.equal(monthly.metrics.completionRate.value, null);
  assert.equal(monthly.buckets[0].metrics.coverage.status, 'unavailable');
  assert.equal(yearly.metrics.coverage.status, 'unavailable');
  assert.equal(yearly.buckets[0].metrics.completionRate.value, null);

  const partial = buildMonthlyReportData({
    date: new Date(2024, 9, 1),
    now: timestamp('2025-01-01'),
    history: { ...monthHistory(), historyComplete: false },
  });
  assert.equal(partial.metrics.coverage.status, 'incomplete');
  assert.equal(partial.metrics.plannedVsCompleted.planned.value, null);
  assert.equal(partial.comparison, null);
});

test('monthly and yearly report builders reject future periods and use DST-safe local calendar ranges', () => {
  const historyData = monthHistory();
  assert.throws(() => buildMonthlyReportData({
    date: new Date(2025, 0, 1), now: timestamp('2024-12-31', 23), history: historyData,
  }), RangeError);
  assert.throws(() => buildYearlyReportData({
    date: new Date(2025, 0, 1), now: timestamp('2024-12-31', 23), history: historyData,
  }), RangeError);

  const start = new Date(2024, 2, 1);
  const end = new Date(2024, 3, 1);
  const result = buildMonthlyReportData({
    date: start,
    now: end.getTime(),
    history: historyData,
  });
  assert.equal(result.range.startDate, '2024-03-01');
  assert.equal(result.range.endDate, '2024-04-01');
  assert.equal(result.buckets.length, 31);
  assert.equal(result.buckets[9].endDate, '2024-03-11');
});
