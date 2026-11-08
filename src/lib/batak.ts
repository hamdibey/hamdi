// ---------------------------------------------------------------------------
// Batak (ihaleli) motoru — 52 kart, 4 oyuncu, 13 el. İhale, koz seçimi,
// takip kuralı ve bilgisayar yapay zekâsı.
// ---------------------------------------------------------------------------
export type Suit = 0 | 1 | 2 | 3; // ♠ ♣ ♥ ♦

export interface BCard {
  id: string;
  suit: Suit;
  rank: number; // 2..14 (11=V, 12=K, 13=Q? — 11=Vale 12=Kral 13=Diz 14=As)
}

export const SUIT_MARKS = ["♠", "♣", "♥", "♦"];
export const SUIT_NAMES = ["Maça", "Kupa", "Karo", "Sinek"];
export const RANK_LABELS: Record<number, string> = {
  11: "V",
  12: "Q",
  13: "K",
  14: "A",
};

export function cardLabel(c: BCard): string {
  return `${RANK_LABELS[c.rank] ?? c.rank}${SUIT_MARKS[c.suit]}`;
}

let bid = 0;
const nid = () => `b${bid++}`;

export function createBDeck(): BCard[] {
  const d: BCard[] = [];
  for (let s = 0 as Suit; s < 4; s = (s + 1) as Suit) {
    for (let r = 2; r <= 14; r++) d.push({ id: nid(), suit: s, rank: r });
  }
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

export interface BSetup {
  hands: BCard[][]; // 4 el × 13 kart (defineli: 12'şer)
  define: BCard[]; // defineli (gömmeli) modda 4 kart
}

/** Dağıtım: normal 13'er; defineli (gömmeli) 12'şer + 4 kart definede */
export function dealBatak(defineli = false): BSetup {
  const deck = shuffle(createBDeck());
  if (defineli) {
    return {
      hands: [deck.slice(0, 12), deck.slice(12, 24), deck.slice(24, 36), deck.slice(36, 48)],
      define: deck.slice(48, 52),
    };
  }
  return {
    hands: [deck.slice(0, 13), deck.slice(13, 26), deck.slice(26, 39), deck.slice(39, 52)],
    define: [],
  };
}

/** Defineli: kaptan 4 en zayıf kartını atıp define'yi alır (AI otomatik) */
export function aiDefineSwap(hand: BCard[], define: BCard[]): BCard[] {
  const sorted = [...hand].sort((a, b) => a.rank - b.rank);
  const discard = new Set(sorted.slice(0, 4).map((c) => c.id));
  return [...hand.filter((c) => !discard.has(c.id)), ...define];
}

export function sortHand(hand: BCard[]) {
  hand.sort((a, b) => a.suit - b.suit || a.rank - b.rank);
}

// ── İhale gücü değerlendirme ────────────────────────────────────
/** Eldeki potansiyel el sayısı tahmini (As/Kral/Uzun seri bonusları) */
export function handStrength(hand: BCard[]): number {
  const bySuit: BCard[][] = [[], [], [], []];
  for (const c of hand) bySuit[c.suit].push(c);
  let score = 0;
  for (const suit of bySuit) {
    const ranks = new Set(suit.map((c) => c.rank));
    if (ranks.has(14)) score += 1.2;
    if (ranks.has(13)) score += 0.6;
    if (ranks.has(12)) score += 0.3;
    // Uzun seri bonusu (5+ kart)
    if (suit.length >= 5) score += (suit.length - 4) * 0.5;
    // Koz adayı uzunluk
    if (suit.length >= 4 && (ranks.has(14) || ranks.has(13))) score += 0.8;
  }
  return score;
}

/** AI ihale kararı: güçten yola çıkarak 2..7 arası teklif ya da pas (0) */
export function aiBid(hand: BCard[]): number {
  const s = handStrength(hand) + (Math.random() * 0.8 - 0.4);
  if (s < 2.2) return 0; // pas
  return Math.min(7, Math.max(2, Math.round(s)));
}

/** Koz seçimi: en güçlü / en uzun seri */
export function aiChooseTrump(hand: BCard[]): Suit {
  const bySuit: BCard[][] = [[], [], [], []];
  for (const c of hand) bySuit[c.suit].push(c);
  let best: Suit = 0;
  let bestScore = -1;
  for (let s = 0 as Suit; s < 4; s = (s + 1) as Suit) {
    const ranks = new Set(bySuit[s].map((c) => c.rank));
    let sc = bySuit[s].length;
    if (ranks.has(14)) sc += 2;
    if (ranks.has(13)) sc += 1;
    if (sc > bestScore) {
      bestScore = sc;
      best = s;
    }
  }
  return best;
}

// ── El kuralları ────────────────────────────────────────────────
/** Oynanabilir kartlar: takip zorunlu, boşsa serbest.
 * Açık batak (eşli): koz çıkmadan da koz oynanabilir — takip + koz serbest. */
export function legalCards(
  hand: BCard[],
  trick: { suit: Suit }[],
  trump?: Suit | null,
  esli = false
): BCard[] {
  if (trick.length === 0) return hand;
  const led = trick[0].suit;
  const follow = hand.filter((c) => c.suit === led);
  if (follow.length === 0) return hand;
  // Açık batak: elinde açılan renk varken bile koz oynayabilirsin
  if (esli && trump != null) {
    const trumps = hand.filter((c) => c.suit === trump);
    if (trumps.length > 0) return [...follow, ...trumps];
  }
  return follow;
}

/** Taktı kim kazanır (koz varsa o, yoksa ilk atılan renkte en yüksek) */
export function trickWinner(
  trick: { suit: Suit; rank: number }[],
  trump: Suit
): number {
  let best = 0;
  for (let i = 1; i < trick.length; i++) {
    const a = trick[i];
    const b = trick[best];
    if (a.suit === b.suit) {
      if (a.rank > b.rank) best = i;
    } else if (a.suit === trump) {
      best = i;
    }
  }
  return best;
}

/**
 * Zor AI kart seçimi:
 * - Açılış: uzun serinin en yüksekinden başla; kozu koru.
 * - Takip: kartı yenebiliyorsan en ucuz yenen kart, yoksa en düşük kart.
 */
export function aiChooseCard(
  hand: BCard[],
  trick: { suit: Suit; rank: number }[],
  trump: Suit,
  esli = false
): BCard {
  const options = legalCards(hand, trick, trump, esli);
  if (options.length === 1) return options[0];
  const sortedLow = [...options].sort((a, b) => a.rank - b.rank);
  const sortedHigh = [...options].sort((a, b) => b.rank - a.rank);

  if (trick.length === 0) {
    // Açılış: koza girmeyi dene ama büyük kozu sakla; elde uzun seri varsa en yüksek kart
    const trumps = options.filter((c) => c.suit === trump);
    if (trumps.length >= 3) return sortedHigh.find((c) => c.suit === trump)!;
    return sortedHigh[0];
  }

  // Takip: sıradaki kazananı bul
  const lead = trick[0].suit;
  const winning = trick[trickWinner(trick, trump)];
  const beatable = options.filter((c) => {
    if (winning.suit === trump) return c.suit === trump && c.rank > winning.rank;
    if (c.suit === winning.suit && winning.suit !== trump) return c.rank > winning.rank;
    return c.suit === trump; // koz atarak yenme
  });
  if (beatable.length > 0) {
    // Kazanabiliyorsan en ucuz yenen kartı oyna (kozu küçük tut)
    const cheap = [...beatable].sort((a, b) => a.rank - b.rank)[0];
    return cheap;
  }
  // Kazanamıyorsan en düşük kartı at
  void lead;
  return sortedLow[0];
}

// ── Puanlama (klasik ihaleli batak) ───────────────────────────
// Kaptan taahhüdünü tutturursa: +10 × aldığı el; batarsa: −10 × ihale.
// Diğerleri: +10 × aldıkları el; hiç el alamayan: −10 × ihale.
export function scoreRound(
  tricksWon: number[], // seat başına kazanılan el sayısı
  captainSeat: number,
  bidTricks: number
): number[] {
  return tricksWon.map((n, i) => {
    if (i === captainSeat) return n >= bidTricks ? n * 10 : -bidTricks * 10;
    if (n === 0) return -bidTricks * 10; // hiç el alamayan batar
    return n * 10;
  });
}
