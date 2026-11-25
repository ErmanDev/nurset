import { useState } from "react";
import { Check, UserPlus, X } from "lucide-react";
import { api } from "../../../lib/api";
import { useAsync } from "../../../hooks/useAsync";
import { toast } from "../../../components/Toast/Toast";

/**
 * Invitations from clinical instructors. Until the student accepts, the
 * instructor can't see any of their records.
 */
export default function GroupInvitations({ onAccepted }: { onAccepted: () => void }) {
  const { data, reload } = useAsync(api.listGroupInvitations);
  const [busy, setBusy] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!data || data.length === 0) return null;

  async function respond(groupId: number, groupName: string, accept: boolean) {
    setBusy(groupId);
    setError(null);
    try {
      await api.respondGroupInvitation(groupId, accept);
      if (accept) {
        toast.created("Joined group", `You're now in ${groupName}. Its duties and requirements were added.`);
        window.dispatchEvent(new Event("nurset:profile-changed"));
        onAccepted();
      } else {
        toast.deleted("Invitation declined", groupName);
      }
      await reload();
    } catch (err) {
      setError(String(err));
    } finally {
      setBusy(null);
    }
  }

  return (
    <section className="card invites-card" aria-label="Group invitations">
      <header className="invites-head">
        <span className="invites-icon">
          <UserPlus size={18} />
        </span>
        <div>
          <h2>Group invitation{data.length > 1 ? "s" : ""}</h2>
          <p>Accepting lets the instructor see your duties, readiness, and submitted documents.</p>
        </div>
      </header>
      {error && <div className="alert-error">{error}</div>}
      <ul className="invites-list">
        {data.map((inv) => (
          <li key={inv.groupId}>
            <div className="invites-text">
              <strong>{inv.groupName}</strong>
              <span>
                {inv.instructorName} · {inv.instructorEmail}
              </span>
              {(inv.area || inv.hospital || inv.term) && (
                <small>{[inv.area, inv.hospital, inv.term].filter(Boolean).join(" · ")}</small>
              )}
            </div>
            <div className="invites-actions">
              <button
                className="btn btn-secondary"
                disabled={busy === inv.groupId}
                onClick={() => void respond(inv.groupId, inv.groupName, false)}
              >
                <X size={14} /> Decline
              </button>
              <button
                className="btn btn-primary"
                disabled={busy === inv.groupId}
                onClick={() => void respond(inv.groupId, inv.groupName, true)}
              >
                <Check size={14} /> Accept
              </button>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
