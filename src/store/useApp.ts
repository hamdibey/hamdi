import { create } from "zustand";
import type { GameId, Profile } from "../lib/types";
import { sunucu } from "../lib/sunucu";
import { api, getToken, setToken, toProfile } from "../lib/api";
import { useDesktop } from "./useDesktop";

export type Route =
  | { name: "site" }
  | { name: "masaustu" }
  | { name: "giris" }
  | { name: "lobi"; floor?: number }
  | { name: "salon"; game: GameId }
  | { name: "oyun"; game: GameId }
  | { name: "oyunOnline"; game: "otuzdort" | "ellibir" }
  | { name: "sohbet"; room: "yardim" | "yoneticiler" }
  | { name: "kira" }
  | { name: "salonRoom"; floor: number; slot: number }
  | { name: "panel" }
  | { name: "yonetim"; salon: string; floor: number; slot: number }
  | { name: "profil"; nick: string }
  | { name: "gold" }
  | { name: "indir" };

interface AppState {
  me: Profile | null;
  authReady: boolean; // oturum kontrolü tamamlandı mı
  route: Route;
  tableGame: GameId | null; // kurulan masanın oyunu
  /** Oyuncunun oturduğu DB masa kimliği — oyun sayfasından çıkınca leaveTable çağrılır */
  activeTable: number | null;
  setActiveTable: (id: number | null) => void;
  /** Oyuncunun oturduğu masadaki rakip isimler (botlar dahil) — oyun sayfaları AI'ı bu isimlerle oynatır */
  tableOpponents: string[];
  setTableOpponents: (names: string[]) => void;
  toast: string | null;
  /** Giriş veya kayıt: hata mesajı döner, başarızsa null */
  login: (nick: string, password: string, mode: "login" | "register", gender?: "e" | "k", email?: string, country?: string, city?: string) => Promise<string | null>;
  logout: () => void;
  restoreSession: () => Promise<void>;
  go: (r: Route) => void;
  setTableGame: (g: GameId | null) => void;
  refreshMe: () => void;
  /** Profili her zaman DB'den tazeler (işlem sonrası anında güncelleme için) */
  syncMe: () => Promise<void>;
  showToast: (t: string) => void;
  /** Açık özel mesaj pencereleri (nick listesi) */
  pmPeers: string[];
  openPm: (nick: string) => void;
  closePm: (nick: string) => void;
}

let lastApiMe = 0;

// ÇOKLU PENCERE (v1.44.26): masa kimliği/oyunu/rakipler AYNI nick oturumundaki
// tüm pencereler arasında paylaşılır — aksi halde salon penceresinde kurulan masa
// yeni açılan oyun penceresinde görünmez ve "masa açılmıyor" olur.
const LS_TABLE_KEY = "vk_active_table";
const LS_GAME_KEY = "vk_table_game";
const LS_OPP_KEY = "vk_table_opp";
function lsGet(k: string): string | null {
  try { return localStorage.getItem(k); } catch { return null; }
}
function lsSet(k: string, v: string | null) {
  try { if (v == null) localStorage.removeItem(k); else localStorage.setItem(k, v); } catch { /* yok sayılır */ }
}
function readTable(): number | null {
  const v = lsGet(LS_TABLE_KEY);
  const n = v ? Number(v) : 0;
  return Number.isFinite(n) && n > 0 ? n : null;
}
function readGame(): GameId | null {
  return (lsGet(LS_GAME_KEY) as GameId | null) ?? null;
}
function readOpp(): string[] {
  try { const v = lsGet(LS_OPP_KEY); return v ? (JSON.parse(v) as string[]) : []; } catch { return []; }
}

function isNarrow() {
  return typeof window !== "undefined" && window.innerWidth < 768;
}

export const useApp = create<AppState>((set, get) => ({
  me: null,
  authReady: false,
  // Masaüstü (Windows platformu) varsayılan giriş; dar ekranda klasik web girişi.
  // #masaustu hash'i verilirse (kurulum ikonu / program kısayolu) doğrudan masaüstü paneli açılır.
  route: (typeof window !== "undefined" && window.location.hash.startsWith("#masaustu")
    ? { name: "masaustu" }
    : { name: "site" }) as Route,
  tableGame: readGame(),
  activeTable: readTable(),
  setActiveTable: (id) => {
    lsSet(LS_TABLE_KEY, id == null ? null : String(id));
    set({ activeTable: id });
  },
  tableOpponents: readOpp(),
  setTableOpponents: (names) => {
    lsSet(LS_OPP_KEY, JSON.stringify(names));
    set({ tableOpponents: names });
  },
  toast: null,
  pmPeers: [],
  openPm: (nick) =>
    set((st) =>
      st.pmPeers.includes(nick) ? st : { pmPeers: [...st.pmPeers.slice(-2), nick] }
    ),
  closePm: (nick) => set((st) => ({ pmPeers: st.pmPeers.filter((n) => n !== nick) })),
  login: async (nick, password, mode, gender, email, country, city) => {
    const clean = nick.trim().slice(0, 20);
    if (clean.length < 3) return "Nick en az 3 karakter olmalı.";
    if (password.length < 4) return "Şifre en az 4 karakter olmalı.";
    if (mode === "register") {
      // Zorunlu üyelik alanları — e-posta / ülke / şehir
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test((email ?? "").trim()))
        return "Geçerli bir e-posta adresi girin (zorunlu).";
      if ((country ?? "").trim().length < 2) return "Ülke zorunludur.";
      if ((city ?? "").trim().length < 2) return "Şehir zorunludur.";
    }
    try {
      const r =
        mode === "register"
          ? await api.register(clean, password, gender ?? "e", (email ?? "").trim(), (country ?? "").trim(), (city ?? "").trim())
          : await api.login(clean, password);
      set({
        me: toProfile(r.user),
        // Masaüstündeyken rota korunur (pencereler zaten açık)
        route: get().route.name === "masaustu" ? get().route : { name: "lobi" },
        authReady: true,
      });
      // Sohbetin canlı olması için yerel sunucu katmanına da bot profili ekle
      sunucu.login(clean);
      return null;
    } catch (e) {
      return e instanceof Error ? e.message : "Giriş yapılamadı.";
    }
  },
  logout: () => {
    void api.logout();
    setToken(null);
    // Web'de çıkış yapınca herkese açık site ana sayfasına dönülür (programdan çıkışta masaüstü korunur)
    set({ me: null, route: get().route.name === "masaustu" ? get().route : { name: "site" }, tableGame: null });
  },
  restoreSession: async () => {
    if (!getToken()) {
      set({ authReady: true });
      return;
    }
    try {
      const r = await api.me();
      lastApiMe = Date.now();
      if (r.user.banned) {
        setToken(null);
        set({
          authReady: true,
          toast: "Banlandığınız için oturumunuz kapatıldı.",
          route: get().route.name === "masaustu" ? get().route : { name: "giris" },
        });
        return;
      }
      set({ me: toProfile(r.user), authReady: true });
      sunucu.login(r.user.nick);
    } catch {
      setToken(null);
      set({ authReady: true, route: get().route.name === "masaustu" ? get().route : { name: "giris" } });
    }
  },
  go: (r) => {
    // Masaüstü platformundayken uygulama rotaları masaüstünde pencere olarak açılır
    if (r.name === "masaustu" || get().route.name === "masaustu") {
      if (r.name === "masaustu") {
        set({ route: r });
        return;
      }
      useDesktop.getState().open(r);
      return;
    }
    set({ route: r });
  },
  setTableGame: (g) => {
    lsSet(LS_GAME_KEY, g ?? null);
    set({ tableGame: g });
  },
  refreshMe: () => {
    const me = get().me;
    if (!me) return;
    // Yerel sunucu katmanı (botlar, çoklu sekme) kontrolü
    const fresh = sunucu.getState().profiles[me.id];
    if (fresh?.banned) {
      set({
        me: null,
        route: get().route.name === "masaustu" ? get().route : { name: "giris" },
        toast: "Banlandığınız için çıkarıldınız.",
      });
      return;
    }
    // Backend'ten en fazla 20 sn'de bir taze profili çek (susturma/ban/çip)
    if (Date.now() - lastApiMe < 20_000 || !getToken()) return;
    lastApiMe = Date.now();
    void api
      .me()
      .then((r) => {
        if (r.user.banned) {
          setToken(null);
          set({
            me: null,
            route: get().route.name === "masaustu" ? get().route : { name: "giris" },
            toast: "Banlandığınız için oturumunuz kapatıldı.",
          });
        } else {
          set({ me: toProfile(r.user) });
        }
      })
      .catch(() => {
        /* kısa süreli ağ hatası göz ardı edilir */
      });
  },
  syncMe: async () => {
    try {
      const r = await api.me();
      lastApiMe = Date.now();
      set({ me: toProfile(r.user) });
    } catch {
      /* kısa süreli bağlantı hatası göz ardı edilir */
    }
  },
  showToast: (t) => {
    set({ toast: t });
    window.setTimeout(() => {
      if (get().toast === t) set({ toast: null });
    }, 3200);
  },
}));