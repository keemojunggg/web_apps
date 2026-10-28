import { useState, useMemo, useEffect } from 'react';
import { ChevronLeft, ChevronRight, Plus } from 'lucide-react';
import HeaderBar from '../components/HeaderBar';
import TaskItem from '../components/TaskItem';
import { getMonthMatrix, toKey, startOfDay } from '../utils/dateUtils';
import { MONTHS_TH, WEEKDAYS_TH } from '../constants/calendar';
import { moveCalendarDate } from '../utils/calendarNavigation.js';

export default function CalendarPage({
  theme, setTheme, profileName,
  tasks, priorityMap,
  selectedDate, setSelectedDate, setPage,
  onToggle, onEdit, onDelete,
}) {
  const [viewDate, setViewDate] = useState(() => new Date(selectedDate));
  const [view, setView] = useState('month');
  useEffect(() => setViewDate(new Date(selectedDate)), [selectedDate]);
  const weeks = useMemo(() => getMonthMatrix(viewDate.getFullYear(), viewDate.getMonth()), [viewDate]);
  const todayKey = toKey(startOfDay(new Date()));
  const selectedKey = toKey(selectedDate);

  const tasksByDate = useMemo(() => {
    const map = {};
    tasks.filter((task) => !task.archived && !task.cancelled).forEach((t) => { (map[t.dateKey] ||= []).push(t); });
    return map;
  }, [tasks]);

  const dayTasks = (tasksByDate[selectedKey] || [])
    .slice()
    .sort((a, b) => a.hour * 60 + a.minute - (b.hour * 60 + b.minute));

  const weekStart = new Date(viewDate);
  weekStart.setDate(weekStart.getDate() - weekStart.getDay());
  const weekDays = Array.from({ length: 7 }, (_, index) => {
    const date = new Date(weekStart);
    date.setDate(weekStart.getDate() + index);
    return date;
  });
  const visibleDates = view === 'day' ? [viewDate] : view === 'week' ? weekDays : weeks.flat();
  const changeViewDate = (direction) => {
    const synchronizedDate = moveCalendarDate(selectedDate, view, direction);
    setSelectedDate(synchronizedDate);
    setViewDate(synchronizedDate);
  };
  const monthTitle = `${MONTHS_TH[viewDate.getMonth()]} ${viewDate.getFullYear()}`;

  return (
    <section className="tp-page">
      <HeaderBar theme={theme} setTheme={setTheme} setPage={setPage} profileName={profileName}><div className="tp-heading-copy"><span className="tp-eyebrow">วางแผนล่วงหน้า</span><h1 className="tp-page-title">ปฏิทิน</h1></div></HeaderBar>

      <div className="tp-card tp-calendar-card">
        <div className="tp-calendar-toolbar">
          <div className="tp-cal-nav">
          <button type="button" className="tp-icon-btn" onClick={() => changeViewDate(-1)} aria-label="ช่วงเวลาก่อนหน้า">
            <ChevronLeft size={17} />
          </button>
          <span className="tp-cal-month">{view === 'day' ? new Intl.DateTimeFormat('th-TH-u-ca-gregory', { day: 'numeric', month: 'long', year: 'numeric' }).format(viewDate) : view === 'week' ? `${new Intl.DateTimeFormat('th-TH-u-ca-gregory', { day: 'numeric', month: 'short' }).format(weekDays[0])} – ${new Intl.DateTimeFormat('th-TH-u-ca-gregory', { day: 'numeric', month: 'short', year: 'numeric' }).format(weekDays[6])}` : monthTitle}</span>
          <button type="button" className="tp-icon-btn" onClick={() => changeViewDate(1)} aria-label="ช่วงเวลาถัดไป">
            <ChevronRight size={17} />
          </button>
          <button type="button" className="tp-btn tp-btn-ghost tp-btn-sm" onClick={() => { const today = startOfDay(new Date()); setSelectedDate(today); setViewDate(today); }}>วันนี้</button>
          </div>
          <div className="tp-segmented tp-calendar-views" role="group" aria-label="รูปแบบปฏิทิน">{[['day', 'วัน'], ['week', 'สัปดาห์'], ['month', 'เดือน']].map(([id, label]) => <button key={id} type="button" className={view === id ? 'is-active' : ''} aria-pressed={view === id} onClick={() => setView(id)}>{label}</button>)}</div>
        </div>

        <div className={`tp-cal-grid ${view === 'week' ? 'is-week-view' : ''} ${view === 'day' ? 'is-day-view' : ''}`}>
          {view !== 'day' && <>
          {WEEKDAYS_TH.map((w) => <div key={w} className="tp-cal-weekday">{w}</div>)}
          </>}
          {visibleDates.map((date, i) => {
            const key = toKey(date);
            const inMonth = view !== 'month' || date.getMonth() === viewDate.getMonth();
            const dayList = tasksByDate[key] || [];
            return (
              <button
                key={i}
                type="button"
                className={`tp-cal-cell ${inMonth ? '' : 'is-outside'} ${key === todayKey ? 'is-today' : ''} ${key === selectedKey ? 'is-selected' : ''} ${view === 'day' ? 'is-large-day' : ''}`}
                onClick={() => { setSelectedDate(startOfDay(date)); if (!inMonth) setViewDate(date); }}
                aria-pressed={key === selectedKey}
                aria-label={`${new Intl.DateTimeFormat('th-TH-u-ca-gregory', { dateStyle: 'full' }).format(date)} มี ${dayList.length} งาน`}
              >
                {view === 'week' && <span className="tp-cal-weekday-label">{WEEKDAYS_TH[date.getDay()]}</span>}
                {view === 'day' && <span className="tp-cal-weekday-label">{new Intl.DateTimeFormat('th-TH-u-ca-gregory', { weekday: 'long' }).format(date)}</span>}
                <span className="tp-cal-date">{date.getDate()}</span>
                {dayList.length > 0 && (
                  <span className="tp-cal-dots">
                    {dayList.slice(0, view === 'day' ? 5 : 3).map((t) => (
                      <span key={t.id} className="tp-cal-dot" style={{ background: priorityMap[t.priority]?.color || 'var(--accent)' }} />
                    ))}
                    {dayList.length > (view === 'day' ? 5 : 3) && <span className="tp-cal-more">+{dayList.length - (view === 'day' ? 5 : 3)}</span>}
                    {view !== 'month' && <span className="tp-cal-day-count">{dayList.length} งาน</span>}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      <div className="tp-card tp-cal-daypanel">
        <div className="tp-cal-daypanel-head">
          <div><span className="tp-eyebrow">{dayTasks.length} รายการ</span><h2>{new Intl.DateTimeFormat('th-TH-u-ca-gregory', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(selectedDate)}</h2></div>
          <button type="button" className="tp-btn tp-btn-ghost tp-btn-sm" onClick={() => setPage('home')}>
            <Plus size={14} /> เพิ่มงานวันนี้
          </button>
        </div>
        {dayTasks.length === 0 ? (
          <p className="tp-empty">ไม่มีงานในวันนี้</p>
        ) : (
          <ul className="tp-tasklist">
            {dayTasks.map((t) => (
              <li key={t.id}>
                <TaskItem task={t} priority={priorityMap[t.priority]} onToggle={onToggle} onEdit={onEdit} onDelete={onDelete} />
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
