export interface Tile {
  id: string;
  num: number; // 1..13
  color: number; // 0..3
  wild: boolean; // okey taşı ya da sahte okey (joker)
}

export type OkeyMode = "yuzbir" | "okey" | "otuzdort" | "ellibir";

export interface Group {
  kind: "seri" | "küt" | "per";
  idx: number[]; // gerçek taş indeksleri (el sıralı halde)
  wilds: number; // bu gruptaki joker sayısı
  tiles: Tile[]; // detach edilmiş joker göstergesi için
}

export interface Decomposition {
  groups: Group[];
  deadwood: Tile[];
  setPoints: number;
  usedCount: number;
  deadwoodValue: number;
}
