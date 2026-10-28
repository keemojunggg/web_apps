import { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle, BarChart3, CalendarDays, CheckCircle2, ChevronLeft, ChevronRight,
  Sparkles,
} from 'lucide-react';
import HeaderBar from '../components/HeaderBar';
import { PRIORITY_ORDER } from '../constants/priorities';
import { isTaskOverdue, taskDueAt } from '../utils/taskManagement';
import { recommendFocusTasks } from '../utils/taskFocus';
import { loadTaskHistory } from '../utils/taskStorage';
import {
  buildDailyReportData,
  buildMonthlyReportData,
  buildWeeklyReportData,
  buildYearlyReportData,
} from '../utils/reportData';
import { dateFromLocalKey } from '../utils/morningBriefing';

const localKey = (date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
const localDate = (key) => {
  const [year, month, day] = key.split('-').map(Number);
  return new Date(year, month - 1, day);
};
const previousLocalDateKey = (key) => {
  const date = localDate(key);
  date.setDate(date.getDate() - 1);
  return localKey(date);
};
const dateLabel = (key, options = { day: 'numeric', month: 'short', year: 'numeric' }) =>
  new Intl.DateTimeFormat('th-TH-u-ca-gregory', options).format(localDate(key));
const periodLabel = (mode) => ({ day: 'วัน', week: 'สัปดาห์', month: 'เดือน', year: 'ปี' })[mode] || 'ช่วง';

function formatCount(metric) {
  return metric?.status === 'complete' && Number.isFinite(metric.value) ? metric.value.toLocaleString('th-TH') : '—';
}

function formatRate(metric) {
  if (metric?.status !== 'complete') return '—';
  if (!metric.denominator) return 'N/A';
  return `${Math.round(metric.value * 100)}%`;
}

function coverageMessage(coverage, timezone) {
  let message = '';
  if (coverage.status === 'partial') message = 'ช่วงเวลานี้ทับซ้อนกับจุดเริ่มเก็บประวัติ จึงยังแสดงตัวเลขที่เชื่อถือได้ไม่ได้';
  else if (coverage.status === 'unavailable') message = 'ไม่มีประวัติที่เพียงพอสำหรับช่วงเวลานี้ ตัวเลขไม่ได้ถูกแทนด้วยศูนย์';
  else if (coverage.status === 'incomplete') message = 'ประวัติช่วงนี้ไม่ครบหรือยืนยันความครบถ้วนไม่ได้ จึงระงับตัวเลขเพื่อไม่ให้สรุปผิด';
  else {
    const captured = coverage.baselineCapturedAt
      ? new Intl.DateTimeFormat('th-TH-u-ca-gregory', { dateStyle: 'medium' }).format(coverage.baselineCapturedAt)
      : '';
    message = `ประวัติครบตั้งแต่ ${captured} ในเบราว์เซอร์นี้ · ไม่รวมงานที่เพิ่มหลังช่วงรายงาน`;
  }
  return `${message} · เขตเวลาท้องถิ่น ${timezone || Intl.DateTimeFormat().resolvedOptions().timeZone}`;
}

function CoverageNote({ coverage, timezone }) {
  const complete = coverage.status === 'complete';
  return (
    <aside className={`tp-report-coverage ${complete ? 'is-complete' : 'is-incomplete'}`} role="note">
      {complete ? <CheckCircle2 size={17} aria-hidden="true" /> : <AlertTriangle size={17} aria-hidden="true" />}
      <span>{coverageMessage(coverage, timezone)}</span>
    </aside>
  );
}

function TaskStatusDonut({ metrics }) {
  const breakdown = metrics.statusBreakdown;
  const complete = breakdown.total.status === 'complete';
  const total = complete ? breakdown.total.value : null;
  const segments = [
    { key: 'completed', label: 'เสร็จ ณ เวลาสรุป', value: breakdown.completed.value, className: 'is-completed' },
    { key: 'remaining', label: 'ยังไม่เสร็จ · ไม่เลยกำหนด', value: breakdown.notCompletedNotOverdue.value, className: 'is-remaining' },
    { key: 'overdue', label: 'ยังไม่เสร็จ · เลยกำหนด', value: breakdown.notCompletedOverdue.value, className: 'is-overdue' },
  ];
  const radius = 39;
  const circumference = 2 * Math.PI * radius;
  const rate = total > 0 ? formatRate(metrics.completionRate) : 'N/A';
  const completedCount = total > 0 ? `${breakdown.completed.value} / ${total}` : '0 / 0';
  let offset = 0;

  return (
    <section className="tp-report-status-card" aria-labelledby="tp-report-status-title">
      <h3 id="tp-report-status-title">สถานะงานตามกำหนดในช่วงนี้</h3>
      {complete && total === 0 ? (
        <div className="tp-report-donut-empty">
          <div className="tp-report-donut" role="img" aria-label="ไม่มีงานครบกำหนดในช่วงนี้"><span>0<small>งาน</small></span></div>
          <p>ไม่มีงานอยู่ในกลุ่มงานที่ครบกำหนดของช่วงนี้</p>
        </div>
      ) : complete ? (
        <div className="tp-report-donut-layout">
          <svg className="tp-report-donut" viewBox="0 0 100 100" role="img" aria-labelledby="tp-report-donut-title tp-report-donut-description">
            <title id="tp-report-donut-title">สัดส่วนสถานะงาน</title>
            <desc id="tp-report-donut-description">{segments.map((segment) => `${segment.label} ${segment.value} งาน`).join(' · ')}</desc>
            <circle className="tp-report-donut-track" cx="50" cy="50" r={radius} />
            {segments.map((segment) => {
              const length = (segment.value / total) * circumference;
              const currentOffset = offset;
              offset += length;
              return segment.value > 0 ? (
                <circle
                  key={segment.key}
                  className={`tp-report-donut-segment ${segment.className}`}
                  cx="50"
                  cy="50"
                  r={radius}
                  strokeDasharray={`${length} ${circumference - length}`}
                  strokeDashoffset={-currentOffset}
                />
              ) : null;
            })}
            <text className="tp-report-donut-rate" x="50" y="42" textAnchor="middle">{rate}</text>
            <text className="tp-report-donut-count" x="50" y="57" textAnchor="middle">{completedCount}</text>
            <text className="tp-report-donut-caption" x="50" y="68" textAnchor="middle">เสร็จ / ทั้งหมด</text>
          </svg>
          <ul className="tp-report-status-legend">
            {segments.map((segment) => (
              <li key={segment.key} className={segment.className}>
                <i aria-hidden="true" />
                <span>{segment.label}</span>
                <strong>{segment.value}</strong>
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <div className="tp-report-donut-layout is-unavailable">
          <div className="tp-report-donut" role="img" aria-label="กราฟวงแหวนไม่พร้อม เพราะข้อมูลประวัติไม่ครบ">
            <span>—<small>ข้อมูล</small></span>
          </div>
          <p>ไม่แสดงสัดส่วน เพราะไม่สามารถยืนยันจำนวนงานครบกำหนดได้</p>
        </div>
      )}
      {complete && total > 0 && <p className="tp-report-cohort-note">นับเฉพาะงานที่ครบกำหนดในช่วงที่เลือก รวมงานที่เพิ่มระหว่างช่วง และนับงานเกิดซ้ำแยกตาม occurrence</p>}
    </section>
  );
}

function TaskSummaryList({ title, items, tasksById, emptyLabel, onEdit, emptyHint }) {
  return (
    <section className="tp-report-list-panel">
      <h3>{title} <span>{items.length}</span></h3>
      {items.length ? (
        <ul className="tp-report-task-list">
          {items.slice(0, 5).map((occurrence) => {
            const task = tasksById.get(occurrence.occurrenceId);
            const scheduleChanged = task && taskDueAt(task) !== occurrence.dueAt;
            return (
              <li key={occurrence.occurrenceId}>
                <span className="tp-report-task-mark" aria-hidden="true" />
                <div className="tp-report-task-copy">
                  <strong>{task?.title || (occurrence.deleted ? 'งานที่ถูกลบ' : 'งานที่ไม่มีในรายการปัจจุบัน')}</strong>
                  <small>
                    {occurrence.dueAt ? `กำหนด ${new Intl.DateTimeFormat('th-TH-u-ca-gregory', { dateStyle: 'short', timeStyle: 'short' }).format(occurrence.dueAt)}` : 'ไม่มีกำหนด'}
                    {occurrence.seriesId ? ' · งานที่เกิดซ้ำ' : ''}
                    {occurrence.cancelled ? ' · ยกเลิกภายหลัง' : ''}
                    {occurrence.archived ? ' · เก็บถาวร' : ''}
                    {task?.done ? ' · เสร็จแล้วในปัจจุบัน' : ''}
                    {scheduleChanged ? ' · กำหนดปัจจุบันเปลี่ยนแล้ว' : ''}
                  </small>
                </div>
                {task && !task.done && !task.archived && !task.cancelled && onEdit
                  && <button type="button" className="tp-report-edit" onClick={() => onEdit(task)}>แก้ไข</button>}
              </li>
            );
          })}
        </ul>
      ) : <p className="tp-report-empty">{emptyLabel}{emptyHint ? ` ${emptyHint}` : ''}</p>}
      {items.length > 5 && <p className="tp-report-more">แสดง 5 จาก {items.length} งาน</p>}
    </section>
  );
}

function TodayBriefing({ tasks, now, onEdit }) {
  const todayKey = localKey(new Date(now));
  const activeTasks = tasks.filter((task) => !task.done && !task.archived && !task.cancelled);
  const todayTasks = activeTasks.filter((task) => task.dateKey === todayKey)
    .sort((first, second) => (PRIORITY_ORDER[first.priority] ?? 99) - (PRIORITY_ORDER[second.priority] ?? 99)
      || (taskDueAt(first) ?? Number.MAX_SAFE_INTEGER) - (taskDueAt(second) ?? Number.MAX_SAFE_INTEGER));
  const overdueTasks = activeTasks.filter((task) => isTaskOverdue(task, now))
    .sort((first, second) => (taskDueAt(first) ?? Number.MAX_SAFE_INTEGER) - (taskDueAt(second) ?? Number.MAX_SAFE_INTEGER));
  const suggestions = recommendFocusTasks(activeTasks, { now, limit: 3 });

  const taskLine = (task, reason) => (
    <li key={task.id}>
      <div className="tp-report-task-copy">
        <strong>{task.title}</strong>
        <small>{reason || `${String(task.hour).padStart(2, '0')}:${String(task.minute).padStart(2, '0')} น.`}</small>
      </div>
      <button type="button" className="tp-report-edit" onClick={() => onEdit(task)}>เปิดแก้ไข</button>
    </li>
  );

  return (
    <details className="tp-report-disclosure tp-report-briefing">
      <summary>
        <span className="tp-report-section-icon"><Sparkles size={17} aria-hidden="true" /></span>
        <span className="tp-report-disclosure-copy"><strong>Morning Briefing</strong><small>{dateLabel(todayKey, { weekday: 'long', day: 'numeric', month: 'long' })} · {overdueTasks.length} งานเลยกำหนด · {todayTasks.length} งานวันนี้</small></span>
        <span className="tp-report-disclosure-hint">ดูแผนวันนี้</span>
      </summary>
      <div className="tp-report-briefing-grid">
        <section className="tp-report-list-panel">
          <h3>งานเลยกำหนด <span>{overdueTasks.length}</span></h3>
          {overdueTasks.length
            ? <ul className="tp-report-task-list">{overdueTasks.slice(0, 4).map((task) => taskLine(task, 'ต้องติดตาม'))}</ul>
            : <p className="tp-report-empty">ไม่มีงานเลยกำหนด</p>}
          {overdueTasks.length > 4 && <p className="tp-report-more">แสดง 4 จาก {overdueTasks.length} งาน</p>}
        </section>
        <section className="tp-report-list-panel">
          <h3>งานที่ครบกำหนดวันนี้ <span>{todayTasks.length}</span></h3>
          {todayTasks.length
            ? <ul className="tp-report-task-list">{todayTasks.slice(0, 4).map((task) => taskLine(task))}</ul>
            : <p className="tp-report-empty">ไม่มีงานที่ครบกำหนดวันนี้</p>}
          {todayTasks.length > 4 && <p className="tp-report-more">แสดง 4 จาก {todayTasks.length} งาน</p>}
        </section>
        <section className="tp-report-list-panel">
          <h3>แนะนำให้เริ่มจาก <span>{suggestions.length}</span></h3>
          {suggestions.length
            ? <ul className="tp-report-task-list">{suggestions.map(({ task, reason }) => taskLine(task, reason.label))}</ul>
            : <p className="tp-report-empty">ยังไม่มีงานใกล้กำหนดหรือปักหมุดไว้</p>}
        </section>
      </div>
    </details>
  );
}

function AtGlanceDashboard({ data, mode, tasks, now, onEdit }) {
  const { metrics } = data;
  const reliable = metrics.coverage.status === 'complete';
  const breakdown = metrics.statusBreakdown;
  const completed = breakdown.completed.value;
  const remaining = breakdown.notCompletedNotOverdue.value;
  const overdue = breakdown.notCompletedOverdue.value;
  const planned = breakdown.total.value;
  const tasksById = new Map(tasks.map((task) => [task.id, task]));
  const attentionTasks = reliable
    ? metrics.occurrences
      .filter((occurrence) => occurrence.planned && !occurrence.doneAtCutoff)
      .map((occurrence) => ({ occurrence, task: tasksById.get(occurrence.occurrenceId) }))
      .filter(({ task }) => task && !task.done && !task.archived && !task.cancelled)
      .sort((first, second) => Number(isTaskOverdue(second.task, now)) - Number(isTaskOverdue(first.task, now))
        || (PRIORITY_ORDER[first.task.priority] ?? 99) - (PRIORITY_ORDER[second.task.priority] ?? 99)
        || (taskDueAt(first.task) ?? Number.MAX_SAFE_INTEGER) - (taskDueAt(second.task) ?? Number.MAX_SAFE_INTEGER))
    : [];
  const onTimeCount = metrics.onTimeRate.status === 'complete' ? metrics.onTimeRate.numerator : null;

  let summary = 'ข้อมูลประวัติไม่เพียงพอสำหรับสรุปตัวเลขของช่วงนี้';
  if (reliable && planned === 0) summary = 'ไม่มีงานครบกำหนดในช่วงที่เลือก';
  else if (reliable) {
    summary = `เสร็จ ณ เวลาสรุป ${completed} จาก ${planned} งานที่ครบกำหนด`;
    if (overdue > 0) summary += ` · ${overdue} งานเลยกำหนดยังไม่เสร็จ`;
    else if (remaining > 0) summary += ` · ยังเหลือ ${remaining} งานที่ไม่เลยกำหนด`;
    else summary += ' · ไม่มีงานตามกำหนดค้างอยู่';
  }

  const positiveInsights = [];
  const attentionInsights = [];
  if (!reliable) {
    positiveInsights.push('ยังยืนยันผลลัพธ์ของช่วงนี้ไม่ได้');
    attentionInsights.push('ตัวเลขและรายการย้อนหลังถูกระงับจนกว่าประวัติจะครบ');
  } else {
    if (metrics.completionTrend.value > 0) {
      positiveInsights.push(`บันทึกการเสร็จครั้งแรก ${metrics.completionTrend.value} งานในช่วงนี้`);
    }
    if (onTimeCount > 0) positiveInsights.push(`${onTimeCount} งานเสร็จตรงเวลาตาม due time ที่บันทึกไว้`);
    if (data.comparison) {
      const priorCompleted = data.comparison.plannedVsCompleted.completed.value;
      const priorOverdue = data.comparison.overdueTasks.value;
      const currentCompleted = metrics.plannedVsCompleted.completed.value;
      const comparisonScope = ({ week: 'สัปดาห์', month: 'เดือน', year: 'ปี' })[mode] || 'ช่วง';
      if (currentCompleted > priorCompleted) positiveInsights.push(`งานเสร็จเพิ่ม ${currentCompleted - priorCompleted} งานจาก${comparisonScope}ก่อน`);
      if (metrics.overdueTasks.value < priorOverdue) positiveInsights.push(`งานเลยกำหนด ณ สิ้นช่วงลดลง ${priorOverdue - metrics.overdueTasks.value} งานจาก${comparisonScope}ก่อน`);
      if (currentCompleted < priorCompleted) attentionInsights.push(`งานที่เสร็จลดลง ${priorCompleted - currentCompleted} งานจาก${comparisonScope}ก่อน`);
      if (metrics.overdueTasks.value > priorOverdue) attentionInsights.push(`งานเลยกำหนด ณ สิ้นช่วงเพิ่มขึ้น ${metrics.overdueTasks.value - priorOverdue} งานจาก${comparisonScope}ก่อน`);
    }
    if (!positiveInsights.length) positiveInsights.push('ยังไม่มีงานที่บันทึกว่าเสร็จในช่วงนี้');
    if (overdue > 0) attentionInsights.push(`${overdue} งานครบกำหนดในช่วงนี้ยังไม่เสร็จและเลยกำหนด`);
    if (remaining > 0) attentionInsights.push(`${remaining} งานครบกำหนดในช่วงนี้ยังไม่เสร็จ แต่ยังไม่เลยกำหนด`);
    if (!attentionInsights.length) attentionInsights.push('ไม่มีงานครบกำหนดที่ยังไม่เสร็จในช่วงนี้');
  }

  return (
    <section className="tp-report-glance" aria-label="สรุปภาพรวมรายงาน">
      <div className="tp-report-glance-header">
        <div>
          <span className="tp-eyebrow">สรุปประจำ{periodLabel(mode)}</span>
          <p className="tp-report-summary-sentence">{summary}</p>
        </div>
      </div>
      <CoverageNote coverage={metrics.coverage} timezone={metrics.period.timezone} />
      <div className="tp-report-glance-grid">
        <TaskStatusDonut metrics={metrics} />
        <div className="tp-report-insights">
          <section className="tp-report-insight is-positive" aria-labelledby="tp-report-well-title">
            <h3 id="tp-report-well-title">ทำได้ดี</h3>
            <ul>{positiveInsights.map((insight) => <li key={insight}>{insight}</li>)}</ul>
          </section>
          <section className="tp-report-insight is-attention" aria-labelledby="tp-report-attention-title">
            <h3 id="tp-report-attention-title">ควรติดตาม</h3>
            <ul>{attentionInsights.map((insight) => <li key={insight}>{insight}</li>)}</ul>
          </section>
        </div>
        <section className="tp-report-actions-panel" aria-labelledby="tp-report-actions-title">
          <div className="tp-report-panel-heading">
            <div><h3 id="tp-report-actions-title">สิ่งที่ควรทำต่อ</h3><p>งานที่ยังเปิดอยู่จากกลุ่มงานของช่วงนี้</p></div>
            <strong>{reliable ? attentionTasks.length : '—'}</strong>
          </div>
          {!reliable ? (
            <p className="tp-report-empty">รายการงานไม่พร้อม เพราะข้อมูลประวัติไม่ครบ</p>
          ) : attentionTasks.length ? (
            <>
              <ul className="tp-report-task-list">
                {attentionTasks.slice(0, 4).map(({ occurrence, task }) => {
                  const overdueNow = isTaskOverdue(task, now);
                  const currentDueAt = taskDueAt(task);
                  const scheduleChanged = currentDueAt !== occurrence.dueAt;
                  const reason = overdueNow ? 'เลยกำหนดอยู่ในขณะนี้' : task.priority === 'urgent' ? 'ความสำคัญสูง' : 'ยังไม่เสร็จ ณ เวลาสรุป';
                  const deadline = currentDueAt
                    ? new Intl.DateTimeFormat('th-TH-u-ca-gregory', { dateStyle: 'short', timeStyle: 'short' }).format(currentDueAt)
                    : 'ไม่มีกำหนด';
                  return (
                    <li key={occurrence.occurrenceId}>
                      <span className={`tp-report-action-mark ${overdueNow ? 'is-overdue' : ''}`} aria-hidden="true">{overdueNow ? '!' : '•'}</span>
                      <div className="tp-report-task-copy">
                        <strong>{task.title}</strong>
                        <small>{reason} · {scheduleChanged ? `กำหนดปัจจุบัน ${deadline}` : `กำหนด ${deadline}`}{occurrence.seriesId ? ' · งานเกิดซ้ำ' : ''}</small>
                      </div>
                      <button type="button" className="tp-report-edit" onClick={() => onEdit(task)}>เปิดงาน</button>
                    </li>
                  );
                })}
              </ul>
              {attentionTasks.length > 4 && <p className="tp-report-more">แสดง 4 จาก {attentionTasks.length} งาน</p>}
            </>
          ) : (
            <p className="tp-report-empty">
              {planned > completed ? 'งานที่เหลืออาจถูกลบหรือปิดในภายหลัง จึงไม่พบงานเปิดให้ดำเนินการจากรายการปัจจุบัน' : 'ไม่มีงานเปิดจากกลุ่มงานที่เลือก'}
            </p>
          )}
        </section>
      </div>
    </section>
  );
}

function DailyReport({ data, tasks, onEdit }) {
  const { metrics } = data;
  const taskById = new Map(tasks.map((task) => [task.id, task]));
  const reliable = metrics.coverage.status === 'complete';
  const occurrences = reliable ? metrics.occurrences : [];
  const completed = occurrences.filter((occurrence) => occurrence.completedInPeriod);
  const remaining = occurrences.filter((occurrence) => occurrence.planned && !occurrence.doneAtCutoff && !occurrence.overdueAtCutoff);
  const overdue = occurrences.filter((occurrence) => occurrence.overdueAtCutoff);
  const planned = metrics.plannedVsCompleted.planned;
  const completedCount = metrics.completionTrend;

  return (
    <details className="tp-report-disclosure tp-report-evening-review">
      <summary>
        <span className="tp-report-section-icon"><CalendarDays size={17} aria-hidden="true" /></span>
        <span className="tp-report-disclosure-copy"><strong>Evening Review</strong><small>{dateLabel(data.range.startDate, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })} · เปิดดูรายการย้อนหลัง</small></span>
        <span className="tp-report-disclosure-hint">ดูรายละเอียดวัน</span>
      </summary>
      <div className="tp-report-review-content">
        <p className="tp-report-summary-copy">
          {reliable
            ? `วันที่เลือกมีงานครบกำหนด ${formatCount(planned)} งาน · เสร็จในวัน ${formatCount(completedCount)} งาน · เพิ่มงานในช่วงนี้ ${formatCount(metrics.tasksCreated)} งาน`
            : 'ไม่สามารถสรุปประวัติของวันนี้ได้อย่างน่าเชื่อถือ ตัวเลขและรายการย้อนหลังจึงถูกระงับ'}
        </p>
        <p className="tp-report-period-note">นับงานตามกำหนดและการเสร็จในวันตามเวลาท้องถิ่น งานที่เพิ่มหลังวันรายงานจะไม่ถูกรวม · รายการใช้ชื่อปัจจุบันของงาน · งานที่เสร็จก่อนเริ่มเก็บประวัติไม่มีวันเสร็จย้อนหลัง · ไม่มีการเลื่อนกำหนดอัตโนมัติ</p>
        {reliable ? (
          <div className="tp-report-review-grid">
            <TaskSummaryList title="เสร็จในวันที่เลือก" items={completed} tasksById={taskById} emptyLabel="ไม่มีงานที่บันทึกว่าเสร็จในวันนี้" onEdit={onEdit} />
            <TaskSummaryList title="ยังไม่เสร็จเมื่อสิ้นวัน" items={remaining} tasksById={taskById} emptyLabel="ไม่มีงานคงเหลือจากแผนของวันนี้" onEdit={onEdit} />
            <TaskSummaryList title="ควรพิจารณาเลื่อน" items={overdue} tasksById={taskById} emptyLabel="ไม่มีงานที่เลยกำหนด ณ เวลารายงาน" emptyHint="จะไม่มีการเปลี่ยนกำหนดการโดยอัตโนมัติ" onEdit={onEdit} />
          </div>
        ) : (
          <p className="tp-report-empty">รายการงานย้อนหลังยังไม่พร้อม เพราะประวัติไม่ครบถ้วนพอ</p>
        )}
      </div>
    </details>
  );
}

function BucketTrendReport({ data, mode }) {
  const { buckets, metrics, comparison } = data;
  const validBuckets = buckets.filter((bucket) => bucket.metrics?.coverage.status === 'complete');
  const maxCount = Math.max(1, ...validBuckets.flatMap(({ metrics: bucketMetrics }) => [
    bucketMetrics.plannedVsCompleted.planned.value,
    bucketMetrics.completionTrend.value,
  ]).filter(Number.isFinite));
  const maxOverdue = Math.max(1, ...validBuckets.map(({ metrics: bucketMetrics }) => bucketMetrics.overdueTasks.value).filter(Number.isFinite));
  const candidates = validBuckets
    .filter(({ metrics: bucketMetrics }) => bucketMetrics.completionRate.denominator > 0)
    .sort((first, second) => second.metrics.completionRate.value - first.metrics.completionRate.value);
  const best = candidates[0] || null;
  const attention = candidates.length > 1 ? candidates[candidates.length - 1] : null;
  const monthName = (key) => dateLabel(key, { month: 'long' });
  const bucketName = (bucket) => mode === 'month'
    ? dateLabel(bucket.startDate, { day: 'numeric', weekday: 'short' })
    : monthName(bucket.startDate);
  const title = mode === 'month' ? 'แนวโน้มรายวัน' : 'แนวโน้มรายเดือน';
  const bucketUnit = mode === 'month' ? 'วัน' : 'เดือน';
  const currentPeriod = mode === 'month'
    ? dateLabel(data.range.startDate, { month: 'long', year: 'numeric' })
    : new Intl.DateTimeFormat('th-TH-u-ca-gregory', { year: 'numeric' }).format(localDate(data.range.startDate));

  return (
    <section className="tp-card tp-report-bucket-card">
      <div className="tp-report-section-heading">
        <span className="tp-report-section-icon"><BarChart3 size={17} aria-hidden="true" /></span>
        <div><h2>{title}</h2><p>{currentPeriod}{data.periodClosed ? ' · ช่วงเวลาสิ้นสุดแล้ว' : ' · ช่วงเวลาปัจจุบันยังไม่สิ้นสุด'}</p></div>
      </div>
      <div className="tp-report-period-highlights" aria-label={`สรุป${periodLabel(mode)}`}>
        <span>Completion Rate <strong>{formatRate(metrics.completionRate)}</strong></span>
        <span>On-time Rate <strong>{formatRate(metrics.onTimeRate)}</strong></span>
        <span>วางแผน <strong>{formatCount(metrics.plannedVsCompleted.planned)}</strong></span>
        <span>เสร็จในช่วงนี้ <strong>{formatCount(metrics.plannedVsCompleted.completed)}</strong></span>
        <span>เลยกำหนด ณ สิ้นช่วง <strong>{formatCount(metrics.overdueTasks)}</strong></span>
      </div>
      <CoverageNote coverage={metrics.coverage} timezone={metrics.period.timezone} />
      {metrics.coverage.status === 'complete' && (
        <div className="tp-report-day-insights">
          <p>{best
            ? `${bucketUnit}ที่ทำได้ดีที่สุด: ${bucketName(best)} · ${formatRate(best.metrics.completionRate)} (${formatCount(best.metrics.plannedVsCompleted.completed)} เสร็จ จาก ${formatCount(best.metrics.plannedVsCompleted.planned)} วางแผน)`
            : 'ยังไม่มีวันหรือเดือนที่มีงานครบกำหนดเพียงพอสำหรับจัดอันดับ'}
          </p>
          {attention && <p>{bucketUnit}ที่ควรติดตาม: {bucketName(attention)} · {formatRate(attention.metrics.completionRate)} ({formatCount(attention.metrics.plannedVsCompleted.completed)} เสร็จ จาก {formatCount(attention.metrics.plannedVsCompleted.planned)} วางแผน)</p>}
        </div>
      )}
      <div className="tp-report-legend" aria-label="คำอธิบายกราฟ">
        <span><i className="is-planned" aria-hidden="true" /> วางแผนตามวันครบกำหนด</span>
        <span><i className="is-completed" aria-hidden="true" /> เสร็จครั้งแรกในช่วงนั้น</span>
        <span><i className="is-overdue" aria-hidden="true" /> เลยกำหนด ณ สิ้นช่วง</span>
      </div>
      <div className={`tp-report-bucket-table ${mode === 'month' ? 'is-daily' : 'is-monthly'}`} role="table" aria-label={title}>
        <div className="tp-report-bucket-row is-heading" role="row">
          <span role="columnheader">{mode === 'month' ? 'วัน' : 'เดือน'}</span>
          <span role="columnheader">วางแผน / เสร็จ</span>
          <span role="columnheader">เสร็จ / วางแผน</span>
          <span role="columnheader">เลยกำหนด</span>
        </div>
        {buckets.map((bucket) => {
          const bucketMetrics = bucket.metrics;
          const valid = bucketMetrics?.coverage.status === 'complete';
          const planned = bucketMetrics?.plannedVsCompleted.planned.value;
          const completed = bucketMetrics?.completionTrend.value;
          const plannedWidth = valid ? `${(planned / maxCount) * 100}%` : '0%';
          const completedWidth = valid ? `${(completed / maxCount) * 100}%` : '0%';
          return (
            <div className={`tp-report-bucket-row ${bucket.future ? 'is-future' : ''}`} role="row" key={bucket.startDate}>
              <span role="cell"><strong>{bucketName(bucket)}</strong>{mode === 'month' && <small>{dateLabel(bucket.startDate, { day: 'numeric', month: 'short' })}</small>}</span>
              <span className="tp-report-bars" role="cell">
                {bucket.future
                  ? <small className="tp-report-upcoming">ยังไม่ถึง</small>
                  : valid ? <>
                    <span className="tp-report-bar-line"><i className="is-planned" style={{ width: plannedWidth }} /><b>วางแผน {planned}</b></span>
                    <span className="tp-report-bar-line"><i className="is-completed" style={{ width: completedWidth }} /><b>เสร็จ {completed}</b></span>
                  </> : <small className="tp-report-upcoming">ประวัติไม่ครบ</small>}
              </span>
              <span role="cell">{valid ? formatRate(bucketMetrics.completionRate) : '—'}</span>
              <span role="cell">{bucket.future || !valid ? '—' : (
                <span className="tp-report-overdue-trend" aria-label={`เลยกำหนด ${bucketMetrics.overdueTasks.value} งาน`}>
                  <i style={{ width: `${(bucketMetrics.overdueTasks.value / maxOverdue) * 100}%` }} />
                  <b>{bucketMetrics.overdueTasks.value}</b>
                </span>
              )}</span>
            </div>
          );
        })}
      </div>
      {!validBuckets.length && <p className="tp-report-empty">ยังไม่มีข้อมูลช่วงย่อยที่ครบถ้วนพอจะแสดงแนวโน้ม</p>}
      {comparison
        ? <section className="tp-report-comparison" aria-label={`เปรียบเทียบ${periodLabel(mode)}ก่อน`}>
          <strong>{mode === 'month' ? 'เดือนก่อน' : 'ปีก่อน'}</strong>
          <span>เสร็จ {formatCount(comparison.plannedVsCompleted.completed)} งาน</span>
          <span>Completion Rate {formatRate(comparison.completionRate)}</span>
          <span>On-time Rate {formatRate(comparison.onTimeRate)}</span>
          <span>เลยกำหนด {formatCount(comparison.overdueTasks)} งาน</span>
        </section>
        : <p className="tp-report-period-note">{data.comparisonReason}</p>}
    </section>
  );
}

function WeeklyReport({ data }) {
  const { days, comparison } = data;
  const completeRows = days.filter((day) => day.metrics?.coverage.status === 'complete');
  const maxCount = Math.max(1, ...completeRows.flatMap((day) => [
    day.metrics.plannedVsCompleted.planned.value,
    day.metrics.completionTrend.value,
  ]).filter(Number.isFinite));
  const maxOverdue = Math.max(1, ...completeRows.map((day) => day.metrics.overdueTasks.value).filter(Number.isFinite));
  const previousRange = comparison ? {
    start: new Intl.DateTimeFormat('th-TH-u-ca-gregory', { day: 'numeric', month: 'short' }).format(localDate(comparison.period.startDate)),
    end: new Intl.DateTimeFormat('th-TH-u-ca-gregory', { day: 'numeric', month: 'short', year: 'numeric' }).format(localDate(previousLocalDateKey(comparison.period.endDate))),
  } : null;

  return (
    <>
      <section className="tp-card tp-report-weekly-card">
        <div className="tp-report-section-heading">
          <span className="tp-report-section-icon"><BarChart3 size={17} aria-hidden="true" /></span>
          <div><h2>แนวโน้มรายวัน</h2><p>{dateLabel(data.range.startDate, { day: 'numeric', month: 'short' })} – {dateLabel(previousLocalDateKey(data.range.endDate), { day: 'numeric', month: 'short', year: 'numeric' })} · สัปดาห์เริ่มวันจันทร์</p></div>
        </div>
        <div className="tp-report-legend" aria-label="คำอธิบายกราฟ">
          <span><i className="is-planned" aria-hidden="true" /> วางแผนตามวันครบกำหนด</span>
          <span><i className="is-completed" aria-hidden="true" /> เสร็จครั้งแรกในวันนั้น</span>
          <span><i className="is-overdue" aria-hidden="true" /> เลยกำหนด ณ สิ้นวัน</span>
        </div>
        <div className="tp-report-week-table" role="table" aria-label="งานที่วางแผน เสร็จ และเลยกำหนดในแต่ละวัน">
          <div className="tp-report-week-row is-heading" role="row">
            <span role="columnheader">วัน</span><span role="columnheader">วางแผน / เสร็จ</span><span role="columnheader">เลยกำหนด</span>
          </div>
          {days.map((day) => {
            const daily = day.metrics;
            const plannedValue = daily?.plannedVsCompleted.planned.value;
            const completedValue = daily?.completionTrend.value;
            const valid = daily?.coverage.status === 'complete';
            const plannedWidth = valid ? `${Math.max(0, (plannedValue / maxCount) * 100)}%` : '0%';
            const completedWidth = valid ? `${Math.max(0, (completedValue / maxCount) * 100)}%` : '0%';
            return (
              <div className={`tp-report-week-row ${day.future ? 'is-future' : ''}`} role="row" key={day.startDate}>
                <span className="tp-report-week-date" role="cell">
                  <strong>{dateLabel(day.startDate, { weekday: 'short', day: 'numeric' })}</strong>
                  <small>{dateLabel(day.startDate, { month: 'short', year: 'numeric' })}</small>
                </span>
                <span className="tp-report-bars" role="cell">
                  {day.future
                    ? <small className="tp-report-upcoming">วันข้างหน้า</small>
                    : valid ? (
                      <>
                        <span className="tp-report-bar-line"><i className="is-planned" style={{ width: plannedWidth }} /><b>วางแผน {plannedValue}</b></span>
                        <span className="tp-report-bar-line"><i className="is-completed" style={{ width: completedWidth }} /><b>เสร็จ {completedValue}</b></span>
                      </>
                    ) : <small className="tp-report-upcoming">ประวัติไม่ครบ</small>}
                </span>
                <span className="tp-report-overdue-value" role="cell">
                  {day.future ? '—' : valid ? (
                    <span className="tp-report-overdue-trend" aria-label={`เลยกำหนด ${daily.overdueTasks.value} งาน`}>
                      <i style={{ width: `${(daily.overdueTasks.value / maxOverdue) * 100}%` }} />
                      <b>{daily.overdueTasks.value}</b>
                    </span>
                  ) : '—'}
                </span>
              </div>
            );
          })}
        </div>
        {!completeRows.length && <p className="tp-report-empty">ยังไม่มีข้อมูลรายวันที่ครบถ้วนสำหรับสัปดาห์นี้</p>}
        {comparison ? (
          <section className="tp-report-comparison" aria-label="เปรียบเทียบสัปดาห์ก่อน">
            <strong>สัปดาห์ก่อน ({previousRange.start} – {previousRange.end})</strong>
            <span>เสร็จ {formatCount(comparison.plannedVsCompleted.completed)} งาน</span>
            <span>อัตราทำสำเร็จ {formatRate(comparison.completionRate)}</span>
            <span>เลยกำหนด {formatCount(comparison.overdueTasks)} งาน ณ สิ้นสัปดาห์</span>
          </section>
        ) : <p className="tp-report-period-note">{data.comparisonReason}</p>}
      </section>
    </>
  );
}

export function ReportsView({
  mode, setMode, reportDate, setReportDate, today, reportData, historyError,
  tasks = [], onEdit, theme, setTheme, setPage, profileName, onSelectYesterday,
}) {
  const currentKey = localKey(today);
  const weekStart = mode === 'week' ? reportData?.range.startDate : null;
  const currentWeekStart = mode === 'week'
    ? localWeekStart(currentKey)
    : null;
  const currentMonth = localKey(new Date(today.getFullYear(), today.getMonth(), 1));
  const currentYear = `${today.getFullYear()}-01-01`;
  const selectedPeriodStart = mode === 'month'
    ? localKey(new Date(reportDate.getFullYear(), reportDate.getMonth(), 1))
    : mode === 'year' ? `${reportDate.getFullYear()}-01-01` : localKey(reportDate);
  const canGoForward = mode === 'week' ? weekStart < currentWeekStart
    : mode === 'month' ? selectedPeriodStart < currentMonth
      : mode === 'year' ? selectedPeriodStart < currentYear
        : localKey(reportDate) < currentKey;
  const shiftPeriod = (date, direction) => {
    const next = new Date(date);
    if (mode === 'week') next.setDate(next.getDate() + direction * 7);
    else if (mode === 'month') {
      next.setDate(1);
      next.setMonth(next.getMonth() + direction);
    } else if (mode === 'year') {
      next.setDate(1);
      next.setMonth(0);
      next.setFullYear(next.getFullYear() + direction);
    } else next.setDate(next.getDate() + direction);
    return next;
  };
  const periodTitle = mode === 'day'
    ? dateLabel(reportData?.range.startDate || currentKey, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
    : mode === 'week'
      ? `${dateLabel(reportData?.range.startDate || currentKey, { day: 'numeric', month: 'short' })} – ${dateLabel(previousLocalDateKey(reportData?.range.endDate || currentKey), { day: 'numeric', month: 'short', year: 'numeric' })}`
      : mode === 'month'
        ? dateLabel(reportData?.range.startDate || currentMonth, { month: 'long', year: 'numeric' })
        : new Intl.DateTimeFormat('th-TH-u-ca-gregory', { year: 'numeric' }).format(reportDate);

  return (
    <section className="tp-page tp-reports-page">
      <HeaderBar theme={theme} setTheme={setTheme} setPage={setPage} profileName={profileName}>
        <div className="tp-heading-copy"><span className="tp-eyebrow">ทบทวนและวางแผน</span><h1 className="tp-page-title">รายงาน</h1></div>
      </HeaderBar>
      <div className="tp-report-toolbar">
        <div className="tp-segmented tp-report-tabs" role="group" aria-label="ช่วงเวลารายงาน">
          <button type="button" aria-pressed={mode === 'day'} className={mode === 'day' ? 'is-active' : ''} onClick={() => setMode('day')}>รายวัน</button>
          <button type="button" aria-pressed={mode === 'week'} className={mode === 'week' ? 'is-active' : ''} onClick={() => setMode('week')}>รายสัปดาห์</button>
          <button type="button" aria-pressed={mode === 'month'} className={mode === 'month' ? 'is-active' : ''} onClick={() => setMode('month')}>รายเดือน</button>
          <button type="button" aria-pressed={mode === 'year'} className={mode === 'year' ? 'is-active' : ''} onClick={() => setMode('year')}>รายปี</button>
        </div>
        <div className="tp-report-date-controls">
          {mode === 'day' && <button type="button" className="tp-btn tp-btn-ghost tp-btn-sm" onClick={onSelectYesterday}>รายงานเมื่อวาน</button>}
          <button type="button" className="tp-icon-btn" aria-label={`${periodLabel(mode)}ก่อนหน้า`} onClick={() => setReportDate((date) => shiftPeriod(date, -1))}><ChevronLeft size={17} /></button>
          <label><span className="tp-sr-only">วันที่ในรายงาน</span>
            <input className="tp-date-input" type="date" value={localKey(reportDate)} max={currentKey} onChange={(event) => {
              if (!event.target.value) return;
              setReportDate(localDate(event.target.value));
            }} />
          </label>
          <button type="button" className="tp-icon-btn" aria-label={`${periodLabel(mode)}ถัดไป`} disabled={!canGoForward} onClick={() => setReportDate((date) => shiftPeriod(date, 1))}><ChevronRight size={17} /></button>
          <button type="button" className="tp-btn tp-btn-ghost tp-btn-sm" onClick={() => setReportDate(new Date(today.getFullYear(), today.getMonth(), today.getDate()))}>
            {mode === 'day' ? 'วันนี้' : mode === 'week' ? 'สัปดาห์นี้' : mode === 'month' ? 'เดือนนี้' : 'ปีนี้'}
          </button>
        </div>
      </div>
      {historyError ? (
        <>
          <section className="tp-card tp-report-error" role="alert"><AlertTriangle size={19} /><div><strong>อ่านประวัติรายงานไม่สำเร็จ</strong><p>{historyError}</p><p>ตัวเลขย้อนหลังถูกระงับไว้ ข้อมูลงานเดิมไม่ได้ถูกแก้ไข</p></div></section>
          <TodayBriefing tasks={tasks} now={today.getTime()} onEdit={onEdit} />
        </>
      ) : !reportData ? (
        <section className="tp-card tp-report-loading" role="status">กำลังโหลดประวัติเพื่อคำนวณรายงาน…</section>
      ) : (
        <div className="tp-report-content">
          <div className="tp-report-heading">
            <div><span className="tp-eyebrow">{mode === 'day' ? 'รายงานประจำวัน' : mode === 'week' ? 'ภาพรวมเจ็ดวัน' : mode === 'month' ? 'รายงานประจำเดือน' : 'รายงานประจำปี'}</span><h2>{periodTitle}</h2></div>
          </div>
          <AtGlanceDashboard data={reportData} mode={mode} tasks={tasks} now={today.getTime()} onEdit={onEdit} />
          <TodayBriefing tasks={tasks} now={today.getTime()} onEdit={onEdit} />
          {mode === 'day'
            ? <DailyReport data={reportData} tasks={tasks} onEdit={onEdit} />
            : mode === 'week'
              ? <WeeklyReport data={reportData} />
              : <BucketTrendReport data={reportData} mode={mode} />}
        </div>
      )}
    </section>
  );
}

function localWeekStart(key) {
  const date = localDate(key);
  date.setDate(date.getDate() - ((date.getDay() + 6) % 7));
  return localKey(date);
}

export default function ReportsPage({
  theme, setTheme, setPage, profileName, tasks, onEdit, historyRevision = 0, initialReportDate = '',
}) {
  const [mode, setMode] = useState('day');
  const [reportDate, setReportDate] = useState(() => dateFromLocalKey(initialReportDate) || new Date());
  const [today, setToday] = useState(() => new Date());
  const [history, setHistory] = useState(null);
  const [historyError, setHistoryError] = useState('');

  useEffect(() => {
    let active = true;
    setHistory(null);
    setHistoryError('');
    loadTaskHistory().then((loaded) => {
      if (active) setHistory(loaded);
    }).catch((error) => {
      if (active) setHistoryError(error instanceof Error ? error.message : 'ประวัติรายงานไม่พร้อมใช้งาน');
    });
    return () => { active = false; };
  }, [historyRevision]);

  useEffect(() => {
    const date = dateFromLocalKey(initialReportDate);
    if (!date) return;
    setMode('day');
    setReportDate(date);
  }, [initialReportDate]);

  useEffect(() => {
    const timer = window.setInterval(() => setToday(new Date()), 60_000);
    return () => window.clearInterval(timer);
  }, []);

  const reportData = useMemo(() => {
    if (!history) return null;
    if (mode === 'day') return buildDailyReportData({ date: reportDate, now: today.getTime(), history });
    if (mode === 'week') return buildWeeklyReportData({ date: reportDate, now: today.getTime(), history });
    if (mode === 'month') return buildMonthlyReportData({ date: reportDate, now: today.getTime(), history });
    return buildYearlyReportData({ date: reportDate, now: today.getTime(), history });
  }, [history, mode, reportDate, today]);

  return (
    <ReportsView
      mode={mode} setMode={setMode} reportDate={reportDate} setReportDate={setReportDate}
      today={today} reportData={reportData} historyError={historyError} tasks={tasks}
      onEdit={onEdit} theme={theme} setTheme={setTheme} setPage={setPage} profileName={profileName}
      onSelectYesterday={() => {
        const yesterday = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 1);
        setMode('day');
        setReportDate(yesterday);
      }}
    />
  );
}
