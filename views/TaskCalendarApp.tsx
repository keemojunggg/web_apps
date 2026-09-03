"use client";

import SettingsView from "@/views/SettingsView";
import CalendarView from "@/views/CalendarView";
import TaskModal from "@/components/task/TaskModal";
import { useEffect, useRef, useState } from "react";
import HomeView from "@/views/HomeView";
import BottomNavigation, {
  DesktopNavigation,
} from "@/components/navigation/BottomNavigation";
import type {
  Priority,
  Recurrence,
  AppView,
  UpcomingSort,
  SettingsPage,
  NotificationChannel,
  ReminderMinute,
  PriorityColorKey,
  CalendarSettings,
  Task,
} from "@/types/task";

import {
  ITEM_HEIGHT,
  SCROLL_OFFSET,
  monthNames,
  weekDays,
} from "@/constants/calendar";
import UpcomingView from "./UpcomingView";

const initialSettings: CalendarSettings = {
  defaultView: "home",
  timeFormat: "24h",
  weekStart: "sunday",
  notifications: {
    enabled: true,
    channels: ["app"],
    reminders: ["15"],
  },
  appearance: {
    theme: "light",
    numerals: "arabic",
    priorityColors: {
      urgent: "red",
      medium: "yellow",
      low: "green",
      later: "cyan",
    },
  },
};

export default function TaskCalendarApp() {
  const [activeView, setActiveView] = useState<AppView>("home");
  const [upcomingSort, setUpcomingSort] = useState<UpcomingSort>("date");
  const [calendarSettings, setCalendarSettings] =
    useState<CalendarSettings>(initialSettings);
  const [settingsPage, setSettingsPage] = useState<SettingsPage>("main");

  const [tasks, setTasks] = useState<Task[]>([
    {
      id: 1,
      title: "ประชุมทีม Marketing",
      time: "13:00 - 14:00",
      date: "20 / 5 / 2026",
      priority: "urgent",
      recurrence: "daily",
      recurring: true,
      notification: true,
      files: ["presentation.pdf"],
    },
    {
      id: 2,
      title: "ส่งงานลูกค้า",
      time: "16:00 - 17:00",
      date: "20 / 5 / 2026",
      priority: "medium",
      recurrence: "none",
      recurring: false,
      notification: true,
      files: ["brief.docx"],
    },
  ]);

  const [newTask, setNewTask] = useState("");
  const [uploadedFiles, setUploadedFiles] = useState<string[]>([]);
  const [selectedPriority, setSelectedPriority] = useState<Priority>("medium");
  const [selectedRecurrence, setSelectedRecurrence] =
    useState<Recurrence>("none");
  const [selectedNotification, setSelectedNotification] = useState(
    initialSettings.notifications.enabled
  );
  const [selectedDate, setSelectedDate] = useState("20 / 5 / 2026");

const [selectedHour, setSelectedHour] = useState(() =>
  String(new Date().getHours()).padStart(2, "0")
);

const [selectedMinute, setSelectedMinute] = useState(() =>
  String(new Date().getMinutes()).padStart(2, "0")
);

const [shouldFocusTaskInput, setShouldFocusTaskInput] = useState(false);

  const [isCalendarOpen, setIsCalendarOpen] = useState(false);
  const [calendarMonth, setCalendarMonth] = useState(new Date(2026, 4, 1));
  const [overviewMonth, setOverviewMonth] = useState(new Date(2026, 4, 1));

  const [activeTaskId, setActiveTaskId] = useState<number | null>(null);
  const [editingTitle, setEditingTitle] = useState("");

  const hourRef = useRef<HTMLDivElement>(null);
  const minuteRef = useRef<HTMLDivElement>(null);
  const hourTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const minuteTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const taskInputRef = useRef<HTMLInputElement>(null);

  const hours = Array.from({ length: 24 }, (_, i) =>
    String(i).padStart(2, "0")
  );
  const minutes = Array.from({ length: 60 }, (_, i) =>
    String(i).padStart(2, "0")
  );

  const priorityColorPalette: Record<
    PriorityColorKey,
    {
      label: string;
      dot: string;
      active: string;
      badge: string;
    }
  > = {
    red: {
      label: "แดง",
      dot: "bg-red-500",
      active: "bg-red-100 border-red-400",
      badge: "bg-red-100 text-red-700",
    },
    orange: {
      label: "ส้ม",
      dot: "bg-orange-500",
      active: "bg-orange-100 border-orange-400",
      badge: "bg-orange-100 text-orange-700",
    },
    yellow: {
      label: "เหลือง",
      dot: "bg-yellow-400",
      active: "bg-yellow-100 border-yellow-400",
      badge: "bg-yellow-100 text-yellow-700",
    },
    green: {
      label: "เขียว",
      dot: "bg-green-500",
      active: "bg-green-100 border-green-400",
      badge: "bg-green-100 text-green-700",
    },
    cyan: {
      label: "ฟ้า",
      dot: "bg-cyan-400",
      active: "bg-cyan-100 border-cyan-400",
      badge: "bg-cyan-100 text-cyan-700",
    },
    blue: {
      label: "น้ำเงิน",
      dot: "bg-blue-500",
      active: "bg-blue-100 border-blue-400",
      badge: "bg-blue-100 text-blue-700",
    },
    purple: {
      label: "ม่วง",
      dot: "bg-purple-500",
      active: "bg-purple-100 border-purple-400",
      badge: "bg-purple-100 text-purple-700",
    },
    pink: {
      label: "ชมพู",
      dot: "bg-pink-500",
      active: "bg-pink-100 border-pink-400",
      badge: "bg-pink-100 text-pink-700",
    },
  };

  const priorityOptions: {
    value: Priority;
    label: string;
    dot: string;
    active: string;
  }[] = [
    {
      value: "urgent",
      label: "ด่วนที่สุด",
      dot: "bg-red-500",
      active: "bg-red-100 border-red-400",
    },
    {
      value: "medium",
      label: "ตามเวลา",
      dot: "bg-yellow-400",
      active: "bg-yellow-100 border-yellow-400",
    },
    {
      value: "low",
      label: "ไม่รีบ",
      dot: "bg-green-500",
      active: "bg-green-100 border-green-400",
    },
    {
      value: "later",
      label: "ค่อยทำ",
      dot: "bg-cyan-400",
      active: "bg-cyan-100 border-cyan-400",
    },
  ];

  const notificationChannelOptions: {
    value: NotificationChannel;
    label: string;
    description: string;
  }[] = [
    {
      value: "app",
      label: "ในแอป",
      description: "แสดงเตือนภายในแอป",
    },
    {
      value: "email",
      label: "Email",
      description: "ส่งการแจ้งเตือนไปที่อีเมล",
    },
    {
      value: "line",
      label: "LINE",
      description: "ส่งแจ้งเตือนไปที่ LINE",
    },
    {
      value: "sms",
      label: "SMS",
      description: "ส่งข้อความเข้าโทรศัพท์",
    },
  ];

  const reminderOptions: { value: ReminderMinute; label: string }[] = [
    { value: "5", label: "5 นาที" },
    { value: "10", label: "10 นาที" },
    { value: "15", label: "15 นาที" },
    { value: "30", label: "30 นาที" },
    { value: "60", label: "1 ชั่วโมง" },
    { value: "1440", label: "1 วัน" },
  ];

  useEffect(() => {
    hourRef.current?.scrollTo({
      top: 12 * ITEM_HEIGHT + SCROLL_OFFSET,
    });

    minuteRef.current?.scrollTo({
      top: 0 * ITEM_HEIGHT + SCROLL_OFFSET,
    });
  }, []);

  useEffect(() => {
    if (activeView !== "home" || !shouldFocusTaskInput) return;

    const timer = setTimeout(() => {
      taskInputRef.current?.focus();
      setShouldFocusTaskInput(false);
    }, 0);

    return () => clearTimeout(timer);
  }, [activeView, shouldFocusTaskInput]);

  const updateSettings = (next: Partial<CalendarSettings>) => {
    setCalendarSettings((prev) => ({
      ...prev,
      ...next,
    }));
  };

  const updateNotificationSettings = (
    next: Partial<CalendarSettings["notifications"]>
  ) => {
    setCalendarSettings((prev) => ({
      ...prev,
      notifications: {
        ...prev.notifications,
        ...next,
      },
    }));
  };

  const updateAppearanceSettings = (
    next: Partial<CalendarSettings["appearance"]>
  ) => {
    setCalendarSettings((prev) => ({
      ...prev,
      appearance: {
        ...prev.appearance,
        ...next,
      },
    }));
  };

  const getPriorityPalette = (priority: Priority) =>
    priorityColorPalette[calendarSettings.appearance.priorityColors[priority]];

  const updatePriorityColor = (
    priority: Priority,
    color: PriorityColorKey
  ) => {
    updateAppearanceSettings({
      priorityColors: {
        ...calendarSettings.appearance.priorityColors,
        [priority]: color,
      },
    });
  };

  const toRoman = (value: number) => {
    const romanValues: [number, string][] = [
      [1000, "M"],
      [900, "CM"],
      [500, "D"],
      [400, "CD"],
      [100, "C"],
      [90, "XC"],
      [50, "L"],
      [40, "XL"],
      [10, "X"],
      [9, "IX"],
      [5, "V"],
      [4, "IV"],
      [1, "I"],
    ];

    let remaining = value;
    let result = "";

    for (const [number, roman] of romanValues) {
      while (remaining >= number) {
        result += roman;
        remaining -= number;
      }
    }

    return result || "0";
  };

  const formatNumber = (value: number | string) => {
    if (calendarSettings.appearance.numerals === "arabic") {
      return String(value);
    }

    const parsed = Number(value);
    return Number.isFinite(parsed) ? toRoman(parsed) : String(value);
  };

  const formatDateDisplay = (date: string) => {
    if (calendarSettings.appearance.numerals === "arabic") return date;

    return date
      .split("/")
      .map((part) => {
        const trimmed = part.trim();
        const parsed = Number(trimmed);
        return Number.isFinite(parsed) ? toRoman(parsed) : trimmed;
      })
      .join(" / ");
  };

  const snapScroll = (
    element: HTMLDivElement,
    index: number,
    timerRef: React.MutableRefObject<ReturnType<typeof setTimeout> | null>
  ) => {
    if (timerRef.current) clearTimeout(timerRef.current);

    timerRef.current = setTimeout(() => {
      element.scrollTo({
        top: index * ITEM_HEIGHT + SCROLL_OFFSET,
        behavior: "smooth",
      });
    }, 120);
  };

  const handleHourScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const element = e.currentTarget;
    const rawIndex = Math.round(
      (element.scrollTop - SCROLL_OFFSET) / ITEM_HEIGHT
    );
    const index = Math.max(0, Math.min(23, rawIndex));

    setSelectedHour(hours[index]);
    snapScroll(element, index, hourTimerRef);
  };

  const handleMinuteScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const element = e.currentTarget;
    const rawIndex = Math.round(
      (element.scrollTop - SCROLL_OFFSET) / ITEM_HEIGHT
    );
    const index = Math.max(0, Math.min(59, rawIndex));

    setSelectedMinute(minutes[index]);
    snapScroll(element, index, minuteTimerRef);
  };

  const addTask = () => {
    const title = newTask.trim();

    if (!title) return;

    const newItem: Task = {
      id: Date.now(),
      title,
      time: `${selectedHour}:${selectedMinute}`,
      date: selectedDate,
      priority: selectedPriority,
      recurrence: selectedRecurrence,
      recurring: selectedRecurrence !== "none",
      notification: selectedNotification,
      files: uploadedFiles,
    };

    setTasks((prev) => [newItem, ...prev]);
    setNewTask("");
    setUploadedFiles([]);
  };

  const activeTask = tasks.find((task) => task.id === activeTaskId);

  const openTaskMenu = (task: Task) => {
    setActiveTaskId(task.id);
    setEditingTitle(task.title);
  };

  const deleteTask = () => {
    if (activeTaskId === null) return;

    setTasks((prev) => prev.filter((task) => task.id !== activeTaskId));
    setActiveTaskId(null);
    setEditingTitle("");
  };

  const saveTaskEdit = () => {
    const title = editingTitle.trim();

    if (!title || activeTaskId === null) return;

    setTasks((prev) =>
      prev.map((task) =>
        task.id === activeTaskId ? { ...task, title } : task
      )
    );

    setActiveTaskId(null);
    setEditingTitle("");
  };

  const visibleWeekDays =
    calendarSettings.weekStart === "monday"
      ? [...weekDays.slice(1), weekDays[0]]
      : weekDays;

  const getCalendarStartOffset = (dayIndex: number) =>
    calendarSettings.weekStart === "monday" ? (dayIndex + 6) % 7 : dayIndex;

  const formatSingleTime = (value: string) => {
    if (calendarSettings.timeFormat === "24h") return value;

    const [hourText, minuteText = "00"] = value
      .split(":")
      .map((part) => part.trim());
    const hour = Number(hourText);

    if (Number.isNaN(hour)) return value;

    const suffix = hour >= 12 ? "PM" : "AM";
    const displayHour = hour % 12 || 12;

    return `${displayHour}:${minuteText.padStart(2, "0")} ${suffix}`;
  };

  const formatTaskTime = (value: string) =>
    value
      .split("-")
      .map((part) => formatSingleTime(part.trim()))
      .join(" - ");

  const calendarYear = calendarMonth.getFullYear();
  const calendarMonthIndex = calendarMonth.getMonth();
  const firstDayOfMonth = new Date(calendarYear, calendarMonthIndex, 1).getDay();
  const calendarStartOffset = getCalendarStartOffset(firstDayOfMonth);
  const daysInMonth = new Date(calendarYear, calendarMonthIndex + 1, 0).getDate();

  const selectedDateParts = selectedDate
    .split("/")
    .map((part) => Number(part.trim()));

  const calendarDays = [
    ...Array.from({ length: calendarStartOffset }, () => null),
    ...Array.from({ length: daysInMonth }, (_, index) => index + 1),
  ];

  const changeCalendarMonth = (amount: number) => {
    setCalendarMonth(new Date(calendarYear, calendarMonthIndex + amount, 1));
  };

  const selectCalendarDate = (day: number) => {
    setSelectedDate(`${day} / ${calendarMonthIndex + 1} / ${calendarYear}`);
    setIsCalendarOpen(false);
  };

  const getDateKey = (date: string) => date.replace(/\s/g, "");

  const overviewYear = overviewMonth.getFullYear();
  const overviewMonthIndex = overviewMonth.getMonth();
  const overviewFirstDay = new Date(
    overviewYear,
    overviewMonthIndex,
    1
  ).getDay();
  const overviewStartOffset = getCalendarStartOffset(overviewFirstDay);
  const overviewDaysInMonth = new Date(
    overviewYear,
    overviewMonthIndex + 1,
    0
  ).getDate();

  const overviewDays = [
    ...Array.from({ length: overviewStartOffset }, () => null),
    ...Array.from({ length: overviewDaysInMonth }, (_, index) => index + 1),
  ];

  const changeOverviewMonth = (amount: number) => {
    setOverviewMonth(new Date(overviewYear, overviewMonthIndex + amount, 1));
  };

  const getTasksForDay = (day: number) => {
    const dateKey = getDateKey(
      `${day} / ${overviewMonthIndex + 1} / ${overviewYear}`
    );

    return tasks.filter((task) => getDateKey(task.date) === dateKey);
  };

  const openDayForAdd = (day: number) => {
    const nextDate = `${day} / ${overviewMonthIndex + 1} / ${overviewYear}`;

    setSelectedDate(nextDate);
    setCalendarMonth(new Date(overviewYear, overviewMonthIndex, 1));
    setIsCalendarOpen(false);
    setActiveView("home");
    setShouldFocusTaskInput(true);
  };

  const selectedDateTasks = tasks.filter(
    (task) => getDateKey(task.date) === getDateKey(selectedDate)
  );

  const isDarkTheme = calendarSettings.appearance.theme === "dark";

  const priorityRank: Record<Priority, number> = {
    urgent: 0,
    medium: 1,
    low: 2,
    later: 3,
  };

  const getTaskDateTime = (task: Task) => {
    const [day, month, year] = task.date
      .split("/")
      .map((part) => Number(part.trim()));

    const startTime = task.time.split("-")[0].trim();
    const [hour, minute] = startTime
      .split(":")
      .map((part) => Number(part.trim()));

    return new Date(year, month - 1, day, hour || 0, minute || 0).getTime();
  };

  const sortedUpcomingTasks = [...tasks].sort((a, b) => {
    const dateDiff = getTaskDateTime(a) - getTaskDateTime(b);
    const priorityDiff = priorityRank[a.priority] - priorityRank[b.priority];

    if (upcomingSort === "date") {
      return dateDiff || priorityDiff;
    }

    return priorityDiff || dateDiff;
  });

  const setPickerToCurrentTime = () => {
    const now = new Date();
    const currentHour = String(now.getHours()).padStart(2, "0");
    const currentMinute = String(now.getMinutes()).padStart(2, "0");

    setSelectedHour(currentHour);
    setSelectedMinute(currentMinute);

    setTimeout(() => {
      hourRef.current?.scrollTo({
        top: Number(currentHour) * ITEM_HEIGHT + SCROLL_OFFSET,
        behavior: "smooth",
      });

      minuteRef.current?.scrollTo({
        top: Number(currentMinute) * ITEM_HEIGHT + SCROLL_OFFSET,
        behavior: "smooth",
      });
    }, 0);
  };

  const toggleNotificationChannel = (channel: NotificationChannel) => {
    const channels = calendarSettings.notifications.channels;

    updateNotificationSettings({
      channels: channels.includes(channel)
        ? channels.filter((item) => item !== channel)
        : [...channels, channel],
    });
  };

  const toggleReminderMinute = (minute: ReminderMinute) => {
    const reminders = calendarSettings.notifications.reminders;

    updateNotificationSettings({
      reminders: reminders.includes(minute)
        ? reminders.filter((item) => item !== minute)
        : [...reminders, minute].sort((a, b) => Number(a) - Number(b)),
    });
  };

  const navigationItems = [
    {
      view: "home" as AppView,
      icon: "🏠",
      label: "หน้าหลัก",
    },
    {
      view: "calendar" as AppView,
      icon: "📅",
      label: "ปฏิทิน",
    },
    {
      view: "upcoming" as AppView,
      icon: "⏰",
      label: "กำลังจะมาถึง",
    },
    {
      view: "settings" as AppView,
      icon: "⚙️",
      label: "ตั้งค่า",
    },
  ];

  const handleNavigationClick = (view: AppView) => {
    if (view === "home") {
      setActiveView("home");
      setPickerToCurrentTime();
      return;
    }

    if (view === "settings") {
      setActiveView("settings");
      setSettingsPage("main");
      return;
    }

    setActiveView(view);
  };

  const renderSettingsHeader = (title: string) => (
    <div className="flex items-center gap-3">
      {settingsPage !== "main" && (
        <button
          type="button"
          onClick={() => setSettingsPage("main")}
          className="h-10 w-10 rounded-full bg-gray-100 text-xl"
        >
          ←
        </button>
      )}

      <div>
        <p className="text-sm font-semibold text-indigo-500">Calendar App</p>
        <h2 className="mt-1 text-2xl font-bold text-gray-900">{title}</h2>
      </div>
    </div>
  );

  return (
    <div
      className={`min-h-screen flex justify-center items-center p-4 lg:p-8 ${
        isDarkTheme ? "bg-gray-950" : "bg-gray-100"
      }`}
    >
      <div
        className={`relative flex h-[calc(100vh-2rem)] w-full max-w-md flex-col overflow-hidden rounded-[40px] border shadow-2xl lg:h-[calc(100vh-4rem)] lg:max-w-7xl lg:flex-row lg:rounded-[32px] ${
          isDarkTheme
            ? "border-gray-800 bg-gray-900"
            : "border-gray-200 bg-white"
        }`}
      >
        <DesktopNavigation
  activeView={activeView}
  isDarkTheme={isDarkTheme}
  items={navigationItems}
  onNavigate={handleNavigationClick}
/>

        <div
          className={`flex-1 overflow-y-auto lg:min-w-0 ${
            isDarkTheme
              ? "[&_.bg-white]:bg-gray-900 [&_.bg-gray-50]:bg-gray-800 [&_.bg-gray-100]:bg-gray-800 [&_.border-gray-200]:border-gray-700 [&_.text-gray-900]:text-gray-100 [&_.text-gray-700]:text-gray-200 [&_.text-gray-500]:text-gray-400"
              : ""
          }`}
        >
          {activeView === "home" && (
<HomeView
  selectedDate={selectedDate}
  isCalendarOpen={isCalendarOpen}
  setIsCalendarOpen={setIsCalendarOpen}
  formatDateDisplay={formatDateDisplay}

  changeCalendarMonth={changeCalendarMonth}
  calendarMonthIndex={calendarMonthIndex}
  calendarYear={calendarYear}
  formatNumber={formatNumber}
  visibleWeekDays={visibleWeekDays}
  calendarDays={calendarDays}
  selectedDateParts={selectedDateParts}
  selectCalendarDate={selectCalendarDate}

  hours={hours}
  minutes={minutes}
  selectedHour={selectedHour}
  selectedMinute={selectedMinute}

  hourRef={hourRef}
  minuteRef={minuteRef}

  handleHourScroll={handleHourScroll}
  handleMinuteScroll={handleMinuteScroll}

  newTask={newTask}
  setNewTask={setNewTask}
  addTask={addTask}

  taskInputRef={taskInputRef}

  selectedDateTasks={selectedDateTasks}

  openTaskMenu={openTaskMenu}

  formatTaskTime={formatTaskTime}

  getPriorityPalette={getPriorityPalette}

  priorityOptions={priorityOptions}

  selectedPriority={selectedPriority}
  setSelectedPriority={setSelectedPriority}

  selectedRecurrence={selectedRecurrence}
  setSelectedRecurrence={setSelectedRecurrence}

  selectedNotification={selectedNotification}
  setSelectedNotification={setSelectedNotification}

  uploadedFiles={uploadedFiles}
  setUploadedFiles={setUploadedFiles}
/>
)}
          {activeView === "calendar" && (
  <CalendarView
    visibleWeekDays={visibleWeekDays}
    overviewDays={overviewDays}
    overviewMonthIndex={overviewMonthIndex}
    overviewYear={overviewYear}
    getTasksForDay={getTasksForDay}
    openDayForAdd={openDayForAdd}
    changeOverviewMonth={changeOverviewMonth}
    formatNumber={formatNumber}
    getPriorityPalette={getPriorityPalette}
    goHome={() => setActiveView("home")}
  />
)}
          {activeView === "upcoming" && (
  <UpcomingView
    sortedUpcomingTasks={sortedUpcomingTasks}
    upcomingSort={upcomingSort}
    setUpcomingSort={setUpcomingSort}
    formatDateDisplay={formatDateDisplay}
    formatTaskTime={formatTaskTime}
    getPriorityPalette={getPriorityPalette}
  />
)}
          {activeView === "settings" && (
  <SettingsView
    settingsPage={settingsPage}
    setSettingsPage={setSettingsPage}
    calendarSettings={calendarSettings}
    updateSettings={updateSettings}
    updateNotificationSettings={updateNotificationSettings}
    updateAppearanceSettings={updateAppearanceSettings}
    setActiveView={setActiveView}
    tasks={tasks}
    selectedDateTasks={selectedDateTasks}
    priorityOptions={priorityOptions}
    priorityColorPalette={priorityColorPalette}
    getPriorityPalette={getPriorityPalette}
    updatePriorityColor={updatePriorityColor}
    notificationChannelOptions={notificationChannelOptions}
    reminderOptions={reminderOptions}
    toggleNotificationChannel={toggleNotificationChannel}
    toggleReminderMinute={toggleReminderMinute}
    renderSettingsHeader={renderSettingsHeader}
  />
)}
        </div>

       {activeTask && (
  <TaskModal
    task={activeTask}
    editingTitle={editingTitle}
    setEditingTitle={setEditingTitle}
    onSave={saveTaskEdit}
    onDelete={deleteTask}
    onClose={() => setActiveTaskId(null)}
  />
)}

        <BottomNavigation
  activeView={activeView}
  isDarkTheme={isDarkTheme}
  items={navigationItems}
  onNavigate={handleNavigationClick}
/>
      </div>
    </div>
  );
}
