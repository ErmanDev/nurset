import { CalendarCheck } from "lucide-react";
import { Link } from "react-router";
import type { WeeklyProgress } from "../../../lib/types";

export default function WeeklyProgressCard({ progress }: { progress: WeeklyProgress }) {
  const stats = [
    { label: "Completed", value: progress.completed, color: "var(--green)" },
    { label: "Pending", value: progress.pending, color: "var(--blue)" },
    { label: "Overdue", value: progress.overdue, color: "var(--red)" },
  ];

  return (
    <Link to="/progress" className="card mini-card mini-card--link">
      <span className="mini-icon mini-icon--green">
        <CalendarCheck size={18} />
      </span>
      <p className="mini-eyebrow">This week</p>
      <h3 className="mini-title">Progress</h3>

      <div className="progress-stats">
        {stats.map((s) => (
          <div key={s.label}>
            <strong style={{ color: s.color }}>{s.value}</strong>
            <span>{s.label}</span>
          </div>
        ))}
      </div>
    </Link>
  );
}
