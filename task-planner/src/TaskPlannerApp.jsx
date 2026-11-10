import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import './styles/theme.css';
import './styles/modern.css';
import Sidebar from './components/Sidebar';
import EditTaskModal from './components/EditTaskModal';
import HomePage from './pages/HomePage';
import CalendarPage from './pages/CalendarPage';
import UpcomingPage from './pages/UpcomingPage';
import SettingsPage from './pages/SettingsPage';
import ReportsPage from './pages/ReportsPage';
import { PRIORITIES } from './constants/priorities';
import { startOfDay } from './utils/dateUtils';
import { captureTaskHistoryBaseline, loadSettings, loadTaskHistory, loadTasks, saveSettings, saveTasksWithEvents } from './utils/taskStorage';
import { completeTaskOccurrence, reopenTaskOccurrence } from './utils/recurrence';
import { applyTaskRecovery } from './utils/taskRecovery';
import { buildDailyReportData } from './utils/reportData';
import { dateFromLocalKey, dueMorningBriefingDate } from './utils/morningBriefing';
import { createBrowserNotificationAdapter } from './services/notifications/browserNotificationAdapter';
import { startNotificationScheduler } from './services/notifications/notificationScheduler';

function briefingSummary(report) {
  const { metrics } = report;
  if (metrics.coverage.status !== 'complete') {
    return 'ประวัติของวันก่อนหน้ายังไม่ครบ จึงไม่แสดงตัวเลขที่ยืนยันไม่ได้';
  }
  const completed = metrics.completionTrend.value;
  const onTime = metrics.onTimeRate.status === 'complete' && metrics.onTimeRate.denominator > 0
    ? ` · ตรงเวลา ${metrics.onTimeRate.numerator} งาน`
    : '';
  const action = metrics.overdueTasks.value > 0
    ? `ควรติดตามงานเลยกำหนด ${metrics.overdueTasks.value} งาน`
    : `ยังไม่เสร็จ ${metrics.remainingTasks.value} งาน`;
  return `เมื่อวานเสร็จ ${completed} งาน${onTime} · ${action}`;
}

export default function TaskPlannerApp() {
  const notificationClickHandlerRef = useRef(null);
  const notificationAdapter = useMemo(() => createBrowserNotificationAdapter({
    onClick: (details) => notificationClickHandlerRef.current?.(details),
  }), []);
  const [ready, setReady] = useState(false);
  const [theme, setTheme] = useState('light');
  const [page, setPage] = useState('home');
  const [tasks, setTasks] = useState([]);
  const [selectedDate, setSelectedDate] = useState(() => startOfDay(new Date()));
  const [editingTask, setEditingTask] = useState(null);
  const [notifyDefault, setNotifyDefault] = useState(true);
  const [leadMinutes, setLeadMinutes] = useState(15);
  const [profileName, setProfileName] = useState('ผู้ใช้งาน');
  const [morningBriefingEnabled, setMorningBriefingEnabled] = useState(true);
  const [morningBriefingTime, setMorningBriefingTime] = useState('07:00');
  const [lastBriefingDate, setLastBriefingDate] = useState('');
  const [morningBriefing, setMorningBriefing] = useState(null);
  const [reportLaunchDate, setReportLaunchDate] = useState('');
  const [taskHistoryRevision, setTaskHistoryRevision] = useState(0);
  const lastBriefingDateRef = useRef('');
  const notificationSchedulerCleanupRef = useRef(null);
  const [undoTask, setUndoTask] = useState(null);
  const [notice, setNotice] = useState('');
  const [storageError, setStorageError] = useState('');
  const [persistenceStatus, setPersistenceStatus] = useState('loading');
  const pendingHistoryEvents = useRef([]);
  const [reminderPermission, setReminderPermission] = useState(() => notificationAdapter.getPermissionStatus());

  const priorityMap = useMemo(() => Object.fromEntries(PRIORITIES.map((p) => [p.id, p])), []);

  const recordTaskEvent = (event, task, previousTask) => {
    if (!event || !task) return;
    const snapshot = (source) => ({
      ...(Number.isFinite(source.createdAt) ? { createdAt: source.createdAt } : {}),
      dueDate: source.dateKey || '',
      dueHour: Number.isInteger(source.hour) ? source.hour : 9,
      dueMinute: Number.isInteger(source.minute) ? source.minute : 0,
      priority: source.priority || 'scheduled',
      repeat: source.repeat || 'none',
      done: source.done === true,
      archived: source.archived === true,
      cancelled: source.cancelled === true,
      snoozedUntil: Number.isFinite(source.snoozedUntil) ? source.snoozedUntil : null,
      deleted: false,
    });
    const record = {
      ...event,
      id: `event-${globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`}`,
      eventVersion: 1,
      occurrenceId: task.id,
      ...(task.seriesId || (task.repeat !== 'none' && task.dateKey) ? { seriesId: task.seriesId || task.id } : {}),
      snapshot: snapshot(task),
      ...(previousTask ? { before: snapshot(previousTask) } : {}),
      ...(event.type === 'completed' ? { completedAt: event.occurredAt } : {}),
    };
    if (event.type === 'deleted') record.snapshot.deleted = true;
    pendingHistoryEvents.current.push(record);
  };

  useEffect(() => {
    let cancelled = false;
    Promise.all([loadTasks(), Promise.resolve(loadSettings())]).then(async ([loaded, storedSettings]) => {
      if (cancelled) return;
      if (!loaded.error) {
        try {
          await captureTaskHistoryBaseline(loaded.tasks);
        } catch {
          setNotice('บันทึกจุดเริ่มต้นประวัติไม่สำเร็จ รายงานในอนาคตอาจไม่ครอบคลุม');
        }
      }
      if (cancelled) return;
      setTasks(loaded.tasks);
      setTheme(storedSettings.theme);
      setNotifyDefault(storedSettings.notifyDefault);
      setLeadMinutes(storedSettings.leadMinutes);
      setProfileName(storedSettings.profileName);
      lastBriefingDateRef.current = storedSettings.lastBriefingDate;
      setMorningBriefingEnabled(storedSettings.morningBriefingEnabled);
      setMorningBriefingTime(storedSettings.morningBriefingTime);
      setLastBriefingDate(storedSettings.lastBriefingDate);
      setStorageError(loaded.error);
      setPersistenceStatus(loaded.error ? 'error' : 'ready');
      setReady(true);
    }).catch((error) => {
      if (cancelled) return;
      setStorageError(error instanceof Error ? error.message : 'โหลดข้อมูลที่บันทึกไว้ไม่สำเร็จ');
      setPersistenceStatus('error');
      setReady(true);
    });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    const syncPermission = () => setReminderPermission(notificationAdapter.getPermissionStatus());
    syncPermission();
    window.addEventListener('focus', syncPermission);
    document.addEventListener('visibilitychange', syncPermission);
    return () => {
      window.removeEventListener('focus', syncPermission);
      document.removeEventListener('visibilitychange', syncPermission);
    };
  }, [notificationAdapter]);

  useEffect(() => {
    if (!morningBriefingEnabled) setMorningBriefing(null);
  }, [morningBriefingEnabled]);

  useEffect(() => {
    if (!ready || !morningBriefingEnabled || persistenceStatus === 'error') return undefined;
    const checkBriefing = () => {
      const reportDate = dueMorningBriefingDate(new Date(), morningBriefingTime, lastBriefingDateRef.current);
      if (!reportDate) return;
      lastBriefingDateRef.current = reportDate;
      setLastBriefingDate(reportDate);
      setMorningBriefing({ date: reportDate, summary: 'กำลังเตรียมสรุปจากประวัติที่บันทึกไว้…' });
      loadTaskHistory().then((history) => {
        const report = buildDailyReportData({ date: dateFromLocalKey(reportDate), now: Date.now(), history });
        setMorningBriefing((current) => current?.date === reportDate
          ? { date: reportDate, summary: briefingSummary(report) }
          : current);
      }).catch(() => {
        setMorningBriefing((current) => current?.date === reportDate
          ? { date: reportDate, summary: 'ไม่สามารถอ่านประวัติของวันก่อนหน้าได้' }
          : current);
      });
    };
    checkBriefing();
    const timer = window.setInterval(checkBriefing, 30_000);
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') checkBriefing();
    };
    window.addEventListener('focus', checkBriefing);
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener('focus', checkBriefing);
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, [ready, morningBriefingEnabled, morningBriefingTime, persistenceStatus]);

  useEffect(() => {
    if (!ready || persistenceStatus === 'error') return undefined;
    let cancelled = false;
    setPersistenceStatus('saving');
    const events = pendingHistoryEvents.current.slice();
    const eventIds = new Set(events.map((event) => event.id));
    saveTasksWithEvents(tasks, events).then((saved) => {
      if (saved) pendingHistoryEvents.current = pendingHistoryEvents.current.filter((event) => !eventIds.has(event.id));
      if (cancelled) return;
      if (!saved) {
        setPersistenceStatus('error');
        setStorageError('บันทึกข้อมูลและประวัติในเครื่องไม่สำเร็จ ข้อมูลเดิมยังคงอยู่');
        setNotice('บันทึกงานหรือประวัติไม่สำเร็จ รายงานช่วงนี้จะไม่สมบูรณ์');
      } else {
        if (events.length) setTaskHistoryRevision((revision) => revision + 1);
        setPersistenceStatus('ready');
        setStorageError('');
      }
    });
    return () => { cancelled = true; };
  }, [tasks, ready, persistenceStatus === 'error']);

  useEffect(() => {
    if (!ready) return;
    if (!saveSettings({
      theme, notifyDefault, leadMinutes, profileName,
      morningBriefingEnabled, morningBriefingTime, lastBriefingDate,
    })) {
      setNotice('บันทึกการตั้งค่าในเบราว์เซอร์ไม่สำเร็จ');
    }
  }, [theme, notifyDefault, leadMinutes, profileName, morningBriefingEnabled, morningBriefingTime, lastBriefingDate, ready]);

  const addTask = (data) => {
    if (typeof data.title !== 'string' || !data.title.trim()) return false;
    const task = {
      id: `t-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      createdAt: Date.now(),
      done: false,
      description: '',
      dateKey: '',
      hour: 9,
      minute: 0,
      priority: 'scheduled',
      repeat: 'none',
      notify: false,
      attachments: [],
      archived: false,
      cancelled: false,
      pinned: false,
      snoozedUntil: null,
      recurrenceAnchorDate: data.repeat && data.repeat !== 'none' ? data.dateKey || '' : '',
      ...data,
      title: data.title.trim(),
    };
    setTasks((prev) => [...prev, task]);
    recordTaskEvent({ taskId: task.id, type: 'created', occurredAt: task.createdAt }, task);
    setNotice('เพิ่มงานแล้ว');
    return true;
  };

  const toggleDone = (id) => {
    const task = tasks.find((item) => item.id === id);
    if (!task || task.archived || task.cancelled) return;
    const completedAt = new Date();
    const result = task.done
      ? reopenTaskOccurrence(tasks, id, completedAt.getTime())
      : completeTaskOccurrence(tasks, id, completedAt);
    if (!result.changed) return;
    setTasks(result.tasks);
    const completedTask = result.tasks.find((item) => item.id === id);
    recordTaskEvent(result.event, completedTask);
    if (result.occurrenceCreated) {
      const occurrence = result.tasks.find((item) => item.id === result.event.nextOccurrenceId);
      recordTaskEvent({
        taskId: result.event.nextOccurrenceId,
        type: 'occurrence-created',
        occurredAt: result.event.occurredAt,
      }, occurrence);
      setNotice(`เสร็จแล้ว · สร้างงานครั้งถัดไป ${result.event.nextOccurrenceDate}`);
    }
  };

  const deleteTask = (id) => {
    const task = tasks.find((item) => item.id === id);
    if (!task) return;
    setUndoTask(task);
    setTasks((prev) => prev.filter((item) => item.id !== id));
    recordTaskEvent({ taskId: task.id, type: 'deleted', occurredAt: Date.now() }, task);
    setNotice('งานถูกลบแล้ว');
  };

  const undoDelete = () => {
    if (!undoTask) return;
    setTasks((prev) => prev.some((item) => item.id === undoTask.id) ? prev : [...prev, undoTask]);
    recordTaskEvent({ taskId: undoTask.id, type: 'delete-undone', occurredAt: Date.now() }, undoTask);
    setUndoTask(null);
    setNotice('กู้คืนงานแล้ว');
  };

  const saveEdit = (updated) => {
    const previous = tasks.find((task) => task.id === updated.id);
    setTasks((prev) => prev.map((t) => (t.id === updated.id ? updated : t)));
    if (previous) {
      const occurredAt = Date.now();
      recordTaskEvent({ taskId: updated.id, type: 'edited', occurredAt }, updated, previous);
      if (previous.dateKey !== updated.dateKey || previous.hour !== updated.hour || previous.minute !== updated.minute) {
        recordTaskEvent({ taskId: updated.id, type: 'rescheduled', occurredAt }, updated, previous);
      }
    }
    setEditingTask(null);
    setNotice('บันทึกการแก้ไขแล้ว');
  };

  const handleTaskAction = (id, action, options = {}) => {
    const result = applyTaskRecovery(tasks, id, action, options);
    if (!result.changed) return;
    setTasks(result.tasks);
    const previous = tasks.find((task) => task.id === id);
    const event = {
      ...result.event,
      ...(action === 'restore-archive' ? { type: 'archive-restored' } : {}),
      ...(action === 'restore-cancel' ? { type: 'cancel-restored' } : {}),
    };
    recordTaskEvent(event, result.task, previous);
    const notices = {
      reschedule: 'กำหนดวันใหม่แล้ว',
      snooze: 'พักงานชั่วคราวแล้ว',
      archive: 'เก็บงานเข้าคลังแล้ว · กู้คืนได้จากรายการทั้งหมด',
      'restore-archive': 'กู้คืนงานจากคลังแล้ว',
      cancel: 'ยกเลิกงานแล้ว · กู้คืนได้จากรายการทั้งหมด',
      'restore-cancel': 'คืนสถานะงานแล้ว',
      pin: 'ปักหมุดงานแล้ว',
      unpin: 'ยกเลิกปักหมุดแล้ว',
      wake: 'นำงานกลับมาแสดงแล้ว',
    };
    setNotice(notices[action] || 'อัปเดตงานแล้ว');
  };

  notificationClickHandlerRef.current = ({ taskId, occurrenceId }) => {
    const occurrence = tasks.find((task) => task.id === occurrenceId);
    const task = occurrence
      || tasks.find((item) => item.id === taskId)
      || tasks.find((item) => item.seriesId === taskId);
    if (!task) {
      setNotice('ไม่พบงานที่เกี่ยวข้องกับการแจ้งเตือนนี้');
      return;
    }

    if (task.dateKey) setSelectedDate(startOfDay(dateFromLocalKey(task.dateKey)));
    setPage('home');
    setEditingTask(task);
    setNotice(occurrence ? '' : 'ไม่พบงานรอบที่แจ้งเตือน เปิดงานหลักแทนแล้ว');
  };

  const enableNotifications = useCallback(async () => {
    try {
      await notificationAdapter.requestPermission();
    } finally {
      setReminderPermission(notificationAdapter.getPermissionStatus());
    }
    return notificationAdapter.getPermissionStatus();
  }, [notificationAdapter]);

  useEffect(() => {
    if (!ready || persistenceStatus !== 'ready' || reminderPermission !== 'granted') return undefined;
    if (notificationSchedulerCleanupRef.current) return undefined;

    const stopScheduler = startNotificationScheduler({
      leadMinutes,
      onReminders: (reminders) => {
        reminders.forEach((reminder) => {
          notificationAdapter.deliver(reminder).then((result) => {
            if (result.error || result.storageError) {
              setNotice(result.delivered
                ? 'ส่งการแจ้งเตือนแล้ว แต่บันทึกสถานะไม่สำเร็จ'
                : 'ส่งการแจ้งเตือนไม่สำเร็จ');
            } else if (!result.delivered && !result.duplicate && result.reason !== 'default') {
              setNotice(`ส่งการแจ้งเตือนไม่สำเร็จ (${result.reason || 'unknown'})`);
            }
          }).catch((error) => {
            setNotice(error instanceof Error ? `ส่งการแจ้งเตือนไม่สำเร็จ: ${error.message}` : 'ส่งการแจ้งเตือนไม่สำเร็จ');
          });
        });
      },
      onError: (error) => {
        setNotice(error instanceof Error ? `ตรวจสอบการแจ้งเตือนไม่สำเร็จ: ${error.message}` : 'ตรวจสอบการแจ้งเตือนไม่สำเร็จ');
      },
    });
    notificationSchedulerCleanupRef.current = stopScheduler;

    return () => {
      stopScheduler();
      if (notificationSchedulerCleanupRef.current === stopScheduler) {
        notificationSchedulerCleanupRef.current = null;
      }
    };
  }, [ready, persistenceStatus, reminderPermission, leadMinutes, notificationAdapter]);

  const shared = {
    theme, setTheme, selectedDate, setSelectedDate, tasks, priorityMap, setPage,
    onToggle: toggleDone, onEdit: setEditingTask, onDelete: deleteTask, onTaskAction: handleTaskAction,
  };

  return (
    <div className="tp-app" data-theme={theme}>
      {!ready ? <main className="tp-loading" role="status">กำลังโหลดรายการงานที่บันทึกไว้…</main> : <>
      {storageError ? <main className="tp-storage-recovery" role="alert"><section><h1>ไม่สามารถยืนยันข้อมูลที่บันทึกไว้ได้</h1><p>{storageError}</p><p>เพื่อป้องกันข้อมูลสูญหาย แอปหยุดการแก้ไขไว้ชั่วคราว ข้อมูลต้นทางจะไม่ถูกลบ</p><button type="button" className="tp-btn tp-btn-primary" onClick={() => window.location.reload()}>ลองโหลดข้อมูลอีกครั้ง</button></section></main> : <>
      <Sidebar page={page} setPage={setPage} />
      <main className="tp-main">
        {page === 'home' && (
          <HomePage {...shared} onAddTask={addTask} notifyDefault={notifyDefault} leadMinutes={leadMinutes} setPage={setPage} profileName={profileName} />
        )}
        {page === 'calendar' && (
          <CalendarPage {...shared} setPage={setPage} profileName={profileName} />
        )}
        {page === 'reports' && (
          <ReportsPage {...shared} onEdit={setEditingTask} profileName={profileName} historyRevision={taskHistoryRevision} initialReportDate={reportLaunchDate} />
        )}
        {page === 'upcoming' && (
          <UpcomingPage {...shared} profileName={profileName} />
        )}
        {page === 'settings' && (
          <SettingsPage
            {...shared}
            notifyDefault={notifyDefault} setNotifyDefault={setNotifyDefault}
            leadMinutes={leadMinutes} setLeadMinutes={setLeadMinutes}
            morningBriefingEnabled={morningBriefingEnabled} setMorningBriefingEnabled={setMorningBriefingEnabled}
            morningBriefingTime={morningBriefingTime} setMorningBriefingTime={setMorningBriefingTime}
            profileName={profileName} setProfileName={setProfileName}
            reminderPermission={reminderPermission} onEnableNotifications={enableNotifications}
          />
        )}
      </main>
      {editingTask && <EditTaskModal key={editingTask.id} task={editingTask} onClose={() => setEditingTask(null)} onSave={saveEdit} />}
      {morningBriefing && (
        <aside className="tp-morning-briefing-banner" role="status" aria-live="polite">
          <div>
            <strong>Morning Briefing · {new Intl.DateTimeFormat('th-TH-u-ca-gregory', { day: 'numeric', month: 'short', year: 'numeric' }).format(dateFromLocalKey(morningBriefing.date))}</strong>
            <p>{morningBriefing.summary}</p>
          </div>
          <button type="button" onClick={() => {
            setReportLaunchDate(morningBriefing.date);
            setMorningBriefing(null);
            setPage('reports');
          }}>ดูรายงาน</button>
          <button type="button" aria-label="ปิด Morning Briefing" onClick={() => setMorningBriefing(null)}>ปิด</button>
        </aside>
      )}
      {(notice || undoTask) && (
        <div className="tp-toast" role="status" aria-live="polite">
          <span>{notice}</span>
          {undoTask && <button type="button" className="tp-toast-action" onClick={undoDelete}>เลิกทำ</button>}
          <button type="button" className="tp-toast-close" onClick={() => { setNotice(''); setUndoTask(null); }} aria-label="ปิดข้อความ">ปิด</button>
        </div>
      )}
      {ready && <span className="tp-storage-status" aria-live="polite">{persistenceStatus === 'saving' ? 'กำลังบันทึก…' : persistenceStatus === 'ready' ? 'บันทึกในเครื่องแล้ว' : 'บันทึกไม่สำเร็จ'}</span>}
      </>}
      </>}
    </div>
  );
}
