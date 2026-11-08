// ---------------------------------------------------------------------------
// Nick / yazı rengi kuralları:
// - Yönetici ve üstü (site sahibi, salon rolleri dahil) nick'i her yerde mavi.
// - Diğer üyeler profil ayarlarından kendi rengini seçebilir (mavi hariç).
// - Renk seçilmemişse üyeler klasik sohbette siyah görünür.
// ---------------------------------------------------------------------------

import { isSiteOwner } from "./kira";

/** Yönetici mavisi — klasik beyaz sohbet zemini için koyu mavi */
export const STAFF_BLUE_LIGHT = "#1d4ed8";
/** Yönetici mavisi — koyu (lobi) zemin için parlak mavi */
export const STAFF_BLUE_DARK = "#60a5fa";

const STAFF_SALON_ROLES = ["siteowner", "owner", "admin", "superop", "yonetici"];

/** Site yetkilisi / koordinatör / yönetici / admin kademesi — nick'leri her yerde mavi */
export const BLUE_RANKS = ["admin", "yonetici", "denetmen", "koordinator", "yetkili"];

/** Üye yönetici konumunda mı? (site sahibi + salon rolleri + yonetici/admin/koordinator/yetkili kademesi) */
export function isStaffNick(
  nick: string,
  rank?: string | null,
  salonRole?: string | null
): boolean {
  if (isSiteOwner(nick)) return true;
  if (salonRole && STAFF_SALON_ROLES.includes(salonRole)) return true;
  return BLUE_RANKS.includes(rank ?? "");
}

export interface NickColorInput {
  nick: string;
  rank?: string | null;
  salonRole?: string | null;
  /** üyenin profilinden seçtiği renk (#rrggbb) — mavi olsa bile yöneticiyse mavi ezilir */
  custom?: string | null;
  /** koyu zeminde mi? (lobi sohbeti) */
  dark?: boolean;
}

/**
 * Nick metin rengi. dönen null ise arayüz kendi varsayılan rengini kullanır
 * (klasik: siyah, koyu tema: gold).
 */
export function nickTextColor({
  nick,
  rank,
  salonRole,
  custom,
  dark = false,
}: NickColorInput): string | null {
  if (isStaffNick(nick, rank, salonRole)) return dark ? STAFF_BLUE_DARK : STAFF_BLUE_LIGHT;
  if (custom && /^#[0-9a-fA-F]{6}$/.test(custom)) return custom.toLowerCase();
  return null;
}

/** Renk seçimi paleti — mavi tonları YOK (yöneticiye ayrıldı) */
export const NICK_PALETTE: { color: string; label: string }[] = [
  { color: "#111111", label: "Siyah" },
  { color: "#7c2d12", label: "Kahve" },
  { color: "#b91c1c", label: "Kırmızı" },
  { color: "#c2410c", label: "Turuncu" },
  { color: "#a16207", label: "Koyu Sarı" },
  { color: "#15803d", label: "Yeşil" },
  { color: "#166534", label: "Koyu Yeşil" },
  { color: "#7e22ce", label: "Mor" },
  { color: "#be185d", label: "Pembe" },
  { color: "#4b5563", label: "Gri" },
];

/** Seçilen renk maviye mi benziyor? (yönetici dışına uygulanamaz) */
export function isBlueishHex(hex: string): boolean {
  const m = /^#([0-9a-fA-F]{6})$/.exec(hex.trim());
  if (!m) return false;
  const n = parseInt(m[1], 16);
  const r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  return b > 110 && b > r + 35 && b > g + 15;
}
