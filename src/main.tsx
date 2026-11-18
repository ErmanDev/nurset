import React from "react";
import ReactDOM from "react-dom/client";
import "@fontsource/poppins/400.css";
import "@fontsource/poppins/500.css";
import "@fontsource/poppins/600.css";
import "@fontsource/poppins/700.css";
import "./styles/global.css";
import App from "./App";
// Last, so phone layouts override the page stylesheets App pulls in.
import "./styles/mobile.css";

// Native file drop is disabled (tauri.conf.json: dragDropEnabled=false) so the
// webview gets HTML5 drop events. Swallow drops outside drop zones so a stray
// file doesn't make the window navigate to it.
window.addEventListener("dragover", (e) => e.preventDefault());
window.addEventListener("drop", (e) => e.preventDefault());

// Open on the sign-in screen at launch (HashRouter reads the hash).
if (!window.location.hash || window.location.hash === "#/") {
  window.location.hash = "#/login";
}

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
