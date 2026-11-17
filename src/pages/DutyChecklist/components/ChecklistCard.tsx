import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";

interface Props {
  icon: LucideIcon;
  tone: "blue" | "green" | "purple";
  eyebrow?: string;
  title: string;
  /** Right side of the header. */
  action?: ReactNode;
  /** Tinted info box under the header. */
  note?: string;
  children: ReactNode;
}

/** Card with an icon tile, small eyebrow and title — shared by the page's panels. */
export default function ChecklistCard({ icon: Icon, tone, eyebrow, title, action, note, children }: Props) {
  return (
    <section className="card prep-card">
      <header className="prep-card-head">
        <span className={`prep-icon prep-icon--${tone}`}>
          <Icon size={18} />
        </span>
        <div className="prep-card-titles">
          {eyebrow && <p className="prep-card-eyebrow">{eyebrow}</p>}
          <h3>{title}</h3>
        </div>
        {action && <div className="prep-card-action">{action}</div>}
      </header>
      {note && <p className="prep-note">{note}</p>}
      {children}
    </section>
  );
}
