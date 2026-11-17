import { useState, type FormEvent } from "react";
import { BookOpen, Check, ChevronRight, Plus, Sparkles, type LucideIcon } from "lucide-react";
import { Link, useNavigate } from "react-router";

const chat = (prompt: string) => `/ai-study/chat?prompt=${encodeURIComponent(prompt)}`;

interface StudyAction {
  to: string;
  label: string;
  icon: LucideIcon;
}

const actions: StudyAction[] = [
  { to: chat("Make a reviewer on: "), label: "Make a Reviewer", icon: Sparkles },
  { to: "/ai-study/quizlab", label: "Quiz Me", icon: Check },
  { to: chat("Create flashcards for: "), label: "Create Flashcards", icon: BookOpen },
  { to: chat("Explain this nursing topic in simple terms: "), label: "Explain a Topic", icon: Sparkles },
];

/**
 * Dashboard entry point to AI Study: actions open the assistant chat with a
 * starter prompt (?prompt=…), Quizlab, or the attachment menu (?attach=1).
 */
export default function AiStudyBanner() {
  const navigate = useNavigate();
  const [prompt, setPrompt] = useState("");

  function ask(e: FormEvent) {
    e.preventDefault();
    const q = prompt.trim();
    if (!q) return;
    navigate(`/ai-study/chat?prompt=${encodeURIComponent(q)}&send=1`);
  }

  return (
    <section className="ai-study">
      <div className="ai-panel">
        <div className="ai-panel-head">
          <span className="ai-panel-icon">
            <Sparkles size={22} />
          </span>
          <div>
            <p className="ai-panel-eyebrow">NurSet AI</p>
            <h2 className="ai-panel-title">Your AI Study Assistant</h2>
          </div>
          <button className="ai-pill" onClick={() => navigate("/ai-study")}>
            Study Smarter
          </button>
        </div>

        <p className="ai-panel-prompt">What would you like to study today?</p>

        <div className="ai-actions">
          {actions.map(({ to, label, icon: Icon }) => (
            <button
              key={label}
              className="ai-action"
              onClick={() => navigate(to)}
            >
              <Icon size={18} strokeWidth={2} />
              <span>{label}</span>
            </button>
          ))}
        </div>

        <div className="ai-inputs">
          <button className="ai-upload" onClick={() => navigate("/ai-study/chat?attach=1")}>
            <span className="ai-upload-icon">
              <Plus size={16} />
            </span>
            <span>
              <strong>Upload Study Material</strong>
              <small>PDF, PPT, DOC, or personal notes</small>
            </span>
          </button>

          <form className="ai-ask" onSubmit={ask}>
            <Sparkles size={14} className="ai-ask-icon" />
            <input
              value={prompt}
              placeholder="Ask about your study material..."
              onChange={(e) => setPrompt(e.target.value)}
              aria-label="Ask NurSet AI"
            />
            <button type="submit" className="ai-send" aria-label="Send" disabled={!prompt.trim()}>
              <ChevronRight size={18} />
            </button>
          </form>
        </div>
      </div>

      <div className="ai-study-footer">
        <p>Educational support only—not for clinical decision-making.</p>
        <Link to="/ai-study" className="text-link">
          Open AI Study <ChevronRight size={13} />
        </Link>
      </div>
    </section>
  );
}
