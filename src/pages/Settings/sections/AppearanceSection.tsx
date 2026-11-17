import { Check, Monitor, Moon, Sun, type LucideIcon } from "lucide-react";
import { ACCENTS, usePreferences, type AccentName } from "../../../lib/preferences";
import { SectionHeader, Segmented } from "./shared";

const themes: { value: string; label: string; icon: LucideIcon }[] = [
  { value: "light", label: "Light Mode", icon: Sun },
  { value: "dark", label: "Dark Mode", icon: Moon },
  { value: "system", label: "System Default", icon: Monitor },
];

export default function AppearanceSection() {
  const { get, set } = usePreferences();
  const theme = get("theme");
  const accent = get("accent") as AccentName;

  return (
    <div className="st-section">
      <SectionHeader title="Appearance" subtitle="Personalize how NurSet looks and feels across your workspace." />

      <div className="st-block">
        <h3>Theme</h3>
        <p className="st-muted">Choose a theme for your NurSet workspace.</p>
        <div className="st-themes">
          {themes.map(({ value, label, icon: Icon }) => (
            <button
              key={value}
              className={`st-theme${theme === value ? " is-active" : ""}`}
              onClick={() => set({ theme: value })}
              aria-pressed={theme === value}
            >
              <span className={`st-theme-art st-theme-art--${value}`} aria-hidden="true">
                <i />
                <i />
                <i />
              </span>
              <span className="st-theme-label">
                <Icon size={14} /> {label}
                {theme === value && <Check size={14} className="st-theme-check" />}
              </span>
            </button>
          ))}
        </div>
      </div>

      <div className="st-appearance-grid">
        <div className="st-block">
          <h3>Accent Color</h3>
          <p className="st-muted">Used for buttons, highlights, and selected items.</p>
          <div className="st-swatches" role="radiogroup" aria-label="Accent color">
            {(Object.keys(ACCENTS) as AccentName[]).map((name) => (
              <button
                key={name}
                role="radio"
                aria-checked={accent === name}
                aria-label={ACCENTS[name].label}
                title={ACCENTS[name].label}
                className={`st-swatch${accent === name ? " is-active" : ""}`}
                style={{ background: ACCENTS[name].primary }}
                onClick={() => set({ accent: name })}
              >
                {accent === name && <Check size={14} strokeWidth={3} />}
              </button>
            ))}
          </div>

          <h3 className="st-block-gap">Font Size</h3>
          <Segmented
            label="Font size"
            value={get("font_size")}
            onChange={(v) => set({ font_size: v })}
            options={[
              { value: "small", label: "Small" },
              { value: "medium", label: "Medium" },
              { value: "large", label: "Large" },
            ]}
          />

          <h3 className="st-block-gap">Layout Density</h3>
          <Segmented
            label="Layout density"
            value={get("density")}
            onChange={(v) => set({ density: v })}
            options={[
              { value: "comfortable", label: "Comfortable" },
              { value: "compact", label: "Compact" },
            ]}
          />
        </div>

        <div className="st-preview" aria-label="Live preview">
          <div className="st-preview-head">
            <strong>Live Preview</strong>
            <span>NurSet Dashboard</span>
          </div>
          <div className="st-preview-body">
            <div className="st-preview-side">
              <span className="st-preview-logo">N</span>
              <i />
              <i />
              <i />
            </div>
            <div className="st-preview-main">
              <p>Good morning!</p>
              <div className="st-preview-card">
                <small>Next clinical duty</small>
                <strong>Medical Ward</strong>
              </div>
              <div className="st-preview-row">
                <i />
                <i />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
