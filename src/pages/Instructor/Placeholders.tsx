import { CalendarCheck, CalendarDays, ClipboardPen, FileCheck2, Megaphone, Star } from "lucide-react";
import PagePlaceholder from "../../components/PagePlaceholder/PagePlaceholder";

// Instructor pages still to be designed; routes exist so the sidebar works.

export const DutyAssignments = () => (
  <PagePlaceholder title="Duty Assignments" description="Assign clinical rotations to a whole group at once." icon={CalendarDays} />
);
export const Reviews = () => (
  <PagePlaceholder title="Requirements & Reviews" description="Set requirements and review your students' submissions." icon={FileCheck2} />
);
export const Instructions = () => (
  <PagePlaceholder title="Instructions" description="Post instructions and reminders to a group or a student." icon={ClipboardPen} />
);
export const DutyDay = () => (
  <PagePlaceholder title="Duty Day" description="Attendance and readiness for today's duty." icon={CalendarCheck} />
);
export const Evaluations = () => (
  <PagePlaceholder title="Evaluations & Hours" description="Evaluate performance and confirm clinical hours." icon={Star} />
);
export const CiAnnouncements = () => (
  <PagePlaceholder title="Announcements" description="Post announcements to your groups." icon={Megaphone} />
);
