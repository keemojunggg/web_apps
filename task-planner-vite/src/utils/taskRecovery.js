import { isTaskOverdue } from './taskManagement.js';

const EDITABLE_ACTIONS = new Set(['reschedule', 'snooze', 'archive', 'restore-archive', 'cancel', 'restore-cancel', 'pin', 'unpin', 'wake']);

export function applyTaskRecovery(tasks, taskId, action, options = {}) {
  if (!EDITABLE_ACTIONS.has(action)) return { tasks, changed: false, task: null, event: null };
  const task = tasks.find((item) => item.id === taskId);
  if (!task) return { tasks, changed: false, task: null, event: null };

  const occurredAt = Number.isFinite(options.occurredAt) ? options.occurredAt : Date.now();
  let changes;
  let eventType;
  let eventDetails = {};
  switch (action) {
    case 'reschedule': {
      if (typeof options.dateKey !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(options.dateKey)) return { tasks, changed: false, task, event: null };
      const [year, month, day] = options.dateKey.split('-').map(Number);
      const date = new Date(year, month - 1, day);
      if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) return { tasks, changed: false, task, event: null };
      const hour = options.hour ?? task.hour;
      const minute = options.minute ?? task.minute;
      if (!Number.isInteger(hour) || hour < 0 || hour > 23 || !Number.isInteger(minute) || minute < 0 || minute > 59) return { tasks, changed: false, task, event: null };
      changes = { dateKey: options.dateKey, hour, minute, snoozedUntil: null };
      eventType = 'rescheduled';
      eventDetails = { fromDate: task.dateKey || '', fromHour: task.hour, fromMinute: task.minute, toDate: options.dateKey, toHour: hour, toMinute: minute };
      break;
    }
    case 'snooze':
      if (!Number.isFinite(options.until) || options.until <= occurredAt) return { tasks, changed: false, task, event: null };
      changes = { snoozedUntil: options.until };
      eventType = 'snoozed';
      eventDetails = { until: options.until };
      break;
    case 'wake':
      if (!Number.isFinite(task.snoozedUntil)) return { tasks, changed: false, task, event: null };
      changes = { snoozedUntil: null };
      eventType = 'snooze-cancelled';
      eventDetails = { previousUntil: task.snoozedUntil };
      break;
    case 'archive':
      changes = { archived: true, cancelled: false, snoozedUntil: null };
      eventType = 'archived';
      break;
    case 'restore-archive':
      changes = { archived: false };
      eventType = 'restored';
      break;
    case 'cancel':
      changes = { cancelled: true, archived: false, snoozedUntil: null };
      eventType = 'cancelled';
      break;
    case 'restore-cancel':
      changes = { cancelled: false };
      eventType = 'uncancelled';
      break;
    case 'pin':
      changes = { pinned: true };
      eventType = 'pinned';
      break;
    case 'unpin':
      changes = { pinned: false };
      eventType = 'unpinned';
      break;
    default:
      return { tasks, changed: false, task, event: null };
  }

  if (Object.entries(changes).every(([key, value]) => task[key] === value)) return { tasks, changed: false, task, event: null };
  const updated = { ...task, ...changes };
  return {
    tasks: tasks.map((item) => item.id === taskId ? updated : item),
    changed: true,
    task: updated,
    event: {
      taskId,
      type: eventType,
      occurredAt,
      dueDate: task.dateKey || '',
      overdueAtAction: isTaskOverdue(task, occurredAt),
      ...eventDetails,
    },
  };
}

export function getLocalDateKey(date = new Date()) {
  const value = date instanceof Date ? date : new Date(date);
  if (Number.isNaN(value.getTime())) return '';
  const pad = (number) => String(number).padStart(2, '0');
  return `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())}`;
}

export function getRescheduleTodayTime(task, now = new Date()) {
  const current = now instanceof Date ? new Date(now) : new Date(now);
  const taskMinutes = Number.isInteger(task.hour) && Number.isInteger(task.minute) ? task.hour * 60 + task.minute : 9 * 60;
  const currentMinutes = current.getHours() * 60 + current.getMinutes();
  const minutes = task.dateKey === getLocalDateKey(current) && taskMinutes > currentMinutes
    ? taskMinutes
    : Math.min(currentMinutes + 15, 23 * 60 + 59);
  return { hour: Math.floor(minutes / 60), minute: minutes % 60 };
}
