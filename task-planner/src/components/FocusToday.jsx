import { useEffect, useMemo, useState } from 'react';
import { ArrowRight, Archive, CalendarClock, Check, Clock3, Pin, PinOff, RotateCcw, XCircle } from 'lucide-react';
import TaskItem from './TaskItem';
import { isTaskOverdue } from '../utils/taskManagement.js';
import { recommendFocusTasks } from '../utils/taskFocus.js';
import { getLocalDateKey, getRescheduleTodayTime } from '../utils/taskRecovery.js';

const localDateLabel = (dateKey) => {
  if (!dateKey) return 'ไม่กำหนดวัน';
  const [year, month, day] = dateKey.split('-').map(Number);
  return new Intl.DateTimeFormat('th-TH-u-ca-gregory', { day: 'numeric', month: 'short' }).format(new Date(year, month - 1, day));
};

export default function FocusToday({
  tasks, priorityMap, onToggle, onEdit, onDelete, onTaskAction, onOpenAll,
}) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(timer);
  }, []);
  const recommendations = useMemo(() => recommendFocusTasks(tasks, { now, limit: 3 }), [tasks, now]);
  const overdueTasks = useMemo(() => tasks
    .filter((task) => isTaskOverdue(task, now) && !task.archived && !task.cancelled
      && (!Number.isFinite(task.snoozedUntil) || task.snoozedUntil <= now))
    .sort((first, second) => (new Date(`${first.dateKey}T${String(first.hour).padStart(2, '0')}:${String(first.minute).padStart(2, '0')}`).getTime())
      - (new Date(`${second.dateKey}T${String(second.hour).padStart(2, '0')}:${String(second.minute).padStart(2, '0')}`).getTime()))
    .slice(0, 3), [tasks, now]);

  const rescheduleToday = (task) => {
    const time = getRescheduleTodayTime(task, new Date());
    onTaskAction(task.id, 'reschedule', { dateKey: getLocalDateKey(), ...time });
  };
  const snoozeOneHour = (task) => onTaskAction(task.id, 'snooze', { until: Date.now() + 60 * 60 * 1000 });

  return (
    <section className="tp-focus-section" aria-label="โฟกัสวันนี้">
      <div className="tp-focus-heading">
        <div><span className="tp-eyebrow">เริ่มจากก้าวถัดไป</span><h2>โฟกัสวันนี้</h2><p>แนะนำไม่เกิน 3 งาน · งานปักหมุดของคุณมาก่อน</p></div>
        <button type="button" className="tp-btn tp-btn-ghost tp-btn-sm" onClick={onOpenAll}>รายการทั้งหมด <ArrowRight size={14} /></button>
      </div>
      {recommendations.length ? <ul className="tp-focus-list">{recommendations.map(({ task, reason, overdue }) => (
        <li key={task.id} className="tp-focus-item">
          <TaskItem task={task} priority={priorityMap[task.priority]} overdue={overdue} onToggle={onToggle} onEdit={onEdit} onDelete={onDelete} />
          <span className={`tp-focus-reason is-${reason.code}`}>{reason.label}</span>
          <div className="tp-focus-actions">
            <button type="button" className="tp-task-action" onClick={() => onTaskAction(task.id, task.pinned ? 'unpin' : 'pin')} aria-label={task.pinned ? 'ยกเลิกปักหมุด' : 'ปักหมุดงาน'} title={task.pinned ? 'ยกเลิกปักหมุด' : 'ปักหมุด'}>{task.pinned ? <PinOff size={14} /> : <Pin size={14} />}</button>
            {overdue && <>
              <button type="button" className="tp-recovery-action" onClick={() => rescheduleToday(task)}><CalendarClock size={14} /> วันนี้ {localDateLabel(getLocalDateKey())}</button>
              <button type="button" className="tp-recovery-action" onClick={() => snoozeOneHour(task)}><Clock3 size={14} /> พัก 1 ชม.</button>
            </>}
          </div>
        </li>
      ))}</ul> : <div className="tp-focus-empty"><Check size={18} /><span>ไม่มีงานที่ต้องโฟกัสตอนนี้</span><button type="button" className="tp-btn tp-btn-ghost tp-btn-sm" onClick={onOpenAll}>ดูรายการทั้งหมด</button></div>}

      {overdueTasks.length > 0 && <div className="tp-recovery-panel">
        <div className="tp-recovery-heading"><div><h3>จัดการงานที่เลยกำหนด</h3><p>แสดงสูงสุด 3 งานก่อน · งานที่เหลืออยู่ในรายการทั้งหมด</p></div><span>{tasks.filter((task) => isTaskOverdue(task, now) && !task.archived && !task.cancelled).length} งาน</span></div>
        <ul className="tp-recovery-list">{overdueTasks.map((task) => <li key={task.id}>
          <TaskItem task={task} priority={priorityMap[task.priority]} overdue onToggle={onToggle} onEdit={onEdit} onDelete={onDelete} />
          <div className="tp-recovery-actions">
            <button type="button" className="tp-recovery-action" onClick={() => rescheduleToday(task)}><CalendarClock size={14} /> เลื่อนไปวันนี้</button>
            <label className="tp-recovery-date"><span>เลือกวัน</span><input type="date" aria-label={`เลือกวันใหม่สำหรับ ${task.title}`} min={getLocalDateKey()} value="" onChange={(event) => { if (event.target.value) { const selectedTask = { ...task, dateKey: event.target.value }; const time = event.target.value === getLocalDateKey() ? getRescheduleTodayTime(selectedTask, new Date()) : {}; onTaskAction(task.id, 'reschedule', { dateKey: event.target.value, ...time }); } }} /></label>
            <button type="button" className="tp-recovery-action" onClick={() => snoozeOneHour(task)}><Clock3 size={14} /> พัก 1 ชม.</button>
            <button type="button" className="tp-recovery-action" onClick={() => onTaskAction(task.id, 'archive')}><Archive size={14} /> เก็บถาวร</button>
            <button type="button" className="tp-recovery-action is-cancel" onClick={() => onTaskAction(task.id, 'cancel')}><XCircle size={14} /> ยกเลิก</button>
          </div>
        </li>)}</ul>
        <button type="button" className="tp-recovery-more" onClick={onOpenAll}>ดูและจัดการงานที่เหลือ <ArrowRight size={14} /></button>
      </div>}

      {tasks.some((task) => Number.isFinite(task.snoozedUntil) && task.snoozedUntil > now && !task.done && !task.archived && !task.cancelled) && <div className="tp-snoozed-note"><Clock3 size={14} /> งานที่พักไว้จะกลับมาแสดงเมื่อถึงเวลา</div>}
    </section>
  );
}