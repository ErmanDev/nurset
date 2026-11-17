import type { ReactNode } from "react";
import { Link } from "react-router";
import {
  BriefcaseMedical,
  Check,
  ChevronRight,
  ClipboardList,
  Sparkles,
  type LucideIcon,
} from "lucide-react";
import { daysUntil, formatLongDate, parseDate, parseDateTime } from "../../../lib/format";
import type { ProgressOverview, Ratio, RequirementProgressStatus } from "../../../lib/types";

type Props = { data: ProgressOverview };

export function pct(r: Ratio): number {
  return r.total ? Math.round((r.done / r.total) * 100) : 0;
}

const rangeLabel = { week: "Weekly overview", month: "Monthly overview", all: "All-time overview" };

function Bar({ value, tone = "violet" }: { value: number; tone?: "violet" | "white" }) {
  return (
    <div className={`pg-bar pg-bar--${tone}`} role="progressbar" aria-valuenow={value} aria-valuemin={0} aria-valuemax={100}>
      <span style={{ width: `${value}%` }} />
    </div>
  );
}

function Card({
  eyebrow,
  title,
  link,
  children,
  className = "",
}: {
  eyebrow?: string;
  title: string;
  link?: { to: string; label: string };
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`card pg-card ${className}`}>
      <header className="pg-card-head">
        <div>
          {eyebrow && <p className="pg-eyebrow">{eyebrow}</p>}
          <h3>{title}</h3>
        </div>
        {link && (
          <Link to={link.to} className="text-link">
            {link.label} <ChevronRight size={13} />
          </Link>
        )}
      </header>
      {children}
    </section>
  );
}

// ---------- hero ----------

export function OverviewHero({ data }: Props) {
  const c = data.categories;
  const done = c.tasks.done + c.requirements.done + c.dutyPrep.done + c.study.done;
  const total = c.tasks.total + c.requirements.total + c.dutyPrep.total + c.study.total;
  const percent = pct({ done, total });
  const R = 52;
  const C = 2 * Math.PI * R;

  return (
    <section className="pg-hero">
      <div className="pg-hero-text">
        <p className="pg-hero-eyebrow">{rangeLabel[data.range]}</p>
        <h2>
          {total === 0 ? "Nothing scheduled yet" : `${done} of ${total} responsibilities completed`}
        </h2>
        <p>Your NurSet activity is combined across tasks, requirements, duty preparation, and study tools</p>
        <Bar value={percent} tone="white" />
      </div>
      <div className="pg-ring" aria-label={`${percent}% complete`}>
        <svg viewBox="0 0 128 128" width="128" height="128" aria-hidden="true">
          <circle cx="64" cy="64" r={R} fill="none" stroke="rgba(255,255,255,0.25)" strokeWidth="10" />
          <circle
            cx="64"
            cy="64"
            r={R}
            fill="none"
            stroke="#fff"
            strokeWidth="10"
            strokeLinecap="round"
            strokeDasharray={C}
            strokeDashoffset={C * (1 - percent / 100)}
            transform="rotate(-90 64 64)"
          />
        </svg>
        <div className="pg-ring-label">
          <strong>{percent}%</strong>
          <span>Complete</span>
        </div>
      </div>
    </section>
  );
}

// ---------- category cards ----------

export function CategoryCards({ data }: Props) {
  const c = data.categories;
  const cards: { label: string; icon: LucideIcon; ratio: Ratio; text: string }[] = [
    { label: "Tasks", icon: Check, ratio: c.tasks, text: `${c.tasks.done} of ${c.tasks.total} Completed` },
    {
      label: "Requirements",
      icon: ClipboardList,
      ratio: c.requirements,
      text: `${c.requirements.done} of ${c.requirements.total} Completed`,
    },
    {
      label: "Duty Preparation",
      icon: BriefcaseMedical,
      ratio: c.dutyPrep,
      text: `${c.dutyPrep.done} of ${c.dutyPrep.total} Completed`,
    },
    { label: "Study Activities", icon: Sparkles, ratio: c.study, text: `${c.study.done} completed` },
  ];

  return (
    <div className="pg-cats">
      {cards.map(({ label, icon: Icon, ratio, text }) => (
        <div key={label} className="card pg-cat">
          <span className="pg-cat-icon">
            <Icon size={18} />
          </span>
          <p className="pg-cat-label">{label}</p>
          <p className="pg-cat-value">{ratio.total === 0 ? "No items yet" : text}</p>
          <Bar value={pct(ratio)} />
          <p className="pg-cat-pct">{pct(ratio)}%</p>
        </div>
      ))}
    </div>
  );
}

// ---------- left column ----------

export function TaskProgressCard({ data }: Props) {
  const t = data.taskBreakdown;
  const total = t.completed + t.pending + t.overdue;
  const stats = [
    { label: "Completed", value: t.completed, tone: "violet" },
    { label: "Pending", value: t.pending, tone: "blue" },
    { label: "Overdue", value: t.overdue, tone: "red" },
  ];
  return (
    <Card eyebrow="Responsibilities" title="Task Progress" link={{ to: "/tasks", label: "View Tasks" }}>
      <div className="pg-task-stats">
        {stats.map((s) => (
          <div key={s.label} className={`pg-task-stat pg-task-stat--${s.tone}`}>
            <strong>{s.value}</strong>
            <span>{s.label}</span>
          </div>
        ))}
      </div>
      <Bar value={pct({ done: t.completed, total })} />
    </Card>
  );
}

const reqStatus: Record<RequirementProgressStatus, { label: string; tone: string }> = {
  submitted: { label: "Submitted", tone: "green" },
  approved: { label: "Approved", tone: "green" },
  in_review: { label: "In Review", tone: "amber" },
  needs_revision: { label: "Needs Revision", tone: "red" },
  not_started: { label: "Not Started", tone: "red" },
};

export function RequirementsProgressCard({ data }: Props) {
  const rows = data.requirements.slice(0, 5);
  return (
    <Card
      eyebrow="Submission status"
      title="Requirements Progress"
      link={{ to: "/requirements", label: "View Requirements" }}
    >
      {rows.length === 0 ? (
        <p className="empty-text">No requirements due in this period.</p>
      ) : (
        <ul className="pg-list">
          {rows.map((r) => (
            <li key={r.id}>
              <span>{r.title}</span>
              <span className={`badge badge--${reqStatus[r.status].tone}`}>{reqStatus[r.status].label}</span>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

function dueText(date: string): string {
  const d = daysUntil(date);
  if (d < -1) return `Overdue since ${parseDate(date).toLocaleDateString("en-US", { month: "short", day: "numeric" })}`;
  if (d === -1) return "Was due yesterday";
  if (d === 0) return "Due today";
  if (d === 1) return "Due tomorrow";
  return `Due in ${d} days`;
}

export function NeedsAttentionCard({ data }: Props) {
  const actions = {
    task: { tone: "orange", label: "Open Task", to: () => "/tasks" },
    requirement: { tone: "red", label: "View Requirement", to: () => "/requirements" },
    duty: { tone: "blue", label: "Prepare for Duty", to: (id: number) => `/duty-checklist?duty=${id}` },
  } as const;
  const detailText = (kind: string, detail: string | null) =>
    kind === "requirement" && detail ? reqStatus[detail as RequirementProgressStatus]?.label ?? detail : detail;

  return (
    <Card eyebrow="What to work on next" title="Needs Attention">
      {data.attention.length === 0 ? (
        <p className="empty-text">You're all caught up. Nice work!</p>
      ) : (
        <ul className="pg-attention">
          {data.attention.map((a) => {
            const action = actions[a.kind];
            const detail = detailText(a.kind, a.detail);
            return (
              <li key={`${a.kind}-${a.id}`}>
                <span className={`pg-attention-dot pg-attention-dot--${action.tone}`} aria-hidden="true" />
                <div>
                  <strong>{a.title}</strong>
                  <small>
                    {a.kind === "duty" ? formatLongDate(a.date) : dueText(a.date)}
                    {detail && ` · ${detail}`}
                  </small>
                </div>
                <Link to={action.to(a.id)} className="text-link">
                  {action.label}
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}

// ---------- right column ----------

export function DutyPrepCard({ data }: Props) {
  const next = data.nextDuty;
  if (!next) {
    return (
      <Card title="Duty Preparation" link={{ to: "/duty-schedule", label: "Duty Schedule" }}>
        <p className="empty-text">No upcoming duty.</p>
      </Card>
    );
  }
  const checks = next.readiness.done;
  const status = checks >= 4 ? "All Set" : checks >= 2 ? "Almost Ready" : "Not Ready";
  const rows = [
    { label: "Duty Bag", value: next.bag.total ? `${pct(next.bag)}% Ready` : "Not started" },
    { label: "Rotation Preparation", value: next.rotation.total ? `${pct(next.rotation)}% Ready` : "Not started" },
    { label: "Requirements", value: `${next.requirements.done} of ${next.requirements.total} Ready` },
  ];

  return (
    <section className="card pg-card pg-duty">
      <header className="pg-duty-head">
        <span className="pg-cat-icon">
          <BriefcaseMedical size={18} />
        </span>
        <div>
          <small>Next duty · {formatLongDate(next.duty.dutyDate)}</small>
          <h3>Duty Preparation</h3>
        </div>
      </header>
      <div className="pg-duty-area">
        <span>{next.duty.area}</span>
        <span className={`pg-duty-status pg-duty-status--${checks >= 4 ? "ready" : checks >= 2 ? "almost" : "not"}`}>
          {status}
        </span>
      </div>
      <ul className="pg-list pg-list--plain">
        {rows.map((r) => (
          <li key={r.label}>
            <span>{r.label}</span>
            <strong>{r.value}</strong>
          </li>
        ))}
      </ul>
      <Link to={`/duty-checklist?duty=${next.duty.id}`} className="pg-card-foot">
        View Duty Checklist <ChevronRight size={15} />
      </Link>
    </section>
  );
}

export function StudyActivityCard({ data }: Props) {
  const s = data.study;
  const tiles = [
    { value: s.quizzesCompleted, label: "Quizzes completed" },
    { value: s.quizzesInProgress, label: "Quizzes in progress" },
    { value: s.chats, label: "AI chats" },
    { value: s.averageScore === null ? "–" : `${s.averageScore}%`, label: "Average score" },
  ];
  return (
    <section className="card pg-card">
      <header className="pg-duty-head">
        <span className="pg-cat-icon">
          <Sparkles size={18} />
        </span>
        <h3>Study Activity</h3>
      </header>
      <div className="pg-study-grid">
        {tiles.map((t) => (
          <div key={t.label} className="pg-study-tile">
            <strong>{t.value}</strong>
            <span>{t.label}</span>
          </div>
        ))}
      </div>
      <Link to="/ai-study" className="pg-card-foot">
        Open AI Study <ChevronRight size={15} />
      </Link>
    </section>
  );
}

function completedWhen(ts: string): string {
  const d = daysUntil(ts);
  if (d === 0) return "Completed today";
  if (d === -1) return "Completed yesterday";
  return `Completed ${parseDateTime(ts).toLocaleDateString("en-US", { month: "short", day: "numeric" })}`;
}

export function RecentlyCompletedCard({ data }: Props) {
  return (
    <Card eyebrow="Latest activity" title="Recently Completed" link={{ to: "/tasks", label: "View all" }}>
      {data.recent.length === 0 ? (
        <p className="empty-text">Completed tasks and quizzes will show up here.</p>
      ) : (
        <ul className="pg-recent">
          {data.recent.map((r) => (
            <li key={`${r.kind}-${r.id}`}>
              <span className="pg-recent-check" aria-hidden="true">
                <Check size={13} strokeWidth={3} />
              </span>
              <div>
                <strong>{r.kind === "quiz" ? `${r.title} Quiz` : r.title}</strong>
                <small>
                  {completedWhen(r.completedAt)}
                  {r.detail && ` · ${r.detail}`}
                </small>
              </div>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
