import { CalendarDays, Pin, User } from "lucide-react";
import RowMenu from "../../../components/RowMenu/RowMenu";
import type { CiNote } from "../../../lib/types";
import { noteDateLabel, quoted } from "../notes";

export interface NoteHandlers {
  onOpen: (note: CiNote) => void;
  onTogglePin: (note: CiNote) => void;
  onEdit: (note: CiNote) => void;
  onDelete: (note: CiNote) => void;
}

export function PriorityBadge({ important }: { important: boolean }) {
  return <span className={`ci-priority ${important ? "is-important" : ""}`}>{important ? "Important" : "Normal"}</span>;
}

export function PinButton({ note, onToggle, solid }: { note: CiNote; onToggle: () => void; solid?: boolean }) {
  return (
    <button
      className={`ci-pin${note.isPinned ? " is-pinned" : ""}${solid ? " is-solid" : ""}`}
      onClick={(e) => {
        e.stopPropagation();
        onToggle();
      }}
      aria-pressed={note.isPinned}
      aria-label={note.isPinned ? "Unpin note" : "Pin note"}
      title={note.isPinned ? "Unpin note" : "Pin note"}
    >
      <Pin size={14} />
    </button>
  );
}

export default function PinnedNoteCard({ note, onOpen, onTogglePin, onEdit, onDelete }: { note: CiNote } & NoteHandlers) {
  return (
    <article
      className="card ci-pinned-card"
      role="button"
      tabIndex={0}
      onClick={() => onOpen(note)}
      onKeyDown={(e) => e.key === "Enter" && onOpen(note)}
    >
      <div className="ci-pinned-top">
        <PriorityBadge important={note.isImportant} />
        <PinButton note={note} onToggle={() => onTogglePin(note)} solid />
      </div>
      {note.clinicalArea && <p className="ci-area">{note.clinicalArea}</p>}
      <h3>{note.title}</h3>
      <p className="ci-quote">{quoted(note.content)}</p>
      <div className="ci-pinned-foot">
        <span>
          <CalendarDays size={13} /> {noteDateLabel(note)}
        </span>
        {note.clinicalInstructor && (
          <span>
            <User size={13} /> {note.clinicalInstructor}
          </span>
        )}
        <div className="ci-menu" onClick={(e) => e.stopPropagation()}>
          <RowMenu label="Note actions" onEdit={() => onEdit(note)} onDelete={() => onDelete(note)} />
        </div>
      </div>
    </article>
  );
}
