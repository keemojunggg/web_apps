import { Home, Calendar as CalendarIcon, CalendarClock, Settings as SettingsIcon, Gauge, BarChart3 } from 'lucide-react';

const NAV_ITEMS = [
  { id: 'home', label: 'หน้าหลัก', icon: Home },
  { id: 'calendar', label: 'ปฏิทิน', icon: CalendarIcon },
  { id: 'reports', label: 'รายงาน', icon: BarChart3 },
  { id: 'upcoming', label: 'งานทั้งหมด', icon: CalendarClock },
  { id: 'settings', label: 'ตั้งค่า', icon: SettingsIcon },
];

export default function Sidebar({ page, setPage }) {
  return (
    <nav className="tp-sidebar" aria-label="เมนูหลัก">
      <div className="tp-brand">
        <span className="tp-brand-mark"><Gauge size={19} /></span>
        <span className="tp-brand-text">
          <span className="tp-brand-eyebrow">CALENDAR</span>
          <span className="tp-brand-name">Task Planner</span>
        </span>
      </div>
      <ul className="tp-nav-list">
        {NAV_ITEMS.map((it) => {
          const Icon = it.icon;
          const active = page === it.id;
          return (
            <li key={it.id}>
              <button
                type="button"
                className={`tp-nav-item ${active ? 'is-active' : ''}`}
                onClick={() => setPage(it.id)}
                aria-current={active ? 'page' : undefined}
              >
                <Icon size={18} className="tp-nav-icon" />
                <span>{it.label}</span>
              </button>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
