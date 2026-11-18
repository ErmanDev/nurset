import { useState, type FormEvent } from "react";
import { Building2, CalendarDays, Clock, MapPin, Stethoscope, Type, User } from "lucide-react";
import Modal from "../../../components/Modal/Modal";
import { TextAreaField, TextField } from "../../../components/TextField/TextField";
import { api } from "../../../lib/api";
import { pastDateError, todayIso } from "../../../lib/format";
import { toast } from "../../../components/Toast/Toast";

export type ScheduleKind = "duty" | "exam" | "other";

const kinds: { value: ScheduleKind; label: string }[] = [
  { value: "duty", label: "Clinical Duty" },
  { value: "exam", label: "Exam" },
  { value: "other", label: "Other Event" },
];

interface Props {
  open: boolean;
  initialKind: ScheduleKind;
  initialDate?: string;
  onClose: () => void;
  onSaved: () => void;
}

const empty = {
  title: "", // duty: area
  hospital: "",
  location: "",
  date: "",
  startTime: "",
  endTime: "",
  instructor: "",
  description: "",
};
type Values = typeof empty;
type Errors = Partial<Record<keyof Values, string>>;

/** One form for duties and events; the kind switch changes which fields show. */
export default function AddScheduleModal({ open, initialKind, initialDate, onClose, onSaved }: Props) {
  const [kind, setKind] = useState<ScheduleKind>(initialKind);
  const [values, setValues] = useState<Values>({ ...empty, date: initialDate ?? todayIso() });
  const [errors, setErrors] = useState<Errors>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const isDuty = kind === "duty";

  function bind(field: keyof Values) {
    return {
      value: values[field],
      error: errors[field],
      onChange: (e: { target: { value: string } }) => {
        setValues((v) => ({ ...v, [field]: e.target.value }));
        setErrors((er) => ({ ...er, [field]: undefined }));
      },
    };
  }

  function validate(): Errors {
    const next: Errors = {};
    if (!values.title.trim()) next.title = isDuty ? "Enter the ward or area." : "Enter a title.";
    if (!values.date) next.date = "Pick a date.";
    else {
      const past = pastDateError(values.date);
      if (past) next.date = past;
    }
    if (isDuty) {
      if (!values.hospital.trim()) next.hospital = "Enter the hospital or facility.";
      if (!values.startTime) next.startTime = "Required.";
      if (!values.endTime) next.endTime = "Required.";
    }
    return next;
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const next = validate();
    setErrors(next);
    if (Object.keys(next).length > 0) return;

    setSaving(true);
    setServerError(null);
    try {
      if (isDuty) {
        await api.addDuty({
          area: values.title,
          hospital: values.hospital,
          location: values.location || null,
          dutyDate: values.date,
          startTime: values.startTime,
          endTime: values.endTime,
          clinicalInstructor: values.instructor || null,
          notes: values.description || null,
        });
      } else {
        await api.addEvent({
          title: values.title,
          eventType: kind === "exam" ? "exam" : "other",
          eventDate: values.date,
          startTime: values.startTime || null,
          endTime: values.endTime || null,
          location: values.location || null,
          description: values.description || null,
        });
      }
      toast.created(
        isDuty ? "Duty added" : kind === "exam" ? "Exam added" : "Event added",
        `“${values.title.trim()}” was added to your schedule.`,
      );
      onSaved();
    } catch (err) {
      setServerError(String(err));
      setSaving(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={isDuty ? "Add Duty" : "Add Event"}
      subtitle={isDuty ? "Schedule a clinical rotation." : "Add an exam or activity to your calendar."}
      footer={
        <>
          <button type="button" className="btn btn-secondary" onClick={onClose} data-modal-cancel>
            Cancel
          </button>
          <button type="submit" form="schedule-form" className="btn btn-primary" disabled={saving}>
            {saving ? "Saving…" : isDuty ? "Save duty" : "Save event"}
          </button>
        </>
      }
    >
      <form id="schedule-form" className="schedule-form" onSubmit={handleSubmit} noValidate>
        <div className="segmented" role="radiogroup" aria-label="Type">
          {kinds.map((k) => (
            <button
              key={k.value}
              type="button"
              role="radio"
              aria-checked={kind === k.value}
              className={kind === k.value ? "is-active" : ""}
              onClick={() => {
                setKind(k.value);
                setErrors({});
              }}
            >
              {k.label}
            </button>
          ))}
        </div>

        {serverError && <div className="alert-error">{serverError}</div>}

        <TextField
          label={isDuty ? "Ward / area" : "Title"}
          icon={isDuty ? Stethoscope : Type}
          placeholder={isDuty ? "e.g. Medical Ward" : kind === "exam" ? "e.g. Nursing Exam" : "e.g. Skills Lab Return Demo"}
          autoFocus
          {...bind("title")}
        />

        {isDuty && (
          <TextField
            label="Hospital / facility"
            icon={Building2}
            placeholder="e.g. Sanitarium Medical Center"
            {...bind("hospital")}
          />
        )}

        <div className="form-row-3">
          <TextField label="Date" icon={CalendarDays} type="date" min={todayIso()} {...bind("date")} />
          <TextField label={isDuty ? "Start" : "Start (optional)"} icon={Clock} type="time" {...bind("startTime")} />
          <TextField label={isDuty ? "End" : "End (optional)"} icon={Clock} type="time" {...bind("endTime")} />
        </div>

        <div className={isDuty ? "form-row-2" : undefined}>
          <TextField
            label={isDuty ? "Floor / unit (optional)" : "Location (optional)"}
            icon={MapPin}
            placeholder={isDuty ? "e.g. 3rd Floor - Medical Ward" : "e.g. School / Examination Room"}
            {...bind("location")}
          />
          {isDuty && (
            <TextField
              label="Clinical instructor (optional)"
              icon={User}
              placeholder="e.g. Ms. Santos"
              {...bind("instructor")}
            />
          )}
        </div>

        <TextAreaField
          label="Description (optional)"
          placeholder={isDuty ? "What you'll be doing on this duty" : "Topics, materials to bring, reminders"}
          {...bind("description")}
        />
      </form>
    </Modal>
  );
}
