import { ChevronRight, ClipboardCheck } from "lucide-react";
import { Link } from "react-router";
import { relativeDay } from "../../../lib/format";
import type { ChecklistSummary } from "../../../lib/types";

interface Props {
  checklist: ChecklistSummary | null;
  /** Date of the duty this checklist belongs to, if any. */
  dutyDate?: string;
}

export default function DutyBagCard({ checklist, dutyDate }: Props) {
  const total = checklist?.total ?? 0;
  const checked = checklist?.checked ?? 0;
  const percent = total ? Math.round((checked / total) * 100) : 0;
  const when = dutyDate ? relativeDay(dutyDate) : null;
  const eyebrow = when === "Today" || when === "Tomorrow" ? `${when}'s` : "Next duty";

  return (
    <section className="card mini-card">
      <span className="mini-icon mini-icon--blue">
        <ClipboardCheck size={18} />
      </span>
      <p className="mini-eyebrow">{eyebrow}</p>
      <h3 className="mini-title">{checklist?.name ?? "Duty Bag"}</h3>

      <div className="meter-label">
        <span>
          {checked} of {total} ready
        </span>
        <span>{percent}%</span>
      </div>
      <div className="meter" role="progressbar" aria-valuenow={percent} aria-valuemin={0} aria-valuemax={100}>
        <span style={{ width: `${percent}%` }} />
      </div>

      <Link to="/duty-checklist" className="text-link mini-footer">
        Continue checklist <ChevronRight size={13} />
      </Link>
    </section>
  );
}
