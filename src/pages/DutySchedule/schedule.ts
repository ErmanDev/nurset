import { todayIso } from "../../lib/format";
import type { Duty, ScheduleEvent } from "../../lib/types";

/** A duty counts as completed once its date has passed. */
export function isCompleted(duty: Duty, today = todayIso()): boolean {
  return duty.dutyDate < today;
}

/** Shift length in hours; handles overnight shifts (end before start). */
export function dutyHours(duty: Duty): number {
  const toMinutes = (t: string) => {
    const [h, m] = t.split(":").map(Number);
    return h * 60 + m;
  };
  let minutes = toMinutes(duty.endTime) - toMinutes(duty.startTime);
  if (minutes <= 0) minutes += 24 * 60;
  return minutes / 60;
}

export function formatHours(hours: number): string {
  return `${Number.isInteger(hours) ? hours : hours.toFixed(1)} hrs`;
}

export type CalendarKind = "upcoming" | "completed" | "exam" | "other";

export interface CalendarItem {
  key: string;
  date: string;
  label: string;
  kind: CalendarKind;
}

export const calendarLegend: { kind: CalendarKind; label: string }[] = [
  { kind: "upcoming", label: "Upcoming Duty" },
  { kind: "completed", label: "Completed Duty" },
  { kind: "exam", label: "Exam" },
  { kind: "other", label: "Other Event" },
];

export function toCalendarItems(duties: Duty[], events: ScheduleEvent[]): CalendarItem[] {
  const today = todayIso();
  return [
    ...duties.map((d) => ({
      key: `duty-${d.id}`,
      date: d.dutyDate,
      label: d.area,
      kind: (isCompleted(d, today) ? "completed" : "upcoming") as CalendarKind,
    })),
    ...events.map((e) => ({
      key: `event-${e.id}`,
      date: e.eventDate,
      label: e.title,
      kind: e.eventType as CalendarKind,
    })),
  ];
}

/** Unified card model for "My Events": upcoming duties and events together. */
export interface AgendaItem {
  key: string;
  title: string;
  badge: { label: string; tone: "blue" | "purple" | "amber" };
  date: string;
  startTime: string | null;
  endTime: string | null;
  place: string | null;
  description: string | null;
}

export function upcomingAgenda(duties: Duty[], events: ScheduleEvent[]): AgendaItem[] {
  const today = todayIso();
  const items: AgendaItem[] = [
    ...duties
      .filter((d) => d.dutyDate >= today)
      .map((d) => ({
        key: `duty-${d.id}`,
        title: `${d.area} Duty`,
        badge: { label: "Clinical Duty", tone: "blue" as const },
        date: d.dutyDate,
        startTime: d.startTime,
        endTime: d.endTime,
        place: d.hospital,
        description: d.notes,
      })),
    ...events
      .filter((e) => e.eventDate >= today)
      .map((e) => ({
        key: `event-${e.id}`,
        title: e.title,
        badge:
          e.eventType === "exam"
            ? { label: "Exam", tone: "purple" as const }
            : { label: "Event", tone: "amber" as const },
        date: e.eventDate,
        startTime: e.startTime,
        endTime: e.endTime,
        place: e.location,
        description: e.description,
      })),
  ];
  return items.sort(
    (a, b) => a.date.localeCompare(b.date) || (a.startTime ?? "").localeCompare(b.startTime ?? ""),
  );
}
