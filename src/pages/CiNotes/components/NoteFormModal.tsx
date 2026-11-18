import { useEffect, useState, type FormEvent } from "react";
import Modal from "../../../components/Modal/Modal";
import SelectMenu from "../../../components/SelectMenu/SelectMenu";
import { TextAreaField, TextField } from "../../../components/TextField/TextField";
import { api } from "../../../lib/api";
import { pastDateError, todayIso } from "../../../lib/format";
import type { CiNote, Duty } from "../../../lib/types";
import { dutyLabel } from "../notes";
import { toast } from "../../../components/Toast/Toast";

interface Props {
  /** Present when editing. */
  note?: CiNote;
  areaOptions: string[];
  onClose: () => void;
  onSaved: (note: CiNote) => void;
}

const priorityOptions = [
  { value: "normal", label: "Normal" },
  { value: "important", label: "Important" },
];

/** Best clinical-area option for a duty's area ("Emergency Room" -> "Emergency Room (ER)"). */
function areaForDuty(dutyArea: string, options: string[]): string | null {
  const a = dutyArea.toLowerCase();
  return options.find((o) => o.toLowerCase().startsWith(a) || a.startsWith(o.toLowerCase())) ?? null;
}

export default function NoteFormModal({ note, areaOptions, onClose, onSaved }: Props) {
  const editing = Boolean(note);
  const [duties, setDuties] = useState<Duty[]>([]);
  const [title, setTitle] = useState(note?.title ?? "");
  const [instructor, setInstructor] = useState(note?.clinicalInstructor ?? "");
  const [area, setArea] = useState(note?.clinicalArea ?? "Medical Ward");
  const [date, setDate] = useState(note?.noteDate ?? todayIso());
  const [important, setImportant] = useState(note?.isImportant ?? false);
  const [dutyId, setDutyId] = useState<string>(note?.dutyId ? String(note.dutyId) : "");
  const [content, setContent] = useState(note?.content ?? "");
  const [errors, setErrors] = useState<{ title?: string; content?: string; date?: string }>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Duties for "Related Duty": upcoming first, then past (newest first).
  useEffect(() => {
    api
      .listDuties()
      .then((list) => {
        const today = todayIso();
        const upcoming = list.filter((d) => d.dutyDate >= today);
        const past = list.filter((d) => d.dutyDate < today).reverse();
        setDuties([...upcoming, ...past]);
        // New notes default to the next duty, like the design.
        if (!note && upcoming[0]) {
          setDutyId(String(upcoming[0].id));
          setArea((a) => areaForDuty(upcoming[0].area, areaOptions) ?? a);
        }
      })
      .catch((err) => setServerError(String(err)));
  }, []); // load once when the dialog opens

  const areas = areaOptions.includes(area) || !area ? areaOptions : [...areaOptions, area];
  const dutyOptions = [
    { value: "", label: "No related duty" },
    ...duties.map((d) => ({ value: String(d.id), label: dutyLabel(d.area, d.dutyDate) })),
  ];

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const next: typeof errors = {};
    if (!title.trim()) next.title = "Give this note a title.";
    if (!content.trim()) next.content = "Write the instruction or reminder.";
    if (!date) next.date = "Pick a date.";
    else {
      const past = pastDateError(date, note?.noteDate);
      if (past) next.date = past;
    }
    setErrors(next);
    if (Object.keys(next).length > 0) return;

    const input = {
      title,
      content,
      clinicalInstructor: instructor || null,
      clinicalArea: area || null,
      noteDate: date,
      isImportant: important,
      dutyId: dutyId ? Number(dutyId) : null,
    };
    setSaving(true);
    setServerError(null);
    try {
      const saved = note ? await api.updateCiNote(note.id, input) : await api.addCiNote(input);
      if (note) toast.updated("Note updated", `Changes to “${saved.title}” were saved.`);
      else toast.created("Note added", `“${saved.title}” was added to your CI Notes.`);
      onSaved(saved);
    } catch (err) {
      setServerError(String(err));
      setSaving(false);
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      eyebrow={editing ? "Edit instructor notes" : "New instructor notes"}
      title={editing ? "Edit CI Notes" : "Add CI Notes"}
      width={540}
      footer={
        <>
          <button type="button" className="btn btn-secondary" onClick={onClose} data-modal-cancel>
            Cancel
          </button>
          <button type="submit" form="ci-note-form" className="btn btn-primary" disabled={saving}>
            {saving ? "Saving…" : editing ? "Save changes" : "Add note"}
          </button>
        </>
      }
    >
      <form id="ci-note-form" className="form-stack form-lavender" onSubmit={handleSubmit} noValidate>
        {serverError && <div className="alert-error">{serverError}</div>}

        <TextField
          label="Note Title"
          placeholder="Give this note a clear title"
          autoFocus
          value={title}
          error={errors.title}
          onChange={(e) => {
            setTitle(e.target.value);
            setErrors((er) => ({ ...er, title: undefined }));
          }}
        />

        <div className="form-row-2">
          <TextField
            label="Clinical Instructor"
            placeholder="CI name"
            value={instructor}
            onChange={(e) => setInstructor(e.target.value)}
          />
          <SelectMenu
            label="Clinical Area"
            options={areas.map((a) => ({ value: a, label: a }))}
            value={area}
            onChange={setArea}
          />
        </div>

        <div className="form-row-2">
          <TextField
            label="Date"
            type="date"
            min={todayIso()}
            value={date}
            error={errors.date}
            onChange={(e) => {
              setDate(e.target.value);
              setErrors((er) => ({ ...er, date: undefined }));
            }}
          />
          <SelectMenu
            label="Priority"
            options={priorityOptions}
            value={important ? "important" : "normal"}
            onChange={(v) => setImportant(v === "important")}
          />
        </div>

        <SelectMenu
          label="Related Duty"
          options={dutyOptions}
          value={dutyId}
          onChange={(v) => {
            setDutyId(v);
            const duty = duties.find((d) => String(d.id) === v);
            const match = duty && areaForDuty(duty.area, areaOptions);
            if (match) setArea(match);
          }}
        />

        <TextAreaField
          label="Note / Instruction"
          placeholder="What did your clinical instructor ask you to do or remember?"
          rows={4}
          value={content}
          error={errors.content}
          onChange={(e) => {
            setContent(e.target.value);
            setErrors((er) => ({ ...er, content: undefined }));
          }}
        />
      </form>
    </Modal>
  );
}
