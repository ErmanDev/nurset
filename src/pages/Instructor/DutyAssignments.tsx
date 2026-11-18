import { useMemo, useState, type FormEvent } from "react";
import { CalendarPlus, Clock, Hospital, Users } from "lucide-react";
import { api } from "../../lib/api";
import { ciApi, type DutyAssignment } from "../../lib/instructor";
import { formatTimeRange, parseDate, pastDateError, shortMonth, todayIso } from "../../lib/format";
import { useAsync } from "../../hooks/useAsync";
import type { GroupSummary } from "../../lib/types";
import Modal from "../../components/Modal/Modal";
import SelectMenu from "../../components/SelectMenu/SelectMenu";
import { TextAreaField, TextField } from "../../components/TextField/TextField";
import ConfirmDialog from "../../components/ConfirmDialog/ConfirmDialog";
import RowMenu from "../../components/RowMenu/RowMenu";
import { shortDay } from "./shared";
import { toast } from "../../components/Toast/Toast";
import "./Instructor.css";
import "./InstructorTools.css";

type Tab = "upcoming" | "past";

export default function DutyAssignments() {
  const { data: assignments, error, reload } = useAsync(ciApi.listDutyAssignments);
  const { data: groups } = useAsync(api.listGroups);
  const [tab, setTab] = useState<Tab>("upcoming");
  const [groupFilter, setGroupFilter] = useState("");
  const [form, setForm] = useState<{ assignment?: DutyAssignment } | null>(null);
  const [deleting, setDeleting] = useState<DutyAssignment | null>(null);

  const today = todayIso();
  const visible = useMemo(() => {
    const list = (assignments ?? []).filter(
      (a) => (tab === "upcoming" ? a.dutyDate >= today : a.dutyDate < today) && (!groupFilter || String(a.groupId) === groupFilter),
    );
    // Upcoming: soonest first. Past: most recent first (server order).
    return tab === "upcoming" ? [...list].reverse() : list;
  }, [assignments, tab, groupFilter, today]);

  return (
    <div className="ci-page">
      <div className="ci-page-head">
        <header className="page-header page-header--plain">
          <p className="eyebrow">Clinical instruction</p>
          <h1>Duty Assignments</h1>
          <p>Assign a rotation to a whole group. Each student gets it on their Duty Schedule.</p>
        </header>
        <button className="btn btn-primary" onClick={() => setForm({})} disabled={groups?.length === 0}>
          <CalendarPlus size={15} /> Assign Duty
        </button>
      </div>

      {groups?.length === 0 && <p className="st-note">Create a group in My Groups before assigning duties.</p>}

      <div className="ci-toolbar">
        <div className="ci-tabs" role="tablist">
          {(["upcoming", "past"] as Tab[]).map((t) => (
            <button key={t} role="tab" aria-selected={tab === t} className={tab === t ? "is-active" : ""} onClick={() => setTab(t)}>
              {t === "upcoming" ? "Upcoming" : "Past"}
            </button>
          ))}
        </div>
        <GroupFilter groups={groups} value={groupFilter} onChange={setGroupFilter} />
      </div>

      {error && <div className="alert-error">{error}</div>}
      {!assignments && !error && <div className="skeleton" style={{ height: 220 }} />}
      {assignments && visible.length === 0 && (
        <div className="card ci-empty">
          <p className="empty-text">{tab === "upcoming" ? "No upcoming duty assignments." : "No past assignments."}</p>
        </div>
      )}

      <div className="ci-items">
        {visible.map((a) => (
          <article key={a.id} className="card ci-item">
            <span className="date-tile">
              <strong>{parseDate(a.dutyDate).getDate()}</strong>
              <span>{shortMonth(a.dutyDate)}</span>
            </span>
            <div className="ci-item-body">
              <div className="ci-item-title">
                <h3>{a.area}</h3>
                <span className={`ci-chip ci-tone--${a.groupColor}`}>{a.groupName}</span>
              </div>
              <p className="ci-item-meta">
                <span>
                  <Clock size={13} /> {shortDay(a.dutyDate)} · {formatTimeRange(a.startTime, a.endTime)}
                </span>
                <span>
                  <Hospital size={13} /> {[a.hospital, a.location].filter(Boolean).join(" · ")}
                </span>
                <span>
                  <Users size={13} /> {a.studentCount} student{a.studentCount === 1 ? "" : "s"}
                </span>
              </p>
              {a.notes && <p className="ci-item-notes">{a.notes}</p>}
            </div>
            <RowMenu label="Assignment actions" onEdit={() => setForm({ assignment: a })} onDelete={() => setDeleting(a)} />
          </article>
        ))}
      </div>

      {form && groups && (
        <AssignDutyModal
          groups={groups}
          assignment={form.assignment}
          onClose={() => setForm(null)}
          onSaved={() => {
            setForm(null);
            void reload();
          }}
        />
      )}

      <ConfirmDialog
        open={deleting !== null}
        title="Delete duty assignment?"
        message={`This removes the ${deleting?.area ?? ""} duty from all ${deleting?.studentCount ?? 0} students' schedules, including their duty checklists for it.`}
        confirmLabel="Delete"
        danger
        onClose={() => setDeleting(null)}
        onConfirm={async () => {
          if (!deleting) return;
          await ciApi.deleteDutyAssignment(deleting.id);
          toast.deleted("Duty assignment deleted", "It was also removed from your students' schedules.");
          setDeleting(null);
          await reload();
        }}
      />
    </div>
  );
}

/** "All groups" + each group, as a compact select. */
export function GroupFilter({
  groups,
  value,
  onChange,
}: {
  groups: GroupSummary[] | null;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <label className="ci-select">
      <select value={value} onChange={(e) => onChange(e.target.value)} aria-label="Group">
        <option value="">All groups</option>
        {groups?.map((g) => (
          <option key={g.id} value={g.id}>
            {g.name}
          </option>
        ))}
      </select>
    </label>
  );
}

function AssignDutyModal({
  groups,
  assignment,
  onClose,
  onSaved,
}: {
  groups: GroupSummary[];
  assignment?: DutyAssignment;
  onClose: () => void;
  onSaved: () => void;
}) {
  const editing = Boolean(assignment);
  const [groupId, setGroupId] = useState(String(assignment?.groupId ?? groups[0]?.id ?? ""));
  const firstGroup = groups.find((g) => String(g.id) === groupId);
  const [area, setArea] = useState(assignment?.area ?? firstGroup?.area ?? "");
  const [hospital, setHospital] = useState(assignment?.hospital ?? firstGroup?.hospital ?? "");
  const [location, setLocation] = useState(assignment?.location ?? "");
  const [date, setDate] = useState(assignment?.dutyDate ?? todayIso());
  const [start, setStart] = useState(assignment?.startTime ?? "07:00");
  const [end, setEnd] = useState(assignment?.endTime ?? "15:00");
  const [notes, setNotes] = useState(assignment?.notes ?? "");
  const [errors, setErrors] = useState<Record<string, string | undefined>>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  function pickGroup(id: string) {
    setGroupId(id);
    const g = groups.find((x) => String(x.id) === id);
    // Prefill the group's usual area/hospital when the fields are still empty.
    if (g?.area && !area) setArea(g.area);
    if (g?.hospital && !hospital) setHospital(g.hospital);
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    const next: Record<string, string | undefined> = {};
    if (!groupId) next.group = "Choose a group.";
    if (!area.trim()) next.area = "Enter the clinical area.";
    if (!hospital.trim()) next.hospital = "Enter the hospital or facility.";
    if (!date) next.date = "Pick a date.";
    else if (pastDateError(date, assignment?.dutyDate)) next.date = pastDateError(date, assignment?.dutyDate);
    if (!start) next.start = "Required.";
    if (!end) next.end = "Required.";
    setErrors(next);
    if (Object.values(next).some(Boolean)) return;

    const input = {
      groupId: Number(groupId),
      area,
      hospital,
      location: location || null,
      dutyDate: date,
      startTime: start,
      endTime: end,
      notes: notes || null,
    };
    setSaving(true);
    setServerError(null);
    try {
      if (assignment) {
        await ciApi.updateDutyAssignment(assignment.id, input);
        toast.updated("Duty assignment updated", "Your students' schedules were updated too.");
      } else {
        await ciApi.createDutyAssignment(input);
        toast.created("Duty assigned", "It now appears in each group member's Duty Schedule.");
      }
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
      eyebrow={editing ? "Edit assignment" : "New assignment"}
      title={editing ? "Edit Duty Assignment" : "Assign Duty"}
      width={540}
      footer={
        <>
          <button type="button" className="btn btn-secondary" onClick={onClose} data-modal-cancel>
            Cancel
          </button>
          <button type="submit" form="duty-assign-form" className="btn btn-primary" disabled={saving}>
            {saving ? "Saving…" : editing ? "Save & update students" : "Assign to group"}
          </button>
        </>
      }
    >
      <form id="duty-assign-form" className="form-stack form-lavender" onSubmit={submit} noValidate>
        {serverError && <div className="alert-error">{serverError}</div>}
        {editing ? (
          <p className="ci-form-note">
            Group: <strong>{assignment?.groupName}</strong> · changes update all {assignment?.studentCount} students' duties.
          </p>
        ) : (
          <SelectMenu
            label="Group"
            options={groups.map((g) => ({ value: String(g.id), label: `${g.name} (${g.memberCount})` }))}
            value={groupId}
            onChange={pickGroup}
            error={errors.group}
          />
        )}
        <div className="form-row-2">
          <TextField label="Clinical area" placeholder="e.g. Medical Ward" value={area} error={errors.area} onChange={(e) => setArea(e.target.value)} />
          <TextField label="Hospital / facility" placeholder="e.g. Sanitarium Medical Center" value={hospital} error={errors.hospital} onChange={(e) => setHospital(e.target.value)} />
        </div>
        <TextField label="Floor / unit (optional)" placeholder="e.g. 3rd Floor - Medical Ward" value={location} onChange={(e) => setLocation(e.target.value)} />
        <div className="form-row-3">
          <TextField label="Date" type="date" min={todayIso()} value={date} error={errors.date} onChange={(e) => setDate(e.target.value)} />
          <TextField label="Start" type="time" value={start} error={errors.start} onChange={(e) => setStart(e.target.value)} />
          <TextField label="End" type="time" value={end} error={errors.end} onChange={(e) => setEnd(e.target.value)} />
        </div>
        <TextAreaField label="Notes for students (optional)" placeholder="What to bring, where to report…" value={notes} onChange={(e) => setNotes(e.target.value)} />
      </form>
    </Modal>
  );
}
