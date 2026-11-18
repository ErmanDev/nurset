import { Bell, CalendarDays, ChevronRight, Megaphone } from "lucide-react";
import { Link } from "react-router";
import { api } from "../../lib/api";
import { formatLongDate } from "../../lib/format";
import { useAsync } from "../../hooks/useAsync";
import type { Announcement } from "../../lib/types";
import { QlHeader } from "./shared";
import "./QuickLinks.css";

const categoryStyle: Record<Announcement["category"], { label: string; tone: string; icon: typeof Bell }> = {
  important: { label: "Important", tone: "purple", icon: Megaphone },
  academic: { label: "Academic", tone: "purple", icon: Megaphone },
  reminder: { label: "Reminder", tone: "amber", icon: Bell },
};

export default function Announcements() {
  const { data, error } = useAsync(api.listAnnouncements);

  return (
    <div className="ql">
      <QlHeader
        title="Announcements"
        subtitle="Stay updated with important announcements from your clinical instructors and nursing department"
        back={null}
      />

      <div className="ql-two-col">
        <div className="ql-col">
          {error && <div className="alert-error">{error}</div>}
          {!data && !error && <div className="skeleton" style={{ height: 260 }} />}
          {data && data.length === 0 && (
            <div className="card ql-empty">
              <p className="empty-text">No announcements yet.</p>
            </div>
          )}
          {data?.map((a) => {
            const s = categoryStyle[a.category];
            const Icon = s.icon;
            return (
              <article key={a.id} className="card an-card">
                <span className={`an-icon an-tone--${s.tone}`}>
                  <Icon size={18} />
                </span>
                <div>
                  <p className={`an-category an-tone-text--${s.tone}`}>{s.label}</p>
                  <h3>{a.title}</h3>
                  <p className="an-body">{a.body}</p>
                  <p className="an-date">Posted {formatLongDate(a.postedAt)}</p>
                </div>
              </article>
            );
          })}
        </div>

        <aside className="ql-col">
          <section className="card ql-side">
            <h3>Announcement Center</h3>
            <p className="ql-side-sub">Stay informed about your nursing program</p>
            <div className="an-tip">
              <span className="an-icon an-tone--purple">
                <Bell size={16} />
              </span>
              <div>
                <strong>Latest updates</strong>
                <span>Important news and academic reminders in one place.</span>
              </div>
            </div>
            <div className="an-tip">
              <span className="an-icon an-tone--amber">
                <CalendarDays size={16} />
              </span>
              <div>
                <strong>Check regularly</strong>
                <span>Review new posts before clinical duty and classes.</span>
              </div>
            </div>
          </section>
          <section className="card ql-side ql-side--tinted">
            <h3>Stay prepared</h3>
            <p className="ql-side-sub">
              Check announcements regularly so you don't miss schedule changes, laboratory orientations, or requirement
              deadlines.
            </p>
            <Link to="/requirements" className="an-next">
              Your next step: review your requirements <ChevronRight size={14} />
            </Link>
          </section>
        </aside>
      </div>
    </div>
  );
}
