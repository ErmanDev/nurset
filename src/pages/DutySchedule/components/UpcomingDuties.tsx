import { Plus } from "lucide-react";
import { formatTimeRange, parseDate, shortMonth } from "../../../lib/format";
import type { Duty } from "../../../lib/types";

interface Props {
  duties: Duty[];
  onAdd: () => void;
}

export default function UpcomingDuties({ duties, onAdd }: Props) {
  return (
    <section className="card schedule-panel">
      <div className="schedule-panel-head">
        <div>
          <h2 className="section-title">Upcoming Duties</h2>
          <p className="schedule-sub">Your scheduled clinical rotations</p>
        </div>
        <button className="btn btn-primary" onClick={onAdd}>
          <Plus size={14} /> Add Duty
        </button>
      </div>

      {duties.length === 0 ? (
        <p className="empty-text">No upcoming duties yet. Add your next rotation.</p>
      ) : (
        <div className="duty-grid">
          {duties.map((duty, index) => (
            <article key={duty.id} className="duty-item">
              <div className="date-tile">
                <strong>{parseDate(duty.dutyDate).getDate()}</strong>
                <span>{shortMonth(duty.dutyDate)}</span>
              </div>
              <div className="duty-item-body">
                <h3>{duty.area}</h3>
                <p>{formatTimeRange(duty.startTime, duty.endTime)}</p>
                <p className="duty-item-place">{duty.hospital}</p>
              </div>
              {index === 0 ? (
                <span className="badge badge--green">Upcoming</span>
              ) : (
                <span className="badge badge--blue">Scheduled</span>
              )}
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
