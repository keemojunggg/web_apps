import { monthNames } from "@/constants/calendar";

type Props = {
  visibleWeekDays: string[];
  overviewDays: (number | null)[];
  overviewMonthIndex: number;
  overviewYear: number;
  getTasksForDay: (day: number) => any[];
  openDayForAdd: (day: number) => void;
  changeOverviewMonth: (amount: number) => void;
  formatNumber: (value: number | string) => string;
  getPriorityPalette: (priority: any) => {
    badge: string;
  };
  goHome: () => void;
};

export default function CalendarView({
  visibleWeekDays,
  overviewDays,
  overviewMonthIndex,
  overviewYear,
  getTasksForDay,
  openDayForAdd,
  changeOverviewMonth,
  formatNumber,
  getPriorityPalette,
  goHome,
}: Props) {
  return (
    <div className="min-h-full bg-white lg:px-6 lg:py-5">
      <div className="flex items-center justify-between border-b border-gray-200 px-5 py-4 lg:rounded-3xl lg:border lg:bg-white lg:shadow-sm">
        <button
          type="button"
          onClick={goHome}
          className="h-12 w-12 rounded-full bg-gray-100 text-xl"
        >
          ←
        </button>

        <div className="text-center">
          <div className="text-2xl font-bold text-gray-900">
            {monthNames[overviewMonthIndex]}
          </div>

          <div className="text-lg text-gray-500">
            {formatNumber(overviewYear)}
          </div>
        </div>

        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => changeOverviewMonth(-1)}
            className="h-12 w-12 rounded-full bg-gray-100 text-xl"
          >
            ‹
          </button>

          <button
            type="button"
            onClick={() => changeOverviewMonth(1)}
            className="h-12 w-12 rounded-full bg-gray-100 text-xl"
          >
            ›
          </button>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-1 px-4 pt-5 text-center text-sm font-semibold text-gray-400 lg:px-0 lg:text-base">
        {visibleWeekDays.map((day) => (
          <div key={day}>{day}</div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-2 p-4 lg:gap-3 lg:px-0">
        {overviewDays.map((day, index) => {
          if (!day) {
            return (
              <div
                key={`empty-${index}`}
                className="min-h-24 lg:min-h-32"
              />
            );
          }

          const dayTasks = getTasksForDay(day);

          return (
            <button
              key={day}
              type="button"
              onClick={() => openDayForAdd(day)}
              className="min-h-24 rounded-2xl border border-gray-200 bg-gray-50 p-2 text-left transition active:scale-[0.98] hover:border-indigo-300 lg:min-h-32 lg:p-3"
            >
              <div className="mb-2 text-sm font-bold text-gray-900">
                {formatNumber(day)}
              </div>

              <div className="space-y-1">
                {dayTasks.slice(0, 3).map((task) => (
                  <div
                    key={task.id}
                    className={`truncate rounded-lg px-2 py-1 text-[11px] font-medium ${
                      getPriorityPalette(task.priority).badge
                    }`}
                  >
                    {task.title}
                  </div>
                ))}

                {dayTasks.length > 3 && (
                  <div className="text-[11px] text-gray-400">
                    +{dayTasks.length - 3} รายการ
                  </div>
                )}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}