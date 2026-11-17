import { useState, type FormEvent } from "react";
import { Link, useNavigate, useSearchParams } from "react-router";
import { ChevronLeft, CircleCheck } from "lucide-react";
import { api } from "../../../lib/api";
import { usePreferences } from "../../../lib/preferences";
import type { PaymentMethod, Receipt } from "../../../lib/types";
import { METHOD_LABELS, PLANS, isPlan, peso } from "./plans";
import "../Settings.css";

const methods: { id: PaymentMethod; mark: string }[] = [
  { id: "gcash", mark: "G" },
  { id: "maya", mark: "M" },
  { id: "card", mark: "VISA" },
  { id: "bank", mark: "BANK" },
  { id: "other", mark: "…" },
];

/** PH mobile number: 09XXXXXXXXX or +639XXXXXXXXX (spaces/dashes ignored). */
function validMobile(value: string): boolean {
  return /^(\+63|0)9\d{9}$/.test(value.replace(/[\s-]/g, ""));
}

/**
 * Prototype checkout. Nothing is charged: the mobile number is only checked
 * for format and is never sent to the backend or stored.
 */
export default function CheckoutPage() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const { reload } = usePreferences();
  const planParam = params.get("plan");
  const plan = isPlan(planParam) ? planParam : "monthly";
  const p = PLANS[plan];

  const [method, setMethod] = useState<PaymentMethod>("gcash");
  const [mobile, setMobile] = useState("");
  const [mobileError, setMobileError] = useState<string | undefined>();
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [receipt, setReceipt] = useState<Receipt | null>(null);

  const wallet = method === "gcash" || method === "maya";

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (wallet && !validMobile(mobile)) {
      setMobileError("Enter a mobile number like 0917 123 4567.");
      return;
    }
    setProcessing(true);
    setError(null);
    try {
      await new Promise((r) => setTimeout(r, 900)); // simulated processing
      const r = await api.activatePremium(plan, method);
      setMobile(""); // don't keep it around
      await reload();
      setReceipt(r);
    } catch (err) {
      setError(String(err));
    } finally {
      setProcessing(false);
    }
  }

  if (receipt) {
    return (
      <div className="pm">
        <div className="card pm-success">
          <CircleCheck size={44} />
          <h1>You're now on Premium!</h1>
          <p>
            Prototype purchase complete — nothing was charged. Reference <strong>{receipt.reference}</strong>.
          </p>
          <div className="pm-actions pm-actions--center">
            <button className="btn btn-secondary" onClick={() => navigate("/")}>
              Back to Dashboard
            </button>
            <button className="btn btn-primary" onClick={() => navigate("/settings/subscription")}>
              View Billing
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="pm">
      <Link to={`/settings/premium/plans?plan=${plan}`} className="pm-back">
        <ChevronLeft size={15} /> Back
      </Link>

      <div className="pm-checkout">
        <form className="card pm-pay" onSubmit={submit} noValidate>
          <p className="pm-eyebrow">Payment method</p>
          <h1>Complete your prototype purchase</h1>
          <p className="pm-sub pm-sub--strong">Select a fictional payment option. No real payment details are stored.</p>

          {error && <div className="alert-error">{error}</div>}

          <div className="pm-methods" role="radiogroup" aria-label="Payment method">
            {methods.map((m) => (
              <button
                key={m.id}
                type="button"
                role="radio"
                aria-checked={method === m.id}
                className={`pm-method${method === m.id ? " is-active" : ""}`}
                onClick={() => {
                  setMethod(m.id);
                  setMobileError(undefined);
                }}
              >
                <strong>{m.mark}</strong>
                <span>{METHOD_LABELS[m.id]}</span>
              </button>
            ))}
          </div>

          <div className="pm-method-body">
            <h2>{METHOD_LABELS[method]} checkout</h2>
            {wallet ? (
              <label className={`pm-field${mobileError ? " has-error" : ""}`}>
                Mobile number
                <input
                  inputMode="tel"
                  placeholder="+63 9XX XXX XXXX"
                  value={mobile}
                  autoComplete="off"
                  onChange={(e) => {
                    setMobile(e.target.value);
                    setMobileError(undefined);
                  }}
                />
                {mobileError && <span className="field-error">{mobileError}</span>}
              </label>
            ) : (
              <p className="pm-hint">
                {method === "card"
                  ? "Card entry is turned off in this prototype — no card details are needed."
                  : method === "bank"
                    ? "In a real checkout you'd be sent to your bank. Here it's simulated."
                    : "Other payment options are simulated in this prototype."}
              </p>
            )}
          </div>

          <button type="submit" className="btn btn-primary pm-submit" disabled={processing}>
            {processing
              ? "Processing…"
              : wallet
                ? `Continue to ${METHOD_LABELS[method]}`
                : "Complete prototype purchase"}
          </button>
        </form>

        <aside className="card pm-summary">
          <p className="pm-eyebrow">Order summary</p>
          <strong>NurSet Premium</strong>
          <span className="pm-muted">{p.label} subscription</span>
          <div className="pm-lines">
            <div>
              <span>Subtotal</span>
              <span>{peso(p.cents)}</span>
            </div>
            <div>
              <span>Tax</span>
              <span>Included</span>
            </div>
          </div>
          <div className="pm-total">
            <span>Total</span>
            <span>{peso(p.cents)}</span>
          </div>
        </aside>
      </div>
    </div>
  );
}
