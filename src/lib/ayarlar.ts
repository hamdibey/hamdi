/**
 * Klasik "Ayarlar" penceresi tercihleri (localStorage.vk_ayarlar).
 * Oyun hızı ayarı oyun motorlarındaki AI gecikmelerini ölçekler.
 */
export type Ayarlar = {
  efekt: boolean;
  radyo: number;
  hiz: "yavas" | "normal" | "hizli";
  emojiler: boolean;
  desen: number;
  /** Sesli görüşme zil sesi türü */
  zil: ZilTuru;
};

/** Sesli görüşme zil sesi türleri (WebAudio ile üretilir — dosya indirmez) */
export type ZilTuru = "klasik" | "melodi" | "ninni" | "cep" | "sessiz";

export const ZIL_TURLERI: { tur: ZilTuru; ad: string }[] = [
  { tur: "klasik", ad: "🔔 Klasik Zil" },
  { tur: "melodi", ad: "🎵 Melodi" },
  { tur: "ninni", ad: "🌙 Ninni" },
  { tur: "cep", ad: "📱 Cep Telefonu" },
  { tur: "sessiz", ad: "🔇 Sessiz" },
];

export const VARSAYILAN_AYARLAR: Ayarlar = {
  efekt: true,
  radyo: 70,
  hiz: "normal",
  emojiler: true,
  desen: 12,
  zil: "klasik",
};

export function ayarlariYukle(): Ayarlar {
  try {
    return { ...VARSAYILAN_AYARLAR, ...JSON.parse(localStorage.getItem("vk_ayarlar") || "{}") };
  } catch {
    return VARSAYILAN_AYARLAR;
  }
}

export function ayarlariKaydet(a: Ayarlar) {
  try {
    localStorage.setItem("vk_ayarlar", JSON.stringify(a));
  } catch {
    /* depolama yok */
  }
}

/**
 * Oyun hızı çarpanı — AI hamle gecikmelerini ölçekler:
 * Yavaş 1.7x (daha uzun bekleme), Normal 1x, Hızlı 0.55x (daha kısa).
 * Oyun sayfaları timer sürelerini bu çarpanla çarpar.
 */
export function oyunHiziCarpani(): number {
  const h = ayarlariYukle().hiz;
  return h === "yavas" ? 1.7 : h === "hizli" ? 0.55 : 1;
}
