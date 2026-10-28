import { MONTHS_TH_SHORT } from '../constants/calendar.js';

export const pad2 = (n) => String(n).padStart(2, '0');

export const toKey = (d) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;

export const addDays = (d, n) => {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
};

export const startOfDay = (d) => {
  const r = new Date(d);
  r.setHours(0, 0, 0, 0);
  return r;
};

export const formatShortDate = (dateKey) => {
  const [, m, d] = dateKey.split('-').map(Number);
  return `${d} ${MONTHS_TH_SHORT[m - 1]}`;
};

/** Returns a 6-week grid (array of 7-day arrays) covering the given month. */
export function getMonthMatrix(year, month) {
  const firstOfMonth = new Date(year, month, 1);
  const gridStart = addDays(firstOfMonth, -firstOfMonth.getDay());
  const weeks = [];
  let cursor = gridStart;
  for (let w = 0; w < 6; w++) {
    const week = [];
    for (let d = 0; d < 7; d++) {
      week.push(cursor);
      cursor = addDays(cursor, 1);
    }
    weeks.push(week);
  }
  return weeks;
}
