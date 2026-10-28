import { useEffect, useRef, useState } from 'react';
import { Paperclip, X } from 'lucide-react';
import PriorityPicker from './PriorityPicker';
import ToggleSwitch from './ToggleSwitch';

export default function EditTaskModal({ task, onClose, onSave }) {
  const [title, setTitle] = useState(task.title);
  const [time, setTime] = useState(`${String(task.hour ?? 9).padStart(2, '0')}:${String(task.minute ?? 0).padStart(2, '0')}`);
  const [priority, setPriority] = useState(task.priority);
  const [repeat, setRepeat] = useState(task.repeat || 'none');
  const [notify, setNotify] = useState(task.notify);
  const [dateStr, setDateStr] = useState(task.dateKey || '');
  const [description, setDescription] = useState(task.description || '');
  const [attachments, setAttachments] = useState(task.attachments || []);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [fileUrls, setFileUrls] = useState({});
  const fileRef = useRef(null);
  const submissionLock = useRef(false);

  useEffect(() => {
    const urls = {};
    attachments.forEach((file, index) => {
      if (file.blob instanceof Blob) urls[file.id || `${file.name}-${index}`] = URL.createObjectURL(file.blob);
    });
    setFileUrls(urls);
    return () => Object.values(urls).forEach((url) => URL.revokeObjectURL(url));
  }, [attachments]);

  useEffect(() => {
    const onKeyDown = (event) => { if (event.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  const addAttachments = async (fileList) => {
    const selected = Array.from(fileList || []);
    if (attachments.length + selected.length > 5) { setError('แนบไฟล์ได้ไม่เกิน 5 ไฟล์ต่องาน'); return; }
    const tooLarge = selected.find((file) => file.size > 350 * 1024);
    if (tooLarge) { setError(`ไฟล์ ${tooLarge.name} มีขนาดเกิน 350 KB`); return; }
    try {
      const newFiles = await Promise.all(selected.map((file) => new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve({ id: `${file.name}-${file.size}-${Date.now()}`, name: file.name, type: file.type || 'application/octet-stream', size: file.size, blob: new Blob([reader.result], { type: file.type || 'application/octet-stream' }) });
        reader.onerror = () => reject(new Error(`อ่านไฟล์ ${file.name} ไม่สำเร็จ`));
        reader.readAsArrayBuffer(file);
      })));
      setAttachments((previous) => [...previous, ...newFiles]);
      setError('');
    } catch (readError) {
      setError(readError instanceof Error ? readError.message : 'อ่านไฟล์แนบไม่สำเร็จ');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (submissionLock.current || saving) return;
    if (!title.trim()) { setError('กรุณาระบุชื่องาน'); return; }
    if (repeat !== 'none' && !dateStr) { setError('งานที่ทำซ้ำต้องกำหนดวันที่เริ่มต้น'); return; }
    submissionLock.current = true;
    setSaving(true);
    const [hour, minute] = time.split(':').map(Number);
    onSave({ ...task, title: title.trim(), description: description.trim(), hour, minute, priority, repeat, notify, dateKey: dateStr, attachments });
  };

  return (
    <div className="tp-modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <div className="tp-modal" role="dialog" aria-modal="true" aria-labelledby="edit-task-title">
        <div className="tp-modal-head">
          <div><span className="tp-eyebrow">รายละเอียดงาน</span><h2 id="edit-task-title">แก้ไขงาน</h2></div>
          <button type="button" className="tp-icon-btn" onClick={onClose} aria-label="ปิดหน้าต่าง"><X size={18} /></button>
        </div>
        <form onSubmit={handleSubmit} className="tp-modal-body">
          <label className="tp-labeled-field"><span>ชื่องาน <b aria-hidden="true">*</b></span><input autoFocus required className="tp-text-input" value={title} onChange={(event) => setTitle(event.target.value)} /></label>
          <div className="tp-modal-fields-row"><label className="tp-labeled-field"><span>วันที่ (ไม่ระบุก็ได้)</span><input type="date" className="tp-date-input" value={dateStr} onChange={(event) => setDateStr(event.target.value)} /></label><label className="tp-labeled-field"><span>เวลา</span><input type="time" className="tp-date-input" value={time} onChange={(event) => setTime(event.target.value)} disabled={!dateStr} /></label></div>
          <label className="tp-labeled-field"><span>รายละเอียด / บันทึก</span><textarea className="tp-text-input tp-description-input" rows={3} value={description} onChange={(event) => setDescription(event.target.value)} /></label>
          <div className="tp-labeled-field"><span>ความสำคัญ</span><PriorityPicker value={priority} onChange={setPriority} /></div>
          <label className="tp-labeled-field"><span>ทำซ้ำ</span><select className="tp-select" value={repeat} onChange={(event) => setRepeat(event.target.value)}><option value="none">ไม่ทำซ้ำ</option><option value="daily">ทุกวัน</option><option value="weekly">ทุกสัปดาห์</option><option value="monthly">ทุกเดือน</option></select><small className="tp-helper-text">สร้างงานครั้งถัดไปเมื่อทำรายการนี้เสร็จ</small></label>
          <div className="tp-labeled-field"><span>ไฟล์แนบ</span><input ref={fileRef} type="file" multiple hidden onChange={(event) => { void addAttachments(event.target.files); event.target.value = ''; }} /><button type="button" className="tp-btn tp-btn-ghost tp-btn-sm tp-attachment-button" onClick={() => fileRef.current?.click()}><Paperclip size={15} /> เพิ่มไฟล์ (ไม่เกิน 350 KB)</button>{!!attachments.length && <ul className="tp-file-list">{attachments.map((file, index) => <li key={`${file.id || file.name}-${index}`} className="tp-file-chip"><a href={fileUrls[file.id || `${file.name}-${index}`] || file.dataUrl || undefined} download={file.name}>{file.name}</a><button type="button" onClick={() => setAttachments((previous) => previous.filter((_, fileIndex) => fileIndex !== index))} aria-label={`นำ ${file.name} ออก`}><X size={13} /></button></li>)}</ul>}</div>
          <ToggleSwitch checked={notify} onChange={setNotify} label="แจ้งเตือนก่อนถึงเวลา" description={notify ? 'ต้องอนุญาตการแจ้งเตือนในหน้าตั้งค่า และเปิดแอปค้างไว้' : 'ปิดอยู่'} />
          {error && <p className="tp-form-error" role="alert">{error}</p>}

          <div className="tp-modal-actions">
            <button type="button" className="tp-btn tp-btn-ghost" onClick={onClose}>ยกเลิก</button>
            <button type="submit" className="tp-btn tp-btn-primary" disabled={saving}>{saving ? 'กำลังบันทึก…' : 'บันทึกการแก้ไข'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}
