import { useEffect, useMemo, useRef, useState } from "react";
import { useApp, type Route } from "../store/useApp";
import { useDesktop } from "../store/useDesktop";
import { Win98Window } from "../components/desktop/Win98Window";
import { BaglantiWindow } from "../components/desktop/BaglantiWindow";
import { LobbyPage } from "./LobbyPage";
import { SalonPage } from "./SalonPage";
import { SalonRoomPage } from "./SalonRoomPage";
import { OkeyGamePage } from "./OkeyGamePage";
import { OnlineOkeyPage } from "./OnlineOkeyPage";
import { BatakGamePage } from "./BatakGamePage";
import { DominoGamePage } from "./DominoGamePage";
import { AdminPanelPage } from "./AdminPanelPage";
import { YonetimPage } from "./YonetimPage";
import { ProfilPage } from "./ProfilPage";
import { ChatSalonPage } from "./ChatSalonPage";
import { KiraPage } from "./KiraPage";
import { GoldPage } from "./GoldPage";
import { IndirPage } from "./IndirPage";
import { can } from "../lib/ranks";
import { WinIcon, type WinIconName } from "../components/desktop/WinIcon";
import { winCtx, winSpecFor } from "../store/useDesktop";
import { GuncellemeDialog } from "../components/desktop/GuncellemeDialog";

/** Gerçek masaüstü programı (Electron) içinde miyiz? */
const ELECTRON = typeof window !== "undefined" && !!window.vkElectron?.isElectron;

/** İçerik penceresinin hangi rota olduğunu hash'ten okur (#masaustu&w=...) */
function parseWinRoute(): Route | null {
  const m = window.location.hash.match(/[&?]w=([^&]+)/);
  if (!m) return null;
  try {
    const r = JSON.parse(decodeURIComponent(m[1])) as Route;
    return r && typeof r.name === "string" ? r : null;
  } catch {
    return null;
  }
}

/** Masaüstü simgesi tanımı */
interface DeskIcon {
  label: string;
  icon: string; // emoji ya da /masaustu/... görseli
  route?: Route;
  action?: "baglanti" | "cop";
  reqLogin?: boolean;
  reqAdmin?: boolean;
}

const ICONS: DeskIcon[] = [
  { label: "Bağlantı", icon: "/masaustu/bocek.jpg", action: "baglanti" },
  { label: "Ana Salon", icon: "win:home", route: { name: "lobi", floor: 1 }, reqLogin: true },
  { label: "2. Kat", icon: "win:building", route: { name: "lobi", floor: 2 }, reqLogin: true },
  { label: "3. Kat", icon: "win:mall", route: { name: "lobi", floor: 3 }, reqLogin: true },
  { label: "4. Kat", icon: "win:castle", route: { name: "lobi", floor: 4 }, reqLogin: true },
  { label: "101 Okey", icon: "win:okey", route: { name: "oyun", game: "yuzbir" }, reqLogin: true },
  { label: "Okey", icon: "win:cards", route: { name: "oyun", game: "okey" }, reqLogin: true },
  { label: "34 / 51 Online", icon: "win:globe", route: { name: "oyunOnline", game: "otuzdort" }, reqLogin: true },
  { label: "Batak", icon: "win:playcard", route: { name: "oyun", game: "batak" }, reqLogin: true },
  { label: "Domino", icon: "win:domino", route: { name: "oyun", game: "domino" }, reqLogin: true },
  { label: "Sohbet (Yardım)", icon: "win:chat", route: { name: "sohbet", room: "yardim" }, reqLogin: true },
  { label: "Yönetim Paneli", icon: "win:gear", route: { name: "panel" }, reqLogin: true, reqAdmin: true },
  { label: "Salon Kiralama", icon: "win:key", route: { name: "kira" }, reqLogin: true },
  { label: "Gold Üyelik", icon: "win:crown", route: { name: "gold" }, reqLogin: true },
  { label: "Oyunu İndir", icon: "win:download", route: { name: "indir" } },
  { label: "Geri Dönüşüm", icon: "win:recycle", action: "cop" },
];

const WALLPAPERS = [
  { id: "gece", label: "🌌 Gece Gölü (Yıldızlı)", url: "/masaustu/duvar-kagidi-gece.jpg" },
  { id: "bliss", label: "🌄 Yeşil Tepeler (Bliss)", url: "/masaustu/duvar-kagidi.png" },
];

function WindowBody({ route, winId, onClose }: { route: Route; winId: number; onClose: () => void }) {
  switch (route.name) {
    case "giris":
      return <BaglantiWindow winId={winId} onClose={onClose} />;
    case "lobi":
      return <LobbyPage floor={route.floor} />;
    case "salon":
      return <SalonPage game={route.game} />;
    case "salonRoom":
      return <SalonRoomPage floor={route.floor} slot={route.slot} />;
    case "oyun":
      return route.game === "domino" ? <DominoGamePage /> : route.game === "batak" ? <BatakGamePage /> : <OkeyGamePage mode={route.game} />;
    case "oyunOnline":
      return <OnlineOkeyPage mode={route.game} />;
    case "sohbet":
      return <ChatSalonPage room={route.room} />;
    case "panel":
      return <AdminPanelPage />;
    case "yonetim":
      return <YonetimPage salon={route.salon} floor={route.floor} slot={route.slot} />;
    case "profil":
      return <ProfilPage nick={route.nick} />;
    case "kira":
      return <KiraPage />;
    case "gold":
      return <GoldPage />;
    case "indir":
      return <IndirPage />;
    default:
      return <div className="p-4 text-[13px]">Pencere bulunamadı.</div>;
  }
}

export function DesktopPage() {
  const me = useApp((s) => s.me);
  const authReady = useApp((s) => s.authReady);
  const toast = useApp((s) => s.toast);
  const logout = useApp((s) => s.logout);
  const refreshMe = useApp((s) => s.refreshMe);
  const d = useDesktop();
  const [clock, setClock] = useState(() => new Date());
  const [sel, setSel] = useState<string | null>(null);
  const [wall, setWall] = useState<string>(() => localStorage.getItem("vk_duvar") ?? "gece");
  const [iconSmall, setIconSmall] = useState<boolean>(() => localStorage.getItem("vk_icon_small") === "1");
  const [ctx, setCtx] = useState<{ x: number; y: number } | null>(null);
  const [ctxDlg, setCtxDlg] = useState<null | "sistem" | "cozunurluk">(null);
  const bootRef = useRef(false);
  const coarse = useMemo(
    () => typeof window !== "undefined" && window.matchMedia?.("(pointer: coarse)").matches,
    []
  );
  // GERÇEK program modu: bu pencere hangi rotayı gösteriyor (lobi katları yerinde değişir)
  const [winRoute, setWinRoute] = useState<Route | null>(() => (ELECTRON ? parseWinRoute() : null));

  useEffect(() => {
    if (!ELECTRON) return;
    const onHash = () => setWinRoute(parseWinRoute());
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  useEffect(() => {
    if (!ELECTRON) return;
    winCtx.route = winRoute ?? { name: "giris" };
  }, [winRoute]);

  // İç geçiş (lobi ↔ salon odası) aynı pencerede olur — pencere boyutu ve
  // başlığı rotaya uyar (klasik istemci davranışı).
  useEffect(() => {
    if (!ELECTRON || !winRoute) return;
    const spec = winSpecFor(winRoute);
    void window.vkElectron?.windowSet(spec.w, spec.h, spec.title);
  }, [winRoute]);

  // Oturum kapandıysa (çıkış / ban) bu içerik penceresi kapanır, küçük giriş penceresi açılır
  useEffect(() => {
    if (!ELECTRON || !winRoute || !authReady) return;
    if (!useApp.getState().me) {
      void window.vkElectron?.open({ name: "giris" }, winSpecFor({ name: "giris" }));
      const t = window.setTimeout(() => void window.vkElectron?.close(), 500);
      return () => window.clearTimeout(t);
    }
  }, [winRoute, authReady, me]);

  // Saat
  useEffect(() => {
    const t = window.setInterval(() => setClock(new Date()), 1000);
    return () => window.clearInterval(t);
  }, []);

  // Ban / çip tazeleme
  useEffect(() => {
    const t = window.setInterval(() => refreshMe(), 6000);
    return () => window.clearInterval(t);
  }, [refreshMe]);

  // Açılış: oturum yoksa Bağlantı penceresi, varsa doğrudan lobi (yalnız web masaüstü)
  useEffect(() => {
    if (ELECTRON || bootRef.current || !useApp.getState().authReady) return;
    bootRef.current = true;
    const st = useDesktop.getState();
    if (st.openedOnce) return;
    st.markOpened();
    const app = useApp.getState();
    if (app.me) st.open({ name: "lobi", floor: 1 });
    else st.open({ name: "giris" });
  }, []);

  // Giriş yapınca kapalıysa Bağlantı penceresi açılır; çıkışta tüm pencereler kapanır
  const prevMe = useRef(me);
  useEffect(() => {
    if (ELECTRON) return;
    if (prevMe.current && !me) {
      // çıkış yapıldı
      useDesktop.getState().closeAll();
      useDesktop.getState().open({ name: "giris" });
    }
    prevMe.current = me;
  }, [me]);

  // ---------- GERÇEK PROGRAM MODU (Electron) ----------
  // Klasik hakkarim istemcisi gibi: küçük Bağlantı penceresi, sonra her rota
  // kendi GERÇEK Windows penceresinde açılır (masa, panel, salon odası…).
  if (ELECTRON && (!winRoute || winRoute.name === "giris")) {
    return (
      <div
        className="fixed inset-0 flex items-center justify-center select-none"
        style={{ background: "#d4d0c8", fontFamily: "Tahoma, 'Segoe UI', sans-serif" }}
      >
        <div
          className="w-[616px] h-[500px] max-w-full max-h-full overflow-hidden bg-[#d4d0c8]"
          style={{
            boxShadow:
              "inset -1px -1px 0 #0a0a0a, inset 1px 1px 0 #fff, inset -2px -2px 0 #808080, inset 2px 2px 0 #dfdfdf, 0 12px 40px rgba(0,0,0,.35)",
          }}
        >
          <BaglantiWindow winId={-1} onClose={() => void window.vkElectron?.close()} />
        </div>
        <GuncellemeDialog show />
      </div>
    );
  }
  if (ELECTRON && winRoute) {
    return (
      <div
        className="fixed inset-0 overflow-hidden"
        style={{ background: "#d4d0c8", fontFamily: "Tahoma, 'Segoe UI', sans-serif" }}
      >
        <WindowBody route={winRoute} winId={-1} onClose={() => void window.vkElectron?.close()} />
        {/* Güncelleme penceresi yalnız giriş/lobi pencerelerinde görünür */}
        <GuncellemeDialog show={winRoute.name === "lobi" || winRoute.name === "giris"} />
      </div>
    );
  }

  // ---------- WEB MASAÜSTÜ (tarayıcı) — sahte Win98 masaüstü ----------

  const openIcon = (ic: DeskIcon) => {
    setSel(ic.label);
    if (ic.action === "baglanti") {
      if (me) d.open({ name: "lobi", floor: 1 });
      else d.open({ name: "giris" });
      return;
    }
    if (ic.action === "cop") {
      useApp.getState().showToast("♻️ Geri dönüşüm kutusu boş.");
      return;
    }
    if (ic.reqLogin && !me) {
      d.open({ name: "giris" });
      useApp.getState().showToast("Önce Bağlan düğmesiyle giriş yapın.");
      return;
    }
    if (ic.reqAdmin && me && !can(me.rank, "mute")) {
      useApp.getState().showToast("Bu bölüm yalnızca yetkililere açıktır.");
      return;
    }
    if (ic.route) d.open(ic.route);
  };

  const hhmm = clock.toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" });
  const ss = clock.toLocaleTimeString("tr-TR", { second: "2-digit" });
  const saat = clock.toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" });
  const [saatHH, saatMM] = saat.split(":");
  const tarih = clock.toLocaleDateString("tr-TR", { day: "numeric", month: "long", year: "numeric", weekday: "long" });
  const wallUrl = WALLPAPERS.find((w) => w.id === wall)?.url ?? WALLPAPERS[0].url;

  return (
    <div
      className="fixed inset-0 overflow-hidden"
      style={{
        background: `#3a6ea5 url(${wallUrl}) center/cover no-repeat`,
        fontFamily: "Tahoma, 'Segoe UI', sans-serif",
      }}
      onContextMenu={(e) => {
        e.preventDefault();
        d.setStart(false);
        setCtx({ x: Math.min(e.clientX, window.innerWidth - 220), y: Math.min(e.clientY, window.innerHeight - 180) });
      }}
      onPointerDown={(e) => {
        if (e.target === e.currentTarget) setSel(null);
        d.setStart(false);
        setCtx(null);
      }}
    >
      {/* Masaüstü simgeleri */}
      <div className="absolute left-1 top-1 bottom-11 w-[104px] flex flex-col flex-wrap content-start gap-0">
        {ICONS.filter((ic) => !(ic.reqAdmin && me && !can(me.rank, "mute"))).map((ic) => (
          <button
            key={ic.label}
            className={`w-[96px] p-1 flex flex-col items-center gap-[2px] rounded-[3px] ${
              sel === ic.label ? "bg-[#0a58c8]/50 outline outline-1 outline-[#7fa8e8]" : ""
            }`}
            onPointerDown={(e) => e.stopPropagation()}
            onClick={() => openIcon(ic)}
            onDoubleClick={() => openIcon(ic)}
            title={ic.label}
          >
            {ic.icon.startsWith("/") ? (
              <img
                src={ic.icon}
                alt=""
                className={`${iconSmall ? "w-[26px] h-[26px]" : "w-[38px] h-[38px]"} object-cover rounded-[4px] drop-shadow`}
              />
            ) : ic.icon.startsWith("win:") ? (
              <span className={`flex items-center justify-center ${iconSmall ? "w-[26px] h-[26px]" : "w-[38px] h-[38px]"}`}>
                <WinIcon name={ic.icon.slice(4) as WinIconName} size={iconSmall ? 26 : 38} />
              </span>
            ) : (
              <span className={`${iconSmall ? "text-[20px]" : "text-[30px]"} leading-none drop-shadow`}>{ic.icon}</span>
            )}
            <span
              className="text-[10px] text-white leading-tight text-center"
              style={{ textShadow: "0 1px 2px rgba(0,0,0,.9)" }}
            >
              {ic.label}
            </span>
          </button>
        ))}
      </div>

      {/* Masaüstü bağlam menüsü (sağ tık) */}
      {ctx && (
        <div
          className="absolute z-[10002] w-[236px] py-1 bg-[#d4d0c8]"
          style={{
            left: ctx.x,
            top: ctx.y,
            boxShadow: "inset -1px -1px 0 #0a0a0a, inset 1px 1px 0 #fff, inset -2px -2px 0 #808080, inset 2px 2px 0 #dfdfdf, 3px 4px 14px rgba(0,0,0,.5)",
          }}
          onPointerDown={(e) => e.stopPropagation()}
        >
          <CtxHeader>Yeni</CtxHeader>
          <CtxItem
            icon="win:dice"
            label="101 Okey Masası"
            onClick={() => {
              if (me) d.open({ name: "oyun", game: "yuzbir" });
              else d.open({ name: "giris" });
              setCtx(null);
            }}
            hint={!me ? "giriş gerekli" : undefined}
          />
          <CtxItem
            icon="💬"
            label="Sohbet Penceresi"
            onClick={() => {
              if (me) d.open({ name: "sohbet", room: "yardim" });
              else d.open({ name: "giris" });
              setCtx(null);
            }}
            hint={!me ? "giriş gerekli" : undefined}
          />
          <CtxItem
            icon="🏠"
            label="Ana Salon"
            onClick={() => {
              if (me) d.open({ name: "lobi", floor: 1 });
              else d.open({ name: "giris" });
              setCtx(null);
            }}
            hint={!me ? "giriş gerekli" : undefined}
          />

          <div className="my-1 border-t border-[#aca899]" />
          <CtxHeader>Görünüm</CtxHeader>
          <CtxItem
            icon="⬜"
            label="Büyük İkonlar"
            check={!iconSmall}
            onClick={() => {
              setIconSmall(false);
              localStorage.setItem("vk_icon_small", "0");
              setCtx(null);
            }}
          />
          <CtxItem
            icon="▪️"
            label="Küçük İkonlar"
            check={iconSmall}
            onClick={() => {
              setIconSmall(true);
              localStorage.setItem("vk_icon_small", "1");
              setCtx(null);
            }}
          />

          <div className="my-1 border-t border-[#aca899]" />
          <CtxItem
            icon={d.radioOn ? "🔊" : "🔇"}
            label={`Radyo: ${d.radioOn ? "Açık" : "Kapalı"}`}
            check={d.radioOn}
            onClick={() => {
              d.setRadio(!d.radioOn);
              setCtx(null);
            }}
          />
          <CtxItem
            icon="win:refresh"
            label="Yenile"
            onClick={() => {
              setCtx(null);
              window.location.reload();
            }}
          />
          <CtxItem
            icon="win:monitor"
            label="Ekran Çözünürlüğü…"
            onClick={() => {
              setCtx(null);
              setCtxDlg("cozunurluk");
            }}
          />
          <CtxItem
            icon="ℹ️"
            label="Sistem Özellikleri…"
            onClick={() => {
              setCtx(null);
              setCtxDlg("sistem");
            }}
          />

          <div className="my-1 border-t border-[#aca899]" />
          <CtxHeader>Duvar Kağıdı</CtxHeader>
          {WALLPAPERS.map((wp) => (
            <CtxItem
              key={wp.id}
              icon="🖼️"
              label={wp.label}
              check={wall === wp.id}
              onClick={() => {
                setWall(wp.id);
                localStorage.setItem("vk_duvar", wp.id);
                setCtx(null);
              }}
            />
          ))}

          <div className="my-1 border-t border-[#aca899]" />
          <CtxItem
            icon="win:recycle"
            label="Tüm Pencereleri Kapat"
            onClick={() => {
              d.closeAll();
              if (!me) d.open({ name: "giris" });
              setCtx(null);
            }}
          />
          <CtxItem
            icon="⏻"
            label="Bilgisayarı Kapat…"
            onClick={() => {
              setCtx(null);
              d.setShutdown(true);
            }}
          />
        </div>
      )}

      {/* Pencereler */}
      {d.windows.map((w) => (
        <Win98Window key={w.id} win={w}>
          <WindowBody route={w.route} winId={w.id} onClose={() => d.close(w.id)} />
        </Win98Window>
      ))}

      {/* Büyük masaüstü saati (sol üst simgelerin altında değil — sağ üst gadget) */}
      <div className="absolute right-4 top-4 z-[10] pointer-events-none select-none text-right">
        <div
          className="px-5 py-3 rounded-2xl"
          style={{
            background: "linear-gradient(180deg, rgba(8,16,34,.78) 0%, rgba(4,10,22,.85) 100%)",
            border: "1px solid rgba(255,255,255,.22)",
            boxShadow: "0 10px 30px rgba(0,0,0,.45), inset 0 1px 0 rgba(255,255,255,.15)",
          }}
        >
          <div
            className="text-[52px] leading-none font-black text-white tabular-nums tracking-wide"
            style={{ textShadow: "0 2px 10px rgba(0,0,0,.7), 0 0 24px rgba(96,165,250,.35)" }}
          >
            {saatHH}
            <span className="text-sky-300 animate-pulse mx-[2px]">:</span>
            {saatMM}
          </div>
          <div className="text-[12px] text-sky-100/90 font-semibold mt-[6px] capitalize leading-tight">
            {tarih}
          </div>
          <div className="text-[10px] text-white/60 mt-[2px]">
            {ss} sn · hasokey.com.tr Masaüstü
          </div>
        </div>
      </div>

      {/* Başlat menüsü */}
      {d.startOpen && (
        <div
          className="absolute left-0 bottom-10 w-[280px] z-[9999] flex flex-col"
          style={{
            background: "#d4d0c8",
            boxShadow: "inset -1px -1px 0 #0a0a0a, inset 1px 1px 0 #fff, inset -2px -2px 0 #808080, inset 2px 2px 0 #dfdfdf, 3px 4px 16px rgba(0,0,0,.5)",
          }}
          onPointerDown={(e) => e.stopPropagation()}
        >
          <div
            className="flex items-center gap-2 p-2"
            style={{ background: "linear-gradient(180deg,#3f8cf3 0%,#0a55c8 60%,#0b53c4 100%)" }}
          >
            <img src="/masaustu/bocek.jpg" alt="" className="w-9 h-9 rounded-[4px] object-cover border border-white/70" />
            <span className="text-white font-bold text-[13px]">{me ? me.nick : "Misafir"}</span>
          </div>
          <div className="flex-1 py-1">
            <StartItem icon="win:monitor" label="Bağlantı / Giriş" onClick={() => (me ? d.open({ name: "lobi", floor: 1 }) : d.open({ name: "giris" }))} />
            <StartItem icon="win:home" label="Ana Salon (1. Kat)" onClick={() => (me ? d.open({ name: "lobi", floor: 1 }) : d.open({ name: "giris" }))} reqLogin={!me} />
            <StartItem icon="win:okey" label="101 Okey Masası" onClick={() => d.open({ name: "oyun", game: "yuzbir" })} reqLogin={!me} />
            <StartItem icon="win:cards" label="Okey Masası" onClick={() => d.open({ name: "oyun", game: "okey" })} reqLogin={!me} />
            <StartItem icon="win:globe" label="34 / 51 Çevrimiçi" onClick={() => d.open({ name: "oyunOnline", game: "otuzdort" })} reqLogin={!me} />
            <StartItem icon="win:playcard" label="Batak" onClick={() => d.open({ name: "oyun", game: "batak" })} reqLogin={!me} />
            <StartItem icon="win:domino" label="Domino" onClick={() => d.open({ name: "oyun", game: "domino" })} reqLogin={!me} />
            <div className="my-1 border-t border-[#aca899]" />
            <StartItem icon="win:chat" label="Sohbet (Yardım)" onClick={() => d.open({ name: "sohbet", room: "yardim" })} reqLogin={!me} />
            <StartItem icon="win:key" label="Salon Kiralama" onClick={() => d.open({ name: "kira" })} reqLogin={!me} />
            <StartItem icon="win:crown" label="Gold Üyelik" onClick={() => d.open({ name: "gold" })} reqLogin={!me} />
            <StartItem icon="win:download" label="Oyunu İndir" onClick={() => d.open({ name: "indir" })} />
            {me && can(me.rank, "mute") && (
              <StartItem icon="win:gear" label="Yönetim Paneli" onClick={() => d.open({ name: "panel" })} />
            )}
          </div>
          <div className="flex justify-end gap-2 p-2 border-t border-[#aca899]">
            <ClassicSmallBtn
              onClick={() => {
                if (me) logout();
                else d.open({ name: "giris" });
              }}
            >
              {me ? "Çıkış Yap" : "Giriş"}
            </ClassicSmallBtn>
            <ClassicSmallBtn onClick={() => d.setShutdown(true)}>Bilgisayarı Kapat</ClassicSmallBtn>
          </div>
        </div>
      )}

      {/* Görev çubuğu */}
      <div
        className="absolute left-0 right-0 bottom-0 h-10 flex items-center gap-1 px-1 z-[9998]"
        style={{ background: "linear-gradient(180deg,#3c81f3 0%,#1c62d4 9%,#256fe0 18%,#1e5fcf 60%,#17539f 100%)", boxShadow: "0 -1px 4px rgba(0,0,0,.35)" }}
        onPointerDown={(e) => e.stopPropagation()}
      >
        <button
          className="h-[30px] px-3 flex items-center gap-2 rounded-r-[14px] rounded-l-[6px] text-white font-black text-[14px] italic"
          style={{ background: "linear-gradient(180deg,#7fca4f 0%,#4b9e1e 45%,#357a12 100%)", textShadow: "0 1px 2px rgba(0,0,0,.5)", boxShadow: "inset 0 1px 0 rgba(255,255,255,.5)" }}
          onClick={() => d.setStart(!d.startOpen)}
        >
          <img src="/masaustu/bocek.jpg" alt="" className="w-[18px] h-[18px] rounded-full object-cover" />
          Başlat
        </button>
        <div className="flex-1 flex items-center gap-1 overflow-hidden">
          {d.windows.map((w) => {
            const top = Math.max(...d.windows.map((x) => x.z));
            const active = w.z === top && !w.min;
            return (
              <button
                key={w.id}
                onClick={() => (w.min || !active ? d.focus(w.id) : d.toggleMin(w.id))}
                className={`h-[28px] min-w-0 max-w-[172px] flex-1 flex items-center gap-1.5 px-2 text-[11px] text-white rounded-[3px] ${
                  active ? "bg-[#1c4fa8] shadow-inner" : "bg-[#3a7ae4]/70 hover:bg-[#4a86ee]/80"
                }`}
                style={{ boxShadow: active ? "inset 1px 1px 2px rgba(0,0,0,.5)" : "inset 0 1px 0 rgba(255,255,255,.25)" }}
                title={w.title}
              >
                {w.icon.startsWith("/") ? (
                  <img src={w.icon} alt="" className="w-[14px] h-[14px] rounded-[2px] object-cover shrink-0" />
                ) : (
                  <span className="shrink-0">{w.icon}</span>
                )}
                <span className="truncate">{w.title}</span>
              </button>
            );
          })}
        </div>
        <div
          className="h-[30px] px-2 flex items-center gap-2 text-white text-[11px] rounded-l-[10px]"
          style={{ background: "linear-gradient(180deg,#2f7fe8 0%,#1550b8 60%,#1246a0 100%)", boxShadow: "inset 1px 1px 0 rgba(255,255,255,.3)" }}
        >
          <span title="Ses">{d.radioOn ? "🔊" : "🔇"}</span>
          {d.radioOn && <span title="Radyo açık">📻</span>}
          {me && <span title={me.nick}>👤</span>}
          <span className="font-black tabular-nums text-[13px]">{hhmm}</span>
          <span className="text-[10px] font-bold opacity-80 tabular-nums">:{ss}</span>
        </div>
      </div>

      {/* Toast */}
      {toast && (
        <div className="absolute bottom-12 left-1/2 -translate-x-1/2 z-[10000]">
          <div
            className="bg-[#d4d0c8] text-black text-[12px] px-4 py-2 font-bold"
            style={{ boxShadow: "inset -1px -1px 0 #0a0a0a, inset 1px 1px 0 #fff, inset -2px -2px 0 #808080, inset 2px 2px 0 #dfdfdf, 2px 3px 10px rgba(0,0,0,.4)" }}
          >
            {toast}
          </div>
        </div>
      )}

      {/* Masaüstü diyalogları: sistem özellikleri / çözünürlük */}
      {ctxDlg === "sistem" && (
        <DeskDlg title="Sistem Özellikleri" onClose={() => setCtxDlg(null)}>
          <div className="flex gap-3">
            <img src="/masaustu/bocek.jpg" alt="" className="w-14 h-14 rounded object-cover border border-[#7f9db9]" />
            <div className="text-[11px] space-y-[3px] leading-tight">
              <p className="font-black text-[12px]">hasokey.com.tr Masaüstü</p>
              <p>Sürüm: 1.43.99999-2026.02</p>
              <p>Tescil No: IEE-29-39052007</p>
              <p>
                İşlemci: {(window as unknown as { vkElectron?: { versions: { electron: string } } }).vkElectron
                  ? `Electron ${(window as unknown as { vkElectron: { versions: { electron: string } } }).vkElectron.versions.electron} (Chromium çekirdek`
                  : "Tarayıcı Çekirdeği"}{" "}
                {typeof navigator !== "undefined" && navigator.hardwareConcurrency
                  ? navigator.hardwareConcurrency
                  : 4}{" "}
                mantıksal çekirdek)
              </p>
              <p>Ekran: {window.innerWidth} × {window.innerHeight} piksel</p>
              <p>Oturum: {me ? `${me.nick} — ${me.rank}${me.gold ? " (Gold ★)" : ""}` : "Misafir"}</p>
              <p className="text-[#070] font-bold">Sunucu: Youbase D1 — çevrimiçi</p>
            </div>
          </div>
          <div className="flex justify-end pt-3">
            <ClassicSmallBtn onClick={() => setCtxDlg(null)}>Tamam</ClassicSmallBtn>
          </div>
        </DeskDlg>
      )}
      {ctxDlg === "cozunurluk" && (
        <DeskDlg title="Ekran Çözünürlüğü" onClose={() => setCtxDlg(null)}>
          <p className="text-[11px] leading-tight">
            Geçerli çözünürlük: <b>{window.innerWidth} × {window.innerHeight}</b> piksel.
            <br />
            Program penceresine bağlıdır — tüm ekran için aşağıdaki düğmeyi kullanın.
          </p>
          <div className="flex justify-end gap-2 pt-3">
            <ClassicSmallBtn
              onClick={() => {
                if (document.fullscreenElement) void document.exitFullscreen();
                else void document.documentElement.requestFullscreen?.().catch(() => undefined);
              }}
            >
              Tam Ekran
            </ClassicSmallBtn>
            <ClassicSmallBtn onClick={() => setCtxDlg(null)}>Tamam</ClassicSmallBtn>
          </div>
        </DeskDlg>
      )}

      {/* Kapatma ekranı */}
      {d.shutdown && (
        <div className="absolute inset-0 z-[10001] flex items-center justify-center" style={{ background: "#3a6ea5" }}>
          <div
            className="bg-[#d4d0c8] w-[340px] p-5 text-center"
            style={{ boxShadow: "inset -1px -1px 0 #0a0a0a, inset 1px 1px 0 #fff, inset -2px -2px 0 #808080, inset 2px 2px 0 #dfdfdf, 4px 6px 24px rgba(0,0,0,.5)" }}
          >
            <p className="text-[13px] font-black mb-1">hasokey.com.tr Masaüstü</p>
            <p className="text-[11px] mb-4">Bilgisayarınız güvenli şekilde kapatıldı.</p>
            <div className="flex justify-center gap-2">
              <ClassicSmallBtn onClick={() => d.setShutdown(false)}>Yeniden Başlat</ClassicSmallBtn>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function StartItem({
  icon,
  label,
  onClick,
  reqLogin,
}: {
  icon: string;
  label: string;
  onClick: () => void;
  reqLogin?: boolean;
}) {
  return (
    <button
      className="w-full flex items-center gap-2.5 px-3 py-[5px] text-[12px] text-black hover:bg-[#2f71cd] hover:text-white text-left"
      onClick={onClick}
    >
      <span className="w-[20px] flex justify-center shrink-0">
        {icon.startsWith("win:") ? <WinIcon name={icon.slice(4) as WinIconName} size={17} /> : icon}
      </span>
      <span className="flex-1 truncate">{label}</span>
      {reqLogin && <span className="text-[9px] opacity-70">giriş gerekli</span>}
    </button>
  );
}

function ClassicSmallBtn({ children, onClick }: { children: React.ReactNode; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="px-3 h-[24px] text-[11px] font-bold text-black bg-[#d4d0c8] active:translate-y-px"
      style={{
        boxShadow: "inset -1px -1px 0 #0a0a0a, inset 1px 1px 0 #fff, inset -2px -2px 0 #808080, inset 2px 2px 0 #dfdfdf",
      }}
    >
      {children}
    </button>
  );
}

function CtxHeader({ children }: { children: React.ReactNode }) {
  return (
    <div className="px-3 pt-1 pb-[2px] text-[10px] font-bold text-[#555] uppercase tracking-wide">
      {children}
    </div>
  );
}

/** Bağlam menüsü satırı — işaretleme (✓) sütunu klasik menü tarzı */
function CtxItem({
  icon,
  label,
  onClick,
  check,
  hint,
}: {
  icon: string;
  label: string;
  onClick: () => void;
  check?: boolean;
  hint?: string;
}) {
  return (
    <button
      className="w-full flex items-center gap-2 pl-2 pr-3 py-[4px] text-[11px] text-black text-left hover:bg-[#2f71cd] hover:text-white group"
      onClick={onClick}
    >
      <span className="w-[13px] text-center font-bold shrink-0">{check ? "✓" : "\u00a0"}</span>
      <span className="w-[16px] flex justify-center shrink-0">
        {icon.startsWith("win:") ? <WinIcon name={icon.slice(4) as WinIconName} size={15} /> : icon}
      </span>
      <span className="flex-1 truncate">{label}</span>
      {hint && <span className="text-[9px] opacity-70 shrink-0">{hint}</span>}
    </button>
  );
}

/** Masaüstü ortak diyalog penceresi (klasik gri çerçeve) */
function DeskDlg({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="absolute inset-0 z-[10003] flex items-start justify-center pt-24 bg-black/20" onClick={onClose}>
      <div
        className="bg-[#d4d0c8] w-[360px] max-w-[92%]"
        style={{
          boxShadow:
            "inset -1px -1px 0 #0a0a0a, inset 1px 1px 0 #fff, inset -2px -2px 0 #808080, inset 2px 2px 0 #dfdfdf, 4px 6px 20px rgba(0,0,0,.5)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className="flex items-center justify-between h-[22px] px-1.5"
          style={{ background: "linear-gradient(180deg,#3f8cf3 0%,#0a55c8 8%,#0b53c4 40%,#1c6ee4 88%,#2b7cf0 100%)" }}
        >
          <span className="text-white text-[11px] font-bold">{title}</span>
          <button
            className="w-[17px] h-[15px] text-[9px] font-bold text-white"
            style={{ background: "linear-gradient(180deg,#f08a72 0%,#d13c1d 45%,#b02a10 100%)" }}
            onClick={onClose}
          >
            ✕
          </button>
        </div>
        <div className="p-3" style={{ fontFamily: "Tahoma, sans-serif" }}>
          {children}
        </div>
      </div>
    </div>
  );
}
