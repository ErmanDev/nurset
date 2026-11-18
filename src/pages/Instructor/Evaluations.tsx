import { useMemo, useState, type FormEvent } from "react";
import { Star } from "lucide-react";
import { ciApi, formatMinutes, type EvaluationRow } from "../../lib/instructor";
import { formatTimeRange } from "../../lib/format";
import { useAsync } from "../../hooks/useAsync";
import Modal from "../../components/Modal/Modal";
import { TextAreaField, TextField } from "../../components/TextField/TextField";
import { StudentAvatar, shortDay } from "./shared";
import { toast } from "../../components/Toast/Toast";
import "./Instructor.css";
import "./InstructorTools.css";

type Filter = "todo" | "done" | "all";

const criteria = [
  { key: "knowledge", label: "Knowledge", hint: "Understands conditions, drugs, and procedures" },
  { key: "skills", label: "Clinical skills", hint: "Performs procedures safely and correctly" },
  { key: "professionalism", label: "Professionalism", hint: "Punctual, prepared, follows policies" },
  { key: "communication", label: "Communication", hint: "With patients, staff, and the CI" },
] as const;
type CriterionKey = (typeof criteria)[number]["key"];

const attendanceLabel: Record<string, { label: string; tone: string }> = {
  present: { label: "Present", tone: "green" },
  late: { label: "Late", tone: "amber" },
  absent: { label: "Absent", tone: "red" },
  excused: { label: "Excused", tone: "gray" },
};

function average(r: EvaluationRow): number | null {
  if (!r.evaluated) return null;
  return ((r.knowledge ?? 0) + (r.skills ?? 0) + (r.professionalism ?? 0) + (r.communication ?? 0)) / 4;
}

export default function Evaluations() {
  const { data, error, reload } = useAsync(ciApi.getEvaluations);
  const [filter, setFilter] = useState<Filter>("todo");
  const [editing, setEditing] = useState<EvaluationRow | null>(null);

  const duties = useMemo(
    () => (data?.duties ?? []).filter((d) => (filter === "all" ? true : filter === "done" ? d.evaluated : !d.evaluated)),
    [data, filter],
  );
  const todo = (data?.duties ?? []).filter((d) => !d.evaluated).length;

  return (
    <div className="ci-page">
      <header className="page-header page-header--plain">
        <p className="eyebrow">Clinical instruction</p>
        <h1>Evaluations &amp; Hours</h1>
        <p>Rate each completed duty and confirm the clinical hours your students earned.</p>
      </header>

      {error && <div className="alert-error">{error}</div>}
      {!data && !error && <div className="skeleton" style={{ height: 280 }} />}

      {data && (
        <>
          <section className="card ci-panel">
            <header className="ci-panel-head">
              <div>
                <p className="ci-eyebrow">Confirmed hours</p>
                <h2>Students</h2>
              </div>
            </header>
            {data.students.length === 0 ? (
              <p className="empty-text">Add students to your groups to track their hours.</p>
            ) : (
              <div className="ci-table" role="table" aria-label="Student hours">
                <div className="ci-tr ci-tr--hours ci-th" role="row">
                  <span role="columnheader">Student</span>
                  <span role="columnheader">Duties done</span>
                  <span role="columnheader">Evaluated</span>
                  <span role="columnheader">Confirmed hours</span>
                  <span role="columnheader">Average rating</span>
                </div>
                {data.students.map((s) => (
                  <div key={s.studentId} className="ci-tr ci-tr--hours" role="row">
                    <span className="ci-student" role="cell">
                      <StudentAvatar name={s.studentName} />
                      <span>
                        <strong>{s.studentName}</strong>
                        <small>{s.groupName}</small>
                      </span>
                    </span>
                    <span role="cell">{s.completedDuties}</span>
                    <span role="cell">
                      {s.evaluated}/{s.completedDuties}
                    </span>
                    <span role="cell">
                      <strong>{formatMinutes(s.verifiedMinutes)}</strong>
                    </span>
                    <span role="cell">{s.averageRating === null ? <small className="ci-muted">—</small> : <Stars value={s.averageRating} />}</span>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className="card ci-panel">
            <header className="ci-panel-head">
              <div>
                <p className="ci-eyebrow">Completed duties</p>
                <h2>Duty evaluations</h2>
              </div>
              <div className="ci-chips" role="radiogroup" aria-label="Show">
                {(
                  [
                    ["todo", `To evaluate (${todo})`],
                    ["done", "Evaluated"],
                    ["all", "All"],
                  ] as [Filter, string][]
                ).map(([v, l]) => (
                  <button key={v} role="radio" aria-checked={filter === v} className={filter === v ? "is-active" : ""} onClick={() => setFilter(v)}>
                    {l}
                  </button>
                ))}
              </div>
            </header>
            {duties.length === 0 ? (
              <p className="empty-text">{filter === "todo" ? "All completed duties are evaluated." : "No duties here."}</p>
            ) : (
              <ul className="ci-list">
                {duties.map((d) => {
                  const att = d.attendance ? attendanceLabel[d.attendance] : null;
                  const avg = average(d);
                  return (
                    <li key={d.dutyId} className="ci-eval-row">
                      <StudentAvatar name={d.studentName} />
                      <div>
                        <strong>{d.studentName}</strong>
                        <small>
                          {shortDay(d.dutyDate)} · {d.area} · {formatTimeRange(d.startTime, d.endTime)}
                        </small>
                      </div>
                      {att ? <span className={`badge badge--${att.tone}`}>{att.label}</span> : <span className="badge badge--gray">No attendance</span>}
                      {avg !== null ? (
                        <span className="ci-eval-score">
                          <Stars value={avg} />
                          <small>{formatMinutes(d.verifiedMinutes ?? 0)}</small>
                        </span>
                      ) : (
                        <span className="ci-eval-score" />
                      )}
                      <button className={`btn ${d.evaluated ? "btn-secondary" : "btn-primary"}`} onClick={() => setEditing(d)}>
                        {d.evaluated ? "Edit" : "Evaluate"}
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        </>
      )}

      {editing && (
        <EvaluateModal
          duty={editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            void reload();
          }}
        />
      )}
    </div>
  );
}

function Stars({ value }: { value: number }) {
  return (
    <span className="ci-stars" aria-label={`${value.toFixed(1)} out of 5`}>
      {[1, 2, 3, 4, 5].map((n) => (
        <Star key={n} size={13} className={n <= Math.round(value) ? "is-on" : ""} />
      ))}
      <small>{value.toFixed(1)}</small>
    </span>
  );
}

function EvaluateModal({ duty, onClose, onSaved }: { duty: EvaluationRow; onClose: () => void; onSaved: () => void }) {
  const [ratings, setRatings] = useState<Record<CriterionKey, number>>({
    knowledge: duty.knowledge ?? 0,
    skills: duty.skills ?? 0,
    professionalism: duty.professionalism ?? 0,
    communication: duty.communication ?? 0,
  });
  const defaultHours = duty.verifiedMinutes ?? (duty.attendance === "absent" ? 0 : duty.scheduledMinutes);
  const [hours, setHours] = useState(String(defaultHours / 60));
  const [comments, setComments] = useState(duty.comments ?? "");
  const [errors, setErrors] = useState<{ ratings?: string; hours?: string }>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    const next: typeof errors = {};
    if (criteria.some((c) => ratings[c.key] < 1)) next.ratings = "Rate all four areas.";
    const h = Number(hours);
    if (hours === "" || Number.isNaN(h) || h < 0 || h > 24) next.hours = "Enter 0 to 24 hours.";
    setErrors(next);
    if (Object.values(next).some(Boolean)) return;
    setSaving(true);
    setServerError(null);
    try {
      await ciApi.saveEvaluation(duty.dutyId, { ...ratings, comments: comments || null, verifiedMinutes: Math.round(h * 60) });
      if (duty.evaluated) toast.updated("Evaluation updated", `${duty.studentName}'s evaluation was saved.`);
      else toast.created("Evaluation saved", `${duty.studentName} · ${formatMinutes(Math.round(h * 60))} confirmed.`);
      onSaved();
    } catch (err) {
      setServerError(String(err));
      setSaving(false);
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      eyebrow={`${duty.studentName} · ${shortDay(duty.dutyDate)} · ${duty.area}`}
      title="Duty Evaluation"
      width={520}
      footer={
        <>
          <button type="button" className="btn btn-secondary" onClick={onClose} data-modal-cancel>
            Cancel
          </button>
          <button type="submit" form="eval-form" className="btn btn-primary" disabled={saving}>
            {saving ? "Saving…" : "Save evaluation"}
          </button>
        </>
      }
    >
      <form id="eval-form" className="form-stack form-lavender" onSubmit={submit} noValidate>
        {serverError && <div className="alert-error">{serverError}</div>}
        <div className="ci-rating-list">
          {criteria.map((c) => (
            <div key={c.key} className="ci-rating-row">
              <span>
                <strong>{c.label}</strong>
                <small>{c.hint}</small>
              </span>
              <div className="ci-rating" role="radiogroup" aria-label={c.label}>
                {[1, 2, 3, 4, 5].map((n) => (
                  <button
                    key={n}
                    type="button"
                    role="radio"
                    aria-checked={ratings[c.key] === n}
                    aria-label={`${n}`}
                    className={n <= ratings[c.key] ? "is-on" : ""}
                    onClick={() => {
                      setRatings((r) => ({ ...r, [c.key]: n }));
                      setErrors((e) => ({ ...e, ratings: undefined }));
                    }}
                  >
                    <Star size={18} />
                  </button>
                ))}
              </div>
            </div>
          ))}
          {errors.ratings && <p className="field-error">{errors.ratings}</p>}
        </div>
        <TextField
          label="Confirmed hours"
          type="number"
          min={0}
          max={24}
          step={0.5}
          value={hours}
          error={errors.hours}
          hint={`Scheduled: ${formatMinutes(duty.scheduledMinutes)}${duty.attendance ? ` · attendance: ${duty.attendance}` : ""}`}
          onChange={(e) => {
            setHours(e.target.value);
            setErrors((er) => ({ ...er, hours: undefined }));
          }}
        />
        <TextAreaField label="Comments (optional)" placeholder="Strengths and what to work on" value={comments} onChange={(e) => setComments(e.target.value)} />
      </form>
    </Modal>
  );
}
