import { useState } from "react";
import { formatLongDate, formatTimeRange } from "../../../lib/format";
import type { Duty } from "../../../lib/types";

const COLLAPSED_COUNT = 3;

export default function DutyHistory({ duties }: { duties: Duty[] }) {
  const [expanded, setExpanded] = useState(false);
  const visible = expanded ? duties : duties.slice(0, COLLAPSED_COUNT);

  return (
    <section>
      <div className="schedule-section-head">
        <div>
          <h2 className="schedule-heading">Duty History</h2>
          <p className="schedule-sub">Review your completed clinical rotations</p>
        </div>
        {duties.length > COLLAPSED_COUNT && (
          <button className="text-link" onClick={() => setExpanded((v) => !v)}>
            {expanded ? "Show less" : `View all (${duties.length})`}
          </button>
        )}
      </div>

      <div className="card schedule-panel history-list">
        {visible.length === 0 ? (
          <p className="empty-text">Completed duties will appear here.</p>
        ) : (
          visible.map((duty) => (
            <article key={duty.id} className="history-item">
              <div>
                <h3>{duty.area}</h3>
                <p>
                  {formatLongDate(duty.dutyDate)} · {formatTimeRange(duty.startTime, duty.endTime)}
                </p>
                <p className="history-place">{duty.hospital}</p>
              </div>
              <span className="badge badge--green">Completed</span>
            </article>
          ))
        )}
      </div>
    </section>
  );
}
