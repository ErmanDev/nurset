interface Props {
  loading: boolean;
  counts: { today: number; upcoming: number; completed: number; overdue: number };
}

const cards = [
  { key: "today", label: "Today", color: "var(--blue)" },
  { key: "upcoming", label: "Upcoming", color: "#c05be0" },
  { key: "completed", label: "Completed", color: "var(--green)" },
  { key: "overdue", label: "Overdue", color: "var(--red)" },
] as const;

export default function TaskStats({ loading, counts }: Props) {
  return (
    <div className="tasks-stats">
      {cards.map((c) => (
        <div key={c.key} className="card tasks-stat">
          <div>
            <span className="tasks-stat-dot" style={{ background: c.color }} />
            <p className="tasks-stat-label">{c.label}</p>
            <p className="tasks-stat-caption">Tasks</p>
          </div>
          <strong>{loading ? "–" : counts[c.key]}</strong>
        </div>
      ))}
    </div>
  );
}
