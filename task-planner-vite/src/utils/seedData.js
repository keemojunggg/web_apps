import { toKey, addDays, startOfDay } from './dateUtils.js';

/** A handful of example tasks so every page has something to show on first load. */
export function buildSeedTasks() {
  const today = startOfDay(new Date());
  return [
    { id: 's1', title: 'ประชุมทีมโปรเจกต์', dateKey: toKey(today), hour: 9, minute: 0, priority: 'urgent', repeat: 'none', notify: true, done: false },
    { id: 's2', title: 'ส่งการบ้านวิชาสถิติ', dateKey: toKey(today), hour: 23, minute: 59, priority: 'scheduled', repeat: 'none', notify: true, done: false },
    { id: 's3', title: 'ออกกำลังกาย', dateKey: toKey(today), hour: 18, minute: 30, priority: 'relaxed', repeat: 'daily', notify: false, done: true },
    { id: 's4', title: 'อ่านหนังสือก่อนนอน', dateKey: toKey(today), hour: 21, minute: 0, priority: 'slow', repeat: 'daily', notify: false, done: false },
    { id: 's5', title: 'นัดหมอฟัน', dateKey: toKey(addDays(today, 2)), hour: 10, minute: 30, priority: 'urgent', repeat: 'none', notify: true, done: false },
    { id: 's6', title: 'จ่ายค่าเช่าหอ', dateKey: toKey(addDays(today, 4)), hour: 12, minute: 0, priority: 'scheduled', repeat: 'monthly', notify: true, done: false },
    { id: 's7', title: 'ประชุมกลุ่มวิชาโปรเจกต์จบ', dateKey: toKey(addDays(today, 4)), hour: 14, minute: 0, priority: 'urgent', repeat: 'none', notify: true, done: false },
    { id: 's8', title: 'ซื้อของเข้าบ้าน', dateKey: toKey(addDays(today, 7)), hour: 17, minute: 0, priority: 'relaxed', repeat: 'none', notify: false, done: false },
  ];
}
