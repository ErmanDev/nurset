import { initials } from "../../lib/format";
import { usePreferences } from "../../lib/preferences";
import type { Profile } from "../../lib/types";

interface Props {
  profile: Profile | null;
  size: number;
  className?: string;
  /** Show the picture even if hidden in Privacy Preferences (Settings › Account). */
  alwaysShow?: boolean;
}

/** Profile picture, or initials when none is set. */
export default function Avatar({ profile, size, className = "", alwaysShow }: Props) {
  const { get } = usePreferences();
  const style = { width: size, height: size, fontSize: Math.round(size * 0.36) };
  const show = alwaysShow || get("privacy_show_avatar") !== "0";
  if (profile?.avatarData && show) {
    return (
      <img
        src={profile.avatarData}
        alt=""
        className={`avatar ${className}`}
        style={{ ...style, objectFit: "cover", padding: 0 }}
      />
    );
  }
  return (
    <span className={`avatar ${className}`} style={style} aria-hidden="true">
      {profile ? initials(profile.fullName) : ""}
    </span>
  );
}
