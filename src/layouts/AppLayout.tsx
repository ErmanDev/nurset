import { useEffect } from "react";
import { Navigate, Outlet, useLocation } from "react-router";
import Sidebar from "../components/Sidebar/Sidebar";
import TopBar from "../components/TopBar/TopBar";
import { api } from "../lib/api";
import { useAsync } from "../hooks/useAsync";
import "./AppLayout.css";

export default function AppLayout() {
  const { data: profile, reload } = useAsync(api.getProfile);
  const { pathname } = useLocation();

  // Settings › Account fires this after the profile or picture changes.
  useEffect(() => {
    const onChange = () => void reload();
    window.addEventListener("nurset:profile-changed", onChange);
    return () => window.removeEventListener("nurset:profile-changed", onChange);
  }, [reload]);

  // Keep each account type on its own pages (Settings is shared).
  if (profile) {
    const isCi = profile.accountType === "clinical_instructor";
    const onCiPage = pathname === "/ci" || pathname.startsWith("/ci/");
    const shared = pathname.startsWith("/settings");
    if (isCi && !onCiPage && !shared) return <Navigate to="/ci" replace />;
    if (!isCi && onCiPage) return <Navigate to="/" replace />;
  }

  return (
    <div className="app-shell">
      <Sidebar profile={profile} />
      <main className="app-main">
        <TopBar profile={profile} />
        <div className="app-content">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
