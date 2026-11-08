import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { api } from "../lib/api";
import { masadanCik } from "../lib/masa";
import type { OnlineOkeyView } from "../lib/api";
import { modeConfig, COLOR_NAMES, arrangeClusters, type Tile } from "../lib/okey";
import { OkeyTile, OkeyTileBack, ClusterTag, clusterBarClass, DropGap } from "../components/OkeyTile";
import { useApp } from "../store/useApp";
import { AutoFit } from "../components/AutoFit";

/**
 * Online eşleşmeli 34 / 51: rakip aranır, eşleşen iki oyuncu sunucu tarafı
 * odada karşılaşır (boş koltuklara sunucu AI'ı oturur). Hamleler ve AI
 * sunucuda işletilir; istemci yalnızca kendi elini görür.
 */
export function OnlineOkeyPage({ mode }: { mode: "otuzdort" | "ellibir" }) {
  const me = useApp((s) => s.me);
  const showToast = useApp((s) => s.showToast);
  const go = useApp((s) => s.go);
  const [roomId, setRoomId] = useState<number | null>(null);
  const [waiting, setWaiting] = useState(false);
  const [view, setView] = useState<OnlineOkeyView | null>(null);
  const [sel, setSel] = useState<string | null>(null);
  const [sortMode, setSortMode] = useState<"set" | "sayi" | "civit">("set");
  const [manualOrder, setManualOrder] = useState<string[] | null>(null); // mouse ile elle dizilim
  const [dragId, setDragId] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<{ id: string; side: "before" | "after" | "self" } | null>(null);
  const [rotatedIds, setRotatedIds] = useState<string[]>([]); // sağ tıkla çevrilmiş taşlar
  const [error, setError] = useState<string | null>(null);
  const pollRef = useRef<number | null>(null);
  const lastSync = useRef(0);

  const modeLabel = modeConfig(mode).label;
  const okeyDesc =
    view && view.okeyNum === 13
      ? `13'ün (1) ${COLOR_NAMES[view.okeyColor]}`
      : view
      ? `${view.okeyNum} ${COLOR_NAMES[view.okeyColor]}`
      : "";

  // ── Eşleşme kuyruğu ──────────────────────────────────────────
  const startQueue = useCallback(async () => {
    setError(null);
    setWaiting(true);
    try {
      const r = await api.matchQueue(mode);
      if (r.status === "playing" && r.roomId) {
        setRoomId(r.roomId);
        setWaiting(false);
      }
    } catch (e) {
      setWaiting(false);
      setError(e instanceof Error ? e.message : "Eşleşme başlatılamadı.");
    }
  }, [mode]);

  const cancelQueue = useCallback(async () => {
    try {
      await api.matchCancel(mode);
    } catch {
      /* yok say */
    }
    setWaiting(false);
  }, [mode]);

  // Kuyrukta beklerken tekrar dene (2.5 sn)
  useEffect(() => {
    if (!waiting || roomId) return;
    const t = window.setInterval(async () => {
      try {
        const r = await api.matchQueue(mode);
        if (r.status === "playing" && r.roomId) {
          setRoomId(r.roomId);
          setWaiting(false);
        }
      } catch {
        /* kısa bağlantı hatası göz ardı */
      }
    }, 2500);
    return () => window.clearInterval(t);
  }, [waiting, roomId, mode]);

  // ── Oda senkronu (1.5 sn) ────────────────────────────────────
  const gameStatRef = useRef(false);
  const sync = useCallback(async () => {
    if (!roomId) return;
    if (Date.now() - lastSync.current < 900) return;
    lastSync.current = Date.now();
    try {
      const r = await api.roomState(roomId);
      setView(r.view);
      if (r.view.roundOver?.matchOver) {
        void useApp.getState().syncMe();
        // Maç istatistikleri: maç bitince oynanan/kazanılan profiline yazılır (bir kez)
        if (!gameStatRef.current) {
          gameStatRef.current = true;
          void api.recordGame(r.view.roundOver.winner === r.view.mySeat).catch(() => {});
        }
      } else {
        gameStatRef.current = false;
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Odaya ulaşılamıyor.");
    }
  }, [roomId]);

  useEffect(() => {
    if (!roomId) return;
    void sync();
    pollRef.current = window.setInterval(() => void sync(), 1500);
    return () => {
      if (pollRef.current) window.clearInterval(pollRef.current);
    };
  }, [roomId, sync]);

  // ── Aksiyonlar ───────────────────────────────────────────────
  const act = async (type: string, tileId?: string) => {
    if (!roomId) return;
    try {
      const r = await api.roomAction(roomId, type, tileId);
      setView(r.view);
      setSel(null);
      lastSync.current = Date.now();
      if (r.view.roundOver?.matchOver) void useApp.getState().syncMe();
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Hamle yapılamadı.");
    }
  };

  const myTurn = !!view && view.turn === view.mySeat && !view.roundOver;

  // İstaka dizilimi: "set" = seri/küt gruplama, "sayi" = sayı+renk, "civit" = renk+sıra + elle dizilim
  const clusters = useMemo(() => {
    const hand = view?.myHand ?? [];
    if (manualOrder) {
      const byId = new Map(hand.map((t) => [t.id, t]));
      const ordered = manualOrder
        .map((id) => byId.get(id))
        .filter((t): t is Tile => !!t);
      const missing = hand.filter((t) => !manualOrder.includes(t.id));
      return [{ tiles: [...ordered, ...missing], kind: "serbest" as const }];
    }
    if (sortMode === "set") return arrangeClusters(hand, false);
    const flat = [...hand].sort((a, b) => {
      const aj = a.wild && a.num === 0 ? 1 : 0;
      const bj = b.wild && b.num === 0 ? 1 : 0;
      if (aj !== bj) return aj - bj;
      if (sortMode === "sayi") {
        if (a.num !== b.num) return a.num - b.num;
        return a.color - b.color;
      }
      if (a.color !== b.color) return a.color - b.color;
      return a.num - b.num;
    });
    return [{ tiles: flat, kind: "serbest" as const }];
  }, [view?.myHand, sortMode, manualOrder]);

  const flatOrder = useMemo(() => clusters.flatMap((c) => c.tiles), [clusters]);

  // Sol tuşla tut → istediğin yere sürükle → bırak
  const applyDrop = () => {
    if (!dragId) return;
    if (dropTarget && dropTarget.id === dragId && dropTarget.side === "self") {
      setDragId(null);
      setDropTarget(null);
      return;
    }
    const order = flatOrder.map((t) => t.id).filter((id) => id !== dragId);
    if (dropTarget) {
      let idx = order.indexOf(dropTarget.id);
      if (idx < 0) idx = order.length;
      else if (dropTarget.side === "after") idx += 1;
      order.splice(idx, 0, dragId);
    } else {
      order.push(dragId);
    }
    setManualOrder(order);
    setDragId(null);
    setDropTarget(null);
  };
  // Sağ tık: taşı çevir (işaretle)
  const toggleRotate = (id: string) => {
    setRotatedIds((r) => (r.includes(id) ? r.filter((x) => x !== id) : [...r, id]));
  };
  // Elden çıkan taşların işareti temizlensin
  useEffect(() => {
    setRotatedIds((r) => {
      const hand = view?.myHand ?? [];
      const next = r.filter((id) => hand.some((t) => t.id === id));
      return next.length === r.length ? r : next;
    });
  }, [view?.myHand]);

  // ═══════════ EŞLEŞME EKRANI ═══════════
  if (!roomId || !view) {
    return (
      <div className="felt-bg min-h-screen flex items-center justify-center p-4">
        <div className="bg-wood-950/95 border-2 border-gold-700 rounded-2xl p-8 max-w-md w-full text-center shadow-pop">
          <h2 className="font-display text-3xl font-bold text-gold-400 mb-2">
            {modeLabel} — Online
          </h2>
          <p className="text-sm text-ivory-dark/70 mb-6">
            Rakiple eşleş, 2 boş koltuğa sunucu bilgisayarları oturur. Maç 101 puana kadardır;
            kazanan çip kazanır, kaybeden çip kaybeder.
          </p>
          {error && (
            <p className="text-sm text-red-400 mb-4">{error}</p>
          )}
          {waiting ? (
            <div className="space-y-4">
              <div className="flex justify-center gap-1.5">
                {[0, 1, 2].map((i) => (
                  <span
                    key={i}
                    className="w-2.5 h-2.5 rounded-full bg-gold-500 animate-bounce"
                    style={{ animationDelay: `${i * 0.15}s` }}
                  />
                ))}
              </div>
              <p className="text-gold-300 font-semibold animate-pulse">
                Rakip aranıyor…
              </p>
              <button
                onClick={() => void cancelQueue()}
                className="px-5 py-2 rounded-lg bg-wood-900 hover:bg-wood-800 border border-wood-700 text-ivory-dark text-sm"
              >
                Vazgeç
              </button>
            </div>
          ) : (
            <button
              onClick={() => void startQueue()}
              className="px-6 py-3 rounded-xl bg-gold-600 hover:bg-gold-500 text-wood-950 font-bold text-lg transition-colors animate-pulseGold"
            >
              Eşleşme Ara
            </button>
          )}
          <button
            onClick={() => void masadanCik(() => go({ name: "salon", game: mode }))}
            className="block mx-auto mt-5 text-xs text-ivory-dark/50 hover:text-gold-400"
          >
            ← Salona Dön
          </button>
        </div>
      </div>
    );
  }

  // ═══════════ OYUN EKRANI ═══════════
  const meScore = view.players[view.mySeat]?.score ?? 0;
  const seatOrder = [1, 2, 3].map((k) => (view.mySeat + k) % 4);

  return (
    <AutoFit width={1180} fitScreen className="felt-bg min-h-screen pb-8">
      <div className="bg-wood-950/90 border-b border-wood-800 px-4 py-2 flex items-center gap-4 flex-wrap text-sm">
        <button
          onClick={() => go({ name: "salon", game: mode })}
          className="text-ivory-dark/60 hover:text-gold-400"
        >
          ← Salona Dön
        </button>
        <span className="font-display font-bold text-gold-400 text-lg">
          {modeLabel} — Online (Oda #{roomId})
        </span>
        <span className="text-ivory-dark/60">
          Okey: <b className="text-gold-300">{okeyDesc}</b> (joker)
        </span>
        <span className="ml-auto text-ivory-dark/60">
          Kalan taş: <b className="text-ivory">{view.wallCount}</b>
        </span>
      </div>

      <div className="max-w-6xl mx-auto px-4 pt-4 flex flex-col lg:flex-row cq-row gap-4">
        <div className="flex-1 min-w-0">
          <div className="bg-felt-800/60 border-2 border-wood-700 rounded-2xl p-4 shadow-felt">
            {/* Rakipler */}
            <div className="flex justify-around gap-2 mb-4">
              {seatOrder.map((s) => (
                <OnlineSeat
                  key={s}
                  p={view.players[s]}
                  active={view.turn === s && !view.roundOver}
                />
              ))}
            </div>

            {/* Masa ortası */}
            <div className="flex items-center justify-center gap-4 min-h-[90px] rounded-xl bg-felt-900/60 border border-felt-700 p-3 flex-wrap">
              <div className="text-center">
                <div className="flex -space-x-6 justify-center">
                  {[0, 1, 2].map((i) => (
                    <OkeyTileBack key={i} size="sm" />
                  ))}
                </div>
                <p className="text-[10px] text-ivory-dark/50 mt-1">Orta (duvar)</p>
              </div>
              <button
                onClick={() => void act("draw")}
                disabled={!myTurn || view.drewThisTurn}
                className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${
                  myTurn && !view.drewThisTurn
                    ? "bg-gold-600 hover:bg-gold-500 text-wood-950 animate-pulseGold"
                    : "bg-wood-900 text-ivory-dark/30 cursor-not-allowed"
                }`}
              >
                Taş Çek
              </button>
              <div className="text-center">
                {view.discard ? (
                  <OkeyTile
                    tile={view.discard}
                    size="md"
                    onClick={myTurn && !view.drewThisTurn ? () => void act("take") : undefined}
                  />
                ) : (
                  <div className="w-12 h-16 rounded-md border border-dashed border-ivory-dark/20 flex items-center justify-center text-[10px] text-ivory-dark/40">
                    boş
                  </div>
                )}
                <p className="text-[10px] text-ivory-dark/50 mt-1">
                  {view.discard ? "Yerden al (tıkla)" : "Düşen taş"}
                </p>
              </div>
              <div className="text-center">
                <span className="inline-block align-middle">
                  <OkeyTile tile={view.gosterge} size="sm" />
                </span>
                <p className="text-[10px] text-ivory-dark/50 mt-1">Gösterge</p>
              </div>
            </div>

            {/* Durum mesajı */}
            <p className="text-center text-sm text-gold-300 mt-3 min-h-[20px]">
              {view.roundOver
                ? view.roundOver.matchOver
                  ? "Maç sona erdi!"
                  : "El bitti — yeni el için hazır ol."
                : myTurn
                ? view.drewThisTurn
                  ? "Taşını seç ve bırak — ya da elini aç!"
                  : "Sıra sende: ortadan çek ya da yerden taş al."
                : `${view.players[view.turn]?.nick} oynuyor...`}
            </p>

            <div className="mt-2 text-[11px] text-ivory-dark/50 space-y-0.5 max-h-24 overflow-hidden">
              {view.log.slice(-4).map((l, i) => (
                <p key={i}>• {l}</p>
              ))}
            </div>
          </div>

          {/* Benim ıstakam */}
          <div className="mt-4">
            {/* Araç çubuğu */}
            <div className="flex items-center justify-between mb-2 flex-wrap gap-2 px-1">
              <span className="text-sm font-bold text-ivory">
                İstakan ({view.myHand.length} taş) — Puanın:{" "}
                <b className="text-gold-400">{meScore}</b>
              </span>
              <div className="flex gap-2 flex-wrap">
                {(["set", "sayi", "civit"] as const).map((m) => (
                  <button
                    key={m}
                    onClick={() => {
                      setManualOrder(null);
                      setSortMode(m);
                    }}
                    className={`px-3 py-2 rounded-lg text-sm font-bold border transition-colors ${
                      !manualOrder && sortMode === m
                        ? "bg-gold-600 hover:bg-gold-500 text-wood-950 border-gold-400"
                        : "bg-wood-800 hover:bg-wood-700 text-gold-300 border-wood-600"
                    }`}
                    title={
                      m === "set"
                        ? "Set Diz: taşları seri/küt gruplarına göre diz"
                        : m === "sayi"
                        ? "Sayı Diz: taşları önce sayı, sonra renge göre diz"
                        : "Çivit Diz: taşları önce renk, sonra sayıya göre diz"
                    }
                  >
                    {m === "set" ? "Set Diz" : m === "sayi" ? "Sayı Diz" : "Çivit Diz"}
                  </button>
                ))}
                {manualOrder && (
                  <button
                    onClick={() => setManualOrder(null)}
                    className="px-3 py-2 rounded-lg text-sm font-bold bg-wood-800 hover:bg-wood-700 text-ivory border border-wood-600 transition-colors"
                    title="Elle dizilimi bırak, otomatik dizilime dön"
                  >
                    Otomatik Diz
                  </button>
                )}
                <button
                  onClick={() => void act("finish")}
                  disabled={!myTurn || !view.canFinish || !view.drewThisTurn}
                  className={`px-4 py-2 rounded-lg text-sm font-bold transition-colors ${
                    myTurn && view.canFinish && view.drewThisTurn
                      ? "bg-emerald-600 hover:bg-emerald-500 text-ivory animate-pulseGold"
                      : "bg-wood-900 text-ivory-dark/30 cursor-not-allowed"
                  }`}
                >
                  El Aç / Bitir
                </button>
                <button
                  onClick={() => sel && void act("discard", sel)}
                  disabled={!myTurn || !view.drewThisTurn || !sel}
                  className={`px-4 py-2 rounded-lg text-sm font-bold transition-colors ${
                    myTurn && view.drewThisTurn && sel
                      ? "bg-red-800 hover:bg-red-700 text-ivory"
                      : "bg-wood-900 text-ivory-dark/30 cursor-not-allowed"
                  }`}
                >
                  Bırak
                </button>
              </div>
            </div>
            {/* Ahşap ıstaka oluğu */}
            <div className="relative border-2 border-[#4a2e13] klasik-ahsap px-3 pt-3 pb-4 shadow-[inset_0_1px_0_rgba(255,255,255,.22),0_3px_8px_rgba(0,0,0,.55)]">
              <div className="absolute inset-x-3 bottom-1.5 h-2.5 klasik-oluk" />
              <div className="relative z-10 flex items-end overflow-x-auto pb-1 select-none">
                {clusters.map((cl, ci) => (
                  <div key={ci} className={`flex flex-col items-center shrink-0 ${ci > 0 ? "ml-3" : ""}`}>
                    <div className="flex items-end">
                      {cl.tiles.map((t) => (
                        <div key={t.id} className="flex items-end shrink-0">
                          {dragId && dropTarget?.id === t.id && dropTarget.side === "before" && <DropGap />}
                          <div
                            draggable
                            onDragStart={() => {
                              setDragId(t.id);
                              setDropTarget({ id: t.id, side: "self" });
                            }}
                            onDragOver={(e) => {
                              e.preventDefault();
                              const r = e.currentTarget.getBoundingClientRect();
                              const side =
                                dragId === t.id ? "self" : e.clientX < r.left + r.width / 2 ? "before" : "after";
                              setDropTarget((d) => (d && d.id === t.id && d.side === side ? d : { id: t.id, side }));
                            }}
                            onDrop={(e) => {
                              e.preventDefault();
                              applyDrop();
                            }}
                            onDragEnd={() => {
                              setDragId(null);
                              setDropTarget(null);
                            }}
                            onContextMenu={(e) => {
                              e.preventDefault();
                              toggleRotate(t.id);
                            }}
                            className={`shrink-0 ${dragId === t.id ? "opacity-40 scale-95" : ""} ${
                              dropTarget?.id === t.id && dropTarget.side === "self" && dragId !== t.id
                                ? "outline outline-2 outline-gold-400 rounded-md"
                                : ""
                            }`}
                            title="Sol tuşla sürükle · Sağ tık: taşı çevir"
                          >
                            <OkeyTile
                              tile={t}
                              size="md"
                              selected={sel === t.id}
                              rotated={rotatedIds.includes(t.id)}
                              onClick={myTurn ? () => setSel(sel === t.id ? null : t.id) : undefined}
                            />
                          </div>
                          {dragId && dropTarget?.id === t.id && dropTarget.side === "after" && <DropGap />}
                        </div>
                      ))}
                    </div>
                    {sortMode === "set" && !manualOrder && (
                      <>
                        <span
                          className={`h-[3px] w-full rounded-full mt-1 ${clusterBarClass(cl.kind)}`}
                        />
                        <ClusterTag kind={cl.kind} />
                      </>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Skor tablosu */}
          <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-2">
            {view.players.map((p) => (
              <div
                key={p.seat}
                className={`rounded-lg px-3 py-2 text-sm border ${
                  view.turn === p.seat && !view.roundOver
                    ? "border-gold-500 bg-gold-700/20"
                    : "border-wood-800 bg-wood-950/70"
                }`}
              >
                <span className="font-bold text-ivory">
                  {p.nick}
                  {p.seat === view.mySeat && " (sen)"}
                </span>
                <span className="float-right text-gold-400 font-bold">{p.score}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Sonuç paneli */}
        {view.roundOver && (
          <div className="lg:w-80 cq-side-80 shrink-0 bg-wood-950/95 border-2 border-gold-600 rounded-2xl p-5 shadow-pop h-fit animate-floatUp">
            <h3 className="font-display text-2xl font-bold text-gold-400 mb-1">
              {view.roundOver.matchOver ? "Maç Bitti" : "El Bitti"}
            </h3>
            <p className="text-sm text-ivory mb-3">
              🏆 <b>{view.players[view.roundOver.winner]?.nick}</b> kazandı
              {view.roundOver.finished ? " — elini açtı!" : " (en az ölü taş)"}
            </p>
            <ul className="text-sm space-y-1 mb-4">
              {view.players.map((p, i) =>
                i === view.roundOver!.winner ? null : (
                  <li key={p.seat} className="flex justify-between text-ivory-dark/80">
                    <span>{p.nick}</span>
                    <span className="text-red-400 font-bold">
                      +{view.roundOver!.penalties[i]} ceza
                    </span>
                  </li>
                )
              )}
            </ul>
            <div className="text-xs text-ivory-dark/60 mb-3">
              {view.roundOver.matchOver
                ? `Maçın şampiyonu: ${
                    view.players[
                      view.players.reduce(
                        (a, b) => (b.score > a.score ? b : a),
                        view.players[0]
                      ).seat
                    ].nick
                  } — çipler işlendi.`
                : "Hedef: 101 puana ilk ulaşan maçın kazananı olur."}
            </div>
            {view.roundOver.matchOver ? (
              <button
                onClick={() => {
                  setRoomId(null);
                  setView(null);
                  setWaiting(false);
                }}
                className="w-full py-2.5 rounded-xl font-bold bg-gold-600 hover:bg-gold-500 text-wood-950 transition-colors"
              >
                Yeni Eşleşme
              </button>
            ) : (
              <button
                onClick={() => void act("newRound")}
                className="w-full py-2.5 rounded-xl font-bold bg-gold-600 hover:bg-gold-500 text-wood-950 transition-colors"
              >
                Yeni El
              </button>
            )}
          </div>
        )}
      </div>
    </AutoFit>
  );
}

function OnlineSeat({
  p,
  active,
}: {
  p: { nick: string; isAI: boolean; handCount: number; score: number };
  active: boolean;
}) {
  return (
    <div className="text-center flex-1 min-w-0">
      <div
        className={`w-14 h-14 rounded-full flex items-center justify-center font-display font-bold text-lg border-2 mx-auto ${
          active
            ? "border-gold-400 bg-gold-700/30 text-gold-300 animate-pulseGold"
            : "border-wood-700 bg-wood-900 text-ivory-dark/70"
        }`}
      >
        {p.isAI ? "🤖" : p.nick[0]}
      </div>
      <p className="text-xs font-bold text-ivory mt-1">{p.nick}</p>
      <p className="text-[10px] text-gold-400 font-bold">{p.score} puan</p>
      {/* Rakip ıstakası: taşlar ters durur + klasik taş sayısı sayacı */}
      <div className="relative mt-1.5 mx-auto max-w-[240px] border-2 border-[#4a2e13] klasik-ahsap px-2 pt-1.5 pb-1 shadow-[inset_0_1px_0_rgba(255,255,255,.2),0_2px_5px_rgba(0,0,0,.5)]">
        {/* Klasik sayaç kutusu — rakibin elinde kaç taş kaldı */}
        <div
          title={`Kalan taş: ${p.handCount}`}
          className="absolute -top-2.5 -right-2.5 z-20 min-w-[28px] px-1 py-0.5 bg-[#f7f0cf] border border-[#8a7a3a] shadow-pop text-center leading-none"
        >
          <span className="text-[13px] font-bold text-black">{p.handCount}</span>
        </div>
        <div className="flex justify-center -space-x-3 overflow-hidden">
          {Array.from({ length: Math.min(p.handCount, 16) }).map((_, i) => (
            <OkeyTileBack key={i} size="sm" />
          ))}
        </div>
        <p className="text-[10px] text-ivory-dark/60 mt-1">ıstakası</p>
      </div>
    </div>
  );
}
