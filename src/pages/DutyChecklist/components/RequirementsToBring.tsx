import { ChevronRight, ClipboardList } from "lucide-react";
import { Link } from "react-router";
import type { RequirementReadiness } from "../../../lib/types";
import ChecklistCard from "./ChecklistCard";

export default function RequirementsToBring({ items }: { items: RequirementReadiness[] }) {
  return (
    <ChecklistCard
      icon={ClipboardList}
      tone="green"
      title="Requirements to Bring"
      action={<span className="prep-linked">Linked to NurSet</span>}
    >
      {items.length === 0 ? (
        <p className="empty-text">No upcoming requirements.</p>
      ) : (
        <ul className="prep-req-list">
          {items.map((r) => (
            <li key={r.id}>
              <span>{r.title}</span>
              <span className={`badge ${r.ready ? "badge--green" : "badge--red"}`}>
                {r.ready ? "Ready" : "Not Ready"}
              </span>
            </li>
          ))}
        </ul>
      )}
      <Link to="/requirements" className="prep-card-link">
        View Requirements <ChevronRight size={16} />
      </Link>
    </ChecklistCard>
  );
}
