import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createServer } from 'vite';
import {
  buildDailyReportData,
  buildMonthlyReportData,
  buildWeeklyReportData,
  buildYearlyReportData,
} from './reportData.js';

let viteServer;
let ReportsView;

async function loadReportsView() {
  if (ReportsView) return ReportsView;
  viteServer = await createServer({
    configFile: 'vite.config.js',
    server: { middlewareMode: true, hmr: false },
    appType: 'custom',
  });
  ({ ReportsView } = await viteServer.ssrLoadModule('/task-planner/src/pages/ReportsPage.jsx'));
  return ReportsView;
}

after(async () => {
  await viteServer?.close();
});

const timestamp = (key, hour = 0, minute = 0) => {
  const [year, month, day] = key.split('-').map(Number);
  return new Date(year, month - 1, day, hour, minute).getTime();
};

const snapshot = (dueDate, fields = {}) => ({
  dueDate,
  dueHour: 9,
  dueMinute: 0,
  priority: 'scheduled',
  repeat: 'none',
  done: false,
  archived: false,
  cancelled: false,
  snoozedUntil: null,
  deleted: false,
  ...fields,
});

const baseline = {
  id: 'render-baseline',
  taskId: 'render-task',
  occurrenceId: 'render-task',
  type: 'baseline-captured',
  eventVersion: 1,
  occurredAt: timestamp('2026-10-01'),
  capturedAt: timestamp('2026-10-01'),
  sequence: 1,
  snapshot: snapshot('2026-10-26'),
};

const completionAt = timestamp('2026-10-26', 8);
const completed = {
  id: 'render-completed',
  taskId: 'render-task',
  occurrenceId: 'render-task',
  type: 'completed',
  eventVersion: 1,
  occurredAt: completionAt,
  completedAt: completionAt,
  sequence: 4,
  snapshot: snapshot('2026-10-26', { done: true }),
};

const remainingTask = {
  id: 'render-remaining',
  taskId: 'render-remaining',
  occurrenceId: 'render-remaining',
  type: 'baseline-captured',
  eventVersion: 1,
  occurredAt: timestamp('2026-10-01'),
  capturedAt: timestamp('2026-10-01'),
  sequence: 2,
  snapshot: snapshot('2026-10-26', { dueHour: 18 }),
};

const overdueTask = {
  id: 'render-overdue',
  taskId: 'render-overdue',
  occurrenceId: 'render-overdue',
  type: 'baseline-captured',
  eventVersion: 1,
  occurredAt: timestamp('2026-10-01'),
  capturedAt: timestamp('2026-10-01'),
  sequence: 3,
  snapshot: snapshot('2026-10-26', { dueHour: 9 }),
};

const completeHistory = {
  events: [baseline, remainingTask, overdueTask, completed],
  baselineCapturedAt: timestamp('2026-10-01'),
  baselineSequence: 3,
  historyComplete: true,
};

function renderView(reportData, { mode = 'day', tasks = [] } = {}) {
  return loadReportsView().then((Component) => renderToStaticMarkup(createElement(Component, {
    mode,
    setMode() {},
    reportDate: new Date(2026, 9, 26),
    setReportDate() {},
    today: new Date(2026, 9, 26, 12),
    reportData,
    historyError: '',
    tasks,
    onEdit() {},
    theme: 'light',
    setTheme() {},
    setPage() {},
    profileName: 'Test',
  })));
}

test('Reports shows positive and attention insights with a reconciled, labeled status donut', async () => {
  const data = buildDailyReportData({
    date: new Date(2026, 9, 26),
    now: timestamp('2026-10-26', 12),
    history: completeHistory,
  });
  const html = await renderView(data, {
    tasks: [
      { id: 'render-task', title: 'Review weekly plan', dateKey: '2026-10-26', hour: 9, minute: 0, done: true },
      { id: 'render-remaining', title: 'Prepare notes', dateKey: '2026-10-26', hour: 18, minute: 0, priority: 'scheduled' },
      { id: 'render-overdue', title: 'Send the draft', dateKey: '2026-10-26', hour: 9, minute: 0, priority: 'urgent' },
    ],
  });
  assert.deepEqual(data.metrics.statusBreakdown, {
    completed: { value: 1, status: 'complete' },
    notCompletedNotOverdue: { value: 1, status: 'complete' },
    notCompletedOverdue: { value: 1, status: 'complete' },
    total: { value: 3, status: 'complete' },
  });
  assert.match(html, /เสร็จ ณ เวลาสรุป 1 จาก 3 งานที่ครบกำหนด/);
  assert.match(html, /บันทึกการเสร็จครั้งแรก 1 งาน/);
  assert.match(html, /1 งานครบกำหนดในช่วงนี้ยังไม่เสร็จและเลยกำหนด/);
  assert.match(html, /เสร็จ ณ เวลาสรุป/);
  assert.match(html, /ยังไม่เสร็จ · ไม่เลยกำหนด/);
  assert.match(html, /ยังไม่เสร็จ · เลยกำหนด/);
  assert.match(html, /stroke-dasharray=/);
  assert.match(html, />33%</);
  assert.match(html, />1 \/ 3</);
  assert.match(html, /Send the draft/);
  assert.match(html, /เปิดงาน|เปิดแก้ไข/);
  assert.match(html, /Morning Briefing/);
  assert.match(html, /Evening Review/);
  assert.match(html, /aria-label="ช่วงเวลารายงาน"/);
  assert.match(html, /aria-pressed="true"/);
  assert.doesNotMatch(html, /<details[^>]* open/);
  assert.match(html, /ประวัติครบตั้งแต่/);
  assert.match(html, new RegExp(`เขตเวลาท้องถิ่น ${Intl.DateTimeFormat().resolvedOptions().timeZone}`));
  assert.match(html, /Review weekly plan/);
});

test('Reports explains unavailable history and withholds historical numbers', async () => {
  const data = buildDailyReportData({
    date: new Date(2026, 9, 26),
    now: timestamp('2026-10-26', 12),
    history: { events: [], baselineCapturedAt: null, baselineSequence: null, historyComplete: false },
  });
  const html = await renderView(data);
  assert.match(html, /ไม่มีประวัติที่เพียงพอ/);
  assert.match(html, /ข้อมูลประวัติไม่เพียงพอสำหรับสรุปตัวเลข/);
  assert.match(html, /ไม่แสดงสัดส่วน เพราะไม่สามารถยืนยันจำนวนงานครบกำหนดได้/);
  assert.match(html, /สิ่งที่ควรทำต่อ/);
});

test('Reports labels incomplete history and does not render partial counts as zero', async () => {
  const data = buildDailyReportData({
    date: new Date(2026, 9, 26),
    now: timestamp('2026-10-26', 12),
    history: { ...completeHistory, historyComplete: false },
  });
  const html = await renderView(data);
  assert.match(html, /ประวัติช่วงนี้ไม่ครบหรือยืนยันความครบถ้วนไม่ได้/);
  assert.match(html, /ไม่สามารถยืนยันจำนวนงานครบกำหนดได้/);
  assert.match(html, /ยังยืนยันผลลัพธ์ของช่วงนี้ไม่ได้/);
  assert.match(html, /สิ่งที่ควรทำต่อ/);
});

test('Reports renders N\/A for empty complete periods without implying productivity', async () => {
  const data = buildDailyReportData({
    date: new Date(2026, 9, 26),
    now: timestamp('2026-10-26', 12),
    history: { ...completeHistory, events: [], baselineSequence: 0 },
  });
  const html = await renderView(data);
  assert.match(html, /ไม่มีงานอยู่ในกลุ่มงานที่ครบกำหนดของช่วงนี้/);
  assert.match(html, /ยังไม่มีงานที่บันทึกว่าเสร็จในช่วงนี้/);
  assert.match(html, /ไม่มีงานเปิดจากกลุ่มงานที่เลือก/);
});

test('Weekly Reports renders seven labeled days and a supported previous-week comparison', async () => {
  const data = buildWeeklyReportData({
    date: new Date(2026, 9, 26),
    now: timestamp('2026-11-09'),
    history: completeHistory,
  });
  const html = await renderView(data, { mode: 'week' });
  assert.match(html, /แนวโน้มรายวัน/);
  assert.match(html, /สัปดาห์ก่อน/);
  assert.equal((html.match(/role="row"/g) || []).length, 8);
  assert.match(html, /วางแผนตามวันครบกำหนด/);
  assert.match(html, /เสร็จครั้งแรกในวันนั้น/);
});

test('Monthly Reports renders daily trends, period rates, and current-month state', async () => {
  const data = buildMonthlyReportData({
    date: new Date(2026, 9, 26),
    now: timestamp('2026-10-26', 12),
    history: completeHistory,
  });
  const html = await renderView(data, { mode: 'month' });
  assert.match(html, /รายงานประจำเดือน/);
  assert.match(html, /แนวโน้มรายวัน/);
  assert.match(html, /Completion Rate/);
  assert.match(html, /On-time Rate/);
  assert.match(html, /ช่วงเวลาปัจจุบันยังไม่สิ้นสุด/);
  assert.match(html, /วันที่ทำได้ดีที่สุด/);
  assert.match(html, /ยังไม่ถึง/);
  assert.match(html, /เดือนก่อนหน้า/);
  assert.match(html, /เดือนถัดไป/);
  assert.match(html, /เดือนนี้/);
  assert.equal((html.match(/role="row"/g) || []).length, 32);
});

test('Monthly Reports explains unavailable history instead of rendering zero metrics', async () => {
  const data = buildMonthlyReportData({
    date: new Date(2026, 9, 26),
    now: timestamp('2026-10-26', 12),
    history: { events: [], baselineCapturedAt: null, baselineSequence: null, historyComplete: false },
  });
  const html = await renderView(data, { mode: 'month' });
  assert.match(html, /ไม่มีประวัติที่เพียงพอ/);
  assert.match(html, /Completion Rate\s*<strong>—/);
  assert.match(html, /ประวัติไม่ครบ/);
  assert.match(html, /ยังไม่สิ้นสุด/);
});

test('Yearly Reports renders readable monthly trends and a valid previous-year comparison', async () => {
  const capturedAt = timestamp('2020-01-01');
  const yearlyHistory = {
    events: [
      {
        id: 'year-baseline',
        taskId: 'year-task',
        occurrenceId: 'year-task',
        type: 'baseline-captured',
        eventVersion: 1,
        occurredAt: capturedAt,
        capturedAt,
        sequence: 1,
        snapshot: snapshot('2025-10-26'),
      },
      {
        id: 'year-completed',
        taskId: 'year-task',
        occurrenceId: 'year-task',
        type: 'completed',
        eventVersion: 1,
        occurredAt: timestamp('2025-10-26', 8),
        completedAt: timestamp('2025-10-26', 8),
        sequence: 2,
        snapshot: snapshot('2025-10-26', { done: true }),
      },
    ],
    baselineCapturedAt: capturedAt,
    baselineSequence: 1,
    historyComplete: true,
  };
  const data = buildYearlyReportData({
    date: new Date(2025, 6, 1),
    now: timestamp('2026-01-01'),
    history: yearlyHistory,
  });
  const html = await renderView(data, { mode: 'year' });
  assert.match(html, /รายงานประจำปี/);
  assert.match(html, /แนวโน้มรายเดือน/);
  assert.match(html, /เดือนที่ทำได้ดีที่สุด/);
  assert.match(html, /ปีก่อน/);
  assert.match(html, /ปีก่อนหน้า/);
  assert.match(html, /ปีถัดไป/);
  assert.match(html, /ปีนี้/);
  assert.equal((html.match(/role="row"/g) || []).length, 13);
});
