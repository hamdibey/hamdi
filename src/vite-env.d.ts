/* eslint-disable @typescript-eslint/no-explicit-any */
/// <reference types="vite/client" />

declare global {
  /** Gömülü uygulama sürümü (vite.config.ts define — package.json sürümü). */
  const __VK_SURUM__: string;

  interface Window {
    vkElectron?: VkElectron;
  }
}

/** Electron masaüstü programı — gerçek OS penceresi + güncelleme kontrolü. */
export interface VkElectron {
  isElectron: true;
  versions: { electron: string; chrome: string; node: string };
  open: (route: unknown, spec: unknown) => Promise<void>;
  /** Yeni NICK penceresi — ayrı oturum, aynı PC'de 25'e kadar aynı anda. */
  openNick: () => Promise<{ ok: boolean; nickNo?: number; error?: string }>;
  close: () => Promise<void>;
  /** Pencereyi rota geçişine göre boyutlandır/başlıklansın (lobi ↔ salon odası). */
  windowSet: (w: number, h: number, title?: string) => Promise<void>;
  /** Yeni sürüm bulunduğunda çağrılır — kaldırma fonksiyonu döner. */
  onUpdate: (cb: (info: { surum: string; mesaj?: string; url?: string }) => void) => () => void;
  /** İndirme yüzdesi (0-100), 101 = paket açılıyor, 102 = kurulum başlayacak. */
  onUpdateProgress: (cb: (pct: number) => void) => () => void;
  /** Sunucudaki sürümü hemen kontrol et. */
  updateCheck: () => Promise<void>;
  /** Güncellemeyi indir, aç ve kurulum betiğini hazırla (program kapanır). */
  updateRun: () => Promise<{ ok: boolean }>;
}

export {};
