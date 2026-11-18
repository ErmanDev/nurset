import { useState, type ReactNode } from "react";
import { NavLink, useNavigate, useParams } from "react-router";
import {
  Bell,
  BookOpenCheck,
  ChevronRight,
  CircleHelp,
  CreditCard,
  MonitorSmartphone,
  Palette,
  Search,
  ShieldCheck,
  Sparkles,
  User,
  type LucideIcon,
} from "lucide-react";
import { usePreferences } from "../../lib/preferences";
import { api } from "../../lib/api";
import { useAsync } from "../../hooks/useAsync";
import AppearanceSection from "./sections/AppearanceSection";
import AccountSection from "./sections/AccountSection";
import NotificationsSection from "./sections/NotificationsSection";
import PrivacySection from "./sections/PrivacySection";
import SubscriptionSection from "./sections/SubscriptionSection";
import StudyPreferencesSection from "./sections/StudyPreferencesSection";
import DevicesSection from "./sections/DevicesSection";
import HelpSection from "./sections/HelpSection";
import "./Settings.css";

interface Section {
  id: string;
  label: string;
  icon: LucideIcon;
  /** Extra words for the settings search. */
  keywords: string;
  render: () => ReactNode;
}

const sections: Section[] = [
  { id: "appearance", label: "Appearance", icon: Palette, keywords: "theme dark light accent color font size density layout", render: () => <AppearanceSection /> },
  { id: "account", label: "Account", icon: User, keywords: "profile name email picture photo password university student", render: () => <AccountSection /> },
  { id: "notifications", label: "Notifications", icon: Bell, keywords: "reminders alerts quiet hours email deadlines", render: () => <NotificationsSection /> },
  { id: "privacy", label: "Privacy & Security", icon: ShieldCheck, keywords: "password two-factor sessions export delete data", render: () => <PrivacySection /> },
  { id: "subscription", label: "Subscription & Billing", icon: CreditCard, keywords: "premium plan billing receipts payment", render: () => <SubscriptionSection /> },
  { id: "study", label: "Study Preferences", icon: BookOpenCheck, keywords: "goal quiz questions tips study", render: () => <StudyPreferencesSection /> },
  { id: "devices", label: "Connected Devices", icon: MonitorSmartphone, keywords: "device sync computer", render: () => <DevicesSection /> },
  { id: "help", label: "Help & Support", icon: CircleHelp, keywords: "faq support contact version", render: () => <HelpSection /> },
];

const STUDENT_ONLY = ["subscription", "study"];

export default function Settings() {
  const { section = "appearance" } = useParams();
  const navigate = useNavigate();
  const { get } = usePreferences();
  const { data: profile } = useAsync(api.getProfile);
  const [query, setQuery] = useState("");

  // Instructors don't get the student-only sections (Premium, study preferences).
  const isInstructor = profile?.accountType === "clinical_instructor";
  const available = isInstructor ? sections.filter((s) => !STUDENT_ONLY.includes(s.id)) : sections;

  const q = query.trim().toLowerCase();
  const visible = q
    ? available.filter((s) => `${s.label} ${s.keywords}`.toLowerCase().includes(q))
    : available;
  const active = available.find((s) => s.id === section) ?? available[0];
  const premium = get("premium_plan") || isInstructor;

  return (
    <div className="st">
      <div className="st-header">
        <header className="page-header page-header--plain">
          <h1>Settings</h1>
          <p>Manage your account, personalize your workspace, and configure your NurSet experience.</p>
        </header>
        <label className="st-search">
          <Search size={15} />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && visible[0]) navigate(`/settings/${visible[0].id}`);
            }}
            placeholder="Search settings…"
            aria-label="Search settings"
          />
        </label>
      </div>

      <div className="st-grid">
        <aside className="st-side">
          <nav className="card st-nav" aria-label="Settings sections">
            <p className="st-nav-title">Settings</p>
            {visible.length === 0 && <p className="empty-text">No matching settings.</p>}
            {visible.map(({ id, label, icon: Icon }) => (
              <NavLink
                key={id}
                to={`/settings/${id}`}
                className={() => `st-nav-link${active.id === id ? " is-active" : ""}`}
              >
                <Icon size={15} />
                <span>{label}</span>
                {active.id === id && <ChevronRight size={14} />}
              </NavLink>
            ))}
            {!premium && (
              <div className="st-promo">
                <Sparkles size={16} />
                <strong>Unlock your full potential</strong>
                <span>Get advanced study tools with Premium.</span>
                <button className="text-link" onClick={() => navigate("/settings/subscription")}>
                  Explore Premium
                </button>
              </div>
            )}
          </nav>
        </aside>

        <section className="card st-content" aria-label={active.label}>
          {active.render()}
        </section>
      </div>
    </div>
  );
}

