import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { ArrowLeft, Hospital, Pencil, Search, Trash2, UserPlus, Users, X } from "lucide-react";
import { api } from "../../lib/api";
import type { GroupDetail as Detail, GroupMember } from "../../lib/types";
import ConfirmDialog from "../../components/ConfirmDialog/ConfirmDialog";
import Modal from "../../components/Modal/Modal";
import { TextField } from "../../components/TextField/TextField";
import GroupFormModal from "./GroupFormModal";
import { ReadinessDots, StudentAvatar, shortDay } from "./shared";
import "./Instructor.css";

export default function GroupDetail() {
  const { id } = useParams();
  const groupId = Number(id);
  const navigate = useNavigate();
  const [detail, setDetail] = useState<Detail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [editing, setEditing] = useState(false);
  const [adding, setAdding] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [removing, setRemoving] = useState<GroupMember | null>(null);

  const load = useCallback(async () => {
    try {
      setDetail(await api.getGroup(groupId));
      setError(null);
    } catch (err) {
      setError(String(err));
    }
  }, [groupId]);

  useEffect(() => {
    void load();
  }, [load]);

  if (error && !detail) {
    return (
      <div className="ci-page">
        <Link to="/ci/groups" className="ci-back">
          <ArrowLeft size={15} /> My Groups
        </Link>
        <div className="alert-error">{error}</div>
      </div>
    );
  }
  if (!detail) return <div className="skeleton" style={{ height: 320, marginTop: 24 }} />;

  const { group, members } = detail;
  const q = query.trim().toLowerCase();
  const visible = members.filter(
    (m) => !q || m.fullName.toLowerCase().includes(q) || m.email.toLowerCase().includes(q) || m.studentNumber?.toLowerCase().includes(q),
  );
  const readyCount = members.filter((m) => m.nextDutyId && m.readinessDone >= 4).length;
  const withDuty = members.filter((m) => m.nextDutyId).length;
  const flagged = members.filter((m) => m.overdueTasks > 0 || m.needsRevision > 0).length;

  return (
    <div className="ci-page">
      <Link to="/ci/groups" className="ci-back">
        <ArrowLeft size={15} /> My Groups
      </Link>

      <header className="card ci-detail-head">
        <span className={`ci-group-icon ci-tone--${group.color}`}>
          <Users size={22} />
        </span>
        <div className="ci-detail-title">
          <h1>{group.name}</h1>
          <p>
            {(group.area || group.hospital) && (
              <>
                <Hospital size={13} /> {[group.area, group.hospital].filter(Boolean).join(" · ")}
              </>
            )}
            {group.term && <span className="ci-detail-term">{group.term}</span>}
          </p>
        </div>
        <div className="ci-detail-actions">
          <button className="btn btn-secondary" onClick={() => setEditing(true)}>
            <Pencil size={14} /> Edit
          </button>
          <button className="btn btn-secondary ci-danger-btn" onClick={() => setDeleting(true)}>
            <Trash2 size={14} /> Delete
          </button>
        </div>
      </header>

      <div className="ci-summary">
        <div className="card">
          <strong>{members.length}</strong>
          <span>Students</span>
        </div>
        <div className="card">
          <strong>
            {readyCount}/{withDuty}
          </strong>
          <span>Ready for next duty</span>
        </div>
        <div className="card">
          <strong>{group.pendingReviews}</strong>
          <span>Documents to review</span>
        </div>
        <div className="card">
          <strong className={flagged > 0 ? "is-alert" : ""}>{flagged}</strong>
          <span>Need follow-up</span>
        </div>
      </div>

      <section className="card ci-members">
        <div className="ci-members-head">
          <h2>Students</h2>
          <label className="ci-search">
            <Search size={15} />
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search students…" aria-label="Search students" />
          </label>
          <button className="btn btn-primary" onClick={() => setAdding(true)}>
            <UserPlus size={15} /> Add student
          </button>
        </div>

        {error && <div className="alert-error">{error}</div>}

        {members.length === 0 ? (
          <p className="empty-text ci-members-empty">No students yet. Add them by email or student ID.</p>
        ) : visible.length === 0 ? (
          <p className="empty-text ci-members-empty">No students match “{query}”.</p>
        ) : (
          <div className="ci-table" role="table" aria-label="Students">
            <div className="ci-tr ci-th" role="row">
              <span role="columnheader">Student</span>
              <span role="columnheader">Next duty</span>
              <span role="columnheader">Readiness</span>
              <span role="columnheader">Requirements</span>
              <span role="columnheader">Status</span>
              <span role="columnheader" aria-label="Actions" />
            </div>
            {visible.map((m) => (
              <div key={m.studentId} className="ci-tr" role="row">
                <span className="ci-student" role="cell">
                  <StudentAvatar name={m.fullName} photo={m.avatarData} />
                  <span>
                    <strong>{m.fullName}</strong>
                    <small>{m.studentNumber ?? m.email}</small>
                  </span>
                </span>
                <span role="cell" className="ci-cell-stack">
                  {m.nextDutyDate ? (
                    <>
                      <strong>{shortDay(m.nextDutyDate)}</strong>
                      <small>{m.nextDutyArea}</small>
                    </>
                  ) : (
                    <small>No upcoming duty</small>
                  )}
                </span>
                <span role="cell">{m.nextDutyId ? <ReadinessDots done={m.readinessDone} /> : <small className="ci-muted">—</small>}</span>
                <span role="cell" className="ci-cell-stack">
                  <strong>
                    {m.requirementsDone}/{m.requirementsTotal}
                  </strong>
                  <small>submitted</small>
                </span>
                <span role="cell" className="ci-badges">
                  {m.pendingReviews > 0 && <span className="badge badge--amber">{m.pendingReviews} to review</span>}
                  {m.needsRevision > 0 && <span className="badge badge--red">Needs revision</span>}
                  {m.overdueTasks > 0 && <span className="badge badge--red">{m.overdueTasks} overdue</span>}
                  {m.pendingReviews === 0 && m.needsRevision === 0 && m.overdueTasks === 0 && (
                    <span className="badge badge--green">On track</span>
                  )}
                </span>
                <span role="cell">
                  <button className="ci-remove" onClick={() => setRemoving(m)} aria-label={`Remove ${m.fullName} from group`} title="Remove from group">
                    <X size={15} />
                  </button>
                </span>
              </div>
            ))}
          </div>
        )}
      </section>

      {editing && (
        <GroupFormModal
          group={group}
          onClose={() => setEditing(false)}
          onSaved={() => {
            setEditing(false);
            void load();
          }}
        />
      )}

      {adding && (
        <AddStudentModal
          groupName={group.name}
          onClose={() => setAdding(false)}
          onAdd={async (identifier) => {
            setDetail(await api.addGroupMember(groupId, identifier));
            setAdding(false);
          }}
        />
      )}

      <ConfirmDialog
        open={removing !== null}
        title="Remove student?"
        message={`${removing?.fullName ?? ""} will be removed from ${group.name}. Their account and records aren't affected.`}
        confirmLabel="Remove"
        danger
        onClose={() => setRemoving(null)}
        onConfirm={async () => {
          if (!removing) return;
          try {
            setDetail(await api.removeGroupMember(groupId, removing.studentId));
          } catch (err) {
            setError(String(err));
          }
          setRemoving(null);
        }}
      />

      <ConfirmDialog
        open={deleting}
        title="Delete group?"
        message={`${group.name} will be deleted. Students keep their accounts and records.`}
        confirmLabel="Delete group"
        danger
        onClose={() => setDeleting(false)}
        onConfirm={async () => {
          await api.deleteGroup(groupId);
          navigate("/ci/groups", { replace: true });
        }}
      />
    </div>
  );
}

function AddStudentModal({
  groupName,
  onClose,
  onAdd,
}: {
  groupName: string;
  onClose: () => void;
  onAdd: (identifier: string) => Promise<void>;
}) {
  const [identifier, setIdentifier] = useState("");
  const [fieldError, setFieldError] = useState<string | undefined>();
  const [saving, setSaving] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!identifier.trim()) return setFieldError("Enter the student's email or student ID.");
    setSaving(true);
    try {
      await onAdd(identifier.trim());
    } catch (err) {
      setFieldError(String(err));
      setSaving(false);
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      eyebrow={groupName}
      title="Add Student"
      width={440}
      footer={
        <>
          <button type="button" className="btn btn-secondary" onClick={onClose} data-modal-cancel>
            Cancel
          </button>
          <button type="submit" form="add-student-form" className="btn btn-primary" disabled={saving}>
            {saving ? "Adding…" : "Add to group"}
          </button>
        </>
      }
    >
      <form id="add-student-form" className="form-stack form-lavender" onSubmit={submit} noValidate>
        <TextField
          label="Email or student ID"
          placeholder="e.g. juan.delacruz@school.edu or 2023-0142"
          autoFocus
          value={identifier}
          error={fieldError}
          hint="The student needs a NurSet account first."
          onChange={(e) => {
            setIdentifier(e.target.value);
            setFieldError(undefined);
          }}
        />
      </form>
    </Modal>
  );
}
