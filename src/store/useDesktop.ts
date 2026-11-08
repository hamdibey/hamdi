import { create } from "zustand";
import type { Route } from "./useApp";

/** GERÇEK Electron penceresi bağlamı — bu pencere hangi rotayı gösteriyor
 * (lobi katları aynı pencerede yerinde değişsin diye) */
export const winCtx: { route: Route | null } = { route: null };

/** Bu pencere gerçek masaüstü programının (Electron) içinde mi? */
export function isElectronWin(): boolean {
  return typeof window !== "undefined" && !!window.vkElectron?.isElectron;
}

/** Masaüstünde açık pencere — her rota bir pencere (tek örnek) */
export interface DesktopWindow {
  id: number;
  route: Route;
  title: string;
  icon: string; // emoji veya /masaustu/... görseli
  x: number;
  y: number;
  w: number;
  h: number;
  z: number;
  min: boolean;
  max: boolean;
  resizable: boolean;
}

export interface WinSpec {
  title: string;
  icon: string;
  w: number;
  h: number;
  resizable?: boolean;
}

const GAME_TITLES: Record<string, string> = {
  yuzbir: "101 Okey",
  okey: "Okey",
  batak: "Batak",
  domino: "Domino",
  otuzdort: "34 Okey",
  ellibir: "51 Okey",
};

export function winSpecFor(route: Route): WinSpec {
  switch (route.name) {
    case "giris":
      return {
        title: "Bağlantı ( Version 1.43.99999-2026.01)",
        icon: "/masaustu/bocek.jpg",
        w: 648,
        h: 556,
        resizable: false,
      };
    case "lobi":
      return { title: `Ana Salon — ${route.floor ?? 1}. Kat`, icon: "🏠", w: 900, h: 580 };
    case "salonRoom":
      return { title: `Salon Odası — ${route.floor}. Kat / ${route.slot}. Salon`, icon: "🎴", w: 940, h: 580 };
    case "salon":
      return { title: `${GAME_TITLES[route.game] ?? "Salon"} Salonu`, icon: "🎲", w: 880, h: 540 };
    case "oyun":
      return { title: `${GAME_TITLES[route.game] ?? "Oyun"} Masası`, icon: "🀄", w: 800, h: 500 };
    case "oyunOnline":
      return { title: `${GAME_TITLES[route.game] ?? "Oyun"} — Çevrimiçi`, icon: "🌐", w: 800, h: 500 };
    case "sohbet":
      return {
        title: route.room === "yoneticiler" ? "Yöneticiler Sohbeti" : "Yardım Sohbeti",
        icon: "💬",
        w: 820,
        h: 560,
      };
    case "panel":
      return { title: "Yönetim Paneli", icon: "⚙️", w: 820, h: 560 };
    case "yonetim": {
      const [f, s] = route.salon.split("_");
      return { title: `Salon Yönetimi — ${f ?? route.floor}. Kat / ${s ?? route.slot}. Salon`, icon: "🛡️", w: 780, h: 540 };
    }
    case "profil":
      // Referans istemcide profil penceresinin başlığı SADECE nick'tir (KIZILTEPELİ)
      return { title: route.nick, icon: "👤", w: 320, h: 470, resizable: false };
    case "kira":
      return { title: "Salon Kiralama", icon: "🗝️", w: 900, h: 580 };
    case "gold":
      return { title: "Gold Üyelik", icon: "👑", w: 820, h: 560 };
    case "indir":
      return { title: "Oyunu İndir", icon: "📥", w: 900, h: 600 };
    default:
      return { title: "hasokey.com.tr", icon: "🐞", w: 860, h: 560 };
  }
}

function routeKey(route: Route): string {
  return JSON.stringify(route);
}

interface DesktopState {
  windows: DesktopWindow[];
  zTop: number;
  startOpen: boolean;
  shutdown: boolean;
  radioOn: boolean;
  openedOnce: boolean; // açılışta Bağlantı penceresi / oturum penceresi açıldı mı
  open: (route: Route) => void;
  close: (id: number) => void;
  closeAll: () => void;
  focus: (id: number) => void;
  toggleMin: (id: number) => void;
  toggleMax: (id: number) => void;
  setPos: (id: number, x: number, y: number) => void;
  setSize: (id: number, w: number, h: number) => void;
  setStart: (v: boolean) => void;
  setShutdown: (v: boolean) => void;
  setRadio: (v: boolean) => void;
  markOpened: () => void;
}

let nextId = 1;

const TASKBAR_H = 40;

export const useDesktop = create<DesktopState>((set, get) => ({
  windows: [],
  zTop: 100,
  startOpen: false,
  shutdown: false,
  radioOn: true,
  openedOnce: false,
  markOpened: () => set({ openedOnce: true }),
  setStart: (v) => set({ startOpen: v }),
  setShutdown: (v) => set({ shutdown: v }),
  setRadio: (v) => set({ radioOn: v }),
  open: (route) => {
    // GERÇEK masaüstü programı (Electron): her rota kendi OS penceresini açar.
    // Lobi katları ve salon odaları DA artık ayrı ayrı açılabilir (aynı PC'de
    // birden fazla salon/lobi penceresi yan yana açık olur); aynı rota tekrar
    // istenirse ana süreç var olan pencereyi öne alır.
    if (isElectronWin()) {
      void window.vkElectron?.open(route, winSpecFor(route));
      return;
    }
    const key = routeKey(route);
    const st = get();
    const existing = st.windows.find((w) => routeKey(w.route) === key);
    if (existing) {
      set({
        windows: st.windows.map((w) =>
          w.id === existing.id ? { ...w, min: false, z: st.zTop + 1 } : w
        ),
        zTop: st.zTop + 1,
        startOpen: false,
      });
      return;
    }
    const spec = winSpecFor(route);
    const vw = typeof window !== "undefined" ? window.innerWidth : 1280;
    const vh = typeof window !== "undefined" ? window.innerHeight : 800;
    const w = Math.min(spec.w, Math.max(420, vw - 24));
    const h = Math.min(spec.h, Math.max(320, vh - TASKBAR_H - 16));
    const n = st.windows.length;
    const x = Math.max(8, Math.min(28 + (n % 7) * 26, vw - w - 8));
    const y = Math.max(6, Math.min(22 + (n % 7) * 24, vh - TASKBAR_H - h - 6));
    set({
      windows: [
        ...st.windows,
        {
          id: nextId++,
          route,
          title: spec.title,
          icon: spec.icon,
          x,
          y,
          w,
          h,
          z: st.zTop + 1,
          min: false,
          max: false,
          resizable: spec.resizable !== false,
        },
      ],
      zTop: st.zTop + 1,
      startOpen: false,
    });
  },
  close: (id) => set((st) => ({ windows: st.windows.filter((w) => w.id !== id) })),
  closeAll: () => set({ windows: [], startOpen: false }),
  focus: (id) =>
    set((st) => {
      const top = st.windows.reduce((m, w) => Math.max(m, w.z), 0);
      const win = st.windows.find((w) => w.id === id);
      if (!win || win.z === top) return {};
      return {
        windows: st.windows.map((w) => (w.id === id ? { ...w, z: top + 1, min: false } : w)),
        zTop: top + 1,
      };
    }),
  toggleMin: (id) =>
    set((st) => ({ windows: st.windows.map((w) => (w.id === id ? { ...w, min: !w.min } : w)) })),
  toggleMax: (id) =>
    set((st) => ({
      windows: st.windows.map((w) => (w.id === id ? { ...w, max: !w.max } : w)),
    })),
  setPos: (id, x, y) =>
    set((st) => ({ windows: st.windows.map((w) => (w.id === id ? { ...w, x, y } : w)) })),
  setSize: (id, w, h) =>
    set((st) => ({ windows: st.windows.map((x2) => (x2.id === id ? { ...x2, w, h } : x2)) })),
}));
