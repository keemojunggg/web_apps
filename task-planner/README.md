# Task Planner — Chrome / Sports-car themed redesign (multi-file)

Same app as before, split into folders so each piece is easy to find and edit.

## Structure

```
src/
  TaskPlannerApp.jsx        # root component — wires pages + shared state together
  styles/
    theme.css                # all styling (light/dark chrome theme, CSS variables)
  constants/
    priorities.js            # priority levels + colors + sort order
    repeatOptions.js         # "ไม่ทำซ้ำ / ทุกวัน / ทุกเดือน"
    calendar.js              # Thai month/weekday labels
  utils/
    dateUtils.js             # date formatting + month-grid helper
    seedData.js               # example tasks shown on first load
  components/                 # small reusable pieces
    Sidebar.jsx
    HeaderBar.jsx
    TimeReel.jsx              # hour/minute stepper
    PriorityPicker.jsx
    RepeatPicker.jsx
    ToggleSwitch.jsx
    TaskItem.jsx               # swipe-to-reveal edit/delete row
    EditTaskModal.jsx
  pages/                      # one file per sidebar destination
    HomePage.jsx
    CalendarPage.jsx
    UpcomingPage.jsx
    SettingsPage.jsx
```

## How to use it

1. Copy the `src/` folder into your existing React project (merge with your own `src/`,
   or drop it in as a subfolder and adjust import paths if you rename it).
2. Install the one dependency it needs beyond React:
   ```
   npm install lucide-react
   ```
3. Render it from wherever your app currently mounts:
   ```jsx
   import TaskPlannerApp from './task-planner/src/TaskPlannerApp';

   export default function App() {
     return <TaskPlannerApp />;
   }
   ```
4. No Tailwind config needed — `theme.css` is plain CSS imported directly by
   `TaskPlannerApp.jsx`. If your bundler doesn't auto-import CSS on component
   mount (rare), import `src/styles/theme.css` once from your app's entry file instead.

## Notes

- All task data lives in React state (seeded with a few example tasks) —
  there's no backend or persistence wired up yet. Swap `utils/seedData.js`
  and the handlers in `TaskPlannerApp.jsx` for your real data source when ready.
- Theme (light/dark), notification defaults, and profile name are also plain
  React state — persist them (e.g. to your backend or to `localStorage` in
  your own app shell) if you need them to survive a page reload.
