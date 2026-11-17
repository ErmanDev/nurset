import { ChevronRight, NotebookPen } from "lucide-react";
import { Link } from "react-router";
import type { CiNote } from "../../../lib/types";
import ChecklistCard from "./ChecklistCard";

export default function CiReminderPanel({ note }: { note: CiNote }) {
  return (
    <ChecklistCard
      icon={NotebookPen}
      tone="purple"
      title="CI Reminder"
      action={<span className="prep-linked">From your clinical instructor</span>}
    >
      <p className="prep-quote">“{note.content}”</p>
      <Link to="/ci-notes" className="prep-card-link">
        View CI Notes <ChevronRight size={16} />
      </Link>
    </ChecklistCard>
  );
}
