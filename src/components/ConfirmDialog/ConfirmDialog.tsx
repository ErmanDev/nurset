import { useState } from "react";
import Modal from "../Modal/Modal";
import { toast } from "../Toast/Toast";

interface Props {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  /** Red confirm button for destructive actions. */
  danger?: boolean;
  onConfirm: () => Promise<void> | void;
  onClose: () => void;
}

/** Small yes/no dialog, e.g. "Delete this task?" */
export default function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = "Confirm",
  danger = false,
  onConfirm,
  onClose,
}: Props) {
  const [busy, setBusy] = useState(false);

  async function confirm() {
    setBusy(true);
    try {
      await onConfirm();
    } catch (err) {
      toast.error("That didn't work", String(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      width={400}
      footer={
        <>
          <button className="btn btn-secondary" onClick={onClose} disabled={busy} data-modal-cancel>
            Cancel
          </button>
          <button
            className={`btn ${danger ? "btn-danger" : "btn-primary"}`}
            onClick={confirm}
            disabled={busy}
            autoFocus
          >
            {busy ? "Working…" : confirmLabel}
          </button>
        </>
      }
    >
      <p style={{ fontSize: 13, color: "var(--text-muted)", lineHeight: 1.6 }}>{message}</p>
    </Modal>
  );
}
