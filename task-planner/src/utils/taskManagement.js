import { PRIORITY_ORDER } from '../constants/priorities.js';

const pad2 = (value) => String(value).padStart(2, '0');

export const TASK_FILTERS = ['all', 'active', 'completed', 'overdue', 'archived', 'cancelled'];
export const TASK_SORTS = ['focus', 'time', 'priority', 'created'];

function isValidDateKey(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day;
}

export function taskDueAt(task) {
  if (!task || !isValidDateKey(task.dateKey)) return null;
  const [year, month, day] = task.dateKey.split('-').map(Number);
  const hour = Number(task.hour);
  const minute = Number(task.minute);
  const date = new Date(year, month - 1, day, hour, minute, 0, 0);
  if (
    date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day
    || !Number.isInteger(hour) || hour < 0 || hour > 23
    || !Number.isInteger(minute) || minute < 0 || minute > 59
  ) return null;
  return date.getTime();
}

export function isTaskOverdue(task, now = Date.now()) {
  const currentTime = now instanceof Date ? now.getTime() : now;
  if (!task || task.done === true || task.archived === true || task.cancelled === true) return false;
  if (Number.isFinite(task.snoozedUntil) && task.snoozedUntil > currentTime) return false;
  const dueAt = taskDueAt(task);
  return dueAt !== null && dueAt < currentTime;
}

function compareByTime(first, second) {
  const firstDate = isValidDateKey(first.dateKey) ? first.dateKey : '\uffff';
  const secondDate = isValidDateKey(second.dateKey) ? second.dateKey : '\uffff';
  if (firstDate !== secondDate) return firstDate < secondDate ? -1 : 1;
  const firstMinutes = Number.isInteger(first.hour) && Number.isInteger(first.minute) ? first.hour * 60 + first.minute : Number.MAX_SAFE_INTEGER;
  const secondMinutes = Number.isInteger(second.hour) && Number.isInteger(second.minute) ? second.hour * 60 + second.minute : Number.MAX_SAFE_INTEGER;
  return firstMinutes - secondMinutes;
}

function compareByPriority(first, second) {
  const firstOrder = PRIORITY_ORDER[first.priority] ?? Number.MAX_SAFE_INTEGER;
  const secondOrder = PRIORITY_ORDER[second.priority] ?? Number.MAX_SAFE_INTEGER;
  return firstOrder - secondOrder;
}

function compareByCreated(first, second) {
  const firstCreated = Number.isFinite(first.createdAt) ? first.createdAt : 0;
  const secondCreated = Number.isFinite(second.createdAt) ? second.createdAt : 0;
  return secondCreated - firstCreated;
}

function compareByFocus(first, second, now) {
  const dueA = taskDueAt(first);
  const dueB = taskDueAt(second);
  const overdueA = isTaskOverdue(first, now);
  const overdueB = isTaskOverdue(second, now);
  if (Boolean(first.pinned) !== Boolean(second.pinned)) return first.pinned ? -1 : 1;
  if (overdueA !== overdueB) return overdueA ? -1 : 1;
  if (overdueA && overdueB && dueA !== dueB) return dueA - dueB;
  if (dueA !== null && dueB !== null && dueA !== dueB) return dueA - dueB;
  if (dueA !== null && dueB === null) return -1;
  if (dueA === null && dueB !== null) return 1;
  return compareByPriority(first, second);
}

export function selectAndSortTasks(tasks, options = {}) {
  const {
    query = '',
    filter = 'all',
    sort = 'time',
    dateKey,
    now = Date.now(),
  } = options;
  const normalizedQuery = String(query).trim().toLocaleLowerCase();
  const activeFilter = TASK_FILTERS.includes(filter) ? filter : 'all';
  const activeSort = TASK_SORTS.includes(sort) ? sort : 'time';

  return tasks.filter((task) => {
    if (!task || typeof task.title !== 'string') return false;
    if (activeFilter === 'archived' && task.archived !== true) return false;
    if (activeFilter === 'cancelled' && task.cancelled !== true) return false;
    if (activeFilter !== 'archived' && activeFilter !== 'cancelled' && (task.archived === true || task.cancelled === true)) return false;
    if (activeFilter === 'active' && task.done === true) return false;
    if (activeFilter === 'completed' && task.done !== true) return false;
    if (activeFilter === 'overdue' && !isTaskOverdue(task, now)) return false;
    if (activeFilter !== 'overdue' && dateKey && task.dateKey !== dateKey) return false;
    if (!normalizedQuery) return true;
    const title = task.title.toLocaleLowerCase();
    const description = typeof task.description === 'string' ? task.description.toLocaleLowerCase() : '';
    return title.includes(normalizedQuery) || description.includes(normalizedQuery);
  }).slice().sort((first, second) => {
    let comparison = 0;
    if (activeSort === 'focus') comparison = compareByFocus(first, second, now);
    else if (activeSort === 'priority') comparison = compareByPriority(first, second) || compareByTime(first, second);
    else if (activeSort === 'created') comparison = compareByCreated(first, second) || compareByTime(first, second);
    else comparison = compareByTime(first, second) || compareByPriority(first, second);
    return comparison || String(first.id || '').localeCompare(String(second.id || ''));
  });
}

export function formatTaskTime(task) {
  if (!Number.isInteger(task?.hour) || !Number.isInteger(task?.minute)) return '';
  return `${pad2(task.hour)}:${pad2(task.minute)}`;
}
