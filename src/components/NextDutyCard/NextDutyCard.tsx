import { ChevronRight, Clock, MapPin } from "lucide-react";
import { useNavigate } from "react-router";
import { formatLongDate, formatTime, relativeDay } from "../../lib/format";
import type { Duty } from "../../lib/types";
import "./NextDutyCard.css";

export default function NextDutyCard({ duty }: { duty: Duty | null }) {
  const navigate = useNavigate();

  if (!duty) {
    return (
      <section className="next-duty next-duty--empty">
        <p className="next-duty-eyebrow">Next clinical duty</p>
        <h2>No upcoming duty</h2>
        <p className="next-duty-meta">Add one in Duty Schedule to see it here.</p>
        <button className="next-duty-cta" onClick={() => navigate("/duty-schedule")}>
          <span>Open Duty Schedule</span>
          <ChevronRight size={16} />
        </button>
      </section>
    );
  }

  return (
    <section className="next-duty">
      <div className="next-duty-top">
        <div>
          <p className="next-duty-eyebrow">Next clinical duty</p>
          <h2>{duty.area}</h2>
        </div>
        <span className="next-duty-badge">{relativeDay(duty.dutyDate)}</span>
      </div>

      <div className="next-duty-details">
        <div>
          <p className="next-duty-strong">
            <Clock size={13} /> {formatLongDate(duty.dutyDate)}
          </p>
          <p className="next-duty-meta">
            {formatTime(duty.startTime)} – {formatTime(duty.endTime)}
          </p>
        </div>
        <div>
          <p className="next-duty-strong">
            <MapPin size={13} /> {duty.hospital}
          </p>
          {duty.location && <p className="next-duty-meta">{duty.location}</p>}
        </div>
      </div>

      <button className="next-duty-cta" onClick={() => navigate(`/duty-checklist?duty=${duty.id}`)}>
        <span>Prepare for Duty</span>
        <ChevronRight size={16} />
      </button>
    </section>
  );
}
