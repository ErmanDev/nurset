// Mirrors the Rust structs in src-tauri/src/models.rs (serialized as camelCase).
// Dates are "YYYY-MM-DD", times "HH:MM", timestamps "YYYY-MM-DD HH:MM:SS".

export interface Profile {
  id: number;
  fullName: string;
  displayName: string;
  role: string;
  avatarPath: string | null;
  email: string | null;
  university: string | null;
  studentId: string | null;
  yearLevel: string | null;
  /** Small data:image/... URL. */
  avatarData: string | null;
  accountType: AccountType;
}

export type AccountType = "student" | "clinical_instructor";

export interface ProfileInput {
  fullName: string;
  displayName: string;
  email: string | null;
  university: string | null;
  studentId: string | null;
  yearLevel: string | null;
}

export type PremiumPlan = "monthly" | "yearly";
export type PaymentMethod = "gcash" | "maya" | "card" | "bank" | "other";

/** Prototype receipt — no real payment. */
export interface Receipt {
  id: number;
  plan: PremiumPlan;
  amountCents: number;
  method: PaymentMethod;
  reference: string;
  createdAt: string;
}

export interface Duty {
  id: number;
  area: string;
  hospital: string;
  location: string | null;
  dutyDate: string;
  startTime: string;
  endTime: string;
  clinicalInstructor: string | null;
  notes: string | null;
}

export type NewDuty = Omit<Duty, "id">;

export type EventType = "exam" | "other";

/** Calendar event that isn't a clinical duty. */
export interface ScheduleEvent {
  id: number;
  title: string;
  eventType: EventType;
  eventDate: string;
  startTime: string | null;
  endTime: string | null;
  location: string | null;
  description: string | null;
}

export type NewScheduleEvent = Omit<ScheduleEvent, "id">;

export type DocumentStatus = "pending" | "under_review" | "approved" | "needs_revision";

/** A file submitted for instructor review. */
export interface SubmittedDocument {
  id: number;
  requirementId: number | null;
  requirementTitle: string | null;
  fileName: string;
  filePath: string | null;
  status: DocumentStatus;
  submittedAt: string;
  feedback: string | null;
  feedbackAt: string | null;
  reviewedBy: string | null;
  title: string | null;
  documentType: string | null;
  notes: string | null;
}

export interface DocumentUploadDetails {
  documentType: string;
  title: string;
  notes?: string;
}

export type RequirementStatus = "pending" | "in_progress" | "submitted";

export interface Requirement {
  id: number;
  title: string;
  description: string | null;
  dueDate: string;
  status: RequirementStatus;
  color: string;
}

export interface Task {
  id: number;
  title: string;
  category: string;
  durationMinutes: number | null;
  dueDate: string;
  completed: boolean;
  completedAt: string | null;
  dueTime: string | null;
  priority: TaskPriority;
  subject: string | null;
  notes: string | null;
}

export type TaskPriority = "high" | "medium" | "low";

/** Input for add/update. Only `title` is required. */
export interface NewTask {
  title: string;
  category?: string;
  durationMinutes?: number | null;
  dueDate?: string;
  dueTime?: string | null;
  priority?: TaskPriority;
  subject?: string | null;
  notes?: string | null;
}

export interface ChecklistSummary {
  id: number;
  name: string;
  dutyId: number | null;
  total: number;
  checked: number;
}

export interface ChecklistItem {
  id: number;
  checklistId: number;
  label: string;
  checked: boolean;
  position: number;
}

/** A checklist with its items (Duty Checklist page). */
export interface ChecklistDetail {
  id: number;
  name: string;
  kind: "bag" | "rotation";
  dutyId: number | null;
  area: string | null;
  items: ChecklistItem[];
}

export interface RequirementReadiness {
  id: number;
  title: string;
  dueDate: string;
  /** A document has been submitted for it. */
  ready: boolean;
}

export type ReadinessKey = "schedule" | "requirements" | "bag" | "ci";

export interface DutyPrep {
  duty: Duty | null;
  upcomingDuties: Duty[];
  bag: ChecklistDetail | null;
  rotationAreas: string[];
  requirements: RequirementReadiness[];
  ciReminder: CiNote | null;
  readiness: { key: ReadinessKey; checked: boolean }[];
}

export interface CiNote {
  id: number;
  title: string;
  content: string;
  isImportant: boolean;
  createdAt: string;
  clinicalInstructor: string | null;
  clinicalArea: string | null;
  /** "YYYY-MM-DD" the instruction was given. */
  noteDate: string | null;
  isPinned: boolean;
  dutyId: number | null;
  /** Related duty, for display. */
  dutyArea: string | null;
  dutyDate: string | null;
}

export interface CiNoteInput {
  title: string;
  content: string;
  clinicalInstructor: string | null;
  clinicalArea: string | null;
  noteDate: string;
  isImportant: boolean;
  dutyId: number | null;
}

export interface QuickLink {
  id: number;
  label: string;
  url: string;
  position: number;
}

export interface WeeklyProgress {
  completed: number;
  pending: number;
  overdue: number;
}

export interface Dashboard {
  profile: Profile | null;
  nextDuty: Duty | null;
  upcomingDeadlines: Requirement[];
  todaysTasks: Task[];
  dutyBag: ChecklistSummary | null;
  weeklyProgress: WeeklyProgress;
  ciReminder: CiNote | null;
}

// ---------- AI Study ----------

export type QuestionKind = "multiple_choice" | "true_false" | "identification" | "case_based";

export interface QuizSummary {
  id: number;
  title: string;
  questionTypes: QuestionKind[];
  createdAt: string;
  completedAt: string | null;
  score: number | null;
  questionCount: number;
  answeredCount: number;
  correctCount: number;
}

/** `answerIndex` and `explanation` are only present once the question is answered. */
export interface QuizQuestion {
  id: number;
  position: number;
  kind: QuestionKind;
  prompt: string;
  caseText: string | null;
  /** Built-in diagram key, e.g. "heart:ra". */
  image: string | null;
  choices: string[];
  hint: string | null;
  chosenIndex: number | null;
  isCorrect: boolean | null;
  answerIndex: number | null;
  explanation: string | null;
}

export interface QuizDetail {
  quiz: QuizSummary;
  questions: QuizQuestion[];
}

export interface NewQuiz {
  topic: string;
  notes?: string | null;
  questionTypes: QuestionKind[];
  count: number;
}

export interface ChatMessage {
  id: number;
  role: "user" | "assistant";
  content: string;
  attachment: string | null;
  createdAt: string;
}

export interface StudyActivity {
  id: number;
  title: string;
  subtitle: string | null;
  kind: "review" | "quiz" | "care_plan" | "chat";
  link: string | null;
  createdAt: string;
}

// ---------- Progress ----------

export type ProgressRange = "week" | "month" | "all";

export interface Ratio {
  done: number;
  total: number;
}

export type RequirementProgressStatus = "submitted" | "approved" | "in_review" | "needs_revision" | "not_started";

export interface ProgressOverview {
  range: ProgressRange;
  categories: { tasks: Ratio; requirements: Ratio; dutyPrep: Ratio; study: Ratio };
  taskBreakdown: { completed: number; pending: number; overdue: number };
  requirements: { id: number; title: string; dueDate: string; status: RequirementProgressStatus }[];
  attention: { kind: "task" | "requirement" | "duty"; id: number; title: string; date: string; detail: string | null }[];
  weeklyActivity: { date: string; count: number }[];
  nextDuty: { duty: Duty; bag: Ratio; rotation: Ratio; requirements: Ratio; readiness: Ratio } | null;
  study: { quizzesCompleted: number; quizzesInProgress: number; chats: number; averageScore: number | null };
  recent: { kind: "task" | "quiz"; id: number; title: string; detail: string | null; completedAt: string }[];
}

// ---------- Quick Links ----------

export type MaterialKind = "pdf_notes" | "presentation" | "reviewer" | "handbook";

export interface Material {
  id: number;
  title: string;
  description: string | null;
  kind: MaterialKind;
  fileName: string | null;
  hasFile: boolean;
  fileSize: number | null;
  pageCount: number | null;
  tone: string;
  isSample: boolean;
  isMine: boolean;
  bookmarked: boolean;
  createdAt: string;
}

export interface MaterialDetails {
  title: string;
  kind: MaterialKind;
  description?: string | null;
}

export interface Announcement {
  id: number;
  category: "important" | "academic" | "reminder";
  title: string;
  body: string;
  postedAt: string;
}

export interface StudyJourney {
  sessionsToday: number;
  dailyGoal: number;
  streakDays: number;
}

// ---------- Clinical instructor ----------

export interface GroupSummary {
  id: number;
  name: string;
  area: string | null;
  hospital: string | null;
  term: string | null;
  color: string;
  memberCount: number;
  nextDutyDate: string | null;
  pendingReviews: number;
}

export interface GroupMember {
  studentId: number;
  fullName: string;
  email: string;
  studentNumber: string | null;
  yearLevel: string | null;
  avatarData: string | null;
  nextDutyId: number | null;
  nextDutyDate: string | null;
  nextDutyArea: string | null;
  /** "Before you go" checks done for the next duty, of 4. */
  readinessDone: number;
  pendingReviews: number;
  needsRevision: number;
  overdueTasks: number;
  requirementsDone: number;
  requirementsTotal: number;
}

export interface GroupDetail {
  group: GroupSummary;
  members: GroupMember[];
}

export interface GroupInput {
  name: string;
  area?: string | null;
  hospital?: string | null;
  term?: string | null;
  color?: string;
}

export interface CiDashboard {
  profile: Profile;
  stats: { students: number; groups: number; pendingReviews: number; onDutyToday: number };
  todayDuties: { area: string; hospital: string; startTime: string; endTime: string; students: number }[];
  pendingReviews: {
    documentId: number;
    studentId: number;
    studentName: string;
    title: string;
    documentType: string | null;
    status: string;
    submittedAt: string;
  }[];
  attention: {
    studentId: number;
    studentName: string;
    groupId: number;
    groupName: string;
    kind: "overdue" | "revision" | "not_ready";
    detail: string;
  }[];
  deadlines: { title: string; dueDate: string; submitted: number; total: number }[];
  groups: GroupSummary[];
}
