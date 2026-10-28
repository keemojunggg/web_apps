import { Sun, Moon, User } from 'lucide-react';
import HeaderBar from '../components/HeaderBar';
import ToggleSwitch from '../components/ToggleSwitch';

export default function SettingsPage({
  theme, setTheme, setPage,
  notifyDefault, setNotifyDefault,
  leadMinutes, setLeadMinutes,
  morningBriefingEnabled, setMorningBriefingEnabled,
  morningBriefingTime, setMorningBriefingTime,
  profileName, setProfileName,
  reminderPermission, onEnableNotifications,
}) {
  return (
    <section className="tp-page">
      <HeaderBar theme={theme} setTheme={setTheme} setPage={setPage} profileName={profileName}><div className="tp-heading-copy"><span className="tp-eyebrow">ปรับให้เหมาะกับคุณ</span><h1 className="tp-page-title">ตั้งค่า</h1></div></HeaderBar>

      <div className="tp-card tp-settings-card">
        <h3 className="tp-settings-heading">โปรไฟล์</h3>
        <div className="tp-profile-row">
          <span className="tp-avatar tp-avatar-lg" aria-hidden="true">{profileName ? profileName[0] : <User size={20} />}</span>
          <label className="tp-labeled-field"><span>ชื่อที่แสดง</span><input className="tp-text-input" value={profileName} onChange={(e) => setProfileName(e.target.value)} placeholder="ชื่อผู้ใช้" /></label>
        </div>
      </div>

      <div className="tp-card tp-settings-card">
        <h3 className="tp-settings-heading">Morning Briefing</h3>
        <ToggleSwitch
          checked={morningBriefingEnabled}
          onChange={setMorningBriefingEnabled}
          label="แสดงสรุปประจำวัน"
          description="สรุปงานของวันก่อนหน้าในแอป Task Planner"
        />
        {morningBriefingEnabled && (
          <label className="tp-labeled-field tp-briefing-time">
            <span>เวลาแสดงตามเวลาท้องถิ่น</span>
            <input type="time" className="tp-text-input" value={morningBriefingTime} onChange={(event) => setMorningBriefingTime(event.target.value)} />
          </label>
        )}
        <div className="tp-permission-note">
          <div><strong>สรุปวันก่อนหน้าจะแสดงเวลา {morningBriefingTime} ตามเวลาท้องถิ่นขณะเปิดแอป</strong><p>หากพลาดเวลาที่ตั้งไว้ จะแสดงครั้งเดียวเมื่อเปิดแอปครั้งถัดไป โดยไม่แก้ไขงานอัตโนมัติ การแจ้งเตือนเบื้องหลังเมื่อปิดแอปไม่รองรับในเวอร์ชันนี้</p></div>
        </div>
      </div>

      <div className="tp-card tp-settings-card">
        <h3 className="tp-settings-heading">การแจ้งเตือน</h3>
        <ToggleSwitch checked={notifyDefault} onChange={setNotifyDefault} label="เปิดการแจ้งเตือนเป็นค่าเริ่มต้น" description="ใช้กับงานที่สร้างใหม่ สามารถปิดแยกเป็นรายงานได้" />
        {notifyDefault && (
          <div className="tp-lead-row">
            <span>แจ้งล่วงหน้า</span>
            <select className="tp-select" value={leadMinutes} onChange={(e) => setLeadMinutes(Number(e.target.value))}>
              <option value={5}>5 นาที</option>
              <option value={10}>10 นาที</option>
              <option value={15}>15 นาที</option>
              <option value={30}>30 นาที</option>
              <option value={60}>1 ชั่วโมง</option>
            </select>
          </div>
        )}
        <div className={`tp-permission-note is-${reminderPermission}`}>
          <div><strong>{reminderPermission === 'granted' ? 'อนุญาตการแจ้งเตือนแล้ว' : reminderPermission === 'denied' ? 'เบราว์เซอร์บล็อกการแจ้งเตือน' : reminderPermission === 'unsupported' ? 'เบราว์เซอร์นี้ไม่รองรับ Notification API' : 'ยังไม่ได้อนุญาตการแจ้งเตือน'}</strong><p>แจ้งเตือนทำงานได้เฉพาะขณะเปิดแอปและเบราว์เซอร์อยู่ ไม่มีการส่งอีเมล, SMS หรือการแจ้งเตือนเบื้องหลัง</p></div>
          {reminderPermission !== 'granted' && reminderPermission !== 'unsupported' && <button type="button" className="tp-btn tp-btn-ghost tp-btn-sm" onClick={() => void onEnableNotifications()}>อนุญาต</button>}
        </div>
      </div>

      <div className="tp-card tp-settings-card">
        <h3 className="tp-settings-heading">ธีม</h3>
        <div className="tp-theme-row">
          <button type="button" className={`tp-theme-option ${theme === 'light' ? 'is-active' : ''}`} onClick={() => setTheme('light')}>
            <Sun size={17} /> สว่าง
          </button>
          <button type="button" className={`tp-theme-option ${theme === 'dark' ? 'is-active' : ''}`} onClick={() => setTheme('dark')}>
            <Moon size={17} /> มืด
          </button>
        </div>
      </div>
      <div className="tp-settings-footnote"><strong>ข้อมูลและความเป็นส่วนตัว</strong><p>งานและการตั้งค่าบันทึกอยู่ในเบราว์เซอร์เครื่องนี้เท่านั้น ข้อมูลจะไม่ซิงก์ข้ามอุปกรณ์หรือกับบัญชีออนไลน์</p></div>
    </section>
  );
}
