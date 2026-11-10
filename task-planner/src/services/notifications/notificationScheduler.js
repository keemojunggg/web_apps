import { loadTasks, loadReminderStates } from '../../utils/taskStorage.js';
import {
  cancelReminder,
  reconcileReminders,
} from './notificationEngine.js';

export const DEFAULT_CHECK_INTERVAL_MS = 25_000;
export const DEFAULT_MISSED_REMINDER_GRACE_MS = 15 * 60_000;
export const DEFAULT_MAX_DELIVERIES_PER_CHECK = 25;

const DUE_STATUSES = ['pending', 'snoozed'];
let activeCheck = null;
let offeredReminders = new Map();
let offeredStorage = null;

function assertTimestamp(now) {
  if (!Number.isFinite(now)) throw new TypeError('now ต้องเป็น timestamp ที่ถูกต้อง');
}

function assertLeadMinutes(leadMinutes) {
  if (!Number.isFinite(leadMinutes) || leadMinutes < 0) {
    throw new TypeError('leadMinutes ต้องเป็นจำนวนที่ไม่ติดลบ');
  }
}

function isTaskEligible(task) {
  return Boolean(task && task.notify === true && !task.done && !task.archived && !task.cancelled);
}

function orderByDueTime(first, second) {
  return first.nextReminderAt - second.nextReminderAt
    || first.updatedAt - second.updatedAt
    || first.reminderKey.localeCompare(second.reminderKey);
}

function chooseLatestReminder(first, second) {
  return second.updatedAt - first.updatedAt
    || second.nextReminderAt - first.nextReminderAt
    || first.reminderKey.localeCompare(second.reminderKey);
}

function reminderFingerprint(reminder) {
  return `${reminder.status}:${reminder.nextReminderAt}:${reminder.updatedAt}`;
}

export function collectDueReminders(reminders, tasks, now = Date.now()) {
  assertTimestamp(now);
  if (!Array.isArray(reminders) || !Array.isArray(tasks)) {
    throw new TypeError('reminders และ tasks ต้องเป็น Array');
  }
  const tasksById = new Map(tasks.filter((task) => task && typeof task.id === 'string').map((task) => [task.id, task]));
  return reminders.filter((reminder) => (
    reminder
    && DUE_STATUSES.includes(reminder.status)
    && Number.isFinite(reminder.nextReminderAt)
    && reminder.nextReminderAt <= now
    && isTaskEligible(tasksById.get(reminder.occurrenceId))
  )).sort(orderByDueTime);
}

async function performCheck({
  now,
  leadMinutes,
  reconcile,
  missedReminderGraceMs,
  maxDeliveries,
}) {
  const errors = [];
  try {
    const loaded = await loadTasks();
    if (loaded.error) throw new Error(loaded.error);
    if (reconcile) await reconcileReminders(loaded.tasks, leadMinutes, { now });
    const [pending, snoozed] = await Promise.all(DUE_STATUSES.map((status) => loadReminderStates({ status })));
    const tasksById = new Map(loaded.tasks.map((task) => [task.id, task]));
    const allActive = [...pending, ...snoozed];
    const candidates = [];

    for (const reminder of allActive) {
      if (!DUE_STATUSES.includes(reminder.status)
        || !Number.isFinite(reminder.nextReminderAt)
        || reminder.nextReminderAt > now
        || !isTaskEligible(tasksById.get(reminder.occurrenceId))) continue;
      if (now - reminder.nextReminderAt > missedReminderGraceMs) {
        try {
          await cancelReminder(reminder.reminderKey, { now, reason: 'missed-reminder-expired' });
        } catch (error) {
          errors.push(error);
        }
      } else {
        candidates.push(reminder);
      }
    }

    const groups = new Map();
    candidates.forEach((reminder) => {
      const current = groups.get(reminder.occurrenceId) || [];
      current.push(reminder);
      groups.set(reminder.occurrenceId, current);
    });

    const uniqueCandidates = [];
    for (const group of groups.values()) {
      group.sort(chooseLatestReminder);
      const [selected, ...duplicates] = group;
      let duplicateCancellationFailed = false;
      for (const duplicate of duplicates) {
        try {
          await cancelReminder(duplicate.reminderKey, {
            now,
            reason: `overlapping-reminder:${selected.reminderKey}`,
          });
        } catch (error) {
          errors.push(error);
          duplicateCancellationFailed = true;
        }
      }
      if (!duplicateCancellationFailed) uniqueCandidates.push(selected);
    }

    for (const [reminderKey, claim] of offeredReminders) {
      if (now - claim.offeredAt >= DEFAULT_CHECK_INTERVAL_MS) offeredReminders.delete(reminderKey);
    }

    const output = [];
    const availableCandidates = uniqueCandidates.sort(orderByDueTime).filter((reminder) => {
      const claim = offeredReminders.get(reminder.reminderKey);
      return claim?.fingerprint !== reminderFingerprint(reminder)
        || now - claim.offeredAt >= DEFAULT_CHECK_INTERVAL_MS;
    }).slice(0, maxDeliveries);
    for (const reminder of availableCandidates) {
      const latestTask = tasksById.get(reminder.occurrenceId);
      if (!isTaskEligible(latestTask)) continue;
      output.push({ ...reminder, title: latestTask.title });
      offeredReminders.set(reminder.reminderKey, { fingerprint: reminderFingerprint(reminder), offeredAt: now });
    }
    return { reminders: output, errors, skipped: false };
  } catch (error) {
    errors.push(error);
    return { reminders: [], errors, skipped: false };
  }
}

export function runNotificationCheck({
  now = Date.now(),
  leadMinutes = 15,
  reconcile = true,
  missedReminderGraceMs = DEFAULT_MISSED_REMINDER_GRACE_MS,
  maxDeliveries = DEFAULT_MAX_DELIVERIES_PER_CHECK,
} = {}) {
  assertTimestamp(now);
  assertLeadMinutes(leadMinutes);
  if (typeof reconcile !== 'boolean') throw new TypeError('reconcile ต้องเป็น boolean');
  if (!Number.isFinite(missedReminderGraceMs) || missedReminderGraceMs < 0) {
    throw new TypeError('missedReminderGraceMs ต้องเป็นจำนวนที่ไม่ติดลบ');
  }
  if (!Number.isSafeInteger(maxDeliveries) || maxDeliveries < 1) {
    throw new TypeError('maxDeliveries ต้องเป็นจำนวนเต็มบวก');
  }
  if (offeredStorage !== globalThis.indexedDB) {
    offeredReminders = new Map();
    offeredStorage = globalThis.indexedDB;
  }
  if (activeCheck) return Promise.resolve({ reminders: [], errors: [], skipped: true });

  const check = performCheck({ now, leadMinutes, reconcile, missedReminderGraceMs, maxDeliveries });
  activeCheck = check;
  return check.finally(() => {
    if (activeCheck === check) activeCheck = null;
  });
}

export function startNotificationScheduler({
  leadMinutes = 15,
  intervalMs = DEFAULT_CHECK_INTERVAL_MS,
  onReminders = () => {},
  onError = () => {},
  windowTarget = globalThis.window,
  documentTarget = globalThis.document,
  setIntervalFn = globalThis.setInterval.bind(globalThis),
  clearIntervalFn = globalThis.clearInterval.bind(globalThis),
} = {}) {
  assertLeadMinutes(leadMinutes);
  if (!Number.isSafeInteger(intervalMs) || intervalMs < 20_000 || intervalMs > 30_000) {
    throw new RangeError('intervalMs ต้องอยู่ระหว่าง 20,000 และ 30,000 มิลลิวินาที');
  }
  if (typeof onReminders !== 'function' || typeof onError !== 'function') {
    throw new TypeError('onReminders และ onError ต้องเป็น Function');
  }

  let stopped = false;
  const check = async () => {
    if (stopped) return;
    try {
      const result = await runNotificationCheck({ leadMinutes });
      result.errors.forEach((error) => onError(error));
      if (result.reminders.length) onReminders(result.reminders);
    } catch (error) {
      onError(error);
    }
  };
  const onFocus = () => { void check(); };
  const onVisibilityChange = () => {
    if (documentTarget?.visibilityState === 'visible') void check();
  };

  const timer = setIntervalFn(check, intervalMs);
  windowTarget?.addEventListener?.('focus', onFocus);
  documentTarget?.addEventListener?.('visibilitychange', onVisibilityChange);
  void check();

  return () => {
    if (stopped) return;
    stopped = true;
    clearIntervalFn(timer);
    windowTarget?.removeEventListener?.('focus', onFocus);
    documentTarget?.removeEventListener?.('visibilitychange', onVisibilityChange);
  };
}
