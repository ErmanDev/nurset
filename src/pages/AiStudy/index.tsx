import { ArrowRight, ChevronRight, ClipboardList, Sparkles } from "lucide-react";
import { Link, useNavigate } from "react-router";
import { api } from "../../lib/api";
import { parseDateTime } from "../../lib/format";
import { useAsync } from "../../hooks/useAsync";
import { activityIcon } from "./shared";
import "./AiStudy.css";

const loadActivity = () => api.listStudyActivity(5);

function activityTime(ts: string): string {
  const d = parseDateTime(ts);
  const time = d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  const isToday = d.toDateString() === new Date().toDateString();
  return isToday ? time : `${d.toLocaleDateString("en-US", { month: "short", day: "numeric" })}, ${time}`;
}

export default function AiStudy() {
  const navigate = useNavigate();
  const { data: activity, error } = useAsync(loadActivity);

  return (
    <div className="ai-hub">
      <header className="card ai-hub-header">
        <p className="eyebrow">Your learning space</p>
        <h1>AI Study</h1>
        <p>Create, manage, and take quizzes with ease</p>
      </header>

      <div className="ai-hub-cards">
        <section className="ai-hub-assistant">
          <p className="ai-hub-eyebrow">AI Study Assistant</p>
          <h2>Ask Anything, Learn Faster</h2>
          <p>Get instant help with your questions, concepts, and study plans</p>
          <button className="ai-hub-btn ai-hub-btn--glass" onClick={() => navigate("/ai-study/chat")}>
            <Sparkles size={16} /> Start Chat
          </button>
        </section>

        <section className="card ai-hub-quiz">
          <p className="ai-hub-eyebrow ai-hub-eyebrow--blue">Quiz Maker</p>
          <h2>Create a Quiz, Test Your Knowledge</h2>
          <p>Build practice quizzes from your nursing notes</p>
          <button className="ai-hub-btn ai-hub-btn--solid" onClick={() => navigate("/ai-study/quizlab")}>
            Create Quiz
          </button>
        </section>
      </div>

      <section className="card ai-activity">
        <header className="ai-activity-head">
          <span className="ai-activity-head-icon">
            <ClipboardList size={18} />
          </span>
          <h3>Recent Study Activity</h3>
          <Link to="/ai-study/quizlab" className="text-link ai-activity-all">
            View all <ArrowRight size={13} />
          </Link>
        </header>

        {error && <div className="alert-error">{error}</div>}
        {!activity && !error && <div className="skeleton" style={{ height: 160, margin: "8px 20px 16px" }} />}
        {activity && activity.length === 0 && (
          <p className="empty-text" style={{ padding: "12px 22px 18px" }}>
            Start a chat or create a quiz to see your activity here.
          </p>
        )}

        {activity?.map((a) => {
          const { icon: Icon, tone } = activityIcon[a.kind];
          return (
            <button key={a.id} className="ai-activity-row" onClick={() => a.link && navigate(a.link)}>
              <span className={`ai-activity-icon ai-tone--${tone}`}>
                <Icon size={18} />
              </span>
              <span className="ai-activity-text">
                <span className="ai-activity-title">
                  {a.title} <span className="ai-tag">AI Study</span>
                </span>
                {a.subtitle && <span className="ai-activity-sub">{a.subtitle}</span>}
              </span>
              <span className="ai-activity-time">{activityTime(a.createdAt)}</span>
              <ChevronRight size={18} className="ai-activity-chevron" />
            </button>
          );
        })}
      </section>
    </div>
  );
}
