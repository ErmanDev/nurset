import { useState } from "react";
import { useNavigate } from "react-router";
import { Check, Sparkles } from "lucide-react";
import { api } from "../../../lib/api";
import { usePreferences } from "../../../lib/preferences";
import { useAsync } from "../../../hooks/useAsync";
import { formatLongDate, parseDateTime } from "../../../lib/format";
import ConfirmDialog from "../../../components/ConfirmDialog/ConfirmDialog";
import { PLANS, METHOD_LABELS, peso } from "../Premium/plans";
import { toast } from "../../../components/Toast/Toast";
import { PREMIUM_FEATURES } from "../../../lib/premium";

const features = PREMIUM_FEATURES;

export default function SubscriptionSection() {
  const navigate = useNavigate();
  const { get, reload } = usePreferences();
  const [tab, setTab] = useState<"premium" | "billing">("premium");
  const [confirmCancel, setConfirmCancel] = useState(false);
  const { data: receipts } = useAsync(api.listReceipts);
  const plan = get("premium_plan") as keyof typeof PLANS | "";
  const since = get("premium_since");

  return (
    <div className="st-section">
      <div className="st-tabs" role="tablist">
        <button role="tab" aria-selected={tab === "premium"} className={tab === "premium" ? "is-active" : ""} onClick={() => setTab("premium")}>
          NurSet Premium
        </button>
        <button role="tab" aria-selected={tab === "billing"} className={tab === "billing" ? "is-active" : ""} onClick={() => setTab("billing")}>
          Billing &amp; receipts
        </button>
      </div>

      {tab === "premium" && (
        <>
          <div className="st-premium-hero">
            <div>
              <span className="st-premium-pill">♡ NurSet Premium</span>
              <h2>Your Nursing Journey, Upgraded.</h2>
              <p>Unlock more powerful tools to study smarter and stay organized.</p>
            </div>
            <div className="st-premium-glass" aria-hidden="true">
              <Sparkles size={18} />
              <span>Study smarter</span>
            </div>
          </div>

          {plan && (
            <div className="st-current-plan">
              <Check size={16} /> You're on <strong>Premium {PLANS[plan].label}</strong>
              {since && ` since ${formatLongDate(since)}`} · prototype
            </div>
          )}

          <ul className="st-features">
            {features.map((f) => (
              <li key={f}>
                <Check size={14} /> {f}
              </li>
            ))}
          </ul>

          <div className="st-plans">
            {(Object.keys(PLANS) as (keyof typeof PLANS)[]).map((id) => {
              const p = PLANS[id];
              const current = plan === id;
              return (
                <div key={id} className={`st-plan${id === "yearly" ? " is-featured" : ""}`}>
                  {id === "yearly" && <span className="st-plan-tag">Best value</span>}
                  <p className="st-plan-name">{p.label}</p>
                  <p className="st-plan-price">
                    {peso(p.cents)} <small>/ {p.per}</small>
                  </p>
                  <p className="st-plan-note">{p.note}</p>
                  <button
                    className={`btn ${id === "yearly" ? "btn-primary" : "btn-secondary"} st-plan-btn`}
                    disabled={current}
                    onClick={() => navigate(`/settings/premium/plans?plan=${id}`)}
                  >
                    {current ? "Current plan" : `Select ${p.label}`}
                  </button>
                </div>
              );
            })}
          </div>
          <p className="st-note">Prototype pricing — no real payments are processed in this version of NurSet.</p>
        </>
      )}

      {tab === "billing" && (
        <>
          <div className="st-block">
            <div className="st-block-head">
              <div>
                <h3>Current plan</h3>
                <p className="st-muted">{plan ? `Premium ${PLANS[plan].label} (prototype)` : "Free plan"}</p>
              </div>
              {plan ? (
                <button className="btn btn-secondary" onClick={() => setConfirmCancel(true)}>
                  Cancel Premium
                </button>
              ) : (
                <button className="btn btn-primary" onClick={() => setTab("premium")}>
                  See plans
                </button>
              )}
            </div>
          </div>

          <div className="st-block">
            <h3>Receipts</h3>
            {receipts && receipts.length === 0 && <p className="empty-text">No receipts yet.</p>}
            {receipts?.map((r) => (
              <div key={r.id} className="st-row">
                <div>
                  <strong>
                    Premium {PLANS[r.plan].label} · {peso(r.amountCents)}
                  </strong>
                  <span>
                    {parseDateTime(r.createdAt).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
                    {" · "}
                    {METHOD_LABELS[r.method]} · Ref {r.reference}
                  </span>
                </div>
                <span className="badge badge--gray">Prototype · not charged</span>
              </div>
            ))}
          </div>
        </>
      )}

      <ConfirmDialog
        open={confirmCancel}
        title="Cancel Premium?"
        message="Premium features will be turned off. Your receipts stay in your billing history."
        confirmLabel="Cancel Premium"
        danger
        onClose={() => setConfirmCancel(false)}
        onConfirm={async () => {
          await api.cancelPremium();
          toast.deleted("Premium cancelled", "You're back on the Free plan.");
          await reload();
          setConfirmCancel(false);
        }}
      />
    </div>
  );
}
