import { browserLabel, isDesktop } from "./platform";

// HTTP client for the NurSet server (server/). Every API call goes through
// `call`, which sends the session token and turns errors into plain strings
// (the same shape the pages already show with `String(err)`).

/** Server address. Set VITE_API_URL when building the installer. */
export const API_URL = (import.meta.env.VITE_API_URL ?? "http://localhost:8080").replace(/\/+$/, "");

const TOKEN_KEY = "nurset.token";

/** Session token: localStorage when "Keep me signed in", else sessionStorage (cleared when NurSet closes). */
export function getToken(): string | null {
  try {
    return sessionStorage.getItem(TOKEN_KEY) ?? localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setToken(token: string, remember: boolean) {
  try {
    clearToken();
    (remember ? localStorage : sessionStorage).setItem(TOKEN_KEY, token);
  } catch {
    /* storage unavailable: the session lasts until the app reloads */
  }
}

export function clearToken() {
  try {
    sessionStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(TOKEN_KEY);
  } catch {
    /* nothing to clear */
  }
}

const OFFLINE = "Can't reach the NurSet server. Check your internet connection and try again.";

async function send<T>(path: string, init: RequestInit): Promise<T> {
  const token = getToken();
  const headers = new Headers(init.headers);
  if (token) headers.set("Authorization", `Bearer ${token}`);
  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, { ...init, headers });
  } catch {
    throw OFFLINE;
  }
  if (res.ok) {
    const text = await res.text();
    return (text ? JSON.parse(text) : null) as T;
  }
  let message = `NurSet server error (${res.status}). Please try again.`;
  try {
    const body = await res.json();
    if (typeof body?.error === "string") message = body.error;
  } catch {
    /* not JSON */
  }
  if (res.status === 401 && token) {
    // The session ended (signed out elsewhere, expired, or password changed).
    clearToken();
    window.dispatchEvent(new Event("nurset:signed-out"));
  }
  throw message;
}

/** Runs a server command: POST /api/rpc/<command> with JSON arguments. */
export function call<T>(command: string, args?: Record<string, unknown>): Promise<T> {
  return send<T>(`/api/rpc/${command}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(args ?? {}),
  });
}

/** Sends a packed upload body (see api.ts `packUpload`). */
export function upload<T>(path: "/api/upload/document" | "/api/upload/material", body: Uint8Array): Promise<T> {
  return send<T>(path, {
    method: "POST",
    headers: { "Content-Type": "application/octet-stream" },
    body: body as BodyInit,
  });
}

/** A one-time link from an "open" or "export" command. */
export interface FileLink {
  path: string;
}

/**
 * Runs an "open" or "export" command and shows the file.
 * Desktop: opens the link in the default browser or viewer.
 * Web: a new tab is opened right away (inside the click, so pop-up blockers
 * allow it) and pointed at the file once the server answers; downloads
 * (`download: true`) start in the current tab without leaving NurSet.
 */
export async function openFrom(getLink: () => Promise<FileLink>, opts: { download?: boolean } = {}): Promise<void> {
  const tab = !isDesktop && !opts.download ? window.open("about:blank", "_blank") : null;
  try {
    const url = `${API_URL}${(await getLink()).path}`;
    if (isDesktop) {
      const { openUrl } = await import("@tauri-apps/plugin-opener");
      await openUrl(url);
    } else if (tab) {
      tab.opener = null;
      tab.location.href = url;
    } else {
      window.location.href = url; // attachment: the browser downloads it and stays on NurSet
    }
  } catch (err) {
    tab?.close();
    throw err;
  }
}

/** Device label for Settings > Active Sessions. */
export async function deviceName(): Promise<string> {
  if (!isDesktop) return browserLabel();
  try {
    const { invoke } = await import("@tauri-apps/api/core");
    return await invoke<string>("device_name");
  } catch {
    return "NurSet desktop app";
  }
}
