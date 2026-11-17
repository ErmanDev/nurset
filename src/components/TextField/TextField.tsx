import {
  useId,
  useState,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from "react";
import { Eye, EyeOff, type LucideIcon } from "lucide-react";
import "./TextField.css";

interface FieldShellProps {
  id: string;
  label: string;
  error?: string;
  hint?: ReactNode;
  labelAside?: ReactNode;
  children: ReactNode;
}

/** Label + control + error/hint wrapper shared by the field components. */
export function FieldShell({ id, label, error, hint, labelAside, children }: FieldShellProps) {
  return (
    <div className={`field${error ? " has-error" : ""}`}>
      <div className="field-label-row">
        <label htmlFor={id} className="field-label">
          {label}
        </label>
        {labelAside}
      </div>
      {children}
      {error ? (
        <p className="field-error" id={`${id}-error`} role="alert">
          {error}
        </p>
      ) : (
        hint && <div className="field-hint">{hint}</div>
      )}
    </div>
  );
}

interface TextFieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  icon?: LucideIcon;
  error?: string;
  hint?: ReactNode;
  /** Rendered at the right of the label row (e.g. "Forgot password?"). */
  labelAside?: ReactNode;
}

/** Labelled input with optional leading icon, error text, and a show/hide toggle for passwords. */
export function TextField({ label, icon: Icon, error, hint, labelAside, type, ...rest }: TextFieldProps) {
  const id = useId();
  const [reveal, setReveal] = useState(false);
  const isPassword = type === "password";

  return (
    <FieldShell id={id} label={label} error={error} hint={hint} labelAside={labelAside}>
      <div className="field-control">
        {Icon && <Icon size={16} className="field-icon" />}
        <input
          id={id}
          type={isPassword && reveal ? "text" : type}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${id}-error` : undefined}
          {...rest}
        />
        {isPassword && (
          <button
            type="button"
            className="field-toggle"
            onClick={() => setReveal((v) => !v)}
            aria-label={reveal ? "Hide password" : "Show password"}
          >
            {reveal ? <EyeOff size={16} /> : <Eye size={16} />}
          </button>
        )}
      </div>
    </FieldShell>
  );
}

interface TextAreaFieldProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label: string;
  error?: string;
  hint?: ReactNode;
}

export function TextAreaField({ label, error, hint, rows = 3, ...rest }: TextAreaFieldProps) {
  const id = useId();
  return (
    <FieldShell id={id} label={label} error={error} hint={hint}>
      <div className="field-control">
        <textarea
          id={id}
          rows={rows}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${id}-error` : undefined}
          {...rest}
        />
      </div>
    </FieldShell>
  );
}

interface SelectFieldProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label: string;
  icon?: LucideIcon;
  error?: string;
  placeholder?: string;
  options: { value: string; label: string }[];
}

export function SelectField({ label, icon: Icon, error, placeholder, options, ...rest }: SelectFieldProps) {
  const id = useId();
  return (
    <FieldShell id={id} label={label} error={error}>
      <div className="field-control">
        {Icon && <Icon size={16} className="field-icon" />}
        <select
          id={id}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${id}-error` : undefined}
          {...rest}
        >
          {placeholder && (
            <option value="" disabled>
              {placeholder}
            </option>
          )}
          {options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </div>
    </FieldShell>
  );
}
