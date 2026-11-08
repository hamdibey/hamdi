import { useCallback, useEffect, useRef, useState } from "react";
import { oyunHiziCarpani } from "../lib/ayarlar";
import {
  aiDominoMove,
  canPlayAny,
  chainEnds,
  dominoDraw,
  dominoPlay,
  newDominoGame,
  playableSides,
  type DominoState,
} from "../lib/domino";
import { DominoBone, DominoBoneBack } from "../components/DominoBone";
import { useApp } from "../store/useApp";
import { AutoFit } from "../components/AutoFit";
import { MasaBekleme } from "../components/MasaBekleme";
import { api, parsePlayers } from "../lib/api";
import { masadanCik } from "../lib/masa";

interface RoundInfo {
  winner: number;
  deadlock: boolean;
  matchOver: boolean;
}

export function DominoGamePage() {
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
  const [st, setSt] = useState<DominoState>(() => newDominoGame(me?.nick ?? "Sen", "bes"));
  // Masadaki bot isimlerini oku — davet edilen botlar gerçek rakip olarak oynar
  // Masa bekleme lobisi: 3 rakip oturana kadar oyun AÇILMAZ (sahte AI dolmaz)
  const activeTableId = useApp.getState().activeTable;
  const [waiting, setWaiting] = useState(activeTableId != null);
  const [tableOpp, setTableOpp] = useState<{ nick: string; bot?: boolean }[]>([]);
  useEffect(() => {
    const id = useApp.getState().activeTable;
    if (id == null) { setWaiting(false); return; }
    let alive = true;
    const apply = (all: { nick: string; bot?: boolean }[]) => {
      setTableOpp(all.slice(0, 3));
      if (all.length >= 3) {
        const names = all.slice(0, 3).map((p) => p.nick);
        setWaiting(false);
        setSt((s) => ({ ...s, players: s.players.map((p, i) => (i > 0 && names[i - 1] ? { ...p, name: names[i - 1] } : p)) }));
      } else setWaiting(true);
    };
    const tick = async () => {
      try {
        const r = await api.table(id);
        const all = parsePlayers(r.table).filter((p) => p.nick !== (me?.nick ?? ""));
        if (alive) apply(all);
      } catch { /* yoksay */ }
    };
    void tick();
    const t = window.setInterval(() => { if (alive) void tick(); }, 5000);
    return () => { alive = false; window.clearInterval(t); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const [sel, setSel] = useState<string | null>(null);
  const [round, setRound] = useState<RoundInfo | null>(null);
  const timerRef = useRef<number | null>(null);
  const stRef = useRef(st);
  stRef.current = st;

  const myTurn = st.turn === 0 && !st.handOver && !st.matchOver;
  const myBone = sel ? st.players[0].hand.find((b) => b.id === sel) : null;
  const mySides = myBone ? playableSides(myBone, st) : [];
  const ends = chainEnds(st);

  const commit = useCallback((next: DominoState) => {
    setSt({ ...next, players: next.players.map((p) => ({ ...p, hand: [...p.hand] })) });
  }, []);

  // El bitince çip ödülünü sunucuya işle
  const gameStatRef = useRef(false);
  useEffect(() => {
    if (!st.handOver || round) return;
    setRound({
      winner: st.winner ?? -1,
      deadlock: st.deadlock,
      matchOver: st.matchOver,
    });
    // Maç istatistikleri: maç bitince oynanan/kazanılan profiline yazılır (bir kez)
    if (st.matchOver) {
      if (!gameStatRef.current) {
        gameStatRef.current = true;
        void api.recordGame(st.winner === 0).catch(() => {});
      }
    } else {
      gameStatRef.current = false; // yeni maç başladı
    }
    if (st.winner === 0 && me && !st.deadlock) {
      const gained = Object.entries(st.penalties)
        .filter(([n]) => n !== me.nick)
        .reduce((a, [, v]) => a + v, 0);
      if (gained > 0) {
        const gain = me.gold ? gained * 2 : gained; // Gold 2x
        void api
          .addChips(gain, "Domino oyun sonucu")
          .then(() => useApp.getState().syncMe())
          .catch(() => {});
        showToast(`Kazandın! +${gain} çip${me.gold ? " (Gold 2x)" : ""}`);
      }
    } else if (st.winner === 0 && me && st.deadlock) {
      showToast("Kilitlenmede en az puanla bitirdin — el senin!");
    }
  }, [st.handOver, st.winner, st.deadlock, st.penalties, round, me, showToast]);

  // Yapay zekâ sırası
  useEffect(() => {
    if (waiting) return;
    if (st.handOver || st.matchOver || st.turn === 0) return;
    if (timerRef.current) window.clearTimeout(timerRef.current);
    timerRef.current = window.setTimeout(() => {
      const next: DominoState = {
        ...stRef.current,
        players: stRef.current.players.map((p) => ({ ...p, hand: [...p.hand] })),
      };
      aiDominoMove(next);
      commit(next);
    }, 950 * oyunHiziCarpani());
    return () => {
      if (timerRef.current) window.clearTimeout(timerRef.current);
    };
  }, [st.turn, st.handOver, st.matchOver, commit]);

  // Oyuncu sırasındaysa ve oynayamıyorsa kemiklikten çekmesi gerekir (butonla)

  const playOn = (side: "left" | "right") => {
    if (!myTurn || !sel) return;
    const next: DominoState = { ...st, players: st.players.map((p) => ({ ...p, hand: [...p.hand] })) };
    if (dominoPlay(next, 0, sel, side)) {
      setSel(null);
      commit(next);
    }
  };

  const draw = () => {
    if (!myTurn) return;
    const next: DominoState = { ...st, players: st.players.map((p) => ({ ...p, hand: [...p.hand] })) };
    const res = dominoDraw(next);
    if (res === "cannot") {
      showToast("Oynayacak taşın var — önce oyna!");
      return;
    }
    commit(next);
    setSel(null);
  };

  const pass = () => {
    if (!myTurn) return;
    const next: DominoState = { ...st, players: st.players.map((p) => ({ ...p, hand: [...p.hand] })) };
    if (canPlayAny(next.players[0].hand, next)) {
      showToast("Oynayacak taşın var, pas geçemezsin.");
      return;
    }
    dominoDraw(next);
    commit(next);
    setSel(null);
  };

  const newHand = () => {
    const scores = st.players.map((p) => p.score);
    const fresh = newDominoGame(me?.nick ?? "Sen", "bes", st.players.slice(1).map((p) => p.name));
    fresh.players.forEach((p, i) => (p.score = scores[i]));
    // Yeni el: el bitiminde taşlar yeniden dağıtılır (skorlar korunur)
    setSt(fresh);
    setRound(null);
    setSel(null);
  };

  const chainRender = st.chain.map((it, idx) => (
    <DominoBone key={idx} bone={it.bone} vertical={!it.flipped} size="sm" glow={idx === 0 || idx === st.chain.length - 1} />
  ));

  // Masa dolmadısa bekleme lobisi — oyun (taşlar) henüz açılmasın
  if (waiting && activeTableId != null) {
    return (
      <AutoFit width={1180} fitScreen className="felt-bg min-h-screen pb-8">
        <MasaBekleme tableId={activeTableId} gameLabel="Domino" opponents={tableOpp} onRefresh={() => {
          const id = useApp.getState().activeTable;
          if (id == null) return;
          void api.table(id).then((r) => {
            const all = parsePlayers(r.table).filter((p) => p.nick !== (me?.nick ?? ""));
            setTableOpp(all.slice(0, 3));
            if (all.length >= 3) {
              const names = all.slice(0, 3).map((p) => p.nick);
              setWaiting(false);
              setSt((s) => ({ ...s, players: s.players.map((p, i) => (i > 0 && names[i - 1] ? { ...p, name: names[i - 1] } : p)) }));
            }
          }).catch(() => {});
        }} />
      </AutoFit>
    );
  }

  return (
    <AutoFit width={1180} fitScreen className="felt-bg min-h-screen pb-8">
      <div className="bg-wood-950/90 border-b border-wood-800 px-4 py-2 flex items-center gap-4 flex-wrap text-sm">
        <button
          onClick={() => void masadanCik(() => useApp.getState().go({ name: "salon", game: "domino" }))}
          className="text-ivory-dark/60 hover:text-gold-400"
        >
          ← Salona Dön
        </button>
        <span className="font-display font-bold text-gold-400 text-lg">Domino</span>
        <span className="text-ivory-dark/60">
          Kemiklik: <b className="text-ivory">{st.kemiklik.length}</b> taş
        </span>
        <span className="text-ivory-dark/60">Hedef: 101 (ceza)</span>
        <span className="ml-auto text-ivory-dark/60">
          Skor: {st.players.map((p) => `${p.name} ${p.score}`).join(" · ")}
        </span>
      </div>

      <div className="max-w-6xl mx-auto px-4 pt-4 flex flex-col lg:flex-row cq-row gap-4">
        <div className="flex-1 min-w-0">
          <div className="klasik-masa border-[5px] border-double border-[#8b5a2b] p-4">
            {/* Rakipler */}
            <div className="flex justify-around gap-2 mb-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="text-center">
                  <div
                    className={`w-14 h-14 rounded-full flex items-center justify-center font-display font-bold text-lg border-2 mx-auto ${
                      st.turn === i && !st.handOver
                        ? "border-gold-400 bg-gold-700/30 text-gold-300 animate-pulseGold"
                        : "border-wood-700 bg-wood-900 text-ivory-dark/70"
                    }`}
                  >
                    {st.players[i].name[0]}
                  </div>
                  <p className="text-xs font-bold text-ivory mt-1">{st.players[i].name}</p>
                  <div className="flex justify-center mt-1 -space-x-3">
                    {st.players[i].hand.slice(0, 5).map((b) => (
                      <DominoBoneBack key={b.id} />
                    ))}
                  </div>
                  <p className="text-[10px] text-ivory-dark/60 mt-1">{st.players[i].hand.length} taş</p>
                </div>
              ))}
            </div>

            {/* Zincir */}
            <div className="rounded-xl bg-felt-900/60 border border-felt-700 p-4 overflow-x-auto">
              {st.chain.length === 0 ? (
                <p className="text-center text-sm text-ivory-dark/50 py-6">
                  Oyun yeni başladı — çift taşı en yüksek olan oyuncu açar.
                </p>
              ) : (
                <div className="flex items-center gap-1.5 min-w-max justify-center">
                  {ends && (
                    <span className="text-xs font-bold text-gold-300 mr-2">
                      {ends.left} |
                    </span>
                  )}
                  {chainRender}
                  {ends && <span className="text-xs font-bold text-gold-300 ml-2">| {ends.right}</span>}
                </div>
              )}
            </div>

            <p className="text-center text-sm text-gold-300 mt-3 min-h-[20px]">
              {st.handOver
                ? st.lastMove
                : myTurn
                ? st.mustDraw
                  ? "Oynayacak taşın yok — kemiklikten çek!"
                  : "Sıra sende: bir taş seç ve uca oyna."
                : `${st.players[st.turn].name} oynuyor...`}
            </p>
            <p className="text-center text-[11px] text-ivory-dark/50 mt-1">{st.lastMove}</p>
          </div>

          {/* El */}
          <div className="mt-4 bg-wood-950/80 border border-wood-700 rounded-2xl p-4">
            <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
              <span className="text-sm font-bold text-ivory">
                Elin ({st.players[0].hand.length} taş) — Ceza:{" "}
                <b className="text-red-400">{st.players[0].score}</b>
              </span>
              <div className="flex gap-2">
                {myBone && mySides.includes("left") && (
                  <button
                    onClick={() => playOn("left")}
                    className="px-3 py-2 rounded-lg bg-emerald-700 hover:bg-emerald-600 text-ivory text-sm font-bold"
                  >
                    ← Sol Uca Oyna
                  </button>
                )}
                {myBone && mySides.includes("right") && (
                  <button
                    onClick={() => playOn("right")}
                    className="px-3 py-2 rounded-lg bg-emerald-700 hover:bg-emerald-600 text-ivory text-sm font-bold"
                  >
                    Sağ Uca Oyna →
                  </button>
                )}
                <button
                  onClick={draw}
                  disabled={!myTurn || !st.mustDraw}
                  className={`px-3 py-2 rounded-lg text-sm font-bold ${
                    myTurn && st.mustDraw
                      ? "bg-gold-600 hover:bg-gold-500 text-wood-950 animate-pulseGold"
                      : "bg-wood-900 text-ivory-dark/30 cursor-not-allowed"
                  }`}
                >
                  Kemiklikten Çek
                </button>
                <button
                  onClick={pass}
                  disabled={!myTurn || !st.mustDraw}
                  className={`px-3 py-2 rounded-lg text-sm font-bold ${
                    myTurn && st.mustDraw
                      ? "bg-wood-700 hover:bg-wood-600 text-ivory"
                      : "bg-wood-900 text-ivory-dark/30 cursor-not-allowed"
                  }`}
                >
                  Pas
                </button>
              </div>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {st.players[0].hand.map((b) => {
                const sides = playableSides(b, st);
                return (
                  <DominoBone
                    key={b.id}
                    bone={b}
                    size="md"
                    selected={sel === b.id}
                    glow={myTurn && sides.length > 0 && sel !== b.id}
                    onClick={myTurn ? () => setSel(sel === b.id ? null : b.id) : undefined}
                  />
                );
              })}
            </div>
          </div>
        </div>

        {/* Sonuç / kural paneli */}
        {round ? (
          <div className="lg:w-80 cq-side-80 shrink-0 bg-wood-950/95 border-2 border-gold-600 rounded-2xl p-5 shadow-pop h-fit animate-floatUp">
            <h3 className="font-display text-2xl font-bold text-gold-400 mb-1">
              {round.matchOver ? "Maç Bitti" : round.deadlock ? "Kilitlenme!" : "El Bitti"}
            </h3>
            <p className="text-sm text-ivory mb-3">
              {round.deadlock
                ? "Kimse oynayamadı — el bağlandı. Herkesin elindeki taş ceza yazıldı, en az puanla bitiren kazandı."
                : `🏆 ${st.players[round.winner]?.name} eli bitirdi!`}{" "}
              {round.winner === 0 && !round.deadlock && (
                <span className="block text-gold-300 mt-1">
                  +{Object.values(st.penalties).reduce((a, b) => a + b, 0) * (me?.gold ? 2 : 1)} çip
                  {me?.gold && " (Gold 2x)"}
                </span>
              )}
            </p>
            <ul className="text-sm space-y-1 mb-4">
              {Object.entries(st.penalties).map(([name, pts]) => (
                <li key={name} className="flex justify-between text-ivory-dark/80">
                  <span>{name}</span>
                  <span className="text-red-400 font-bold">+{pts} ceza</span>
                </li>
              ))}
            </ul>
            <p className="text-xs text-ivory-dark/60 mb-3">
              Not: Ayaz (0-0) 20 ceza sayılır. Kilitlenmede elinde en az puan kalan kazanır.
            </p>
            <button
              onClick={newHand}
              disabled={round.matchOver}
              className={`w-full py-2.5 rounded-xl font-bold transition-colors ${
                round.matchOver
                  ? "bg-wood-900 text-ivory-dark/30 cursor-not-allowed"
                  : "bg-gold-600 hover:bg-gold-500 text-wood-950"
              }`}
            >
              Yeni El
            </button>
          </div>
        ) : (
          <div className="lg:w-72 cq-side-72 shrink-0 bg-wood-950/80 border border-wood-800 rounded-2xl p-4 h-fit text-xs text-ivory-dark/70 leading-relaxed">
            <p className="text-xs font-bold text-gold-500 uppercase tracking-wider mb-2">
              Domino Kuralları
            </p>
            <ul className="space-y-1.5 list-disc list-inside">
              <li>28 taşlık deste, 4 oyuncu, herkese 5 taş dağıtılır.</li>
              <li>Çift taşı en yüksek olan oyuncu oyunu açar.</li>
              <li>Uçlardan birine uyan taşını oyna; uymuyorsa <b className="text-ivory">kemiklikten</b> taş çek.</li>
              <li>
                <b className="text-gold-300">Kilitlenme</b>: kimse oynayamaz ve kemiklik biterse el
                bağlanır; herkesin elindeki taş ceza yazar.
              </li>
              <li>Eli ilk biten kazanır; diğerlerinin taşları ceza olur.</li>
              <li><b className="text-red-400">Ayaz (0-0)</b> 20 ceza sayılır.</li>
              <li>101 cezaya ilk ulaşan maçı kaybeder.</li>
            </ul>
          </div>
        )}
      </div>
    </AutoFit>
  );
}
