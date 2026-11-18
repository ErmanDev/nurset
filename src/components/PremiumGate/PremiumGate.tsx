import { Outlet, useLocation, useNavigate } from "react-router";
import { Check, Crown, Lock } from "lucide-react";
import { PREMIUM_FEATURES, usePremium } from "../../lib/premium";
import "./PremiumGate.css";

const FEATURES: { prefix: string; name: string; text: string }[] = [
  {
    prefix: "/ai-study",
    name: "AI Study",
    text: "Chat with the study assistant and practice with Quizlab quizzes built for nursing exams.",
  },
  {
    prefix: "/quick-links",
    name: "Quick Links",
    text: "Your Learning Hub, uploaded study materials, and the Nursing Student Handbook in one place.",
  },
];

/** Route wrapper: shows the page for Premium accounts, an upgrade screen otherwise. */
export default function PremiumGate() {
  const { premium, loaded } = usePremium();
  const { pathname } = useLocation();
  const navigate = useNavigate();

  if (!loaded) return null;
  if (premium) return <Outlet />;

  const feature = FEATURES.find((f) => pathname.startsWith(f.prefix)) ?? FEATURES[0];
  return (
    <div className="pg-gate">
      <div className="card pg-gate-card">
        <span className="pg-gate-icon">
          <Lock size={22} />
        </span>
        <p className="pg-gate-eyebrow">
          <Crown size={13} /> NurSet Premium
        </p>
        <h1>{feature.name} is a Premium feature</h1>
        <p className="pg-gate-text">{feature.text}</p>

        <ul className="pg-gate-list">
          {PREMIUM_FEATURES.map((f) => (
            <li key={f}>
              <Check size={15} /> {f}
            </li>
          ))}
        </ul>

        <div className="pg-gate-actions">
          <button className="btn btn-primary" onClick={() => navigate("/settings/premium/plans")}>
            <Crown size={15} /> Upgrade to Premium
          </button>
          <button className="btn btn-secondary" onClick={() => navigate("/")}>
            Back to Home
          </button>
        </div>
      </div>
    </div>
  );
}

/** Small crown chip for locked items (sidebar, settings). */
export function PremiumBadge({ label = "Premium" }: { label?: string }) {
  return (
    <span className="premium-badge" title="Premium feature">
      <Crown size={11} />
      {label && <span>{label}</span>}
    </span>
  );
}
