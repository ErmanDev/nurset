import { useState, type FormEvent } from "react";
import { Monitor } from "lucide-react";
import { api } from "../../../lib/api";
import { formatAddedAt } from "../../../lib/format";
import type { SessionInfo } from "../../../lib/types";
import Modal from "../../../components/Modal/Modal";
import { TextField } from "../../../components/TextField/TextField";
import { MIN_PASSWORD_LENGTH, passwordStrength } from "../../Auth/validation";

/** Change password: checks the current one; other devices are signed out. */
export function ChangePasswordModal({ onClose, onChanged }: { onClose: () => void; onChanged?: () => void }) {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [errors, setErrors] = useState<{ current?: string; next?: string; confirm?: string }>({});
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);
  const strength = passwordStrength(next);

  async function submit(e: FormEvent) {
    e.preventDefault();
    const found: typeof errors = {};
    if (!current) found.current = "Enter your current password.";
    if (next.length < MIN_PASSWORD_LENGTH) found.next = `Use at least ${MIN_PASSWORD_LENGTH} characters.`;
    else if (next === current) found.next = "Choose a password different from your current one.";
    if (confirm !== next) found.confirm = "Passwords don't match.";
    setErrors(found);
    if (Object.values(found).some(Boolean)) return;
    setSaving(true);
    try {
      await api.changePassword(current, next);
      setDone(true);
      onChanged?.();
    } catch (err) {
      const message = String(err);
      setErrors(message.includes("current") ? { current: message } : { next: message });
    } finally {
      setSaving(false);
    }
  }

  if (done) {
    return (
      <Modal
        open
        onClose={onClose}
        title="Password changed"
        width={420}
        footer={
          <button className="btn btn-primary" onClick={onClose}>
            Done
          </button>
        }
      >
        <p className="st-muted">Your new password is set. Any other devices signed in to this account were signed out.</p>
      </Modal>
    );
  }

  return (
    <Modal
      open
      onClose={onClose}
      title="Change Password"
      width={440}
      footer={
        <>
          <button type="button" className="btn btn-secondary" onClick={onClose} data-modal-cancel>
            Cancel
          </button>
          <button type="submit" form="password-form" className="btn btn-primary" disabled={saving}>
            {saving ? "Saving…" : "Change password"}
          </button>
        </>
      }
    >
      <form id="password-form" className="form-stack form-lavender" onSubmit={submit} noValidate>
        <TextField
          label="Current password"
          type="password"
          autoComplete="current-password"
          autoFocus
          value={current}
          error={errors.current}
          onChange={(e) => {
            setCurrent(e.target.value);
            setErrors((er) => ({ ...er, current: undefined }));
          }}
        />
        <TextField
          label="New password"
          type="password"
          autoComplete="new-password"
          placeholder={`At least ${MIN_PASSWORD_LENGTH} characters`}
          value={next}
          error={errors.next}
          hint={next ? `${strength.label} password` : undefined}
          onChange={(e) => {
            setNext(e.target.value);
            setErrors((er) => ({ ...er, next: undefined }));
          }}
        />
        <TextField
          label="Confirm new password"
          type="password"
          autoComplete="new-password"
          value={confirm}
          error={errors.confirm}
          onChange={(e) => {
            setConfirm(e.target.value);
            setErrors((er) => ({ ...er, confirm: undefined }));
          }}
        />
      </form>
    </Modal>
  );
}

/** Sign-in sessions; other active ones can be signed out. */
export function SessionList({
  sessions,
  onEnd,
  showEnded = true,
}: {
  sessions: SessionInfo[];
  onEnd: (id: number) => void;
  showEnded?: boolean;
}) {
  const list = showEnded ? sessions : sessions.filter((s) => s.active);
  if (list.length === 0) return <p className="st-muted">No sign-ins yet.</p>;
  return (
    <div className="st-sessions">
      {list.map((s) => (
        <div key={s.id} className="st-device">
          <Monitor size={22} />
          <div>
            <strong>{s.device}</strong>
            <span>
              Signed in {formatAddedAt(s.createdAt)}
              {s.active ? ` · last active ${formatAddedAt(s.lastSeenAt)}` : s.endedAt ? ` · ended ${formatAddedAt(s.endedAt)}` : ""}
            </span>
          </div>
          {s.current ? (
            <span className="badge badge--green">This device</span>
          ) : s.active ? (
            <button className="btn btn-secondary" onClick={() => onEnd(s.id)}>
              Sign out
            </button>
          ) : (
            <span className="badge badge--gray">Ended</span>
          )}
        </div>
      ))}
    </div>
  );
}
