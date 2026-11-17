import type { PaymentMethod, PremiumPlan } from "../../../lib/types";

/** Prototype pricing (no real payments). Amounts in centavos. */
export const PLANS: Record<PremiumPlan, { label: string; cents: number; per: string; note: string }> = {
  monthly: { label: "Monthly", cents: 14_900, per: "month", note: "Flexible access, billed monthly." },
  yearly: { label: "Yearly", cents: 129_900, per: "year", note: "Save ₱489 annually. Just ₱108/month." },
};

export const METHOD_LABELS: Record<PaymentMethod, string> = {
  gcash: "GCash",
  maya: "Maya",
  card: "Visa / Mastercard",
  bank: "Online Banking",
  other: "Other",
};

export function peso(cents: number): string {
  return `₱${(cents / 100).toLocaleString("en-PH", { maximumFractionDigits: 0 })}`;
}

export function isPlan(v: string | null): v is PremiumPlan {
  return v === "monthly" || v === "yearly";
}
