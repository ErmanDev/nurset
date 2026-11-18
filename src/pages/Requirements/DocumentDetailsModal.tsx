import { useState } from "react";
import { ExternalLink, FileText, MessageSquareText } from "lucide-react";
import { api } from "../../lib/api";
import Modal from "../../components/Modal/Modal";
import { formatAddedAt, formatLongDate } from "../../lib/format";
import type { SubmittedDocument } from "../../lib/types";
import { statusInfo } from "./documentStatus";

interface Props {
  document: SubmittedDocument | null;
  onClose: () => void;
}

export default function DocumentDetailsModal({ document: doc, onClose }: Props) {
  const [opening, setOpening] = useState(false);
  const [openError, setOpenError] = useState<string | null>(null);
  if (!doc) return null;

  async function openFile() {
    if (!doc) return;
    setOpening(true);
    setOpenError(null);
    try {
      await api.openDocument(doc.id);
    } catch (err) {
      setOpenError(String(err));
    } finally {
      setOpening(false);
    }
  }
  const { label, tone } = statusInfo[doc.status];

  const rows: [string, string][] = [
    ["File", doc.fileName],
    ["Type", doc.documentType ?? "—"],
    ["Submitted", formatLongDate(doc.submittedAt)],
    ["Requirement", doc.requirementTitle ?? "—"],
    ["Reviewed by", doc.reviewedBy ?? "Not yet reviewed"],
  ];

  return (
    <Modal
      open
      onClose={onClose}
      title="Document Details"
      width={480}
      footer={
        <>
          <button className="btn btn-secondary" onClick={onClose}>
            Close
          </button>
          <button className="btn btn-primary" onClick={() => void openFile()} disabled={opening}>
            <ExternalLink size={15} /> {opening ? "Opening…" : "Open file"}
          </button>
        </>
      }
    >
      <div className="details">
        {openError && <div className="alert-error">{openError}</div>}
        <div className="details-file">
          <span className={`review-doc-icon review-doc-icon--${tone}`}>
            <FileText size={20} />
          </span>
          <div>
            <h3>{doc.title ?? doc.fileName}</h3>
            <span className={`badge badge--${tone}`}>{label}</span>
          </div>
        </div>

        <dl className="details-rows">
          {rows.map(([term, value]) => (
            <div key={term}>
              <dt>{term}</dt>
              <dd>{value}</dd>
            </div>
          ))}
        </dl>

        {doc.notes && (
          <div>
            <p className="details-label">Your notes</p>
            <p className="details-notes">{doc.notes}</p>
          </div>
        )}

        {doc.feedback && (
          <div className="details-feedback">
            <p className="details-feedback-title">
              <MessageSquareText size={14} /> Instructor feedback
            </p>
            <p>{doc.feedback}</p>
            {doc.feedbackAt && <small>Received {formatAddedAt(doc.feedbackAt)}</small>}
          </div>
        )}
      </div>
    </Modal>
  );
}
