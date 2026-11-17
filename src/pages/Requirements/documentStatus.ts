import type { DocumentStatus } from "../../lib/types";

export type StatusTone = "blue" | "green" | "amber" | "red";

export const statusInfo: Record<DocumentStatus, { label: string; tone: StatusTone }> = {
  pending: { label: "Pending Review", tone: "amber" },
  under_review: { label: "Under Review", tone: "blue" },
  approved: { label: "Approved", tone: "green" },
  needs_revision: { label: "Needs Revision", tone: "red" },
};

/** Summary-card buckets. "Pending" covers both pending and under review. */
export type StatusGroup = "pending" | "approved" | "needs_revision";

export function statusGroup(status: DocumentStatus): StatusGroup {
  return status === "under_review" ? "pending" : status;
}
