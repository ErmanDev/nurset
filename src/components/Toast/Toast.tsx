import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { CheckCircle2, CircleAlert, PencilLine, Trash2, X, type LucideIcon } from "lucide-react";
import "./Toast.css";

/**
 * App-wide notifications for things the user created, changed, or removed.
 *
 *   toast.created("Task added", "“Bring drug study” is on your list.");
 *   toast.updated("Changes saved");
 *   toast.deleted("Task deleted");
 *   toast.error("Couldn't save", String(err));
 *
 * Render <Toaster /> once (App.tsx).
 */

type Kind = "created" | "updated" | "deleted" | "error";

interface ToastItem {
  id: number;
  kind: Kind;
  title: string;
  message?: string;
  /** ms before it closes by itself */
  duration: number;
}

const DEFAULT_MS: Record<Kind, number> = { created: 3500, updated: 3000, deleted: 3500, error: 6000 };
const MAX_VISIBLE = 4;

let items: ToastItem[] = [];
let nextId = 1;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

function push(kind: Kind, title: string, message?: string, duration = DEFAULT_MS[kind]) {
  const item = { id: nextId++, kind, title, message, duration };
  items = [...items, item].slice(-MAX_VISIBLE);
  emit();
  // Something was created/changed/removed: let the notification bell refresh.
  window.dispatchEvent(new Event("nurset:data-changed"));
  return item.id;
}

function dismiss(id: number) {
  items = items.filter((t) => t.id !== id);
  emit();
}

export const toast = {
  created: (title: string, message?: string) => push("created", title, message),
  updated: (title: string, message?: string) => push("updated", title, message),
  deleted: (title: string, message?: string) => push("deleted", title, message),
  error: (title: string, message?: string) => push("error", title, message),
  dismiss,
};

const ICONS: Record<Kind, LucideIcon> = {
  created: CheckCircle2,
  updated: PencilLine,
  deleted: Trash2,
  error: CircleAlert,
};

const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};

export function Toaster() {
  const list = useSyncExternalStore(subscribe, () => items);
  return (
    <div className="toaster" role="region" aria-label="Notifications">
      {list.map((t) => (
        <ToastCard key={t.id} item={t} />
      ))}
    </div>
  );
}

function ToastCard({ item }: { item: ToastItem }) {
  const [leaving, setLeaving] = useState(false);
  const [paused, setPaused] = useState(false);
  const remaining = useRef(item.duration);
  const startedAt = useRef(0);
  const Icon = ICONS[item.kind];

  // Count down while not hovered; hovering pauses (the progress bar too).
  useEffect(() => {
    if (paused || leaving) return;
    startedAt.current = Date.now();
    const timer = window.setTimeout(() => setLeaving(true), remaining.current);
    return () => {
      window.clearTimeout(timer);
      remaining.current -= Date.now() - startedAt.current;
    };
  }, [paused, leaving]);

  // Let the exit animation play, then remove.
  useEffect(() => {
    if (!leaving) return;
    const timer = window.setTimeout(() => dismiss(item.id), 180);
    return () => window.clearTimeout(timer);
  }, [leaving, item.id]);

  return (
    <div
      className={`toast toast--${item.kind}${leaving ? " is-leaving" : ""}${paused ? " is-paused" : ""}`}
      role={item.kind === "error" ? "alert" : "status"}
      aria-live={item.kind === "error" ? "assertive" : "polite"}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      <span className="toast-icon">
        <Icon size={18} />
      </span>
      <div className="toast-text">
        <strong>{item.title}</strong>
        {item.message && <span>{item.message}</span>}
      </div>
      <button type="button" className="toast-close" onClick={() => setLeaving(true)} aria-label="Dismiss notification">
        <X size={15} />
      </button>
      <span className="toast-progress" style={{ animationDuration: `${item.duration}ms` }} aria-hidden="true" />
    </div>
  );
}
