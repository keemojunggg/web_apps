import { useMemo, useState } from 'react';
import { Search, X, SearchX } from 'lucide-react';
import HeaderBar from '../components/HeaderBar';
import TaskItem from '../components/TaskItem';
import { isTaskOverdue, selectAndSortTasks } from '../utils/taskManagement';

export default function UpcomingPage({ theme, setTheme, setPage, profileName, tasks, priorityMap, onToggle, onEdit, onDelete, onTaskAction }) {
  const [sortMode, setSortMode] = useState('date');
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');
  const visibleTasks = useMemo(() => selectAndSortTasks(tasks, {
    query: search,
    filter,
    sort: sortMode === 'date' ? 'time' : sortMode,
  }), [tasks, filter, search, sortMode]);

  return (
    <section className="tp-page">
      <HeaderBar theme={theme} setTheme={setTheme} setPage={setPage} profileName={profileName}><div className="tp-heading-copy"><span className="tp-eyebrow">ติดตามทุกสิ่งในที่เดียว</span><h1 className="tp-page-title">งานทั้งหมด</h1></div></HeaderBar>
      <section className="tp-card tp-tasklist-card">
        <div className="tp-list-heading"><div><h2>รายการงาน</h2><p>{visibleTasks.length} งาน</p></div><label className="tp-sort-select"><span>เรียงตาม</span><select className="tp-select" value={sortMode} onChange={(event) => setSortMode(event.target.value)}><option value="date">วันและเวลา</option><option value="priority">ความสำคัญ</option><option value="created">เพิ่มล่าสุด</option></select></label></div>
        <label className="tp-search"><Search size={16} /><input aria-label="ค้นหาทุกงาน" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="ค้นหาชื่องานหรือบันทึก" />{search && <button type="button" aria-label="ล้างคำค้น" onClick={() => setSearch('')}><X size={14} /></button>}</label>
        <div className="tp-filter-tabs" role="group" aria-label="กรองงาน">{[['all', 'ทั้งหมด'], ['active', 'ยังไม่เสร็จ'], ['completed', 'เสร็จแล้ว'], ['overdue', 'เลยกำหนด'], ['archived', 'เก็บถาวร'], ['cancelled', 'ยกเลิกแล้ว']].map(([id, label]) => <button key={id} type="button" className={filter === id ? 'is-active' : ''} aria-pressed={filter === id} onClick={() => setFilter(id)}>{label}</button>)}</div>
        {visibleTasks.length ? <ul className="tp-tasklist">{visibleTasks.map((task) => <li key={task.id}>
          <TaskItem task={task} priority={priorityMap[task.priority]} overdue={isTaskOverdue(task)} showDate onToggle={onToggle} onEdit={onEdit} onDelete={onDelete} />
          {(task.archived || task.cancelled || (Number.isFinite(task.snoozedUntil) && task.snoozedUntil > Date.now())) && <div className="tp-task-state-actions">
            {task.archived && <><span className="tp-task-state-label">เก็บถาวรแล้ว</span><button type="button" className="tp-recovery-action" onClick={() => onTaskAction(task.id, 'restore-archive')}>กู้คืนงาน</button></>}
            {task.cancelled && <><span className="tp-task-state-label">ยกเลิกแล้ว</span><button type="button" className="tp-recovery-action" onClick={() => onTaskAction(task.id, 'restore-cancel')}>คืนสถานะงาน</button></>}
            {!task.archived && !task.cancelled && Number.isFinite(task.snoozedUntil) && task.snoozedUntil > Date.now() && <><span className="tp-task-state-label">พักถึง {new Intl.DateTimeFormat('th-TH-u-ca-gregory', { dateStyle: 'short', timeStyle: 'short' }).format(task.snoozedUntil)}</span><button type="button" className="tp-recovery-action" onClick={() => onTaskAction(task.id, 'wake')}>ปลุกตอนนี้</button></>}
          </div>}
        </li>)}</ul> : <div className="tp-empty-state"><span className="tp-empty-icon"><SearchX size={22} /></span><strong>{search ? 'ไม่พบงานที่ตรงกับคำค้น' : 'ไม่มีงานในหมวดนี้'}</strong><p>ลองเปลี่ยนตัวกรอง หรือสร้างงานใหม่จากหน้าหลัก</p></div>}
      </section>
    </section>
  );
}
