import { Link, NavLink } from "react-router";
import { LogOut } from "lucide-react";
import Logo from "../Logo/Logo";
import { ciNav, mainNav, settingsNav, type NavItem } from "../../navigation";
import Avatar from "../Avatar/Avatar";
import type { Profile } from "../../lib/types";
import "./Sidebar.css";

function SidebarLink({ item }: { item: NavItem }) {
  const Icon = item.icon;
  return (
    <NavLink
      to={item.path}
      end={item.path === "/" || item.path === "/ci"}
      className={({ isActive }) => `sidebar-link${isActive ? " is-active" : ""}`}
    >
      <Icon size={17} strokeWidth={1.9} />
      <span>{item.label}</span>
    </NavLink>
  );
}

export default function Sidebar({ profile }: { profile: Profile | null }) {
  return (
    <aside className="sidebar">
      <div className="sidebar-logo">
        <Logo />
      </div>

      <nav className="sidebar-nav" aria-label="Main">
        {(profile?.accountType === "clinical_instructor" ? ciNav : mainNav).map((item) => (
          <SidebarLink key={item.path} item={item} />
        ))}
      </nav>

      <div className="sidebar-footer">
        <div className="sidebar-nav">
          <SidebarLink item={settingsNav} />
          {/* TODO(auth): clear the session before leaving. */}
          <Link to="/login" className="sidebar-link sidebar-link--danger">
            <LogOut size={17} strokeWidth={1.9} />
            <span>Log out</span>
          </Link>
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
