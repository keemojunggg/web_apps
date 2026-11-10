import { addDays, toKey } from './dateUtils.js';

function parseDateKey(dateKey) {
  if (typeof dateKey !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(dateKey)) return null;
  const [year, month, day] = dateKey.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day ? date : null;
}

/** Return the first recurrence strictly after a date while retaining the series cadence. */
export function nextOccurrenceDate(anchorDateKey, repeat, afterDateKey = anchorDateKey) {
  const anchor = parseDateKey(anchorDateKey);
  const after = parseDateKey(afterDateKey);
  if (!anchor || !after) return '';

  if (repeat === 'daily' || repeat === 'weekly') {
    const interval = repeat === 'daily' ? 1 : 7;
    const ordinal = (date) => Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / 86_400_000;
    const daysFromAnchor = Math.max(0, ordinal(after) - ordinal(anchor));
    const steps = Math.floor(daysFromAnchor / interval) + 1;
    return toKey(addDays(anchor, steps * interval));
  }

  if (repeat === 'monthly') {
    const anchorDay = anchor.getDate();
    const monthDistance = (after.getFullYear() - anchor.getFullYear()) * 12 + after.getMonth() - anchor.getMonth();
    let monthOffset = Math.max(0, monthDistance);
    while (monthOffset < 2400) {
      const monthStart = new Date(anchor.getFullYear(), anchor.getMonth() + monthOffset, 1);
      const lastDay = new Date(monthStart.getFullYear(), monthStart.getMonth() + 1, 0).getDate();
      monthStart.setDate(Math.min(anchorDay, lastDay));
      if (toKey(monthStart) > toKey(after)) return toKey(monthStart);
      monthOffset += 1;
    }
  }

  return '';
}

function completionDateKey(completedAt) {
  const date = completedAt instanceof Date ? completedAt : new Date(completedAt);
  return Number.isNaN(date.getTime()) ? '' : toKey(date);
}

/** Complete one occurrence, creating its stable successor at most once. */
export function completeTaskOccurrence(tasks, taskId, completedAt = new Date()) {
  const current = tasks.find((task) => task.id === taskId);
  if (!current || current.done || current.archived || current.cancelled) {
    return { tasks, changed: false, event: null, occurrenceCreated: false };
  }

  const completedKey = completionDateKey(completedAt);
  const timestamp = completedAt instanceof Date ? completedAt.getTime() : new Date(completedAt).getTime();
  const seriesId = current.seriesId || current.id;
  const anchorDateKey = current.recurrenceAnchorDate || current.dateKey;
  const updatedCurrent = {
    ...current,
    done: true,
    ...(current.repeat !== 'none' && current.dateKey ? { seriesId, recurrenceAnchorDate: anchorDateKey } : {}),
  };
  const nextTasks = tasks.map((task) => task.id === taskId ? updatedCurrent : task);
  const event = {
    taskId,
    type: 'completed',
    occurredAt: timestamp,
    scheduledDate: current.dateKey || '',
    completedDate: completedKey,
    priority: current.priority,
  };
  if (current.repeat === 'none' || !anchorDateKey || !completedKey) {
    return { tasks: nextTasks, changed: true, event, occurrenceCreated: false };
  }

  const nextDate = nextOccurrenceDate(anchorDateKey, current.repeat, completedKey);
  if (!nextDate) return { tasks: nextTasks, changed: true, event, occurrenceCreated: false };
  const nextId = `${seriesId}@${nextDate}`;
  if (nextTasks.some((task) => task.id === nextId || (task.seriesId === seriesId && task.dateKey === nextDate))) {
    return { tasks: nextTasks, changed: true, event, occurrenceCreated: false };
  }

  const { completedAt: ignoredCompletedAt, ...occurrenceSource } = current;
  const nextOccurrence = {
    ...occurrenceSource,
    id: nextId,
    seriesId,
    recurrenceAnchorDate: anchorDateKey,
    dateKey: nextDate,
    done: false,
    archived: false,
    cancelled: false,
    snoozedUntil: null,
    pinned: false,
    createdAt: timestamp,
  };
  return {
    tasks: [...nextTasks, nextOccurrence],
    changed: true,
    event: { ...event, nextOccurrenceId: nextId, nextOccurrenceDate: nextDate },
    occurrenceCreated: true,
  };
}

/** Reopen an occurrence without deleting or changing an existing successor. */
export function reopenTaskOccurrence(tasks, taskId, occurredAt = Date.now()) {
  const current = tasks.find((task) => task.id === taskId);
  if (!current || !current.done) return { tasks, changed: false, event: null };
  return {
    tasks: tasks.map((task) => task.id === taskId ? { ...task, done: false } : task),
    changed: true,
    event: { taskId, type: 'reopened', occurredAt, scheduledDate: current.dateKey || '' },
  };
}
