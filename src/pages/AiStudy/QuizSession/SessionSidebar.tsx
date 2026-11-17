import { Check, LayoutGrid, Lightbulb, LogOut, Settings, SkipForward, X, type LucideIcon } from "lucide-react";
import type { QuizQuestion } from "../../../lib/types";

interface Props {
  questions: QuizQuestion[];
  index: number;
  onJump: (index: number) => void;
  onHint: () => void;
  onSkip: () => void;
  onExit: () => void;
  onSettings: () => void;
  canSkip: boolean;
  hintActive: boolean;
}

const RING_R = 26;
const RING_C = 2 * Math.PI * RING_R;

export default function SessionSidebar({
  questions,
  index,
  onJump,
  onHint,
  onSkip,
  onExit,
  onSettings,
  canSkip,
  hintActive,
}: Props) {
  const total = questions.length;
  const answered = questions.filter((q) => q.chosenIndex !== null).length;
  const pct = total ? answered / total : 0;

  const tools: { label: string; sub: string; icon: LucideIcon; tone: string; onClick: () => void; disabled?: boolean; active?: boolean }[] = [
    { label: "Hint", sub: "Get a clue", icon: Lightbulb, tone: "purple", onClick: onHint, active: hintActive },
    { label: "Skip", sub: "Next question", icon: SkipForward, tone: "green", onClick: onSkip, disabled: !canSkip },
    { label: "Exit Quiz", sub: "Save & leave", icon: LogOut, tone: "red", onClick: onExit },
    { label: "Settings", sub: "Quiz options", icon: Settings, tone: "blue", onClick: onSettings },
  ];

  return (
    <aside className="qz-side">
      <section className="card qz-panel">
        <h3>Question Progress</h3>
        <div className="qz-progress">
          <svg viewBox="0 0 64 64" width="64" height="64" aria-hidden="true">
            <circle cx="32" cy="32" r={RING_R} fill="none" stroke="#e3e8f0" strokeWidth="6" />
            <circle
              cx="32"
              cy="32"
              r={RING_R}
              fill="none"
              stroke="#3a6fd0"
              strokeWidth="6"
              strokeLinecap="round"
              strokeDasharray={RING_C}
              strokeDashoffset={RING_C * (1 - pct)}
              transform="rotate(-90 32 32)"
            />
            <text x="32" y="36" textAnchor="middle" fontSize="12" fontWeight="600" fill="#1b2333">
              {answered}/{total}
            </text>
          </svg>
          <div className="qz-progress-text">
            <span>Questions Answered</span>
            <strong>
              {answered}/{total}
            </strong>
            <div className="qz-mini-bar">
              <span style={{ width: `${pct * 100}%` }} />
            </div>
          </div>
        </div>
      </section>

      <section className="card qz-panel">
        <h3 className="qz-panel-title">
          <span className="qz-panel-icon">
            <LayoutGrid size={15} />
          </span>
          Question List
        </h3>
        <div className="qz-dots">
          {questions.map((q, i) => {
            const state =
              i === index ? "is-current" : q.isCorrect === true ? "is-correct" : q.isCorrect === false ? "is-wrong" : "";
            return (
              <button
                key={q.id}
                className={`qz-dot ${state}`}
                onClick={() => onJump(i)}
                aria-label={`Question ${i + 1}${q.chosenIndex !== null ? (q.isCorrect ? ", correct" : ", incorrect") : ""}`}
                aria-current={i === index ? "step" : undefined}
              >
                {i + 1}
                {q.chosenIndex !== null && (
                  <span className="qz-dot-badge">
                    {q.isCorrect ? <Check size={8} strokeWidth={4} /> : <X size={8} strokeWidth={4} />}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </section>

      <section className="card qz-panel">
        <h3 className="qz-panel-title">
          <span className="qz-panel-icon">
            <Settings size={15} />
          </span>
          Tools
        </h3>
        <div className="qz-tools">
          {tools.map(({ label, sub, icon: Icon, tone, onClick, disabled, active }) => (
            <button
              key={label}
              className={`qz-tool qz-tool--${tone}${active ? " is-active" : ""}`}
              onClick={onClick}
              disabled={disabled}
              aria-pressed={active}
            >
              <Icon size={16} />
              <span>
                <strong>{label}</strong>
                <small>{sub}</small>
              </span>
            </button>
          ))}
        </div>
      </section>
    </aside>
  );
}
