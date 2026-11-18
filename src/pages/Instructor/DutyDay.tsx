import { useCallback, useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Clock, Hospital } from "lucide-react";
import { ciApi, type AttendanceStatus, type DutyDayRow } from "../../lib/instructor";
import { formatTimeRange, parseDate, toIso, todayIso } from "../../lib/format";
import { ReadinessDots, StudentAvatar } from "./shared";
import "./Instructor.css";
import "./InstructorTools.css";

const statuses: { value: AttendanceStatus; label: string }[] = [
  { value: "present", label: "Present" },
  { value: "late", label: "Late" },
  { value: "absent", label: "Absent" },
  { value: "excused", label: "Excused" },
];

function shiftDay(iso: string, days: number): string {
  const d = parseDate(iso);
  d.setDate(d.getDate() + days);
  return toIso(d);
}

export default function DutyDay() {
  const [date, setDate] = useState(todayIso());
  const [rows, setRows] = useState<DutyDayRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setRows(await ciApi.getDutyDay(date));
      setError(null);
    } catch (err) {
      setError(String(err));
    }
  }, [date]);

  useEffect(() => {
    setRows(null);
    void load();
  }, [load]);

  async function save(row: DutyDayRow, patch: Partial<DutyDayRow>) {
    const next = { ...row, ...patch };
    if (!next.attendance) return; // remarks/time only saved once a status is set
    setRows((list) => list?.map((r) => (r.dutyId === row.dutyId ? next : r)) ?? null);
    try {
      await ciApi.setAttendance(row.dutyId, {
        status: next.attendance,
        timeIn: next.attendance === "present" || next.attendance === "late" ? next.timeIn : null,
        remarks: next.remarks,
      });
    } catch (err) {
      setError(String(err));
      void load();
    }
  }

  // Group rows by shift (area + hospital + time).
  const shifts = useMemo(() => {
    const map = new Map<string, DutyDayRow[]>();
    for (const r of rows ?? []) {
      const key = `${r.area}|${r.hospital}|${r.startTime}|${r.endTime}`;
      map.set(key, [...(map.get(key) ?? []), r]);
    }
    return [...map.values()];
  }, [rows]);

  const counts = useMemo(() => {
    const c = { present: 0, late: 0, absent: 0, excused: 0, unmarked: 0 };
    for (const r of rows ?? []) c[r.attendance ?? "unmarked"]++;
    return c;
  }, [rows]);

  const label = parseDate(date).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });
  const isToday = date === todayIso();

  return (
    <div className="ci-page">
      <header className="page-header page-header--plain">
        <p className="eyebrow">Clinical instruction</p>
        <h1>Duty Day</h1>
        <p>Take attendance and check each student's readiness for duty.</p>
      </header>

      <div className="card ci-daybar">
        <button className="icon-button" onClick={() => setDate(shiftDay(date, -1))} aria-label="Previous day">
          <ChevronLeft size={17} />
        </button>
        <div className="ci-daybar-label">
          <strong>{label}</strong>
          <small>{isToday ? "Today" : date < todayIso() ? "Past day" : "Upcoming day"}</small>
        </div>
        <button className="icon-button" onClick={() => setDate(shiftDay(date, 1))} aria-label="Next day">
          <ChevronRight size={17} />
        </button>
        <input type="date" className="ci-date-input" value={date} onChange={(e) => e.target.value && setDate(e.target.value)} aria-label="Pick a date" />
        {!isToday && (
          <button className="btn btn-secondary" onClick={() => setDate(todayIso())}>
            Today
          </button>
        )}
      </div>

      {rows && rows.length > 0 && (
        <div className="ci-att-summary">
          <span className="att-present">{counts.present} present</span>
          <span className="att-late">{counts.late} late</span>
          <span className="att-absent">{counts.absent} absent</span>
          <span className="att-excused">{counts.excused} excused</span>
          <span className="att-unmarked">{counts.unmarked} not marked</span>
        </div>
      )}

      {error && <div className="alert-error">{error}</div>}
      {!rows && !error && <div className="skeleton" style={{ height: 220 }} />}
      {rows && rows.length === 0 && (
        <div className="card ci-empty">
          <p className="empty-text">None of your students are on duty this day.</p>
        </div>
      )}

      {shifts.map((group) => {
        const first = group[0];
        return (
          <section key={`${first.area}-${first.startTime}-${first.hospital}`} className="card ci-shift">
            <header className="ci-shift-head">
              <span className="ci-duty-icon">
                <Hospital size={18} />
              </span>
              <div>
                <h2>{first.area}</h2>
                <small>
                  {first.hospital} · <Clock size={11} /> {formatTimeRange(first.startTime, first.endTime)}
                </small>
              </div>
            </header>
            {group.map((r) => (
              <div key={r.dutyId} className="ci-att-row">
                <span className="ci-student">
                  <StudentAvatar name={r.studentName} />
                  <span>
                    <strong>{r.studentName}</strong>
                    <small>{r.groupName}</small>
                  </span>
                </span>
                <span className="ci-att-ready">
                  <ReadinessDots done={r.readinessDone} />
                </span>
                <div className="ci-att-buttons" role="radiogroup" aria-label={`Attendance for ${r.studentName}`}>
                  {statuses.map((s) => (
                    <button
                      key={s.value}
                      role="radio"
                      aria-checked={r.attendance === s.value}
                      className={`att-${s.value}${r.attendance === s.value ? " is-active" : ""}`}
                      onClick={() =>
                        save(r, {
                          attendance: s.value,
                          timeIn: (s.value === "present" || s.value === "late") && !r.timeIn ? new Date().toTimeString().slice(0, 5) : r.timeIn,
                        })
                      }
                    >
                      {s.label}
                    </button>
                  ))}
                </div>
                <input
                  type="time"
                  className="ci-att-time"
                  aria-label={`Time in for ${r.studentName}`}
                  disabled={r.attendance !== "present" && r.attendance !== "late"}
                  defaultValue={r.timeIn ?? ""}
                  key={`t-${r.dutyId}-${r.timeIn}-${r.attendance}`}
                  onBlur={(e) => e.target.value !== (r.timeIn ?? "") && save(r, { timeIn: e.target.value || null })}
                />
                <input
                  className="ci-att-remarks"
                  placeholder={r.attendance ? "Remarks" : "Mark attendance first"}
                  aria-label={`Remarks for ${r.studentName}`}
                  disabled={!r.attendance}
                  defaultValue={r.remarks ?? ""}
                  key={`r-${r.dutyId}-${r.attendance ? "on" : "off"}`}
                  onBlur={(e) => e.target.value !== (r.remarks ?? "") && save(r, { remarks: e.target.value || null })}
                />
              </div>
            ))}
          </section>
        );
      })}
    </div>
  );
}
