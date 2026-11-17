import { useState, type FormEvent } from "react";
import Modal from "../../../components/Modal/Modal";
import ComboField from "../../../components/ComboField/ComboField";
import { SelectField, TextField } from "../../../components/TextField/TextField";
import { api } from "../../../lib/api";
import { daysUntil, parseDate, pastDateError, toIso, todayIso } from "../../../lib/format";
import type { Task, TaskPriority } from "../../../lib/types";
import { TASK_CATEGORIES, normalizeCategory, priorityInfo } from "../tasks";

interface Props {
  /** Present when editing. */
  task?: Task;
  onClose: () => void;
  onSaved: () => void;
}

/** Quick picker that sets the due date. "overdue" only appears for past dates. */
type ScheduleGroup = "today" | "tomorrow" | "upcoming" | "overdue";

function addDays(iso: string, days: number): string {
  const d = parseDate(iso);
  d.setDate(d.getDate() + days);
  return toIso(d);
}

function groupFor(dueDate: string): ScheduleGroup {
  const diff = daysUntil(dueDate);
  if (diff < 0) return "overdue";
  if (diff === 0) return "today";
  if (diff === 1) return "tomorrow";
  return "upcoming";
}

const priorityOptions = (Object.keys(priorityInfo) as TaskPriority[]).map((p) => ({
  value: p,
  label: priorityInfo[p].label,
}));

export default function TaskFormModal({ task, onClose, onSaved }: Props) {
  const editing = Boolean(task);
  const [title, setTitle] = useState(task?.title ?? "");
  const [category, setCategory] = useState(task?.category ?? "");
  const [priority, setPriority] = useState<TaskPriority>(task?.priority ?? "medium");
  const [dueDate, setDueDate] = useState(task?.dueDate ?? todayIso());
  const [dueTime, setDueTime] = useState(task?.dueTime ?? "");
  const [errors, setErrors] = useState<{ title?: string; dueDate?: string }>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const group = dueDate ? groupFor(dueDate) : "upcoming";

  function pickGroup(next: ScheduleGroup) {
    const today = todayIso();
    if (next === "today") setDueDate(today);
    else if (next === "tomorrow") setDueDate(addDays(today, 1));
    else if (next === "upcoming" && (group !== "upcoming" || !dueDate)) setDueDate(addDays(today, 2));
    setErrors((e) => ({ ...e, dueDate: undefined }));
  }

  const groupOptions = [
    { value: "today", label: "Today" },
    { value: "tomorrow", label: "Tomorrow" },
    { value: "upcoming", label: "Upcoming" },
    ...(group === "overdue" ? [{ value: "overdue", label: "Overdue (past date)" }] : []),
  ];

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const next: typeof errors = {};
    if (!title.trim()) next.title = "Enter a task name.";
    if (!dueDate) next.dueDate = "Pick a due date.";
    else {
      const past = pastDateError(dueDate, task?.dueDate);
      if (past) next.dueDate = past;
    }
    setErrors(next);
    if (Object.keys(next).length > 0) return;

    const input = {
      title,
      category: normalizeCategory(category) || "Study",
      priority,
      dueDate,
      dueTime: dueTime || null,
      // Not on this form; keep whatever an existing task already has.
      subject: task?.subject ?? null,
      durationMinutes: task?.durationMinutes ?? null,
      notes: task?.notes ?? null,
    };

    setSaving(true);
    setServerError(null);
    try {
      if (task) await api.updateTask(task.id, input);
      else await api.addTask(input);
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
      eyebrow={editing ? "Edit task" : "New task"}
      title={editing ? "Edit Task" : "Add Task"}
      width={460}
      footer={
        <>
          <button type="button" className="btn btn-secondary" onClick={onClose} data-modal-cancel>
            Cancel
          </button>
          <button type="submit" form="task-form" className="btn btn-primary" disabled={saving}>
            {saving ? "Saving…" : editing ? "Save changes" : "Add Task"}
          </button>
        </>
      }
    >
      <form id="task-form" className="form-stack task-form" onSubmit={handleSubmit} noValidate>
        {serverError && <div className="alert-error">{serverError}</div>}

        <TextField
          label="Task name"
          placeholder="What needs to be done"
          autoFocus
          value={title}
          error={errors.title}
          onChange={(e) => {
            setTitle(e.target.value);
            setErrors((er) => ({ ...er, title: undefined }));
          }}
        />

        <div className="form-row-2">
          {/* Pick from the list or type a custom category. */}
          <ComboField
            label="Category"
            placeholder="Clinical"
            options={TASK_CATEGORIES}
            value={category}
            onChange={setCategory}
          />

          <SelectField
            label="Priority"
            options={priorityOptions}
            value={priority}
            onChange={(e) => setPriority(e.target.value as TaskPriority)}
          />
        </div>

        <div className="form-row-2">
          <TextField
            label="Due Date"
            type="date"
            min={todayIso()}
            value={dueDate}
            error={errors.dueDate}
            onChange={(e) => {
              setDueDate(e.target.value);
              setErrors((er) => ({ ...er, dueDate: undefined }));
            }}
          />
          <TextField
            label="Due Time"
            type="time"
            value={dueTime}
            onChange={(e) => setDueTime(e.target.value)}
          />
        </div>

        <SelectField
          label="Schedule Group"
          options={groupOptions}
          value={group}
          onChange={(e) => pickGroup(e.target.value as ScheduleGroup)}
        />
      </form>
    </Modal>
  );
}
