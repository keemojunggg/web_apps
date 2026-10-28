function dateKey(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export function dueMorningBriefingDate(now, deliveryTime, lastShownDate = '') {
  if (!(now instanceof Date) || Number.isNaN(now.getTime())) return null;
  if (typeof deliveryTime !== 'string' || !/^([01]\d|2[0-3]):[0-5]\d$/.test(deliveryTime)) return null;

  const [hour, minute] = deliveryTime.split(':').map(Number);
  if (now.getHours() < hour || (now.getHours() === hour && now.getMinutes() < minute)) return null;

  const reportDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  reportDate.setDate(reportDate.getDate() - 1);
  const key = dateKey(reportDate);
  return key > lastShownDate ? key : null;
}

export function dateFromLocalKey(key) {
  if (typeof key !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(key)) return null;
  const [year, month, day] = key.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day ? date : null;
}
