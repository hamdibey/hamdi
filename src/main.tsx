import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import "./classic-reference.css";
import App from "./App.tsx";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>
);

if ("serviceWorker" in navigator) {
  const swUrl = `${import.meta.env.BASE_URL}sw.js`;
  const hadController = !!navigator.serviceWorker.controller;

  window.addEventListener("load", async () => {
    navigator.serviceWorker.addEventListener("controllerchange", () => {
      if (!hadController) return;
      window.location.reload();
    });

    try {
      const reg = await navigator.serviceWorker.register(swUrl, { updateViaCache: "none" });
      reg.update().catch(() => undefined);
      if (reg.waiting) reg.waiting.postMessage({ type: "SKIP_WAITING" });

      reg.addEventListener("updatefound", () => {
        const nw = reg.installing;
        if (!nw) return;
        nw.addEventListener("statechange", () => {
          if (nw.state === "installed" && navigator.serviceWorker.controller) {
            nw.postMessage({ type: "SKIP_WAITING" });
          }
        });
      });

      window.setInterval(() => reg.update().catch(() => undefined), 60_000);
    } catch {
      // no-op
    }
  });
}
