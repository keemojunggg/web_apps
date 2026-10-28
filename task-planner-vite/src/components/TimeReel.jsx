import { ChevronUp, ChevronDown } from 'lucide-react';

/** A small odometer-style stepper used for hour/minute input. Scroll or click to change. */
export default function TimeReel({ value, max, onChange }) {
  const total = max + 1;
  const prev = (value - 1 + total) % total;
  const next = (value + 1) % total;
  const pad = (n) => String(n).padStart(2, '0');

  const handleWheel = (e) => {
    e.preventDefault();
    onChange(e.deltaY < 0 ? next : prev);
  };

  return (
    <div className="tp-reel" onWheel={handleWheel}>
      <button type="button" className="tp-reel-btn" onClick={() => onChange(next)} aria-label="เพิ่มค่า">
        <ChevronUp size={15} />
      </button>
      <div className="tp-reel-track">
        <span className="tp-reel-ghost" onClick={() => onChange(prev)}>{pad(prev)}</span>
        <span className="tp-reel-value">{pad(value)}</span>
        <span className="tp-reel-ghost" onClick={() => onChange(next)}>{pad(next)}</span>
      </div>
      <button type="button" className="tp-reel-btn" onClick={() => onChange(prev)} aria-label="ลดค่า">
        <ChevronDown size={15} />
      </button>
    </div>
  );
}
