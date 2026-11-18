import { NavLink, useNavigate } from "react-router";
import { LogOut } from "lucide-react";
import Logo from "../Logo/Logo";
import { ciNav, mainNav, settingsNav, type NavItem } from "../../navigation";
import Avatar from "../Avatar/Avatar";
import type { Profile } from "../../lib/types";
import { api } from "../../lib/api";
import { usePreferences } from "../../lib/preferences";
import { usePremium } from "../../lib/premium";
import { PremiumBadge } from "../PremiumGate/PremiumGate";
import "./Sidebar.css";

function SidebarLink({ item, locked = false }: { item: NavItem; locked?: boolean }) {
  const Icon = item.icon;
  return (
    <NavLink
      to={item.path}
      end={item.path === "/" || item.path === "/ci"}
      className={({ isActive }) => `sidebar-link${isActive ? " is-active" : ""}`}
    >
      <Icon size={17} strokeWidth={1.9} />
      <span>{item.label}</span>
      {locked && <PremiumBadge label="" />}
    </NavLink>
  );
}

export default function Sidebar({ profile, open = false }: { profile: Profile | null; open?: boolean }) {
  const navigate = useNavigate();
  const { reload: reloadPreferences } = usePreferences();
  const { premium } = usePremium();

  async function logOut() {
    try {
      await api.signOut();
    } finally {
      await reloadPreferences(); // back to the default look on the sign-in screen
      navigate("/login", { replace: true });
    }
  }

  return (
    <aside className={`sidebar${open ? " is-open" : ""}`} aria-label="Navigation">
      <div className="sidebar-logo">
        <Logo />
      </div>

      <nav className="sidebar-nav" aria-label="Main">
        {(profile?.accountType === "clinical_instructor" ? ciNav : mainNav).map((item) => (
          <SidebarLink key={item.path} item={item} locked={item.premium && !premium} />
        ))}
      </nav>

      <div className="sidebar-footer">
        <div className="sidebar-nav">
          <SidebarLink item={settingsNav} />
          <button type="button" className="sidebar-link sidebar-link--danger" onClick={() => void logOut()}>
            <LogOut size={17} strokeWidth={1.9} />
            <span>Log out</span>
          </button>
        </div>
        {profile && (
          <div className="sidebar-user">
            <Avatar profile={profile} size={36} />
            <div className="sidebar-user-text">
              <strong>{profile.fullName}</strong>
              <span>{profile.role}</span>
            </div>
          </div>
        )}
      </div>
    </aside>
  );
}
