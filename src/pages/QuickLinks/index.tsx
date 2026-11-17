import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router";
import { ArrowRight, BookOpen, BookMarked, CircleHelp, Megaphone, Search, Upload, type LucideIcon } from "lucide-react";
import "./QuickLinks.css";

const features: { to: string; title: string; text: string; icon: LucideIcon; tone: string }[] = [
  {
    to: "/quick-links/learning-hub",
    title: "Learning Hub",
    text: "Explore nursing notes, reviewers, and study guides in your library",
    icon: BookOpen,
    tone: "blue",
  },
  {
    to: "/quick-links/upload",
    title: "Upload Materials",
    text: "Add your nursing notes, reviewers, and study resources",
    icon: Upload,
    tone: "purple",
  },
  {
    to: "/quick-links/announcements",
    title: "Announcements",
    text: "Stay updated with school news, important notices, and nursing program events",
    icon: Megaphone,
    tone: "green",
  },
  {
    to: "/quick-links/handbook",
    title: "Student Handbook",
    text: "Find student guidelines, academic policies, program requirements, and useful school information",
    icon: BookMarked,
    tone: "peach",
  },
  {
    to: "/quick-links/help",
    title: "Help & Support",
    text: "Get assistance with using NurSet, accessing resources, and finding answers to common questions",
    icon: CircleHelp,
    tone: "pink",
  },
];

export default function QuickLinks() {
  const navigate = useNavigate();
  const [query, setQuery] = useState("");

  function search(e: FormEvent) {
    e.preventDefault();
    const q = query.trim();
    navigate(q ? `/quick-links/learning-hub?q=${encodeURIComponent(q)}` : "/quick-links/learning-hub");
  }

  return (
    <div className="ql">
      <header className="ql-banner">
        <div>
          <h1>Quick Links</h1>
          <p>Your essential nursing resources, all in one place</p>
        </div>
        <span className="ql-banner-orb" aria-hidden="true" />
        <span className="ql-banner-dot" aria-hidden="true" />
      </header>

      <form className="ql-search" onSubmit={search} role="search">
        <Search size={16} />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search nursing resources and study materials…"
          aria-label="Search nursing resources"
        />
        <button type="submit" className="btn btn-primary">
          Search
        </button>
      </form>

      <section>
        <h2 className="ql-section-title">Explore Features</h2>
        <p className="ql-section-sub">Jump into the tools and resources you need for your nursing journey</p>
        <div className="ql-features">
          {features.map(({ to, title, text, icon: Icon, tone }) => (
            <button key={to} className={`ql-feature ql-feature--${tone}`} onClick={() => navigate(to)}>
              <span className="ql-feature-icon">
                <Icon size={18} />
              </span>
              <strong>{title}</strong>
              <span className="ql-feature-text">{text}</span>
              <ArrowRight size={18} className="ql-feature-arrow" />
            </button>
          ))}
        </div>
      </section>
    </div>
  );
}
