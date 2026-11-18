import { useCallback, useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router";
import {
  Bell,
  BellOff,
  BookOpen,
  CalendarCheck,
  CheckCircle2,
  ClipboardCheck,
  ClipboardList,
  FileText,
  ListTodo,
  Megaphone,
  RotateCcw,
  Settings,
  Sparkles,
  Star,
  type LucideIcon,
} from "lucide-react";
import { api } from "../../lib/api";
import { parseDateTime } from "../../lib/format";
import type { AppNotification, NotificationFeed, NotificationKind } from "../../lib/types";
import "./NotificationBell.css";

const POLL_MS = 60_000;

const KIND: Record<NotificationKind, { icon: LucideIcon; tone: string }> = {
  duty: { icon: CalendarCheck, tone: "blue" },
  requirement: { icon: FileText, tone: "purple" },
  review_ok: { icon: CheckCircle2, tone: "green" },
  review_fix: { icon: RotateCcw, tone: "amber" },
  instruction: { icon: ClipboardList, tone: "teal" },
  task: { icon: ListTodo, tone: "amber" },
  announcement: { icon: Megaphone, tone: "red" },
  material: { icon: BookOpen, tone: "teal" },
  study: { icon: Sparkles, tone: "purple" },
  attendance: { icon: ClipboardCheck, tone: "blue" },
  evaluation: { icon: Star, tone: "amber" },
};

/** "Just now", "5m ago", "3h ago", "Today", "Yesterday", "Nov 12". */
function timeAgo(at: string): string {
  const date = parseDateTime(at);
  const now = new Date();
  const mins = Math.floor((now.getTime() - date.getTime()) / 60_000);
  const startOfDay = at.endsWith("00:00:00");
  const sameDay = date.toDateString() === now.toDateString();
  if (!startOfDay && mins < 1) return "Just now";
  if (!startOfDay && mins < 60) return `${mins}m ago`;
  if (sameDay) return startOfDay ? "Today" : `${Math.floor(mins / 60)}h ago`;
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (date.toDateString() === yesterday.toDateString()) return "Yesterday";
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

/** Top-bar bell: unread badge + dropdown of notifications built from the user's data. */
export default function NotificationBell() {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const [feed, setFeed] = useState<NotificationFeed | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<"all" | "unread">("all");
  const wrapRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    try {
      setFeed(await api.listNotifications());
      setError(null);
    } catch (err) {
      setError(String(err));
    }
  }, []);

  // Refresh on page changes, every minute, on window focus, and after edits.
  useEffect(() => {
    void load();
  }, [load, pathname]);
  useEffect(() => {
    const timer = window.setInterval(() => void load(), POLL_MS);
    const onFocus = () => void load();
    window.addEventListener("focus", onFocus);
    window.addEventListener("nurset:data-changed", onFocus);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("focus", onFocus);
      window.removeEventListener("nurset:data-changed", onFocus);
    };
  }, [load]);

  // Close on outside click / Escape.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  function markLocal(keys: string[] | null) {
    setFeed((f) => {
      if (!f) return f;
      const items = f.items.map((n) => (keys === null || keys.includes(n.key) ? { ...n, read: true } : n));
      return { ...f, items, unread: items.filter((n) => !n.read).length };
    });
  }

  async function openItem(n: AppNotification) {
    setOpen(false);
    if (!n.read) {
      markLocal([n.key]);
      api.markNotificationsRead([n.key]).catch(() => void load());
    }
    navigate(n.link);
  }

  async function markAll() {
    markLocal(null);
    try {
      await api.markNotificationsRead();
    } catch (err) {
      setError(String(err));
      void load();
    }
  }

  const unread = feed?.unread ?? 0;
  const items = (feed?.items ?? []).filter((n) => tab === "all" || !n.read);
  const isCi = pathname === "/ci" || pathname.startsWith("/ci/");

  return (
    <div className="nb" ref={wrapRef}>
      <button
        className={`icon-button nb-trigger${open ? " is-open" : ""}`}
        aria-label={unread ? `Notifications, ${unread} unread` : "Notifications"}
        aria-haspopup="dialog"
        aria-expanded={open}
        title="Notifications"
        onClick={() => {
          setOpen((o) => !o);
          if (!open) void load();
        }}
      >
        {feed && !feed.enabled ? <BellOff size={17} /> : <Bell size={17} />}
        {unread > 0 && <span className="nb-badge">{unread > 9 ? "9+" : unread}</span>}
      </button>

      {open && (
        <div className="nb-panel" role="dialog" aria-label="Notifications">
          <header className="nb-head">
            <div>
              <h2>Notifications</h2>
              <small>{unread ? `${unread} unread` : "You're all caught up"}</small>
            </div>
            {unread > 0 && (
              <button className="text-link nb-markall" onClick={() => void markAll()}>
                Mark all as read
              </button>
            )}
          </header>

          {feed?.enabled !== false && (
            <div className="nb-tabs" role="tablist">
              {(["all", "unread"] as const).map((t) => (
                <button key={t} role="tab" aria-selected={tab === t} className={tab === t ? "is-active" : ""} onClick={() => setTab(t)}>
                  {t === "all" ? "All" : `Unread${unread ? ` (${unread})` : ""}`}
                </button>
              ))}
            </div>
          )}

          <div className="nb-body">
            {error && <p className="nb-error">{error}</p>}
            {!feed && !error && <div className="skeleton" style={{ height: 120, margin: 12 }} />}
            {feed && !feed.enabled && (
              <div className="nb-empty">
                <BellOff size={26} />
                <strong>In-app notifications are off</strong>
                <span>Turn them on in Notification settings to see reminders here.</span>
              </div>
            )}
            {feed?.enabled && items.length === 0 && (
              <div className="nb-empty">
                <Bell size={26} />
                <strong>{tab === "unread" ? "No unread notifications" : "No notifications yet"}</strong>
                <span>
                  {isCi
                    ? "Submitted documents, attendance, and evaluations to do will show up here."
                    : "New duties, deadlines, reviews, and announcements will show up here."}
                </span>
              </div>
            )}
            {feed?.enabled && items.length > 0 && (
              <ul className="nb-list">
                {items.map((n) => {
                  const { icon: Icon, tone } = KIND[n.kind] ?? KIND.announcement;
                  return (
                    <li key={n.key}>
                      <button className={`nb-item${n.read ? "" : " is-unread"}`} onClick={() => void openItem(n)}>
                        <span className={`nb-icon nb-tone--${tone}`}>
                          <Icon size={16} />
                        </span>
                        <span className="nb-text">
                          <strong>{n.title}</strong>
                          <span>{n.body}</span>
                          <small>{timeAgo(n.at)}</small>
                        </span>
                        {!n.read && <span className="nb-dot" aria-label="Unread" />}
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          <footer className="nb-foot">
            <button
              className="nb-settings"
              onClick={() => {
                setOpen(false);
                navigate("/settings/notifications");
              }}
            >
              <Settings size={14} /> Notification settings
            </button>
          </footer>
        </div>
      )}
    </div>
  );
}
