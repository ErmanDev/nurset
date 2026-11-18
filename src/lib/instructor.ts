// Clinical instructor tools: types + typed wrappers for the Rust commands
// in src-tauri/src/commands/ci_*.rs.
import { call as invoke, openFrom, type FileLink } from "./client";

export interface MyStudent {
  studentId: number;
  fullName: string;
  groupId: number;
  groupName: string;
}

export interface DutyAssignment {
  id: number;
  groupId: number;
  groupName: string;
  groupColor: string;
  area: string;
  hospital: string;
  location: string | null;
  dutyDate: string;
  startTime: string;
  endTime: string;
  notes: string | null;
  studentCount: number;
}

export interface DutyAssignmentInput {
  groupId: number;
  area: string;
  hospital: string;
  location: string | null;
  dutyDate: string;
  startTime: string;
  endTime: string;
  notes: string | null;
}

export interface RequirementAssignment {
  id: number;
  groupId: number;
  groupName: string;
  groupColor: string;
  title: string;
  description: string | null;
  dueDate: string;
  total: number;
  submitted: number;
  approved: number;
}

export type DocStatus = "pending" | "under_review" | "approved" | "needs_revision";

export interface ReviewDocument {
  documentId: number;
  studentId: number;
  studentName: string;
  groupName: string | null;
  title: string;
  documentType: string | null;
  fileName: string;
  notes: string | null;
  requirementTitle: string | null;
  status: DocStatus;
  submittedAt: string;
  feedback: string | null;
  feedbackAt: string | null;
  hasFile: boolean;
}

export interface Instruction {
  id: number;
  title: string;
  content: string;
  clinicalArea: string | null;
  noteDate: string;
  isImportant: boolean;
  groupId: number | null;
  studentId: number | null;
  audience: string;
  recipients: number;
  createdAt: string;
}

export interface InstructionInput {
  title: string;
  content: string;
  clinicalArea: string | null;
  noteDate: string;
  isImportant: boolean;
  groupId: number | null;
  studentId: number | null;
}

export type AttendanceStatus = "present" | "late" | "absent" | "excused";

export interface DutyDayRow {
  dutyId: number;
  studentId: number;
  studentName: string;
  groupName: string | null;
  area: string;
  hospital: string;
  startTime: string;
  endTime: string;
  readinessDone: number;
  attendance: AttendanceStatus | null;
  timeIn: string | null;
  remarks: string | null;
}

export interface EvaluationRow {
  dutyId: number;
  studentId: number;
  studentName: string;
  groupName: string | null;
  area: string;
  dutyDate: string;
  startTime: string;
  endTime: string;
  scheduledMinutes: number;
  attendance: AttendanceStatus | null;
  evaluated: boolean;
  knowledge: number | null;
  skills: number | null;
  professionalism: number | null;
  communication: number | null;
  comments: string | null;
  verifiedMinutes: number | null;
}

export interface HoursSummary {
  studentId: number;
  studentName: string;
  groupName: string | null;
  completedDuties: number;
  evaluated: number;
  verifiedMinutes: number;
  averageRating: number | null;
}

export interface EvaluationInput {
  knowledge: number;
  skills: number;
  professionalism: number;
  communication: number;
  comments: string | null;
  verifiedMinutes: number;
}

export type AnnouncementCategory = "important" | "academic" | "reminder";

export interface CiAnnouncement {
  id: number;
  category: AnnouncementCategory;
  title: string;
  body: string;
  postedAt: string;
  groupId: number | null;
  audience: string;
}

export const ciApi = {
  listMyStudents: () => invoke<MyStudent[]>("list_my_students"),

  listDutyAssignments: () => invoke<DutyAssignment[]>("list_duty_assignments"),
  createDutyAssignment: (input: DutyAssignmentInput) => invoke<DutyAssignment>("create_duty_assignment", { input }),
  updateDutyAssignment: (id: number, input: DutyAssignmentInput) =>
    invoke<DutyAssignment>("update_duty_assignment", { id, input }),
  deleteDutyAssignment: (id: number) => invoke<void>("delete_duty_assignment", { id }),

  listRequirementAssignments: () => invoke<RequirementAssignment[]>("list_requirement_assignments"),
  createRequirementAssignment: (input: { groupId: number; title: string; description: string | null; dueDate: string }) =>
    invoke<RequirementAssignment>("create_requirement_assignment", { input }),
  deleteRequirementAssignment: (id: number) => invoke<void>("delete_requirement_assignment", { id }),

  /** status: "open" (default), "all", or a single status. */
  listReviews: (status?: string) => invoke<ReviewDocument[]>("list_reviews", { status }),
  reviewDocument: (id: number, status: "under_review" | "approved" | "needs_revision", feedback?: string | null) =>
    invoke<void>("review_document", { id, status, feedback }),
  openReviewDocument: (id: number) => openFrom(() => invoke<FileLink>("open_review_document", { id })),

  listInstructions: () => invoke<Instruction[]>("list_instructions"),
  createInstruction: (input: InstructionInput) => invoke<Instruction>("create_instruction", { input }),
  deleteInstruction: (id: number) => invoke<void>("delete_instruction", { id }),

  getDutyDay: (date?: string) => invoke<DutyDayRow[]>("get_duty_day", { date }),
  setAttendance: (dutyId: number, input: { status: AttendanceStatus; timeIn: string | null; remarks: string | null }) =>
    invoke<void>("set_attendance", { dutyId, input }),
  getEvaluations: () => invoke<{ duties: EvaluationRow[]; students: HoursSummary[] }>("get_evaluations"),
  saveEvaluation: (dutyId: number, input: EvaluationInput) => invoke<void>("save_evaluation", { dutyId, input }),

  listAnnouncements: () => invoke<CiAnnouncement[]>("list_ci_announcements"),
  createAnnouncement: (input: { category: AnnouncementCategory; title: string; body: string; groupId: number | null }) =>
    invoke<CiAnnouncement>("create_announcement", { input }),
  deleteAnnouncement: (id: number) => invoke<void>("delete_announcement", { id }),
};

/** "8h", "7h 30m" */
export function formatMinutes(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m}m`;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}
