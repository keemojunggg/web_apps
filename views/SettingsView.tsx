import type {
  AppView,
  PriorityColorKey,
  SettingsPage,
} from "@/types/task";

type Props = {
  settingsPage: string;
 setSettingsPage: React.Dispatch<
  React.SetStateAction<SettingsPage>
>;
  calendarSettings: any;

  updateSettings: (next: any) => void;
  updateNotificationSettings: (next: any) => void;
  updateAppearanceSettings: (next: any) => void;

  setActiveView: (view: AppView) => void;

  tasks: any[];
  selectedDateTasks: any[];

  priorityOptions: any[];
  priorityColorPalette: any;

  getPriorityPalette: (priority: any) => {
    dot: string;
    active: string;
    badge: string;
  };

  updatePriorityColor: (
    priority: any,
    color: PriorityColorKey
  ) => void;

  notificationChannelOptions: any[];
  reminderOptions: any[];

  toggleNotificationChannel: (
    channel: any
  ) => void;

  toggleReminderMinute: (
    minute: any
  ) => void;

  renderSettingsHeader: (
    title: string
  ) => React.ReactNode;
};

export default function SettingsView({
  settingsPage,
  setSettingsPage,
  calendarSettings,
  updateSettings,
  updateNotificationSettings,
  updateAppearanceSettings,
  setActiveView,
  tasks,
  selectedDateTasks,
  priorityOptions,
  priorityColorPalette,
  getPriorityPalette,
  updatePriorityColor,
  notificationChannelOptions,
  reminderOptions,
  toggleNotificationChannel,
  toggleReminderMinute,
  renderSettingsHeader,
}: Props) {
  // ===== MAIN =====
  if (settingsPage === "main") {
      return (
        <div className="p-6 lg:p-8">
          {renderSettingsHeader("ตั้งค่า")}

          <div className="mt-5 space-y-3 lg:grid lg:grid-cols-2 lg:gap-4 lg:space-y-0">
            <button
              type="button"
              onClick={() => setSettingsPage("display")}
              className="w-full rounded-3xl border border-gray-200 bg-white p-5 text-left shadow-sm transition active:scale-[0.98]"
            >
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-bold text-gray-900">
                    การแสดงผล
                  </h3>
                  <p className="mt-1 text-sm text-gray-500">
                    หน้าเริ่มต้น รูปแบบเวลา และวันเริ่มต้นสัปดาห์
                  </p>
                </div>
                <span className="text-2xl text-gray-300">›</span>
              </div>
            </button>

            <button
              type="button"
              onClick={() => setSettingsPage("notifications")}
              className="w-full rounded-3xl border border-gray-200 bg-white p-5 text-left shadow-sm transition active:scale-[0.98]"
            >
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-bold text-gray-900">
                    การแจ้งเตือน
                  </h3>
                  <p className="mt-1 text-sm text-gray-500">
                    ช่องทางแจ้งเตือน และเวลาเตือนล่วงหน้าหลายครั้ง
                  </p>
                </div>
                <span className="text-2xl text-gray-300">›</span>
              </div>
            </button>

            <button
              type="button"
              onClick={() => setSettingsPage("personalization")}
              className="w-full rounded-3xl border border-gray-200 bg-white p-5 text-left shadow-sm transition active:scale-[0.98]"
            >
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-bold text-gray-900">
                    Personalization
                  </h3>
                  <p className="mt-1 text-sm text-gray-500">
                    Dark theme, Roman numerals, and priority colors
                  </p>
                </div>
                <span className="text-2xl text-gray-300">›</span>
              </div>
            </button>

            <button
              type="button"
              onClick={() => setSettingsPage("calendarInfo")}
              className="w-full rounded-3xl border border-gray-200 bg-white p-5 text-left shadow-sm transition active:scale-[0.98]"
            >
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-bold text-gray-900">
                    ข้อมูลปฏิทิน
                  </h3>
                  <p className="mt-1 text-sm text-gray-500">
                    จำนวนรายการทั้งหมดและรายการของวันที่เลือก
                  </p>
                </div>
                <span className="text-2xl text-gray-300">›</span>
              </div>
            </button>
          </div>
        </div>
      );
    }

  // ===== DISPLAY =====
   if (settingsPage === "display") {
      return (
        <div className="p-6 lg:p-8">
          {renderSettingsHeader("การแสดงผล")}

          <div className="mt-5 max-w-3xl rounded-3xl border border-gray-200 bg-white p-5 shadow-sm">
            <div>
              <label className="text-sm font-semibold text-gray-500">
                หน้าเริ่มต้น
              </label>
              <select
                value={calendarSettings.defaultView}
                onChange={(e) =>
                  updateSettings({ defaultView: e.target.value as AppView })
                }
                className="mt-2 h-12 w-full rounded-2xl border border-gray-200 bg-gray-50 px-4 font-semibold text-gray-800 outline-none focus:border-indigo-400"
              >
                <option value="home">หน้าหลัก</option>
                <option value="calendar">ปฏิทิน</option>
                <option value="upcoming">กำลังจะมาถึง</option>
              </select>
            </div>

            <div className="mt-5">
              <label className="text-sm font-semibold text-gray-500">
                รูปแบบเวลา
              </label>
              <div className="mt-2 grid grid-cols-2 gap-2 rounded-2xl bg-gray-100 p-1">
                <button
                  type="button"
                  onClick={() => updateSettings({ timeFormat: "24h" })}
                  className={`rounded-xl py-3 text-sm font-semibold transition ${
                    calendarSettings.timeFormat === "24h"
                      ? "bg-white text-indigo-600 shadow-sm"
                      : "text-gray-500"
                  }`}
                >
                  24 ชั่วโมง
                </button>

                <button
                  type="button"
                  onClick={() => updateSettings({ timeFormat: "12h" })}
                  className={`rounded-xl py-3 text-sm font-semibold transition ${
                    calendarSettings.timeFormat === "12h"
                      ? "bg-white text-indigo-600 shadow-sm"
                      : "text-gray-500"
                  }`}
                >
                  AM / PM
                </button>
              </div>
            </div>

            <div className="mt-5">
              <label className="text-sm font-semibold text-gray-500">
                วันเริ่มต้นสัปดาห์
              </label>
              <div className="mt-2 grid grid-cols-2 gap-2 rounded-2xl bg-gray-100 p-1">
                <button
                  type="button"
                  onClick={() => updateSettings({ weekStart: "sunday" })}
                  className={`rounded-xl py-3 text-sm font-semibold transition ${
                    calendarSettings.weekStart === "sunday"
                      ? "bg-white text-indigo-600 shadow-sm"
                      : "text-gray-500"
                  }`}
                >
                  อาทิตย์
                </button>

                <button
                  type="button"
                  onClick={() => updateSettings({ weekStart: "monday" })}
                  className={`rounded-xl py-3 text-sm font-semibold transition ${
                    calendarSettings.weekStart === "monday"
                      ? "bg-white text-indigo-600 shadow-sm"
                      : "text-gray-500"
                  }`}
                >
                  จันทร์
                </button>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setActiveView(calendarSettings.defaultView)}
              className="mt-5 h-14 w-full rounded-2xl bg-indigo-500 font-semibold text-white transition active:scale-95 hover:bg-indigo-600"
            >
              ไปยังหน้าเริ่มต้น
            </button>
          </div>
        </div>
      );
    }

  // ===== PERSONALIZATION =====
   if (settingsPage === "personalization") {
      return (
        <div className="p-6 lg:p-8">
          {renderSettingsHeader("Personalization")}

          <div className="mt-5 space-y-4 lg:grid lg:grid-cols-2 lg:gap-4 lg:space-y-0">
            <div className="rounded-3xl border border-gray-200 bg-white p-5 shadow-sm lg:col-span-2">
              <h3 className="text-lg font-bold text-gray-900">Theme</h3>
              <div className="mt-4 grid grid-cols-2 gap-2 rounded-2xl bg-gray-100 p-1">
                <button
                  type="button"
                  onClick={() =>
                    updateAppearanceSettings({ theme: "light" })
                  }
                  className={`rounded-xl py-3 text-sm font-semibold transition ${
                    calendarSettings.appearance.theme === "light"
                      ? "bg-white text-indigo-600 shadow-sm"
                      : "text-gray-500"
                  }`}
                >
                  Light
                </button>

                <button
                  type="button"
                  onClick={() => updateAppearanceSettings({ theme: "dark" })}
                  className={`rounded-xl py-3 text-sm font-semibold transition ${
                    calendarSettings.appearance.theme === "dark"
                      ? "bg-white text-indigo-600 shadow-sm"
                      : "text-gray-500"
                  }`}
                >
                  Dark
                </button>
              </div>
            </div>

            <div className="rounded-3xl border border-gray-200 bg-white p-5 shadow-sm">
              <h3 className="text-lg font-bold text-gray-900">Numerals</h3>
              <p className="mt-1 text-sm text-gray-500">
                Controls displayed numbers in dates, calendar days, and time
                picker.
              </p>

              <div className="mt-4 grid grid-cols-2 gap-2 rounded-2xl bg-gray-100 p-1">
                <button
                  type="button"
                  onClick={() =>
                    updateAppearanceSettings({ numerals: "arabic" })
                  }
                  className={`rounded-xl py-3 text-sm font-semibold transition ${
                    calendarSettings.appearance.numerals === "arabic"
                      ? "bg-white text-indigo-600 shadow-sm"
                      : "text-gray-500"
                  }`}
                >
                  1 2 3
                </button>

                <button
                  type="button"
                  onClick={() =>
                    updateAppearanceSettings({ numerals: "roman" })
                  }
                  className={`rounded-xl py-3 text-sm font-semibold transition ${
                    calendarSettings.appearance.numerals === "roman"
                      ? "bg-white text-indigo-600 shadow-sm"
                      : "text-gray-500"
                  }`}
                >
                  I II III
                </button>
              </div>
            </div>

            <div className="rounded-3xl border border-gray-200 bg-white p-5 shadow-sm">
              <h3 className="text-lg font-bold text-gray-900">
                Priority Colors
              </h3>

              <div className="mt-4 space-y-4">
                {priorityOptions.map((priority) => (
                  <div key={priority.value}>
                    <div className="mb-2 flex items-center gap-2">
                      <div
                        className={`h-4 w-4 rounded-full ${getPriorityPalette(priority.value).dot}`}
                      />
                      <p className="font-semibold text-gray-900">
                        {priority.label}
                      </p>
                    </div>

                    <div className="grid grid-cols-4 gap-2">
                      {(
                        Object.keys(
                          priorityColorPalette
                        ) as PriorityColorKey[]
                      ).map((color) => {
                        const isSelected =
                          calendarSettings.appearance.priorityColors[
                            priority.value
                          ] === color;

                        return (
                          <button
                            key={color}
                            type="button"
                            onClick={() =>
                              updatePriorityColor(priority.value, color)
                            }
                            className={`flex h-12 items-center justify-center rounded-2xl border transition ${
                              isSelected
                                ? "border-indigo-500 bg-indigo-50"
                                : "border-gray-200 bg-gray-50"
                            }`}
                            title={priorityColorPalette[color].label}
                          >
                            <span
                              className={`h-5 w-5 rounded-full ${priorityColorPalette[color].dot}`}
                            />
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      );
    }

  // ===== NOTIFICATIONS =====
   if (settingsPage === "notifications") {
      return (
        <div className="p-6 lg:p-8">
          {renderSettingsHeader("การแจ้งเตือน")}

          <div className="mt-5 space-y-4 lg:grid lg:grid-cols-2 lg:gap-4 lg:space-y-0">
            <div className="rounded-3xl border border-gray-200 bg-white p-5 shadow-sm lg:col-span-2">
              <div className="flex items-center justify-between rounded-2xl bg-gray-50 p-4">
                <div>
                  <p className="font-semibold text-gray-900">
                    เปิดการแจ้งเตือน
                  </p>
                  <p className="mt-1 text-sm text-gray-500">
                    ใช้เป็นค่าเริ่มต้นสำหรับรายการใหม่
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() =>
                    updateNotificationSettings({
                      enabled: !calendarSettings.notifications.enabled,
                    })
                  }
                  className={`relative h-8 w-14 rounded-full transition ${
                    calendarSettings.notifications.enabled
                      ? "bg-indigo-500"
                      : "bg-gray-300"
                  }`}
                >
                  <span
                    className={`absolute top-1 h-6 w-6 rounded-full bg-white shadow transition ${
                      calendarSettings.notifications.enabled
                        ? "left-7"
                        : "left-1"
                    }`}
                  />
                </button>
              </div>
            </div>

            <div className="rounded-3xl border border-gray-200 bg-white p-5 shadow-sm">
              <h3 className="text-lg font-bold text-gray-900">
                ช่องทางแจ้งเตือน
              </h3>

              <div className="mt-4 space-y-3">
                {notificationChannelOptions.map((channel) => {
                  const isSelected =
                    calendarSettings.notifications.channels.includes(
                      channel.value
                    );

                  return (
                    <button
                      key={channel.value}
                      type="button"
                      onClick={() => toggleNotificationChannel(channel.value)}
                      disabled={!calendarSettings.notifications.enabled}
                      className={`w-full rounded-2xl border p-4 text-left transition disabled:opacity-50 ${
                        isSelected
                          ? "border-indigo-400 bg-indigo-50"
                          : "border-transparent bg-gray-50"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="font-semibold text-gray-900">
                            {channel.label}
                          </p>
                          <p className="mt-1 text-sm text-gray-500">
                            {channel.description}
                          </p>
                        </div>

                        <span
                          className={`flex h-6 w-6 items-center justify-center rounded-full text-sm ${
                            isSelected
                              ? "bg-indigo-500 text-white"
                              : "bg-gray-200 text-transparent"
                          }`}
                        >
                          ✓
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="rounded-3xl border border-gray-200 bg-white p-5 shadow-sm">
              <h3 className="text-lg font-bold text-gray-900">
                เตือนล่วงหน้า
              </h3>
              <p className="mt-1 text-sm text-gray-500">
                เลือกได้หลายครั้ง เช่น 1 วันก่อน และ 15 นาทีก่อน
              </p>

              <div className="mt-4 grid grid-cols-2 gap-2">
                {reminderOptions.map((option) => {
                  const isSelected =
                    calendarSettings.notifications.reminders.includes(
                      option.value
                    );

                  return (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => toggleReminderMinute(option.value)}
                      disabled={!calendarSettings.notifications.enabled}
                      className={`rounded-2xl border py-3 text-sm font-semibold transition disabled:opacity-50 ${
                        isSelected
                          ? "border-indigo-400 bg-indigo-50 text-indigo-700"
                          : "border-transparent bg-gray-50 text-gray-500"
                      }`}
                    >
                      {option.label}
                    </button>
                  );
                })}
              </div>

              <div className="mt-4 rounded-2xl bg-gray-50 p-4 text-sm text-gray-500">
                จำนวนการแจ้งเตือนล่วงหน้า:{" "}
                <span className="font-bold text-gray-900">
                  {calendarSettings.notifications.reminders.length}
                </span>
              </div>
            </div>
          </div>
        </div>
      );
    }

  // ===== CALENDAR INFO =====
 return (
      <div className="p-6 lg:p-8">
        {renderSettingsHeader("ข้อมูลปฏิทิน")}

        <div className="mt-5 rounded-3xl border border-gray-200 bg-white p-5 shadow-sm">
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-2xl bg-gray-50 p-4">
              <p className="text-2xl font-bold text-gray-900">
                {tasks.length}
              </p>
              <p className="mt-1 text-sm text-gray-500">รายการทั้งหมด</p>
            </div>

            <div className="rounded-2xl bg-gray-50 p-4">
              <p className="text-2xl font-bold text-gray-900">
                {selectedDateTasks.length}
              </p>
              <p className="mt-1 text-sm text-gray-500">รายการวันนี้</p>
            </div>
          </div>
        </div>
      </div>
    );
}