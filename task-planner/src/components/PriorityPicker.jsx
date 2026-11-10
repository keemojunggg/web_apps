import { PRIORITIES } from '../constants/priorities';

export default function PriorityPicker({ value, onChange }) {
  return (
    <div className="tp-priority-grid">
      {PRIORITIES.map((p) => {
        const active = value === p.id;
        return (
          <button
            key={p.id}
            type="button"
            className={`tp-priority-chip ${active ? 'is-active' : ''}`}
            style={active ? { borderColor: p.color, boxShadow: `0 0 0 1px ${p.color}` } : undefined}
            onClick={() => onChange(p.id)}
          >
            <span className="tp-priority-dot" style={{ background: p.color }} />
            {p.label}
          </button>
        );
      })}
    </div>
  );
}
