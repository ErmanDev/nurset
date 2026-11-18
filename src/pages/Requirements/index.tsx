import { useMemo, useState } from "react";
import { FileText, Info, Upload } from "lucide-react";
import { api } from "../../lib/api";
import { formatLongDate } from "../../lib/format";
import { useAsync } from "../../hooks/useAsync";
import type { SubmittedDocument } from "../../lib/types";
import DocumentDetailsModal from "./DocumentDetailsModal";
import UploadDocumentModal from "./UploadDocumentModal";
import { statusGroup, statusInfo, type StatusGroup } from "./documentStatus";
import "./Requirements.css";

const summaryCards: { group: StatusGroup; title: string; caption: string; tone: string }[] = [
  { group: "pending", title: "Pending Review", caption: "Documents awaiting instructor approval", tone: "blue" },
  { group: "approved", title: "Approved", caption: "Documents approved by instructor", tone: "green" },
  { group: "needs_revision", title: "Needs Revision", caption: "Correction requested", tone: "orange" },
];

export default function Requirements() {
  const { data: documents, error, reload } = useAsync(api.listDocuments);
  const { data: profile } = useAsync(api.getProfile);
  const noInstructor = profile?.accountType === "student" && profile.instructorCount === 0;
  const [filter, setFilter] = useState<StatusGroup | null>(null);
  const [uploading, setUploading] = useState(false);
  const [selected, setSelected] = useState<SubmittedDocument | null>(null);

  const counts = useMemo(() => {
    const c: Record<StatusGroup, number> = { pending: 0, approved: 0, needs_revision: 0 };
    for (const d of documents ?? []) c[statusGroup(d.status)]++;
    return c;
  }, [documents]);

  const visible = (documents ?? []).filter((d) => !filter || statusGroup(d.status) === filter);
  const withFeedback = (documents ?? [])
    .filter((d) => d.feedback)
    .sort((a, b) => (b.feedbackAt ?? "").localeCompare(a.feedbackAt ?? ""));

  return (
    <div className="review">
      <div className="review-header">
        <header className="page-header page-header--plain">
          <h1>Document Review</h1>
          <p>Review your submitted nursing documents and track their approval status.</p>
        </header>
        <button className="btn btn-primary review-upload" onClick={() => setUploading(true)}>
          <Upload size={15} /> Upload Document
        </button>
      </div>

      {noInstructor && (
        <div className="review-notice" role="note">
          <Info size={17} />
          <div>
            <strong>No clinical instructor yet</strong>
            <span>
              Your uploads are saved, but no instructor can review them until one adds you to their clinical group. Give
              your instructor your email{profile?.studentId ? " or student ID" : ""}
              {profile?.email ? ` (${profile.email}${profile.studentId ? ` · ${profile.studentId}` : ""})` : ""}.
            </span>
          </div>
        </div>
      )}

      {error && <div className="alert-error">Couldn't load your documents: {error}</div>}

      <div className="review-stats">
        {summaryCards.map((card) => (
          <button
            key={card.group}
            className={`review-stat review-stat--${card.tone}${filter === card.group ? " is-active" : ""}`}
            onClick={() => setFilter((f) => (f === card.group ? null : card.group))}
            aria-pressed={filter === card.group}
          >
            <span className="review-stat-title">{card.title}</span>
            <strong>{documents ? counts[card.group] : "–"}</strong>
            <span className="review-stat-caption">{card.caption}</span>
          </button>
        ))}
      </div>

      <section>
        <div className="review-section-head">
          <h2 className="review-heading">Submitted Documents</h2>
          {filter && (
            <button className="text-link" onClick={() => setFilter(null)}>
              Showing {summaryCards.find((c) => c.group === filter)?.title} · Show all
            </button>
          )}
        </div>

        {!documents && !error && <div className="skeleton" style={{ height: 240 }} />}

        {documents && visible.length === 0 && (
          <div className="card review-empty">
            <p className="empty-text">No documents here yet.</p>
          </div>
        )}

        <div className="review-list">
          {visible.map((doc) => {
            const { label, tone } = statusInfo[doc.status];
            return (
              <article key={doc.id} className="card review-doc">
                <span className={`review-doc-icon review-doc-icon--${tone}`}>
                  <FileText size={18} />
                </span>
                <div className="review-doc-body">
                  <h3>{doc.title ?? doc.fileName}</h3>
                  <p>
                    Submitted {formatLongDate(doc.submittedAt)}
                    {doc.documentType && ` · ${doc.documentType}`}
                  </p>
                  {doc.requirementTitle && <p className="review-doc-req">For: {doc.requirementTitle}</p>}
                </div>
                <span className={`badge badge--${tone} review-badge`}>{label}</span>
                <button className={`review-details review-details--${tone}`} onClick={() => setSelected(doc)}>
                  View Details
                </button>
              </article>
            );
          })}
        </div>
      </section>

      <section>
        <h2 className="review-heading">Instructor Feedback</h2>
        {documents && withFeedback.length === 0 && (
          <div className="card review-empty">
            <p className="empty-text">No feedback from your instructor yet.</p>
          </div>
        )}
        <div className="review-list">
          {withFeedback.map((doc) => (
            <article key={doc.id} className="card review-feedback">
              <h3>{doc.title ?? doc.fileName}</h3>
              <p className="review-feedback-text">{doc.feedback}</p>
              <p className="review-feedback-meta">
                Feedback received {formatLongDate(doc.feedbackAt ?? doc.submittedAt)}
                {doc.reviewedBy && ` · ${doc.reviewedBy}`}
              </p>
            </article>
          ))}
        </div>
      </section>

      <DocumentDetailsModal document={selected} onClose={() => setSelected(null)} />

      {uploading && (
        <UploadDocumentModal
          open
          onClose={() => setUploading(false)}
          onUploaded={() => {
            setUploading(false);
            setFilter(null);
            void reload();
          }}
        />
      )}
    </div>
  );
}
