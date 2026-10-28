import { calculatePeriodMetrics, localReportDateRange } from './reportMetrics.js';

function dateKey(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function dateFromKey(key) {
  const [year, month, day] = key.split('-').map(Number);
  return new Date(year, month - 1, day);
}

function nextDateKey(key) {
  const date = dateFromKey(key);
  date.setDate(date.getDate() + 1);
  return dateKey(date);
}

function metricsFor(history, range, asOf) {
  return calculatePeriodMetrics({
    events: history.events,
    ...range,
    asOf,
    baselineCapturedAt: history.baselineCapturedAt,
    baselineSequence: history.baselineSequence,
    historyComplete: history.historyComplete,
  });
}

function previousPeriodRange(range, period) {
  const previousEnd = dateFromKey(range.startDate);
  if (period === 'month') previousEnd.setMonth(previousEnd.getMonth() - 1, 1);
  else previousEnd.setFullYear(previousEnd.getFullYear() - 1, 0, 1);
  return {
    startDate: dateKey(previousEnd),
    endDate: range.startDate,
  };
}

function buildBucketedReportData({ date, now, history, period, bucketPeriod }) {
  const range = localReportDateRange(date, period);
  const start = dateFromKey(range.startDate).getTime();
  if (start > now) throw new RangeError(`${period} reports cannot be selected for a future period`);
  const end = dateFromKey(range.endDate).getTime();
  const asOf = Math.min(now, end - 1);
  const metrics = metricsFor(history, range, asOf);
  const buckets = [];
  let bucketStart = dateFromKey(range.startDate);
  let index = 0;
  while (bucketStart < dateFromKey(range.endDate)) {
    const bucketRange = localReportDateRange(bucketStart, bucketPeriod);
    const bucketStartAt = dateFromKey(bucketRange.startDate).getTime();
    const future = bucketStartAt > now;
    buckets.push({
      startDate: bucketRange.startDate,
      endDate: bucketRange.endDate,
      metrics: future ? null : metricsFor(history, bucketRange, Math.min(now, dateFromKey(bucketRange.endDate).getTime() - 1)),
      future,
      index,
    });
    bucketStart = dateFromKey(bucketRange.endDate);
    index += 1;
  }

  let comparison = null;
  let comparisonReason = '';
  if (now < end) {
    comparisonReason = `ช่วง${period === 'month' ? 'เดือน' : 'ปี'}นี้ยังไม่สิ้นสุด จึงยังเปรียบเทียบกับช่วงเต็มก่อนไม่ได้`;
  } else {
    const previousRange = previousPeriodRange(range, period);
    const previousMetrics = metricsFor(history, previousRange, dateFromKey(previousRange.endDate).getTime() - 1);
    if (metrics.coverage.status === 'complete' && previousMetrics.coverage.status === 'complete') {
      comparison = previousMetrics;
    } else {
      comparisonReason = `ข้อมูลย้อนหลังยังไม่ครอบคลุมทั้งสอง${period === 'month' ? 'เดือน' : 'ปี'} จึงไม่แสดงการเปรียบเทียบ`;
    }
  }

  return {
    mode: period,
    range,
    metrics,
    buckets,
    comparison,
    comparisonReason,
    periodClosed: now >= end,
  };
}

export function buildDailyReportData({ date, now = Date.now(), history }) {
  const range = localReportDateRange(date, 'day');
  const start = dateFromKey(range.startDate).getTime();
  if (start > now) throw new RangeError('Daily reports cannot be selected for a future date');
  const end = dateFromKey(range.endDate).getTime();
  const asOf = Math.min(now, end - 1);
  return {
    mode: 'day',
    range,
    metrics: metricsFor(history, range, asOf),
  };
}

export function buildMonthlyReportData({ date, now = Date.now(), history }) {
  return buildBucketedReportData({ date, now, history, period: 'month', bucketPeriod: 'day' });
}

export function buildYearlyReportData({ date, now = Date.now(), history }) {
  return buildBucketedReportData({ date, now, history, period: 'year', bucketPeriod: 'month' });
}

export function buildWeeklyReportData({ date, now = Date.now(), history }) {
  const range = localReportDateRange(date, 'week');
  const start = dateFromKey(range.startDate).getTime();
  if (start > now) throw new RangeError('Weekly reports cannot be selected for a future week');
  const end = dateFromKey(range.endDate).getTime();
  const asOf = Math.min(now, end - 1);
  const metrics = metricsFor(history, range, asOf);
  const days = Array.from({ length: 7 }, (_, index) => {
    const dayStart = dateFromKey(range.startDate);
    dayStart.setDate(dayStart.getDate() + index);
    const startDate = dateKey(dayStart);
    const endDate = nextDateKey(startDate);
    const dayStartAt = dayStart.getTime();
    if (dayStartAt > now) return { startDate, endDate, metrics: null, future: true };
    const dayEndAt = dateFromKey(endDate).getTime();
    return {
      startDate,
      endDate,
      metrics: metricsFor(history, { startDate, endDate }, Math.min(now, dayEndAt - 1)),
      future: false,
    };
  });

  let comparison = null;
  let comparisonReason = '';
  if (now < end) {
    comparisonReason = 'สัปดาห์นี้ยังไม่สิ้นสุด จึงยังเปรียบเทียบกับสัปดาห์เต็มก่อนไม่ได้';
  } else {
    const previousEnd = range.startDate;
    const previousStartDate = dateFromKey(previousEnd);
    previousStartDate.setDate(previousStartDate.getDate() - 7);
    const previousStart = dateKey(previousStartDate);
    const previousRange = { startDate: previousStart, endDate: previousEnd };
    const previousMetrics = metricsFor(history, previousRange, dateFromKey(previousEnd).getTime() - 1);
    if (metrics.coverage.status === 'complete' && previousMetrics.coverage.status === 'complete') {
      comparison = previousMetrics;
    } else {
      comparisonReason = 'ข้อมูลย้อนหลังยังไม่ครอบคลุมทั้งสองสัปดาห์ จึงไม่แสดงการเปรียบเทียบ';
    }
  }

  return {
    mode: 'week',
    range,
    metrics,
    days,
    comparison,
    comparisonReason,
  };
}
