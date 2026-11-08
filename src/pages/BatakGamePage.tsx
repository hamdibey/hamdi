import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { oyunHiziCarpani } from "../lib/ayarlar";
import {
  dealBatak,
  sortHand,
  aiBid,
  aiChooseTrump,
  aiChooseCard,
  aiDefineSwap,
  legalCards,
  trickWinner,
  scoreRound,
  SUIT_MARKS,
  SUIT_NAMES,
  cardLabel,
  type BCard,
  type Suit,
} from "../lib/batak";
import { useApp } from "../store/useApp";
import { AutoFit } from "../components/AutoFit";
import { MasaBekleme } from "../components/MasaBekleme";
import { api, parsePlayers } from "../lib/api";
import { masadanCik } from "../lib/masa";

// AI rakip isimleri — masaya bot davet edilirse bot isimleriyle değişir
let AI_NAMES = ["Kemal", "Zeynep", "Serkan"];
const setAiNames = (names: string[]) => {
  if (names.length > 0) AI_NAMES = names.slice(0, 3);
};
const TARGET = 101;

type Phase = "bid" | "define" | "trump" | "play" | "roundOver" | "matchOver";

interface BState {
  hands: BCard[][];
  phase: Phase;
  turn: number; // ihale sırası / el sırası
  currentBid: number;
  bidStarter: number;
  bidPassed: boolean[]; // her oyuncu pas dedi mi
  captain: number;
  trump: Suit | null;
  trick: { seat: number; card: BCard }[];
  tricksWon: number[];
  roundScores: number[] | null;
  matchOver: boolean;
  winnerSeat: number;
  log: string[];
  // Klasik İhaleli Batak: defineli (gömmeli) + eşli (açık batak)
  define: BCard[]; // defineli modda 4 kart
  defineli: boolean;
  esli: boolean; // açık batak: eşin eli görünür, koz çıkmadan koz oynanabilir
  swapped: boolean; // kaptan define değişimi yaptı mı
}

function newRound(scores: number[], prevCaptain: number, defineli = false, esli = false): BState {
  const { hands, define } = dealBatak(defineli);
  hands.forEach(sortHand);
  const starter = (prevCaptain + 1) % 4;
  return {
    hands,
    phase: "bid",
    turn: starter,
    currentBid: 2,
    bidStarter: starter,
    bidPassed: [false, false, false, false],
    captain: -1,
    trump: null,
    trick: [],
    tricksWon: [0, 0, 0, 0],
    roundScores: null,
    matchOver: false,
    winnerSeat: -1,
    log: [`Yeni el dağıtıldı${defineli ? " (defineli: 12'şer kart + 4 definede)" : ""}. İhale sırası ${starter === 0 ? "sende" : "rakipte"}.`],
    define,
    defineli,
    esli,
    swapped: false,
  };
}

/** Defineli modda eldeki toplam el sayısı (12), normalde 13 */
const toplamEl = (st: BState) => (st.defineli ? 12 : 13);

function pushLog(st: BState, msg: string) {
  st.log = [...st.log.slice(-8), msg];
}

function BatakCard({
  card,
  size = "md",
  selected,
  dimmed,
  onClick,
}: {
  card: BCard;
  size?: "sm" | "md" | "lg";
  selected?: boolean;
  dimmed?: boolean;
  onClick?: () => void;
}) {
  const red = card.suit === 1 || card.suit === 2;
  const S = {
    sm: { w: "w-9", h: "h-12", num: "text-sm", mark: "text-[9px]", pad: "p-0.5" },
    md: { w: "w-12", h: "h-16", num: "text-lg", mark: "text-[11px]", pad: "p-1" },
    lg: { w: "w-16", h: "h-20", num: "text-2xl", mark: "text-sm", pad: "p-1" },
  }[size];
  const label = card.rank >= 11 ? cardLabel(card).slice(0, -1) : String(card.rank);
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!onClick}
      className={`tile-face relative rounded-md ${S.w} ${S.h} ${S.pad} flex flex-col items-center justify-between shrink-0
        transition-transform duration-100 outline-none
        ${onClick ? "cursor-pointer hover:-translate-y-1" : "cursor-default"}
        ${selected ? "-translate-y-2 ring-2 ring-gold-400" : ""}
        ${dimmed ? "opacity-45" : ""}`}
      title={cardLabel(card)}
    >
      <span className={`${S.num} font-bold leading-none font-display ${red ? "text-red-700" : "text-slate-900"}`}>
        {label}
      </span>
      <span className={`${S.mark} leading-none ${red ? "text-red-700" : "text-slate-900"} opacity-80`}>
        {SUIT_MARKS[card.suit]}
      </span>
      <span className={`${S.num} font-bold leading-none font-display rotate-180 ${red ? "text-red-700" : "text-slate-900"}`}>
        {label}
      </span>
    </button>
  );
}

export function BatakGamePage() {
  const me = useApp((s) => s.me);
  const showToast = useApp((s) => s.showToast);

  // Oyun sayfasından çıkınca masadan kalk — son oyuncu çıkınca masa herkes için kapanır
  useEffect(() => {
    return () => {
      const id = useApp.getState().activeTable;
      if (id != null) {
        void api.leaveTable(id).catch(() => {});
        useApp.getState().setActiveTable(null);
      }
    };
  }, []);
  // Masadaki bot isimlerini oku — davet edilen botlar gerçek rakip olarak oynar
  // Masa bekleme lobisi: 3 rakip oturana kadar oyun AÇILMAZ (sahte AI dolmaz)
  const activeTableId = useApp.getState().activeTable;
  const [waiting, setWaiting] = useState(activeTableId != null);
  const [tableOpp, setTableOpp] = useState<{ nick: string; bot?: boolean }[]>([]);
  useEffect(() => {
    const id = useApp.getState().activeTable;
    if (id == null) { setWaiting(false); return; }
    let alive = true;
    const tick = async () => {
      try {
        const r = await api.table(id);
        const all = parsePlayers(r.table).filter((p) => p.nick !== (me?.nick ?? ""));
        if (!alive) return;
        setTableOpp(all.slice(0, 3));
        if (all.length >= 3) { setAiNames(all.slice(0, 3).map((p) => p.nick)); setWaiting(false); }
        else setWaiting(true);
      } catch { /* yoksay */ }
    };
    void tick();
    const t = window.setInterval(() => { if (alive) void tick(); }, 5000);
    return () => { alive = false; window.clearInterval(t); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const [scores, setScores] = useState<number[]>([0, 0, 0, 0]);
  const [st, setSt] = useState<BState>(() => newRound([0, 0, 0, 0], 3));
  const [sel, setSel] = useState<string | null>(null);
  const [bidChoice, setBidChoice] = useState(0); // 0=pas, 2..7
  const [defineSel, setDefineSel] = useState<string[]>([]); // defineli: atılacak 4 kart
  const stRef = useRef(st);
  stRef.current = st;
  const timers = useRef<number[]>([]);
  // Masa ayarları: defineli / eşli (açık batak) — masadan okunur, yoksa normal batak
  const gameOpts = useRef<{ defineli: boolean; esli: boolean }>({ defineli: false, esli: false });
  useEffect(() => {
    const id = useApp.getState().activeTable;
    if (id == null) return;
    void api.table(id).then((r) => {
      try {
        const s: Record<string, unknown> = r.table.settings ? JSON.parse(r.table.settings) : {};
        gameOpts.current = { defineli: !!s.defineli, esli: !!s.esli };
      } catch { /* normal batak */ }
    }).catch(() => {});
  }, []);

  const clearTimers = () => {
    timers.current.forEach((t) => window.clearTimeout(t));
    timers.current = [];
  };
  useEffect(() => clearTimers, []);

  const myHand = st.hands[0];
  const myTurn = st.turn === 0;
  const canPlay =
    st.phase === "play" && myTurn && st.trick.length < 4;
  const myOptions = useMemo(
    () => (canPlay ? legalCards(myHand, st.trick.map((t) => t.card), st.trump, st.esli) : []),
    [canPlay, myHand, st.trick, st.trump, st.esli]
  );
  // Eşli (açık batak): kaptanın eşi (kaptan+2) % 4 — eli herkes görür
  const partnerSeat = st.captain >= 0 ? (st.captain + 2) % 4 : -1;

  // ── AI hamleleri (zamanlanmış) ────────────────────────────────
  useEffect(() => {
    if (waiting) return;
    const s = stRef.current;
    clearTimers();

    // İhale AI
    if (s.phase === "bid" && s.turn !== 0) {
      const seat = s.turn;
      const t = window.setTimeout(() => {
        const cur = stRef.current;
        if (cur.phase !== "bid" || cur.turn !== seat) return;
        const next: BState = { ...cur, bidPassed: [...cur.bidPassed], log: [...cur.log], hands: cur.hands.map((h) => [...h]) };
        const strengthBid = aiBid(next.hands[seat]);
        const name = next.hands[seat] && seat !== 0 ? AI_NAMES[(seat - 1) % 3] : "Rakip";
        if (strengthBid > next.currentBid && next.currentBid < 7) {
          next.currentBid = strengthBid;
          pushLog(next, `${name} ihaleye girdi: ${strengthBid} el.`);
        } else {
          next.bidPassed[seat] = true;
          pushLog(next, `${name} pas dedi.`);
        }
        advanceBidding(next);
        setSt(next);
      }, 800 * oyunHiziCarpani());
      timers.current.push(t);
      return;
    }

    // Define değişimi AI (kaptan AI ise) — 4 en zayıf kartı atıp define'yi alır
    if (s.phase === "define" && s.captain !== 0) {
      const seat = s.captain;
      const t = window.setTimeout(() => {
        const cur = stRef.current;
        if (cur.phase !== "define" || cur.captain !== seat) return;
        const next: BState = { ...cur, log: [...cur.log], hands: cur.hands.map((h) => [...h]) };
        next.hands[seat] = aiDefineSwap(next.hands[seat], next.define);
        sortHand(next.hands[seat]);
        next.define = [];
        next.swapped = true;
        pushLog(next, `${AI_NAMES[(seat - 1) % 3]} defineyi değiştirdi (4 kart attı).`);
        next.phase = "trump";
        next.turn = seat;
        setSt(next);
      }, 900 * oyunHiziCarpani());
      timers.current.push(t);
      return;
    }

    // Koz seçimi AI (kaptan AI ise)
    if (s.phase === "trump" && s.captain !== 0) {
      const seat = s.captain;
      const t = window.setTimeout(() => {
        const cur = stRef.current;
        if (cur.phase !== "trump" || cur.captain !== seat) return;
        const next: BState = { ...cur, log: [...cur.log], hands: cur.hands.map((h) => [...h]) };
        next.trump = aiChooseTrump(next.hands[seat]);
        pushLog(next, `${AI_NAMES[(seat - 1) % 3]} kozu ${SUIT_NAMES[next.trump]} yaptı.`);
        next.phase = "play";
        next.turn = seat;
        setSt(next);
      }, 700 * oyunHiziCarpani());
      timers.current.push(t);
      return;
    }

    // El oynama AI
    if (s.phase === "play" && s.turn !== 0 && s.trick.length < 4) {
      const seat = s.turn;
      const t = window.setTimeout(() => {
        const cur = stRef.current;
        if (cur.phase !== "play" || cur.turn !== seat || cur.trick.length >= 4) return;
        const next: BState = { ...cur, log: [...cur.log], hands: cur.hands.map((h) => [...h]) };
        const card = aiChooseCard(next.hands[seat], next.trick.map((x) => x.card), next.trump!, next.esli);
        next.hands[seat] = next.hands[seat].filter((c) => c.id !== card.id);
        next.trick = [...next.trick, { seat, card }];
        pushLog(next, `${AI_NAMES[(seat - 1) % 3]} ${cardLabel(card)} attı.`);
        advancePlay(next);
        setSt(next);
      }, 800 * oyunHiziCarpani());
      timers.current.push(t);
      return;
    }

    // El sonu → sonraki tur
    if (s.phase === "play" && s.trick.length === 4) {
      const t = window.setTimeout(() => {
        const cur = stRef.current;
        if (cur.phase !== "play" || cur.trick.length !== 4) return;
        const next: BState = { ...cur, log: [...cur.log], hands: cur.hands.map((h) => [...h]) };
        resolveTrick(next);
        setSt(next);
      }, 1100 * oyunHiziCarpani());
      timers.current.push(t);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [st.phase, st.turn, st.trick.length, st.currentBid, st.captain, st.trump]);

  const advanceBidding = (next: BState) => {
    // Tüm paslar toplandı mı?
    const active = [0, 1, 2, 3].filter((i) => !next.bidPassed[i]);
    if (active.length === 0) {
      pushLog(next, "Herkes pas dedi — el yeniden dağıtılıyor.");
      const st2 = newRound(scores, next.bidStarter, gameOpts.current.defineli, gameOpts.current.esli);
      Object.assign(next, st2);
      return;
    }
    if (active.length === 1 && next.bidPassed[next.turn]) {
      // İhale kapandı
      finishBidding(next, active[0]);
      return;
    }
    // Sıradaki paslamamış oyuncuya geç
    let n = next.turn;
    for (let i = 0; i < 4; i++) {
      n = (n + 1) % 4;
      if (!next.bidPassed[n]) break;
    }
    next.turn = n;
    if (n === 0) setBidChoice(0);
  };

  const finishBidding = (next: BState, captain: number) => {
    next.captain = captain;
    next.turn = captain;
    pushLog(next, `İhale ${captain === 0 ? "sende" : AI_NAMES[(captain - 1) % 3] + "'de"}: ${next.currentBid} el.`);
    // Defineli (gömmeli): kaptan önce 4 kartını define ile değiştirir
    if (next.defineli && next.define.length === 4) {
      next.phase = "define";
      pushLog(next, `Defineli oyun — kaptan ${captain === 0 ? "sen" : AI_NAMES[(captain - 1) % 3]} 4 kartını değiştirecek.`);
      return;
    }
    next.phase = "trump";
    if (next.currentBid === 7) {
      // 7 = "yaz"; kaptan otomatik kozer, kapalı oyun
      next.trump = aiChooseTrump(next.hands[captain]);
      next.phase = "play";
      pushLog(next, `7 (yaz) ihalesi — koz ${SUIT_NAMES[next.trump]}.`);
    }
  };

  const advancePlay = (next: BState) => {
    if (next.trick.length < 4) {
      next.turn = (next.turn + 1) % 4;
      return;
    }
    // El çözülecek — resolveTrick zamanlayıcıda çağrılır
  };

  const resolveTrick = (next: BState) => {
    const cards = next.trick.map((t) => t.card);
    const w = trickWinner(cards, next.trump!);
    const winner = next.trick[w].seat;
    next.tricksWon[winner] += 1;
    pushLog(next, `${winner === 0 ? "Bu eli" : AI_NAMES[(winner - 1) % 3] + " eli"} kazandı: ${cardLabel(cards[w])}.`);
    next.trick = [];
    next.turn = winner;

    // El bitti mi? (defineli 12, normal 13 el)
    if (next.tricksWon.reduce((a, b) => a + b, 0) >= toplamEl(next)) {
      const rs = scoreRound(next.tricksWon, next.captain, next.currentBid);
      next.roundScores = rs;
      for (let i = 0; i < 4; i++) scores[i] += rs[i];
      next.matchOver = scores.some((s) => s >= TARGET);
      next.winnerSeat = scores.indexOf(Math.max(...scores));
      next.phase = next.matchOver ? "matchOver" : "roundOver";
      pushLog(next, `El bitti. ${rs.map((v, i) => `${i === 0 ? "Sen" : AI_NAMES[(i - 1) % 3]}: ${v >= 0 ? "+" : ""}${v}`).join(" · ")}`);
      setScores([...scores]);
      if (me && rs[0] !== 0) void settleChips(rs[0]);
      // Maç istatistikleri: maç bitince oynanan/kazanılan profiline yazılır (bir kez)
      if (next.matchOver && !gameStatRef.current) {
        gameStatRef.current = true;
        void api.recordGame(next.winnerSeat === 0).catch(() => {});
      }
    }
  };

  // ── Oyun sonu çiplerini veritabanına işle ─────────────────────
  const chipsSettled = useRef(false);
  const gameStatRef = useRef(false);
  const settleChips = useCallback(
    async (myDelta: number) => {
      if (!me || chipsSettled.current) return;
      chipsSettled.current = true;
      const gain = me.gold && myDelta > 0 ? myDelta * 2 : myDelta;
      try {
        await api.addChips(gain, "Batak oyun sonucu");
        await useApp.getState().syncMe();
        showToast(
          gain > 0
            ? `Kazandın! +${gain} çip${me.gold && myDelta > 0 ? " (Gold 2x)" : ""}`
            : `${gain} çip (Batak)`
        );
      } catch {
        /* çevrimdışı — çip işlenemedi */
      }
    },
    [me, showToast]
  );

  // ── Oyuncu aksiyonları ────────────────────────────────────────
  const doBid = (value: number) => {
    const cur = stRef.current;
    if (cur.phase !== "bid" || cur.turn !== 0) return;
    const next: BState = { ...cur, bidPassed: [...cur.bidPassed], log: [...cur.log], hands: cur.hands.map((h) => [...h]) };
    if (value === 0) {
      next.bidPassed[0] = true;
      pushLog(next, "Pas dedin.");
    } else {
      next.currentBid = value;
      pushLog(next, `İhaleye girdin: ${value} el.`);
    }
    advanceBidding(next);
    setSt(next);
  };

  const chooseTrump = (suit: Suit) => {
    const cur = stRef.current;
    if (cur.phase !== "trump" || cur.captain !== 0) return;
    const next: BState = { ...cur, log: [...cur.log] };
    next.trump = suit;
    next.phase = "play";
    next.turn = cur.captain;
    pushLog(next, `Kozun: ${SUIT_NAMES[suit]}.`);
    setSt(next);
  };

  const playCard = (card: BCard) => {
    if (!canPlay) return;
    if (!myOptions.some((c) => c.id === card.id)) {
      showToast("Takip zorunlu — aynı renkten kart oynamalısın.");
      return;
    }
    const next: BState = { ...st, log: [...st.log], hands: st.hands.map((h) => [...h]) };
    next.hands[0] = next.hands[0].filter((c) => c.id !== card.id);
    next.trick = [...next.trick, { seat: 0, card }];
    pushLog(next, `${cardLabel(card)} attın.`);
    advancePlay(next);
    setSel(null);
    setSt(next);
  };

  const newRoundClick = () => {
    chipsSettled.current = false;
    gameStatRef.current = false;
    const { defineli, esli } = gameOpts.current;
    if (st.matchOver) {
      setScores([0, 0, 0, 0]);
      setSt(newRound([0, 0, 0, 0], st.captain, defineli, esli));
    } else {
      setSt(newRound(scores, st.captain, defineli, esli));
    }
  };

  // Defineli: kaptan (sen) 4 kart seçer — attığın kartlar define ile değişir
  const confirmDefine = () => {
    const cur = stRef.current;
    if (cur.phase !== "define" || cur.captain !== 0 || defineSel.length !== 4) return;
    const next: BState = { ...cur, log: [...cur.log], hands: cur.hands.map((h) => [...h]) };
    const at = new Set(defineSel);
    const kept = next.hands[0].filter((c) => !at.has(c.id));
    next.hands[0] = [...kept, ...next.define];
    sortHand(next.hands[0]);
    next.define = [];
    next.swapped = true;
    pushLog(next, `4 kart attın, define ile değiştirdin.`);
    setDefineSel([]);
    // 7 (yaz) ihalesiyse koz otomatik seçilir
    if (next.currentBid === 7) {
      next.trump = aiChooseTrump(next.hands[0]);
      next.phase = "play";
      pushLog(next, `7 (yaz) ihalesi — koz ${SUIT_NAMES[next.trump]}.`);
    } else {
      next.phase = "trump";
      next.turn = 0;
    }
    setSt(next);
  };

  // Masa dolmadısa bekleme lobisi — oyun (kartlar) henüz açılmasın
  if (waiting && activeTableId != null) {
    return (
      <AutoFit width={1180} fitScreen className="felt-bg min-h-screen pb-8">
        <MasaBekleme tableId={activeTableId} gameLabel="Batak" opponents={tableOpp} onRefresh={() => {
          const id = useApp.getState().activeTable;
          if (id == null) return;
          void api.table(id).then((r) => {
            const all = parsePlayers(r.table).filter((p) => p.nick !== (me?.nick ?? ""));
            setTableOpp(all.slice(0, 3));
            if (all.length >= 3) { setAiNames(all.slice(0, 3).map((p) => p.nick)); setWaiting(false); }
          }).catch(() => {});
        }} />
      </AutoFit>
    );
  }

  return (
    <AutoFit width={1180} fitScreen className="felt-bg min-h-screen pb-8">
      <div className="bg-wood-950/90 border-b border-wood-800 px-4 py-2 flex items-center gap-4 flex-wrap text-sm">
        <button
          onClick={() => void masadanCik(() => useApp.getState().go({ name: "salon", game: "batak" }))}
          className="text-ivory-dark/60 hover:text-gold-400"
        >
          ← Salona Dön
        </button>
        <span className="font-display font-bold text-gold-400 text-lg">Batak</span>
        {st.trump !== null && (
          <span className="text-ivory-dark/60">
            Koz: <b className="text-gold-300">{SUIT_NAMES[st.trump]}</b>
          </span>
        )}
        {st.captain >= 0 && (
          <span className="text-ivory-dark/60">
            İhale: <b className="text-gold-300">{st.currentBid} el</b> —{" "}
            {st.captain === 0 ? "kaptan sensin" : `${AI_NAMES[(st.captain - 1) % 3]} kaptan`}
          </span>
        )}
        <span className="ml-auto text-ivory-dark/60">
          Kalan el: <b className="text-ivory">{toplamEl(st) - st.tricksWon.reduce((a, b) => a + b, 0)}</b>
        </span>
        {st.defineli && <span className="text-[#7dd3fc] text-xs font-bold">🪦 Defineli</span>}
        {st.esli && <span className="text-[#f0abfc] text-xs font-bold">🤝 Eşli (Açık Batak)</span>}
      </div>

      <div className="max-w-6xl mx-auto px-4 pt-4 flex flex-col lg:flex-row cq-row gap-4">
        <div className="flex-1 min-w-0">
          <div className="klasik-masa border-[5px] border-double border-[#8b5a2b] p-4">
            {/* Rakipler */}
            <div className="flex justify-around gap-2 mb-4">
              {[1, 2, 3].map((i) => (
                <BSeat key={i} idx={i} name={AI_NAMES[(i - 1) % 3]} cards={st.hands[i].length} active={st.turn === i && (st.phase === "bid" || st.phase === "play")} isCaptain={st.captain === i} />
              ))}
            </div>

            {/* Eşli (açık batak): kaptanın eşinin eli herkes tarafından görülür */}
            {st.esli && partnerSeat > 0 && st.phase !== "bid" && (
              <div className="mb-3 bg-[#12315c] border border-[#1d4d8c] rounded-xl px-3 py-2">
                <p className="text-[11px] font-bold text-[#f0abfc] mb-1.5">
                  🤝 Eşli — {AI_NAMES[(partnerSeat - 1) % 3]} (kaptanın eşi) — eli herkes görür:
                </p>
                <div className="flex flex-wrap gap-1">
                  {st.hands[partnerSeat].map((c) => (
                    <BatakCard key={c.id} card={c} size="sm" />
                  ))}
                </div>
              </div>
            )}

            {/* Takt alanı */}
            <div className="flex items-center justify-center gap-6 min-h-[110px] klasik-masa border border-white/40 p-3 flex-wrap">
              {st.trick.length === 0 ? (
                <p className="text-sm text-ivory-dark/40">Takt bekleniyor…</p>
              ) : (
                st.trick.map((t) => (
                  <div key={t.seat} className="text-center">
                    <BatakCard card={t.card} size="lg" />
                    <p className="text-[10px] text-ivory-dark/60 mt-1">
                      {t.seat === 0 ? "Sen" : AI_NAMES[(t.seat - 1) % 3]}
                    </p>
                  </div>
                ))
              )}
            </div>

            <p className="text-center text-sm text-gold-300 mt-3 min-h-[20px]">
              {st.phase === "bid"
                ? myTurn
                  ? "İhaleye gir (2'den başlar) ya da pas de."
                  : `${AI_NAMES[(st.turn - 1) % 3]} düşünüyor… (mevcut: ${st.currentBid})`
                : st.phase === "define"
                ? st.captain === 0
                  ? `Defineli oyun: defineyi elindeki 4 kartla değiştir — atmak istediğin ${4 - defineSel.length} kartı seç.`
                  : "Kaptan defineyi değiştiriyor…"
                : st.phase === "trump"
                ? st.captain === 0
                  ? "Kozunu seç!"
                  : "Kaptan koz seçiyor…"
                : st.phase === "play"
                ? myTurn
                  ? st.trick.length === 0
                    ? "Sen açıyorsun — istediğin kartı at."
                    : "Takip zorunlu: aynı renkten kart oyna."
                  : `${AI_NAMES[(st.turn - 1) % 3]} oynuyor...`
                : st.phase === "roundOver"
                ? "El bitti — yeni el için hazır ol."
                : "Maç sona erdi!"}
            </p>

            <div className="mt-2 text-[11px] text-ivory-dark/50 space-y-0.5 max-h-24 overflow-hidden">
              {st.log.slice(-4).map((l, i) => (
                <p key={i}>• {l}</p>
              ))}
            </div>
          </div>

          {/* İhale paneli */}
          {st.phase === "bid" && myTurn && (
            <div className="mt-4 bg-wood-950/80 border border-gold-700 rounded-2xl p-4">
              <p className="text-sm font-bold text-ivory mb-2">
                İhale: mevcut {st.currentBid} el. Sen ne diyorsun?
              </p>
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => doBid(0)}
                  className="px-4 py-2 rounded-lg bg-wood-900 hover:bg-wood-800 border border-wood-700 text-ivory-dark text-sm font-bold"
                >
                  Pas
                </button>
                {Array.from({ length: 5 }, (_, i) => i + 1).map((v) => {
                  const val = st.currentBid + v;
                  if (val > 7) return null;
                  return (
                    <button
                      key={val}
                      onClick={() => doBid(val)}
                      className="px-4 py-2 rounded-lg bg-gold-600 hover:bg-gold-500 text-wood-950 text-sm font-bold"
                    >
                      {val} el
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Koz seçimi */}
          {st.phase === "trump" && st.captain === 0 && (
            <div className="mt-4 bg-wood-950/80 border border-gold-700 rounded-2xl p-4">
              <p className="text-sm font-bold text-ivory mb-2">Kozunu seç:</p>
              <div className="flex gap-2">
                {([0, 1, 2, 3] as Suit[]).map((s) => (
                  <button
                    key={s}
                    onClick={() => chooseTrump(s)}
                    className="px-4 py-2 rounded-lg bg-wood-900 hover:bg-wood-800 border border-wood-700 text-ivory text-sm font-bold"
                  >
                    {SUIT_MARKS[s]} {SUIT_NAMES[s]}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Benim elim */}
          <div className="mt-4 bg-wood-950/80 border border-wood-700 rounded-2xl p-4">
            <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
              <span className="text-sm font-bold text-ivory">
                Elin ({myHand.length} kart) — Kazandığın el:{" "}
                <b className="text-gold-400">{st.tricksWon[0]}</b>
              </span>
              {st.phase === "define" && st.captain === 0 && (
                <button
                  onClick={confirmDefine}
                  disabled={defineSel.length !== 4}
                  className="px-4 py-1.5 rounded-lg font-bold text-sm bg-gold-600 hover:bg-gold-500 disabled:opacity-40 disabled:cursor-not-allowed text-wood-950"
                >
                  🪦 Seçili {defineSel.length}/4 kartı at, defineyi al
                </button>
              )}
            </div>
            {/* Defineli: kaptan (sen) define kartlarını görür */}
            {st.phase === "define" && st.captain === 0 && (
              <div className="mb-3 bg-[#0f2e2e] border border-[#1d5c5c] rounded-xl p-2">
                <p className="text-[11px] font-bold text-[#7dd3fc] mb-1.5">🪦 Definedeki 4 kart (elindeki 4 kartla değişecek):</p>
                <div className="flex flex-wrap gap-1.5">
                  {st.define.map((c) => (
                    <BatakCard key={c.id} card={c} size="md" />
                  ))}
                </div>
              </div>
            )}
            <div className="flex flex-wrap gap-1.5">
              {myHand.map((c) => (
                <BatakCard
                  key={c.id}
                  card={c}
                  size="md"
                  selected={st.phase === "define" ? defineSel.includes(c.id) : sel === c.id}
                  dimmed={canPlay && !myOptions.some((o) => o.id === c.id)}
                  onClick={
                    st.phase === "define" && st.captain === 0
                      ? () => {
                          setDefineSel((s) =>
                            s.includes(c.id) ? s.filter((x) => x !== c.id) : s.length < 4 ? [...s, c.id] : s
                          );
                        }
                      : canPlay
                      ? () => {
                          setSel(c.id);
                          playCard(c);
                        }
                      : undefined
                  }
                />
              ))}
            </div>
          </div>

          {/* Skor tablosu */}
          <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-2">
            {[0, 1, 2, 3].map((i) => (
              <div
                key={i}
                className={`rounded-lg px-3 py-2 text-sm border ${
                  st.captain === i
                    ? "border-gold-500 bg-gold-700/20"
                    : "border-wood-800 bg-wood-950/70"
                }`}
              >
                <span className="font-bold text-ivory">
                  {i === 0 ? "Sen (kaptan adayı)" : AI_NAMES[(i - 1) % 3]}
                </span>
                <span className="float-right text-gold-400 font-bold">{scores[i]}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Sonuç paneli */}
        {(st.phase === "roundOver" || st.phase === "matchOver") && (
          <div className="lg:w-80 cq-side-80 shrink-0 bg-wood-950/95 border-2 border-gold-600 rounded-2xl p-5 shadow-pop h-fit animate-floatUp">
            <h3 className="font-display text-2xl font-bold text-gold-400 mb-1">
              {st.phase === "matchOver" ? "Maç Bitti" : "El Bitti"}
            </h3>
            <ul className="text-sm space-y-1 mb-4">
              {[0, 1, 2, 3].map((i) => (
                <li key={i} className="flex justify-between text-ivory-dark/80">
                  <span>
                    {i === 0 ? "Sen" : AI_NAMES[(i - 1) % 3]} — {st.tricksWon[i]} el
                    {st.captain === i && " (kaptan)"}
                  </span>
                  <span className={(st.roundScores?.[i] ?? 0) >= 0 ? "text-emerald-400 font-bold" : "text-red-400 font-bold"}>
                    {(st.roundScores?.[i] ?? 0) >= 0 ? "+" : ""}
                    {st.roundScores?.[i]}
                  </span>
                </li>
              ))}
            </ul>
            <div className="text-xs text-ivory-dark/60 mb-3">
              {st.phase === "matchOver"
                ? `Maçın şampiyonu: ${st.winnerSeat === 0 ? "SEN!" : AI_NAMES[(st.winnerSeat - 1) % 3]} — çipler işlendi.`
                : `Kaptan ${st.currentBid} el hedefledi. Hedef: 101 puana ilk ulaşan kazanır.`}
            </div>
            <button
              onClick={newRoundClick}
              className="w-full py-2.5 rounded-xl font-bold bg-gold-600 hover:bg-gold-500 text-wood-950 transition-colors"
            >
              {st.phase === "matchOver" ? "Yeni Maç" : "Yeni El"}
            </button>
          </div>
        )}

        {st.phase !== "roundOver" && st.phase !== "matchOver" && (
          <div className="lg:w-72 cq-side-72 shrink-0 bg-wood-950/80 border border-wood-800 rounded-2xl p-4 h-fit text-xs text-ivory-dark/70 leading-relaxed">
            <p className="text-xs font-bold text-gold-500 uppercase tracking-wider mb-2">
              Batak Kuralları
            </p>
            <ul className="space-y-1.5 list-disc list-inside">
              <li>52 kart, 4 oyuncu. Amaç: <b className="text-ivory">en fazla eli almaktır</b>.</li>
              <li>
                <b className="text-ivory">İhale</b> 2'den başlar; pas dersen ihaleye giremezsin.
                İhaleyi alan <b className="text-gold-300">kozu</b> belirler ve ilk kartı açar. Koz tüm kartlardan üstündür.
              </li>
              <li>
                <b className="text-[#7dd3fc]">Defineli</b>: herkese 12 kart, 4 kart definede; kaptan 4 kartını define ile değiştirir.
              </li>
              <li>
                <b className="text-[#f0abfc]">Eşli (Açık Batak)</b>: kaptanın eşinin eli herkes görür; koz çıkmadan da koz oynanabilir.
              </li>
              <li>Elin varsa <b className="text-ivory">takip zorunlu</b>; yoksa koz dahil istediğini atabilirsin.</li>
              <li>
                Kaptan taahhüt ettiği eli alırsa <b className="text-emerald-400">+10×aldığı el</b>; alamazsa <b className="text-red-400">−10×ihale</b>.
                Diğerleri +10×aldığı el; <b className="text-red-400">hiç el alamayan −10×ihale</b> kaybeder.
              </li>
              <li>101 puana ilk ulaşan maçın kazananı olur.</li>
            </ul>
          </div>
        )}
      </div>
    </AutoFit>
  );
}

function BSeat({ idx, name, cards, active, isCaptain }: { idx: number; name: string; cards: number; active: boolean; isCaptain: boolean }) {
  return (
    <div className="text-center">
      <div
        className={`w-16 h-16 rounded-full flex items-center justify-center font-display font-bold text-lg border-2 mx-auto ${
          active
            ? "border-gold-400 bg-gold-700/30 text-gold-300 animate-pulseGold"
            : "border-wood-700 bg-wood-900 text-ivory-dark/70"
        }`}
      >
        {name[0]}
      </div>
      <p className="text-xs font-bold text-ivory mt-1">
        {name} {isCaptain && "👑"}
      </p>
      <p className="text-[10px] text-ivory-dark/50">{cards} kart</p>
    </div>
  );
}

