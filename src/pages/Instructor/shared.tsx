import { daysUntil, initials, parseDate } from "../../lib/format";

export const GROUP_COLORS = ["blue", "green", "purple", "amber", "pink", "teal"] as const;

/** "Today", "Tomorrow", "Nov 20" */
export function shortDay(iso: string): string {
  const d = daysUntil(iso);
  if (d === 0) return "Today";
  if (d === 1) return "Tomorrow";
  return parseDate(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

/** Small initials/photo circle for a student. */
export function StudentAvatar({ name, photo, size = 34 }: { name: string; photo?: string | null; size?: number }) {
  const style = { width: size, height: size, fontSize: Math.round(size * 0.36) };
  return photo ? (
    <img src={photo} alt="" className="avatar" style={{ ...style, objectFit: "cover" }} />
  ) : (
    <span className="avatar" style={style} aria-hidden="true">
      {initials(name)}
    </span>
  );
}

/** Four dots for the "Before you go" checks. */
export function ReadinessDots({ done }: { done: number }) {
  return (
    <span className={`ci-dots ci-dots--${done >= 4 ? "ready" : done >= 2 ? "almost" : "low"}`} aria-label={`${done} of 4 checks done`}>
      {[0, 1, 2, 3].map((i) => (
        <i key={i} className={i < done ? "is-on" : ""} />
      ))}
      <span>{done}/4</span>
    </span>
  );
}
