import { useState } from "react";
import { daysUntil, parseDate } from "../../../lib/format";

interface Props {
  days: { date: string; count: number }[];
}

const PLOT_HEIGHT = 150;

/**
 * Single-series bar chart: items completed per day this week (tasks + quizzes).
 * One hue, no legend (the title names the series), hover/focus tooltip per bar,
 * and a visually hidden table for screen readers.
 */
export default function WeeklyActivityChart({ days }: Props) {
  const [hovered, setHovered] = useState<number | null>(null);
  const total = days.reduce((sum, d) => sum + d.count, 0);
  const max = Math.max(1, ...days.map((d) => d.count));

  const label = (iso: string) => parseDate(iso).toLocaleDateString("en-US", { weekday: "short" });
  const fullLabel = (iso: string) =>
    parseDate(iso).toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" });

  return (
    <section className="card pg-card">
      <header className="pg-card-head">
        <div>
          <p className="pg-eyebrow">Tasks & quizzes completed</p>
          <h3>Weekly Activity</h3>
        </div>
        <span className="pg-chart-total">{total} completed</span>
      </header>

      <div className="pg-chart" style={{ height: PLOT_HEIGHT + 44 }}>
        {days.map((d, i) => {
          const h = d.count === 0 ? 0 : Math.max(6, (d.count / max) * PLOT_HEIGHT);
          const isToday = daysUntil(d.date) === 0;
          return (
            <div
              key={d.date}
              className={`pg-chart-col${isToday ? " is-today" : ""}`}
              tabIndex={0}
              aria-label={`${fullLabel(d.date)}: ${d.count} completed`}
              onMouseEnter={() => setHovered(i)}
              onMouseLeave={() => setHovered(null)}
              onFocus={() => setHovered(i)}
              onBlur={() => setHovered(null)}
            >
              <div className="pg-chart-track" style={{ height: PLOT_HEIGHT }}>
                <span className="pg-chart-bar" style={{ height: h }} />
                {hovered === i && (
                  <span className="pg-chart-tip" style={{ bottom: h + 8 }} role="tooltip">
                    <strong>{d.count}</strong> completed
                    <small>{fullLabel(d.date)}</small>
                  </span>
                )}
              </div>
              <span className="pg-chart-day">{label(d.date)}</span>
              <span className="pg-chart-count">{d.count}</span>
            </div>
          );
        })}
      </div>

      <table className="sr-only">
        <caption>Items completed per day this week</caption>
        <thead>
          <tr>
            <th scope="col">Day</th>
            <th scope="col">Completed</th>
          </tr>
        </thead>
        <tbody>
          {days.map((d) => (
            <tr key={d.date}>
              <td>{fullLabel(d.date)}</td>
              <td>{d.count}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
