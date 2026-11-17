import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router";
import {
  BookOpen,
  ChevronDown,
  ChevronRight,
  CircleCheck,
  HeartPulse,
  ListChecks,
  NotebookPen,
  Pill,
  ScanSearch,
  Sparkles,
  Stethoscope,
  type LucideIcon,
} from "lucide-react";
import { api } from "../../../lib/api";
import { useAsync } from "../../../hooks/useAsync";
import type { QuestionKind, QuizSummary } from "../../../lib/types";
import { usePreferences } from "../../../lib/preferences";
import { BackLink, PreviewNote, kindInfo } from "../shared";
import "../AiStudy.css";
import "./Quizlab.css";

const typeTiles: { kind: QuestionKind; icon: LucideIcon }[] = [
  { kind: "multiple_choice", icon: ListChecks },
  { kind: "true_false", icon: CircleCheck },
  { kind: "identification", icon: ScanSearch },
  { kind: "case_based", icon: Stethoscope },
];

const COUNTS = [15, 20, 30, 50];
const RECENT_PREVIEW = 4;

/** Icon + color for a quiz row, guessed from its title. */
function quizIcon(title: string): { icon: LucideIcon; tone: string } {
  const t = title.toLowerCase();
  if (t.includes("pharm") || t.includes("drug")) return { icon: Pill, tone: "pink" };
  if (t.includes("vital")) return { icon: HeartPulse, tone: "purple" };
  if (t.includes("anatomy") || t.includes("physio")) return { icon: BookOpen, tone: "blue" };
  return { icon: Stethoscope, tone: "blue" };
}

function quizStatus(q: QuizSummary): string {
  if (q.completedAt) return `Completed · ${q.score ?? q.correctCount}/${q.questionCount}`;
  if (q.answeredCount > 0) return `In progress · ${q.answeredCount}/${q.questionCount}`;
  return `${q.questionCount} Questions · Practice`;
}

export default function Quizlab() {
  const navigate = useNavigate();
  const { data: quizzes, error: listError } = useAsync(api.listQuizzes);
  const [topic, setTopic] = useState("");
  const [notes, setNotes] = useState("");
  const [notesOpen, setNotesOpen] = useState(false);
  const [types, setTypes] = useState<QuestionKind[]>(["multiple_choice"]);
  const { get } = usePreferences();
  const [count, setCount] = useState(() => {
    const preferred = Number(get("quiz_default_count"));
    return COUNTS.includes(preferred) ? preferred : 15;
  });
  const [errors, setErrors] = useState<{ topic?: string; types?: string }>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [showAll, setShowAll] = useState(false);

  function toggleType(kind: QuestionKind) {
    setTypes((t) => (t.includes(kind) ? t.filter((k) => k !== kind) : [...t, kind]));
    setErrors((e) => ({ ...e, types: undefined }));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const next: typeof errors = {};
    if (!topic.trim()) next.topic = "Enter a quiz topic.";
    if (types.length === 0) next.types = "Choose at least one question type.";
    setErrors(next);
    if (Object.keys(next).length > 0) return;

    setCreating(true);
    setServerError(null);
    try {
      const { quiz, requested } = await api.createQuiz({ topic, notes: notes || null, questionTypes: types, count });
      navigate(`/ai-study/quiz/${quiz.id}`, { state: { requested } });
    } catch (err) {
      setServerError(String(err));
      setCreating(false);
    }
  }

  const visible = showAll ? quizzes ?? [] : (quizzes ?? []).slice(0, RECENT_PREVIEW);

  return (
    <div className="quizlab">
      <BackLink to="/ai-study" />

      <header className="quizlab-banner">
        <p>Your personal study space</p>
        <h1>NurSet Quizlab</h1>
        <span>Turn your topics and notes into practice quizzes for exams and clinical duty.</span>
      </header>

      <div className="quizlab-grid">
        <form className="card quizlab-form" onSubmit={handleSubmit} noValidate>
          <div>
            <h2>Create a new quiz</h2>
            <p className="quizlab-sub">What do you want to practice today?</p>
          </div>

          {serverError && <div className="alert-error">{serverError}</div>}

          <div className={`quizlab-field${errors.topic ? " has-error" : ""}`}>
            <label htmlFor="quiz-topic">Quiz topic</label>
            <input
              id="quiz-topic"
              placeholder="e.g. Fundamentals of Nursing"
              value={topic}
              onChange={(e) => {
                setTopic(e.target.value);
                setErrors((er) => ({ ...er, topic: undefined }));
              }}
            />
            {errors.topic && <p className="field-error">{errors.topic}</p>}
          </div>

          <div className="quizlab-field">
            <span className="quizlab-label">Source material</span>
            <button
              type="button"
              className={`quizlab-source${notesOpen ? " is-open" : ""}`}
              onClick={() => setNotesOpen((v) => !v)}
              aria-expanded={notesOpen}
            >
              <span className="quizlab-source-icon">
                <NotebookPen size={16} />
              </span>
              <span className="quizlab-source-text">
                <strong>{notes.trim() ? "Your notes are added" : "Paste or type your notes"}</strong>
                <small>Use your own study materials</small>
              </span>
              {notesOpen ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
            </button>
            {notesOpen && (
              <textarea
                className="quizlab-notes"
                rows={6}
                placeholder="Paste lecture notes, a reviewer, or key points…"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            )}
          </div>

          <div className="quizlab-field">
            <span className="quizlab-label">Question type</span>
            <div className="quizlab-types" role="group" aria-label="Question types">
              {typeTiles.map(({ kind, icon: Icon }) => {
                const on = types.includes(kind);
                return (
                  <button
                    key={kind}
                    type="button"
                    aria-pressed={on}
                    className={`quizlab-type quizlab-type--${kindInfo[kind].tone}${on ? " is-on" : ""}`}
                    onClick={() => toggleType(kind)}
                  >
                    <span className="quizlab-type-icon">
                      <Icon size={18} />
                    </span>
                    {kindInfo[kind].label}
                  </button>
                );
              })}
            </div>
            {errors.types && <p className="field-error">{errors.types}</p>}
          </div>

          <div className="quizlab-field">
            <span className="quizlab-label">Number of questions</span>
            <div className="quizlab-counts" role="radiogroup" aria-label="Number of questions">
              {COUNTS.map((n) => (
                <button
                  key={n}
                  type="button"
                  role="radio"
                  aria-checked={count === n}
                  className={count === n ? "is-on" : ""}
                  onClick={() => setCount(n)}
                >
                  {n}
                </button>
              ))}
            </div>
          </div>

          <button type="submit" className="quizlab-generate" disabled={creating}>
            <Sparkles size={16} /> {creating ? "Generating…" : "Generate Quiz with AI"}
          </button>
          <PreviewNote>
            Preview mode: AI generation isn't connected yet, so questions come from NurSet's built-in
            nursing practice bank (topic matches first).
          </PreviewNote>
        </form>

        <aside className="quizlab-side">
          <section className="card quizlab-recent">
            <header>
              <h3>Recent Quizzes</h3>
              {(quizzes?.length ?? 0) > RECENT_PREVIEW && (
                <button className="text-link" onClick={() => setShowAll((v) => !v)}>
                  {showAll ? "Show less" : "View all"}
                </button>
              )}
            </header>
            {listError && <div className="alert-error">{listError}</div>}
            {quizzes && quizzes.length === 0 && <p className="empty-text">Your quizzes will appear here.</p>}
            {visible.map((q) => {
              const { icon: Icon, tone } = quizIcon(q.title);
              return (
                <button key={q.id} className="quizlab-recent-row" onClick={() => navigate(`/ai-study/quiz/${q.id}`)}>
                  <span className={`quizlab-recent-icon ai-tone--${tone}`}>
                    <Icon size={17} />
                  </span>
                  <span className="quizlab-recent-text">
                    <strong>{q.title}</strong>
                    <small>{quizStatus(q)}</small>
                  </span>
                  <ChevronRight size={17} />
                </button>
              );
            })}
          </section>

          <section className="quizlab-motivation" aria-hidden="true">
            <svg viewBox="0 0 64 64" width="58" height="58">
              <rect x="6" y="14" width="52" height="40" rx="10" fill="#fff" stroke="#9db4e6" strokeWidth="2" />
              <path d="M6 24h52" stroke="#9db4e6" strokeWidth="2" />
              <circle cx="24" cy="36" r="2.6" fill="#3d5fb8" />
              <circle cx="40" cy="36" r="2.6" fill="#3d5fb8" />
              <path d="M26 43q6 5 12 0" stroke="#3d5fb8" strokeWidth="2.4" fill="none" strokeLinecap="round" />
              <circle cx="18" cy="41" r="3" fill="#f6b4c4" opacity=".7" />
              <circle cx="46" cy="41" r="3" fill="#f6b4c4" opacity=".7" />
            </svg>
            <p>
              Small steps today,
              <br />
              big dreams tomorrow
            </p>
          </section>
        </aside>
      </div>
    </div>
  );
}
