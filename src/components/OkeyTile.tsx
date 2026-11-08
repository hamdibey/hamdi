import type { Tile } from "../lib/okeyTypes";

// Klasik okey taşı rakam renkleri — hakkarim/doguport referansıyla birebir:
// rakam TAŞIN ÜST KÖŞESİNDE taşı renginde; altında aynı renkten tek nokta.
const NUM_COLORS = [
  "text-[#1e1e1e]", // 0: Siyah
  "text-[#1547a8]", // 1: Çivit (lacivert)
  "text-[#c0202a]", // 2: Kırmızı
  "text-[#c98a12]", // 3: Sarı (altın)
];

const DOT_COLORS = ["bg-[#1e1e1e]", "bg-[#1547a8]", "bg-[#c0202a]", "bg-[#c98a12]"];

interface Props {
  tile: Tile;
  size?: "xs" | "sm" | "md" | "lg" | "xl";
  selected?: boolean;
  dimmed?: boolean;
  rotated?: boolean; // sağ tıkla çevrilmiş (işaretle) taş
  onClick?: () => void;
}

// Referans (doguport ÇİFT OKEY): küçük taş gövdesi + NET okunan BÜYÜK rakam.
// Rakam, taş yüksekliğinin ~%45'i kadar (3B gölgeli, font-black).
const SIZES = {
  xs: { w: "w-[21px]", h: "h-[29px]", num: "text-[13px]", dot: "w-[5px] h-[5px]", star: "text-[10px]" },
  sm: { w: "w-[26px]", h: "h-[36px]", num: "text-[17px]", dot: "w-[5px] h-[5px]", star: "text-sm" },
  md: { w: "w-[30px]", h: "h-[42px]", num: "text-[20px]", dot: "w-[6px] h-[6px]", star: "text-base" },
  lg: { w: "w-[37px]", h: "h-[51px]", num: "text-[24px]", dot: "w-1.5 h-1.5", star: "text-xl" },
  // ıstaka taşları: gövde biraz küçüldü, rakam çok büyüdü → hem sığıyor hem net okunuyor
  xl: { w: "w-[40px]", h: "h-[54px]", num: "text-[27px]", dot: "w-2 h-2", star: "text-2xl" },
};

/**
 * Klasik okey taşı (referans birebir): fildişi yüzey, üst köşede renkli rakam,
 * altında taşı rengini gösteren tek nokta. Üzerinde rakam olmayan 2 taş = sahte okey.
 * Gösterge ile belirlenen okey taşının köşesinde kırmızı nokta vardır.
 */
export function OkeyTile({ tile, size = "sm", selected, dimmed, rotated, onClick }: Props) {
  const s = SIZES[size];
  const isJoker = tile.wild && tile.num === 0; // sahte okey: rakamsız
  const isOkey = tile.wild && tile.num > 0; // gerçek okey taşı (kırmızı noktalı)
  const c = NUM_COLORS[tile.color] ?? NUM_COLORS[0];
  const dot = DOT_COLORS[tile.color] ?? DOT_COLORS[0];

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!onClick}
      className={`tile-face relative border border-[#3a3427] rounded-[3px] ${s.w} ${s.h} shrink-0
        flex flex-col items-center justify-start pt-[1px]
        transition-transform duration-100 outline-none
        ${onClick ? "cursor-pointer hover:-translate-y-1 focus-visible:-translate-y-1" : "cursor-default"}
        ${selected ? "-translate-y-2 ring-2 ring-gold-400" : ""}
        ${rotated ? "rotate-90 scale-[.82] z-10 ring-2 ring-sky-400/80" : ""}
        ${dimmed ? "opacity-45" : ""}`}
      title={
        isJoker
          ? "Sahte Okey (Joker — rakamsız)"
          : isOkey
          ? `Okey Taşı (${tile.num} — joker, kırmızı nokta)`
          : `${tile.num}`
      }
    >
      {isJoker ? (
        // Rakamsız sahte okey: sadece altın yıldız arması
        <>
          <span className={`${s.star} leading-none text-gold-600 font-bold select-none mt-0.5`}>★</span>
          <span className="absolute bottom-[2px] left-0 right-0 text-center text-[6px] leading-none font-bold tracking-wider text-wood-800/70 select-none">
            OKEY
          </span>
        </>
      ) : (
        <>
          {/* Üst köşe rakamı — referanstaki gibi BÜYÜK, 3B (kabartma) ve net okunur */}
          <span className={`${s.num} ${c} leading-none font-display font-black num-3d select-none tracking-tight`}>
            {tile.num}
          </span>
          {/* Taş rengini gösteren tek nokta (referans: rakamın altında ortada) */}
          <span className={`mt-[4px] ${s.dot} rounded-full ${dot} select-none`} />
          {/* Okey taşının işareti: kırmızı nokta */}
          {isOkey && (
            <span className="absolute top-[2px] right-[2px] w-[6px] h-[6px] rounded-full bg-red-600 border border-red-900/60 shadow-sm" />
          )}
        </>
      )}
    </button>
  );
}

// ---------------------------------------------------------------------------
// İstaka: sürükle-bırakta bırakma noktasını gösteren altın boşluk çizgisi
// ---------------------------------------------------------------------------

export function DropGap() {
  return (
    <span className="w-1.5 h-12 rounded-full bg-gold-400 shadow-[0_0_8px_rgba(217,168,56,.9)] mx-0.5 shrink-0 animate-pulse" />
  );
}

export function OkeyTileBack({ size = "md" }: { size?: "sm" | "md" }) {
  const s = SIZES[size];
  return <div className={`tile-back rounded-[3px] ${s.w} ${s.h} shrink-0`} />;
}

// ---------------------------------------------------------------------------
// İstaka dizilim rozetleri: her grup türü kendi rengiyle işaretlenir
// ---------------------------------------------------------------------------

const CLUSTER_BADGES: Record<string, string> = {
  seri: "bg-emerald-500/15 text-emerald-300 border-emerald-500/40",
  küt: "bg-sky-500/15 text-sky-300 border-sky-500/40",
  per: "bg-rose-500/15 text-rose-300 border-rose-500/40",
  serbest: "bg-wood-950/50 text-ivory-dark/40 border-wood-600/50",
};

const CLUSTER_BARS: Record<string, string> = {
  seri: "bg-emerald-500/70",
  küt: "bg-sky-500/70",
  per: "bg-rose-500/70",
  serbest: "bg-wood-600/60",
};

/** Grup türü altındaki renkli mini rozet: seri=yeşil, küt=gök, per=pembe, serbest=soluk */
export function ClusterTag({ kind }: { kind: string }) {
  const c = CLUSTER_BADGES[kind] ?? CLUSTER_BADGES.serbest;
  return (
    <span
      className={`mt-1 px-1.5 py-px rounded-full border text-[9px] font-bold uppercase tracking-wide leading-relaxed select-none ${c}`}
    >
      {kind}
    </span>
  );
}

/** Grup türü altındaki renkli ince çizgi (taş sırasının altı) */
export function clusterBarClass(kind: string): string {
  return CLUSTER_BARS[kind] ?? CLUSTER_BARS.serbest;
}
