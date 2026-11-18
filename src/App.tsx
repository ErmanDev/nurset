import { HashRouter, Navigate, Route, Routes } from "react-router";
import { PreferencesProvider } from "./lib/preferences";
import { Toaster } from "./components/Toast/Toast";
import PremiumGate from "./components/PremiumGate/PremiumGate";
import AppLayout from "./layouts/AppLayout";
import AuthLayout from "./layouts/AuthLayout";
import Login from "./pages/Auth/Login";
import Register from "./pages/Auth/Register";
import Dashboard from "./pages/Dashboard";
import DutySchedule from "./pages/DutySchedule";
import Requirements from "./pages/Requirements";
import Tasks from "./pages/Tasks";
import DutyChecklist from "./pages/DutyChecklist";
import AiStudy from "./pages/AiStudy";
import AiChat from "./pages/AiStudy/Chat";
import Quizlab from "./pages/AiStudy/Quizlab";
import QuizSession from "./pages/AiStudy/QuizSession";
import CiNotes from "./pages/CiNotes";
import Progress from "./pages/Progress";
import QuickLinks from "./pages/QuickLinks";
import LearningHub from "./pages/QuickLinks/LearningHub";
import UploadMaterials from "./pages/QuickLinks/UploadMaterials";
import Announcements from "./pages/QuickLinks/Announcements";
import Handbook from "./pages/QuickLinks/Handbook";
import HelpSupport from "./pages/QuickLinks/HelpSupport";
import Settings from "./pages/Settings";
import PlanPage from "./pages/Settings/Premium/PlanPage";
import CheckoutPage from "./pages/Settings/Premium/CheckoutPage";
import InstructorHome from "./pages/Instructor/Home";
import Groups from "./pages/Instructor/Groups";
import GroupDetail from "./pages/Instructor/GroupDetail";
import DutyAssignments from "./pages/Instructor/DutyAssignments";
import Reviews from "./pages/Instructor/Reviews";
import Instructions from "./pages/Instructor/Instructions";
import DutyDay from "./pages/Instructor/DutyDay";
import Evaluations from "./pages/Instructor/Evaluations";
import CiAnnouncements from "./pages/Instructor/CiAnnouncements";

// HashRouter: the bundled app is served from files, so hash URLs survive reloads.
export default function App() {
  return (
    <PreferencesProvider>
    <HashRouter>
      <Routes>
        {/* Signed-out screens. AppLayout sends signed-out users here.
            Forgot Password (pages/Auth/ForgotPassword.tsx) is hidden until
            the app can send reset emails. */}
        <Route element={<AuthLayout />}>
          <Route path="login" element={<Login />} />
          <Route path="register" element={<Register />} />
        </Route>

        <Route element={<AppLayout />}>
          <Route index element={<Dashboard />} />
          <Route path="duty-schedule" element={<DutySchedule />} />
          <Route path="requirements" element={<Requirements />} />
          <Route path="tasks" element={<Tasks />} />
          <Route path="duty-checklist" element={<DutyChecklist />} />
          {/* Premium: AI Study and Quick Links (Help & Support and Announcements stay free). */}
          <Route element={<PremiumGate />}>
            <Route path="ai-study" element={<AiStudy />} />
            <Route path="ai-study/chat" element={<AiChat />} />
            <Route path="ai-study/quizlab" element={<Quizlab />} />
            <Route path="ai-study/quiz/:id" element={<QuizSession />} />
            <Route path="quick-links" element={<QuickLinks />} />
            <Route path="quick-links/learning-hub" element={<LearningHub />} />
            <Route path="quick-links/upload" element={<UploadMaterials />} />
            <Route path="quick-links/handbook" element={<Handbook />} />
          </Route>
          <Route path="ci-notes" element={<CiNotes />} />
          <Route path="progress" element={<Progress />} />
          <Route path="announcements" element={<Announcements />} />
          <Route path="quick-links/announcements" element={<Navigate to="/announcements" replace />} />
          <Route path="quick-links/help" element={<HelpSupport />} />
          {/* Clinical instructor */}
          <Route path="ci" element={<InstructorHome />} />
          <Route path="ci/groups" element={<Groups />} />
          <Route path="ci/groups/:id" element={<GroupDetail />} />
          <Route path="ci/assignments" element={<DutyAssignments />} />
          <Route path="ci/reviews" element={<Reviews />} />
          <Route path="ci/instructions" element={<Instructions />} />
          <Route path="ci/duty-day" element={<DutyDay />} />
          <Route path="ci/evaluations" element={<Evaluations />} />
          <Route path="ci/announcements" element={<CiAnnouncements />} />
          <Route path="settings" element={<Settings />} />
          <Route path="settings/premium/plans" element={<PlanPage />} />
          <Route path="settings/premium/checkout" element={<CheckoutPage />} />
          <Route path="settings/:section" element={<Settings />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </HashRouter>
    <Toaster />
    </PreferencesProvider>
  );
}
