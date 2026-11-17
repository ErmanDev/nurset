const DAY_MS = 24 * 60 * 60 * 1000;

/** Parse "YYYY-MM-DD" as a local date (not UTC). */
export function parseDate(iso: string): Date {
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
  return new Date(y, m - 1, d);
}

/** Parse "YYYY-MM-DD HH:MM:SS" as a local timestamp. */
export function parseDateTime(value: string): Date {
  const date = parseDate(value);
  const [h = 0, min = 0] = value.slice(11).split(":").map(Number);
  date.setHours(h, min);
  return date;
}

function startOfToday(): Date {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

/** Whole days from today until `iso` (negative when in the past). */
export function daysUntil(iso: string): number {
  return Math.round((parseDate(iso).getTime() - startOfToday().getTime()) / DAY_MS);
}

export function greeting(now = new Date()): string {
  const h = now.getHours();
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
}

/** "MONDAY, OCTOBER 19" style header date. */
export function formatHeaderDate(date = new Date()): string {
  return date.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });
}

/** "October 20, 2026" */
export function formatLongDate(iso: string): string {
  return parseDate(iso).toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

/** "07:00" -> "7:00 AM" */
export function formatTime(hhmm: string): string {
  const [h, m] = hhmm.split(":").map(Number);
  const suffix = h >= 12 ? "PM" : "AM";
  return `${h % 12 || 12}:${String(m).padStart(2, "0")} ${suffix}`;
}

/** "9:00 AM" from a timestamp, prefixed with "today"/"yesterday" when relevant. */
export function formatAddedAt(timestamp: string): string {
  const date = parseDateTime(timestamp);
  const time = date.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  const diff = daysUntil(timestamp);
  if (diff === 0) return `today at ${time}`;
  if (diff === -1) return `yesterday at ${time}`;
  return `${date.toLocaleDateString("en-US", { month: "short", day: "numeric" })} at ${time}`;
}

/** Badge text for an upcoming date: "Today", "Tomorrow", "In 3 days". */
export function relativeDay(iso: string): string {
  const diff = daysUntil(iso);
  if (diff === 0) return "Today";
  if (diff === 1) return "Tomorrow";
  if (diff > 1) return `In ${diff} days`;
  return diff === -1 ? "Yesterday" : `${-diff} days ago`;
}

/** Deadline hint: "Due today", "Due tomorrow", "2 days left", "Overdue". */
export function deadlineLabel(iso: string): string {
  const diff = daysUntil(iso);
  if (diff < 0) return "Overdue";
  if (diff === 0) return "Due today";
  if (diff === 1) return "Due tomorrow";
  return `${diff} days left`;
}

/** 20 -> "20 minutes", 60 -> "1 hour", 90 -> "1 hr 30 min" */
export function formatDuration(minutes: number | null): string | null {
  if (minutes == null) return null;
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? "" : "s"}`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (m === 0) return `${h} hour${h === 1 ? "" : "s"}`;
  return `${h} hr ${m} min`;
}

export function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]!.toUpperCase())
    .join("");
}

/** Local date -> "YYYY-MM-DD" */
export function toIso(d: Date): string {
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${mm}-${dd}`;
}

export function todayIso(): string {
  return toIso(startOfToday());
}

/** "2026-10-23" -> "OCT" */
export function shortMonth(iso: string): string {
  return parseDate(iso).toLocaleDateString("en-US", { month: "short" }).toUpperCase();
}

/** "7:00 AM - 3:00 PM", or just the start when there's no end. */
export function formatTimeRange(start: string | null, end: string | null): string {
  if (!start) return "";
  return end ? `${formatTime(start)} - ${formatTime(end)}` : formatTime(start);
}

/**
 * Validation for date pickers that only allow today or later. An existing
 * record may keep the (past) date it already has.
 */
export function pastDateError(iso: string, original?: string | null): string | undefined {
  if (iso && iso < todayIso() && iso !== original) return "Pick today or a later date.";
  return undefined;
}
