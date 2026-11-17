import { useEffect } from "react";
import { createPortal } from "react-dom";
import { ArrowLeft, FileText, Image, NotebookPen, type LucideIcon } from "lucide-react";

export type AttachKind = "file" | "image" | "notes";

const options: { kind: AttachKind; icon: LucideIcon; title: string; text: string }[] = [
  { kind: "file", icon: FileText, title: "Upload File", text: "Upload PDF reviewers" },
  { kind: "image", icon: Image, title: "Upload Image", text: "Send photos of handwritten notes or textbook pages" },
  { kind: "notes", icon: NotebookPen, title: "Add Study Notes", text: "Paste or type your notes for the AI to explain or summarize" },
];

interface Props {
  onPick: (kind: AttachKind) => void;
  onClose: () => void;
}

/** The "+" menu in the chat composer (per design: back arrow, three options). */
export default function AttachMenu({ onPick, onClose }: Props) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return createPortal(
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="attach-menu" role="dialog" aria-modal="true" aria-label="Add to chat">
        <button className="attach-back" onClick={onClose} aria-label="Back">
          <ArrowLeft size={18} />
        </button>
        {options.map(({ kind, icon: Icon, title, text }, i) => (
          <button key={kind} className="attach-option" onClick={() => onPick(kind)} autoFocus={i === 0}>
            <span className="attach-option-icon">
              <Icon size={18} />
            </span>
            <span>
              <strong>{title}</strong>
              <small>{text}</small>
            </span>
          </button>
        ))}
      </div>
    </div>,
    document.body,
  );
}
