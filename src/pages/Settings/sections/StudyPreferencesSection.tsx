import Toggle from "../../../components/Toggle/Toggle";
import { usePreferences } from "../../../lib/preferences";
import { SectionHeader, Segmented, SettingRow } from "./shared";

export default function StudyPreferencesSection() {
  const { get, set } = usePreferences();
  const goal = Number(get("study_daily_goal")) || 3;

  return (
    <div className="st-section">
      <SectionHeader title="Study Preferences" subtitle="Tune how NurSet supports your daily studying." />
      <div className="st-block">
        <SettingRow title="Daily study goal" text="Study sessions per day for “Today's Study Goal” in the Learning Hub.">
          <div className="st-stepper">
            <button onClick={() => set({ study_daily_goal: String(Math.max(1, goal - 1)) })} aria-label="Fewer sessions">
              −
            </button>
            <span aria-live="polite">{goal}</span>
            <button onClick={() => set({ study_daily_goal: String(Math.min(10, goal + 1)) })} aria-label="More sessions">
              +
            </button>
          </div>
        </SettingRow>
        <SettingRow title="Default quiz length" text="Pre-selected number of questions in Quizlab.">
          <Segmented
            label="Default quiz length"
            value={get("quiz_default_count")}
            onChange={(v) => set({ quiz_default_count: v })}
            options={["15", "20", "30", "50"].map((n) => ({ value: n, label: n }))}
          />
        </SettingRow>
        <SettingRow title="Study tips" text="Show a quick study tip in the Learning Hub.">
          <Toggle
            label="Study tips"
            checked={get("study_tips") !== "0"}
            onChange={(v) => set({ study_tips: v ? "1" : "0" })}
          />
        </SettingRow>
      </div>
    </div>
  );
}
