import { CalendarDays, ClipboardCheck, Sparkles } from "lucide-react";
import { Outlet } from "react-router";
import Logo from "../components/Logo/Logo";
import "./AuthLayout.css";

const highlights = [
  { icon: CalendarDays, title: "Never miss a duty", text: "Your schedule, areas, and CI in one place." },
  { icon: ClipboardCheck, title: "Show up prepared", text: "Checklists and deadlines that keep you ready." },
  { icon: Sparkles, title: "Study smarter", text: "AI reviewers, quizzes, and flashcards." },
];

/** Split screen for the signed-out pages: brand panel left, form right. */
export default function AuthLayout() {
  return (
    <div className="auth-shell">
      <aside className="auth-hero">
        <Logo variant="light" />

        <div className="auth-hero-body">
          <p className="auth-hero-eyebrow">For nursing students</p>
          <h1>Every duty, prepared.</h1>
          <p className="auth-hero-lead">
            NurSet keeps your clinical schedule, requirements, and review materials organized so
            you can focus on your patients.
          </p>

          <ul className="auth-highlights">
            {highlights.map(({ icon: Icon, title, text }) => (
              <li key={title}>
                <span className="auth-highlight-icon">
                  <Icon size={17} />
                </span>
                <span>
                  <strong>{title}</strong>
                  <small>{text}</small>
                </span>
              </li>
            ))}
          </ul>
        </div>

        <p className="auth-hero-foot">© {new Date().getFullYear()} NurSet</p>
      </aside>

      <main className="auth-main">
        <div className="auth-card">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
