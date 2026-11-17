import { daysUntil, formatLongDate, parseDate } from "../../lib/format";
import type { CiNote } from "../../lib/types";

export const CLINICAL_AREAS = [
  "Medical Ward",
  "Emergency Room (ER)",
  "Operating Room (OR)",
  "Community",
  "Other",
];

export type NoteTab = "all" | "important" | "pinned";
export type DateFilter = "any" | "today" | "week" | "month";

export const dateFilters: { value: DateFilter; label: string }[] = [
  { value: "any", label: "Any date" },
  { value: "today", label: "Today" },
  { value: "week", label: "This week" },
  { value: "month", label: "This month" },
];

/** Monday-based week containing today. */
export function isThisWeek(iso: string | null): boolean {
  if (!iso) return false;
  const today = new Date();
  const monday = new Date(today.getFullYear(), today.getMonth(), today.getDate() - ((today.getDay() + 6) % 7));
  const date = parseDate(iso);
  const sunday = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + 6);
  return date >= monday && date <= sunday;
}

export function matchesDate(note: CiNote, filter: DateFilter): boolean {
  if (filter === "any") return true;
  if (!note.noteDate) return false;
  if (filter === "today") return daysUntil(note.noteDate) === 0;
  if (filter === "week") return isThisWeek(note.noteDate);
  const d = parseDate(note.noteDate);
  const now = new Date();
  return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
}

export function matchesSearch(note: CiNote, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return [note.title, note.content, note.clinicalInstructor, note.clinicalArea, note.dutyArea]
    .some((field) => field?.toLowerCase().includes(q));
}

/** "Medical Ward · October 31, 2026" */
export function dutyLabel(area: string | null, date: string | null): string {
  if (!area) return "—";
  return date ? `${area} · ${formatLongDate(date)}` : area;
}

export function noteDateLabel(note: CiNote): string {
  return note.noteDate ? formatLongDate(note.noteDate) : formatLongDate(note.createdAt);
}

/** Quote marks around the instruction, like the design. */
export function quoted(text: string): string {
  return `“${text.replace(/^["“]|["”]$/g, "")}”`;
}
