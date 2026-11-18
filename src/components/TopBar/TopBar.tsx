import { Menu } from "lucide-react";
import { useNavigate } from "react-router";
import Avatar from "../Avatar/Avatar";
import Logo from "../Logo/Logo";
import NotificationBell from "../NotificationBell/NotificationBell";
import WindowControls from "../WindowControls/WindowControls";
import type { Profile } from "../../lib/types";
import "./TopBar.css";

export default function TopBar({ profile, onMenu }: { profile: Profile | null; onMenu?: () => void }) {
  const navigate = useNavigate();
  return (
    <header className="topbar">
      {/* Shown on phones / narrow windows, where the sidebar is a drawer. */}
      <button type="button" className="icon-button topbar-menu" onClick={onMenu} aria-label="Open menu" title="Menu">
        <Menu size={18} />
      </button>
      <span className="topbar-logo">
        <Logo height={30} />
      </span>
      <span className="topbar-spacer" />
      <NotificationBell />
      <button
        className="topbar-avatar"
        aria-label="Account settings"
        title="Account settings"
        onClick={() => navigate("/settings/account")}
      >
        <Avatar profile={profile} size={38} />
      </button>
      <WindowControls className="window-controls--topbar" />
    </header>
  );
}
