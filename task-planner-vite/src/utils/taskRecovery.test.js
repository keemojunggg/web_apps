import test from 'node:test';
import assert from 'node:assert/strict';
import { applyTaskRecovery, getLocalDateKey, getRescheduleTodayTime } from './taskRecovery.js';

const baseTask = (fields = {}) => ({
  id: 'recovery-task', title: 'Keep fields', dateKey: '2026-10-17', hour: 8, minute: 15,
  priority: 'urgent', repeat: 'weekly', notify: true, done: false,
  description: 'Description stays', attachments: [{ id: 'file-1', name: 'file.txt' }], createdAt: 123,
  ...fields,
});

test('rescheduling validates date and time and preserves unrelated fields', () => {
  const task = baseTask();
  const result = applyTaskRecovery([task], task.id, 'reschedule', {
    dateKey: '2026-10-20', hour: 14, minute: 45, occurredAt: 1_800_000_000_000,
  });
  assert.equal(result.changed, true);
  assert.equal(result.task.dateKey, '2026-10-20');
  assert.equal(result.task.hour, 14);
  assert.equal(result.task.minute, 45);
  assert.equal(result.task.snoozedUntil, null);
  assert.equal(result.task.priority, task.priority);
  assert.equal(result.task.repeat, task.repeat);
  assert.equal(result.task.notify, task.notify);
  assert.equal(result.task.description, task.description);
  assert.deepEqual(result.task.attachments, task.attachments);
  assert.equal(result.event.type, 'rescheduled');
  assert.equal(result.event.fromDate, task.dateKey);
  assert.equal(applyTaskRecovery([task], task.id, 'reschedule', { dateKey: '2026-02-30' }).changed, false);
  assert.equal(applyTaskRecovery([task], task.id, 'reschedule', { dateKey: '2026-10-20', hour: 25 }).changed, false);
});

test('snooze suppresses overdue state until its wake time and wake is reversible', () => {
  const task = baseTask();
  const now = new Date(2026, 9, 18, 10, 0).getTime();
  const until = now + 60 * 60 * 1000;
  const snoozed = applyTaskRecovery([task], task.id, 'snooze', { until, occurredAt: now });
  assert.equal(snoozed.changed, true);
  assert.equal(snoozed.task.snoozedUntil, until);
  assert.equal(snoozed.event.type, 'snoozed');
  const woken = applyTaskRecovery(snoozed.tasks, task.id, 'wake', { occurredAt: now + 1000 });
  assert.equal(woken.changed, true);
  assert.equal(woken.task.snoozedUntil, null);
  assert.equal(woken.event.type, 'snooze-cancelled');
});

test('archive and cancel are distinct reversible states and never destroy task fields', () => {
  const task = baseTask();
  const archived = applyTaskRecovery([task], task.id, 'archive', { occurredAt: 1000 });
  assert.equal(archived.task.archived, true);
  assert.equal(archived.task.cancelled, false);
  assert.equal(archived.event.type, 'archived');
  assert.equal(archived.task.description, task.description);
  assert.deepEqual(archived.task.attachments, task.attachments);
  const restored = applyTaskRecovery(archived.tasks, task.id, 'restore-archive', { occurredAt: 2000 });
  assert.equal(restored.task.archived, false);
  assert.equal(restored.event.type, 'restored');

  const cancelled = applyTaskRecovery(restored.tasks, task.id, 'cancel', { occurredAt: 3000 });
  assert.equal(cancelled.task.cancelled, true);
  assert.equal(cancelled.task.archived, false);
  const uncancelled = applyTaskRecovery(cancelled.tasks, task.id, 'restore-cancel', { occurredAt: 4000 });
  assert.equal(uncancelled.task.cancelled, false);
  assert.equal(uncancelled.event.type, 'uncancelled');
});

test('pin override can be turned off and stale actions are safe no-ops', () => {
  const task = baseTask();
  const pinned = applyTaskRecovery([task], task.id, 'pin', { occurredAt: 1000 });
  assert.equal(pinned.task.pinned, true);
  assert.equal(applyTaskRecovery(pinned.tasks, task.id, 'pin').changed, false);
  assert.equal(applyTaskRecovery(pinned.tasks, 'missing', 'archive').changed, false);
  assert.equal(applyTaskRecovery([task], task.id, 'unknown-action').changed, false);
  assert.equal(applyTaskRecovery([task], task.id, 'snooze', { until: 10, occurredAt: 10 }).changed, false);
  const unpinned = applyTaskRecovery(pinned.tasks, task.id, 'unpin', { occurredAt: 2000 });
  assert.equal(unpinned.task.pinned, false);
});

test('same-day rescheduling moves past times forward and retains future times', () => {
  const now = new Date(2026, 9, 18, 10, 20);
  assert.equal(getLocalDateKey(now), '2026-10-18');
  assert.deepEqual(getRescheduleTodayTime(baseTask({ dateKey: '2026-10-18', hour: 9, minute: 0 }), now), { hour: 10, minute: 35 });
  assert.deepEqual(getRescheduleTodayTime(baseTask({ dateKey: '2026-10-18', hour: 15, minute: 0 }), now), { hour: 15, minute: 0 });
});
