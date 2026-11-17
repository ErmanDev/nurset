import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router";
import { ChevronLeft, Sparkles } from "lucide-react";
import Modal from "../../../components/Modal/Modal";
import type { PremiumPlan } from "../../../lib/types";
import { PLANS, isPlan, peso } from "./plans";
import "../Settings.css";

export default function PlanPage() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const initial = params.get("plan");
  const [plan, setPlan] = useState<PremiumPlan>(isPlan(initial) ? initial : "monthly");
  const [confirming, setConfirming] = useState(false);
  const p = PLANS[plan];

  return (
    <div className="pm">
      <Link to="/settings/subscription" className="pm-back">
        <ChevronLeft size={15} /> Back
      </Link>

      <div className="pm-center">
        <p className="pm-eyebrow">NurSet Premium · Prototype</p>
        <h1>Choose a plan that works for you.</h1>
        <p className="pm-sub">Get every Premium study tool with simple, transparent pricing.</p>

        <div className="pm-plans" role="radiogroup" aria-label="Plan">
          {(Object.keys(PLANS) as PremiumPlan[]).map((id) => (
            <button
              key={id}
              role="radio"
              aria-checked={plan === id}
              className={`pm-plan${plan === id ? " is-active" : ""}`}
              onClick={() => setPlan(id)}
            >
              <span className="pm-plan-name">{PLANS[id].label}</span>
              <span className="pm-plan-price">
                {peso(PLANS[id].cents)} <small>/ {PLANS[id].per}</small>
              </span>
              <span className="pm-plan-note">{PLANS[id].note}</span>
            </button>
          ))}
        </div>

        <div className="pm-actions">
          <button className="btn btn-primary pm-continue" onClick={() => setConfirming(true)}>
            Continue with {p.label}
          </button>
        </div>
      </div>

      {confirming && (
        <Modal
          open
          onClose={() => setConfirming(false)}
          title={`Confirm ${p.label} Premium plan`}
          width={460}
          footer={
            <>
              <button className="btn btn-secondary" onClick={() => setConfirming(false)} data-modal-cancel>
                Go Back
              </button>
              <button className="btn btn-primary" onClick={() => navigate(`/settings/premium/checkout?plan=${plan}`)}>
                Continue to Checkout
              </button>
            </>
          }
        >
          <div className="pm-confirm">
            <span className="pm-confirm-icon">
              <Sparkles size={20} />
            </span>
            <p>
              You're continuing to a fictional prototype checkout for {peso(p.cents)}/{p.per}. No real payment will be
              processed.
            </p>
          </div>
        </Modal>
      )}
    </div>
  );
}
