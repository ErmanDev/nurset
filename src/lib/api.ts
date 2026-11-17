// Typed wrappers around the Rust commands registered in src-tauri/src/lib.rs.
import { invoke } from "@tauri-apps/api/core";
import type {
  CiDashboard,
  GroupDetail,
  GroupInput,
  GroupSummary,
  PaymentMethod,
  PremiumPlan,
  ProfileInput,
  Receipt,
  Announcement,
  Material,
  MaterialDetails,
  StudyJourney,
  ProgressOverview,
  ProgressRange,
  ChatMessage,
  NewQuiz,
  QuizDetail,
  QuizQuestion,
  QuizSummary,
  StudyActivity,
  ChecklistDetail,
  ChecklistItem,
  DutyPrep,
  ReadinessKey,
  ChecklistSummary,
  CiNote,
  CiNoteInput,
  Dashboard,
  DocumentUploadDetails,
  Duty,
  NewDuty,
  NewScheduleEvent,
  NewTask,
  Profile,
  QuickLink,
  Requirement,
  ScheduleEvent,
  SubmittedDocument,
  Task,
} from "./types";

/**
 * Raw binary upload body (avoids sending files as JSON number arrays):
 * [u32 LE metadata length][metadata JSON incl. fileName][file bytes]
 */
async function packUpload(file: File, details: object): Promise<Uint8Array> {
  const meta = new TextEncoder().encode(JSON.stringify({ ...details, fileName: file.name }));
  const bytes = new Uint8Array(await file.arrayBuffer());
  const body = new Uint8Array(4 + meta.length + bytes.length);
  new DataView(body.buffer).setUint32(0, meta.length, true);
  body.set(meta, 4);
  body.set(bytes, 4 + meta.length);
  return body;
}

export const api = {
  /** TODO(auth): password isn't checked yet. */
  signIn: (identifier: string) => invoke<Profile>("sign_in", { identifier }),
  getDashboard: () => invoke<Dashboard>("get_dashboard"),

  // Clinical instructor
  getCiDashboard: () => invoke<CiDashboard>("get_ci_dashboard"),
  listGroups: () => invoke<GroupSummary[]>("list_groups"),
  getGroup: (id: number) => invoke<GroupDetail>("get_group", { id }),
  createGroup: (input: GroupInput) => invoke<GroupSummary>("create_group", { input }),
  updateGroup: (id: number, input: GroupInput) => invoke<GroupSummary>("update_group", { id, input }),
  deleteGroup: (id: number) => invoke<void>("delete_group", { id }),
  addGroupMember: (groupId: number, identifier: string) =>
    invoke<GroupDetail>("add_group_member", { groupId, identifier }),
  removeGroupMember: (groupId: number, studentId: number) =>
    invoke<GroupDetail>("remove_group_member", { groupId, studentId }),
  getProfile: () => invoke<Profile | null>("get_profile"),
  getProgress: (range: ProgressRange) => invoke<ProgressOverview>("get_progress", { range }),

  // Settings
  getSettings: () => invoke<Record<string, string>>("get_settings"),
  setSettings: (values: Record<string, string>) => invoke<void>("set_settings", { values }),
  updateProfile: (input: ProfileInput) => invoke<Profile>("update_profile", { input }),
  setAvatar: (data: string | null) => invoke<Profile>("set_avatar", { data }),
  /** Writes a JSON export to Downloads; returns its path. */
  exportData: () => invoke<string>("export_data"),
  /** Wipes all local data. `confirm` must be "DELETE". */
  resetAllData: (confirm: string) => invoke<void>("reset_all_data", { confirm }),
  listReceipts: () => invoke<Receipt[]>("list_receipts"),
  /** Prototype checkout: no payment is processed. */
  activatePremium: (plan: PremiumPlan, method: PaymentMethod) =>
    invoke<Receipt>("activate_premium", { plan, method }),
  cancelPremium: () => invoke<void>("cancel_premium"),

  listDuties: () => invoke<Duty[]>("list_duties"),
  addDuty: (input: NewDuty) => invoke<Duty>("add_duty", { input }),

  listEvents: () => invoke<ScheduleEvent[]>("list_events"),
  addEvent: (input: NewScheduleEvent) => invoke<ScheduleEvent>("add_event", { input }),

  listRequirements: () => invoke<Requirement[]>("list_requirements"),
  addRequirement: (input: { title: string; dueDate: string; description?: string | null }) =>
    invoke<Requirement>("add_requirement", { input }),
  listDocuments: () => invoke<SubmittedDocument[]>("list_documents"),
  uploadDocument: async (file: File, details: DocumentUploadDetails) =>
    invoke<SubmittedDocument>("upload_document", await packUpload(file, details)),

  listTasks: (date?: string) => invoke<Task[]>("list_tasks", { date }),
  addTask: (input: NewTask) => invoke<Task>("add_task", { input }),
  updateTask: (id: number, input: NewTask) => invoke<Task>("update_task", { id, input }),
  deleteTask: (id: number) => invoke<void>("delete_task", { id }),
  toggleTask: (id: number, completed: boolean) =>
    invoke<Task>("toggle_task", { id, completed }),

  listChecklists: () => invoke<ChecklistSummary[]>("list_checklists"),
  listChecklistItems: (checklistId: number) =>
    invoke<ChecklistItem[]>("list_checklist_items", { checklistId }),

  // Duty Checklist page
  getDutyPrep: (dutyId?: number) => invoke<DutyPrep>("get_duty_prep", { dutyId }),
  getRotationChecklist: (area: string) => invoke<ChecklistDetail>("get_rotation_checklist", { area }),
  addChecklistItem: (checklistId: number, label: string) =>
    invoke<ChecklistItem>("add_checklist_item", { checklistId, label }),
  toggleChecklistItem: (id: number, checked: boolean) =>
    invoke<ChecklistItem>("toggle_checklist_item", { id, checked }),
  deleteChecklistItem: (id: number) => invoke<void>("delete_checklist_item", { id }),
  setDutyReadiness: (dutyId: number, key: ReadinessKey, checked: boolean) =>
    invoke<void>("set_duty_readiness", { dutyId, key, checked }),

  listCiNotes: () => invoke<CiNote[]>("list_ci_notes"),
  addCiNote: (input: CiNoteInput) => invoke<CiNote>("add_ci_note", { input }),
  updateCiNote: (id: number, input: CiNoteInput) => invoke<CiNote>("update_ci_note", { id, input }),
  setCiNotePinned: (id: number, pinned: boolean) => invoke<CiNote>("set_ci_note_pinned", { id, pinned }),
  deleteCiNote: (id: number) => invoke<void>("delete_ci_note", { id }),
  listQuickLinks: () => invoke<QuickLink[]>("list_quick_links"),

  // Quick Links
  listMaterials: () => invoke<Material[]>("list_materials"),
  uploadMaterial: async (file: File, details: MaterialDetails) =>
    invoke<Material>("upload_material", await packUpload(file, details)),
  updateMaterial: (id: number, input: MaterialDetails) => invoke<Material>("update_material", { id, input }),
  deleteMaterial: (id: number) => invoke<void>("delete_material", { id }),
  setMaterialBookmark: (id: number, bookmarked: boolean) =>
    invoke<Material>("set_material_bookmark", { id, bookmarked }),
  /** Opens the file in the default app (and logs a study session). */
  openMaterial: (id: number) => invoke<void>("open_material", { id }),
  getHandbook: () => invoke<Material | null>("get_handbook"),
  listAnnouncements: () => invoke<Announcement[]>("list_announcements"),
  getStudyJourney: () => invoke<StudyJourney>("get_study_journey"),

  // AI Study (no AI provider yet: bank-built quizzes, placeholder chat replies)
  listStudyActivity: (limit?: number) => invoke<StudyActivity[]>("list_study_activity", { limit }),
  listQuizzes: () => invoke<QuizSummary[]>("list_quizzes"),
  createQuiz: (input: NewQuiz) =>
    invoke<{ quiz: QuizSummary; requested: number }>("create_quiz", { input }),
  getQuiz: (id: number) => invoke<QuizDetail>("get_quiz", { id }),
  answerQuestion: (id: number, chosenIndex: number) =>
    invoke<QuizQuestion>("answer_question", { id, chosenIndex }),
  finishQuiz: (id: number) => invoke<QuizSummary>("finish_quiz", { id }),
  restartQuiz: (id: number) => invoke<QuizDetail>("restart_quiz", { id }),
  listChatMessages: () => invoke<ChatMessage[]>("list_chat_messages"),
  sendChatMessage: (content: string, attachment?: string | null) =>
    invoke<ChatMessage[]>("send_chat_message", { content, attachment }),
  clearChat: () => invoke<void>("clear_chat"),
};
