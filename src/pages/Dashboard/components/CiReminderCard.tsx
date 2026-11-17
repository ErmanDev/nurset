import { ChevronRight, Lightbulb } from "lucide-react";
import { Link } from "react-router";
import { formatAddedAt } from "../../../lib/format";
import type { CiNote } from "../../../lib/types";

export default function CiReminderCard({ note }: { note: CiNote }) {
  return (
    <section className="ci-reminder">
      <span className="ci-reminder-icon">
        <Lightbulb size={16} />
      </span>
      <div>
        <p className="ci-reminder-eyebrow">Important CI reminder</p>
        <p className="ci-reminder-text">{note.content}</p>
        <p className="row-meta">Added {formatAddedAt(note.createdAt)}</p>
        <Link to="/ci-notes" className="text-link" style={{ marginTop: 6 }}>
          View CI Notes <ChevronRight size={13} />
        </Link>
      </div>
    </section>
  );
}
