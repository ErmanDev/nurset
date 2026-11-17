import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";

interface Props {
  title: string;
  description: string;
  icon: LucideIcon;
  /** Optional button(s) shown under the "coming soon" note. */
  action?: ReactNode;
}

/** Temporary body for pages whose UI hasn't been built yet. */
export default function PagePlaceholder({ title, description, icon: Icon, action }: Props) {
  return (
    <section style={{ paddingTop: 8 }}>
      <h1 style={{ fontSize: 26, fontWeight: 700 }}>{title}</h1>
      <p style={{ color: "var(--text-muted)", marginTop: 4 }}>{description}</p>

      <div
        className="card"
        style={{
          marginTop: 28,
          minHeight: 320,
          display: "grid",
          placeItems: "center",
          borderStyle: "dashed",
          boxShadow: "none",
          background: "transparent",
        }}
      >
        <div style={{ textAlign: "center", color: "var(--text-subtle)" }}>
          <Icon size={36} strokeWidth={1.5} />
          <p style={{ marginTop: 10, fontSize: 13 }}>UI coming soon</p>
          {action && <div style={{ marginTop: 16 }}>{action}</div>}
        </div>
      </div>
    </section>
  );
}
