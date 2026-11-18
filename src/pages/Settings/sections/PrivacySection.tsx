import { useState } from "react";
import { useNavigate } from "react-router";
import { HardDrive } from "lucide-react";
import { api } from "../../../lib/api";
import { formatAddedAt } from "../../../lib/format";
import { usePreferences } from "../../../lib/preferences";
import { useAsync } from "../../../hooks/useAsync";
import Modal from "../../../components/Modal/Modal";
import Toggle from "../../../components/Toggle/Toggle";
import { SectionHeader, SettingRow } from "./shared";
import { ChangePasswordModal, SessionList } from "./security";
import { toast } from "../../../components/Toast/Toast";

type Dialog = "password" | "sessions" | "history" | "privacy" | "delete" | null;

export default function PrivacySection() {
  const navigate = useNavigate();
  const { get, set, reload } = usePreferences();
  const { data: security, reload: reloadSecurity } = useAsync(api.getSecurity);
  const [dialog, setDialog] = useState<Dialog>(null);
  const [exporting, setExporting] = useState(false);
  const [exportResult, setExportResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirmText, setConfirmText] = useState("");
  const [deleting, setDeleting] = useState(false);

  async function exportData() {
    setExporting(true);
    setError(null);
    try {
      const path = await api.exportData();
      setExportResult(path);
      toast.created("Data exported", path);
      await set({ last_export_at: new Date().toISOString().slice(0, 10) });
    } catch (err) {
      setError(String(err));
    } finally {
      setExporting(false);
    }
  }

  async function deleteEverything() {
    setDeleting(true);
    try {
      await api.resetAllData(confirmText);
      await reload();
      navigate("/login", { replace: true });
      window.location.reload();
    } catch (err) {
      setError(String(err));
      setDeleting(false);
    }
  }

  async function endSessions(id?: number) {
    try {
      await api.endSessions(id);
      toast.deleted(id ? "Device signed out" : "Other devices signed out", "They'll need to sign in again.");
      await reloadSecurity();
    } catch (err) {
      setError(String(err));
    }
  }

  const lastExport = get("last_export_at");
  const activeCount = security?.sessions.filter((s) => s.active).length ?? 0;
  const otherActive = security?.sessions.filter((s) => s.active && !s.current).length ?? 0;

  return (
    <div className="st-section">
      <SectionHeader title="Privacy & Security" subtitle="Protect your information and control how it's used." />
      {error && <div className="alert-error">{error}</div>}

      <div className="st-security-card">
        <span className="st-security-icon">
          <HardDrive size={20} />
        </span>
        <div>
          <strong>Your data is private to your account</strong>
          <span>
            Your records are kept separate from other students'. Uploaded files stay on this computer.
            {lastExport ? ` Last backup: ${lastExport}.` : " Export a backup copy from time to time."}
          </span>
        </div>
      </div>

      <div className="st-block">
        <SettingRow
          title="Change Password"
          text={
            security?.passwordChangedAt
              ? `Last changed ${formatAddedAt(security.passwordChangedAt)}.`
              : "Update your password regularly to keep your account secure."
          }
        >
          <button className="btn btn-secondary" onClick={() => setDialog("password")}>
            Change
          </button>
        </SettingRow>
        <SettingRow
          title="Active Sessions"
          text={activeCount > 1 ? `Signed in on ${activeCount} devices.` : "You're signed in on this device only."}
        >
          <button className="btn btn-secondary" onClick={() => setDialog("sessions")}>
            Manage
          </button>
        </SettingRow>
        <SettingRow title="Login History" text="Your recent sign-ins, including ended sessions.">
          <button className="btn btn-secondary" onClick={() => setDialog("history")}>
            View
          </button>
        </SettingRow>
        <SettingRow title="Data Export" text="Download a copy of all your NurSet information (JSON).">
          <button className="btn btn-secondary" onClick={exportData} disabled={exporting}>
            {exporting ? "Exporting…" : "Export"}
          </button>
        </SettingRow>
        <SettingRow title="Privacy Preferences" text="Manage profile visibility and personalization.">
          <button className="btn btn-secondary" onClick={() => setDialog("privacy")}>
            Manage
          </button>
        </SettingRow>
      </div>

      <div className="st-danger">
        <div>
          <strong>Delete account</strong>
          <span>Permanently remove your account and all of your NurSet data.</span>
        </div>
        <button className="btn btn-danger" onClick={() => setDialog("delete")}>
          Delete Account
        </button>
      </div>

      {dialog === "password" && <ChangePasswordModal onClose={() => setDialog(null)} onChanged={() => void reloadSecurity()} />}

      {dialog === "history" && (
        <Modal
          open
          onClose={() => setDialog(null)}
          title="Login History"
          width={520}
          footer={
            <button className="btn btn-primary" onClick={() => setDialog(null)}>
              Close
            </button>
          }
        >
          <SessionList sessions={security?.sessions ?? []} onEnd={(id) => void endSessions(id)} />
        </Modal>
      )}

      {exportResult && (
        <Modal
          open
          onClose={() => setExportResult(null)}
          title="Export complete"
          width={460}
          footer={
            <button className="btn btn-primary" onClick={() => setExportResult(null)}>
              Done
            </button>
          }
        >
          <p className="st-muted">Your data was saved to:</p>
          <p className="st-path">{exportResult}</p>
          <p className="st-muted">Keep it somewhere safe — it contains your personal information.</p>
        </Modal>
      )}

      {dialog === "sessions" && (
        <Modal
          open
          onClose={() => setDialog(null)}
          title="Active Sessions"
          width={520}
          footer={
            <>
              {otherActive > 0 && (
                <button className="btn btn-secondary" onClick={() => void endSessions()}>
                  Sign out all other devices
                </button>
              )}
              <button className="btn btn-primary" onClick={() => setDialog(null)}>
                Close
              </button>
            </>
          }
        >
          <SessionList sessions={security?.sessions ?? []} showEnded={false} onEnd={(id) => void endSessions(id)} />
        </Modal>
      )}

      {dialog === "privacy" && (
        <Modal
          open
          onClose={() => setDialog(null)}
          title="Privacy Preferences"
          width={460}
          footer={
            <button className="btn btn-primary" onClick={() => setDialog(null)}>
              Done
            </button>
          }
        >
          <div className="st-block">
            <SettingRow title="Show profile picture" text="Display your photo in the sidebar and top bar.">
              <Toggle
                label="Show profile picture"
                checked={get("privacy_show_avatar") !== "0"}
                onChange={(v) => set({ privacy_show_avatar: v ? "1" : "0" })}
              />
            </SettingRow>
            <SettingRow title="Personalized study tips" text="Use your activity to suggest study tips.">
              <Toggle
                label="Personalized study tips"
                checked={get("study_tips") !== "0"}
                onChange={(v) => set({ study_tips: v ? "1" : "0" })}
              />
            </SettingRow>
          </div>
        </Modal>
      )}

      {dialog === "delete" && (
        <Modal
          open
          onClose={() => {
            setDialog(null);
            setConfirmText("");
          }}
          title="Delete account?"
          width={460}
          footer={
            <>
              <button
                className="btn btn-secondary"
                data-modal-cancel
                onClick={() => {
                  setDialog(null);
                  setConfirmText("");
                }}
              >
                Cancel
              </button>
              <button className="btn btn-danger" disabled={confirmText !== "DELETE" || deleting} onClick={deleteEverything}>
                {deleting ? "Deleting…" : "Delete everything"}
              </button>
            </>
          }
        >
          <p className="st-muted">
            This permanently deletes your profile, duties, tasks, requirements, notes, quizzes, uploaded files, and
            settings. It can't be undone — consider exporting your data first.
          </p>
          <label className="st-confirm">
            Type <strong>DELETE</strong> to confirm
            <input value={confirmText} onChange={(e) => setConfirmText(e.target.value)} autoFocus />
          </label>
        </Modal>
      )}
    </div>
  );
}
