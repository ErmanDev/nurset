import {
  CalendarDays,
  CalendarCheck,
  ClipboardPen,
  FileCheck2,
  Megaphone,
  Star,
  Users,
  Check,
  ClipboardCheck,
  ClipboardList,
  House,
  Link2,
  NotebookPen,
  Settings,
  Sparkles,
  TrendingUp,
  type LucideIcon,
} from "lucide-react";

export interface NavItem {
  path: string;
  label: string;
  icon: LucideIcon;
}

/** Sidebar order. Routes for each path live in App.tsx. */
export const mainNav: NavItem[] = [
  { path: "/", label: "Home", icon: House },
  { path: "/duty-schedule", label: "Duty Schedule", icon: CalendarDays },
  { path: "/requirements", label: "Requirements", icon: ClipboardList },
  { path: "/tasks", label: "Tasks", icon: Check },
  { path: "/duty-checklist", label: "Duty Checklist", icon: ClipboardCheck },
  { path: "/ai-study", label: "AI Study", icon: Sparkles },
  { path: "/ci-notes", label: "CI Notes", icon: NotebookPen },
  { path: "/progress", label: "Progress", icon: TrendingUp },
  { path: "/quick-links", label: "Quick Links", icon: Link2 },
];

/** Clinical instructor sidebar. */
export const ciNav: NavItem[] = [
  { path: "/ci", label: "Home", icon: House },
  { path: "/ci/groups", label: "My Groups", icon: Users },
  { path: "/ci/assignments", label: "Duty Assignments", icon: CalendarDays },
  { path: "/ci/reviews", label: "Requirements & Reviews", icon: FileCheck2 },
  { path: "/ci/instructions", label: "Instructions", icon: ClipboardPen },
  { path: "/ci/duty-day", label: "Duty Day", icon: CalendarCheck },
  { path: "/ci/evaluations", label: "Evaluations & Hours", icon: Star },
  { path: "/ci/announcements", label: "Announcements", icon: Megaphone },
];

export const settingsNav: NavItem = { path: "/settings", label: "Settings", icon: Settings };
