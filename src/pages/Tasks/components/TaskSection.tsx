import { useState, type ReactNode } from "react";
import { ChevronDown } from "lucide-react";

interface Props {
  eyebrow?: string;
  title: ReactNode;
  /** Right side of the header (e.g. "4 remaining"). */
  aside?: ReactNode;
  collapsible?: boolean;
  /** Smaller header, used by the Completed section. */
  compact?: boolean;
  tone?: "danger";
  children: ReactNode;
}

export default function TaskSection({ eyebrow, title, aside, collapsible, compact, tone, children }: Props) {
  const [open, setOpen] = useState(true);

  return (
    <section className={`card tasks-section${tone ? ` tasks-section--${tone}` : ""}`}>
      <header className={`tasks-section-head${compact ? " is-compact" : ""}`}>
        <div>
          {eyebrow && <p className="tasks-section-eyebrow">{eyebrow}</p>}
          <h3 className="tasks-section-title">{title}</h3>
        </div>
        <div className="tasks-section-aside">
          {aside}
          {collapsible && (
            <button
              className={`tasks-collapse${open ? "" : " is-closed"}`}
              onClick={() => setOpen((v) => !v)}
              aria-expanded={open}
              aria-label={open ? "Collapse section" : "Expand section"}
            >
              <ChevronDown size={20} />
            </button>
          )}
        </div>
      </header>
      {open && <div className="tasks-section-body">{children}</div>}
    </section>
  );
}
