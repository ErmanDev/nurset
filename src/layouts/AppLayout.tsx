import { useEffect, useState } from "react";
import { Navigate, Outlet, useLocation } from "react-router";
import Sidebar from "../components/Sidebar/Sidebar";
import TopBar from "../components/TopBar/TopBar";
import { api } from "../lib/api";
import { useAsync } from "../hooks/useAsync";
import { usePreferences } from "../lib/preferences";
import "./AppLayout.css";

export default function AppLayout() {
  // Restores a saved "Keep me signed in" session on launch.
  const { data: profile, error, loading, reload } = useAsync(api.currentSession);
  const { reload: reloadPreferences } = usePreferences();
  const { pathname } = useLocation();
  const userId = profile?.id;

  // Phones and narrow windows: the sidebar is a drawer opened from the top bar.
  const [navOpen, setNavOpen] = useState(false);
  useEffect(() => setNavOpen(false), [pathname]);
  useEffect(() => {
    if (!navOpen) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setNavOpen(false);
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [navOpen]);

  // Load the signed-in account's settings (theme, Premium status, ...) before
  // showing pages, so Premium pages and the theme don't flash the defaults.
  const [prefsFor, setPrefsFor] = useState<number | null>(null);
  useEffect(() => {
    if (!userId) return;
    let live = true;
    void reloadPreferences().then(() => live && setPrefsFor(userId));
    return () => {
      live = false;
    };
  }, [userId, reloadPreferences]);

  // Settings › Account fires this after the profile or picture changes.
  useEffect(() => {
    const onChange = () => void reload();
    window.addEventListener("nurset:profile-changed", onChange);
    // The server ended the session (expired, signed out elsewhere, password changed).
    window.addEventListener("nurset:signed-out", onChange);
    return () => {
      window.removeEventListener("nurset:profile-changed", onChange);
      window.removeEventListener("nurset:signed-out", onChange);
    };
  }, [reload]);

  if (loading || (profile && prefsFor !== profile.id)) return <div className="app-shell" aria-busy="true" />;
  if (error && !profile) {
    return (
      <div className="app-gate">
        <div className="card app-gate-card">
          <h2>Can't open NurSet</h2>
          <p>{error}</p>
          <button className="btn btn-primary" onClick={() => void reload()}>
            Try again
          </button>
        </div>
      </div>
    );
  }
  if (!profile) return <Navigate to="/login" replace />;

  // Keep each account type on its own pages (Settings is shared).
  const isCi = profile.accountType === "clinical_instructor";
  const onCiPage = pathname === "/ci" || pathname.startsWith("/ci/");
  const shared = pathname.startsWith("/settings");
  if (isCi && !onCiPage && !shared) return <Navigate to="/ci" replace />;
  if (!isCi && onCiPage) return <Navigate to="/" replace />;

  return (
    <div className={`app-shell${navOpen ? " nav-open" : ""}`}>
      <Sidebar profile={profile} open={navOpen} />
      <div className="app-nav-backdrop" onClick={() => setNavOpen(false)} aria-hidden="true" />
      <main className="app-main">
        <TopBar profile={profile} onMenu={() => setNavOpen(true)} />
        <div className="app-content">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
