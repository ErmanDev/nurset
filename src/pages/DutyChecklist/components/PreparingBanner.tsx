import { Building2, CalendarDays, ChevronRight } from "lucide-react";
import { Link } from "react-router";
import { formatLongDate, formatTimeRange, relativeDay } from "../../../lib/format";
import type { Duty } from "../../../lib/types";

interface Props {
  duty: Duty | null;
  canChange: boolean;
  onChange: () => void;
}

export default function PreparingBanner({ duty, canChange, onChange }: Props) {
  if (!duty) {
    return (
      <section className="prep-banner">
        <p className="prep-banner-eyebrow">Preparing for</p>
        <h2>No upcoming duty</h2>
        <p className="prep-banner-muted">Add a duty to start preparing for it.</p>
        <Link to="/duty-schedule" className="prep-banner-btn prep-banner-btn--inline">
          Open Duty Schedule <ChevronRight size={16} />
        </Link>
      </section>
    );
  }

  return (
    <section className="prep-banner">
      <div className="prep-banner-main">
        <p className="prep-banner-eyebrow">
          Preparing for <span className="prep-banner-pill">{relativeDay(duty.dutyDate)}</span>
        </p>
        <h2>{duty.area}</h2>
        <div className="prep-banner-details">
          <div>
            <p className="prep-banner-strong">
              <CalendarDays size={16} /> {formatLongDate(duty.dutyDate)}
            </p>
            <p className="prep-banner-muted">{formatTimeRange(duty.startTime, duty.endTime)}</p>
          </div>
          <div>
            <p className="prep-banner-strong">
              <Building2 size={16} /> {duty.hospital}
            </p>
            {duty.location && <p className="prep-banner-muted">{duty.location}</p>}
          </div>
        </div>
      </div>

      {canChange && (
        <button className="prep-banner-btn" onClick={onChange}>
          Change Duty <ChevronRight size={16} />
        </button>
      )}
    </section>
  );
}
