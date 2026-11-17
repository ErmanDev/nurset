import type { ReactNode } from "react";
import Modal from "../../../components/Modal/Modal";

/** Title + subtitle at the top of a settings section. */
export function SectionHeader({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <header className="st-section-head">
      <h2>{title}</h2>
      <p>{subtitle}</p>
    </header>
  );
}

/** A settings row: label + description on the left, control on the right. */
export function SettingRow({ title, text, children }: { title: string; text?: string; children: ReactNode }) {
  return (
    <div className="st-row">
      <div>
        <strong>{title}</strong>
        {text && <span>{text}</span>}
      </div>
      <div className="st-row-control">{children}</div>
    </div>
  );
}

/** Small segmented control used across settings. */
export function Segmented<T extends string>({
  value,
  options,
  onChange,
  label,
}: {
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
  label: string;
}) {
  return (
    <div className="st-segmented" role="radiogroup" aria-label={label}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          className={value === o.value ? "is-active" : ""}
          onClick={() => onChange(o.value)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

/** Honest "not available yet" dialog for features that need sign-in/online services. */
export function UnavailableModal({ title, onClose }: { title: string; onClose: () => void }) {
  return (
    <Modal
      open
      onClose={onClose}
      title={title}
      width={420}
      footer={
        <button className="btn btn-primary" onClick={onClose}>
          Got it
        </button>
      }
    >
      <p className="st-muted">
        This needs NurSet sign-in, which isn't connected yet. This option will work once sign-in is added.
      </p>
    </Modal>
  );
}
