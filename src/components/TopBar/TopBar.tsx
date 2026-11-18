import { useNavigate } from "react-router";
import Avatar from "../Avatar/Avatar";
import NotificationBell from "../NotificationBell/NotificationBell";
import type { Profile } from "../../lib/types";

export default function TopBar({ profile }: { profile: Profile | null }) {
  const navigate = useNavigate();
  return (
    <header
      style={{
        display: "flex",
        justifyContent: "flex-end",
        alignItems: "center",
        gap: 12,
        padding: "20px var(--page-padding) 4px",
      }}
    >
      <NotificationBell />
      <button
        aria-label="Account settings"
        title="Account settings"
        onClick={() => navigate("/settings/account")}
        style={{ padding: 0, border: 0, background: "none", borderRadius: "50%" }}
      >
        <Avatar profile={profile} size={38} />
      </button>
    </header>
  );
}
