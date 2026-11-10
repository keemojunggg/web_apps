import { REPEAT_OPTIONS } from '../constants/repeatOptions';

export default function RepeatPicker({ value, onChange }) {
  return (
    <div className="tp-repeat-list">
      {REPEAT_OPTIONS.map((r) => {
        const active = value === r.id;
        return (
          <button
            key={r.id}
            type="button"
            className={`tp-repeat-card ${active ? 'is-active' : ''}`}
            onClick={() => onChange(r.id)}
          >
            <span className="tp-repeat-radio"><span className="tp-repeat-radio-dot" /></span>
            <span>
              <span className="tp-repeat-title">{r.label}</span>
              <span className="tp-repeat-desc">{r.desc}</span>
            </span>
          </button>
        );
      })}
    </div>
  );
}
