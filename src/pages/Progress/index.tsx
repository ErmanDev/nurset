import { useEffect, useState } from "react";
import { api } from "../../lib/api";
import type { ProgressOverview, ProgressRange } from "../../lib/types";
import {
  CategoryCards,
  DutyPrepCard,
  NeedsAttentionCard,
  OverviewHero,
  RecentlyCompletedCard,
  RequirementsProgressCard,
  StudyActivityCard,
  TaskProgressCard,
} from "./components/ProgressCards";
import WeeklyActivityChart from "./components/WeeklyActivityChart";
import "./Progress.css";

const ranges: { value: ProgressRange; label: string }[] = [
  { value: "week", label: "This Week" },
  { value: "month", label: "This Month" },
  { value: "all", label: "All Time" },
];

export default function Progress() {
  const [range, setRange] = useState<ProgressRange>("week");
  const [data, setData] = useState<ProgressOverview | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    api
      .getProgress(range)
      .then((d) => {
        if (cancelled) return;
        setData(d);
        setError(null);
      })
      .catch((err) => !cancelled && setError(String(err)));
    return () => {
      cancelled = true;
    };
  }, [range]);

  return (
    <div className="pg">
      <div className="pg-header">
        <header className="page-header page-header--plain">
          <p className="eyebrow">Your organization</p>
          <h1>Progress</h1>
          <p>Track your tasks, requirements, and preparation progress</p>
        </header>
        <div className="pg-range" role="radiogroup" aria-label="Time range">
          {ranges.map((r) => (
            <button
              key={r.value}
              role="radio"
              aria-checked={range === r.value}
              className={range === r.value ? "is-active" : ""}
              onClick={() => setRange(r.value)}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      {error && <div className="alert-error">Couldn't load your progress: {error}</div>}
      {!data && !error && (
        <>
          <div className="skeleton" style={{ height: 150 }} />
          <div className="skeleton" style={{ height: 110 }} />
        </>
      )}

      {data && (
        <>
          <OverviewHero data={data} />
          <CategoryCards data={data} />

          <div className="pg-grid">
            <div className="pg-col">
              <TaskProgressCard data={data} />
              <RequirementsProgressCard data={data} />
              <NeedsAttentionCard data={data} />
              <WeeklyActivityChart days={data.weeklyActivity} />
            </div>
            <div className="pg-col">
              <DutyPrepCard data={data} />
              <StudyActivityCard data={data} />
              <RecentlyCompletedCard data={data} />
            </div>
          </div>
        </>
      )}
    </div>
  );
}
