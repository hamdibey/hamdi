import { useEffect } from "react";
import { DesktopPage } from "./pages/DesktopPage";
import { Istemci } from "./pages/Istemci";
import { SitePage } from "./pages/SitePage";
import { useApp } from "./store/useApp";
import { PrivateChatDock } from "./components/PrivateChat";
import { VoiceCallDock } from "./components/VoiceCall";

function App() {
  const authReady = useApp((s) => s.authReady);
  const route = useApp((s) => s.route);
  const toast = useApp((s) => s.toast);
  const refreshMe = useApp((s) => s.refreshMe);

  // Kayıtlı oturumu veritabanından geri yükle (sayfa yenilenince üye kaybolmaz)
  useEffect(() => {
    void useApp.getState().restoreSession();
  }, []);

  // Ban / yetki değişikliklerini periyodik kontrol et (sunucu yayınları + API)
  useEffect(() => {
    const t = window.setInterval(() => refreshMe(), 4000);
    return () => window.clearInterval(t);
  }, [refreshMe]);

  if (!authReady) {
    return (
      <div className="felt-bg min-h-screen flex items-center justify-center">
        <p className="font-display text-2xl font-bold text-gold-400 animate-pulse">
          hasokey.com.tr<span className="text-ivory-dark/70">.store</span>
        </p>
      </div>
    );
  }

  // Windows masaüstü platformu — kendi pencere yönetimi, giriş bağımsız
  if (route.name === "masaustu") {
    return (
      <>
        <DesktopPage />
        {toast && (
          <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-[99999]">
            <div
              className="bg-[#d4d0c8] text-black text-[12px] px-4 py-2 border-2"
              style={{
                fontFamily: "Tahoma, sans-serif",
                boxShadow: "inset -1px -1px 0 #0a0a0a, inset 1px 1px 0 #fff, inset -2px -2px 0 #808080, inset 2px 2px 0 #dfdfdf, 3px 4px 14px rgba(0,0,0,.5)",
              }}
            >
              {toast}
            </div>
          </div>
        )}
        <PrivateChatDock />
        <VoiceCallDock />
      </>
    );
  }

  // Herkese açık web sitesi (anasayfa): üye ol · oyunu indir · programdan lobiye gir
  if (route.name === "site") {
    return (
      <>
        <SitePage />
        {toast && (
          <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 animate-floatUp">
            <div className="bg-wood-950 border-2 border-gold-600 text-ivory px-6 py-3 rounded-xl shadow-pop font-semibold text-sm">
              {toast}
            </div>
          </div>
        )}
      </>
    );
  }

  // Tek pencereli hakkarim tarzı istemci: giriş → kat → salon → oyun aynı platformda.
  // Ayrı web sayfası yok; her şey istemci penceresinin içinde akar.
  return (
    <>
      <Istemci />
      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 animate-floatUp">
          <div className="bg-wood-950 border-2 border-gold-600 text-ivory px-6 py-3 rounded-xl shadow-pop font-semibold text-sm">
            {toast}
          </div>
        </div>
      )}
      <PrivateChatDock />
      <VoiceCallDock />
    </>
  );
}

export default App;
