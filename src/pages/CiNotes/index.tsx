import { useMemo, useState } from "react";
import { useNavigate } from "react-router";
import { ChevronDown, Plus, Search } from "lucide-react";
import { api } from "../../lib/api";
import { useAsync } from "../../hooks/useAsync";
import type { CiNote } from "../../lib/types";
import ConfirmDialog from "../../components/ConfirmDialog/ConfirmDialog";
import PinnedNoteCard from "./components/PinnedNoteCard";
import RecentNoteRow from "./components/RecentNoteRow";
import NoteFormModal from "./components/NoteFormModal";
import NoteDetailsModal from "./components/NoteDetailsModal";
import {
  CLINICAL_AREAS,
  dateFilters,
  isThisWeek,
  matchesDate,
  matchesSearch,
  type DateFilter,
  type NoteTab,
} from "./notes";
import "./CiNotes.css";

const tabs: { value: NoteTab; label: string }[] = [
  { value: "all", label: "All" },
  { value: "important", label: "Important" },
  { value: "pinned", label: "Pinned" },
];

type FormState = { mode: "add" } | { mode: "edit"; note: CiNote } | null;

export default function CiNotes() {
  const navigate = useNavigate();
  const { data: notes, error, reload, setData } = useAsync(api.listCiNotes);
  const [query, setQuery] = useState("");
  const [tab, setTab] = useState<NoteTab>("all");
  const [area, setArea] = useState("");
  const [dateFilter, setDateFilter] = useState<DateFilter>("any");
  const [form, setForm] = useState<FormState>(null);
  const [viewing, setViewing] = useState<CiNote | null>(null);
  const [deleting, setDeleting] = useState<CiNote | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const all = notes ?? [];
  const stats = [
    { label: "All Notes", value: all.length, color: "#7c4ddb" },
    { label: "Important", value: all.filter((n) => n.isImportant).length, color: "#e0338f" },
    { label: "This week", value: all.filter((n) => isThisWeek(n.noteDate)).length, color: "#e5a53a" },
    { label: "Pinned", value: all.filter((n) => n.isPinned).length, color: "#36a874" },
  ];

  const areaOptions = useMemo(
    () => Array.from(new Set([...CLINICAL_AREAS, ...all.map((n) => n.clinicalArea).filter(Boolean)])) as string[],
    [all],
  );

  const filtered = all.filter(
    (n) =>
      (tab === "all" || (tab === "important" ? n.isImportant : n.isPinned)) &&
      (!area || n.clinicalArea === area) &&
      matchesDate(n, dateFilter) &&
      matchesSearch(n, query),
  );
  const pinned = filtered.filter((n) => n.isPinned);
  const recent = filtered.filter((n) => !n.isPinned);

  async function togglePin(note: CiNote) {
    const pinnedNow = !note.isPinned;
    setData((list) => list?.map((n) => (n.id === note.id ? { ...n, isPinned: pinnedNow } : n)) ?? null);
    setViewing((v) => (v?.id === note.id ? { ...v, isPinned: pinnedNow } : v));
    try {
      await api.setCiNotePinned(note.id, pinnedNow);
    } catch (err) {
      setActionError(String(err));
      await reload();
    }
  }

  const handlers = {
    onOpen: setViewing,
    onTogglePin: togglePin,
    onEdit: (note: CiNote) => setForm({ mode: "edit", note }),
    onDelete: setDeleting,
  };

  const filtering = query || tab !== "all" || area || dateFilter !== "any";

  return (
    <div className="ci">
      <div className="ci-header">
        <header className="page-header page-header--plain">
          <p className="eyebrow">Clinical communication</p>
          <h1>CI Notes</h1>
          <p>Keep important instructions and reminders from your clinical instructors organized</p>
        </header>
        <button className="btn btn-primary ci-add" onClick={() => setForm({ mode: "add" })}>
          <Plus size={15} /> Add Notes
        </button>
      </div>

      {(error || actionError) && <div className="alert-error">{error ?? actionError}</div>}

      <div className="ci-stats">
        {stats.map((s) => (
          <div key={s.label} className="card ci-stat">
            <div>
              <span className="ci-stat-dot" style={{ background: s.color }} />
              <p className="ci-stat-label">{s.label}</p>
              <p className="ci-stat-caption">Notes</p>
            </div>
            <strong>{notes ? s.value : "–"}</strong>
          </div>
        ))}
      </div>

      <div className="card ci-toolbar">
        <label className="ci-search">
          <Search size={16} />
          <input
            placeholder="Search CI notes"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label="Search CI notes"
          />
        </label>
        <div className="ci-tabs" role="tablist">
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
        <label className="tasks-filter ci-filter">
          <select value={area} onChange={(e) => setArea(e.target.value)} aria-label="Clinical area">
            <option value="">All clinical areas</option>
            {areaOptions.map((a) => (
              <option key={a} value={a}>
                {a}
              </option>
            ))}
          </select>
          <ChevronDown size={15} />
        </label>
        <label className="tasks-filter ci-filter">
          <select value={dateFilter} onChange={(e) => setDateFilter(e.target.value as DateFilter)} aria-label="Date">
            {dateFilters.map((d) => (
              <option key={d.value} value={d.value}>
                {d.label}
              </option>
            ))}
          </select>
          <ChevronDown size={15} />
        </label>
      </div>

      {!notes && !error && <div className="skeleton" style={{ height: 260 }} />}

      {notes && (
        <>
          {tab !== "important" || pinned.length > 0 ? (
            <section>
              <div className="ci-section-head">
                <div>
                  <p className="ci-eyebrow">Keep close</p>
                  <h2>Pinned Notes</h2>
                </div>
                <span className="ci-count">{pinned.length} Pinned</span>
              </div>
              {pinned.length === 0 ? (
                <div className="card ci-empty">
                  <p className="empty-text">
                    {filtering ? "No pinned notes match your filters." : "Pin a note to keep it here for quick access."}
                  </p>
                </div>
              ) : (
                <div className="ci-pinned-grid">
                  {pinned.map((n) => (
                    <PinnedNoteCard key={n.id} note={n} {...handlers} />
                  ))}
                </div>
              )}
            </section>
          ) : null}

          {tab !== "pinned" && (
            <section>
              <div className="ci-section-head">
                <div>
                  <p className="ci-eyebrow">Latest instructions</p>
                  <h2>Recent Notes</h2>
                  <p className="ci-section-sub">
                    These are personal customizable notes. Actual instructions depend on your instructor, school,
                    hospital, and assigned clinical area.
                  </p>
                </div>
                <span className="ci-count">
                  {recent.length} Note{recent.length === 1 ? "" : "s"}
                </span>
              </div>
              <div className="card ci-recent">
                {recent.length === 0 ? (
                  <p className="empty-text">
                    {filtering ? "No notes match your filters." : "Add a note from your clinical instructor to get started."}
                  </p>
                ) : (
                  recent.map((n) => <RecentNoteRow key={n.id} note={n} {...handlers} />)
                )}
              </div>
            </section>
          )}
        </>
      )}

      {form && (
        <NoteFormModal
          note={form.mode === "edit" ? form.note : undefined}
          areaOptions={areaOptions}
          onClose={() => setForm(null)}
          onSaved={(saved) => {
            setForm(null);
            setViewing((v) => (v?.id === saved.id ? saved : v));
            void reload();
          }}
        />
      )}

      {viewing && (
        <NoteDetailsModal
          note={viewing}
          onClose={() => setViewing(null)}
          onTogglePin={() => togglePin(viewing)}
          onEdit={() => setForm({ mode: "edit", note: viewing })}
          onDelete={() => setDeleting(viewing)}
          onViewDuty={() => viewing.dutyId && navigate(`/duty-checklist?duty=${viewing.dutyId}`)}
        />
      )}

      <ConfirmDialog
        open={deleting !== null}
        title="Delete note?"
        message={`"${deleting?.title ?? ""}" will be permanently removed.`}
        confirmLabel="Delete"
        danger
        onClose={() => setDeleting(null)}
        onConfirm={async () => {
          if (!deleting) return;
          await api.deleteCiNote(deleting.id);
          setViewing((v) => (v?.id === deleting.id ? null : v));
          setDeleting(null);
          await reload();
        }}
      />
    </div>
  );
}
