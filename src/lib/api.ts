// Typed wrappers around the NurSet server's commands (server/src/dispatch.rs).
import { call as invoke, clearToken, deviceName, getToken, openFrom, setToken, upload, type FileLink } from "./client";
import type {
  CiDashboard,
  GroupDetail,
  GroupInvitation,
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
  RegisterInput,
  QuizFeedback,
  NotificationFeed,
  SecurityOverview,
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
  // Accounts & sessions
  register: async (input: RegisterInput) => {
    const signed = await invoke<{ profile: Profile; token: string }>("register", {
      input: { ...input, device: await deviceName() },
    });
    setToken(signed.token, input.remember);
    return signed.profile;
  },
  signIn: async (identifier: string, password: string, remember: boolean) => {
    const signed = await invoke<{ profile: Profile; token: string }>("sign_in", {
      identifier,
      password,
      remember,
      device: await deviceName(),
    });
    setToken(signed.token, remember);
    return signed.profile;
  },
  signOut: async () => {
    try {
      await invoke<void>("sign_out");
    } finally {
      clearToken();
    }
  },
  /** The signed-in profile (from the saved session token), or null. */
  currentSession: async () => (getToken() ? invoke<Profile | null>("current_session") : null),
  changePassword: (current: string, newPassword: string) =>
    invoke<void>("change_password", { current, newPassword }),
  getSecurity: () => invoke<SecurityOverview>("get_security"),
  /** Signs out one other session, or all other sessions when `id` is omitted. */
  endSessions: (id?: number) => invoke<void>("end_sessions", { id: id ?? null }),
  getDashboard: () => invoke<Dashboard>("get_dashboard"),

  // Notification bell
  listNotifications: () => invoke<NotificationFeed>("list_notifications"),
  /** Marks the given keys read, or everything currently listed when omitted. */
  markNotificationsRead: (keys?: string[]) => invoke<void>("mark_notifications_read", { keys: keys ?? null }),

  // Clinical instructor
  getCiDashboard: () => invoke<CiDashboard>("get_ci_dashboard"),
  listGroups: () => invoke<GroupSummary[]>("list_groups"),
  getGroup: (id: number) => invoke<GroupDetail>("get_group", { id }),
  createGroup: (input: GroupInput) => invoke<GroupSummary>("create_group", { input }),
  updateGroup: (id: number, input: GroupInput) => invoke<GroupSummary>("update_group", { id, input }),
  deleteGroup: (id: number) => invoke<void>("delete_group", { id }),
  addGroupMember: (groupId: number, identifier: string) =>
    invoke<GroupDetail>("add_group_member", { groupId, identifier }),
  /** Student side: invitations to join an instructor's group. */
  listGroupInvitations: () => invoke<GroupInvitation[]>("list_group_invitations"),
  respondGroupInvitation: (groupId: number, accept: boolean) =>
    invoke<void>("respond_group_invitation", { groupId, accept }),
  removeGroupMember: (groupId: number, studentId: number) =>
    invoke<GroupDetail>("remove_group_member", { groupId, studentId }),
  getProfile: () => invoke<Profile | null>("get_profile"),
  getProgress: (range: ProgressRange) => invoke<ProgressOverview>("get_progress", { range }),

  // Settings
  getSettings: () => invoke<Record<string, string>>("get_settings"),
  setSettings: (values: Record<string, string>) => invoke<void>("set_settings", { values }),
  updateProfile: (input: ProfileInput) => invoke<Profile>("update_profile", { input }),
  setAvatar: (data: string | null) => invoke<Profile>("set_avatar", { data }),
  /** Downloads a JSON copy of all your data (opens in the browser). */
  exportData: () => openFrom(() => invoke<FileLink>("export_data"), { download: true }),
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
  /** Opens the student's own submitted file in its default app. */
  openDocument: (id: number) => openFrom(() => invoke<FileLink>("open_document", { id })),
  uploadDocument: async (file: File, details: DocumentUploadDetails) =>
    upload<SubmittedDocument>("/api/upload/document", await packUpload(file, details)),

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
    upload<Material>("/api/upload/material", await packUpload(file, details)),
  updateMaterial: (id: number, input: MaterialDetails) => invoke<Material>("update_material", { id, input }),
  deleteMaterial: (id: number) => invoke<void>("delete_material", { id }),
  setMaterialBookmark: (id: number, bookmarked: boolean) =>
    invoke<Material>("set_material_bookmark", { id, bookmarked }),
  /** Opens the file in the default app (and logs a study session). */
  openMaterial: (id: number) => openFrom(() => invoke<FileLink>("open_material", { id })),
  getHandbook: () => invoke<Material | null>("get_handbook"),
  listAnnouncements: () => invoke<Announcement[]>("list_announcements"),
  getStudyJourney: () => invoke<StudyJourney>("get_study_journey"),

  // AI Study (no AI provider yet: bank-built quizzes, placeholder chat replies)
  listStudyActivity: (limit?: number) => invoke<StudyActivity[]>("list_study_activity", { limit }),
  listQuizzes: () => invoke<QuizSummary[]>("list_quizzes"),
  createQuiz: (input: NewQuiz) =>
    invoke<{ quiz: QuizSummary; requested: number; source: "ai" | "bank"; notice: string | null }>(
      "create_quiz",
      { input },
    ),
  getQuiz: (id: number) => invoke<QuizDetail>("get_quiz", { id }),
  answerQuestion: (id: number, chosenIndex: number) =>
    invoke<QuizQuestion>("answer_question", { id, chosenIndex }),
  finishQuiz: (id: number) => invoke<QuizSummary>("finish_quiz", { id }),
  /** AI (or basic) feedback on a finished quiz; cached until the quiz is retaken. */
  getQuizFeedback: (id: number) => invoke<QuizFeedback>("get_quiz_feedback", { id }),
  restartQuiz: (id: number) => invoke<QuizDetail>("restart_quiz", { id }),
  listChatMessages: () => invoke<ChatMessage[]>("list_chat_messages"),
  sendChatMessage: (content: string, attachment?: string | null) =>
    invoke<ChatMessage[]>("send_chat_message", { content, attachment }),
  clearChat: () => invoke<void>("clear_chat"),
};
