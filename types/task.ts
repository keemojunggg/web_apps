export type Priority = "urgent" | "medium" | "low" | "later";

export type Recurrence = "none" | "daily" | "monthly";

export type AppView =
  | "home"
  | "calendar"
  | "upcoming"
  | "settings";

export type UpcomingSort = "date" | "priority";

export type TimeFormat = "24h" | "12h";

export type WeekStart = "sunday" | "monday";

export type SettingsPage =
  | "main"
  | "display"
  | "notifications"
  | "personalization"
  | "calendarInfo";

export type NotificationChannel =
  | "app"
  | "email"
  | "line"
  | "sms";

export type ReminderMinute =
  | "5"
  | "10"
  | "15"
  | "30"
  | "60"
  | "1440";

export type ThemeMode = "light" | "dark";

export type NumeralSystem = "arabic" | "roman";

export type PriorityColorKey =
  | "red"
  | "orange"
  | "yellow"
  | "green"
  | "cyan"
  | "blue"
  | "purple"
  | "pink";

export type CalendarSettings = {
  defaultView: AppView;
  timeFormat: TimeFormat;
  weekStart: WeekStart;
  notifications: {
    enabled: boolean;
    channels: NotificationChannel[];
    reminders: ReminderMinute[];
  };
  appearance: {
    theme: ThemeMode;
    numerals: NumeralSystem;
    priorityColors: Record<Priority, PriorityColorKey>;
  };
};

export type Task = {
  id: number;
  title: string;
  time: string;
  date: string;
  priority: Priority;
  recurrence: Recurrence;
  recurring: boolean;
  notification: boolean;
  files: string[];
};
