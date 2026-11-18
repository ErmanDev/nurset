import { useState } from "react";
import { api } from "../../../lib/api";
import { useAsync } from "../../../hooks/useAsync";
import { SectionHeader } from "./shared";
import { SessionList } from "./security";
import { toast } from "../../../components/Toast/Toast";

/** Devices currently signed in to this account. */
export default function DevicesSection() {
  const { data, error, reload } = useAsync(api.getSecurity);
  const [actionError, setActionError] = useState<string | null>(null);

  async function end(id?: number) {
    setActionError(null);
    try {
      await api.endSessions(id);
      toast.deleted(id ? "Device signed out" : "Other devices signed out", "They'll need to sign in again.");
      await reload();
    } catch (err) {
      setActionError(String(err));
    }
  }

  const others = data?.sessions.filter((s) => s.active && !s.current).length ?? 0;

  return (
    <div className="st-section">
      <SectionHeader title="Connected Devices" subtitle="Devices that are signed in to your NurSet account." />
      {(error || actionError) && <div className="alert-error">{error ?? actionError}</div>}
      {!data && !error && <div className="skeleton" style={{ height: 70 }} />}
      {data && <SessionList sessions={data.sessions} showEnded={false} onEnd={(id) => void end(id)} />}
      {others > 0 && (
        <div>
          <button className="btn btn-secondary" onClick={() => void end()}>
            Sign out all other devices
          </button>
        </div>
      )}
      <p className="st-note">
        Your records live in your NurSet account, so signing in on another computer shows the same data. Uploaded files
        stay on the computer they were uploaded from.
      </p>
    </div>
  );
}
