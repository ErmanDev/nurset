/** True inside the installed desktop app (Tauri), false in a web browser. */
export const isDesktop = typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

/** "Chrome on Windows", "Safari on iPhone", ... for Settings > Active Sessions. */
export function browserLabel(): string {
  const ua = typeof navigator === "undefined" ? "" : navigator.userAgent;
  const browser = /Edg\//.test(ua)
    ? "Edge"
    : /OPR\//.test(ua)
      ? "Opera"
      : /Firefox\//.test(ua)
        ? "Firefox"
        : /Chrome\//.test(ua)
          ? "Chrome"
          : /Safari\//.test(ua)
            ? "Safari"
            : "Browser";
  const os = /iPhone|iPad/.test(ua)
    ? "iPhone"
    : /Android/.test(ua)
      ? "Android"
      : /Windows/.test(ua)
        ? "Windows"
        : /Mac OS X/.test(ua)
          ? "macOS"
          : /Linux/.test(ua)
            ? "Linux"
            : "web";
  return `${browser} on ${os} · web`;
}
