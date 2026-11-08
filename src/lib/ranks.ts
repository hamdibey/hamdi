import type { RankId } from "./types";

export interface RankDef {
  id: RankId;
  label: string;
  short: string;
  level: number; // 0 = en alt kademe
  badge: string; // tailwind classes
  desc: string;
}

// Yetki kademesi (alttan üste): Deneme Üye → Gold Üye → Site Yetkilisi →
// Site Koordinatörü → Denetmen → Yönetici → Admin (Amin)
export const RANKS: RankDef[] = [
  {
    id: "deneme",
    label: "Normal Üye",
    short: "Normal",
    level: 0,
    badge: "bg-wood-700/70 text-ivory-dark border-wood-600",
    desc: "Sitede yeni olan üyeler. Sohbet edebilir, oyun oynayabilir.",
  },
  {
    id: "gold",
    label: "Gold Üye",
    short: "Gold",
    level: 1,
    badge: "bg-gold-700/40 text-gold-300 border-gold-600",
    desc: "Gold rozeti taşır; kazandığı çiplerin 2 katını alır.",
  },
  {
    id: "yetkili",
    label: "Site Yetkilisi",
    short: "Yetkili",
    level: 2,
    badge: "bg-sky-900/60 text-sky-300 border-sky-700",
    desc: "Uygunsuz konuşan üyeleri susturabilir.",
  },
  {
    id: "koordinator",
    label: "Site Koordinatörü",
    short: "Koord.",
    level: 3,
    badge: "bg-purple-900/60 text-purple-300 border-purple-700",
    desc: "Üyelere gold üyelik verebilir veya alabilir.",
  },
  {
    id: "denetmen",
    label: "Denetmen",
    short: "Denetmen",
    level: 4,
    badge: "bg-emerald-900/60 text-emerald-300 border-emerald-700",
    desc: "Bütün salonlarda normal yönetici gibi denetim yapabilir.",
  },
  {
    id: "yonetici",
    label: "Yönetici",
    short: "Yönetici",
    level: 5,
    badge: "bg-red-900/60 text-red-300 border-red-700",
    desc: "Kendi altındaki kademeler için yetki atayabilir.",
  },
  {
    id: "admin",
    label: "Admin (Amin)",
    short: "Admin",
    level: 6,
    badge: "bg-black/80 text-gold-400 border-gold-600",
    desc: "Tam yetki. Üye banlayabilir, tüm işlemleri yapabilir.",
  },
];

export const rankDef = (id: RankId): RankDef =>
  RANKS.find((r) => r.id === id) ?? RANKS[0];

export const rankLevel = (id: RankId): number => rankDef(id).level;

export const has = (rank: RankId, min: RankId): boolean =>
  rankLevel(rank) >= rankLevel(min);

/** Yönetim paneli işlemleri için izin tablosu */
export const PERMS = {
  mute: "yetkili", // yetkili susturur
  gold: "koordinator", // koordinatör gold verir/alır
  rank: "yonetici", // yönetici yetki atar
  ban: "admin", // admin banlar
} as const;

export type PermKey = keyof typeof PERMS;

export const can = (rank: RankId, perm: PermKey): boolean =>
  has(rank, PERMS[perm] as RankId);
