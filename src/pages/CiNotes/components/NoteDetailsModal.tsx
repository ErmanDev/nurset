import { Pin, PinOff } from "lucide-react";
import Modal from "../../../components/Modal/Modal";
import type { CiNote } from "../../../lib/types";
import { dutyLabel, noteDateLabel, quoted } from "../notes";
import { PriorityBadge } from "./PinnedNoteCard";

interface Props {
  note: CiNote;
  onClose: () => void;
  onTogglePin: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onViewDuty: () => void;
}

export default function NoteDetailsModal({ note, onClose, onTogglePin, onEdit, onDelete, onViewDuty }: Props) {
  const fields: [string, string][] = [
    ["Clinical Area", note.clinicalArea ?? "—"],
    ["Date", noteDateLabel(note)],
    ["Clinical Instructor", note.clinicalInstructor ?? "—"],
    ["Related Duty", dutyLabel(note.dutyArea, note.dutyDate)],
  ];

  return (
    <Modal
      open
      onClose={onClose}
      title={note.title}
      width={560}
      footer={
        <>
          <button className="btn ci-btn-delete" onClick={onDelete}>
            Delete
          </button>
          <button className="btn btn-secondary" onClick={onTogglePin}>
            {note.isPinned ? <PinOff size={14} /> : <Pin size={14} />} {note.isPinned ? "Unpin Note" : "Pin Note"}
          </button>
          <button className="btn btn-secondary" onClick={onEdit}>
            Edit
          </button>
          <button
            className="btn ci-btn-duty"
            onClick={onViewDuty}
            disabled={!note.dutyId}
            title={note.dutyId ? undefined : "No related duty"}
          >
            View Duty
          </button>
        </>
      }
    >
      <div className="ci-details">
        <PriorityBadge important={note.isImportant} />
        <div className="ci-details-grid">
          {fields.map(([label, value]) => (
            <div key={label} className="ci-details-box">
              <span>{label}</span>
              <strong>{value}</strong>
            </div>
          ))}
        </div>
        <div className="ci-details-box">
          <span>Note / Instruction</span>
          <p>{quoted(note.content)}</p>
        </div>
      </div>
    </Modal>
  );
}
