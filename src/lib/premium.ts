import { usePreferences } from "./preferences";

/** What a Premium subscription unlocks (shown on the upgrade screens). */
export const PREMIUM_FEATURES = [
  "AI Study: assistant chat and Quizlab practice quizzes",
  "Learning Hub: upload, organize, and share study materials",
  "Nursing Student Handbook in Quick Links",
  "Dark mode and accent colors",
  "Study reminders and Learning Hub notifications",
];

/**
 * True when the signed-in account has Premium. The backend enforces it too;
 * this only decides what the UI shows. `loaded` is false until settings load.
 */
export function usePremium(): { premium: boolean; loaded: boolean } {
  const { get, loaded } = usePreferences();
  // Set by the backend for subscribers and clinical instructors.
  return { premium: get("premium_access") === "1", loaded };
}
