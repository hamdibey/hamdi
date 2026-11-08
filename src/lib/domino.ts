// ---------------------------------------------------------------------------
// Domino motoru — 28 kemiklik deste, 4 oyuncu, "kemiklik" (banka) ve
// "kilitlenme" (el bağlanma) kuralıyla. Ayaz (0-0) 20 ceza sayılır.
// ---------------------------------------------------------------------------

export interface Bone {
  id: string;
  a: number;
  b: number;
}

export interface ChainItem {
  bone: Bone;
  flipped: boolean; // true ise b ucu solda
}

export type DominoMode = "bes" | "yedi"; // 5'li veya 7'li dağıtım

export interface DominoPlayer {
  name: string;
  isUser: boolean;
  hand: Bone[];
  score: number; // biriken ceza
}

export interface DominoState {
  players: DominoPlayer[];
  kemiklik: Bone[]; // banka / çekilecek taşlar
  chain: ChainItem[];
  turn: number;
  passCount: number; // üst üste pas (kilitlenme takibi)
  mustDraw: boolean; // oynayamayan oyuncu kemiklikten çekmek zorunda
  lastMove: string;
  finished: boolean;
  deadlock: boolean; // kilitlenme (el bağlandı)
  winner: number | null;
  handOver: boolean;
  penalties: Record<string, number>; // bu el yazılan cezalar
  matchOver: boolean;
  loser: number | null; // 101 cezayı geçen
}

const TARGET = 101;

export function createDominoDeck(): Bone[] {
  const d: Bone[] = [];
  let n = 0;
  for (let a = 0; a <= 6; a++) {
    for (let b = a; b <= 6; b++) {
      d.push({ id: `d${n++}`, a, b });
    }
  }
  return d;
}

export function bonePoints(b: Bone): number {
  return b.a === 0 && b.b === 0 ? 20 : b.a + b.b; // ayaz 20 sayılır
}

export function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

const AI_NAMES = ["Kemal", "Zeynep", "Serkan", "Ayşe", "Baran", "Deniz"];

export function newDominoGame(userName: string, mode: DominoMode = "bes", aiNames: string[] = AI_NAMES): DominoState {
  const deck = shuffle(createDominoDeck());
  const count = mode === "yedi" ? 7 : 5;
  const players: DominoPlayer[] = [
    { name: userName, isUser: true, hand: [], score: 0 },
    ...Array.from({ length: 3 }, (_, i) => ({
      name: aiNames[i] ?? AI_NAMES[i],
      isUser: false,
      hand: [],
      score: 0,
    })),
  ];
  for (const p of players) {
    p.hand = deck.splice(0, count);
    p.hand.sort((x, y) => x.a + x.b - (y.a + y.b));
  }
  const st: DominoState = {
    players,
    kemiklik: deck,
    chain: [],
    turn: 0,
    passCount: 0,
    mustDraw: false,
    lastMove: "Oyun başladı. Çift taşı olan oyuncu açar.",
    finished: false,
    deadlock: false,
    winner: null,
    handOver: false,
    penalties: {},
    matchOver: false,
    loser: null,
  };
  startHand(st);
  return st;
}

/** Elin başlangıcı: çift taşı en yüksek olan oyuncu açar; kimse çift tutmuyorsa en yüksek taşı olan açar */
function startHand(st: DominoState) {
  st.chain = [];
  st.passCount = 0;
  st.handOver = false;
  st.deadlock = false;
  st.winner = null;
  st.finished = false;
  st.mustDraw = false;
  st.penalties = {};

  let best = -1;
  let bestPlayer = 0;
  for (let pi = 0; pi < st.players.length; pi++) {
    for (const b of st.players[pi].hand) {
      if (b.a === b.b && b.a > best) {
        best = b.a;
        bestPlayer = pi;
      }
    }
  }
  if (best >= 0) {
    st.turn = bestPlayer;
    st.lastMove = `${st.players[bestPlayer].name} oyunu ${best}-${best} çift taşıyla açtı.`;
  } else {
    // çift yoksa en yüksek taşı olan oyuncu açar
    let hi = -1;
    for (let pi = 0; pi < st.players.length; pi++) {
      for (const b of st.players[pi].hand) {
        const v = Math.max(b.a, b.b) * 10 + b.a + b.b;
        if (v > hi) {
          hi = v;
          bestPlayer = pi;
        }
      }
    }
    st.turn = bestPlayer;
  }
}

export interface ChainEnds {
  left: number;
  right: number;
}

export function chainEnds(st: DominoState): ChainEnds | null {
  if (st.chain.length === 0) return null;
  const first = st.chain[0];
  const last = st.chain[st.chain.length - 1];
  return {
    left: first.flipped ? first.bone.b : first.bone.a,
    right: last.flipped ? last.bone.a : last.bone.b,
  };
}

export function playableSides(b: Bone, st: DominoState): ("left" | "right")[] {
  const ends = chainEnds(st);
  if (!ends) return ["left"];
  const res: ("left" | "right")[] = [];
  if (b.a === ends.left || b.b === ends.left) res.push("left");
  if (b.a === ends.right || b.b === ends.right) res.push("right");
  return res;
}

export function canPlayAny(hand: Bone[], st: DominoState): boolean {
  return hand.some((b) => playableSides(b, st).length > 0);
}

/** Kilitlenme: oynanacak taş yok ve kemiklik boş — el bağlanır */
function checkDeadlock(st: DominoState): boolean {
  if (st.kemiklik.length > 0) return false;
  return st.players.every((p) => p.hand.length === 0 || !canPlayAny(p.hand, st));
}

function endHand(st: DominoState, winner: number | null, deadlock: boolean) {
  st.handOver = true;
  st.deadlock = deadlock;
  st.winner = winner;
  st.penalties = {};
  if (winner !== null) {
    // Biten oyuncu dışındakilerin elindeki taşlar ceza yazılır
    for (let i = 0; i < st.players.length; i++) {
      if (i === winner) continue;
      const pts = st.players[i].hand.reduce((s, b) => s + bonePoints(b), 0);
      st.players[i].score += pts;
      st.penalties[st.players[i].name] = pts;
    }
    st.lastMove = `${st.players[winner].name} eli bitirdi!`;
  } else {
    // Kilitlenme: herkesin elinde kalan taş ceza yazılır, en az kalan kazanır
    let bestIdx = 0;
    let bestVal = Infinity;
    for (let i = 0; i < st.players.length; i++) {
      const pts = st.players[i].hand.reduce((s, b) => s + bonePoints(b), 0);
      st.players[i].score += pts;
      st.penalties[st.players[i].name] = pts;
      if (pts < bestVal) {
        bestVal = pts;
        bestIdx = i;
      }
    }
    st.winner = bestIdx;
    st.lastMove = "Kilitlenme! El bağlandı, herkesin elindeki taş ceza yazıldı.";
  }
  const over = st.players.findIndex((p) => p.score >= TARGET);
  if (over >= 0) {
    st.matchOver = true;
    st.loser = over;
  }
}

export function dominoPlay(st: DominoState, pi: number, boneId: string, side: "left" | "right"): boolean {
  const p = st.players[pi];
  const idx = p.hand.findIndex((b) => b.id === boneId);
  if (idx < 0) return false;
  const b = p.hand[idx];
  if (!playableSides(b, st).includes(side)) return false;
  p.hand.splice(idx, 1);
  st.passCount = 0;
  st.mustDraw = false;
  if (st.chain.length === 0) {
    st.chain.push({ bone: b, flipped: side === "left" });
  } else if (side === "left") {
    st.chain.unshift({ bone: b, flipped: true });
  } else {
    st.chain.push({ bone: b, flipped: false });
  }
  st.lastMove = `${p.name} ${b.a}-${b.b} taşını oynadı.`;
  if (p.hand.length === 0) {
    endHand(st, pi, false);
    return true;
  }
  if (st.kemiklik.length === 0 && checkDeadlock(st)) {
    endHand(st, null, true);
    return true;
  }
  st.turn = (st.turn + 1) % st.players.length;
  st.mustDraw = !canPlayAny(st.players[st.turn].hand, st) && st.kemiklik.length > 0;
  return true;
}

/** Oynayamayan oyuncu kemiklikten taş çeker; oynayabilirse çeker, oynayamazsa pas geçer */
export function dominoDraw(st: DominoState): "drew" | "passed" | "cannot" {
  const p = st.players[st.turn];
  if (canPlayAny(p.hand, st)) return "cannot"; // oynayabilir — çekemez
  if (st.kemiklik.length === 0) {
    // pas
    st.passCount++;
    st.lastMove = `${p.name} pas geçti.`;
    if (st.passCount >= st.players.length || checkDeadlock(st)) {
      endHand(st, null, true);
      return "passed";
    }
    st.turn = (st.turn + 1) % st.players.length;
    st.mustDraw = !canPlayAny(st.players[st.turn].hand, st) && st.kemiklik.length > 0;
    return "passed";
  }
  const drawn = st.kemiklik.pop()!;
  p.hand.push(drawn);
  p.hand.sort((x, y) => x.a + x.b - (y.a + y.b));
  st.mustDraw = false;
  st.lastMove = `${p.name} kemiklikten taş çekti.`;
  return "drew";
}

export function nextTurn(st: DominoState) {
  if (st.handOver || st.matchOver) return;
  st.turn = (st.turn + 1) % st.players.length;
  st.mustDraw = !canPlayAny(st.players[st.turn].hand, st) && st.kemiklik.length > 0;
}

/** Bilgisayara karşı bir hamle: oynayabiliyorsa oynar, oynayamıyorsa çeker/pas geçer */
export function aiDominoMove(st: DominoState): void {
  if (st.handOver || st.matchOver) return;
  const p = st.players[st.turn];
  if (canPlayAny(p.hand, st)) {
    // Ucuz taştan başla, çift taşları erken at
    const options: { bone: Bone; side: "left" | "right"; val: number }[] = [];
    for (const b of p.hand) {
      for (const s of playableSides(b, st)) {
        options.push({ bone: b, side: s, val: bonePoints(b) + (b.a === b.b ? 6 : 0) });
      }
    }
    options.sort((x, y) => x.val - y.val);
    const pick = options[0];
    dominoPlay(st, st.turn, pick.bone.id, pick.side);
    return;
  }
  // Oynayamıyor: kemiklikten çek, oynayabilirse oyna, yoksa pas
  let guard = 0;
  while (!canPlayAny(p.hand, st) && st.kemiklik.length > 0 && guard++ < 30) {
    dominoDraw(st);
    if (st.handOver) return;
  }
  if (st.handOver) return;
  if (canPlayAny(p.hand, st)) {
    aiDominoMove(st);
  } else {
    dominoDraw(st); // pas / kilitlenme
  }
}
