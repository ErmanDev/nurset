import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { api } from "./api";

/** Accent colors (Settings › Appearance). `blue` is the original NurSet color. */
export const ACCENTS = {
  blue: { label: "Blue", primary: "#4a86d4", strong: "#3a72c0", soft: "#e9f1fc", light: "#78a9e6" },
  violet: { label: "Violet", primary: "#6a4fd6", strong: "#5a3fc6", soft: "#eeeafc", light: "#8f7be6" },
  lavender: { label: "Lavender", primary: "#8577dc", strong: "#6e5fcb", soft: "#f0eefc", light: "#a99ff0" },
  green: { label: "Green", primary: "#3f8f5a", strong: "#317548", soft: "#e5f3ea", light: "#6fb489" },
  pink: { label: "Pink", primary: "#cf5aa9", strong: "#b4448f", soft: "#fbe8f5", light: "#e48ccb" },
  coral: { label: "Coral", primary: "#dd6159", strong: "#c24b44", soft: "#fdeceb", light: "#ef8f88" },
} as const;
export type AccentName = keyof typeof ACCENTS;

const ZOOM = { small: 0.9, medium: 1, large: 1.1 } as const;

/** Defaults for every preference key the UI reads. */
export const DEFAULTS: Record<string, string> = {
  theme: "light",
  accent: "blue",
  font_size: "medium",
  density: "comfortable",
  study_daily_goal: "3",
  quiz_default_count: "15",
  study_tips: "1",
  notif_frequency: "instant",
  quiet_from: "22:00",
  quiet_to: "06:00",
  reminder_time: "19:00",
};

interface PreferencesValue {
  prefs: Record<string, string>;
  loaded: boolean;
  get: (key: string) => string;
  /** Saves one or more settings (optimistic). */
  set: (values: Record<string, string>) => Promise<void>;
  reload: () => Promise<void>;
}

const Ctx = createContext<PreferencesValue | null>(null);

function applyAppearance(p: Record<string, string>) {
  const root = document.documentElement;

  const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
  const dark = p.theme === "dark" || (p.theme === "system" && prefersDark);
  root.dataset.theme = dark ? "dark" : "light";
  root.dataset.density = p.density === "compact" ? "compact" : "comfortable";

  const accent = ACCENTS[(p.accent as AccentName) ?? "blue"] ?? ACCENTS.blue;
  root.style.setProperty("--primary", accent.primary);
  root.style.setProperty("--primary-strong", accent.strong);
  root.style.setProperty("--primary-soft", accent.soft);
  root.style.setProperty("--blue", accent.primary);
  root.style.setProperty(
    "--gradient-primary",
    `linear-gradient(135deg, ${accent.light} 0%, ${accent.primary} 55%, ${accent.strong} 100%)`,
  );

  // Text size = webview zoom, so layout and pop-up positions stay consistent.
  const zoom = ZOOM[(p.font_size as keyof typeof ZOOM) ?? "medium"] ?? 1;
  import("@tauri-apps/api/webview")
    .then(({ getCurrentWebview }) => getCurrentWebview().setZoom(zoom))
    .catch(() => {
      /* not running inside Tauri (e.g. plain browser) */
    });
}

export function PreferencesProvider({ children }: { children: ReactNode }) {
  const [prefs, setPrefs] = useState<Record<string, string>>(DEFAULTS);
  const [loaded, setLoaded] = useState(false);

  const reload = useCallback(async () => {
    try {
      const stored = await api.getSettings();
      setPrefs({ ...DEFAULTS, ...stored });
    } catch {
      setPrefs(DEFAULTS);
    } finally {
      setLoaded(true);
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  useEffect(() => {
    applyAppearance(prefs);
    if (prefs.theme !== "system") return;
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => applyAppearance(prefs);
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, [prefs]);

  const set = useCallback(async (values: Record<string, string>) => {
    setPrefs((p) => ({ ...p, ...values }));
    await api.setSettings(values);
  }, []);

  const get = useCallback((key: string) => prefs[key] ?? DEFAULTS[key] ?? "", [prefs]);

  return <Ctx.Provider value={{ prefs, loaded, get, set, reload }}>{children}</Ctx.Provider>;
}

export function usePreferences(): PreferencesValue {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("usePreferences must be used inside <PreferencesProvider>");
  return ctx;
}

/** Tell the app shell (sidebar, top bar) that the profile changed. */
export function notifyProfileChanged() {
  window.dispatchEvent(new Event("nurset:profile-changed"));
}
