import { useCallback, useEffect, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router";
import { ClipboardPen, RotateCcw, Trophy } from "lucide-react";
import { api } from "../../../lib/api";
import type { QuizDetail, QuizSummary } from "../../../lib/types";
import Modal from "../../../components/Modal/Modal";
import ConfirmDialog from "../../../components/ConfirmDialog/ConfirmDialog";
import { BackLink, PreviewNote, kindInfo } from "../shared";
import QuestionCard from "./QuestionCard";
import SessionSidebar from "./SessionSidebar";
import "../AiStudy.css";
import "./QuizSession.css";

export default function QuizSession() {
  const { id } = useParams();
  const quizId = Number(id);
  const navigate = useNavigate();
  const location = useLocation();
  const requested = (location.state as { requested?: number } | null)?.requested;

  const [detail, setDetail] = useState<QuizDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [index, setIndex] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);
  const [showHint, setShowHint] = useState(false);
  const [busy, setBusy] = useState(false);
  const [results, setResults] = useState<QuizSummary | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [confirmRestart, setConfirmRestart] = useState(false);

  const load = useCallback(async () => {
    try {
      const data = await api.getQuiz(quizId);
      setDetail(data);
      // Resume at the first unanswered question.
      const next = data.questions.findIndex((q) => q.chosenIndex === null);
      setIndex(next === -1 ? 0 : next);
    } catch (err) {
      setError(String(err));
    }
  }, [quizId]);

  useEffect(() => {
    void load();
  }, [load]);

  // Fresh selection and hint for every question.
  useEffect(() => {
    setSelected(null);
    setShowHint(false);
  }, [index]);

  if (error) {
    return (
      <div className="qz">
        <BackLink to="/ai-study/quizlab" />
        <div className="alert-error">{error}</div>
      </div>
    );
  }
  if (!detail) return <div className="skeleton" style={{ height: 420, marginTop: 40 }} />;

  const { quiz, questions } = detail;
  const total = questions.length;
  const q = questions[index];
  const answered = q.chosenIndex !== null;

  /** Next unanswered question after `from`, wrapping around; -1 if none. */
  const nextUnanswered = (from: number) => {
    for (let step = 1; step <= total; step++) {
      const i = (from + step) % total;
      if (questions[i].chosenIndex === null) return i;
    }
    return -1;
  };
  const remaining = questions.filter((x) => x.chosenIndex === null).length;

  async function check() {
    if (selected === null) return;
    setBusy(true);
    try {
      const updated = await api.answerQuestion(q.id, selected);
      setDetail((d) => d && { ...d, questions: d.questions.map((x) => (x.id === updated.id ? updated : x)) });
    } catch (err) {
      setError(String(err));
    } finally {
      setBusy(false);
    }
  }

  async function finish() {
    setBusy(true);
    try {
      const summary = await api.finishQuiz(quizId);
      setDetail((d) => d && { ...d, quiz: summary });
      setResults(summary);
    } catch (err) {
      setError(String(err));
    } finally {
      setBusy(false);
    }
  }

  async function restart() {
    const fresh = await api.restartQuiz(quizId);
    setDetail(fresh);
    setIndex(0);
    setSelected(null);
    setResults(null);
    setSettingsOpen(false);
    setConfirmRestart(false);
  }

  function onPrimary() {
    if (!answered) return void check();
    const next = nextUnanswered(index);
    if (next === -1) void finish();
    else setIndex(next);
  }

  const primaryLabel = !answered ? "Check Answer" : remaining === 0 ? "Finish Quiz" : "Next Question";
  const typesLabel =
    quiz.questionTypes.length === 1 ? kindInfo[quiz.questionTypes[0]].label : "Mixed question types";

  return (
    <div className="qz">
      <BackLink to="/ai-study/quizlab" />

      <header className="qz-banner">
        <span className="qz-banner-icon">
          <ClipboardPen size={26} />
        </span>
        <div>
          <p>Quiz session</p>
          <h1>{quiz.title}</h1>
          <span>
            Generated from your Quizlab · {total} Questions · {typesLabel}
            {quiz.completedAt && ` · Completed (${quiz.score ?? quiz.correctCount}/${total})`}
          </span>
        </div>
      </header>

      {requested !== undefined && requested > total && (
        <PreviewNote>
          You asked for {requested} questions. The built-in practice bank has {total} for the question types you
          picked — more will be possible once AI generation is connected.
        </PreviewNote>
      )}

      <div className="qz-grid">
        <QuestionCard
          question={q}
          index={index}
          total={total}
          selected={selected}
          onSelect={setSelected}
          showHint={showHint}
          primaryLabel={primaryLabel}
          primaryDisabled={!answered && selected === null}
          onPrimary={onPrimary}
          onPrevious={() => setIndex((i) => Math.max(0, i - 1))}
          busy={busy}
        />

        <SessionSidebar
          questions={questions}
          index={index}
          onJump={setIndex}
          onHint={() => setShowHint((v) => !v)}
          hintActive={showHint}
          onSkip={() => {
            const next = nextUnanswered(index);
            if (next !== -1) setIndex(next);
          }}
          canSkip={nextUnanswered(index) !== -1 && nextUnanswered(index) !== index}
          onExit={() => navigate("/ai-study/quizlab")}
          onSettings={() => setSettingsOpen(true)}
        />
      </div>

      {settingsOpen && (
        <Modal
          open
          onClose={() => setSettingsOpen(false)}
          eyebrow="Quiz session"
          title="Quiz Settings"
          width={420}
          footer={
            <button className="btn btn-secondary" onClick={() => setSettingsOpen(false)}>
              Close
            </button>
          }
        >
          <div className="qz-settings">
            <p>Your answers are saved automatically, so you can leave and come back any time.</p>
            <button className="btn btn-secondary" onClick={() => setConfirmRestart(true)}>
              <RotateCcw size={14} /> Restart quiz
            </button>
          </div>
        </Modal>
      )}

      <ConfirmDialog
        open={confirmRestart}
        title="Restart this quiz?"
        message="All of your answers for this quiz will be cleared."
        confirmLabel="Restart"
        danger
        onClose={() => setConfirmRestart(false)}
        onConfirm={restart}
      />

      {results && (
        <Modal
          open
          onClose={() => setResults(null)}
          eyebrow="Quiz complete"
          title={quiz.title}
          width={420}
          footer={
            <>
              <button className="btn btn-secondary" onClick={() => setResults(null)}>
                Review answers
              </button>
              <button className="btn btn-secondary" onClick={() => setConfirmRestart(true)}>
                <RotateCcw size={14} /> Retake
              </button>
              <button className="btn btn-primary" onClick={() => navigate("/ai-study/quizlab")}>
                Back to Quizlab
              </button>
            </>
          }
        >
          <div className="qz-results">
            <span className="qz-results-icon">
              <Trophy size={30} />
            </span>
            <strong>
              {results.score ?? results.correctCount} / {results.questionCount}
            </strong>
            <p>
              {Math.round(((results.score ?? 0) / Math.max(1, results.questionCount)) * 100)}% correct —{" "}
              {(results.score ?? 0) / Math.max(1, results.questionCount) >= 0.75
                ? "great work!"
                : "keep practicing, you've got this."}
            </p>
          </div>
        </Modal>
      )}
    </div>
  );
}
