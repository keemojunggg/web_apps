import test from 'node:test';
import assert from 'node:assert/strict';
import { isTaskOverdue, selectAndSortTasks, taskDueAt } from './taskManagement.js';

const localTime = (dateKey, hour, minute, second = 0) => {
  const [year, month, day] = dateKey.split('-').map(Number);
  return new Date(year, month - 1, day, hour, minute, second).getTime();
};

const task = (id, fields = {}) => ({
  id,
  title: id,
  description: '',
  dateKey: '2026-10-18',
  hour: 12,
  minute: 0,
  priority: 'scheduled',
  done: false,
  createdAt: 1,
  ...fields,
});

test('sorts by scheduled date and time and puts unscheduled tasks last', () => {
  const tasks = [
    task('unscheduled', { dateKey: '', hour: 8 }),
    task('later', { dateKey: '2026-10-19', hour: 9 }),
    task('earlier', { dateKey: '2026-10-18', hour: 16 }),
    task('first', { dateKey: '2026-10-18', hour: 8 }),
  ];
  assert.deepEqual(selectAndSortTasks(tasks).map(({ id }) => id), ['first', 'earlier', 'later', 'unscheduled']);
});

test('sorts priorities in Urgent, Medium, Low, Someday order', () => {
  const tasks = [
    task('someday', { priority: 'slow' }),
    task('low', { priority: 'relaxed' }),
    task('medium', { priority: 'scheduled' }),
    task('urgent', { priority: 'urgent' }),
  ];
  assert.deepEqual(selectAndSortTasks(tasks, { sort: 'priority' }).map(({ id }) => id), ['urgent', 'medium', 'low', 'someday']);
});

test('focus sort prioritizes user pin, overdue, imminent deadline, then priority as a tie-breaker', () => {
  const now = localTime('2026-10-18', 12, 0);
  const tasks = [
    task('urgent-later', { dateKey: '2026-10-18', hour: 18, priority: 'urgent' }),
    task('due-now-low', { dateKey: '2026-10-18', hour: 13, priority: 'relaxed' }),
    task('due-now-medium', { dateKey: '2026-10-18', hour: 13, priority: 'scheduled' }),
    task('old-overdue', { dateKey: '2026-10-17', hour: 10, priority: 'slow' }),
    task('pinned', { dateKey: '2026-11-18', pinned: true, priority: 'slow' }),
  ];
  assert.deepEqual(selectAndSortTasks(tasks, { sort: 'focus', now }).map(({ id }) => id), [
    'pinned', 'old-overdue', 'due-now-medium', 'due-now-low', 'urgent-later',
  ]);
});

test('sorts newest creation time first and handles missing creation values safely', () => {
  const tasks = [task('missing', { createdAt: undefined }), task('old', { createdAt: 5 }), task('new', { createdAt: 10 })];
  assert.deepEqual(selectAndSortTasks(tasks, { sort: 'created' }).map(({ id }) => id), ['new', 'old', 'missing']);
});

test('searches titles and descriptions case-insensitively and trims the query', () => {
  const tasks = [task('title-match', { title: 'Project ALPHA' }), task('description-match', { description: 'Review the Quarterly REPORT' }), task('no-match')];
  assert.deepEqual(selectAndSortTasks(tasks, { query: '  alpha ' }).map(({ id }) => id), ['title-match']);
  assert.deepEqual(selectAndSortTasks(tasks, { query: 'QUARTERLY' }).map(({ id }) => id), ['description-match']);
  assert.equal(selectAndSortTasks(tasks, { query: 'missing keyword' }).length, 0);
  assert.equal(selectAndSortTasks(tasks, { query: '  ' }).length, 3);
});

test('combines query, status, and date filters while overdue filter searches all dates', () => {
  const tasks = [
    task('selected-active', { title: 'Plan alpha' }),
    task('selected-done', { title: 'Plan alpha complete', done: true }),
    task('other-date-active', { title: 'Plan alpha', dateKey: '2026-10-19' }),
    task('other-date-overdue', { title: 'Plan alpha', dateKey: '2026-10-17' }),
  ];
  const dateKey = '2026-10-18';
  const now = localTime(dateKey, 12, 0);
  assert.deepEqual(selectAndSortTasks(tasks, { query: 'ALPHA', filter: 'active', dateKey, now }).map(({ id }) => id), ['selected-active']);
  assert.deepEqual(selectAndSortTasks(tasks, { filter: 'completed', dateKey, now }).map(({ id }) => id), ['selected-done']);
  assert.deepEqual(selectAndSortTasks(tasks, { query: 'alpha', filter: 'overdue', dateKey, now }).map(({ id }) => id), ['other-date-overdue']);
});

test('active includes overdue unfinished tasks; completed tasks are never overdue', () => {
  const now = localTime('2026-10-18', 12, 1);
  const overdue = task('overdue', { hour: 12, minute: 0 });
  const completed = task('completed', { hour: 11, minute: 0, done: true });
  assert.equal(isTaskOverdue(overdue, now), true);
  assert.equal(isTaskOverdue(completed, now), false);
  assert.deepEqual(selectAndSortTasks([overdue, completed], { filter: 'active', now }).map(({ id }) => id), ['overdue']);
});

test('snoozed overdue tasks are suppressed until the snooze time expires', () => {
  const now = localTime('2026-10-18', 12, 0);
  const snoozed = task('snoozed', { dateKey: '2026-10-17', snoozedUntil: now + 60_000 });
  assert.equal(isTaskOverdue(snoozed, now), false);
  assert.equal(isTaskOverdue(snoozed, now + 60_001), true);
});

test('overdue uses local date/time boundaries consistently', () => {
  const dueTask = task('due-now', { hour: 12, minute: 30 });
  assert.equal(isTaskOverdue(dueTask, localTime('2026-10-18', 12, 29, 59)), false);
  assert.equal(isTaskOverdue(dueTask, localTime('2026-10-18', 12, 30)), false);
  assert.equal(isTaskOverdue(dueTask, localTime('2026-10-18', 12, 30, 1)), true);
  assert.equal(isTaskOverdue(task('earlier-day', { dateKey: '2026-10-17', hour: 23, minute: 59 }), localTime('2026-10-18', 0, 0)), true);
  assert.equal(isTaskOverdue(task('later-day', { dateKey: '2026-10-19', hour: 0, minute: 0 }), localTime('2026-10-18', 23, 59)), false);
});

test('missing or malformed optional fields do not throw or become overdue', () => {
  const sparse = { id: 'sparse', title: 'Sparse task' };
  const malformed = task('bad-date', { dateKey: '2026-02-30', hour: 99, minute: -3 });
  assert.equal(taskDueAt(sparse), null);
  assert.equal(isTaskOverdue(sparse, Date.now()), false);
  assert.equal(taskDueAt(malformed), null);
  assert.equal(isTaskOverdue(malformed, Date.now()), false);
  assert.deepEqual(selectAndSortTasks([sparse, malformed]).map(({ id }) => id), ['bad-date', 'sparse']);
});

test('archived and cancelled filters compose with search and are excluded from ordinary active work', () => {
  const tasks = [
    task('active-match', { title: 'Keep this active' }),
    task('archived-match', { title: 'Archived alpha', archived: true }),
    task('cancelled-match', { title: 'Cancelled beta', cancelled: true }),
  ];
  assert.deepEqual(selectAndSortTasks(tasks, { filter: 'all' }).map(({ id }) => id), ['active-match']);
  assert.deepEqual(selectAndSortTasks(tasks, { filter: 'archived', query: 'ALPHA' }).map(({ id }) => id), ['archived-match']);
  assert.deepEqual(selectAndSortTasks(tasks, { filter: 'archived', query: 'missing' }), []);
  assert.deepEqual(selectAndSortTasks(tasks, { filter: 'cancelled', query: 'BETA' }).map(({ id }) => id), ['cancelled-match']);
});
