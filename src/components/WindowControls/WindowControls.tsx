import { Minus, X } from "lucide-react";
import { isDesktop } from "../../lib/platform";
import "./WindowControls.css";

/** The app runs full screen without a title bar, so it draws its own minimize/close buttons. */
async function windowAction(action: "minimize" | "close") {
  try {
    const { getCurrentWindow } = await import("@tauri-apps/api/window");
    const win = getCurrentWindow();
    await (action === "minimize" ? win.minimize() : win.close());
  } catch {
    if (action === "close") window.close(); // not running inside Tauri
  }
}

export default function WindowControls({ className = "" }: { className?: string }) {
  if (!isDesktop) return null; // the browser has its own controls
  return (
    <div className={`window-controls ${className}`}>
      <button type="button" onClick={() => void windowAction("minimize")} aria-label="Minimize NurSet" title="Minimize">
        <Minus size={16} />
      </button>
      <button
        type="button"
        className="window-controls-close"
        onClick={() => void windowAction("close")}
        aria-label="Close NurSet"
        title="Close"
      >
        <X size={16} />
      </button>
    </div>
  );
}
