import {
  loadReminderState,
  loadReminderStates,
  saveReminderStateWithEvent,
} from '../../utils/taskStorage.js';

const ACTIVE_STATUSES = new Set(['pending', 'sent', 'snoozed']);
const TRANSITIONABLE_STATUSES = new Set(['pending', 'snoozed']);

function assertTimestamp(timestamp, name) {
  if (!Number.isFinite(timestamp)) throw new TypeError(`${name} ต้องเป็น timestamp ที่ถูกต้อง`);
}

function assertLeadMinutes(leadMinutes) {
  if (!Number.isFinite(leadMinutes) || leadMinutes < 0) {
    throw new TypeError('leadMinutes ต้องเป็นจำนวนที่ไม่ติดลบ');
  }
}

function getScheduledAt(task) {
  if (typeof task.dateKey !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(task.dateKey)
    || !Number.isInteger(task.hour) || task.hour < 0 || task.hour > 23
    || !Number.isInteger(task.minute) || task.minute < 0 || task.minute > 59) {
    throw new TypeError('Task ต้องมี dateKey, hour และ minute ที่ถูกต้อง');
  }
  const [year, month, day] = task.dateKey.split('-').map(Number);
  const scheduledAt = new Date(year, month - 1, day, task.hour, task.minute, 0, 0);
  if (scheduledAt.getFullYear() !== year || scheduledAt.getMonth() !== month - 1 || scheduledAt.getDate() !== day) {
    throw new TypeError('Task dateKey ไม่มีวันที่ตามปฏิทิน');
  }
  return scheduledAt.getTime();
}

function isTaskEligible(task) {
  return Boolean(task && task.notify === true && !task.done && !task.archived && !task.cancelled);
}

function makeReminderKey(occurrenceId, scheduledAt, leadMinutes) {
  return `reminder:${encodeURIComponent(occurrenceId)}:${scheduledAt}:${leadMinutes}`;
}

function toReminder(task, leadMinutes, now) {
  if (!task || typeof task !== 'object' || typeof task.id !== 'string' || !task.id.trim()) {
    throw new TypeError('Task ต้องมี id ที่ถูกต้อง');
  }
  assertLeadMinutes(leadMinutes);
  if (!isTaskEligible(task)) return null;
  const scheduledAt = getScheduledAt(task);
  const nextReminderAt = scheduledAt - leadMinutes * 60_000;
  if (!Number.isFinite(nextReminderAt)) throw new RangeError('เวลาแจ้งเตือนไม่ถูกต้อง');
  return {
    reminderKey: makeReminderKey(task.id, scheduledAt, leadMinutes),
    taskId: task.id,
    occurrenceId: task.id,
    scheduledAt,
    nextReminderAt,
    status: 'pending',
    updatedAt: now,
  };
}

function makeEvent(reminder, eventType, occurredAt, idempotencyKey, details = {}) {
  return {
    id: `notification:${encodeURIComponent(reminder.reminderKey)}:${eventType}:${occurredAt}:${encodeURIComponent(String(idempotencyKey))}`,
    taskId: reminder.taskId,
    occurrenceId: reminder.occurrenceId,
    reminderKey: reminder.reminderKey,
    eventType,
    occurredAt,
    ...details,
  };
}

async function commitTransition(reminder, eventType, occurredAt, idempotencyKey, changes, details) {
  const updated = { ...reminder, ...changes, updatedAt: occurredAt };
  const result = await saveReminderStateWithEvent(
    updated,
    makeEvent(updated, eventType, occurredAt, idempotencyKey, details),
  );
  const stored = result.duplicate ? await loadReminderState(reminder.reminderKey) : null;
  return {
    reminder: result.written ? updated : stored || null,
    changed: result.written,
    duplicate: result.duplicate,
  };
}

async function cancelState(reminder, { now, reason, eventType = 'cancelled' }) {
  if (!ACTIVE_STATUSES.has(reminder.status)) {
    return { reminder, changed: false, duplicate: false };
  }
  return commitTransition(
    reminder,
    eventType,
    now,
    `${reason || 'cancelled'}:${reminder.status}`,
    { status: 'cancelled', nextReminderAt: null },
    { reason: reason || 'cancelled', previousStatus: reminder.status },
  );
}

export async function createReminderFromTask(task, leadMinutes, { now = Date.now() } = {}) {
  assertTimestamp(now, 'now');
  const reminder = toReminder(task, leadMinutes, now);
  if (!reminder) return { reminder: null, created: false, duplicate: false };
  const existing = await loadReminderState(reminder.reminderKey);
  if (existing && ACTIVE_STATUSES.has(existing.status)) {
    return { reminder: existing, created: false, duplicate: true };
  }
  if (existing) {
    const result = await commitTransition(
      { ...existing, scheduledAt: reminder.scheduledAt, nextReminderAt: reminder.nextReminderAt },
      'reconciled',
      now,
      `reactivate:${existing.status}`,
      { status: 'pending' },
      { reason: 'task-reminder-active', previousStatus: existing.status },
    );
    return { reminder: result.reminder, created: result.changed, duplicate: result.duplicate };
  }
  const result = await commitTransition(
    reminder,
    'scheduled',
    now,
    `${reminder.scheduledAt}:${reminder.nextReminderAt}`,
    {},
    { scheduledAt: reminder.scheduledAt, nextReminderAt: reminder.nextReminderAt },
  );
  return { reminder: result.reminder, created: result.changed, duplicate: result.duplicate };
}

export async function snoozeReminder(reminderKey, nextReminderAt, { now = Date.now() } = {}) {
  assertTimestamp(now, 'now');
  assertTimestamp(nextReminderAt, 'nextReminderAt');
  if (nextReminderAt <= now) throw new RangeError('เวลา Snooze ต้องอยู่หลังเวลาปัจจุบัน');
  const reminder = await loadReminderState(reminderKey);
  if (!reminder) throw new Error('ไม่พบ Reminder');
  if (!ACTIVE_STATUSES.has(reminder.status)) throw new Error(`ไม่สามารถ Snooze Reminder สถานะ ${reminder.status} ได้`);
  return commitTransition(
    reminder,
    'snoozed',
    now,
    String(nextReminderAt),
    { status: 'snoozed', nextReminderAt },
    { nextReminderAt },
  );
}

export async function markReminderSent(reminderKey, { now = Date.now() } = {}) {
  assertTimestamp(now, 'now');
  const reminder = await loadReminderState(reminderKey);
  if (!reminder) throw new Error('ไม่พบ Reminder');
  if (!TRANSITIONABLE_STATUSES.has(reminder.status)) throw new Error(`ไม่สามารถส่ง Reminder สถานะ ${reminder.status} ได้`);
  return commitTransition(
    reminder,
    'sent',
    now,
    reminder.status,
    { status: 'sent', nextReminderAt: null },
  );
}

export async function markReminderFailed(reminderKey, reason = 'failed', { now = Date.now() } = {}) {
  assertTimestamp(now, 'now');
  if (typeof reason !== 'string' || !reason.trim()) throw new TypeError('reason ต้องเป็นข้อความที่ไม่ว่าง');
  const reminder = await loadReminderState(reminderKey);
  if (!reminder) throw new Error('ไม่พบ Reminder');
  if (!TRANSITIONABLE_STATUSES.has(reminder.status)) throw new Error(`ไม่สามารถ Failed Reminder สถานะ ${reminder.status} ได้`);
  return commitTransition(
    reminder,
    'failed',
    now,
    `${reminder.status}:${reason}`,
    { status: 'failed', nextReminderAt: null },
    { reason },
  );
}

export async function cancelReminder(reminderKey, { now = Date.now(), reason = 'cancelled' } = {}) {
  assertTimestamp(now, 'now');
  if (typeof reason !== 'string' || !reason.trim()) throw new TypeError('reason ต้องเป็นข้อความที่ไม่ว่าง');
  const reminder = await loadReminderState(reminderKey);
  if (!reminder) return { reminder: null, changed: false, duplicate: false };
  return cancelState(reminder, { now, reason });
}

export async function cancelRemindersForTask(taskId, { now = Date.now(), reason = 'task-inactive' } = {}) {
  assertTimestamp(now, 'now');
  if (typeof taskId !== 'string' || !taskId.trim()) throw new TypeError('taskId ต้องเป็นข้อความที่ไม่ว่าง');
  const reminders = await loadReminderStates({ taskId });
  const results = [];
  for (const reminder of reminders) {
    results.push(await cancelState(reminder, { now, reason }));
  }
  return results;
}

export async function rescheduleReminder(
  previousTask,
  updatedTask,
  leadMinutes,
  { previousLeadMinutes = leadMinutes, now = Date.now() } = {},
) {
  assertTimestamp(now, 'now');
  assertLeadMinutes(previousLeadMinutes);
  if (!previousTask || typeof previousTask.id !== 'string' || !previousTask.id.trim()) {
    throw new TypeError('previousTask ต้องมี id ที่ถูกต้อง');
  }
  const newReminder = toReminder(updatedTask, leadMinutes, now);
  const previousScheduledAt = isTaskEligible(previousTask) ? getScheduledAt(previousTask) : null;
  const previousKey = previousScheduledAt === null
    ? null
    : makeReminderKey(previousTask.id, previousScheduledAt, previousLeadMinutes);
  if (previousKey === newReminder?.reminderKey) {
    return { oldReminder: await loadReminderState(previousKey), ...await createReminderFromTask(updatedTask, leadMinutes, { now }) };
  }

  const created = newReminder
    ? await createReminderFromTask(updatedTask, leadMinutes, { now })
    : { reminder: null, created: false, duplicate: false };
  if (newReminder && !created.reminder) {
    throw new Error('สร้าง Reminder ใหม่ไม่สำเร็จ จึงไม่ยกเลิก Reminder เดิม');
  }
  if (previousKey) {
    const oldReminder = await loadReminderState(previousKey);
    if (oldReminder) {
      const cancelled = await cancelState(oldReminder, {
        now,
        reason: `rescheduled:${newReminder?.reminderKey || 'inactive'}`,
        eventType: 'rescheduled',
      });
      return { oldReminder: cancelled.reminder, ...created };
    }
  }
  return { oldReminder: null, ...created };
}

export async function reconcileReminders(tasks, leadMinutes, { now = Date.now() } = {}) {
  if (!Array.isArray(tasks)) throw new TypeError('tasks ต้องเป็น Array');
  assertTimestamp(now, 'now');
  assertLeadMinutes(leadMinutes);
  const tasksById = new Map(tasks.filter((task) => task && typeof task.id === 'string').map((task) => [task.id, task]));
  const reminders = await loadReminderStates();
  const results = [];
  const activeDesiredKeys = new Set();
  for (const reminder of reminders) {
    const task = tasksById.get(reminder.occurrenceId);
    const desired = task ? toReminder(task, leadMinutes, now) : null;
    if (!desired) {
      if (ACTIVE_STATUSES.has(reminder.status)) {
        results.push(await cancelState(reminder, { now, reason: task ? 'task-inactive' : 'task-missing', eventType: 'reconciled' }));
      }
      continue;
    }
    if (reminder.reminderKey === desired.reminderKey && ACTIVE_STATUSES.has(reminder.status)) {
      activeDesiredKeys.add(desired.reminderKey);
    } else if (reminder.reminderKey !== desired.reminderKey && ACTIVE_STATUSES.has(reminder.status)) {
      results.push(await cancelState(reminder, {
        now,
        reason: `stale:${desired.reminderKey}`,
        eventType: 'reconciled',
      }));
    }
  }
  for (const task of tasks) {
    if (!isTaskEligible(task)) continue;
    const desired = toReminder(task, leadMinutes, now);
    if (!activeDesiredKeys.has(desired.reminderKey)) {
      results.push(await createReminderFromTask(task, leadMinutes, { now }));
    }
  }
  return results;
}
