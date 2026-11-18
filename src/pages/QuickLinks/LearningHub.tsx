import { useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router";
import { Bookmark, ChevronDown, FileText, Flame, Presentation, Search, Sparkles, type LucideIcon } from "lucide-react";
import { api } from "../../lib/api";
import { useAsync } from "../../hooks/useAsync";
import type { Material, MaterialKind } from "../../lib/types";
import Modal from "../../components/Modal/Modal";
import { usePreferences } from "../../lib/preferences";
import { QlHeader, materialMeta } from "./shared";
import { toast } from "../../components/Toast/Toast";
import "./QuickLinks.css";

type Tab = "all" | MaterialKind | "bookmarked";
type Sort = "newest" | "oldest" | "az";

const tabs: { value: Tab; label: string }[] = [
  { value: "all", label: "All Materials" },
  { value: "pdf_notes", label: "PDF Notes" },
  { value: "presentation", label: "Presentations" },
  { value: "reviewer", label: "Reviewers" },
  { value: "bookmarked", label: "Bookmarked" },
];

const kindIcon: Record<MaterialKind, LucideIcon> = {
  pdf_notes: FileText,
  presentation: Presentation,
  reviewer: Sparkles,
  handbook: FileText,
};

const tips = [
  "Use active recall: close your notes and explain the concept in your own words.",
  "Space out your reviews — a short session each day beats one long cram.",
  "Teach a classmate. Explaining a topic shows you what you still need to learn.",
  "Link drugs to their nursing considerations, not just their names.",
  "After duty, write three things you learned while they're still fresh.",
];

const loadJourney = () => api.getStudyJourney();

export default function LearningHub() {
  const [params] = useSearchParams();
  const { data: materials, error, setData } = useAsync(api.listMaterials);
  const { data: journey, reload: reloadJourney } = useAsync(loadJourney);
  const [query, setQuery] = useState(params.get("q") ?? "");
  const [tab, setTab] = useState<Tab>("all");
  const [sort, setSort] = useState<Sort>("newest");
  const [notice, setNotice] = useState<string | null>(null);
  const { get } = usePreferences();
  const showTip = get("study_tips") !== "0";

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = (materials ?? []).filter(
      (m) =>
        (tab === "all" || (tab === "bookmarked" ? m.bookmarked : m.kind === tab)) &&
        (!q || m.title.toLowerCase().includes(q) || m.description?.toLowerCase().includes(q)),
    );
    return [...list].sort((a, b) =>
      sort === "az"
        ? a.title.localeCompare(b.title)
        : sort === "oldest"
          ? a.createdAt.localeCompare(b.createdAt)
          : b.createdAt.localeCompare(a.createdAt),
    );
  }, [materials, query, tab, sort]);

  async function toggleBookmark(m: Material) {
    setData((list) => list?.map((x) => (x.id === m.id ? { ...x, bookmarked: !m.bookmarked } : x)) ?? null);
    try {
      await api.setMaterialBookmark(m.id, !m.bookmarked);
      if (m.bookmarked) toast.deleted("Bookmark removed", `“${m.title}”`);
      else toast.created("Bookmarked", `“${m.title}” was saved to your bookmarks.`);
    } catch (err) {
      setNotice(String(err));
    }
  }

  async function view(m: Material) {
    try {
      await api.openMaterial(m.id);
      void reloadJourney();
    } catch (err) {
      setNotice(String(err));
    }
  }

  const goal = journey ? Math.min(100, Math.round((journey.sessionsToday / journey.dailyGoal) * 100)) : 0;
  const tip = tips[new Date().getDate() % tips.length];

  return (
    <div className="ql">
      <header className="lh-banner">
        <div>
          <span className="lh-pill">✦ Study &amp; grow</span>
          <h1>Your Learning Hub ✨</h1>
          <p>Find your next favorite study resource and grow into the nurse you dream of becoming!</p>
        </div>
        <svg className="lh-art" viewBox="0 0 160 120" aria-hidden="true">
          <circle cx="104" cy="58" r="46" fill="#f3c6dc" opacity=".55" />
          <circle cx="132" cy="92" r="16" fill="#bfe8de" opacity=".8" />
          <path d="M70 34v26a20 20 0 0 0 40 0V34" fill="none" stroke="#6a4fd6" strokeWidth="6" strokeLinecap="round" />
          <circle cx="70" cy="30" r="5" fill="#6a4fd6" />
          <circle cx="110" cy="30" r="5" fill="#6a4fd6" />
          <path d="M90 80v14a14 14 0 0 0 28 0v-6" fill="none" stroke="#6a4fd6" strokeWidth="6" strokeLinecap="round" />
          <circle cx="118" cy="84" r="9" fill="#fff" stroke="#6a4fd6" strokeWidth="5" />
          <path d="M140 30l3 7 7 3-7 3-3 7-3-7-7-3 7-3z" fill="#a58cf0" />
          <path d="M44 70l2 5 5 2-5 2-2 5-2-5-5-2 5-2z" fill="#a58cf0" />
        </svg>
      </header>

      <QlHeader title="Explore Study Materials" subtitle="Find notes, reviewers, and helpful resources for your nursing journey" />

      <div className="lh-toolbar">
        <label className="lh-search">
          <Search size={16} />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search materials…" aria-label="Search materials" />
        </label>
        <label className="lh-sort">
          <select value={sort} onChange={(e) => setSort(e.target.value as Sort)} aria-label="Sort">
            <option value="newest">Newest first</option>
            <option value="oldest">Oldest first</option>
            <option value="az">Title A–Z</option>
          </select>
          <ChevronDown size={15} />
        </label>
      </div>
      <div className="lh-tabs" role="tablist">
        {tabs.map((t) => (
          <button
            key={t.value}
            role="tab"
            aria-selected={tab === t.value}
            className={tab === t.value ? "is-active" : ""}
            onClick={() => setTab(t.value)}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="lh-grid">
        <div>
          {error && <div className="alert-error">{error}</div>}
          {!materials && !error && <div className="skeleton" style={{ height: 300 }} />}
          {materials && visible.length === 0 && (
            <div className="card ql-empty">
              <p className="empty-text">
                No materials found. <Link to="/quick-links/upload">Upload your own</Link> to build your library.
              </p>
            </div>
          )}
          <div className="lh-cards">
            {visible.map((m) => {
              const Icon = kindIcon[m.kind];
              return (
                <article key={m.id} className={`card lh-card lh-tone--${m.tone}`}>
                  <div className="lh-card-top">
                    <span className="lh-icon">
                      <Icon size={18} />
                    </span>
                    <button
                      className={`lh-bookmark${m.bookmarked ? " is-on" : ""}`}
                      onClick={() => toggleBookmark(m)}
                      aria-pressed={m.bookmarked}
                      aria-label={m.bookmarked ? "Remove bookmark" : "Bookmark"}
                    >
                      <Bookmark size={15} />
                    </button>
                  </div>
                  <h3>{m.title}</h3>
                  {m.description && <p className="lh-desc">{m.description}</p>}
                  <div className="lh-card-foot">
                    <span className="lh-meta">
                      {materialMeta(m)}
                      {m.isMine && " · Yours"}
                    </span>
                    <button className="btn lh-view" onClick={() => view(m)}>
                      View Resource
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        </div>

        <aside className="card lh-journey">
          <h3>Your Nursing Journey</h3>
          <p className="lh-journey-sub">Small steps, big progress!</p>
          <div className="lh-goal">
            <strong>Today's Study Goal</strong>
            <span>
              {journey ? `${Math.min(journey.sessionsToday, journey.dailyGoal)} of ${journey.dailyGoal}` : "–"} study sessions
            </span>
            <div className="lh-bar">
              <span style={{ width: `${goal}%` }} />
            </div>
          </div>
          <p className="lh-cheer">
            {goal >= 100 ? "Goal reached — amazing work, future nurse! 💗" : "You're doing great, future nurse! 💗"}
          </p>
          <div className="lh-streak">
            <Flame size={20} />
            <div>
              <strong>
                {journey?.streakDays ?? 0}-Day Study Streak
              </strong>
              <span>{(journey?.streakDays ?? 0) > 0 ? "Keep your momentum going!" : "Study today to start a streak"}</span>
            </div>
          </div>
          {showTip && <div className="lh-tip">
            <p>Quick study tip</p>
            <span>{tip}</span>
          </div>}
        </aside>
      </div>

      {notice && (
        <Modal
          open
          onClose={() => setNotice(null)}
          title="Can't open this resource"
          width={420}
          footer={
            <>
              <button className="btn btn-secondary" onClick={() => setNotice(null)}>
                Close
              </button>
              <Link to="/quick-links/upload" className="btn btn-primary">
                Upload Materials
              </Link>
            </>
          }
        >
          <p style={{ fontSize: 13, color: "var(--text-muted)" }}>{notice}</p>
        </Modal>
      )}
    </div>
  );
}
