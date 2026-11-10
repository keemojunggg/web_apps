import test, { beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { IDBFactory } from 'fake-indexeddb';
import {
  loadNotificationHistory,
  loadReminderState,
  loadReminderStates,
  saveTasks,
} from '../../utils/taskStorage.js';
import { createReminderFromTask, snoozeReminder } from './notificationEngine.js';
import {
  collectDueReminders,
  DEFAULT_CHECK_INTERVAL_MS,
  DEFAULT_MAX_DELIVERIES_PER_CHECK,
  DEFAULT_MISSED_REMINDER_GRACE_MS,
  runNotificationCheck,
  startNotificationScheduler,
} from './notificationScheduler.js';

function installLocalStorage() {
  globalThis.localStorage = {
    getItem: () => null,
    setItem: () => {},
    removeItem: () => {},
  };
}

function makeTask(overrides = {}) {
  return {
    id: 'task-1',
    title: 'Due task',
    dateKey: '2027-01-15',
    hour: 10,
    minute: 0,
    notify: true,
    repeat: 'none',
    done: false,
    archived: false,
    cancelled: false,
    attachments: [],
    ...overrides,
  };
}

function scheduledAt(task) {
  const [year, month, day] = task.dateKey.split('-').map(Number);
  return new Date(year, month - 1, day, task.hour, task.minute).getTime();
}

async function seedTask(task) {
  assert.equal(await saveTasks([task]), true);
}

async function createDueReminder(task, { leadMinutes = 15, ageMs = 0 } = {}) {
  const scheduled = scheduledAt(task);
  const dueAt = scheduled - leadMinutes * 60_000;
  const now = dueAt + ageMs;
  const created = await createReminderFromTask(task, leadMinutes, { now: now - 1 });
  return { reminder: created.reminder, now };
}

function makeEventTarget(initialState = 'visible') {
  const listeners = new Map();
  return {
    visibilityState: initialState,
    addEventListener(type, listener) {
      listeners.set(type, listener);
    },
    removeEventListener(type, listener) {
      if (listeners.get(type) === listener) listeners.delete(type);
    },
    dispatch(type) {
      listeners.get(type)?.();
    },
    listeners,
  };
}

beforeEach(() => {
  globalThis.indexedDB = new IDBFactory();
  installLocalStorage();
});

test('collects only due pending and snoozed reminders for currently eligible tasks', () => {
  const task = makeTask();
  const now = 100;
  const records = [
    { reminderKey: 'due-pending', occurrenceId: task.id, status: 'pending', nextReminderAt: 100, updatedAt: 1 },
    { reminderKey: 'due-snoozed', occurrenceId: task.id, status: 'snoozed', nextReminderAt: 90, updatedAt: 2 },
    { reminderKey: 'future', occurrenceId: task.id, status: 'pending', nextReminderAt: 101, updatedAt: 1 },
    { reminderKey: 'sent', occurrenceId: task.id, status: 'sent', nextReminderAt: 1, updatedAt: 1 },
    { reminderKey: 'missing', occurrenceId: 'deleted', status: 'pending', nextReminderAt: 1, updatedAt: 1 },
  ];
  assert.deepEqual(collectDueReminders(records, [task], now).map(({ reminderKey }) => reminderKey), [
    'due-snoozed', 'due-pending',
  ]);
});

test('returns a due Reminder without changing its state or writing a sent History Event', async () => {
  const task = makeTask();
  await seedTask(task);
  const { reminder, now } = await createDueReminder(task);
  const result = await runNotificationCheck({ now, leadMinutes: 15 });
  assert.equal(result.errors.length, 0);
  assert.deepEqual(result.reminders.map(({ reminderKey, status, title }) => ({ reminderKey, status, title })), [{
    reminderKey: reminder.reminderKey,
    status: 'pending',
    title: task.title,
  }]);
  const repeated = await runNotificationCheck({ now: now + 1, leadMinutes: 15 });
  assert.deepEqual(repeated.reminders, []);
  assert.equal((await loadReminderState(reminder.reminderKey)).status, 'pending');
  assert.equal((await loadNotificationHistory({ reminderKey: reminder.reminderKey }))
    .some(({ eventType }) => eventType === 'sent'), false);
  const retry = await runNotificationCheck({ now: now + DEFAULT_CHECK_INTERVAL_MS, leadMinutes: 15 });
  assert.equal(retry.reminders.length, 1);
  assert.equal((await loadReminderState(reminder.reminderKey)).status, 'pending');
});

test('returns due Snoozed Reminders but leaves Future Reminders pending', async () => {
  const task = makeTask();
  await seedTask(task);
  const { reminder, now } = await createDueReminder(task);
  await snoozeReminder(reminder.reminderKey, now + 30_000, { now: now - 1 });
  const beforeDue = await runNotificationCheck({ now: now + 29_999, leadMinutes: 15 });
  assert.deepEqual(beforeDue.reminders, []);
  assert.equal((await loadReminderState(reminder.reminderKey)).status, 'snoozed');

  const atDue = await runNotificationCheck({ now: now + 30_000, leadMinutes: 15 });
  assert.equal(atDue.reminders.length, 1);
  assert.equal(atDue.reminders[0].status, 'snoozed');
  assert.equal((await loadReminderState(reminder.reminderKey)).status, 'snoozed');
  assert.equal((await loadNotificationHistory({ reminderKey: reminder.reminderKey }))
    .some(({ eventType }) => eventType === 'sent'), false);
});

test('does not deliver completed, archived, cancelled, notification-disabled, or deleted Tasks', async () => {
  const cases = [
    { done: true },
    { archived: true },
    { cancelled: true },
    { notify: false },
  ];
  for (const [index, changes] of cases.entries()) {
    globalThis.indexedDB = new IDBFactory();
    const task = makeTask({ id: `inactive-${index}` });
    await seedTask(task);
    const { reminder, now } = await createDueReminder(task);
    assert.ok(reminder);
    await saveTasks([makeTask({ ...changes, id: task.id })]);
    const result = await runNotificationCheck({ now, leadMinutes: 15 });
    assert.deepEqual(result.reminders, []);
    assert.equal((await loadReminderState(reminder.reminderKey)).status, 'cancelled');
  }

  globalThis.indexedDB = new IDBFactory();
  const task = makeTask();
  await seedTask(task);
  const { reminder, now } = await createDueReminder(task);
  assert.equal(await saveTasks([]), true);
  const deletedResult = await runNotificationCheck({ now, leadMinutes: 15 });
  assert.deepEqual(deletedResult.reminders, []);
  assert.equal((await loadReminderState(reminder.reminderKey)).status, 'cancelled');
});

test('cancels overlapping stale Reschedule Reminders and returns only the current schedule', async () => {
  const task = makeTask();
  await seedTask(task);
  const scheduled = scheduledAt(task);
  const old = await createReminderFromTask(task, 30, { now: scheduled - 30 * 60_000 });
  const current = await createReminderFromTask(task, 5, { now: scheduled - 5 * 60_000 });
  const now = scheduled + 1_000;

  const result = await runNotificationCheck({ now, leadMinutes: 5 });
  assert.equal(result.reminders.length, 1);
  assert.equal(result.reminders[0].reminderKey, current.reminder.reminderKey);
  assert.equal((await loadReminderState(old.reminder.reminderKey)).status, 'cancelled');
  assert.equal((await loadReminderState(current.reminder.reminderKey)).status, 'pending');
  assert.equal((await loadNotificationHistory({ reminderKey: current.reminder.reminderKey }))
    .some(({ eventType }) => eventType === 'sent'), false);
  assert.equal((await runNotificationCheck({ now: now + 1, leadMinutes: 5 })).reminders.length, 0);
});

test('expires missed reminders after the grace window and limits delivery batches', async () => {
  const task = makeTask();
  await seedTask(task);
  const expired = await createDueReminder(task, { ageMs: DEFAULT_MISSED_REMINDER_GRACE_MS + 1 });
  const expiredResult = await runNotificationCheck({ now: expired.now, leadMinutes: 15 });
  assert.deepEqual(expiredResult.reminders, []);
  assert.equal((await loadReminderState(expired.reminder.reminderKey)).status, 'cancelled');
  assert.ok((await loadNotificationHistory({ reminderKey: expired.reminder.reminderKey }))
    .some((event) => event.eventType === 'cancelled' && event.reason === 'missed-reminder-expired'));

  globalThis.indexedDB = new IDBFactory();
  const manyTasks = Array.from({ length: DEFAULT_MAX_DELIVERIES_PER_CHECK + 2 }, (_, index) => makeTask({
    id: `backlog-${index}`,
    title: `Backlog ${index}`,
  }));
  assert.equal(await saveTasks(manyTasks), true);
  const scheduled = scheduledAt(manyTasks[0]);
  for (const taskItem of manyTasks) {
    await createReminderFromTask(taskItem, 15, { now: scheduled - 15 * 60_000 });
  }
  const batch = await runNotificationCheck({ now: scheduled - 15 * 60_000, leadMinutes: 15 });
  assert.equal(batch.reminders.length, DEFAULT_MAX_DELIVERIES_PER_CHECK);
  assert.equal((await loadReminderStates({ status: 'pending' })).length, DEFAULT_MAX_DELIVERIES_PER_CHECK + 2);
  const nextBatch = await runNotificationCheck({ now: scheduled - 15 * 60_000 + 1, leadMinutes: 15 });
  assert.equal(nextBatch.reminders.length, 2);
  assert.equal((await loadReminderStates({ status: 'pending' })).length, DEFAULT_MAX_DELIVERIES_PER_CHECK + 2);
});

test('prevents concurrent scheduler runs from returning the same due Reminder twice', async () => {
  const task = makeTask();
  await seedTask(task);
  const { now } = await createDueReminder(task);
  const [first, second] = await Promise.all([
    runNotificationCheck({ now, leadMinutes: 15 }),
    runNotificationCheck({ now, leadMinutes: 15 }),
  ]);
  assert.equal(first.reminders.length + second.reminders.length, 1);
  assert.equal(first.skipped || second.skipped, true);
});

test('reports storage errors and allows a later check to recover', async () => {
  const originalIndexedDb = globalThis.indexedDB;
  globalThis.indexedDB = {
    open() {
      throw new Error('storage unavailable');
    },
  };
  const failed = await runNotificationCheck({ now: 1_800_000_000_000 });
  assert.equal(failed.reminders.length, 0);
  assert.match(failed.errors[0].message, /storage unavailable/);

  globalThis.indexedDB = originalIndexedDb;
  const recovered = await runNotificationCheck({ now: 1_800_000_000_000 });
  assert.deepEqual(recovered.errors, []);
});

test('uses local timezone dates when deriving due instants across month and year boundaries', async () => {
  const task = makeTask({ dateKey: '2027-01-01', hour: 0, minute: 10 });
  await seedTask(task);
  const { reminder } = await createDueReminder(task, { leadMinutes: 30 });
  const localDue = scheduledAt(task) - 30 * 60_000;
  const date = new Date(localDue);
  assert.equal(date.getFullYear(), 2026);
  assert.equal(date.getMonth(), 11);
  assert.equal(date.getDate(), 31);
  assert.equal(reminder.nextReminderAt, localDue);
});

test('starts with an immediate check, checks on focus and visible tab return, and keeps timer plumbing separate', async () => {
  const windowTarget = makeEventTarget();
  const documentTarget = makeEventTarget('hidden');
  let intervalCallback;
  let interval;
  let clearCount = 0;
  const stop = startNotificationScheduler({
    intervalMs: DEFAULT_CHECK_INTERVAL_MS,
    windowTarget,
    documentTarget,
    setIntervalFn(callback, milliseconds) {
      intervalCallback = callback;
      interval = milliseconds;
      return 7;
    },
    clearIntervalFn(handle) {
      assert.equal(handle, 7);
      clearCount += 1;
    },
  });
  assert.equal(interval, DEFAULT_CHECK_INTERVAL_MS);
  assert.equal(windowTarget.listeners.has('focus'), true);
  assert.equal(documentTarget.listeners.has('visibilitychange'), true);

  await new Promise((resolve) => setTimeout(resolve, 0));
  windowTarget.dispatch('focus');
  documentTarget.dispatch('visibilitychange');
  documentTarget.visibilityState = 'visible';
  documentTarget.dispatch('visibilitychange');
  intervalCallback();
  await new Promise((resolve) => setTimeout(resolve, 0));

  stop();
  assert.equal(clearCount, 1);
  assert.equal(windowTarget.listeners.size, 0);
  assert.equal(documentTarget.listeners.size, 0);
  assert.throws(() => startNotificationScheduler({ intervalMs: 19_999 }), /20,000 และ 30,000/);
});
