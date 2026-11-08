// ---------------------------------------------------------------------------
// 101 Okey & Okey motoru
// Joker (okey + sahte okey) destekli seri / küt / per analiz motoru ve
// bilgisayara karşı oyun yapay zekâsı.
// ---------------------------------------------------------------------------
import type { Tile, Group, Decomposition, OkeyMode } from "./okeyTypes";

export type { Tile, Group, Decomposition, OkeyMode };
export { COLOR_NAMES, tileValue, tileLabel };

/**
 * 34 / 51 / 101 ailesi: aynı kurallar, tek fark açılma eşiği.
 * (34: ≥34, 51: ≥51, 101: ≥101; Okey'te eşik yok, 4 set + 1 per gerekir.)
 */
export function modeConfig(mode: OkeyMode): { openMin: number; label: string } {
  if (mode === "otuzdort") return { openMin: 34, label: "34 Oyunu" };
  if (mode === "ellibir") return { openMin: 51, label: "51 Oyunu" };
  if (mode === "okey") return { openMin: Infinity, label: "Okey" };
  return { openMin: 101, label: "101 Okey" };
}

const COLOR_NAMES = ["Siyah", "Çivit", "Kırmızı", "Sarı"];

function tileValue(t: Tile): number {
  return t.wild ? 20 : t.num;
}

function tileLabel(t: Tile): string {
  if (t.wild && t.num === 0) return "Sahte Okey";
  if (t.wild) return `${t.num} (Okey)`;
  return `${t.num} ${COLOR_NAMES[t.color]}`;
}

let idSeq = 0;
const nid = () => `t${idSeq++}`;

/** 104 normal taş + 2 sahte okey = 106 taşlık deste */
export function createDeck(): Tile[] {
  const d: Tile[] = [];
  for (let c = 0; c < 4; c++) {
    for (let n = 1; n <= 13; n++) {
      d.push({ id: nid(), num: n, color: c, wild: false });
      d.push({ id: nid(), num: n, color: c, wild: false });
    }
  }
  d.push({ id: nid(), num: 0, color: 0, wild: true }); // sahte okey
  d.push({ id: nid(), num: 0, color: 1, wild: true }); // sahte okey
  return d;
}

export function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export interface OkeySetup {
  deck: Tile[]; // karıştırılmış, gösterge çıkarılmış, okey taşları joker işaretli
  gosterge: Tile;
  okeyNum: number;
  okeyColor: number;
}

/** Gösterge çekilir; bir sonraki sayı okey olur (13 → 1). İlgili taşlar jokerleşir.
 *  Deste 104 normal taş + 2 rakamsız sahte okey = 106 taş.
 *  Gösterge asla sahte okey (rakamsız taş) olamaz; olursa yeniden çekilir. */
export function setupOkey(): OkeySetup {
  const deck = shuffle(createDeck());
  let gi = Math.floor(Math.random() * deck.length);
  while (deck[gi].wild) gi = Math.floor(Math.random() * deck.length);
  const gosterge = deck.splice(gi, 1)[0];
  const okeyNum = gosterge.num === 13 ? 1 : gosterge.num + 1;
  const okeyColor = gosterge.color;
  for (const t of deck) {
    if (!t.wild && t.num === okeyNum && t.color === okeyColor) t.wild = true;
  }
  return { deck, gosterge, okeyNum, okeyColor };
}

// -------------------------------------------------------------------------
// Seri / Küt / Per analiz motoru (joker destekli, mask tabanlı geri izleme)
// -------------------------------------------------------------------------

const MAX_RESULTS = 400;

function handSorted(hand: Tile[]): Tile[] {
  return [...hand].sort((a, b) => {
    if (a.wild !== b.wild) return a.wild ? 1 : -1;
    if (a.color !== b.color) return a.color - b.color;
    return a.num - b.num;
  });
}

/**
 * Elin tüm geçerli seri/küt(/per) çözümlerini üretir.
 * needPair: Okey'te 4 set + 1 per gerekir (101'de per gerekmez).
 */
export function decompose(hand: Tile[], needPair: boolean): Decomposition[] {
  const tiles = handSorted(hand);
  const n = tiles.length;
  const wildIdx = new Set<number>();
  tiles.forEach((t, i) => t.wild && wildIdx.add(i));
  const results: Decomposition[] = [];

  const rec = (
    mask: number,
    wildsLeft: number,
    groups: Group[],
    dead: number[],
    pairUsed: boolean
  ): void => {
    if (results.length >= MAX_RESULTS) return;
    if (mask === 0) {
      results.push(finalize(groups, dead, tiles));
      return;
    }
    // En düşük gerçek (joker olmayan) taşı bul
    let i = -1;
    for (let k = 0; k < n; k++) {
      if ((mask & (1 << k)) !== 0 && !wildIdx.has(k)) {
        i = k;
        break;
      }
    }
    if (i === -1) {
      // Sadece jokerler kaldı: per olarak kullan veya ölü taşı yaz
      const wilds: number[] = [];
      for (let k = 0; k < n; k++) if ((mask & (1 << k)) !== 0) wilds.push(k);
      if (needPair && !pairUsed && wilds.length === 2) {
        rec(0, wildsLeft - 2, [...groups, { kind: "per", idx: [], wilds: 2, tiles: wilds.map((w) => tiles[w]) }], dead, true);
      } else {
        rec(0, wildsLeft, groups, [...dead, ...wilds], pairUsed);
      }
      return;
    }

    const ti = tiles[i];
    const rest = mask & ~(1 << i);

    // 1) Ölü taşı yaz
    rec(rest, wildsLeft, groups, [...dead, i], pairUsed);

    // 2) Küt: aynı sayı, farklı renkler (+ jokerlerle tamamlanır)
    const sameNum: number[] = [];
    for (let k = 0; k < n; k++) {
      if ((rest & (1 << k)) !== 0 && !wildIdx.has(k)) {
        const tk = tiles[k];
        if (tk.num === ti.num && tk.color !== ti.color) sameNum.push(k);
      }
    }
    // Renk başına en fazla 1 taş seçilebilir
    const byColor = new Map<number, number[]>();
    for (const k of sameNum) {
      const c = tiles[k].color;
      if (!byColor.has(c)) byColor.set(c, []);
      byColor.get(c)!.push(k);
    }
    const colorList = [...byColor.keys()];
    const pickCombos: number[][] = [[]];
    const build = (pos: number, acc: number[]) => {
      if (pos === colorList.length) {
        pickCombos.push([...acc]);
        return;
      }
      const c = colorList[pos];
      build(pos + 1, acc); // bu rengi atlama
      for (const k of byColor.get(c)!) build(pos + 1, [...acc, k]);
    };
    build(0, []);
    for (const combo of pickCombos) {
      const base = 1 + combo.length; // i + seçilenler
      if (base > 4) continue;
      const wNeed = Math.max(0, 3 - base);
      const total = base + wNeed;
      if (total > 4 || wNeed > wildsLeft) continue;
      let m = rest;
      for (const k of combo) m &= ~(1 << k);
      rec(m, wildsLeft - wNeed, [...groups, { kind: "küt", idx: [i, ...combo], wilds: wNeed, tiles: [] }], dead, pairUsed);
    }

    // 3) Seri: aynı renkten artan sayılar (uzunluk 3+, joker boşlukları doldurur)
    if (ti.num >= 1) {
      for (let len = 3; len <= 13 && ti.num + len - 1 <= 13; len++) {
        const used: number[] = [];
        let m = rest;
        let w = 0;
        let ok = true;
        for (let step = 1; step < len; step++) {
          const want = ti.num + step;
          let found = -1;
          for (let k = 0; k < n; k++) {
            if ((m & (1 << k)) !== 0 && !wildIdx.has(k)) {
              const tk = tiles[k];
              if (tk.num === want && tk.color === ti.color) {
                found = k;
                break;
              }
            }
          }
          if (found >= 0) {
            used.push(found);
            m &= ~(1 << found);
          } else if (w < wildsLeft && w + 1 <= 4) {
            w++;
          } else {
            ok = false;
            break;
          }
        }
        if (!ok) continue;
        rec(m, wildsLeft - w, [...groups, { kind: "seri", idx: [i, ...used], wilds: w, tiles: [] }], dead, pairUsed);
      }
    }

    // 4) Per: birebir aynı taş ya da joker ile
    if (needPair && !pairUsed) {
      for (let k = 0; k < n; k++) {
        if ((rest & (1 << k)) !== 0 && !wildIdx.has(k)) {
          const tk = tiles[k];
          if (tk.num === ti.num && tk.color === ti.color) {
            rec(rest & ~(1 << k), wildsLeft, [...groups, { kind: "per", idx: [i, k], wilds: 0, tiles: [] }], dead, true);
            break;
          }
        }
      }
      if (wildsLeft >= 1) {
        rec(rest, wildsLeft - 1, [...groups, { kind: "per", idx: [i], wilds: 1, tiles: [] }], dead, true);
      }
    }
  };

  rec((1 << n) - 1, wildIdx.size, [], [], false);

  // Kalan jokerleri gruplara iliştir (küt 4. renk, seri uzatma, per)
  return results.map((d) => attachLeftoverWilds(d, tiles));
}

function finalize(groups: Group[], dead: number[], tiles: Tile[]): Decomposition {
  const usedSet = new Set<number>();
  let setPoints = 0;
  let usedCount = 0;
  for (const g of groups) {
    for (const i of g.idx) {
      usedSet.add(i);
      setPoints += tileValue(tiles[i]);
      usedCount++;
    }
    setPoints += g.wilds * 20;
    usedCount += g.wilds;
  }
  const deadwood = dead.map((i) => tiles[i]);
  const deadwoodValue = deadwood.reduce((s, t) => s + tileValue(t), 0);
  return { groups, deadwood, setPoints, usedCount, deadwoodValue };
}

/** Kalan jokerleri anlamlı gruplara ekler: küt → 4. renk, seri → uzatma, iki joker → per */
function attachLeftoverWilds(d: Decomposition, tiles: Tile[]): Decomposition {
  if (d.deadwood.length === 0) return d;
  const wilds = d.deadwood.filter((t) => t.wild);
  const others = d.deadwood.filter((t) => !t.wild);
  let remain = wilds.length;
  const groups = d.groups.map((g) => ({ ...g }));

  for (const g of groups) {
    if (remain === 0) break;
    if (g.kind === "küt" && g.wilds === 0) {
      g.wilds += 1;
      remain -= 1;
    } else if (g.kind === "seri" && g.wilds < 2) {
      g.wilds += 1;
      remain -= 1;
    }
  }
  if (remain === 2 && others.length >= 1) {
    // Joker + kalan taş → per
    const t = others.pop()!;
    groups.push({ kind: "per", idx: [tiles.indexOf(t)], wilds: 1, tiles: [] });
    remain = 0;
  } else if (remain >= 2) {
    groups.push({ kind: "per", idx: [], wilds: 2, tiles: [] });
    remain -= 2;
  }
  const dead = [...others, ...wilds.slice(remain)];
  return finalize(groups, dead.map((t) => tiles.indexOf(t)), tiles);
}

/** En iyi çözüm: önce tam kaplama, sonra set puanı, sonra en az ölü taşı */
export function bestDecomposition(hand: Tile[], needPair: boolean): Decomposition {
  const all = decompose(hand, needPair);
  if (all.length === 0) return finalize([], hand.map((_, i) => i), handSorted(hand));
  const sorted = [...all].sort(
    (a, b) =>
      b.usedCount - a.usedCount ||
      b.setPoints - a.setPoints ||
      a.deadwoodValue - b.deadwoodValue
  );
  return sorted[0];
}

export interface FinishCheck {
  ok: boolean;
  reason?: string;
  sets?: Group[];
}

/**
 * Bitirme kontrolü (15 taşlık el, sıranın ortasında):
 * - 101: 15 taşın en az 14'ü set olmalı (fazlası düşülür), set puanı ≥ 101
 * - Okey: 14 taş 4 set + 1 per, fazladaki 1 taş düşülür
 */
export function canFinish(hand: Tile[], mode: OkeyMode): FinishCheck {
  const openMin = modeConfig(mode).openMin;
  const all = decompose(hand, mode === "okey");
  for (const d of all) {
    const setsOnly = d.groups.filter((g) => g.kind !== "per");
    const pairs = d.groups.filter((g) => g.kind === "per");
    if (mode !== "okey") {
      if (d.deadwood.length <= 1 && setsOnly.length >= 3 && d.setPoints >= openMin) {
        return { ok: true, sets: d.groups };
      }
    } else {
      const pairTiles = pairs.reduce((s, g) => s + g.idx.length + g.wilds, 0);
      if (
        d.deadwood.length <= 1 &&
        pairTiles === 2 &&
        pairs.length === 1 &&
        d.usedCount >= 14 &&
        setsOnly.length >= 4
      ) {
        return { ok: true, sets: d.groups };
      }
    }
  }
  return {
    ok: false,
    reason:
      mode === "okey"
        ? "El bitirmek için 4 set + 1 per (çift) gerekir."
        : `El açmak için tüm taşların seri/küt olması ve set puanının en az ${openMin} olması gerekir.`,
  };
}

/** Ölü taşı değeri (ceza puanı) */
export function deadwoodValue(hand: Tile[]): number {
  return hand.reduce((s, t) => s + tileValue(t), 0);
}

// -------------------------------------------------------------------------
// Otomatik dizi (ıstaka dizilimi): seri / küt / çift gruplaması
// -------------------------------------------------------------------------

export interface Cluster {
  tiles: Tile[];
  kind: "seri" | "küt" | "per" | "serbest";
}

/**
 * Elini otomatik olarak gruplara dizer: seri, küt, per (çift) ve serbest taşlar.
 * Joker taşlar (okey + sahte okey) kullanıldığı grubun sonuna iliştirilir.
 */
export function arrangeClusters(hand: Tile[], needPair: boolean): Cluster[] {
  const sorted = handSorted(hand);
  const d = bestDecomposition(hand, needPair);
  const deadIds = new Set(d.deadwood.map((t) => t.id));
  // Gruplamaya girmemiş tüm joker taşlar (okey + sahte okey) havuzda toplanır
  const inGroups = new Set<string>();
  for (const g of d.groups) for (const i of g.idx) inGroups.add(sorted[i].id);
  const wildPool = sorted.filter((t) => t.wild && !inGroups.has(t.id));

  const clusters: Cluster[] = [];
  const usedWildIds = new Set<string>();
  for (const g of d.groups) {
    const tiles = g.idx.map((i) => sorted[i]);
    if (g.kind === "seri") tiles.sort((a, b) => a.num - b.num);
    else if (g.kind === "küt") tiles.sort((a, b) => a.color - b.color);
    // Jokerları grubun sonuna ekle (kullanılan joker sayısı kadar)
    for (let w = 0; w < g.wilds && wildPool.length > 0; w++) {
      const wt = wildPool.shift()!;
      usedWildIds.add(wt.id);
      tiles.push(wt);
    }
    if (tiles.length === 0) continue;
    clusters.push({ tiles, kind: g.kind as Cluster["kind"] });
  }

  // Serbest (ölü) taşlar: sayıları küçükten büyüğe, jokerler sonda
  const dead = sorted.filter((t) => deadIds.has(t.id) && !t.wild);
  const deadWilds = sorted.filter((t) => t.wild && !inGroups.has(t.id) && !usedWildIds.has(t.id));
  if (dead.length + deadWilds.length > 0) {
    clusters.push({ tiles: [...dead, ...deadWilds], kind: "serbest" });
  }
  return clusters;
}

// -------------------------------------------------------------------------
// Masaya açma (101 ailesi): saf seri / küt gruplarının tespiti
// -------------------------------------------------------------------------

/** Çift (per) açılış eşiği: en az 5 çift (birebir aynı 2 taş) ile açılır */
export const PAIR_OPEN_MIN = 5;

export interface LayGroup {
  kind: "seri" | "küt" | "per";
  tiles: Tile[];
  value: number;
}

/**
 * Elindeki açılabilecek ÇİFT (per) gruplarını döndürür.
 * Çift = birebir aynı 2 taş (aynı sayı + aynı renk; ör. iki adet 5 Kırmızı).
 * Joker (okey + sahte okey) bir tek taşı tamamlayabilir; iki joker birbirinin çifti olur.
 * Gerçek 101 kuralı: en az PAIR_OPEN_MIN (5) çift varsa puan şartı olmadan açılır.
 */
export function pureLayPairs(hand: Tile[]): LayGroup[] {
  const byKey = new Map<string, Tile[]>();
  for (const t of hand) {
    if (t.wild) continue;
    const k = `${t.num}-${t.color}`;
    if (!byKey.has(k)) byKey.set(k, []);
    byKey.get(k)!.push(t);
  }
  const res: LayGroup[] = [];
  const singles: Tile[] = [];
  for (const list of byKey.values()) {
    while (list.length >= 2) {
      const a = list.shift()!;
      const b = list.shift()!;
      res.push({ kind: "per", tiles: [a, b], value: tileValue(a) + tileValue(b) });
    }
    if (list.length === 1) singles.push(list[0]);
  }
  // Joker + tek taş → çift
  const wilds = hand.filter((t) => t.wild);
  let w = 0;
  for (const s of singles) {
    if (w >= wilds.length) break;
    const wild = wilds[w++];
    res.push({ kind: "per", tiles: [s, wild], value: tileValue(s) + tileValue(wild) });
  }
  // İki kalan joker → çift
  while (w + 1 < wilds.length) {
    const a = wilds[w++];
    const b = wilds[w++];
    res.push({ kind: "per", tiles: [a, b], value: tileValue(a) + tileValue(b) });
  }
  return res;
}

/**
 * Elindeki açılabilecek seri/küt gruplarını döndürür (joker dahil —
 * gerçek 101 kurallarında okey ve sahte okey de masaya açılabilir).
 * Grupların toplamı ≥ openMin olduğunda bunlar masaya yatırılır.
 */
export function pureLayGroups(hand: Tile[], kind?: "seri" | "küt"): LayGroup[] {
  const sorted = handSorted(hand);
  const d = bestDecomposition(hand, false);
  // Gruplara girmeyen jokerleri (varsa) grup slotlarına iliştir
  const inGroups = new Set<string>();
  for (const g of d.groups) for (const i of g.idx) inGroups.add(sorted[i].id);
  const wildPool = sorted.filter((t) => t.wild && !inGroups.has(t.id));
  const res: LayGroup[] = [];
  for (const g of d.groups) {
    if (g.kind === "per") continue;
    const totalLen = g.idx.length + g.wilds;
    if (totalLen < 3) continue;
    if (kind && g.kind !== kind) continue;
    const tiles = g.idx.map((i) => sorted[i]);
    if (g.kind === "seri") tiles.sort((a, b) => a.num - b.num);
    else tiles.sort((a, b) => a.color - b.color);
    for (let w = 0; w < g.wilds && wildPool.length > 0; w++) tiles.push(wildPool.shift()!);
    if (tiles.length < 3) continue;
    res.push({
      kind: g.kind as "seri" | "küt",
      tiles,
      value: tiles.reduce((s, t) => s + tileValue(t), 0),
    });
  }
  return res;
}

/**
 * Seçilen taş kümesi masaya açılabilir mi?
 * Yollar: (1) tamamı seri/küt gruplarına ayrılmalı, ya da
 * (2) per (çift) + seri/küt karışık — per'ler çekilip kalan tamamen set olmalı.
 * (açılışta joker de grubun içinde olabilir; her taş bir gruba girmeli)
 */
export function validateLaySelection(chosen: Tile[]): LayGroup[] | null {
  if (chosen.length < 2) return null;
  // Yardımcı: kalan taşlar tamamen seri/küt'e ayrılabiliyor mu?
  const validateSets = (subset: Tile[]): LayGroup[] | null => {
    if (subset.length === 0) return [];
    if (subset.length < 3) return null;
    const d = bestDecomposition(subset, false);
    if (d.deadwood.length > 0) return null;
    const groups = d.groups.filter((g) => g.kind !== "per");
    if (groups.length === 0) return null;
    const sorted = handSorted(subset);
    const inGroups = new Set<string>();
    for (const g of groups) for (const i of g.idx) inGroups.add(sorted[i].id);
    const wildPool = sorted.filter((t) => t.wild && !inGroups.has(t.id));
    const res: LayGroup[] = [];
    for (const g of groups) {
      const totalLen = g.idx.length + g.wilds;
      if (totalLen < 3) return null;
      const tiles = g.idx.map((i) => sorted[i]);
      if (g.kind === "seri") tiles.sort((a, b) => a.num - b.num);
      else tiles.sort((a, b) => a.color - b.color);
      for (let ww = 0; ww < g.wilds && wildPool.length > 0; ww++) tiles.push(wildPool.shift()!);
      res.push({
        kind: g.kind as "seri" | "küt",
        tiles,
        value: tiles.reduce((s, t) => s + tileValue(t), 0),
      });
    }
    return res;
  };
  // 1) Yol: tamamı seri/küt
  const setsOnly = validateSets(chosen);
  if (setsOnly) return setsOnly;
  // 2) Yol: per (çift) + seri/küt karışık
  const pairs = pureLayPairs(chosen);
  if (pairs.length > 0) {
    const usedIds = new Set(pairs.flatMap((g) => g.tiles.map((t) => t.id)));
    const rest = chosen.filter((t) => !usedIds.has(t.id));
    const restSets = validateSets(rest);
    if (restSets) return [...pairs, ...restSets];
  }
  return null;
}

/**
 * Bir taş, masaya açılmış bir grubu uzatabilir mi? (gerçek 101: açtıktan
 * sonra her tur bir taşını grubuna ekleyebilirsin — seri uzar, küt 4'e kadar)
 */
export function canExtendGroup(group: { kind: "seri" | "küt" | "per"; tiles: Tile[] }, tile: Tile): boolean {
  // Per (çift): açılan çifte taş eklenmez
  if (group.kind === "per") return false;
  if (group.kind === "küt" && group.tiles.length >= 4) return false;
  if (group.kind === "seri" && group.tiles.length >= 13) return false;
  // Joker her gruba eklenebilir
  if (!tile.wild) {
    if (group.kind === "küt") {
      // Aynı sayı + farklı renk (grupta bu renk zaten olmamalı)
      if (group.tiles.some((t) => !t.wild && t.num === tile.num && t.color === tile.color)) return false;
      return group.tiles.some((t) => !t.wild && t.num === tile.num);
    }
    // Seri: aynı renk ve grupla bitişik/değil mi — tüm taşlar tek seri içinde kalmalı
    if (group.tiles.some((t) => !t.wild && t.color !== tile.color)) return false;
  }
  const test = [...group.tiles, tile];
  const d = bestDecomposition(test, false);
  return d.groups.length === 1 && d.groups[0].kind === group.kind && d.deadwood.length === 0;
}

/** AI: elinde masaya açılabilecek tüm gruplar (açtıysa her tur, yoksa eşikten sonra) */
export function aiLayPlan(hand: Tile[], opened: boolean, openMin: number): LayGroup[] | null {
  const groups = pureLayGroups(hand);
  const total = groups.reduce((s, g) => s + g.value, 0);
  if (!opened) {
    // Seri/küt açılışı: set toplamı eşiği geçmeli
    if (groups.length > 0 && total >= openMin) return groups;
    // Çift (per) açılışı: en az PAIR_OPEN_MIN çift (birebir aynı 2 taş) — puan şartı yok
    const pairs = pureLayPairs(hand);
    if (pairs.length >= PAIR_OPEN_MIN) return pairs;
    return null;
  }
  // Açtıysa: setleri varsa aç, yoksa çiftleri aç (tek plan — joker çakışmasın)
  if (groups.length > 0) return groups;
  const pairs = pureLayPairs(hand);
  return pairs.length > 0 ? pairs : null;
}

/** AI: masaya açtığı bir gruba hangi taşı ekleyebilir (uzatma) */
export function aiFindExtension(hand: Tile[], laid: { kind: "seri" | "küt" | "per"; tiles: Tile[] }[]): { tile: Tile; groupIdx: number } | null {
  for (let gi = 0; gi < laid.length; gi++) {
    for (const t of hand) {
      if (canExtendGroup(laid[gi], t)) return { tile: t, groupIdx: gi };
    }
  }
  return null;
}

// -------------------------------------------------------------------------
// Yapay zekâ
// -------------------------------------------------------------------------

/** Verilen taş eli geliştiriyor mu? (yerden taş alma kararı) */
export function improvesHand(hand: Tile[], cand: Tile, mode: OkeyMode): boolean {
  const needPair = mode === "okey";
  const before = bestDecomposition(hand, needPair);
  const after = bestDecomposition([...hand, cand], needPair);
  if (after.usedCount > before.usedCount) return true;
  if (after.usedCount === before.usedCount && after.deadwoodValue < before.deadwoodValue) {
    return true;
  }
  return false;
}

/** Bilgisayarın düşeceği taşı seçer: en değersiz ölü taş (joker son çare) */
export function aiChooseDiscard(hand: Tile[]): Tile {
  const d = bestDecomposition(hand, false);
  const pool = d.deadwood.length > 0 ? d.deadwood : hand;
  const sorted = [...pool].sort((a, b) => tileValue(b) - tileValue(a));
  const nonWild = sorted.find((t) => !t.wild);
  return nonWild ?? sorted[0];
}

// -------------------------------------------------------------------------
// Zor yapay zekâ: aday bazlı bırakma + yerden taş alma + savunma
// -------------------------------------------------------------------------

/** Aynı numara+rengin ikizi yere inmiş mi? (düşük riskli bırakma) */
function twinVisible(t: Tile, visible: Tile[]): boolean {
  if (t.wild) return false;
  return visible.some((v) => !v.wild && v.num === t.num && v.color === t.color);
}

/** Elin gücü: kaplanan taş sayısı öncelikli, ölü taş değeri düşük olsun */
function handStrength(hand: Tile[], mode: OkeyMode): number {
  const d = bestDecomposition(hand, mode === "okey");
  return d.usedCount * 1000 - d.deadwoodValue;
}

/**
 * Zor bırakma seçimi: her taşı tek tek düşürüp kalan elin gücünü ölçer.
 * Savunma: ikizi yere inmiş taşları, soğumuş sayıları ve kenar taşları (1/13)
 * bırakmayı tercih eder; jokeri son çareye kadar elde tutar.
 */
export function aiBestDiscard(hand: Tile[], mode: OkeyMode, visible: Tile[] = []): Tile {
  if (hand.length <= 1) return hand[0];
  const seenNum = new Map<number, number>();
  for (const v of visible) {
    if (!v.wild) seenNum.set(v.num, (seenNum.get(v.num) ?? 0) + 1);
  }
  // Büyük ellerde (16+ taş, 101 ailesi) her taşı denemek pahalı olur:
  // önce tek dekompozisyonla ölü taşları bul, adayları onlarla sınırla.
  let candidates = hand;
  if (hand.length > 15) {
    const d0 = bestDecomposition(hand, mode === "okey");
    const dead = d0.deadwood.filter((t) => !t.wild);
    const deadIds = new Set(dead.map((t) => t.id));
    const extras = hand
      .filter((t) => !t.wild && !deadIds.has(t.id))
      .sort((a, b) => tileValue(a) - tileValue(b))
      .slice(0, 3);
    if (dead.length + extras.length > 0) candidates = [...dead, ...extras];
  }
  let best = hand[0];
  let bestScore = -Infinity;
  for (const t of candidates) {
    const rest = hand.filter((x) => x.id !== t.id);
    const d = bestDecomposition(rest, mode === "okey");
    let score = d.usedCount * 1000 - d.deadwoodValue;
    if (t.wild) {
      score -= 400; // jokeri elde tut
    } else {
      if (twinVisible(t, visible)) score += 35; // ikizi görünmüş: risksiz bırakma
      if (t.num === 1 || t.num === 13) score += 12; // kenar taş seride daha dar
      score += Math.min(seenNum.get(t.num) ?? 0, 5) * 7; // soğumuş (görülmüş) sayılar
    }
    if (score > bestScore) {
      bestScore = score;
      best = t;
    }
  }
  return best;
}

/**
 * Yerdeki taş alınır mı? Alındıktan sonra yapılabilecek en iyi bırakmayla
 * birlikte ölçer; küçük kazançlar için riske girmez, büyük kazançta alır.
 */
export function aiShouldTake(hand: Tile[], cand: Tile, mode: OkeyMode, visible: Tile[] = []): boolean {
  if (hand.length === 0) return true;
  const currentBest = aiBestDiscard(hand, mode, visible);
  const strengthNow = handStrength(hand.filter((t) => t.id !== currentBest.id), mode);
  const after = [...hand, cand];
  const takeBest = aiBestDiscard(after, mode, visible);
  const strengthTake = handStrength(after.filter((t) => t.id !== takeBest.id), mode);
  return strengthTake >= strengthNow + 10;
}
