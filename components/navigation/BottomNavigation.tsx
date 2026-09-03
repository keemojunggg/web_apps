import type { AppView } from "@/types/task";

export type NavigationItem = {
  view: AppView;
  icon: string;
  label: string;
};

type NavigationProps = {
  activeView: AppView;
  isDarkTheme: boolean;
  items: NavigationItem[];
  onNavigate: (view: AppView) => void;
};

export function DesktopNavigation({
  activeView,
  isDarkTheme,
  items,
  onNavigate,
}: NavigationProps) {
  return (
    <aside
      className={`hidden w-64 shrink-0 border-r p-5 lg:flex lg:flex-col ${
        isDarkTheme
          ? "border-gray-800 bg-gray-900 text-gray-400"
          : "border-gray-200 bg-white text-gray-500"
      }`}
    >
      <div className="mb-8 flex items-center gap-3">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-500 text-xl text-white shadow-lg">
          📅
        </div>
        <div>
          <p className="text-xs font-semibold uppercase text-indigo-500">
            Calendar
          </p>
          <p className="font-bold text-gray-900">Task Planner</p>
        </div>
      </div>

      <nav className="space-y-2">
        {items.map((item) => {
          const isActive = activeView === item.view;

          return (
            <button
              key={item.view}
              type="button"
              onClick={() => onNavigate(item.view)}
              className={`flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-left font-semibold transition ${
                isActive
                  ? "bg-indigo-50 text-indigo-600"
                  : "text-gray-500 hover:bg-gray-50 hover:text-gray-900"
              }`}
            >
              <span className="text-2xl">{item.icon}</span>
              <span>{item.label}</span>
            </button>
          );
        })}
      </nav>
    </aside>
  );
}

export default function BottomNavigation({
  activeView,
  isDarkTheme,
  items,
  onNavigate,
}: NavigationProps) {
  return (
    <div
      className={`flex justify-between border-t px-6 py-5 text-sm lg:hidden ${
        isDarkTheme
          ? "border-gray-800 bg-gray-900 text-gray-400"
          : "border-gray-200 bg-white text-gray-500"
      }`}
    >
      {items.map((item) => (
        <button
          key={item.view}
          type="button"
          onClick={() => onNavigate(item.view)}
          className={`flex flex-col items-center gap-1 ${
            activeView === item.view ? "text-indigo-500" : ""
          }`}
        >
          <span className="text-2xl">{item.icon}</span>
          <span>{item.label}</span>
        </button>
      ))}
    </div>
  );
}
