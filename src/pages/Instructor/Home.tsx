import { useNavigate } from "react-router";
import {
  AlertTriangle,
  CalendarCheck,
  ChevronRight,
  Clock,
  FileText,
  FileWarning,
  Hospital,
  Users,
  type LucideIcon,
} from "lucide-react";
import { api } from "../../lib/api";
import { formatHeaderDate, formatTimeRange, greeting, parseDateTime } from "../../lib/format";
import { useAsync } from "../../hooks/useAsync";
import type { CiDashboard } from "../../lib/types";
import { StudentAvatar, shortDay } from "./shared";
import "./Instructor.css";

const flagStyle: Record<CiDashboard["attention"][number]["kind"], { tone: string; icon: LucideIcon }> = {
  revision: { tone: "red", icon: FileWarning },
  overdue: { tone: "amber", icon: AlertTriangle },
  not_ready: { tone: "blue", icon: CalendarCheck },
};

function submittedText(ts: string): string {
  const days = Math.floor((Date.now() - parseDateTime(ts).getTime()) / 86_400_000);
  if (days <= 0) return "Submitted today";
  if (days === 1) return "Submitted yesterday";
  return `Submitted ${days} days ago`;
}

export default function InstructorHome() {
  const navigate = useNavigate();
  const { data, error } = useAsync(api.getCiDashboard);

  const stats: { label: string; value: number; icon: LucideIcon; tone: string; to: string }[] = data
    ? [
        { label: "Students", value: data.stats.students, icon: Users, tone: "blue", to: "/ci/groups" },
        { label: "Groups", value: data.stats.groups, icon: Hospital, tone: "purple", to: "/ci/groups" },
        { label: "Pending reviews", value: data.stats.pendingReviews, icon: FileText, tone: "amber", to: "/ci/reviews" },
        { label: "On duty today", value: data.stats.onDutyToday, icon: CalendarCheck, tone: "green", to: "/ci/duty-day" },
      ]
    : [];

  return (
    <div className="ci-page">
      <header className="ci-home-header">
        <p className="eyebrow">{formatHeaderDate()}</p>
        <h1>
          {greeting()}
          {data ? `, ${data.profile.displayName}!` : "!"}
        </h1>
        <p>Here's what your clinical groups need today.</p>
      </header>

      {error && <div className="alert-error">{error}</div>}
      {!data && !error && <div className="skeleton" style={{ height: 320 }} />}

      {data && (
        <>
          <div className="ci-stats">
            {stats.map(({ label, value, icon: Icon, tone, to }) => (
              <button key={label} className="card ci-stat" onClick={() => navigate(to)}>
                <span className={`ci-stat-icon ci-tone--${tone}`}>
                  <Icon size={18} />
                </span>
                <span>
                  <strong>{value}</strong>
                  <small>{label}</small>
                </span>
              </button>
            ))}
          </div>

          {data.stats.groups === 0 && (
            <div className="card ci-empty-cta">
              <div>
                <strong>Create your first clinical group</strong>
                <span>Add your students to a group to follow their duties, requirements, and readiness.</span>
              </div>
              <button className="btn btn-primary" onClick={() => navigate("/ci/groups?new=1")}>
                New Group
              </button>
            </div>
          )}

          <div className="ci-grid">
            <div className="ci-col">
              <section className="card ci-panel">
                <header className="ci-panel-head">
                  <div>
                    <p className="ci-eyebrow">Today</p>
                    <h2>On duty today</h2>
                  </div>
                </header>
                {data.todayDuties.length === 0 ? (
                  <p className="empty-text">None of your students are on duty today.</p>
                ) : (
                  <ul className="ci-list">
                    {data.todayDuties.map((d) => (
                      <li key={`${d.area}-${d.hospital}-${d.startTime}`} className="ci-duty">
                        <span className="ci-duty-icon">
                          <Hospital size={18} />
                        </span>
                        <div>
                          <strong>{d.area}</strong>
                          <small>
                            {d.hospital} · <Clock size={11} /> {formatTimeRange(d.startTime, d.endTime)}
                          </small>
                        </div>
                        <span className="badge badge--blue">
                          {d.students} student{d.students === 1 ? "" : "s"}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </section>

              <section className="card ci-panel">
                <header className="ci-panel-head">
                  <div>
                    <p className="ci-eyebrow">Submissions</p>
                    <h2>Needs your review</h2>
                  </div>
                  <button className="text-link" onClick={() => navigate("/ci/reviews")}>
                    Open reviews <ChevronRight size={13} />
                  </button>
                </header>
                {data.pendingReviews.length === 0 ? (
                  <p className="empty-text">You're all caught up on reviews.</p>
                ) : (
                  <ul className="ci-list">
                    {data.pendingReviews.map((r) => (
                      <li key={r.documentId} className="ci-review">
                        <StudentAvatar name={r.studentName} size={34} />
                        <div>
                          <strong>{r.title}</strong>
                          <small>
                            {r.studentName}
                            {r.documentType && ` · ${r.documentType}`} · {submittedText(r.submittedAt)}
                          </small>
                        </div>
                        <span className={`badge ${r.status === "pending" ? "badge--amber" : "badge--blue"}`}>
                          {r.status === "pending" ? "Pending" : "Under review"}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            </div>

            <div className="ci-col">
              <section className="card ci-panel">
                <header className="ci-panel-head">
                  <div>
                    <p className="ci-eyebrow">Follow up</p>
                    <h2>Students needing attention</h2>
                  </div>
                </header>
                {data.attention.length === 0 ? (
                  <p className="empty-text">Everyone is on track.</p>
                ) : (
                  <ul className="ci-list">
                    {data.attention.map((f) => {
                      const { tone, icon: Icon } = flagStyle[f.kind];
                      return (
                        <li key={`${f.studentId}-${f.kind}`}>
                          <button className="ci-flag" onClick={() => navigate(`/ci/groups/${f.groupId}`)}>
                            <span className={`ci-flag-icon ci-tone--${tone}`}>
                              <Icon size={15} />
                            </span>
                            <div>
                              <strong>{f.studentName}</strong>
                              <small>
                                {f.detail} · {f.groupName}
                              </small>
                            </div>
                            <ChevronRight size={15} />
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </section>

              <section className="card ci-panel">
                <header className="ci-panel-head">
                  <div>
                    <p className="ci-eyebrow">Next 2 weeks</p>
                    <h2>Upcoming deadlines</h2>
                  </div>
                </header>
                {data.deadlines.length === 0 ? (
                  <p className="empty-text">No requirement deadlines in the next two weeks.</p>
                ) : (
                  <ul className="ci-list">
                    {data.deadlines.map((d) => {
                      const pct = d.total ? Math.round((d.submitted / d.total) * 100) : 0;
                      return (
                        <li key={`${d.title}-${d.dueDate}`} className="ci-deadline">
                          <div className="ci-deadline-top">
                            <strong>{d.title}</strong>
                            <small>Due {shortDay(d.dueDate)}</small>
                          </div>
                          <div className="ci-bar" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
                            <span style={{ width: `${pct}%` }} />
                          </div>
                          <small>
                            {d.submitted} of {d.total} submitted
                          </small>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </section>

              <section className="card ci-panel">
                <header className="ci-panel-head">
                  <div>
                    <p className="ci-eyebrow">Your classes</p>
                    <h2>My groups</h2>
                  </div>
                  <button className="text-link" onClick={() => navigate("/ci/groups")}>
                    View all <ChevronRight size={13} />
                  </button>
                </header>
                {data.groups.length === 0 ? (
                  <p className="empty-text">No groups yet.</p>
                ) : (
                  <ul className="ci-list">
                    {data.groups.map((g) => (
                      <li key={g.id}>
                        <button className="ci-group-row" onClick={() => navigate(`/ci/groups/${g.id}`)}>
                          <span className={`ci-group-dot ci-tone--${g.color}`} />
                          <div>
                            <strong>{g.name}</strong>
                            <small>
                              {g.memberCount} student{g.memberCount === 1 ? "" : "s"}
                              {g.area && ` · ${g.area}`}
                            </small>
                          </div>
                          <ChevronRight size={15} />
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
