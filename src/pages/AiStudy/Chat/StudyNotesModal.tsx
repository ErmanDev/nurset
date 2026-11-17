import { useState } from "react";
import Modal from "../../../components/Modal/Modal";
import { TextAreaField } from "../../../components/TextField/TextField";

interface Props {
  onClose: () => void;
  onAdd: (notes: string) => void;
}

export default function StudyNotesModal({ onClose, onAdd }: Props) {
  const [notes, setNotes] = useState("");

  return (
    <Modal
      open
      onClose={onClose}
      eyebrow="AI Assistant"
      title="Add Study Notes"
      width={520}
      footer={
        <>
          <button type="button" className="btn btn-secondary" onClick={onClose} data-modal-cancel>
            Cancel
          </button>
          <button className="btn btn-primary" disabled={!notes.trim()} onClick={() => onAdd(notes.trim())}>
            Attach notes
          </button>
        </>
      }
    >
      <TextAreaField
        label="Your notes"
        placeholder="Paste or type the notes you want explained or summarized…"
        rows={10}
        autoFocus
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
      />
    </Modal>
  );
}
