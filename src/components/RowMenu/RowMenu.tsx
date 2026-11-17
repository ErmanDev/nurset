import { useEffect, useRef, useState } from "react";
import { MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import "./RowMenu.css";

interface Props {
  onEdit: () => void;
  onDelete: () => void;
  /** Accessible name for the trigger button. */
  label?: string;
}

/** "…" button with an Edit / Delete dropdown. */
export default function RowMenu({ onEdit, onDelete, label = "Actions" }: Props) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      if (!root.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  function pick(action: () => void) {
    setOpen(false);
    action();
  }

  return (
    <div className="row-menu" ref={root}>
      <button
        className="row-menu-trigger"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={label}
      >
        <MoreHorizontal size={17} />
      </button>
      {open && (
        <div className="row-menu-list" role="menu">
          <button role="menuitem" onClick={() => pick(onEdit)}>
            <Pencil size={14} /> Edit
          </button>
          <button role="menuitem" className="is-danger" onClick={() => pick(onDelete)}>
            <Trash2 size={14} /> Delete
          </button>
        </div>
      )}
    </div>
  );
}
