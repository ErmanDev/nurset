import { Link } from "react-router";
import { deadlineLabel } from "../../../lib/format";
import type { Requirement } from "../../../lib/types";

export default function UpcomingDeadlines({ deadlines }: { deadlines: Requirement[] }) {
  return (
    <section>
      <div className="section-head">
        <div>
          <p className="eyebrow">Coming up</p>
          <h2 className="section-title">Upcoming deadlines</h2>
        </div>
        <Link to="/requirements" className="text-link">
          View all
        </Link>
      </div>

      <div className="card deadlines">
        {deadlines.length === 0 ? (
          <p className="empty-text">No upcoming deadlines. Nice work!</p>
        ) : (
          deadlines.map((item) => (
            <div key={item.id} className="deadline-row">
              <span className="deadline-dot" style={{ background: `var(--${item.color}, var(--blue))` }} />
              <div>
                <p className="row-title">{item.title}</p>
                <p className="row-meta">{deadlineLabel(item.dueDate)}</p>
              </div>
            </div>
          ))
        )}
      </div>
    </section>
  );
}
