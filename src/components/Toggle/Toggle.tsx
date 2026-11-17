import "./Toggle.css";

interface Props {
  checked: boolean;
  onChange: (checked: boolean) => void;
  /** Accessible name (the visible label usually sits next to it). */
  label: string;
  disabled?: boolean;
}

/** On/off switch. */
export default function Toggle({ checked, onChange, label, disabled }: Props) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      className={`toggle${checked ? " is-on" : ""}`}
      onClick={() => onChange(!checked)}
    >
      <span className="toggle-knob" />
    </button>
  );
}
