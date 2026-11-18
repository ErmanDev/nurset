import Toggle from "../../../components/Toggle/Toggle";
import { usePreferences } from "../../../lib/preferences";
import { SectionHeader, Segmented, SettingRow } from "./shared";

const toggles: { key: string; label: string; text?: string; defaultOn: boolean }[] = [
  { key: "notif_assigned", label: "Assigned reminders", defaultOn: true },
  { key: "notif_deadlines", label: "Upcoming deadlines", defaultOn: true },
  { key: "notif_tasks", label: "Task updates", defaultOn: true },
  { key: "notif_announcements", label: "New announcements", defaultOn: true },
  { key: "notif_learning_hub", label: "Learning Hub updates", defaultOn: true },
  { key: "notif_study", label: "Study reminders", defaultOn: true },
  { key: "notif_ai", label: "AI study recommendations", defaultOn: true },
  { key: "notif_premium", label: "Premium updates", defaultOn: false },
  { key: "notif_email", label: "Email notifications", text: "Receive a summary in your inbox", defaultOn: true },
  { key: "notif_in_app", label: "In-app notifications", defaultOn: true },
];

export default function NotificationsSection() {
  const { get, set } = usePreferences();
  const isOn = (key: string, defaultOn: boolean) => {
    const v = get(key);
    return v === "" ? defaultOn : v === "1";
  };

  return (
    <div className="st-section">
      <SectionHeader title="Notifications" subtitle="Choose which reminders and updates NurSet sends you." />

      <div className="st-notif-grid">
        <div className="st-block">
          <h3>Notification preferences</h3>
          {toggles.map((t) => (
            <div key={t.key} className="st-row st-row--tight">
              <div>
                <strong>{t.label}</strong>
                {t.text && <span>{t.text}</span>}
              </div>
              <Toggle
                label={t.label}
                checked={isOn(t.key, t.defaultOn)}
                onChange={(v) => set({ [t.key]: v ? "1" : "0" })}
              />
            </div>
          ))}
        </div>

        <aside className="st-notif-preview" aria-label="Preview">
          <p className="st-preview-eyebrow">Preview</p>
          <div className="st-notif-card">
            <span className="st-notif-icon">N</span>
            <div>
              <strong>Clinical duty tomorrow</strong>
              <span>Medical Ward · 7:00 AM</span>
              <span>Remember to bring your duty bag.</span>
              <small>NurSet · now</small>
            </div>
          </div>
          <p className="st-muted">Notifications adapt to your quiet hours and preferred schedule.</p>
        </aside>
      </div>

      <div className="st-block st-schedule">
        <h3>Schedule</h3>
        <SettingRow title="Notification frequency" text="Get each reminder right away, or bundle them into a summary.">
          <Segmented
            label="Notification frequency"
            value={get("notif_frequency")}
            onChange={(v) => set({ notif_frequency: v })}
            options={[
              { value: "instant", label: "Instant" },
              { value: "daily", label: "Daily summary" },
              { value: "weekly", label: "Weekly" },
            ]}
          />
        </SettingRow>
        <SettingRow title="Quiet hours" text="No reminders during this time.">
          <div className="st-time-range">
            <input
              type="time"
              className="st-time"
              value={get("quiet_from")}
              onChange={(e) => set({ quiet_from: e.target.value })}
              aria-label="Quiet hours start"
            />
            <span>to</span>
            <input
              type="time"
              className="st-time"
              value={get("quiet_to")}
              onChange={(e) => set({ quiet_to: e.target.value })}
              aria-label="Quiet hours end"
            />
          </div>
        </SettingRow>
        <SettingRow title="Preferred reminder time" text="When daily and weekly summaries arrive.">
          <input
            type="time"
            className="st-time"
            value={get("reminder_time")}
            onChange={(e) => set({ reminder_time: e.target.value })}
            aria-label="Preferred reminder time"
          />
        </SettingRow>
      </div>

      <p className="st-note">
        Your choices are saved. Desktop and email notifications aren't sent yet; these settings will apply once they are.
      </p>
    </div>
  );
}
