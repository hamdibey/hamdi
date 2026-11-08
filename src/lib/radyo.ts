// ---------------------------------------------------------------------------
// Gerçek radyo çalar — herhangi bir URL'den (mp3/aac/stream) yayın çalar.
// Kullanıcı istediği radyonun URL'ini girer, salon bandında gerçekten çalar.
// ---------------------------------------------------------------------------
let audio: HTMLAudioElement | null = null;

/** Çalan radyo durumu ( salon bandı rozeti için ) */
export interface RadyoDurum {
  caliyor: boolean;
  url: string;
  istasyon: string;
  hata?: string;
}

const LS_KEY = "vk_radyo_url";
const LS_ST = "vk_radyo_istasyon";

export const radyoKayitliUrl = () => localStorage.getItem(LS_KEY) ?? "";
export const radyoKayitliIstasyon = () => localStorage.getItem(LS_ST) ?? "";

/** URL'yi kaydet (sonraki açılışta hatırlanır) */
export function radyoUrlKaydet(url: string, istasyon: string) {
  localStorage.setItem(LS_KEY, url.trim());
  localStorage.setItem(LS_ST, istasyon.trim());
}

/** Verilen URL'den yayını başlat */
export function radyoBaslat(url: string, istasyon: string, ses: number): RadyoDurum {
  radyoDurdur();
  if (!url.trim()) return { caliyor: false, url: "", istasyon: "", hata: "URL boş" };
  try {
    audio = new Audio(url.trim());
    audio.volume = Math.max(0, Math.min(1, ses / 100));
    audio.crossOrigin = "anonymous";
    void audio.play().catch(() => {
      /* autoplay engeli veya geçersiz URL — durum değişince güncellenir */
    });
    return { caliyor: true, url: url.trim(), istasyon: istasyon.trim() || url.trim() };
  } catch {
    return { caliyor: false, url: "", istasyon: "", hata: "Çalınamadı" };
  }
}

/** Yayını durdur */
export function radyoDurdur() {
  if (audio) {
    try { audio.pause(); } catch { /* yoksay */ }
    audio = null;
  }
}

/** Ses seviyesini canlı ayarla (0-100) */
export function radyoSesAyarla(ses: number) {
  if (audio) audio.volume = Math.max(0, Math.min(1, ses / 100));
}

/** Yayının gerçekten çalıp çalmadığı (ağ hatası vb. kontrolü) */
export function radyoAktifMi(): boolean {
  return !!audio && !audio.paused && !audio.ended;
}
