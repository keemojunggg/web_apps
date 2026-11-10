import test, { beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { IDBFactory } from 'fake-indexeddb';
import {
  appendNotificationEvent,
  deleteReminderState,
  loadNotificationHistory,
  loadReminderState,
  loadReminderStates,
} from '../../utils/taskStorage.js';
import {
  cancelReminder,
  cancelRemindersForTask,
  createReminderFromTask,
  markReminderFailed,
  markReminderSent,
  reconcileReminders,
  rescheduleReminder,
  snoozeReminder,
} from './notificationEngine.js';

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
    title: 'Reminder task',
    dateKey: '2027-01-01',
    hour: 0,
    minute: 10,
    notify: true,
    repeat: 'none',
    done: false,
    archived: false,
    cancelled: false,
    ...overrides,
  };
}

function localTimestamp(task) {
  const [year, month, day] = task.dateKey.split('-').map(Number);
  return new Date(year, month - 1, day, task.hour, task.minute).getTime();
}

beforeEach(() => {
  globalThis.indexedDB = new IDBFactory();
  installLocalStorage();
});

test('creates a local-time Reminder with lead time and a stable occurrence-specific key', async () => {
  const task = makeTask();
  const now = 1_800_000_000_000;
  const first = await createReminderFromTask(task, 30, { now });
  const second = await createReminderFromTask(task, 30, { now: now + 1 });
  assert.equal(first.created, true);
  assert.equal(second.created, false);
  assert.equal(second.duplicate, true);
  assert.equal(first.reminder.scheduledAt, localTimestamp(task));
  assert.equal(first.reminder.nextReminderAt, localTimestamp(task) - 30 * 60_000);
  assert.equal(await loadReminderStates().then((items) => items.length), 1);
  const history = await loadNotificationHistory();
  assert.equal(history.length, 1);
  assert.equal(history[0].eventType, 'scheduled');
});

test('snoozes repeatedly without changing the scheduled task time', async () => {
  const task = makeTask();
  const now = 1_800_000_000_000;
  const { reminder } = await createReminderFromTask(task, 15, { now });
  const firstSnoozeAt = now + 30 * 60_000;
  const secondSnoozeAt = now + 45 * 60_000;
  await snoozeReminder(reminder.reminderKey, firstSnoozeAt, { now: now + 1 });
  const snoozedAgain = await snoozeReminder(reminder.reminderKey, secondSnoozeAt, { now: now + 2 });
  assert.equal(snoozedAgain.reminder.status, 'snoozed');
  assert.equal(snoozedAgain.reminder.scheduledAt, localTimestamp(task));
  assert.equal(snoozedAgain.reminder.nextReminderAt, secondSnoozeAt);
  assert.deepEqual((await loadNotificationHistory({ reminderKey: reminder.reminderKey }))
    .map((event) => event.eventType).sort(), ['scheduled', 'snoozed', 'snoozed']);
});

test('reschedules by cancelling the old Reminder and creating a distinct one with history', async () => {
  const original = makeTask();
  const updated = makeTask({ dateKey: '2027-02-01', hour: 8, minute: 25 });
  const now = 1_800_000_000_000;
  const { reminder: oldReminder } = await createReminderFromTask(original, 10, { now });
  const result = await rescheduleReminder(original, updated, 10, { now: now + 1 });
  assert.equal(result.oldReminder.status, 'cancelled');
  assert.equal(result.reminder.scheduledAt, localTimestamp(updated));
  assert.notEqual(result.reminder.reminderKey, oldReminder.reminderKey);
  assert.deepEqual((await loadNotificationHistory()).map(({ eventType }) => eventType).sort(), [
    'rescheduled', 'scheduled', 'scheduled',
  ]);
  assert.equal((await loadReminderState(oldReminder.reminderKey)).status, 'cancelled');
});

test('cancels reminders for completed, archived, deleted, or notification-disabled tasks', async () => {
  const baseTime = 1_800_000_000_000;
  const tasks = [
    makeTask({ id: 'completed', done: false }),
    makeTask({ id: 'archived', archived: false }),
    makeTask({ id: 'deleted' }),
    makeTask({ id: 'disabled', notify: true }),
  ];
  const created = [];
  for (const [index, task] of tasks.entries()) {
    created.push((await createReminderFromTask(task, 15, { now: baseTime + index })).reminder);
  }
  const disabledTasks = [
    makeTask({ id: 'completed', done: true }),
    makeTask({ id: 'archived', archived: true }),
    makeTask({ id: 'disabled', notify: false }),
  ];
  for (const task of disabledTasks) {
    await reconcileReminders([task], 15, { now: baseTime + 10 });
  }
  await reconcileReminders([], 15, { now: baseTime + 11 });
  for (const reminder of created) {
    assert.equal((await loadReminderState(reminder.reminderKey)).status, 'cancelled');
  }
  assert.equal((await loadNotificationHistory()).filter((event) => event.eventType === 'reconciled').length, 4);
});

test('cancelRemindersForTask cancels all active occurrences and cancellation is idempotent', async () => {
  const now = 1_800_000_000_000;
  const firstTask = makeTask({ id: 'series@2027-01-01' });
  const secondTask = makeTask({ id: 'series@2027-01-02', dateKey: '2027-01-02' });
  const first = (await createReminderFromTask(firstTask, 15, { now })).reminder;
  const second = (await createReminderFromTask(secondTask, 15, { now })).reminder;
  const results = await cancelRemindersForTask('series@2027-01-01', { now: now + 1, reason: 'task-completed' });
  assert.equal(results.length, 1);
  assert.equal((await loadReminderState(first.reminderKey)).status, 'cancelled');
  assert.equal((await loadReminderState(second.reminderKey)).status, 'pending');
  assert.equal((await cancelReminder(first.reminderKey, { now: now + 2 })).changed, false);
});

test('reconciles changed and missing task schedules without duplicating history', async () => {
  const original = makeTask();
  const now = 1_800_000_000_000;
  const { reminder: oldReminder } = await createReminderFromTask(original, 15, { now });
  const changed = makeTask({ dateKey: '2027-03-01', hour: 9, minute: 0 });
  await reconcileReminders([changed], 15, { now: now + 1 });
  const afterChange = await loadReminderStates({ taskId: original.id });
  assert.equal(afterChange.length, 2);
  assert.equal(afterChange.find((item) => item.reminderKey === oldReminder.reminderKey).status, 'cancelled');
  const newReminder = afterChange.find((item) => item.status === 'pending');
  assert.ok(newReminder);

  await reconcileReminders([changed], 15, { now: now + 2 });
  assert.equal((await loadNotificationHistory()).length, 3);
  await reconcileReminders([], 15, { now: now + 3 });
  assert.equal((await loadReminderState(newReminder.reminderKey)).status, 'cancelled');
});

test('keeps state and history separate for recurring occurrences', async () => {
  const now = 1_800_000_000_000;
  const first = makeTask({ id: 'weekly@2027-01-01', repeat: 'weekly' });
  const second = makeTask({ id: 'weekly@2027-01-08', dateKey: '2027-01-08', repeat: 'weekly' });
  const firstReminder = (await createReminderFromTask(first, 15, { now })).reminder;
  const secondReminder = (await createReminderFromTask(second, 15, { now })).reminder;
  assert.notEqual(firstReminder.reminderKey, secondReminder.reminderKey);
  assert.equal(firstReminder.occurrenceId, first.id);
  assert.equal(secondReminder.occurrenceId, second.id);
  assert.deepEqual((await loadReminderStates({ taskId: first.id })).map((item) => item.occurrenceId), [first.id]);
  assert.deepEqual((await loadReminderStates({ taskId: second.id })).map((item) => item.occurrenceId), [second.id]);
});

test('enforces valid state transitions and rejects invalid schedules and Snooze times', async () => {
  const now = 1_800_000_000_000;
  const { reminder } = await createReminderFromTask(makeTask(), 15, { now });
  const sent = await markReminderSent(reminder.reminderKey, { now: now + 1 });
  assert.equal(sent.reminder.status, 'sent');
  await assert.rejects(markReminderSent(reminder.reminderKey, { now: now + 2 }), /ไม่สามารถส่ง Reminder/);
  await assert.rejects(snoozeReminder(reminder.reminderKey, now + 1, { now: now + 2 }), /หลังเวลาปัจจุบัน/);
  const cancelled = await cancelReminder(reminder.reminderKey, { now: now + 3 });
  assert.equal(cancelled.reminder.status, 'cancelled');
  await assert.rejects(markReminderFailed(reminder.reminderKey, 'late', { now: now + 4 }), /ไม่สามารถ Failed Reminder/);
  await assert.rejects(createReminderFromTask(makeTask({ dateKey: '2027-02-30' }), 15, { now }), /ไม่มีวันที่/);
  await assert.rejects(createReminderFromTask(makeTask(), -1, { now }), /ไม่ติดลบ/);
});

test('failed transitions are persisted and cannot be sent again without reconciliation', async () => {
  const now = 1_800_000_000_000;
  const { reminder } = await createReminderFromTask(makeTask(), 15, { now });
  const failed = await markReminderFailed(reminder.reminderKey, 'storage unavailable', { now: now + 1 });
  assert.equal(failed.reminder.status, 'failed');
  assert.equal(failed.reminder.nextReminderAt, null);
  assert.equal((await loadNotificationHistory({ reminderKey: reminder.reminderKey }))[0].eventType, 'failed');
  await assert.rejects(markReminderSent(reminder.reminderKey, { now: now + 2 }), /ไม่สามารถส่ง Reminder/);
});

test('rolls back a Reminder State write when its deterministic History Event already exists', async () => {
  const task = makeTask();
  const now = 1_800_000_000_000;
  const first = await createReminderFromTask(task, 15, { now });
  assert.equal(first.created, true);
  const event = (await loadNotificationHistory())[0];
  assert.equal(await deleteReminderState(first.reminder.reminderKey), true);

  const repeated = await createReminderFromTask(task, 15, { now });
  assert.equal(repeated.created, false);
  assert.equal(repeated.duplicate, true);
  assert.equal(repeated.reminder, null);
  assert.equal(await loadReminderState(first.reminder.reminderKey), null);
  assert.equal((await loadNotificationHistory()).length, 1);

  await appendNotificationEvent(event);
  assert.equal((await loadNotificationHistory()).length, 1);
});
