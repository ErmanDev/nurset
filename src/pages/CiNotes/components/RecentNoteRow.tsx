import RowMenu from "../../../components/RowMenu/RowMenu";
import type { CiNote } from "../../../lib/types";
import { noteDateLabel, quoted } from "../notes";
import { PinButton, PriorityBadge, type NoteHandlers } from "./PinnedNoteCard";

export default function RecentNoteRow({ note, onOpen, onTogglePin, onEdit, onDelete }: { note: CiNote } & NoteHandlers) {
  return (
    <article
      className="ci-row"
      role="button"
      tabIndex={0}
      onClick={() => onOpen(note)}
      onKeyDown={(e) => e.key === "Enter" && onOpen(note)}
    >
      <div className="ci-row-main">
        <p className="ci-row-meta">
          {note.clinicalArea && <span className="ci-area">{note.clinicalArea}</span>}
          <span>{noteDateLabel(note)}</span>
        </p>
        <h3>{note.title}</h3>
        <p className="ci-row-quote">
          <span className={`ci-dot ${note.isImportant ? "is-important" : ""}`} aria-hidden="true" />
          {quoted(note.content)}
        </p>
        {note.clinicalInstructor && <p className="ci-from">From: {note.clinicalInstructor}</p>}
      </div>
      <div className="ci-row-actions" onClick={(e) => e.stopPropagation()}>
        <PriorityBadge important={note.isImportant} />
        <PinButton note={note} onToggle={() => onTogglePin(note)} />
        <RowMenu label="Note actions" onEdit={() => onEdit(note)} onDelete={() => onDelete(note)} />
      </div>
    </article>
  );
}
