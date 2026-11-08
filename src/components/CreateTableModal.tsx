import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import type { GameId } from "../lib/types";

// ---------------------------------------------------------------------------
// Klasik "Masa Kur — Ayarlar" penceresi (hakkarim.net tarzı masa ayarları):
// masa adı, oyun seçimi, cezalı/eğlence/klasman, el sayısı, çarpan + süre.
// ---------------------------------------------------------------------------

/** Çarpan türü — x99/x111 sayaçla hediye, x123/x999 admin + giriş kısıtı */
export type Carpan = 1 | 2 | 4 | 9 | 99 | 111 | 123 | 999;
/** Masa süresi (saat) — çarpan ve krediye göre değişir */
export type MasaSure = 3 | 6 | 12 | 24;

export interface TableSettings {
  masaAdi: string;
  game: GameId;
  cezali: boolean;
  eglence: boolean;
  klasman: boolean;
  esli: boolean; // eşli oyun (2'ye 2)
  artirmali: boolean; // artırmalı — ilk açan 101, diğerleri öncekinin +1'i
  defineli: boolean; // batak: gömmeli — 12'şer kart + 4 definede
  carpan: Carpan; // çarpanlı skor (kredi/süre/kısıt kurallarına tabi)
  sure: MasaSure; // masa süresi (saat) — süre dolunca masa otomatik kapanır
  canak: boolean; // çanak kırılınca yarısı masayı açana (x9/x123/x999)
  hediye: boolean; // sayaç dolunca hediye açılan masa (x99/x111) — kredi kesilmez
  acan: string; // masayı açan oyuncunun nick'i (çanak payı + hediye sayacı için)
  bitisTs: number; // bitiş zaman damgası (ms) — süresi dolunca masa kapanır
  herkes: boolean; // herkes açabilir / oturabilir masa
  elSayisi: number; // 3 | 5 | 7
  sohbet: boolean;
  izleyici: boolean;
  davet: boolean;
}

/** Çarpan × süre kredi bedeli — 0 = kredi gerekmez (normal veya sayaç hediyesi) */
export const CARPAN_KREDI: Record<Carpan, Partial<Record<MasaSure, number>>> = {
  1: { 24: 0 },
  2: { 24: 250 },
  4: { 24: 500 },
  9: { 24: 2000, 12: 750 }, // 12 saatlik x9: x99 sayacını ARTIRMAZ, çanak VERMEZ
  99: {}, // 20 x9 → hediye (sayaçla)
  111: {}, // 7 x99 → hediye (sayaçla)
  123: { 24: 20000, 12: 12000, 6: 7000, 3: 4000 },
  999: { 24: 150000, 12: 85000, 6: 50000, 3: 30000 },
};

/** Her çarpan hangi sürelerle açılabilir */
export const CARPAN_SURELER: Record<Carpan, MasaSure[]> = {
  1: [24],
  2: [24],
  4: [24],
  9: [24, 12],
  99: [24],
  111: [24],
  123: [24, 12, 6, 3],
  999: [24, 12, 6, 3],
};

/** Yalnız ADMIN menüsünden açılabilen süreler (çarpan bazında) */
export const SURE_ADMIN: Record<Carpan, MasaSure[]> = {
  1: [], 2: [], 4: [],
  9: [12],
  99: [], 111: [],
  123: [24, 12],
  999: [24, 12],
};

/** Çanak kuralı olan çarpanlar (12 saatlik x9 hariç — o çanak vermez) */
export function canakVar(carpan: Carpan, sure: MasaSure): boolean {
  if (carpan === 9) return sure === 24;
  return carpan === 123 || carpan === 999;
}

/** Giriş kısıtı: bu çarpana bu puandan yüksek üye OTURAMAZ (top list rekabeti) */
export function girisKisiti(carpan: Carpan): number | null {
  if (carpan === 123) return 120_000_000;
  if (carpan === 999) return 100_000_000;
  return null;
}

/** x99 hediyesi: 20 adet normal (24 saatlik) x9 masa → otomatik x99 hediye */
export const X9_ICIN_GEREKLI = 20;
/** x111 hediyesi: 7 adet x99 masa → otomatik x111 hediye */
export const X99_ICIN_GEREKLI = 7;

export const CARPANLAR: readonly Carpan[] = [1, 2, 4, 9, 99, 111, 123, 999];
const SURELER: readonly MasaSure[] = [24, 12, 6, 3];

const OYUNLAR: readonly (readonly [GameId, string])[] = [
  ["yuzbir", "101 oyunu"],
  ["otuzdort", "34 oyunu"],
  ["ellibir", "51 oyunu"],
  ["okey", "Okey"],
  ["batak", "İhaleli Batak"],
  ["domino", "Domino"],
] as const;

const YAKINDA_OYUNLAR = [
  "Kastet", "Aznır", "Yanık", "Okçin", "Banko (KDVli Okey)",
  "T. Kelimatik", "K. Kelimatik", "T. Harfet", "K. Harfet",
  "T. Harfbank", "K. Harfbank",
];

/** Klasik masa ayarları penceresi — Tamam'a basınca ayarlar döner. */
export function CreateTableModal({
  defaultGame,
  defaultName = "Yeni Masa",
  onConfirm,
  onClose,
}: {
  defaultGame: GameId;
  defaultName?: string;
  onConfirm: (s: TableSettings) => void;
  onClose: () => void;
}) {
  const [masaAdi, setMasaAdi] = useState(defaultName);
  const [game, setGame] = useState<GameId>(defaultGame);
  const [cezali, setCezali] = useState(true);
  const [eglence, setEglence] = useState(false);
  const [klasman, setKlasman] = useState(false);
  const [esli, setEsli] = useState(false);
  const [artirmali, setArtirmali] = useState(false);
  const [defineli, setDefineli] = useState(false);
  const [carpan, setCarpan] = useState<Carpan>(1);
  const [sure, setSure] = useState<MasaSure>(24);
  const [elSayisi, setElSayisi] = useState(3);
  const [sohbet, setSohbet] = useState(true);
  const [izleyici, setIzleyici] = useState(true);
  const [davet, setDavet] = useState(false);

  // Esc ile kapat
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  // Çarpan değişince süreyi uygun değere çek
  const carpanSec = (c: Carpan) => {
    setCarpan(c);
    if (!CARPAN_SURELER[c].includes(sure)) setSure(CARPAN_SURELER[c][0]);
  };

  const kredi = CARPAN_KREDI[carpan][sure] ?? 0;
  const adminSure = SURE_ADMIN[carpan].includes(sure);
  const hediyeAcilis = carpan === 99 || carpan === 111; // sayaç kontrolü masaKur'da yapılır

  const tamam = () =>
    onConfirm({
      masaAdi: masaAdi.trim().slice(0, 30) || "Yeni Masa",
      game, cezali, eglence, klasman, esli, artirmali, defineli,
      carpan, sure,
      canak: canakVar(carpan, sure),
      hediye: false, // hediye durumunu masaKur (sayaç) belirler
      acan: "", // masaKur doldurur
      bitisTs: 0, // masaKur hesaplar
      herkes: false,
      elSayisi, sohbet, izleyici, davet,
    });

  const label = "flex items-center gap-2 text-sm text-ivory cursor-pointer select-none";
  const box = "accent-gold-500 w-4 h-4";

  // body'ye PORTAL: salon AutoFit ile ölçeklenir; modal ölçeğin içinde küçük/
  // kaymış görünüyor ve tıklamalar şaşabiliyordu — artık gerçek boyutta,
  // ekranın tam ortasında açılır.
  return createPortal(
    <div
      className="fixed inset-0 z-[95] bg-black/70 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg rounded-md overflow-hidden border-2 border-gold-700 shadow-pop animate-floatUp"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Pencere başlığı */}
        <div className="flex items-center justify-between px-3 py-1.5 bg-gradient-to-b from-wood-800 to-wood-950 border-b-2 border-gold-700">
          <p className="font-display text-sm font-bold text-gold-300">Masa Ayarları</p>
          <button
            onClick={onClose}
            title="Kapat"
            className="w-5 h-5 rounded-sm bg-red-800 hover:bg-red-700 text-red-100 text-xs font-bold leading-none"
          >
            ×
          </button>
        </div>

        <div className="bg-wood-950 p-4 space-y-4 max-h-[80vh] overflow-y-auto">
          {/* Masa adı */}
          <div>
            <label className="block text-xs font-bold text-gold-500 mb-1">Masa Adı</label>
            <input
              value={masaAdi}
              onChange={(e) => setMasaAdi(e.target.value)}
              maxLength={30}
              autoFocus
              onKeyDown={(e) => e.key === "Enter" && tamam()}
              className="w-full bg-wood-900 border border-wood-700 rounded px-3 py-1.5 text-sm text-ivory focus:outline-none focus:border-gold-600"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Oyun ayarları */}
            <fieldset className="border border-wood-700 rounded px-3 py-2.5">
              <legend className="px-1 text-xs font-bold text-gold-500">Oyun Ayarları</legend>
              <div className="space-y-2">
                <label className={label}>
                  <input type="checkbox" checked={cezali} onChange={(e) => setCezali(e.target.checked)} className={box} />
                  Cezalı
                </label>
                <label className={label}>
                  <input type="checkbox" checked={eglence} onChange={(e) => setEglence(e.target.checked)} className={box} />
                  Eğlence
                </label>
                <label className={label}>
                  <input type="checkbox" checked={klasman} onChange={(e) => setKlasman(e.target.checked)} className={box} />
                  Klasman
                </label>
                <label className={label} title="Oyunu eşli (2'ye 2) oynayabilirsiniz">
                  <input type="checkbox" checked={esli} onChange={(e) => setEsli(e.target.checked)} className={box} />
                  Eşli
                </label>
                <label className={label} title="İlk açan 101, diğerleri öncekinin açtığının bir fazlasını açar">
                  <input type="checkbox" checked={artirmali} onChange={(e) => setArtirmali(e.target.checked)} className={box} />
                  Artırmalı
                </label>
                {game === "batak" && (
                  <label className={label} title="Gömmeli batak: herkese 12 kart, 4 kart definede; ihaleyi alan 4 kartını değiştirir">
                    <input type="checkbox" checked={defineli} onChange={(e) => setDefineli(e.target.checked)} className={box} />
                    Defineli (Gömmeli)
                  </label>
                )}
              </div>

              {/* El sayısı */}
              <div className="mt-4">
                <label className="block text-xs font-bold text-gold-500 mb-1">El Sayısı</label>
                <select
                  value={elSayisi}
                  onChange={(e) => setElSayisi(parseInt(e.target.value))}
                  className="w-full bg-wood-900 border border-wood-700 rounded px-2 py-1.5 text-sm text-ivory focus:outline-none focus:border-gold-600"
                >
                  <option value={3}>3 El</option>
                  <option value={5}>5 El</option>
                  <option value={7}>7 El</option>
                </select>
              </div>
            </fieldset>

            {/* Oyun seçimi */}
            <fieldset className="border border-wood-700 rounded px-3 py-2.5">
              <legend className="px-1 text-xs font-bold text-gold-500">Oyunlar</legend>
              <div className="grid grid-cols-2 gap-x-3 gap-y-1.5">
                {OYUNLAR.map(([id, name]) => (
                  <label key={id} className={label}>
                    <input
                      type="radio"
                      name="oyun"
                      checked={game === id}
                      onChange={() => setGame(id)}
                      className="accent-gold-500 w-3.5 h-3.5"
                    />
                    {name}
                  </label>
                ))}
              </div>
              <p className="mt-2.5 text-[10px] text-ivory-dark/40 leading-relaxed">
                <span className="text-ivory-dark/60 font-bold">Yakında:</span>{" "}
                {YAKINDA_OYUNLAR.join(", ")}
              </p>
            </fieldset>
          </div>

          {/* ── ÇARpanLI OYUN — x1…x999 + süre + kedi ── */}
          <fieldset className="border border-wood-700 rounded px-3 py-2.5">
            <legend className="px-1 text-xs font-bold text-gold-500">Çarpanlı Oyun</legend>
            <div className="flex flex-wrap gap-x-4 gap-y-1.5">
              {CARPANLAR.map((c) => (
                <label key={c} className="flex items-center gap-1.5 text-sm text-ivory cursor-pointer select-none" title={`x${c}`}>
                  <input
                    type="radio"
                    name="carpan"
                    checked={carpan === c}
                    onChange={() => carpanSec(c)}
                    className="accent-gold-500 w-3.5 h-3.5"
                  />
                  <span className={c >= 123 ? "text-gold-400 font-bold" : ""}>x{c}</span>
                  {c === 99 && <span className="text-[9px] text-ivory-dark/50">(20 x9 → hediye)</span>}
                  {c === 111 && <span className="text-[9px] text-ivory-dark/50">(7 x99 → hediye)</span>}
                  {(c === 123 || c === 999) && <span className="text-[9px] text-[#f87171]">(admin)</span>}
                </label>
              ))}
            </div>

            {/* Süre seçimi */}
            <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1.5">
              <span className="text-xs font-bold text-gold-500">Süre:</span>
              {SURELER.filter((s) => CARPAN_SURELER[carpan].includes(s)).map((s) => (
                <label key={s} className="flex items-center gap-1.5 text-sm text-ivory cursor-pointer select-none">
                  <input
                    type="radio"
                    name="sure"
                    checked={sure === s}
                    onChange={() => setSure(s)}
                    className="accent-gold-500 w-3.5 h-3.5"
                  />
                  <span>{s} Saat</span>
                  {SURE_ADMIN[carpan].includes(s) && <span className="text-[9px] text-[#f87171]">(admin)</span>}
                </label>
              ))}
            </div>

            {/* Bedel ve kurallar özeti */}
            <div className="mt-2 text-[10px] text-ivory-dark/60 leading-relaxed space-y-0.5">
              {hediyeAcilis ? (
                <p>
                  <b className="text-gold-500">x{carpan}</b>: Salonun {carpan === 99 ? `${X9_ICIN_GEREKLI} x9` : `${X99_ICIN_GEREKLI} x99`} masası açılmışsa{" "}
                  <b className="text-emerald-400">kredi gerekmeden hediye</b> açılır; dolmamışsa masa açılmaz.
                  {canakVar(carpan, sure) && " Çanak kırılırsa yarısı masayı açana verilir."}
                </p>
              ) : kredi > 0 ? (
                <p>
                  Masa açıldığı anda <b className="text-gold-500">{kredi.toLocaleString("tr-TR")} kredi</b> kesilir (yalnız masayı açandan, 1 kez).
                  {sure} saat boyunca aynı çarpanla, kredi gerekmeden oynanır — herkes çıksa bile süre dolana kadar açık kalır.
                  {canakVar(carpan, sure) && " Çanak kırılırsa yarısı masayı açana verilir."}
                </p>
              ) : (
                <p>Normal puanlama — kredi gerekmez. Kazanılan/kaybedilen puanlar el sayısı kadardır.</p>
              )}
              {carpan === 9 && sure === 12 && (
                <p className="text-[#f87171]">12 saatlik x9: x99 sayacını artırmaz ve çanak vermez.</p>
              )}
              {carpan === 9 && sure === 24 && (
                <p className="text-emerald-400">20 adet normal x9 masa → salonlara otomatik x99 hediye edilir.</p>
              )}
              {carpan === 99 && <p className="text-emerald-400">7 adet x99 masa → salonlara otomatik x111 hediye edilir.</p>}
              {carpan === 123 && sure === 24 && (
                <p className="text-[#f87171]">120 milyondan yüksek puanlı oyuncular bu masalara giremez.</p>
              )}
              {carpan === 999 && sure === 24 && (
                <p className="text-[#f87171]">100 milyondan yüksek puanlı oyuncular bu masalara giremez.</p>
              )}
              {adminSure && (
                <p className="text-[#f87171]">Bu süre yalnız salondaki ADMIN menüsünden açılabilir.</p>
              )}
            </div>
          </fieldset>

          {/* Masa ayarları */}
          <fieldset className="border border-wood-700 rounded px-3 py-2.5">
            <legend className="px-1 text-xs font-bold text-gold-500">Masa Ayarları</legend>
            <div className="flex flex-wrap gap-x-6 gap-y-2">
              <label className={label}>
                <input type="checkbox" checked={sohbet} onChange={(e) => setSohbet(e.target.checked)} className={box} />
                Sohbet Açık
              </label>
              <label className={label}>
                <input type="checkbox" checked={izleyici} onChange={(e) => setIzleyici(e.target.checked)} className={box} />
                İzleyiciye Açık
              </label>
              <label className={label}>
                <input type="checkbox" checked={davet} onChange={(e) => setDavet(e.target.checked)} className={box} />
                Dinamik için Davet Gerekli
              </label>
            </div>
          </fieldset>

          {/* Tamam / İptal */}
          <div className="flex justify-end gap-2 pt-1">
            <button
              onClick={onClose}
              className="px-6 py-1.5 rounded bg-wood-900 hover:bg-wood-800 border border-wood-700 text-ivory-dark text-sm font-semibold"
            >
              İptal
            </button>
            <button
              onClick={tamam}
              className="px-6 py-1.5 rounded bg-gold-600 hover:bg-gold-500 text-wood-950 text-sm font-bold"
            >
              Tamam
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
