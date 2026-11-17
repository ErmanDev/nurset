import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { toIso, todayIso } from "../../../lib/format";
import { calendarLegend, type CalendarItem } from "../schedule";

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MAX_LABELS = 2;

interface Props {
  items: CalendarItem[];
  onAdd: () => void;
  onSelectDate: (iso: string) => void;
}

function firstOfMonth(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

export default function DutyCalendar({ items, onAdd, onSelectDate }: Props) {
  const [month, setMonth] = useState(() => firstOfMonth(new Date()));
  const today = todayIso();

  const byDate = useMemo(() => {
    const map = new Map<string, CalendarItem[]>();
    for (const item of items) {
      const list = map.get(item.date) ?? [];
      list.push(item);
      map.set(item.date, list);
    }
    return map;
  }, [items]);

  // Leading blanks for the first week, then each day; pad to whole weeks.
  const cells = useMemo(() => {
    const lead = month.getDay();
    const days = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
    const list: (Date | null)[] = Array.from({ length: lead }, () => null);
    for (let d = 1; d <= days; d++) list.push(new Date(month.getFullYear(), month.getMonth(), d));
    while (list.length % 7 !== 0) list.push(null);
    return list;
  }, [month]);

  const shiftMonth = (delta: number) =>
    setMonth((m) => new Date(m.getFullYear(), m.getMonth() + delta, 1));

  return (
    <section>
      <div className="schedule-section-head schedule-section-head--start">
        <div>
          <h2 className="schedule-heading schedule-heading--lg">Duty Calendar</h2>
          <p className="schedule-sub">View your clinical duties by date</p>
        </div>
        <button className="btn btn-secondary" onClick={() => setMonth(firstOfMonth(new Date()))}>
          Today
        </button>
      </div>

      <div className="card calendar">
        <div className="calendar-toolbar">
          <div>
            <div className="calendar-nav">
              <button onClick={() => shiftMonth(-1)} aria-label="Previous month">
                <ChevronLeft size={18} />
              </button>
              <h3>{month.toLocaleDateString("en-US", { month: "long", year: "numeric" })}</h3>
              <button onClick={() => shiftMonth(1)} aria-label="Next month">
                <ChevronRight size={18} />
              </button>
            </div>
            <p className="schedule-sub">Select a date or click + Add Event to create an event</p>
          </div>
          <button className="btn btn-soft" onClick={onAdd}>
            <Plus size={14} /> Add Event
          </button>
        </div>

        <div className="calendar-grid" role="grid">
          {WEEKDAYS.map((d) => (
            <div key={d} className="calendar-weekday" role="columnheader">
              {d}
            </div>
          ))}

          {cells.map((date, i) => {
            if (!date) return <div key={`blank-${i}`} className="calendar-cell is-blank" />;
            const iso = toIso(date);
            const dayItems = byDate.get(iso) ?? [];
            const extra = dayItems.length - MAX_LABELS;
            return (
              <button
                key={iso}
                className={`calendar-cell${iso === today ? " is-today" : ""}${iso < today ? " is-past" : ""}`}
                onClick={() => onSelectDate(iso)}
                disabled={iso < today} // past days can't get new events
                aria-label={`${date.toDateString()}${dayItems.length ? `, ${dayItems.length} item(s)` : ""}`}
              >
                <span className={`calendar-day${dayItems.length ? ` has-items kind-${dayItems[0].kind}` : ""}`}>
                  {date.getDate()}
                </span>
                {dayItems.slice(0, MAX_LABELS).map((item) => (
                  <span key={item.key} className={`calendar-label kind-${item.kind}`} title={item.label}>
                    {item.label}
                  </span>
                ))}
                {extra > 0 && <span className="calendar-more">+{extra} more</span>}
              </button>
            );
          })}
        </div>
      </div>

      <ul className="calendar-legend">
        {calendarLegend.map(({ kind, label }) => (
          <li key={kind}>
            <span className={`legend-dot kind-${kind}`} />
            {label}
          </li>
        ))}
      </ul>
    </section>
  );
}
