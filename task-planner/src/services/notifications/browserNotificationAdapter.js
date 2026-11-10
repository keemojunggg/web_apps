import {
  loadReminderState,
} from '../../utils/taskStorage.js';
import {
  createReminderFromTask,
  markReminderFailed,
  markReminderSent,
} from './notificationEngine.js';

const inFlightDeliveries = new Map();
let successfullyDelivered = new Set();
let deliveredStorage = null;

export function createNotificationDeliveryAdapter(implementation) {
  if (!implementation || typeof implementation.deliver !== 'function') {
    throw new TypeError('Notification adapter ต้องมี deliver(payload)');
  }
  return Object.freeze({
    ...(typeof implementation.getPermissionStatus === 'function'
      ? { getPermissionStatus: implementation.getPermissionStatus.bind(implementation) }
      : {}),
    ...(typeof implementation.requestPermission === 'function'
      ? { requestPermission: implementation.requestPermission.bind(implementation) }
      : {}),
    deliver: implementation.deliver.bind(implementation),
  });
}

function isValidPayload(payload) {
  return payload
    && typeof payload === 'object'
    && typeof payload.reminderKey === 'string'
    && payload.reminderKey.trim()
    && typeof payload.taskId === 'string'
    && payload.taskId.trim()
    && typeof payload.occurrenceId === 'string'
    && payload.occurrenceId.trim()
    && typeof payload.title === 'string'
    && Number.isFinite(payload.scheduledAt);
}

function notificationBody(payload) {
  if (typeof payload.body === 'string' && payload.body) return payload.body;
  const scheduled = new Date(payload.scheduledAt);
  const date = scheduled.toLocaleDateString();
  const time = scheduled.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  return `${payload.title} · ${date} ${time}`;
}

function getErrorDetails(error) {
  return {
    errorName: typeof error?.name === 'string' ? error.name : 'Error',
    errorMessage: typeof error?.message === 'string' ? error.message : String(error),
  };
}

function taskFromReminder(reminder) {
  const date = new Date(reminder.scheduledAt);
  if (Number.isNaN(date.getTime())) throw new TypeError('Reminder scheduledAt ไม่ถูกต้อง');
  return {
    id: reminder.occurrenceId,
    title: reminder.title || '',
    dateKey: `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`,
    hour: date.getHours(),
    minute: date.getMinutes(),
    notify: true,
    done: false,
    archived: false,
    cancelled: false,
  };
}

function leadMinutesFromReminderKey(reminder) {
  const prefix = `reminder:${encodeURIComponent(reminder.occurrenceId)}:${reminder.scheduledAt}:`;
  if (!reminder.reminderKey.startsWith(prefix)) return null;
  const leadMinutes = Number(reminder.reminderKey.slice(prefix.length));
  return Number.isFinite(leadMinutes) && leadMinutes >= 0 ? leadMinutes : null;
}

async function prepareForDelivery(payload) {
  let reminder = await loadReminderState(payload.reminderKey);
  if (!reminder) return { reminder: null, duplicate: false };
  if (reminder.status === 'sent') return { reminder, duplicate: true };
  if (reminder.status === 'failed') {
    const leadMinutes = leadMinutesFromReminderKey(reminder);
    if (leadMinutes === null) return { reminder, duplicate: false, error: 'ไม่สามารถระบุ Lead Time สำหรับ Retry ได้' };
    const retry = await createReminderFromTask(taskFromReminder(reminder), leadMinutes);
    reminder = retry.reminder;
    if (!reminder || !['pending', 'snoozed'].includes(reminder.status)) {
      return { reminder, duplicate: Boolean(retry.duplicate), error: 'เปลี่ยนสถานะ Reminder เพื่อ Retry ไม่สำเร็จ' };
    }
  }
  if (!['pending', 'snoozed'].includes(reminder.status)) {
    return { reminder, duplicate: true };
  }
  return { reminder, duplicate: false };
}

function makeClickHandler(payload, { windowTarget, onClick }) {
  return (event) => {
    event?.preventDefault?.();
    try { windowTarget?.focus?.(); } catch { /* focus is best-effort */ }
    if (onClick) {
      onClick({
        taskId: payload.taskId,
        occurrenceId: payload.occurrenceId,
        reminderKey: payload.reminderKey,
      });
      return;
    }
    const href = windowTarget?.location?.href;
    if (!href || typeof windowTarget?.open !== 'function') return;
    const target = new URL(href);
    target.searchParams.set('taskId', payload.taskId);
    target.searchParams.set('occurrenceId', payload.occurrenceId);
    windowTarget.open(target.toString(), '_blank');
  };
}

export function createBrowserNotificationAdapter({
  NotificationClass = globalThis.Notification,
  windowTarget = globalThis.window,
  onClick,
  now = () => Date.now(),
} = {}) {
  if (onClick !== undefined && typeof onClick !== 'function') {
    throw new TypeError('onClick ต้องเป็น Function');
  }
  if (typeof now !== 'function') throw new TypeError('now ต้องเป็น Function');

  const adapter = {
    getPermissionStatus() {
      if (typeof NotificationClass !== 'function' || !('permission' in NotificationClass)) return 'unsupported';
      return ['default', 'granted', 'denied'].includes(NotificationClass.permission)
        ? NotificationClass.permission
        : 'unsupported';
    },

    async requestPermission() {
      if (typeof NotificationClass !== 'function' || !('permission' in NotificationClass)) return 'unsupported';
      if (NotificationClass.permission !== 'default') return NotificationClass.permission;
      if (typeof NotificationClass.requestPermission !== 'function') return 'unsupported';
      return NotificationClass.requestPermission();
    },

    async deliver(payload) {
      if (!isValidPayload(payload)) throw new TypeError('Notification payload ต้องมี reminderKey, taskId, occurrenceId, title และ scheduledAt ที่ถูกต้อง');
      if (deliveredStorage !== globalThis.indexedDB) {
        successfullyDelivered = new Set();
        deliveredStorage = globalThis.indexedDB;
      }
      if (successfullyDelivered.has(payload.reminderKey)) {
        return { delivered: false, duplicate: true, reason: 'already-delivered-in-session' };
      }
      if (inFlightDeliveries.has(payload.reminderKey)) {
        return { delivered: false, duplicate: true, reason: 'in-flight' };
      }

      const delivery = (async () => {
        const permission = adapter.getPermissionStatus();
        if (permission !== 'granted') {
          return { delivered: false, duplicate: false, reason: permission };
        }

        let prepared;
        try {
          prepared = await prepareForDelivery(payload);
        } catch (error) {
          return { delivered: false, duplicate: false, reason: 'storage-error', error };
        }
        if (prepared.error) return { delivered: false, duplicate: false, reason: 'retry-unavailable', error: prepared.error };
        if (prepared.duplicate) return { delivered: false, duplicate: true, reason: prepared.reminder?.status };
        if (!prepared.reminder) return { delivered: false, duplicate: false, reason: 'reminder-missing' };

        let notification;
        try {
          notification = new NotificationClass(payload.title, {
            body: notificationBody(payload),
            tag: payload.reminderKey,
            data: {
              taskId: payload.taskId,
              occurrenceId: payload.occurrenceId,
              reminderKey: payload.reminderKey,
            },
          });
        } catch (error) {
          try {
            await markReminderFailed(payload.reminderKey, error?.message || 'notification-construction-failed', { now: now() });
          } catch (storageError) {
            return {
              delivered: false,
              duplicate: false,
              error,
              storageError,
              errorInfo: getErrorDetails(error),
            };
          }
          return { delivered: false, duplicate: false, error, errorInfo: getErrorDetails(error) };
        }

        notification.onclick = makeClickHandler(payload, { windowTarget, onClick });
        try {
          const transition = await markReminderSent(payload.reminderKey, { now: now() });
          if (!transition.changed) {
            successfullyDelivered.add(payload.reminderKey);
            return {
              delivered: true,
              duplicate: Boolean(transition.duplicate),
              reason: 'notification-created-state-not-updated',
              notification,
            };
          }
          successfullyDelivered.add(payload.reminderKey);
          return { delivered: true, duplicate: false, notification };
        } catch (error) {
          successfullyDelivered.add(payload.reminderKey);
          return { delivered: true, duplicate: false, notification, storageError: error };
        }
      })();
      inFlightDeliveries.set(payload.reminderKey, delivery);
      try {
        return await delivery;
      } finally {
        if (inFlightDeliveries.get(payload.reminderKey) === delivery) {
          inFlightDeliveries.delete(payload.reminderKey);
        }
      }
    },
  };

  return createNotificationDeliveryAdapter(adapter);
}
