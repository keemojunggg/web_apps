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
  ({ ReportsView } = await viteServer.ssrLoadModule('/src/pages/ReportsPage.jsx'));
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
  assert.match(html, /à¹€à¸ªà¸£à¹‡à¸ˆ à¸“ à¹€à¸§à¸¥à¸²à¸ªà¸£à¸¸à¸› 1 à¸ˆà¸²à¸ 3 à¸‡à¸²à¸™à¸—à¸µà¹ˆà¸„à¸£à¸šà¸à¸³à¸«à¸™à¸”/);
  assert.match(html, /à¸šà¸±à¸™à¸—à¸¶à¸à¸à¸²à¸£à¹€à¸ªà¸£à¹‡à¸ˆà¸„à¸£à¸±à¹‰à¸‡à¹à¸£à¸ 1 à¸‡à¸²à¸™/);
  assert.match(html, /1 à¸‡à¸²à¸™à¸„à¸£à¸šà¸à¸³à¸«à¸™à¸”à¹ƒà¸™à¸Šà¹ˆà¸§à¸‡à¸™à¸µà¹‰à¸¢à¸±à¸‡à¹„à¸¡à¹ˆà¹€à¸ªà¸£à¹‡à¸ˆà¹à¸¥à¸°à¹€à¸¥à¸¢à¸à¸³à¸«à¸™à¸”/);
  assert.match(html, /à¹€à¸ªà¸£à¹‡à¸ˆ à¸“ à¹€à¸§à¸¥à¸²à¸ªà¸£à¸¸à¸›/);
  assert.match(html, /à¸¢à¸±à¸‡à¹„à¸¡à¹ˆà¹€à¸ªà¸£à¹‡à¸ˆ Â· à¹„à¸¡à¹ˆà¹€à¸¥à¸¢à¸à¸³à¸«à¸™à¸”/);
  assert.match(html, /à¸¢à¸±à¸‡à¹„à¸¡à¹ˆà¹€à¸ªà¸£à¹‡à¸ˆ Â· à¹€à¸¥à¸¢à¸à¸³à¸«à¸™à¸”/);
  assert.match(html, /stroke-dasharray=/);
  assert.match(html, />33%</);
  assert.match(html, />1 \/ 3</);
  assert.match(html, /Send the draft/);
  assert.match(html, /à¹€à¸›à¸´à¸”à¸‡à¸²à¸™|à¹€à¸›à¸´à¸”à¹à¸à¹‰à¹„à¸‚/);
  assert.match(html, /Morning Briefing/);
  assert.match(html, /Evening Review/);
  assert.match(html, /aria-label="à¸Šà¹ˆà¸§à¸‡à¹€à¸§à¸¥à¸²à¸£à¸²à¸¢à¸‡à¸²à¸™"/);
  assert.match(html, /aria-pressed="true"/);
  assert.doesNotMatch(html, /<details[^>]* open/);
  assert.match(html, /à¸›à¸£à¸°à¸§à¸±à¸•à¸´à¸„à¸£à¸šà¸•à¸±à¹‰à¸‡à¹à¸•à¹ˆ/);
  assert.match(html, new RegExp(`à¹€à¸‚à¸•à¹€à¸§à¸¥à¸²à¸—à¹‰à¸­à¸‡à¸–à¸´à¹ˆà¸™ ${Intl.DateTimeFormat().resolvedOptions().timeZone}`));
  assert.match(html, /Review weekly plan/);
});

test('Reports explains unavailable history and withholds historical numbers', async () => {
  const data = buildDailyReportData({
    date: new Date(2026, 9, 26),
    now: timestamp('2026-10-26', 12),
    history: { events: [], baselineCapturedAt: null, baselineSequence: null, historyComplete: false },
  });
  const html = await renderView(data);
  assert.match(html, /à¹„à¸¡à¹ˆà¸¡à¸µà¸›à¸£à¸°à¸§à¸±à¸•à¸´à¸—à¸µà¹ˆà¹€à¸žà¸µà¸¢à¸‡à¸žà¸­/);
  assert.match(html, /à¸‚à¹‰à¸­à¸¡à¸¹à¸¥à¸›à¸£à¸°à¸§à¸±à¸•à¸´à¹„à¸¡à¹ˆà¹€à¸žà¸µà¸¢à¸‡à¸žà¸­à¸ªà¸³à¸«à¸£à¸±à¸šà¸ªà¸£à¸¸à¸›à¸•à¸±à¸§à¹€à¸¥à¸‚/);
  assert.match(html, /à¹„à¸¡à¹ˆà¹à¸ªà¸”à¸‡à¸ªà¸±à¸”à¸ªà¹ˆà¸§à¸™ à¹€à¸žà¸£à¸²à¸°à¹„à¸¡à¹ˆà¸ªà¸²à¸¡à¸²à¸£à¸–à¸¢à¸·à¸™à¸¢à¸±à¸™à¸ˆà¸³à¸™à¸§à¸™à¸‡à¸²à¸™à¸„à¸£à¸šà¸à¸³à¸«à¸™à¸”à¹„à¸”à¹‰/);
  assert.match(html, /à¸ªà¸´à¹ˆà¸‡à¸—à¸µà¹ˆà¸„à¸§à¸£à¸—à¸³à¸•à¹ˆà¸­/);
});

test('Reports labels incomplete history and does not render partial counts as zero', async () => {
  const data = buildDailyReportData({
    date: new Date(2026, 9, 26),
    now: timestamp('2026-10-26', 12),
    history: { ...completeHistory, historyComplete: false },
  });
  const html = await renderView(data);
  assert.match(html, /à¸›à¸£à¸°à¸§à¸±à¸•à¸´à¸Šà¹ˆà¸§à¸‡à¸™à¸µà¹‰à¹„à¸¡à¹ˆà¸„à¸£à¸šà¸«à¸£à¸·à¸­à¸¢à¸·à¸™à¸¢à¸±à¸™à¸„à¸§à¸²à¸¡à¸„à¸£à¸šà¸–à¹‰à¸§à¸™à¹„à¸¡à¹ˆà¹„à¸”à¹‰/);
  assert.match(html, /à¹„à¸¡à¹ˆà¸ªà¸²à¸¡à¸²à¸£à¸–à¸¢à¸·à¸™à¸¢à¸±à¸™à¸ˆà¸³à¸™à¸§à¸™à¸‡à¸²à¸™à¸„à¸£à¸šà¸à¸³à¸«à¸™à¸”à¹„à¸”à¹‰/);
  assert.match(html, /à¸¢à¸±à¸‡à¸¢à¸·à¸™à¸¢à¸±à¸™à¸œà¸¥à¸¥à¸±à¸žà¸˜à¹Œà¸‚à¸­à¸‡à¸Šà¹ˆà¸§à¸‡à¸™à¸µà¹‰à¹„à¸¡à¹ˆà¹„à¸”à¹‰/);
  assert.match(html, /à¸ªà¸´à¹ˆà¸‡à¸—à¸µà¹ˆà¸„à¸§à¸£à¸—à¸³à¸•à¹ˆà¸­/);
});

test('Reports renders N\/A for empty complete periods without implying productivity', async () => {
  const data = buildDailyReportData({
    date: new Date(2026, 9, 26),
    now: timestamp('2026-10-26', 12),
    history: { ...completeHistory, events: [], baselineSequence: 0 },
  });
  const html = await renderView(data);
  assert.match(html, /à¹„à¸¡à¹ˆà¸¡à¸µà¸‡à¸²à¸™à¸­à¸¢à¸¹à¹ˆà¹ƒà¸™à¸à¸¥à¸¸à¹ˆà¸¡à¸‡à¸²à¸™à¸—à¸µà¹ˆà¸„à¸£à¸šà¸à¸³à¸«à¸™à¸”à¸‚à¸­à¸‡à¸Šà¹ˆà¸§à¸‡à¸™à¸µà¹‰/);
  assert.match(html, /à¸¢à¸±à¸‡à¹„à¸¡à¹ˆà¸¡à¸µà¸‡à¸²à¸™à¸—à¸µà¹ˆà¸šà¸±à¸™à¸—à¸¶à¸à¸§à¹ˆà¸²à¹€à¸ªà¸£à¹‡à¸ˆà¹ƒà¸™à¸Šà¹ˆà¸§à¸‡à¸™à¸µà¹‰/);
  assert.match(html, /à¹„à¸¡à¹ˆà¸¡à¸µà¸‡à¸²à¸™à¹€à¸›à¸´à¸”à¸ˆà¸²à¸à¸à¸¥à¸¸à¹ˆà¸¡à¸‡à¸²à¸™à¸—à¸µà¹ˆà¹€à¸¥à¸·à¸­à¸/);
});

test('Weekly Reports renders seven labeled days and a supported previous-week comparison', async () => {
  const data = buildWeeklyReportData({
    date: new Date(2026, 9, 26),
    now: timestamp('2026-11-09'),
    history: completeHistory,
  });
  const html = await renderView(data, { mode: 'week' });
  assert.match(html, /à¹à¸™à¸§à¹‚à¸™à¹‰à¸¡à¸£à¸²à¸¢à¸§à¸±à¸™/);
  assert.match(html, /à¸ªà¸±à¸›à¸”à¸²à¸«à¹Œà¸à¹ˆà¸­à¸™/);
  assert.equal((html.match(/role="row"/g) || []).length, 8);
  assert.match(html, /à¸§à¸²à¸‡à¹à¸œà¸™à¸•à¸²à¸¡à¸§à¸±à¸™à¸„à¸£à¸šà¸à¸³à¸«à¸™à¸”/);
  assert.match(html, /à¹€à¸ªà¸£à¹‡à¸ˆà¸„à¸£à¸±à¹‰à¸‡à¹à¸£à¸à¹ƒà¸™à¸§à¸±à¸™à¸™à¸±à¹‰à¸™/);
});

test('Monthly Reports renders daily trends, period rates, and current-month state', async () => {
  const data = buildMonthlyReportData({
    date: new Date(2026, 9, 26),
    now: timestamp('2026-10-26', 12),
    history: completeHistory,
  });
  const html = await renderView(data, { mode: 'month' });
  assert.match(html, /à¸£à¸²à¸¢à¸‡à¸²à¸™à¸›à¸£à¸°à¸ˆà¸³à¹€à¸”à¸·à¸­à¸™/);
  assert.match(html, /à¹à¸™à¸§à¹‚à¸™à¹‰à¸¡à¸£à¸²à¸¢à¸§à¸±à¸™/);
  assert.match(html, /Completion Rate/);
  assert.match(html, /On-time Rate/);
  assert.match(html, /à¸Šà¹ˆà¸§à¸‡à¹€à¸§à¸¥à¸²à¸›à¸±à¸ˆà¸ˆà¸¸à¸šà¸±à¸™à¸¢à¸±à¸‡à¹„à¸¡à¹ˆà¸ªà¸´à¹‰à¸™à¸ªà¸¸à¸”/);
  assert.match(html, /à¸§à¸±à¸™à¸—à¸µà¹ˆà¸—à¸³à¹„à¸”à¹‰à¸”à¸µà¸—à¸µà¹ˆà¸ªà¸¸à¸”/);
  assert.match(html, /à¸¢à¸±à¸‡à¹„à¸¡à¹ˆà¸–à¸¶à¸‡/);
  assert.match(html, /à¹€à¸”à¸·à¸­à¸™à¸à¹ˆà¸­à¸™à¸«à¸™à¹‰à¸²/);
  assert.match(html, /à¹€à¸”à¸·à¸­à¸™à¸–à¸±à¸”à¹„à¸›/);
  assert.match(html, /à¹€à¸”à¸·à¸­à¸™à¸™à¸µà¹‰/);
  assert.equal((html.match(/role="row"/g) || []).length, 32);
});

test('Monthly Reports explains unavailable history instead of rendering zero metrics', async () => {
  const data = buildMonthlyReportData({
    date: new Date(2026, 9, 26),
    now: timestamp('2026-10-26', 12),
    history: { events: [], baselineCapturedAt: null, baselineSequence: null, historyComplete: false },
  });
  const html = await renderView(data, { mode: 'month' });
  assert.match(html, /à¹„à¸¡à¹ˆà¸¡à¸µà¸›à¸£à¸°à¸§à¸±à¸•à¸´à¸—à¸µà¹ˆà¹€à¸žà¸µà¸¢à¸‡à¸žà¸­/);
  assert.match(html, /Completion Rate\s*<strong>â€”/);
  assert.match(html, /à¸›à¸£à¸°à¸§à¸±à¸•à¸´à¹„à¸¡à¹ˆà¸„à¸£à¸š/);
  assert.match(html, /à¸¢à¸±à¸‡à¹„à¸¡à¹ˆà¸ªà¸´à¹‰à¸™à¸ªà¸¸à¸”/);
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
  assert.match(html, /à¸£à¸²à¸¢à¸‡à¸²à¸™à¸›à¸£à¸°à¸ˆà¸³à¸›à¸µ/);
  assert.match(html, /à¹à¸™à¸§à¹‚à¸™à¹‰à¸¡à¸£à¸²à¸¢à¹€à¸”à¸·à¸­à¸™/);
  assert.match(html, /à¹€à¸”à¸·à¸­à¸™à¸—à¸µà¹ˆà¸—à¸³à¹„à¸”à¹‰à¸”à¸µà¸—à¸µà¹ˆà¸ªà¸¸à¸”/);
  assert.match(html, /à¸›à¸µà¸à¹ˆà¸­à¸™/);
  assert.match(html, /à¸›à¸µà¸à¹ˆà¸­à¸™à¸«à¸™à¹‰à¸²/);
  assert.match(html, /à¸›à¸µà¸–à¸±à¸”à¹„à¸›/);
  assert.match(html, /à¸›à¸µà¸™à¸µà¹‰/);
  assert.equal((html.match(/role="row"/g) || []).length, 13);
});

