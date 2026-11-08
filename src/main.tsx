import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App.tsx";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>
);

// ---------------------------------------------------------------------------
// Otomatik güncelleme + service worker (PWA) — kullanıcının HEPSON SÜRÜMÜ görmesini garanti eder.
// FTP ile yeni build yüklendiğinde tarayıcı eski önbelleği göstermesin diye:
//  1) SW her açılışta güncellenir (skipWaiting + claim),
//  2) "waiting" SW devreye girince sayfa kendini yeniler,
//  3) 60 sn'de bir güncelleme kontrolü yapılır (uzun oturumlarda bile taze kalır).
// ---------------------------------------------------------------------------
if ("serviceWorker" in navigator) {
  const swUrl = `${import.meta.env.BASE_URL}sw.js`;

  // Sayfa açılırken bir SW zaten kontrolde mi? (ilk ziyarette false → gereksiz reload olmasın)
  const hadController = !!navigator.serviceWorker.controller;

  window.addEventListener("load", async () => {
    // Yeni bir SW devreye girince (güncelleme alındı) sayfayı yenile — eski önbellek gösterilmesin
    navigator.serviceWorker.addEventListener("controllerchange", () => {
      if (!hadController) return; // ilk kurulumda reload yapma
      window.location.reload();
    });

    try {
      const reg = await navigator.serviceWorker.register(swUrl, { updateViaCache: "none" });

      // Açılışta hemen bir güncelleme kontrolü yap
      reg.update().catch(() => undefined);

      // Yeni sürüm indirilmiş (waiting) ise devreye al — controllerchange reload'u tetikler
      if (reg.waiting) {
        reg.waiting.postMessage({ type: "SKIP_WAITING" });
      }

      // Yeni sürüm indirildiğinde bilgilendir
      reg.addEventListener("updatefound", () => {
        const nw = reg.installing;
        if (!nw) return;
        nw.addEventListener("statechange", () => {
          if (nw.state === "installed" && navigator.serviceWorker.controller) {
            // "installed + controller var" = yeni sürüm hazır, devreye al
            nw.postMessage({ type: "SKIP_WAITING" });
          }
        });
      });

      // Uzun oturumlarda 60 sn'de bir güncelleme kontrolü
      window.setInterval(() => reg.update().catch(() => undefined), 60_000);
    } catch {
      // SW kaydı başarısızsa uygulama yine de normal çalışır (ağdan)
    }
  });
}
