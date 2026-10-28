export default function ToggleSwitch({ checked, onChange, label, description }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      className={`tp-toggle-row ${checked ? 'is-on' : ''}`}
      onClick={() => onChange(!checked)}
    >
      <span>
        <span className="tp-toggle-label">{label}</span>
        {description && <span className="tp-toggle-desc">{description}</span>}
      </span>
      <span className="tp-switch"><span className="tp-switch-knob" /></span>
    </button>
  );
}
