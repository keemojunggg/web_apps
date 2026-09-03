import React from "react";

import {
  monthNames,
} from "@/constants/calendar";

import type { Priority, Recurrence, Task } from "@/types/task";

type Props = {
  selectedDate: string;

  isCalendarOpen: boolean;

  setIsCalendarOpen: React.Dispatch<
    React.SetStateAction<boolean>
  >;

  formatDateDisplay: (date: string) => string;

  changeCalendarMonth: (direction: number) => void;

  calendarMonthIndex: number;

  calendarYear: number;

  formatNumber: (value: number) => string;

  visibleWeekDays: string[];

  calendarDays: (number | null)[];

  selectedDateParts: number[];

  selectCalendarDate: (day: number) => void;

  hours: string[];

minutes: string[];

selectedHour: string;

selectedMinute: string;

  hourRef: React.RefObject<HTMLDivElement | null>;

  minuteRef: React.RefObject<HTMLDivElement | null>;

  handleHourScroll: (
  e: React.UIEvent<HTMLDivElement>
) => void;

handleMinuteScroll: (
  e: React.UIEvent<HTMLDivElement>
) => void;

  newTask: string;

  setNewTask: React.Dispatch<
    React.SetStateAction<string>
  >;

  addTask: () => void;

  taskInputRef: React.RefObject<HTMLInputElement | null>;

  selectedDateTasks: Task[];

  openTaskMenu: (task: Task) => void;

  formatTaskTime: (time: string) => string;

  getPriorityPalette: (
  priority: Priority
) => {
  label: string;
  dot: string;
  active: string;
  badge: string;
};

selectedPriority: Priority;

setSelectedPriority: React.Dispatch<
  React.SetStateAction<Priority>
>;

selectedRecurrence: Recurrence;

setSelectedRecurrence: React.Dispatch<
  React.SetStateAction<Recurrence>
>;

selectedNotification: boolean;

setSelectedNotification: React.Dispatch<
  React.SetStateAction<boolean>
>;

priorityOptions: {
  value: Priority;
  label: string;
}[];

uploadedFiles: string[];

  setUploadedFiles: React.Dispatch<
    React.SetStateAction<string[]>
  >;
};

export default function HomeView({
  selectedDate,
  isCalendarOpen,
  setIsCalendarOpen,
  formatDateDisplay,

  changeCalendarMonth,
  calendarMonthIndex,
  calendarYear,
  formatNumber,
  visibleWeekDays,
  calendarDays,
  selectedDateParts,
  selectCalendarDate,

  hours,
  minutes,
  selectedHour,
  selectedMinute,
  hourRef,
  minuteRef,
  handleHourScroll,
  handleMinuteScroll,

  newTask,
  setNewTask,
  addTask,
  taskInputRef,

  selectedDateTasks,
  openTaskMenu,
  formatTaskTime,
  getPriorityPalette,

  priorityOptions,
  selectedPriority,
  setSelectedPriority,
  selectedRecurrence,
  setSelectedRecurrence,
  selectedNotification,
  setSelectedNotification,

  setUploadedFiles,
}: Props) {
  const recurrenceOptions: {
    value: Recurrence;
    label: string;
    description: string;
  }[] = [
    {
      value: "none",
      label: "ไม่ทำซ้ำ",
      description: "เพิ่มรายการครั้งเดียวในวันที่เลือก",
    },
    {
      value: "daily",
      label: "ทุกวัน",
      description: "เหมาะกับงานประจำรายวัน",
    },
    {
      value: "monthly",
      label: "ทุกเดือน",
      description: "เหมาะกับงานที่เกิดซ้ำรายเดือน",
    },
  ];

  return (
    <>
      {/* HEADER */}
      <div className="flex items-center justify-between gap-3 px-5 pt-5">
        <div className="h-12 w-12 shrink-0 rounded-full bg-indigo-500 flex items-center justify-center text-white text-xl shadow-lg sm:h-14 sm:w-14 sm:text-2xl">
          📅
        </div>

        <div className="relative min-w-0 flex-1">
          <button
            type="button"
            onClick={() =>
              setIsCalendarOpen((prev) => !prev)
            }
            className="w-full truncate bg-transparent text-center text-2xl font-bold tracking-wide text-gray-900 outline-none sm:text-3xl"
          >
            {formatDateDisplay(selectedDate)}
          </button>

          {isCalendarOpen && (
            <div className="absolute left-1/2 top-12 z-50 w-80 -translate-x-1/2 rounded-3xl border border-gray-200 bg-white p-4 shadow-2xl">
              <div className="mb-4 flex items-center justify-between">
                <button
                  type="button"
                  onClick={() =>
                    changeCalendarMonth(-1)
                  }
                  className="h-10 w-10 rounded-full bg-gray-100 text-xl font-bold text-gray-700"
                >
                  ‹
                </button>

                <div className="text-center">
                  <div className="text-lg font-bold text-gray-900">
                    {monthNames[calendarMonthIndex]}
                  </div>

                  <div className="text-sm text-gray-500">
                    {formatNumber(calendarYear)}
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() =>
                    changeCalendarMonth(1)
                  }
                  className="h-10 w-10 rounded-full bg-gray-100 text-xl font-bold text-gray-700"
                >
                  ›
                </button>
              </div>

              <div className="grid grid-cols-7 gap-1 text-center text-sm text-gray-400">
                {visibleWeekDays.map((day) => (
                  <div
                    key={day}
                    className="py-2 font-semibold"
                  >
                    {day}
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-7 gap-1">
                {calendarDays.map((day, index) => {
                  if (!day) {
                    return (
                      <div
                        key={`empty-${index}`}
                        className="h-10"
                      />
                    );
                  }

                  const isSelected =
                    day === selectedDateParts[0] &&
                    calendarMonthIndex + 1 ===
                      selectedDateParts[1] &&
                    calendarYear ===
                      selectedDateParts[2];

                  return (
                    <button
                      key={day}
                      type="button"
                      onClick={() =>
                        selectCalendarDate(day)
                      }
                      className={`h-10 rounded-full text-sm font-semibold transition ${
                        isSelected
                          ? "bg-indigo-500 text-white"
                          : "text-gray-700 hover:bg-indigo-50"
                      }`}
                    >
                      {formatNumber(day)}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        <div className="h-11 w-11 shrink-0 rounded-full bg-gray-100 flex items-center justify-center text-lg sm:h-12 sm:w-12 sm:text-xl">
          👤
        </div>
      </div>

      <div className="lg:grid lg:grid-cols-[minmax(0,1.35fr)_minmax(320px,0.85fr)] lg:gap-6 lg:px-6 lg:pb-6">
        <div className="lg:min-w-0">
      {/* TIME PICKER */}
      <div className="px-4 mt-5 lg:px-0">
        <div className="bg-white rounded-3xl border border-gray-200 shadow-md p-6">
          <label className="block text-gray-500 mb-4 text-sm">
            เวลา
          </label>

          <div className="relative flex justify-center items-center gap-4">
            <div className="absolute pointer-events-none w-64 h-16 border-y-2 border-indigo-200 top-1/2 -translate-y-1/2 z-20" />

            <div
              ref={hourRef}
              onScroll={handleHourScroll}
              className="relative z-10 h-40 overflow-y-scroll scroll-smooth snap-y snap-mandatory rounded-3xl bg-gray-50 w-24 text-center"
              style={{ scrollbarWidth: "none" }}
            >
              <div className="h-16" />

              {hours.map((hour) => {
                const isActive =
                  hour === selectedHour;

                return (
                  <div
                    key={hour}
                    className={`snap-center h-16 flex items-center justify-center text-3xl transition-all duration-150 ${
                      isActive
                        ? "text-indigo-600 font-bold scale-110"
                        : "text-gray-400 scale-90"
                    }`}
                  >
                    {hour}
                  </div>
                );
              })}

              <div className="h-16" />
            </div>

            <div className="text-5xl font-bold text-gray-400">
              :
            </div>

            <div
              ref={minuteRef}
              onScroll={handleMinuteScroll}
              className="relative z-10 h-40 overflow-y-scroll scroll-smooth snap-y snap-mandatory rounded-3xl bg-gray-50 w-24 text-center"
              style={{ scrollbarWidth: "none" }}
            >
              <div className="h-16" />

              {minutes.map((minute) => {
                const isActive =
                  minute === selectedMinute;

                return (
                  <div
                    key={minute}
                    className={`snap-center h-16 flex items-center justify-center text-3xl transition-all duration-150 ${
                      isActive
                        ? "text-indigo-600 font-bold scale-110"
                        : "text-gray-400 scale-90"
                    }`}
                  >
                    {minute}
                  </div>
                );
              })}

              <div className="h-16" />
            </div>
          </div>
        </div>
      </div>

      {/* INPUT */}
      <div className="px-5 mt-5 lg:px-0">
        <div className="bg-white rounded-3xl border border-gray-200 shadow-md px-4 py-4 flex items-center gap-3">
          <input
            ref={taskInputRef}
            value={newTask}
            onChange={(e) =>
              setNewTask(e.target.value)
            }
            onKeyDown={(e) => {
              if (e.key === "Enter") addTask();
            }}
            placeholder="เพิ่มงานใหม่"
            className="w-full outline-none text-lg text-gray-700"
          />
        </div>
      </div>

      {/* TASK LIST */}
      <div className="px-5 mt-5 space-y-3 lg:px-0">
        {selectedDateTasks.map((task) => (
          <button
            key={task.id}
            type="button"
            onClick={() => openTaskMenu(task)}
            className="w-full text-left bg-white border border-gray-200 rounded-3xl p-4 shadow-sm"
          >
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">
                  {task.title}
                </h3>

                <p className="text-gray-500 mt-1">
                  {formatTaskTime(task.time)}
                </p>
              </div>

              <div
                className={`w-4 h-4 rounded-full ${
                  getPriorityPalette(task.priority)
                    .dot
                }`}
              />
            </div>

            {(task.recurring || task.notification) && (
              <div className="mt-3 flex flex-wrap gap-2 text-xs font-semibold">
                {task.recurring && (
                  <span className="rounded-full bg-indigo-50 px-3 py-1 text-indigo-600">
                    {task.recurrence === "daily" ? "ทุกวัน" : "ทุกเดือน"}
                  </span>
                )}

                {task.notification && (
                  <span className="rounded-full bg-amber-50 px-3 py-1 text-amber-600">
                    แจ้งเตือน
                  </span>
                )}
              </div>
            )}
          </button>
        ))}
      </div>

      {/* PRIORITY */}
        </div>

        <div className="lg:min-w-0">
      <div className="mx-5 mt-5 bg-white border border-gray-200 rounded-3xl p-5 shadow-sm lg:mx-0">
        <h3 className="text-lg font-semibold mb-4">
          ระดับความสำคัญ
        </h3>

        <div className="space-y-3">
          {priorityOptions.map((item) => (
            <button
              key={item.value}
              type="button"
              onClick={() =>
                setSelectedPriority(item.value)
              }
              className={`w-full flex items-center gap-3 p-3 rounded-2xl border transition text-left ${
                selectedPriority === item.value
                  ? getPriorityPalette(item.value)
                      .active
                  : "bg-gray-50 border-transparent"
              }`}
            >
              <div
                className={`w-4 h-4 rounded-full ${
                  getPriorityPalette(item.value)
                    .dot
                }`}
              />

              <span>{item.label}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="mx-5 mt-5 bg-white border border-gray-200 rounded-3xl p-5 shadow-sm lg:mx-0">
        <h3 className="text-lg font-semibold mb-4">
          การทำซ้ำ
        </h3>

        <div className="space-y-3">
          {recurrenceOptions.map((item) => (
            <button
              key={item.value}
              type="button"
              onClick={() =>
                setSelectedRecurrence(item.value)
              }
              className={`w-full rounded-2xl border p-3 text-left transition ${
                selectedRecurrence === item.value
                  ? "border-indigo-400 bg-indigo-50"
                  : "border-transparent bg-gray-50"
              }`}
            >
              <div className="flex items-center gap-3">
                <div
                  className={`flex h-6 w-6 items-center justify-center rounded-full text-sm font-bold ${
                    selectedRecurrence === item.value
                      ? "bg-indigo-500 text-white"
                      : "bg-gray-200 text-transparent"
                  }`}
                >
                  ✓
                </div>

                <div>
                  <p className="font-semibold text-gray-900">
                    {item.label}
                  </p>
                  <p className="mt-1 text-sm text-gray-500">
                    {item.description}
                  </p>
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>

      <div className="mx-5 mt-5 bg-white border border-gray-200 rounded-3xl p-5 shadow-sm lg:mx-0">
        <h3 className="text-lg font-semibold mb-4">
          การแจ้งเตือน
        </h3>

        <button
          type="button"
          onClick={() =>
            setSelectedNotification((prev) => !prev)
          }
          className={`flex w-full items-center gap-4 rounded-2xl border p-4 text-left transition ${
            selectedNotification
              ? "border-indigo-400 bg-indigo-50"
              : "border-transparent bg-gray-50"
          }`}
        >
          <span
            className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full border text-sm font-bold ${
              selectedNotification
                ? "border-indigo-500 bg-indigo-500 text-white"
                : "border-gray-300 bg-white text-transparent"
            }`}
          >
            ✓
          </span>

          <span className="min-w-0 flex-1">
            <span className="block font-semibold text-gray-900">
              แจ้งเตือนก่อนถึงเวลา
            </span>
            <span className="mt-1 block text-sm text-gray-500">
              {selectedNotification
                ? "เปิดอยู่"
                : "ปิดอยู่"}
            </span>
          </span>
        </button>
      </div>

      {/* FILE */}
      <div className="px-6 mt-5 lg:px-0">
        <h3 className="text-2xl font-semibold text-gray-900 mb-4">
          Add files
        </h3>

        <label className="flex-1 bg-gray-100 rounded-3xl py-6 text-4xl hover:scale-105 transition shadow-md flex items-center justify-center cursor-pointer">
          📎

          <input
            type="file"
            className="hidden"
            onChange={(e) => {
              const file =
                e.target.files?.[0];

              if (!file) return;

              setUploadedFiles((prev) => [
                ...prev,
                file.name,
              ]);
            }}
          />
        </label>
      </div>

      {/* BUTTON */}
      <div className="px-5 mt-6 mb-6 lg:px-0">
        <button
          type="button"
          onClick={addTask}
          className="w-full h-14 rounded-2xl flex items-center justify-center gap-2 text-lg font-semibold transition bg-indigo-500 text-white"
        >
          <span className="text-2xl">✓</span>

          <span>ยืนยันรายการ</span>
        </button>
      </div>
        </div>
      </div>
    </>
  );
}
