// ---------------------------------------------------------------------------
// Salon düzeni: 4 kat × 40 salon. Salon kira miktarını site sahibi belirler;
// arayüzde tutar gösterilmez — sadece sahip ataması ve salon adı yapılır.
// ---------------------------------------------------------------------------

export const FLOORS = [1, 2, 3, 4, 5, 6] as const;
export const SLOTS_PER_FLOOR = 50;

/** Salon anahtarı: "1_3" (kat_sıra) */
export const salonKey = (floor: number, slot: number) => `${floor}_${slot}`;
export const salonLabel = (floor: number, slot: number) => `${floor}. Kat · ${slot}. Salon`;

/** Salon başlığı: site sahibi ad verdiyse özel ad, yoksa "N. Kat · M. Salon" */
export const salonTitle = (floor: number, slot: number, name?: string | null) =>
  name && name.trim() ? name.trim() : salonLabel(floor, slot);

/** Salon sahibi rolleri ve kişi limitleri (paketlerle artırılabilir) */
export const STAFF_ROLES = [
  { role: "admin", label: "Salon Admin", limit: 2, badge: "bg-red-900/60 text-red-300 border-red-700" },
  { role: "superop", label: "Süper Op", limit: 2, badge: "bg-purple-900/60 text-purple-300 border-purple-700" },
  { role: "yonetici", label: "Salon Yöneticisi", limit: 20, badge: "bg-sky-900/60 text-sky-300 border-sky-700" },
] as const;

export type StaffRoleKey = (typeof STAFF_ROLES)[number]["role"];

/** Site sahibi nicksi — her yerde en üstte, tüm salonlarda yönetici, korumalı */
export const SITE_OWNER_NICK = "web master";
export const isSiteOwner = (nick?: string | null): boolean =>
  !!nick && nick.trim().toLowerCase() === SITE_OWNER_NICK;

export const roleLabel = (role: string): string =>
  role === "siteowner"
    ? "Site Sahibi"
    : role === "owner"
    ? "As Admin"
    : (STAFF_ROLES.find((r) => r.role === role)?.label ?? "Üye");

export const roleBadge = (role: string): string =>
  role === "siteowner" || role === "owner"
    ? "bg-gold-700/40 text-gold-300 border-gold-600"
    : (STAFF_ROLES.find((r) => r.role === role)?.badge ?? "bg-wood-700/70 text-ivory-dark border-wood-600");

/**
 * Rol yıldızı (★) — kullanıcıların gördüğü amblem renkleri:
 * - As Admin / Admin: kırmızı-beyaz
 * - Süper Op: sarı gold
 * - Yönetici: sarı
 * - Site sahibi (admin kademesi, salonda üye ise): gümüş
 * - Site yetkilisi: siyah
 * - Koordinatör: açık kahve
 */
export interface StarStyle {
  color: string;
  /** Kontrast için yıldız çevresine çizgi (koyu renkli yıldızlarda) */
  stroke?: string;
  title: string;
  /** Siyah parlak (metalik) yıldız — site sahibi */
  glossy?: boolean;
}

export function roleStar(role: string, rank?: string): StarStyle | null {
  switch (role) {
    case "siteowner":
      return { color: "#0a0a0a", glossy: true, title: "Site Sahibi" }; // siyah parlak
    case "owner":
    case "admin":
      return { color: "#e11d48", stroke: "#ffffff", title: role === "owner" ? "As Admin" : "Salon Admin" };
    case "superop":
      return { color: "#e6b800", title: "Süper Op" }; // sarı gold
    case "yonetici":
      return { color: "#fde047", title: "Salon Yöneticisi" }; // sarı
  }
  // Salon rolü yoksa site kademesine göre yıldız
  switch (rank) {
    case "admin":
      return { color: "#d4d4d8", title: "Site Sahibi" }; // gümüş
    case "yonetici":
      return { color: "#c0c0c0", title: "Yönetici" }; // gümüş (site yöneticisi)
    case "denetmen":
      return { color: "#10b981", stroke: "#ffffff", title: "Denetmen" }; // yeşil
    case "yetkili":
      return { color: "#111111", stroke: "#a3a3a3", title: "Site Yetkilisi" }; // siyah + gümüş kontur
    case "koordinator":
      return { color: "#b08968", title: "Koordinatör" }; // açık kahve
    default:
      return null;
  }
}

// ---------------------------------------------------------------------------
// Yetkili öncelik sırası — tüm üye listelerinde en üste kimler çıkar:
// site sahibi → admin → yönetici → koordinatör → site yetkilisi → diğerleri
// ---------------------------------------------------------------------------
export const STAFF_TIER_RANKS = ["admin", "yonetici", "denetmen", "koordinator", "yetkili"];

/**
 * Liste sıralaması için yetkili kademesi puanı (büyük = üstte).
 * Site sahibi 100, admin 90, yönetici 80, koordinatör 70, site yetkilisi 60, üye 0.
 * Salon rolü varsa (as admin/admin/süper op/yönetici) ona göre de yükselir.
 */
export function staffTier(nick?: string | null, rank?: string | null, salonRole?: string | null): number {
  if (isSiteOwner(nick)) return 100;
  if (salonRole === "siteowner") return 100;
  if (salonRole === "owner" || salonRole === "admin") return 90;
  if (salonRole === "superop") return 85;
  if (salonRole === "yonetici") return 80;
  switch (rank) {
    case "admin":
      return 90;
    case "yonetici":
      return 80;
    case "denetmen":
      return 75;
    case "koordinator":
      return 70;
    case "yetkili":
      return 60;
    default:
      return 0;
  }
}
