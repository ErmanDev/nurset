import type { ReactNode } from "react";
import { ArrowLeft, ClipboardList, MessageCircle, Pill, Stethoscope, type LucideIcon } from "lucide-react";
import { Link } from "react-router";
import type { QuestionKind, StudyActivity } from "../../lib/types";

export const kindInfo: Record<QuestionKind, { label: string; short: string; tone: string }> = {
  multiple_choice: { label: "Multiple Choice", short: "MC", tone: "pink" },
  true_false: { label: "True or False", short: "T/F", tone: "blue" },
  identification: { label: "Identification", short: "ID", tone: "purple" },
  case_based: { label: "Case-based", short: "Case", tone: "green" },
};

export const activityIcon: Record<StudyActivity["kind"], { icon: LucideIcon; tone: string }> = {
  review: { icon: Pill, tone: "red" },
  quiz: { icon: Stethoscope, tone: "green" },
  care_plan: { icon: ClipboardList, tone: "purple" },
  chat: { icon: MessageCircle, tone: "blue" },
};

/** Small "← Back" pill used at the top of the AI Study sub-pages. */
export function BackLink({ to }: { to: string }) {
  return (
    <Link to={to} className="ai-back">
      <ArrowLeft size={13} /> Back
    </Link>
  );
}

/** Shown wherever an AI result would appear, until a provider is connected. */
export function PreviewNote({ children }: { children: ReactNode }) {
  return <p className="ai-preview-note">{children}</p>;
}
