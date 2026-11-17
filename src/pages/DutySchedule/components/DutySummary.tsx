import { CircleCheck, ClipboardList, Clock3, type LucideIcon } from "lucide-react";
import type { Duty } from "../../../lib/types";
import { dutyHours, formatHours, isCompleted } from "../schedule";

interface Stat {
  label: string;
  value: string | number;
  caption: string;
  icon: LucideIcon;
  tone: "blue" | "slate" | "green";
}

export default function DutySummary({ duties }: { duties: Duty[] }) {
  const completed = duties.filter((d) => isCompleted(d));
  const hours = completed.reduce((sum, d) => sum + dutyHours(d), 0);

  const stats: Stat[] = [
    { label: "Total duties", value: duties.length, caption: "Scheduled clinical duties", icon: ClipboardList, tone: "blue" },
    { label: "Clinical hours", value: formatHours(hours), caption: "Recorded duty hours", icon: Clock3, tone: "slate" },
    { label: "Completed duties", value: completed.length, caption: "Completed clinical duties", icon: CircleCheck, tone: "green" },
  ];

  return (
    <section>
      <h2 className="schedule-heading">Duty Summary</h2>
      <div className="summary-grid">
        {stats.map(({ label, value, caption, icon: Icon, tone }) => (
          <div key={label} className="card summary-card">
            <p className="eyebrow">{label}</p>
            <strong>{value}</strong>
            <p className={`summary-caption summary-caption--${tone}`}>
              <Icon size={15} />
              <span>{caption}</span>
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}
