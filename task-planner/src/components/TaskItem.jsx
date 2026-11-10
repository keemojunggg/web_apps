import { useEffect, useState } from 'react';
import { Check, Pencil, Trash2, Paperclip, Repeat2, Clock3, CalendarClock, Archive, XCircle } from 'lucide-react';
import { pad2 } from '../utils/dateUtils';
import { getLocalDateKey, getRescheduleTodayTime } from '../utils/taskRecovery.js';

export default function TaskItem({ task, priority, overdue = false, showDate = false, focusReason, onToggle, onEdit, onDelete, onTaskAction }) {
  const [fileUrls, setFileUrls] = useState({});
  useEffect(() => {
    const urls = {};
    (task.attachments || []).forEach((file, index) => {
      if (file.blob instanceof Blob) urls[file.id || `${file.name}-${index}`] = URL.createObjectURL(file.blob);
    });
    setFileUrls(urls);
    return () => Object.values(urls).forEach((url) => URL.revokeObjectURL(url));
  }, [task.attachments]);
  const dateText = task.dateKey
    ? new Intl.DateTimeFormat('th-TH-u-ca-gregory', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(`${task.dateKey}T00:00:00`))
    : 'ไม่กำหนดวัน';
  const rescheduleToday = () => onTaskAction?.(task.id, 'reschedule', { dateKey: getLocalDateKey(), ...getRescheduleTodayTime(task, new Date()) });
  const snoozeOneHour = () => onTaskAction?.(task.id, 'snooze', { until: Date.now() + 60 * 60 * 1000 });
  return (
    <article className={`tp-task-row ${task.done ? 'is-done' : ''} ${overdue ? 'is-overdue' : ''}`}>
      <button type="button" className="tp-task-check" onClick={() => onToggle(task.id)} disabled={task.archived || task.cancelled} aria-label={task.done ? 'ทำเครื่องหมายว่ายังไม่เสร็จ' : 'ทำเครื่องหมายว่าเสร็จแล้ว'} aria-pressed={task.done}>
        {task.done && <Check size={14} />}
      </button>
      <span className="tp-task-dot" style={{ background: priority?.color || 'var(--text-tertiary)' }} />
      <div className="tp-task-body">
        <span className="tp-task-title">{task.title}</span>
        {task.description && <span className="tp-task-description">{task.description}</span>}
        <div className="tp-task-meta">
          <span className="tp-task-time">{task.dateKey ? `${pad2(task.hour)}:${pad2(task.minute)} น.` : 'ไม่ระบุเวลา'}</span>
          {showDate && <span className="tp-task-date">{dateText}</span>}
          <span className="tp-task-priority">{priority?.label || 'ปานกลาง'}</span>
          {task.repeat && task.repeat !== 'none' && <span className="tp-task-repeat"><Repeat2 size={12} />{({ daily: 'ทุกวัน', weekly: 'ทุกสัปดาห์', monthly: 'ทุกเดือน' })[task.repeat]}</span>}
          {!!task.attachments?.length && <span className="tp-task-attachment-label"><Paperclip size={12} />{task.attachments.length}</span>}
          {overdue && <span className="tp-overdue-badge">เลยกำหนด</span>}
          {focusReason && <span className={`tp-focus-reason is-${focusReason.code}`} title="เหตุผลที่แนะนำให้ทำงานนี้ก่อน">{focusReason.label}</span>}
          {task.archived && <span className="tp-task-state-pill">เก็บถาวร</span>}
          {task.cancelled && <span className="tp-task-state-pill">ยกเลิกแล้ว</span>}
          {Number.isFinite(task.snoozedUntil) && task.snoozedUntil > Date.now() && <span className="tp-task-state-pill">พักไว้</span>}
        </div>
        {!!task.attachments?.length && <div className="tp-task-files">{task.attachments.map((file, index) => <a key={`${file.id || file.name}-${index}`} href={fileUrls[file.id || `${file.name}-${index}`] || file.dataUrl || undefined} download={file.name} onClick={(event) => event.stopPropagation()}>{file.name}</a>)}</div>}
      </div>
      <div className="tp-task-actions">
        {overdue && onTaskAction && <details className="tp-inline-recovery"><summary aria-label={`จัดการงานเลยกำหนด ${task.title}`} title="จัดการงานเลยกำหนด"><Clock3 size={15} /></summary><div className="tp-inline-recovery-menu">
          <button type="button" onClick={rescheduleToday}><CalendarClock size={14} /> เลื่อนไปวันนี้</button>
          <label><span>เลือกวันใหม่</span><input type="date" aria-label={`เลือกวันใหม่สำหรับ ${task.title}`} min={getLocalDateKey()} onChange={(event) => { if (event.target.value) { const selectedTask = { ...task, dateKey: event.target.value }; const time = event.target.value === getLocalDateKey() ? getRescheduleTodayTime(selectedTask, new Date()) : {}; onTaskAction(task.id, 'reschedule', { dateKey: event.target.value, ...time }); } }} /></label>
          <button type="button" onClick={snoozeOneHour}><Clock3 size={14} /> พัก 1 ชั่วโมง</button>
          <button type="button" onClick={() => onTaskAction(task.id, 'archive')}><Archive size={14} /> เก็บถาวร</button>
          <button type="button" onClick={() => onTaskAction(task.id, 'cancel')}><XCircle size={14} /> ยกเลิกงาน</button>
        </div></details>}
        <button type="button" className="tp-task-action" onClick={() => onEdit(task)} aria-label={`แก้ไขงาน ${task.title}`} title="แก้ไข"><Pencil size={16} /></button>
        <button type="button" className="tp-task-action is-delete" onClick={() => onDelete(task.id)} aria-label={`ลบงาน ${task.title}`} title="ลบ"><Trash2 size={16} /></button>
      </div>
    </article>
  );
}
