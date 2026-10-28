import { Sun, Moon, User } from 'lucide-react';

/** Top bar shared by every page: custom content on the left, theme toggle + avatar on the right. */
export default function HeaderBar({ children, theme, setTheme, setPage, profileName }) {
  return (
    <div className="tp-topbar">
      <div className="tp-topbar-left">{children}</div>
      <div className="tp-topbar-right">
        <button
          type="button"
          className="tp-icon-btn"
          onClick={() => setTheme((t) => (t === 'light' ? 'dark' : 'light'))}
          aria-label="สลับธีมสว่าง/มืด"
        >
          {theme === 'light' ? <Moon size={17} /> : <Sun size={17} />}
        </button>
        <button type="button" className="tp-avatar" aria-label="ไปยังการตั้งค่าโปรไฟล์" onClick={() => setPage?.('settings')} title={profileName || 'โปรไฟล์ผู้ใช้'}>
          {profileName ? profileName.slice(0, 1) : <User size={17} />}
        </button>
      </div>
    </div>
  );
}
