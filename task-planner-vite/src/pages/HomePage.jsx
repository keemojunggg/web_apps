import { useEffect, useMemo, useRef, useState } from 'react';
import { Plus, Paperclip, ChevronLeft, ChevronRight, Calendar as CalendarIcon, Search, SlidersHorizontal, X, CheckCircle2, Clock3, ListTodo, ArrowRight } from 'lucide-react';
import HeaderBar from '../components/HeaderBar';
import PriorityPicker from '../components/PriorityPicker';
import ToggleSwitch from '../components/ToggleSwitch';
import TaskItem from '../components/TaskItem';
import { addDays, toKey } from '../utils/dateUtils';
import { isTaskOverdue, selectAndSortTasks } from '../utils/taskManagement';
import { recommendFocusTasks } from '../utils/taskFocus.js';
import { calculateDailyTaskProgress } from '../utils/dailyProgress.js';

const FILTERS = [
  { id: 'all', label: 'ทั้งหมด' },
  { id: 'active', label: 'ยังไม่เสร็จ' },
  { id: 'completed', label: 'เสร็จแล้ว' },
  { id: 'overdue', label: 'เลยกำหนด' },
];

const dateLabel = (date) => new Intl.DateTimeFormat('th-TH-u-ca-gregory', {
  weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
}).format(date);

const readFile = (file) => new Promise((resolve, reject) => {
  const reader = new FileReader();
  reader.onload = () => resolve({
    id: `${file.name}-${file.size}-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    name: file.name,
    type: file.type || 'application/octet-stream',
    size: file.size,
    blob: new Blob([reader.result], { type: file.type || 'application/octet-stream' }),
  });
  reader.onerror = () => reject(new Error(`อ่านไฟล์ ${file.name} ไม่สำเร็จ`));
  reader.readAsArrayBuffer(file);
});

export default function HomePage({
  theme, setTheme,
  selectedDate, setSelectedDate,
  tasks, priorityMap,
  onAddTask, onToggle, onEdit, onDelete,
  onTaskAction, notifyDefault, leadMinutes, setPage, profileName,
}) {
  const [title, setTitle] = useState('');
  const [dateKey, setDateKey] = useState(toKey(selectedDate));
  const [time, setTime] = useState('09:00');
  const [priority, setPriority] = useState('scheduled');
  const [repeat, setRepeat] = useState('none');
  const [notify, setNotify] = useState(notifyDefault);
  const [files, setFiles] = useState([]);
  const [description, setDescription] = useState('');
  const [advanced, setAdvanced] = useState(false);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');
  const [sort, setSort] = useState('focus');
  const [showAllTasks, setShowAllTasks] = useState(false);
  const fileInputRef = useRef(null);
  const submissionLock = useRef(false);

  useEffect(() => setDateKey(toKey(selectedDate)), [selectedDate]);

  const selectedKey = toKey(selectedDate);
  const dailyProgress = calculateDailyTaskProgress(tasks, selectedKey);
  const dayTasks = tasks.filter((task) => task.dateKey === selectedKey && !task.archived && !task.cancelled);
  const doneCount = dailyProgress.completed;
  const overdueCount = tasks.filter((task) => isTaskOverdue(task)).length;
  const remainingCount = dailyProgress.remaining;
  const progress = dailyProgress.rate === null ? null : Math.round(dailyProgress.rate * 100);
  const homeTasks = useMemo(() => showAllTasks
    ? tasks
    : tasks.filter((task) => task.dateKey === selectedKey || isTaskOverdue(task)), [tasks, showAllTasks, selectedKey]);
  const focusReasons = useMemo(() => new Map(recommendFocusTasks(homeTasks, { limit: 3 }).map(({ task, reason }) => [task.id, reason])), [homeTasks]);

  const addFiles = (list) => {
    const selected = Array.from(list || []);
    if (files.length + selected.length > 5) {
      setError('แนบไฟล์ได้ไม่เกิน 5 ไฟล์ต่องาน');
      return;
    }
    const tooLarge = selected.find((file) => file.size > 350 * 1024);
    if (tooLarge) {
      setError(`ไฟล์ ${tooLarge.name} มีขนาดเกิน 350 KB เพื่อให้บันทึกในเบราว์เซอร์ได้`);
      return;
    }
    setError('');
    setFiles((previous) => [...previous, ...selected]);
  };

  const visibleTasks = useMemo(() => selectAndSortTasks(homeTasks, {
    query: search,
    filter,
    sort,
  }), [homeTasks, filter, search, sort]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (submissionLock.current || saving) return;
    if (!title.trim()) {
      setError('กรุณาพิมพ์ชื่องานก่อนเพิ่ม');
      return;
    }
    if (repeat !== 'none' && !dateKey) {
      setError('งานที่ทำซ้ำต้องกำหนดวันที่เริ่มต้น');
      setAdvanced(true);
      return;
    }
    submissionLock.current = true;
    setSaving(true);
    setError('');
    try {
      const attachments = await Promise.all(files.map(readFile));
      const [hour, minute] = time.split(':').map(Number);
      onAddTask({
        title: title.trim(), dateKey, hour, minute, priority, repeat, notify,
        description: description.trim(), attachments,
      });
    } catch (readError) {
      setError(readError instanceof Error ? readError.message : 'อ่านไฟล์แนบไม่สำเร็จ');
      submissionLock.current = false;
      setSaving(false);
      return;
    }
    setTitle('');
    setDateKey(toKey(selectedDate));
    setTime('09:00');
    setPriority('scheduled');
    setRepeat('none');
    setNotify(notifyDefault);
    setDescription('');
    setFiles([]);
    setAdvanced(false);
    submissionLock.current = false;
    setSaving(false);
  };

  return (
    <section className="tp-page tp-home-page">
      <HeaderBar theme={theme} setTheme={setTheme} setPage={setPage} profileName={profileName}>
        <div className="tp-heading-copy">
          <span className="tp-eyebrow">TASK PLANNER</span>
          <h1 className="tp-page-title">{dateLabel(selectedDate)}</h1>
        </div>
        <div className="tp-date-controls">
          <button type="button" className="tp-icon-btn" onClick={() => setSelectedDate((d) => addDays(d, -1))} aria-label="วันก่อนหน้า">
          <ChevronLeft size={17} />
          </button>
          <button type="button" className="tp-btn tp-btn-ghost tp-btn-sm" onClick={() => setSelectedDate(new Date())}>วันนี้</button>
          <button type="button" className="tp-icon-btn" onClick={() => setSelectedDate((d) => addDays(d, 1))} aria-label="วันถัดไป">
            <ChevronRight size={17} />
          </button>
        </div>
      </HeaderBar>

      <div className="tp-daily-summary" aria-label="สรุปงานวันนี้">
        <span className="tp-summary-title"><CalendarIcon size={15} /> สรุป {selectedKey === toKey(new Date()) ? 'วันนี้' : dateLabel(selectedDate)}</span>
        <span><ListTodo size={14} /> ทั้งหมด <strong>{dayTasks.length}</strong></span>
        <span className="is-complete"><CheckCircle2 size={14} /> เสร็จแล้ว <strong>{doneCount}</strong></span>
        <span className="is-overdue"><Clock3 size={14} /> เลยกำหนด <strong>{overdueCount}</strong></span>
        <span className="is-remaining">เหลือ <strong>{remainingCount}</strong></span>
        <div className="tp-summary-progress"><div className="tp-progress-track" role="progressbar" aria-label="ความคืบหน้าในวันที่เลือก" aria-valuetext={progress === null ? 'ไม่มีงานที่กำหนดในวันนี้' : `${progress}%`} aria-valuenow={progress ?? undefined} aria-valuemin={0} aria-valuemax={100}><span style={{ width: `${progress ?? 0}%` }} /></div><small>{progress === null ? '—' : `${progress}%`}</small></div>
      </div>

      <form className="tp-quick-add" onSubmit={handleSubmit}>
        <div className="tp-quick-input-wrap"><Plus size={19} /><input aria-label="ชื่องานใหม่" value={title} onChange={(event) => { setTitle(event.target.value); setError(''); }} placeholder="เพิ่มงานใหม่ แล้วกด Enter…" /></div>
        <button type="button" className={`tp-advanced-trigger ${advanced ? 'is-open' : ''}`} onClick={() => setAdvanced((value) => !value)} aria-expanded={advanced}><SlidersHorizontal size={16} /> รายละเอียด</button>
        <button type="submit" className="tp-btn tp-btn-primary" disabled={saving}><Plus size={16} /> {saving ? 'กำลังเพิ่ม…' : 'เพิ่มงาน'}</button>
        {advanced && <div className="tp-advanced-fields">
          <label className="tp-labeled-field"><span>วันที่ (ไม่ระบุก็ได้)</span><input type="date" className="tp-date-input" value={dateKey} onChange={(event) => setDateKey(event.target.value)} /></label>
          <label className="tp-labeled-field"><span>เวลา</span><input type="time" className="tp-date-input" value={time} onChange={(event) => setTime(event.target.value)} disabled={!dateKey} /></label>
          <label className="tp-labeled-field"><span>รายละเอียด / บันทึก</span><textarea className="tp-text-input tp-description-input" value={description} onChange={(event) => setDescription(event.target.value)} placeholder="เพิ่มบันทึกที่ช่วยให้งานนี้ชัดเจนขึ้น" rows={2} /></label>
          <div className="tp-labeled-field"><span>ความสำคัญ</span><PriorityPicker value={priority} onChange={setPriority} /></div>
          <div className="tp-labeled-field"><span>ทำซ้ำ</span><select className="tp-select" value={repeat} onChange={(event) => setRepeat(event.target.value)}>
            <option value="none">ไม่ทำซ้ำ</option><option value="daily">ทุกวัน</option><option value="weekly">ทุกสัปดาห์</option><option value="monthly">ทุกเดือน</option>
          </select><small className="tp-helper-text">สร้างครั้งถัดไปเมื่อทำงานนี้เสร็จ</small></div>
          <div className="tp-labeled-field tp-attachment-field"><span id="task-attachments-label">ไฟล์แนบ</span><div className="tp-attachment-control" role="group" aria-labelledby="task-attachments-label" aria-describedby="task-attachments-help"><input ref={fileInputRef} type="file" multiple hidden onChange={(event) => { addFiles(event.target.files); event.target.value = ''; }} /><button type="button" className="tp-btn tp-btn-ghost tp-btn-sm" onClick={() => fileInputRef.current?.click()}><Paperclip size={15} /> แนบไฟล์</button><small id="task-attachments-help">ไม่เกิน 5 ไฟล์ · 350 KB ต่อไฟล์</small>
            {!!files.length && <ul className="tp-file-list">{files.map((file, index) => <li key={`${file.name}-${index}`} className="tp-file-chip"><span>{file.name}</span><button type="button" onClick={() => setFiles((previous) => previous.filter((_, fileIndex) => fileIndex !== index))} aria-label={`นำ ${file.name} ออก`}><X size={13} /></button></li>)}</ul>}
          </div>
          </div>
          <div className="tp-labeled-field tp-reminder-field"><ToggleSwitch checked={notify} onChange={setNotify} label="แจ้งก่อนถึงเวลา" description={notify ? `ล่วงหน้า ${leadMinutes} นาที (ต้องเปิดสิทธิ์แจ้งเตือน)` : 'ปิดการแจ้งเตือน'} /></div>
        </div>}
        {error && <p className="tp-form-error" role="alert">{error}</p>}
      </form>

      <section className="tp-card tp-tasklist-card">
        <div className="tp-list-heading">
          <div><span className="tp-eyebrow">{showAllTasks ? 'ทุกงานในรายการ' : 'โฟกัสตามวันและงานเลยกำหนด'}</span><h2>{showAllTasks ? 'รายการงานทั้งหมด' : 'งานที่ต้องจัดการ'}</h2></div>
          <button type="button" className="tp-btn tp-btn-ghost tp-btn-sm" onClick={() => setShowAllTasks((value) => !value)}>{showAllTasks ? 'กลับไปวันนี้' : 'ดูงานทั้งหมด'} <ArrowRight size={14} /></button>
        </div>
        <div className="tp-list-toolbar"><label className="tp-search"><Search size={15} /><input aria-label="ค้นหางาน" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="ค้นหาชื่องานหรือบันทึก" />{search && <button type="button" aria-label="ล้างคำค้น" onClick={() => setSearch('')}><X size={14} /></button>}</label><div className="tp-list-controls"><div className="tp-filter-tabs" role="group" aria-label="กรองงาน">{FILTERS.map((item) => <button key={item.id} type="button" className={filter === item.id ? 'is-active' : ''} aria-pressed={filter === item.id} onClick={() => setFilter(item.id)}>{item.label}{item.id === 'overdue' && overdueCount > 0 && <span>{overdueCount}</span>}</button>)}</div><label className="tp-sort-select"><span className="tp-sr-only">เรียงตาม</span><select aria-label="เรียงตาม" className="tp-select" value={sort} onChange={(event) => setSort(event.target.value)}><option value="focus">สิ่งที่ควรทำก่อน</option><option value="time">วันและเวลา</option><option value="priority">ความสำคัญ</option><option value="created">เพิ่มล่าสุด</option></select></label></div></div>
        <div className="tp-list-caption"><span>{visibleTasks.filter((task) => task.done).length}/{visibleTasks.length} เสร็จแล้ว</span><span>•</span><span>รายการแนะนำมีเหตุผลกำกับและปรับลำดับได้</span></div>
        {visibleTasks.length === 0 ? <div className="tp-empty-state"><span className="tp-empty-icon"><CheckCircle2 size={22} /></span><strong>{search ? 'ไม่พบงานที่ตรงกับคำค้น' : filter === 'overdue' ? 'ไม่มีงานเลยกำหนด' : 'ยังไม่มีงานในช่วงนี้'}</strong><p>{search ? 'ลองใช้คำค้นอื่น' : 'เพิ่มงานใหม่ด้านบน หรือดูงานทั้งหมด'}</p></div> : <ul className="tp-tasklist">{visibleTasks.map((task) => { const overdue = isTaskOverdue(task); return <li key={task.id}><TaskItem task={task} priority={priorityMap[task.priority]} overdue={overdue} focusReason={overdue ? undefined : focusReasons.get(task.id)} onToggle={onToggle} onEdit={onEdit} onDelete={onDelete} onTaskAction={onTaskAction} /></li>; })}</ul>}
      </section>
    </section>
  );
}
