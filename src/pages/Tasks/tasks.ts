import { daysUntil, formatTime, parseDate, parseDateTime } from "../../lib/format";
import type { Task, TaskPriority } from "../../lib/types";

export const TASK_CATEGORIES = ["Requirement", "Study", "Clinical", "Academic", "Personal"];

const categoryTones: Record<string, string> = {
  requirement: "purple",
  study: "green",
  clinical: "blue",
  academic: "teal",
  personal: "amber",
};

/** Colors cycled through for categories the user typed themselves. */
const CUSTOM_TONES = ["blue", "green", "purple", "teal", "amber", "rose"];

/** Chip color for a category; case-insensitive, and custom names always get the same color. */
export function categoryTone(category: string): string {
  const key = category.trim().toLowerCase();
  if (categoryTones[key]) return categoryTones[key];
  let hash = 0;
  for (const ch of key) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  return CUSTOM_TONES[hash % CUSTOM_TONES.length];
}

/** Use the preset spelling when the typed category matches one ("clinical" -> "Clinical"). */
export function normalizeCategory(value: string): string {
  const trimmed = value.trim();
  return TASK_CATEGORIES.find((c) => c.toLowerCase() === trimmed.toLowerCase()) ?? trimmed;
}

export const priorityInfo: Record<TaskPriority, { label: string; tone: string }> = {
  high: { label: "High", tone: "red" },
  medium: { label: "Medium", tone: "amber" },
  low: { label: "Low", tone: "blue" },
};

export type TaskTab = "all" | "today" | "upcoming" | "completed";

export interface TaskBuckets {
  overdue: Task[];
  today: Task[];
  upcoming: Task[];
  completed: Task[];
}

const byDue = (a: Task, b: Task) =>
  a.dueDate.localeCompare(b.dueDate) ||
  (a.dueTime ?? "99:99").localeCompare(b.dueTime ?? "99:99") ||
  a.id - b.id;

/** Split tasks into the page sections. Open tasks go by due date; done tasks by completion time. */
export function bucketTasks(tasks: Task[], today: string): TaskBuckets {
  const buckets: TaskBuckets = { overdue: [], today: [], upcoming: [], completed: [] };
  for (const t of tasks) {
    if (t.completed) buckets.completed.push(t);
    else if (t.dueDate < today) buckets.overdue.push(t);
    else if (t.dueDate === today) buckets.today.push(t);
    else buckets.upcoming.push(t);
  }
  buckets.overdue.sort(byDue);
  buckets.today.sort(byDue);
  buckets.upcoming.sort(byDue);
  buckets.completed.sort((a, b) => (b.completedAt ?? "").localeCompare(a.completedAt ?? ""));
  return buckets;
}

/** Consecutive runs of tasks sharing a due date, for the "Upcoming" grouping. */
export function groupByDate(tasks: Task[]): { date: string; label: string; tasks: Task[] }[] {
  const groups: { date: string; label: string; tasks: Task[] }[] = [];
  for (const t of tasks) {
    const last = groups[groups.length - 1];
    if (last?.date === t.dueDate) last.tasks.push(t);
    else groups.push({ date: t.dueDate, label: dayHeading(t.dueDate), tasks: [t] });
  }
  return groups;
}

/** "TOMORROW" or "NOVEMBER 20" */
export function dayHeading(iso: string): string {
  if (daysUntil(iso) === 1) return "TOMORROW";
  return parseDate(iso).toLocaleDateString("en-US", { month: "long", day: "numeric" }).toUpperCase();
}

/** "Nov 18" */
export function shortDate(iso: string): string {
  return parseDate(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

/** "Due Today, 8:00 PM" · "Due Yesterday" · "Due Nov 14, 9:00 AM" */
export function dueLabel(task: Task): string {
  const diff = daysUntil(task.dueDate);
  const day =
    diff === 0 ? "Today" : diff === 1 ? "Tomorrow" : diff === -1 ? "Yesterday" : shortDate(task.dueDate);
  return task.dueTime ? `Due ${day}, ${formatTime(task.dueTime)}` : `Due ${day}`;
}

/** "Completed Today, 10:15 AM" */
export function completedLabel(task: Task): string {
  if (!task.completedAt) return "Completed";
  const when = parseDateTime(task.completedAt);
  const time = when.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });
  const diff = daysUntil(task.completedAt);
  const day = diff === 0 ? "Today" : diff === -1 ? "Yesterday" : shortDate(task.completedAt);
  return `Completed ${day}, ${time}`;
}
