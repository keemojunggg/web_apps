import type { Task, Priority } from "@/types/task";

type Props = {
  sortedUpcomingTasks: Task[];
  upcomingSort: "date" | "priority";
  setUpcomingSort: (
    value: "date" | "priority"
  ) => void;
  formatDateDisplay: (date: string) => string;
  formatTaskTime: (time: string) => string;
  getPriorityPalette: (
    priority: Priority
  ) => {
    dot: string;
  };
};

export default function UpcomingView({
  sortedUpcomingTasks,
  upcomingSort,
  setUpcomingSort,
  formatDateDisplay,
  formatTaskTime,
  getPriorityPalette,
}: Props) {
  return (
    <div className="p-6 lg:p-8">
      <h2 className="text-2xl font-bold text-gray-900">กำลังจะมาถึง</h2>

      <div className="mt-5 grid grid-cols-2 gap-2 rounded-2xl bg-gray-100 p-1 lg:max-w-xl">
        <button
          type="button"
          onClick={() => setUpcomingSort("date")}
          className={`rounded-xl py-3 text-sm font-semibold transition ${
            upcomingSort === "date"
              ? "bg-white text-indigo-600 shadow-sm"
              : "text-gray-500"
          }`}
        >
          วันที่ใกล้ที่สุด
        </button>

        <button
          type="button"
          onClick={() => setUpcomingSort("priority")}
          className={`rounded-xl py-3 text-sm font-semibold transition ${
            upcomingSort === "priority"
              ? "bg-white text-indigo-600 shadow-sm"
              : "text-gray-500"
          }`}
        >
          ความสำคัญ
        </button>
      </div>

      <div className="mt-5 space-y-3 lg:grid lg:grid-cols-2 lg:gap-4 lg:space-y-0">
        {sortedUpcomingTasks.map((task) => (
          <div
            key={task.id}
            className="rounded-3xl border border-gray-200 bg-white p-4 shadow-sm"
          >
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-semibold text-gray-900">{task.title}</h3>
                <p className="mt-1 text-sm text-gray-500">
                {formatDateDisplay(task.date)} • {formatTaskTime(task.time)}
                </p>
              </div>

              <div
                className={`h-4 w-4 rounded-full ${getPriorityPalette(task.priority).dot}`}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}