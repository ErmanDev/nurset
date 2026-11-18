import { useState, type FormEvent } from "react";
import { CalendarDays, ClipboardPen, Hospital, Trash2, User, Users } from "lucide-react";
import { api } from "../../lib/api";
import { ciApi, type Instruction } from "../../lib/instructor";
import { formatLongDate, pastDateError, todayIso } from "../../lib/format";
import { useAsync } from "../../hooks/useAsync";
import Modal from "../../components/Modal/Modal";
import SelectMenu from "../../components/SelectMenu/SelectMenu";
import { TextAreaField, TextField } from "../../components/TextField/TextField";
import ConfirmDialog from "../../components/ConfirmDialog/ConfirmDialog";
import Toggle from "../../components/Toggle/Toggle";
import { toast } from "../../components/Toast/Toast";
import "./Instructor.css";
import "./InstructorTools.css";

export default function Instructions() {
  const { data: items, error, reload } = useAsync(ciApi.listInstructions);
  const [creating, setCreating] = useState(false);
  const [deleting, setDeleting] = useState<Instruction | null>(null);

  return (
    <div className="ci-page">
      <div className="ci-page-head">
        <header className="page-header page-header--plain">
          <p className="eyebrow">Clinical instruction</p>
          <h1>Instructions</h1>
          <p>Send instructions to a group or one student. They appear in the students' CI Notes.</p>
        </header>
        <button className="btn btn-primary" onClick={() => setCreating(true)}>
          <ClipboardPen size={15} /> New Instruction
        </button>
      </div>

      {error && <div className="alert-error">{error}</div>}
      {!items && !error && <div className="skeleton" style={{ height: 220 }} />}
      {items && items.length === 0 && (
        <div className="card ci-empty">
          <p className="empty-text">No instructions sent yet.</p>
        </div>
      )}

      <div className="ci-items">
        {items?.map((i) => (
          <article key={i.id} className="card ci-instruction">
            <div className="ci-item-title">
              <h3>{i.title}</h3>
              {i.isImportant && <span className="badge badge--amber">Important</span>}
              <span className="ci-spacer" />
              <button className="ci-remove" onClick={() => setDeleting(i)} aria-label={`Delete ${i.title}`} title="Delete instruction">
                <Trash2 size={15} />
              </button>
            </div>
            <p className="ci-instruction-body">“{i.content}”</p>
            <p className="ci-item-meta">
              <span>
                {i.groupId ? <Users size={13} /> : <User size={13} />} {i.audience}
                {i.groupId && ` · ${i.recipients} student${i.recipients === 1 ? "" : "s"}`}
              </span>
              <span>
                <CalendarDays size={13} /> {formatLongDate(i.noteDate)}
              </span>
              {i.clinicalArea && (
                <span>
                  <Hospital size={13} /> {i.clinicalArea}
                </span>
              )}
            </p>
          </article>
        ))}
      </div>

      {creating && (
        <InstructionModal
          onClose={() => setCreating(false)}
          onSaved={() => {
            setCreating(false);
            void reload();
          }}
        />
      )}

      <ConfirmDialog
        open={deleting !== null}
        title="Delete instruction?"
        message={`"${deleting?.title ?? ""}" will also be removed from ${deleting?.recipients ?? 0} student${deleting?.recipients === 1 ? "" : "s"}' CI Notes.`}
        confirmLabel="Delete"
        danger
        onClose={() => setDeleting(null)}
        onConfirm={async () => {
          if (!deleting) return;
          await ciApi.deleteInstruction(deleting.id);
          toast.deleted("Instruction deleted", `“${deleting.title}” was removed from students' CI Notes.`);
          setDeleting(null);
          await reload();
        }}
      />
    </div>
  );
}

function InstructionModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const { data: groups } = useAsync(api.listGroups);
  const { data: students } = useAsync(ciApi.listMyStudents);
  const [audience, setAudience] = useState<"group" | "student">("group");
  const [groupId, setGroupId] = useState("");
  const [studentId, setStudentId] = useState("");
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [area, setArea] = useState("");
  const [date, setDate] = useState(todayIso());
  const [important, setImportant] = useState(false);
  const [errors, setErrors] = useState<Record<string, string | undefined>>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const selectedGroup = groupId || String(groups?.[0]?.id ?? "");
  const selectedStudent = studentId || String(students?.[0]?.studentId ?? "");

  async function submit(e: FormEvent) {
    e.preventDefault();
    const next: Record<string, string | undefined> = {};
    if (!title.trim()) next.title = "Give the instruction a title.";
    if (!content.trim()) next.content = "Write the instruction.";
    if (!date) next.date = "Pick a date.";
    else next.date = pastDateError(date);
    if (audience === "group" && !selectedGroup) next.audience = "Create a group first.";
    if (audience === "student" && !selectedStudent) next.audience = "Add students to a group first.";
    setErrors(next);
    if (Object.values(next).some(Boolean)) return;
    setSaving(true);
    setServerError(null);
    try {
      await ciApi.createInstruction({
        title,
        content,
        clinicalArea: area || null,
        noteDate: date,
        isImportant: important,
        groupId: audience === "group" ? Number(selectedGroup) : null,
        studentId: audience === "student" ? Number(selectedStudent) : null,
      });
      toast.created("Instruction sent", `“${title.trim()}” now appears in your students' CI Notes.`);
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
      eyebrow="New instruction"
      title="Send Instruction"
      width={540}
      footer={
        <>
          <button type="button" className="btn btn-secondary" onClick={onClose} data-modal-cancel>
            Cancel
          </button>
          <button type="submit" form="instruction-form" className="btn btn-primary" disabled={saving}>
            {saving ? "Sending…" : "Send"}
          </button>
        </>
      }
    >
      <form id="instruction-form" className="form-stack form-lavender" onSubmit={submit} noValidate>
        {serverError && <div className="alert-error">{serverError}</div>}
        <div className="field">
          <span className="field-label">Send to</span>
          <div className="segmented segmented--2" role="radiogroup" aria-label="Send to">
            {(["group", "student"] as const).map((a) => (
              <button key={a} type="button" role="radio" aria-checked={audience === a} className={audience === a ? "is-active" : ""} onClick={() => setAudience(a)}>
                {a === "group" ? "A group" : "One student"}
              </button>
            ))}
          </div>
        </div>
        {audience === "group" ? (
          <SelectMenu
            label="Group"
            options={(groups ?? []).map((g) => ({ value: String(g.id), label: `${g.name} (${g.memberCount})` }))}
            value={selectedGroup}
            onChange={setGroupId}
            error={errors.audience}
            placeholder="No groups yet"
          />
        ) : (
          <SelectMenu
            label="Student"
            options={(students ?? []).map((s) => ({ value: String(s.studentId), label: `${s.fullName} · ${s.groupName}` }))}
            value={selectedStudent}
            onChange={setStudentId}
            error={errors.audience}
            placeholder="No students yet"
          />
        )}
        <TextField label="Title" placeholder="e.g. Bring your drug study" value={title} error={errors.title} onChange={(e) => setTitle(e.target.value)} />
        <TextAreaField label="Instruction" placeholder="What should your students do or remember?" rows={4} value={content} error={errors.content} onChange={(e) => setContent(e.target.value)} />
        <div className="form-row-2">
          <TextField label="Date" type="date" min={todayIso()} value={date} error={errors.date} onChange={(e) => setDate(e.target.value)} />
          <TextField label="Clinical area (optional)" placeholder="e.g. Medical Ward" value={area} onChange={(e) => setArea(e.target.value)} />
        </div>
        <label className="ci-toggle-row">
          <span>
            <strong>Mark as important</strong>
            <small>Shows as the CI reminder on students' Home and Duty Checklist.</small>
          </span>
          <Toggle label="Mark as important" checked={important} onChange={setImportant} />
        </label>
      </form>
    </Modal>
  );
}
