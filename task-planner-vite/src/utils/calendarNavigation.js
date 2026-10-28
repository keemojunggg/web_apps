import { startOfDay } from './dateUtils.js';

export function moveCalendarDate(selectedDate, view, direction) {
  const next = startOfDay(selectedDate);
  if (view === 'month') {
    const targetMonth = new Date(next.getFullYear(), next.getMonth() + direction, 1);
    const lastDay = new Date(targetMonth.getFullYear(), targetMonth.getMonth() + 1, 0).getDate();
    return new Date(targetMonth.getFullYear(), targetMonth.getMonth(), Math.min(next.getDate(), lastDay));
  }
  next.setDate(next.getDate() + direction * (view === 'week' ? 7 : 1));
  return next;
}
