import { CalendarDays, MapPin, Plus } from "lucide-react";
import { formatLongDate, formatTimeRange } from "../../../lib/format";
import type { AgendaItem } from "../schedule";

interface Props {
  items: AgendaItem[];
  onAdd: () => void;
}

export default function MyEvents({ items, onAdd }: Props) {
  return (
    <section>
      <div className="schedule-section-head schedule-section-head--start">
        <div>
          <h2 className="schedule-heading">My Events</h2>
          <p className="schedule-sub">
            {items.length} upcoming event{items.length === 1 ? "" : "s"}
          </p>
        </div>
        <button className="btn btn-primary" onClick={onAdd}>
          <Plus size={14} /> Add Event
        </button>
      </div>

      {items.length === 0 ? (
        <div className="card schedule-panel">
          <p className="empty-text">No upcoming events. Add an exam or activity to see it here.</p>
        </div>
      ) : (
        <div className="events-grid">
          {items.map((item) => {
            const time = formatTimeRange(item.startTime, item.endTime);
            return (
              <article key={item.key} className="event-card">
                <div className="card event-card-main">
                  <div className="event-card-top">
                    <h3>{item.title}</h3>
                    <span className={`badge badge--${item.badge.tone}`}>{item.badge.label}</span>
                  </div>
                  <p className="event-meta">
                    <CalendarDays size={13} />
                    {formatLongDate(item.date)}
                    {time && ` · ${time}`}
                  </p>
                  {item.place && (
                    <p className="event-meta">
                      <MapPin size={13} />
                      {item.place}
                    </p>
                  )}
                </div>
                {item.description && <p className="event-card-desc">{item.description}</p>}
              </article>
            );
          })}
        </div>
      )}

      <p className="schedule-footnote">Keep your schedule organized by adding your upcoming events.</p>
    </section>
  );
}
