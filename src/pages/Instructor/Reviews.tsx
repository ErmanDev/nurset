import { useEffect, useState, type FormEvent } from "react";
import { Link } from "react-router";
import { CircleCheck, ExternalLink, FilePlus2, FileText, MessageSquareText, RotateCcw } from "lucide-react";
import { api } from "../../lib/api";
import { ciApi, type DocStatus, type ReviewDocument } from "../../lib/instructor";
import { parseDateTime, pastDateError, todayIso } from "../../lib/format";
import { useAsync } from "../../hooks/useAsync";
import type { GroupSummary } from "../../lib/types";
import Modal from "../../components/Modal/Modal";
import SelectMenu from "../../components/SelectMenu/SelectMenu";
import { TextAreaField, TextField } from "../../components/TextField/TextField";
import ConfirmDialog from "../../components/ConfirmDialog/ConfirmDialog";
import { StudentAvatar, shortDay } from "./shared";
import { toast } from "../../components/Toast/Toast";
import "./Instructor.css";
import "./InstructorTools.css";

type Tab = "reviews" | "requirements";
type Filter = "open" | "needs_revision" | "approved" | "all";

const filters: { value: Filter; label: string }[] = [
  { value: "open", label: "To review" },
  { value: "needs_revision", label: "Needs revision" },
  { value: "approved", label: "Approved" },
  { value: "all", label: "All" },
];

const statusInfo: Record<DocStatus, { label: string; tone: string }> = {
  pending: { label: "Pending", tone: "amber" },
  under_review: { label: "Under review", tone: "blue" },
  approved: { label: "Approved", tone: "green" },
  needs_revision: { label: "Needs revision", tone: "red" },
};

function submittedOn(ts: string): string {
  return parseDateTime(ts).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export default function Reviews() {
  const [tab, setTab] = useState<Tab>("reviews");
  return (
    <div className="ci-page">
      <header className="page-header page-header--plain">
        <p className="eyebrow">Clinical instruction</p>
        <h1>Requirements &amp; Reviews</h1>
        <p>Review your students' submissions and assign requirements to your groups.</p>
      </header>
      <div className="ci-tabs ci-tabs--wide" role="tablist">
        <button role="tab" aria-selected={tab === "reviews"} className={tab === "reviews" ? "is-active" : ""} onClick={() => setTab("reviews")}>
          Reviews
        </button>
        <button role="tab" aria-selected={tab === "requirements"} className={tab === "requirements" ? "is-active" : ""} onClick={() => setTab("requirements")}>
          Requirements
        </button>
      </div>
      {tab === "reviews" ? <ReviewsTab /> : <RequirementsTab />}
    </div>
  );
}

// ---------- reviews ----------

function ReviewsTab() {
  const { data: students } = useAsync(ciApi.listMyStudents);
  const [filter, setFilter] = useState<Filter>("open");
  const [docs, setDocs] = useState<ReviewDocument[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reviewing, setReviewing] = useState<{ doc: ReviewDocument; decision: "approved" | "needs_revision" } | null>(null);

  const load = async (f: Filter = filter) => {
    try {
      setDocs(await ciApi.listReviews(f));
      setError(null);
    } catch (err) {
      setError(String(err));
    }
  };

  useEffect(() => {
    void load("open");
    // eslint-disable-next-line react-hooks/exhaustive-deps -- initial load only
  }, []);

  function changeFilter(f: Filter) {
    setFilter(f);
    setDocs(null);
    void load(f);
  }

  async function markUnderReview(doc: ReviewDocument) {
    try {
      await ciApi.reviewDocument(doc.documentId, "under_review");
      toast.updated("Marked as under review", `${doc.studentName} can see you're checking “${doc.title}”.`);
      await load();
    } catch (err) {
      setError(String(err));
    }
  }

  async function openFile(doc: ReviewDocument) {
    try {
      await ciApi.openReviewDocument(doc.documentId);
    } catch (err) {
      setError(String(err));
    }
  }

  return (
    <>
      <div className="ci-chips" role="radiogroup" aria-label="Show">
        {filters.map((f) => (
          <button key={f.value} role="radio" aria-checked={filter === f.value} className={filter === f.value ? "is-active" : ""} onClick={() => changeFilter(f.value)}>
            {f.label}
          </button>
        ))}
      </div>

      {error && <div className="alert-error">{error}</div>}
      {!docs && !error && <div className="skeleton" style={{ height: 200 }} />}
      {docs && docs.length === 0 && (
        <div className="card ci-empty">
          {students && students.length === 0 ? (
            <p className="empty-text">
              You don't have any students yet. Documents appear here once students in your groups upload them —{" "}
              <Link to="/ci/groups" className="text-link">
                add students in My Groups
              </Link>{" "}
              using their email or student ID.
            </p>
          ) : (
            <p className="empty-text">{filter === "open" ? "Nothing waiting for review." : "No documents here."}</p>
          )}
        </div>
      )}

      <div className="ci-items">
        {docs?.map((d) => {
          const s = statusInfo[d.status];
          const open = d.status === "pending" || d.status === "under_review";
          return (
            <article key={d.documentId} className="card ci-review-card">
              <div className="ci-review-top">
                <StudentAvatar name={d.studentName} size={38} />
                <div className="ci-item-body">
                  <div className="ci-item-title">
                    <h3>{d.title}</h3>
                    <span className={`badge badge--${s.tone}`}>{s.label}</span>
                  </div>
                  <p className="ci-item-meta">
                    <span>
                      {d.studentName}
                      {d.groupName && ` · ${d.groupName}`}
                    </span>
                    <span>
                      <FileText size={13} /> {d.documentType ?? "Document"}
                      {d.requirementTitle && ` · for ${d.requirementTitle}`}
                    </span>
                    <span>Submitted {submittedOn(d.submittedAt)}</span>
                  </p>
                </div>
              </div>
              {d.notes && <p className="ci-item-notes">Student note: {d.notes}</p>}
              {d.feedback && (
                <p className="ci-feedback">
                  <MessageSquareText size={13} /> {d.feedback}
                </p>
              )}
              <div className="ci-review-actions">
                <button className="btn btn-secondary" onClick={() => openFile(d)} disabled={!d.hasFile} title={d.hasFile ? undefined : "No file attached"}>
                  <ExternalLink size={14} /> Open file
                </button>
                {d.status === "pending" && (
                  <button className="btn btn-secondary" onClick={() => markUnderReview(d)}>
                    Mark under review
                  </button>
                )}
                <span className="ci-spacer" />
                <button className="btn btn-secondary ci-danger-btn" onClick={() => setReviewing({ doc: d, decision: "needs_revision" })}>
                  <RotateCcw size={14} /> {open ? "Request revision" : "Change to revision"}
                </button>
                {d.status !== "approved" && (
                  <button className="btn btn-primary ci-approve-btn" onClick={() => setReviewing({ doc: d, decision: "approved" })}>
                    <CircleCheck size={14} /> Approve
                  </button>
                )}
              </div>
            </article>
          );
        })}
      </div>

      {reviewing && (
        <ReviewModal
          doc={reviewing.doc}
          decision={reviewing.decision}
          onClose={() => setReviewing(null)}
          onDone={async () => {
            setReviewing(null);
            await load();
          }}
        />
      )}
    </>
  );
}

function ReviewModal({
  doc,
  decision,
  onClose,
  onDone,
}: {
  doc: ReviewDocument;
  decision: "approved" | "needs_revision";
  onClose: () => void;
  onDone: () => void;
}) {
  const revision = decision === "needs_revision";
  const [feedback, setFeedback] = useState("");
  const [error, setError] = useState<string | undefined>();
  const [saving, setSaving] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (revision && !feedback.trim()) return setError("Tell the student what to revise.");
    setSaving(true);
    try {
      await ciApi.reviewDocument(doc.documentId, decision, feedback.trim() || null);
      if (decision === "approved") toast.created("Document approved", `“${doc.title}” from ${doc.studentName} was approved.`);
      else toast.updated("Sent back for revision", `${doc.studentName} will see your feedback on “${doc.title}”.`);
      onDone();
    } catch (err) {
      setError(String(err));
      setSaving(false);
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      eyebrow={`${doc.studentName} · ${doc.title}`}
      title={revision ? "Request Revision" : "Approve Document"}
      width={480}
      footer={
        <>
          <button type="button" className="btn btn-secondary" onClick={onClose} data-modal-cancel>
            Cancel
          </button>
          <button type="submit" form="review-form" className={`btn ${revision ? "btn-danger" : "btn-primary"}`} disabled={saving}>
            {saving ? "Saving…" : revision ? "Send back for revision" : "Approve"}
          </button>
        </>
      }
    >
      <form id="review-form" className="form-stack form-lavender" onSubmit={submit} noValidate>
        <TextAreaField
          label={revision ? "What needs to change?" : "Feedback (optional)"}
          placeholder={revision ? "e.g. Add the nursing responsibilities section." : "e.g. Well organized — good work."}
          rows={4}
          autoFocus
          value={feedback}
          error={error}
          onChange={(e) => {
            setFeedback(e.target.value);
            setError(undefined);
          }}
        />
        <p className="ci-form-note">The student sees this on their Document Review page.</p>
      </form>
    </Modal>
  );
}

// ---------- requirements ----------

function RequirementsTab() {
  const { data: reqs, error, reload } = useAsync(ciApi.listRequirementAssignments);
  const { data: groups } = useAsync(api.listGroups);
  const [creating, setCreating] = useState(false);
  const [deleting, setDeleting] = useState<{ id: number; title: string; groupName: string } | null>(null);

  return (
    <>
      <div className="ci-toolbar">
        <p className="ci-muted-text">Each student in the group gets the requirement on their Requirements page.</p>
        <button className="btn btn-primary" onClick={() => setCreating(true)} disabled={!groups || groups.length === 0}>
          <FilePlus2 size={15} /> Assign Requirement
        </button>
      </div>

      {error && <div className="alert-error">{error}</div>}
      {!reqs && !error && <div className="skeleton" style={{ height: 180 }} />}
      {reqs && reqs.length === 0 && (
        <div className="card ci-empty">
          <p className="empty-text">No requirements assigned yet.</p>
        </div>
      )}

      {reqs && reqs.length > 0 && (
        <div className="card ci-req-table">
          {reqs.map((r) => {
            const pct = r.total ? Math.round((r.submitted / r.total) * 100) : 0;
            const overdue = r.dueDate < todayIso();
            return (
              <div key={r.id} className="ci-req-row">
                <div className="ci-item-body">
                  <div className="ci-item-title">
                    <h3>{r.title}</h3>
                    <span className={`ci-chip ci-tone--${r.groupColor}`}>{r.groupName}</span>
                  </div>
                  <p className="ci-item-meta">
                    <span className={overdue ? "is-overdue" : ""}>
                      {overdue ? "Was due" : "Due"} {shortDay(r.dueDate)}
                    </span>
                    {r.description && <span>{r.description}</span>}
                  </p>
                </div>
                <div className="ci-req-progress">
                  <div className="ci-bar" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
                    <span style={{ width: `${pct}%` }} />
                  </div>
                  <small>
                    {r.submitted}/{r.total} submitted · {r.approved} approved
                  </small>
                </div>
                <button className="ci-remove" onClick={() => setDeleting({ id: r.id, title: r.title, groupName: r.groupName })} aria-label={`Delete ${r.title}`} title="Delete requirement">
                  ×
                </button>
              </div>
            );
          })}
        </div>
      )}

      {creating && groups && (
        <AssignRequirementModal
          groups={groups}
          onClose={() => setCreating(false)}
          onSaved={() => {
            setCreating(false);
            void reload();
          }}
        />
      )}

      <ConfirmDialog
        open={deleting !== null}
        title="Delete requirement?"
        message={`"${deleting?.title ?? ""}" will be removed for everyone in ${deleting?.groupName ?? ""}. Documents students already submitted are kept.`}
        confirmLabel="Delete"
        danger
        onClose={() => setDeleting(null)}
        onConfirm={async () => {
          if (!deleting) return;
          await ciApi.deleteRequirementAssignment(deleting.id);
          toast.deleted("Requirement deleted", `“${deleting.title}” was removed.`);
          setDeleting(null);
          await reload();
        }}
      />
    </>
  );
}

function AssignRequirementModal({ groups, onClose, onSaved }: { groups: GroupSummary[]; onClose: () => void; onSaved: () => void }) {
  const [groupId, setGroupId] = useState(String(groups[0]?.id ?? ""));
  const [title, setTitle] = useState("");
  const [due, setDue] = useState("");
  const [description, setDescription] = useState("");
  const [errors, setErrors] = useState<Record<string, string | undefined>>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    const next: Record<string, string | undefined> = {};
    if (!title.trim()) next.title = "Enter the requirement.";
    if (!due) next.due = "Pick a due date.";
    else next.due = pastDateError(due);
    setErrors(next);
    if (Object.values(next).some(Boolean)) return;
    setSaving(true);
    setServerError(null);
    try {
      await ciApi.createRequirementAssignment({ groupId: Number(groupId), title, description: description || null, dueDate: due });
      toast.created("Requirement assigned", `“${title.trim()}” was added to each member's Requirements.`);
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
      eyebrow="New requirement"
      title="Assign Requirement"
      width={500}
      footer={
        <>
          <button type="button" className="btn btn-secondary" onClick={onClose} data-modal-cancel>
            Cancel
          </button>
          <button type="submit" form="req-assign-form" className="btn btn-primary" disabled={saving}>
            {saving ? "Assigning…" : "Assign to group"}
          </button>
        </>
      }
    >
      <form id="req-assign-form" className="form-stack form-lavender" onSubmit={submit} noValidate>
        {serverError && <div className="alert-error">{serverError}</div>}
        <SelectMenu
          label="Group"
          options={groups.map((g) => ({ value: String(g.id), label: `${g.name} (${g.memberCount})` }))}
          value={groupId}
          onChange={setGroupId}
        />
        <TextField label="Requirement" placeholder="e.g. Drug Study" autoFocus value={title} error={errors.title} onChange={(e) => setTitle(e.target.value)} />
        <TextField label="Due date" type="date" min={todayIso()} value={due} error={errors.due} onChange={(e) => setDue(e.target.value)} />
        <TextAreaField label="Details (optional)" placeholder="Format, number of drugs, references…" value={description} onChange={(e) => setDescription(e.target.value)} />
      </form>
    </Modal>
  );
}
