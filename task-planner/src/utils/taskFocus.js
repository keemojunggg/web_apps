import { isTaskOverdue, taskDueAt } from './taskManagement.js';

const PRIORITY_WEIGHT = { urgent: 12, scheduled: 8, relaxed: 4, slow: 0 };
const DAY_MS = 24 * 60 * 60 * 1000;
export const FOCUS_RECOMMENDATION_LIMIT = 3;

function reasonFor(task, now, dueAt, overdue) {
  if (task.pinned) return { code: 'pinned', label: 'ปักหมุดโดยคุณ' };
  if (overdue) return { code: 'overdue', label: 'เลยกำหนด' };
  if (dueAt !== null) {
    const remaining = dueAt - now;
    if (remaining <= 60 * 60 * 1000) return { code: 'due-soon', label: 'ครบกำหนดภายใน 1 ชั่วโมง' };
    if (remaining <= DAY_MS) return { code: 'due-today', label: 'ครบกำหนดภายในวันนี้' };
    return { code: 'upcoming', label: 'ใกล้ถึงกำหนด' };
  }
  return { code: 'priority', label: 'ความสำคัญที่คุณกำหนด' };
}

function score(task, now, dueAt, overdue) {
  if (task.pinned) return 10_000 + (dueAt === null ? 0 : Math.max(0, 100 - Math.floor(Math.abs(dueAt - now) / (60 * 60 * 1000))));
  const priority = PRIORITY_WEIGHT[task.priority] ?? 0;
  if (overdue && dueAt !== null) {
    const overdueDays = Math.max(0, Math.floor((now - dueAt) / DAY_MS));
    return 200 + Math.min(overdueDays, 30) + priority;
  }
  if (dueAt !== null) {
    const hours = Math.max(0, (dueAt - now) / (60 * 60 * 1000));
    return 150 - Math.min(hours, 36) + priority;
  }
  return 20 + priority;
}

export function recommendFocusTasks(tasks, { now = Date.now(), limit = FOCUS_RECOMMENDATION_LIMIT } = {}) {
  const currentTime = now instanceof Date ? now.getTime() : now;
  return tasks.flatMap((task) => {
    if (!task || task.done || task.archived || task.cancelled) return [];
    if (Number.isFinite(task.snoozedUntil) && task.snoozedUntil > currentTime) return [];
    const dueAt = taskDueAt(task);
    const overdue = isTaskOverdue(task, currentTime);
    if (!task.pinned && !overdue && (dueAt === null || dueAt - currentTime > 36 * 60 * 60 * 1000)) return [];
    return [{
      task,
      score: score(task, currentTime, dueAt, overdue),
      reason: reasonFor(task, currentTime, dueAt, overdue),
      overdue,
    }];
  }).sort((first, second) => second.score - first.score
    || (taskDueAt(first.task) ?? Number.MAX_SAFE_INTEGER) - (taskDueAt(second.task) ?? Number.MAX_SAFE_INTEGER)
    || String(first.task.id).localeCompare(String(second.task.id)))
    .slice(0, Math.max(0, limit));
}
