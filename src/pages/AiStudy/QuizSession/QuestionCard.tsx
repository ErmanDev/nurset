import { ArrowLeft, ArrowRight, Check, CircleCheck, CircleX, Lightbulb } from "lucide-react";
import type { QuizQuestion } from "../../../lib/types";
import { kindInfo } from "../shared";
import HeartDiagram, { parseDiagram } from "./HeartDiagram";

interface Props {
  question: QuizQuestion;
  index: number;
  total: number;
  selected: number | null;
  onSelect: (choice: number) => void;
  showHint: boolean;
  primaryLabel: string;
  primaryDisabled: boolean;
  onPrimary: () => void;
  onPrevious: () => void;
  busy: boolean;
}

export default function QuestionCard({
  question: q,
  index,
  total,
  selected,
  onSelect,
  showHint,
  primaryLabel,
  primaryDisabled,
  onPrimary,
  onPrevious,
  busy,
}: Props) {
  const answered = q.chosenIndex !== null;
  const diagram = parseDiagram(q.image);
  const letters = q.kind === "true_false" ? ["T", "F"] : ["A", "B", "C", "D", "E", "F"];
  const info = kindInfo[q.kind];

  function choiceState(i: number): string {
    if (!answered) return selected === i ? " is-selected" : "";
    if (i === q.answerIndex) return " is-correct";
    if (i === q.chosenIndex) return " is-wrong";
    return " is-dim";
  }

  const choices = (
    <div className="qz-choices" role="radiogroup" aria-label="Answer choices">
      {q.choices.map((choice, i) => {
        const state = choiceState(i);
        return (
          <button
            key={i}
            role="radio"
            aria-checked={answered ? q.chosenIndex === i : selected === i}
            className={`qz-choice${state}`}
            onClick={() => !answered && onSelect(i)}
            disabled={answered}
          >
            <span className="qz-letter">{letters[i]}</span>
            <span className="qz-choice-text">{choice}</span>
            <span className="qz-radio" aria-hidden="true">
              {(state === " is-selected" || state === " is-correct") && <Check size={13} strokeWidth={3} />}
              {state === " is-wrong" && <CircleX size={14} />}
            </span>
          </button>
        );
      })}
    </div>
  );

  return (
    <section className="card qz-card">
      <div className="qz-card-top">
        <p className="qz-counter">
          Question {index + 1} of {total}
        </p>
        <span className="qz-saved">
          <Check size={11} strokeWidth={3} /> Auto-saved
        </span>
      </div>
      <div className="qz-bar">
        <span style={{ width: `${((index + 1) / total) * 100}%` }} />
      </div>

      <span className={`qz-kind ai-tone--${info.tone}`}>{info.label}</span>

      {q.caseText && <p className="qz-case">{q.caseText}</p>}
      <h2 className="qz-prompt">{q.prompt}</h2>

      {showHint && q.hint && !answered && (
        <p className="qz-hint">
          <Lightbulb size={14} /> {q.hint}
        </p>
      )}

      {diagram ? (
        <div className="qz-figure-row">
          <HeartDiagram chamber={diagram} />
          {choices}
        </div>
      ) : (
        choices
      )}

      {answered && (
        <div className={`qz-feedback ${q.isCorrect ? "is-correct" : "is-wrong"}`} role="status">
          <strong>
            {q.isCorrect ? <CircleCheck size={16} /> : <CircleX size={16} />}
            {q.isCorrect
              ? "Correct!"
              : `Not quite — the answer is ${letters[q.answerIndex ?? 0]}. ${q.choices[q.answerIndex ?? 0]}`}
          </strong>
          {q.explanation && <p>{q.explanation}</p>}
        </div>
      )}

      <div className="qz-actions">
        <button className="btn btn-secondary" onClick={onPrevious} disabled={index === 0}>
          <ArrowLeft size={14} /> Previous
        </button>
        <button className="btn btn-primary qz-primary" onClick={onPrimary} disabled={primaryDisabled || busy}>
          {primaryLabel} <ArrowRight size={14} />
        </button>
      </div>
    </section>
  );
}
