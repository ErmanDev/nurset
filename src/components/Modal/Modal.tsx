import { useEffect, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import "./Modal.css";

interface Props {
  open: boolean;
  title: string;
  subtitle?: string;
  /** Small uppercase label above the title. */
  eyebrow?: string;
  onClose: () => void;
  children: ReactNode;
  /** Action buttons, rendered right-aligned at the bottom. */
  footer?: ReactNode;
  width?: number;
  /** Hide the X button (when the body has its own Cancel). */
  hideClose?: boolean;
}

/**
 * Centered dialog. Closes on Escape.
 *
 * Backdrop clicks close it too, unless the dialog contains a button marked
 * `data-modal-cancel` (i.e. it's a form): then an outside click is treated as
 * an accident and the Cancel button is focused and nudged instead, so typed
 * input isn't lost.
 */
export default function Modal({
  open,
  title,
  subtitle,
  eyebrow,
  onClose,
  children,
  footer,
  width = 520,
  hideClose = false,
}: Props) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  const dialog = useRef<HTMLDivElement>(null);

  if (!open) return null;

  function handleBackdrop() {
    const cancel = dialog.current?.querySelector<HTMLElement>("[data-modal-cancel]");
    if (!cancel) return onClose();
    cancel.focus();
    // restart the nudge animation even if it's already playing
    cancel.classList.remove("modal-attention");
    void cancel.offsetWidth;
    cancel.classList.add("modal-attention");
    cancel.addEventListener("animationend", () => cancel.classList.remove("modal-attention"), {
      once: true,
    });
  }

  return createPortal(
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && handleBackdrop()}>
      <div
        ref={dialog}
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        style={{ maxWidth: width }}
      >
        <header className="modal-header">
          <div>
            {eyebrow && <p className="modal-eyebrow">{eyebrow}</p>}
            <h2>{title}</h2>
            {subtitle && <p>{subtitle}</p>}
          </div>
          {!hideClose && (
            <button className="modal-close" onClick={onClose} aria-label="Close">
              <X size={18} />
            </button>
          )}
        </header>
        <div className="modal-body">{children}</div>
        {footer && <footer className="modal-footer">{footer}</footer>}
      </div>
    </div>,
    document.body,
  );
}
