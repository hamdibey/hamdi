import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { oyunHiziCarpani } from "../lib/ayarlar";
import {
  aiBestDiscard,
  aiFindExtension,
  aiLayPlan,
  aiShouldTake,
  arrangeClusters,
  bestDecomposition,
  canExtendGroup,
  canFinish,
  deadwoodValue,
  modeConfig,
  pureLayGroups,
  pureLayPairs,
  PAIR_OPEN_MIN,
  setupOkey,
  tileLabel,
  validateLaySelection,
  COLOR_NAMES,
  type Cluster,
  type OkeySetup,
  type Tile,
} from "../lib/okey";
import type { OkeyMode } from "../lib/okeyTypes";
import { OkeyTile, OkeyTileBack, ClusterTag, clusterBarClass, DropGap } from "../components/OkeyTile";
import { useApp } from "../store/useApp";
import { AutoFit } from "../components/AutoFit";
import { MasaBekleme } from "../components/MasaBekleme";
import { api, parsePlayers } from "../lib/api";
import { masadanCik } from "../lib/masa";
import { klasikPrompt, klasikConfirm } from "../lib/klasikDialog";

interface Player {
  name: string;
  isUser: boolean;
  hand: Tile[];
  laid: { kind: "seri" | "küt" | "per"; tiles: Tile[] }[]; // masaya açılan gruplar (101 ailesi)
  opened: boolean; // masaya açtı mı?
}

interface ChatMsg {
  id: number;
  who: string;
  text: string;
  ai: boolean;
}

interface RoundResult {
  winner: number;
  penalties: Record<string, number>;
  finished: boolean;
  matchOver: boolean;
  winnerScore: number;
  /** El sonu sıralaması: 1. en çok puan, 2. yarısı, 3. -3, 4. -7 */
  ranking?: { idx: number; gain: number }[];
}

interface GameState {
  setup: OkeySetup;
  players: Player[];
  wall: Tile[];
  discard: Tile | null; // yerdeki son düşen taş
  dropped: Tile[]; // yere düşen tüm taşlar (AI savunma hafızası)
  turn: number;
  drewThisTurn: boolean;
  justTookId: string | null; // bu tur yerden alınan taş — aynı tur atılamaz (gerçek 101 kuralı)
  /** Duvar bittikten sonra yerdeki son taşı alan oyuncu (koltuk no) —
   *  o tur oynanır (açabilir/uzatabilir/bırakır) ve bırakınca el BİTER.
   *  Böylece son taş dönüp dönüp atılmaz. */
  finalTurn: number | null;
  roundOver: RoundResult | null;
  scores: number[];
  rounds: number; // oynanan el sayısı (elSayisi bitince maç biter)
  log: string[];
}

const AI_NAMES = ["Kemal", "Zeynep", "Serkan"];

/** Masa rengi seçenekleri (Renk düğmesi) — klasik zemin üstü şeffaf ton */
const MASA_TINT = [
  "rgba(0,0,0,0)",
  "rgba(140,0,0,.28)",
  "rgba(0,110,60,.30)",
  "rgba(90,40,140,.30)",
  "rgba(200,120,0,.26)",
];
/** Orta duvar amblemleri (Resim düğmesi) */
const MASA_RESIM = ["", "🀄", "♠️", "🏆", "🍀", "⭐"];

function newRound(userName: string, scores: number[], classic: boolean, aiNames: string[] = AI_NAMES, rounds = 0): GameState {
  const setup = setupOkey();
  const wall = [...setup.deck];
  const players: Player[] = [
    { name: userName, isUser: true, hand: [], laid: [], opened: false },
    ...aiNames.map((n) => ({ name: n, isUser: false, hand: [], laid: [], opened: false })),
  ];
  players.forEach((p, i) => {
    // Klasik Okey: 14'er taş. 101 ailesi: herkese 21 taş, oyuna ilk başlayana 22 taş (el atan).
    p.hand = wall.splice(0, classic ? 14 : i === 0 ? 22 : 21);
    sortHand(p.hand);
  });
  return {
    setup,
    players,
    wall,
    discard: null,
    dropped: [],
    turn: 0,
    // 101 ailesinde el atan 22 taşla doğar; ilk hamlede taş bırakır (çekmez).
    drewThisTurn: !classic,
    justTookId: null,
    finalTurn: null,
    roundOver: null,
    scores,
    rounds,
    log: classic
      ? ["El başladı. Gösterge çekildi, okey belirlendi."]
      : ["El başladı: herkeste 21, el atanda 22 taş. İlk hamlede taş bırakılır."],
  };
}

function sortHand(hand: Tile[]) {
  hand.sort((a, b) => {
    if (a.wild !== b.wild) return a.wild ? 1 : -1;
    if (a.color !== b.color) return a.color - b.color;
    return a.num - b.num;
  });
}

/** Elle oluşturulan grubun türü: per (birebir çift), küt, seri, serbest (karışık) */
function grupKind(tiles: Tile[]): Cluster["kind"] {
  if (tiles.length < 2) return "serbest";
  if (tiles.length === 2 && !tiles.some((t) => t.wild)) {
    const [a, b] = tiles;
    return a.num === b.num && a.color === b.color ? "per" : "serbest";
  }
  const d = bestDecomposition(tiles, false);
  if (d.deadwood.length > 0 || d.groups.length === 0) return "serbest";
  const kinds = new Set(d.groups.map((g) => g.kind));
  if (kinds.size === 1) return d.groups[0].kind as Cluster["kind"];
  return "serbest";
}

function pushLog(st: GameState, msg: string) {
  st.log = [...st.log.slice(-8), msg];
}

export function OkeyGamePage({ mode }: { mode: OkeyMode }) {
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
  const go = useApp((s) => s.go);
  const classic = mode === "okey";
  const openMin = modeConfig(mode).openMin;
  // Masa botları — masadaki rakip isimleri AI olarak oynatılır (davet edilen botlar gerçek oyuncu gibi)
  const aiNamesRef = useRef<string[]>(AI_NAMES);
  const [st, setSt] = useState<GameState>(() => newRound(me?.nick ?? "Sen", [0, 0, 0, 0], classic, aiNamesRef.current));
  // Masa bekleme lobisi: koltuklar dolana kadar oyun AÇILMAZ (sahte AI otomatik dolmaz)
  const activeTableId = useApp.getState().activeTable;
  const [waiting, setWaiting] = useState(activeTableId != null);
  /** Oyun bir kez başlayınca masa poll'ü ASLA yeniden el kurmaz (eski hata: her 5 sn'de oyun sıfırlanıyordu) */
  const gameStartedRef = useRef(false);
  const [tableOpp, setTableOpp] = useState<{ nick: string; bot?: boolean }[]>([]);
  // Masa sahibi (masayı kuran) + maç el sayısı — sadece sahip el başlatabilir
  const [tableOwner, setTableOwner] = useState<string | null>(null);
  const [elSayisi, setElSayisi] = useState(3);
  // Çarpanlı / Artırmalı / Eşli — masa ayarlarından okunur (klasik Hakkari masa kurma kuralları)
  const [carpani, setCarpani] = useState<number>(1); // x1…x999 — puanları çarpar
  const [canakAcik, setCanakAcik] = useState(false); // çanak kuralı: yarısı masayı açana
  const [acanNick, setAcanNick] = useState(""); // masayı açan oyuncu (çanak payı)
  const [artirmali, setArtirmali] = useState(false); // ilk açan 101, diğerleri öncekinin +1'i
  const [esli, setEsli] = useState(false); // eşli (2'ye 2) — takım puanları toplanır
  const artirmaliRef = useRef(0); // artırmalı eşik artışı — biri açılınca +1
  const [otoPilot, setOtoPilot] = useState(false); // aktif edilirse oyuncu sırası AI gibi oynar
  // Masaya oturulduysa / bot davet edildiyse rakip isimlerini tazele — 3 rakip olunca oyunu başlat
  useEffect(() => {
    const id = useApp.getState().activeTable;
    if (id == null) {
      // Pratik / antrenman masası — sahip sensin, 3 el
      setWaiting(false);
      setTableOwner(me?.nick ?? null);
      return;
    }
    let alive = true;
    const tick = async () => {
      try {
        const r = await api.table(id);
        const all = parsePlayers(r.table).filter((p) => p.nick !== (me?.nick ?? ""));
        if (!alive) return;
        setTableOpp(all.slice(0, 3));
        setTableOwner(r.table.ownerNick || null);
        try {
          const s: Record<string, unknown> = r.table.settings ? JSON.parse(r.table.settings) : {};
          setElSayisi(Math.min(9, Math.max(1, Number(s.elSayisi) || 3)));
          const c = Number(s.carpan);
          setCarpani(c >= 1 && [1, 2, 4, 9, 99, 111, 123, 999].includes(c) ? c : 1);
          setCanakAcik(!!s.canak);
          setAcanNick(String(s.acan || ""));
          setArtirmali(!!s.artirmali);
          setEsli(!!s.esli);
        } catch { /* varsayılan 3 el */ }
        if (all.length >= 3) {
          // Oyun ZATEN baştıysa (devam eden el) poll sadece isim/sahip/ayar tazeler —
          // eli asla yeniden kurmaz; eskiden her 5 saniyede oyun sıfırlanıyordu.
          if (gameStartedRef.current) { setWaiting(false); return; }
          gameStartedRef.current = true;
          const names = all.slice(0, 3).map((p) => p.nick);
          aiNamesRef.current = names;
          setWaiting(false);
          setSelIds([]);
          setManualOrder(null);
          setSt(newRound(me?.nick ?? "Sen", [0, 0, 0, 0], classic, names));
        } else if (!gameStartedRef.current) {
          // Oyun henüz başlamadıysa bekleme lobisine dön (başladıysa el ortasında gizleme)
          setWaiting(true);
        }
      } catch { /* yoksay */ }
    };
    void tick();
    const t = window.setInterval(() => { if (alive) void tick(); }, 5000);
    return () => { alive = false; window.clearInterval(t); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const [selIds, setSelIds] = useState<string[]>([]); // çoklu seçim (açarken taş seçimi)
  const [sortMode, setSortMode] = useState<"set" | "sayi" | "civit">("set");
  const [manualOrder, setManualOrder] = useState<string[] | null>(null); // mouse ile elle dizilim
  const [grups, setGrups] = useState<string[][]>([]); // elle oluşturulan taş grupları (per / küt / seri)
  const [sonucGizli, setSonucGizli] = useState(false); // el sonu katmanı gizlendi mi (Masaya Dön)
  const pressRef = useRef<{ id: string; x: number; y: number; long?: boolean } | null>(null); // basılı tutma başlangıcı (pointer sürükleme)
  const suppressClickRef = useRef(false); // pointerup'tan sonra gelen click olayını yut (çift seçim olmasın)
  const longPressRef = useRef<number | null>(null); // basılı tutma sayacı (hareketsiz tutunca taşı seçer)
  const [mola, setMola] = useState(false); // klasik Mola düğmesi — AI'ı duraklatır
  const [mesajKapali, setMesajKapali] = useState(false); // Masa Ayarları — Mesaj Kapat (sohbeti gizle)
  const [sesAcik, setSesAcik] = useState(true); // Masa Ayarları — ses düğmesi
  const [renkIdx, setRenkIdx] = useState(0); // masa rengi (Renk düğmesi)
  const [resimIdx, setResimIdx] = useState(0); // orta duvar amblemi (Resim düğmesi)
  const [yardimAcik, setYardimAcik] = useState(false); // kurallar paneli (Yardım düğmesi) — referansta açık gelmez
  const [dragId, setDragId] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<{ id: string; side: "before" | "after" | "self" } | null>(null); // bırakılacak boşluk
  const [rotatedIds, setRotatedIds] = useState<string[]>([]); // sağ tıkla çevrilmiş (işaretli) taşlar
  const [chat, setChat] = useState<ChatMsg[]>([
    { id: 0, who: "Masa", text: "Masaya hoş geldin! İyi oyunlar 🎱", ai: true },
  ]);
  const [chatInput, setChatInput] = useState("");
  const chatIdRef = useRef(1);
  const chatBoxRef = useRef<HTMLDivElement | null>(null);
  const timerRef = useRef<number | null>(null);
  const stRef = useRef(st);
  stRef.current = st;

  const myHand = st.players[0].hand;
  const finishCheck = useMemo(
    () => (classic ? canFinish(myHand, mode) : { ok: false, reason: undefined }),
    [myHand, mode, classic]
  );
  const myTurn = st.turn === 0 && !st.roundOver;

  /** Istakada taşı dokunarak seç / kaldır — pointer capture yüzünden click tuşa
   *  ulaşmadığı için seçim pointerup içinde yapılır (Oto Pilotsuz manuel oyunun anahtarı). */
  const toggleSelect = (id: string) => {
    if (!myTurn) return;
    setSelIds((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
  };

  // 101 ailesi: elindeki toplam açılabilir set puanı (açılma ipucu için)
  const layTotal = useMemo(
    () => (classic ? 0 : pureLayGroups(myHand).reduce((s, g) => s + g.value, 0)),
    [myHand, classic]
  );

  // ---- Masa sohbeti (masadaki oyuncularla yazışma) ----
  const pushChat = useCallback((who: string, text: string, ai: boolean) => {
    setChat((c) => [...c.slice(-40), { id: chatIdRef.current++, who, text, ai }]);
  }, []);
  const aiSay = useCallback(
    (text: string, who?: string) => {
      const pool = aiNamesRef.current.length > 0 ? aiNamesRef.current : AI_NAMES;
      const name = who ?? pool[Math.floor(Math.random() * pool.length)];
      pushChat(name, text, true);
    },
    [pushChat]
  );
  useEffect(() => {
    const el = chatBoxRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [chat]);

  const sendChat = () => {
    const txt = chatInput.trim();
    if (!txt) return;
    pushChat(me?.nick ?? "Sen", txt, false);
    setChatInput("");
    // Masadaki oyunculardan biri cevaplar
    const replies = [
      "Hadi bakalım, kolay gelsin! 🙂",
      "Dikkatli oyna, jokerleri saklıyorum.",
      "Bu el benim, iddia ediyorum 😄",
      "Gösterge benden yana sanki…",
      "Açan açsın, biz de sabırla bekleriz 😏",
      "Çivit dizmek de marifet, asıl mesele bitirmek!",
      "Duvar 20 taş, fırsatlar daralıyor!",
      "Eline sağlık, güzel gidiyorsun.",
    ];
    window.setTimeout(
      () => aiSay(replies[Math.floor(Math.random() * replies.length)]),
      (700 + Math.random() * 1500) * oyunHiziCarpani()
    );
  };

  // İstaka dizilimi: elle oluşturulan gruplar (per/küt/seri) en başta, sonra set / sayı / çivit / elle dizilim
  const clusters = useMemo(() => {
    const byId = new Map(myHand.map((t) => [t.id, t]));
    // 1) Elle gruplanan taşlar — istediğin gibi per/çift/seri yap, hep birlikte dururlar
    const grupClusters: Cluster[] = [];
    const grupIds = new Set<string>();
    for (const g of grups) {
      const tiles = g.map((id) => byId.get(id)).filter((t): t is Tile => !!t);
      if (tiles.length < 2) continue;
      if (manualOrder) {
        tiles.sort((a, b) => {
          const ai = manualOrder.indexOf(a.id);
          const bi = manualOrder.indexOf(b.id);
          if (ai >= 0 && bi >= 0) return ai - bi;
          return a.num - b.num || a.color - b.color;
        });
      } else {
        tiles.sort((a, b) => (a.wild !== b.wild ? (a.wild ? 1 : -1) : a.color !== b.color ? a.color - b.color : a.num - b.num));
      }
      for (const t of tiles) grupIds.add(t.id);
      grupClusters.push({ tiles, kind: grupKind(tiles) });
    }
    const rest = myHand.filter((t) => !grupIds.has(t.id));
    // 2) Kalan taşlar: elle dizilim ya da seçili dizilim modu
    let restClusters: Cluster[];
    if (manualOrder) {
      const ordered = manualOrder
        .map((id) => byId.get(id))
        .filter((t): t is Tile => !!t && !grupIds.has(t.id));
      const missing = rest.filter((t) => !manualOrder.includes(t.id));
      restClusters = [{ tiles: [...ordered, ...missing], kind: "serbest" }];
    } else if (sortMode === "set") {
      restClusters = arrangeClusters(rest, classic);
    } else {
      const flat = [...rest].sort((a, b) => {
        const aj = a.wild && a.num === 0 ? 1 : 0;
        const bj = b.wild && b.num === 0 ? 1 : 0;
        if (aj !== bj) return aj - bj;
        if (sortMode === "sayi") {
          // Sayı diz: önce sayı, sonra renk
          if (a.num !== b.num) return a.num - b.num;
          return a.color - b.color;
        }
        // Çivit diz: önce renk (siyah→çivit→kırmızı→sarı), sonra sayı
        if (a.color !== b.color) return a.color - b.color;
        return a.num - b.num;
      });
      restClusters = [{ tiles: flat, kind: "serbest" }];
    }
    return [...grupClusters, ...restClusters];
  }, [myHand, sortMode, classic, manualOrder, grups]);

  // İstaka İKİ KADEMELİ (kullanıcı isteği): taşlar iki rafa bölünür ve taş sayısı ~eşitlenir.
  // Anlamlı gruplar (seri/küt/per) bölünmez; dengedelemek için yalnız serbest (gruplanmamış)
  // kümeler ikiye ayrılabilir — böylece tek büyük küme yüzünden raf asla tek satıra düşmez.
  const tiers = useMemo(() => {
    const total = clusters.reduce((n, c) => n + c.tiles.length, 0);
    if (total <= 14) return [clusters]; // az taşsa tek raf yeterli
    const half = Math.ceil(total / 2);
    const row0: Cluster[] = [];
    const row1: Cluster[] = [];
    let acc = 0;
    for (const cl of clusters) {
      if (acc < half && cl.kind === "serbest" && cl.tiles.length > 1) {
        const take = Math.min(cl.tiles.length, half - acc);
        if (take > 0 && take < cl.tiles.length) {
          // serbest grubu bölerek iki rafı dengele
          row0.push({ tiles: cl.tiles.slice(0, take), kind: "serbest" });
          row1.push({ tiles: cl.tiles.slice(take), kind: "serbest" });
          acc = half;
          continue;
        }
      }
      if (acc < half) { row0.push(cl); acc += cl.tiles.length; }
      else row1.push(cl);
    }
    return [row0, row1].filter((r) => r.length > 0);
  }, [clusters]);

  // Görünen düz taş sırası (sürükleme hesapları için)
  const flatOrder = useMemo(() => clusters.flatMap((c) => c.tiles), [clusters]);

  // Sol tuşla tut → istediğin yere sürükle → bırak: taş o boşluğa geçer
  const applyDrop = () => {
    if (!dragId) return;
    if (dropTarget && dropTarget.id === dragId && dropTarget.side === "self") {
      setDragId(null);
      setDropTarget(null);
      return; // taşın üstüne bıraktın — yerinde kalsın
    }
    // Gruplu taşı gruptan koparırsan grup çözülür (ıstakada taşı alıp başka yere koyar gibi)
    setGrups((gs) => {
      if (!gs.some((g) => g.includes(dragId))) return gs;
      return gs.map((g) => g.filter((id) => id !== dragId)).filter((g) => g.length >= 2);
    });
    const order = flatOrder.map((t) => t.id).filter((id) => id !== dragId);
    if (dropTarget) {
      let idx = order.indexOf(dropTarget.id);
      if (idx < 0) idx = order.length;
      else if (dropTarget.side === "after") idx += 1;
      order.splice(idx, 0, dragId);
    } else {
      order.push(dragId); // boş sahaya bıraktın → en sona
    }
    setManualOrder(order);
    setDragId(null);
    setDropTarget(null);
  };
  // Sağ tık: taşı çevir (işaretle) — sky halkalı yan duran taş
  const toggleRotate = (id: string) => {
    setRotatedIds((r) => (r.includes(id) ? r.filter((x) => x !== id) : [...r, id]));
  };
  // Elden çıkan taşların işareti temizlensin
  useEffect(() => {
    setRotatedIds((r) => {
      const next = r.filter((id) => myHand.some((t) => t.id === id));
      return next.length === r.length ? r : next;
    });
  }, [myHand]);

  // El değişince elle grupları da toparla (grupta tek taş kalırsa grup çözülür)
  useEffect(() => {
    setGrups((gs) => {
      const handIds = new Set(myHand.map((t) => t.id));
      const seen = new Set<string>();
      let changed = false;
      const next: string[][] = [];
      for (const g of gs) {
        const f: string[] = [];
        for (const id of g) {
          if (handIds.has(id) && !seen.has(id)) {
            f.push(id);
            seen.add(id);
          }
        }
        if (f.length !== g.length) changed = true;
        if (f.length >= 2) next.push(f);
        else if (f.length > 0) changed = true;
      }
      if (next.length !== gs.length) changed = true;
      return changed ? next : gs;
    });
  }, [myHand]);

  // ---- Tur bitirme yardımcıları ----
  const endRound = useCallback(
    (winnerIdx: number, finished: boolean, next: GameState) => {
      let matchOver = false;
      const ranking: { idx: number; gain: number }[] = [];
      if (winnerIdx >= 0) {
        // Yeni skor sistemi (istek): el sonunda sıralama puanları —
        // 1. kazanan: rakiplerin ölü taş toplamını alır (en çok puan)
        // 2. en az ölü taşlı: kazancın YARISINI alır
        // 3.: -3 puan   4.: -7 puan
        const dead = next.players.map((p, i) =>
          i === winnerIdx ? 0 : deadwoodValue(p.hand) * (classic ? 1 : finished ? 1 : p.opened ? 1 : 2)
        );
        const total = dead.reduce((a, b) => a + b, 0);
        const losers = next.players.map((_, i) => i).filter((i) => i !== winnerIdx)
          .sort((a, b) => dead[a] - dead[b]); // en az ölü taş önce (2. sıra)
        const order = [winnerIdx, ...losers];
        // Çarpanlı oyun: kazanılan/kaybedilen puanlar çarpan ile çarpılır (x2/x4/x9)
        const gains = [total, Math.floor(total / 2), -3, -7].map((g) => g * carpani);
        order.forEach((idx, rank) => {
          const g = gains[Math.min(rank, gains.length - 1)];
          next.scores[idx] += g;
          ranking.push({ idx, gain: g });
        });
        // Çanak kuralı (x9/x123/x999): çanak başkası tarafından kırılırsa çanağın
        // YARISI masayı açana verilir — masa sahibi salonda olmasa bile kural işler
        if (canakAcik && winnerIdx >= 0 && acanNick) {
          const acanIdx = next.players.findIndex((p) => p.name === acanNick);
          if (acanIdx >= 0 && acanIdx !== winnerIdx) {
            const yari = Math.floor((total * carpani) / 2);
            next.scores[acanIdx] += yari;
            const rk = ranking.find((r) => r.idx === acanIdx);
            if (rk) rk.gain += yari;
            else ranking.push({ idx: acanIdx, gain: yari });
            pushLog(next, `🪙 Çanak kırıldı — masayı açan ${next.players[acanIdx].name} çanağın yarısını (+${yari}) aldı.`);
          } else if (acanIdx < 0) {
            pushLog(next, "🪙 Çanak kırıldı — masayı açan salonda olmadığı için çanak payı profile işlendi.");
          }
        }
        // Eşli oyun: takımlar (0+2) vs (1+3) — el sonunda takım skorları loglanır
        if (esli) {
          const t1 = next.scores[0] + next.scores[2];
          const t2 = next.scores[1] + next.scores[3];
          pushLog(next, `Eşli skor — Takım 1: ${t1} · Takım 2: ${t2}`);
        }
        next.rounds = (next.rounds ?? 0) + 1;
        // Maç bitişi: YALNIZ el sayısı dolunca (3/5/7 el) — 101 puanı maç sonunu erken bitirmez
        matchOver = next.rounds >= elSayisi;
      }
      const winnerScore = winnerIdx >= 0 ? next.scores[winnerIdx] : 0;
      pushLog(
        next,
        winnerIdx < 0
          ? "Ortada taş kalmadı — el berabere."
          : finished
          ? classic
            ? `${next.players[winnerIdx].name} eli açtı (Okey)!`
            : `${next.players[winnerIdx].name} eli bitirdi!`
          : `${next.players[winnerIdx].name} kazandı (diğerleri el açamadı).`
      );
      next.roundOver = {
        winner: winnerIdx,
        penalties: {},
        finished,
        matchOver,
        winnerScore,
        ranking,
      };
      // Masa sohbeti: el sonu yorumları
      if (winnerIdx < 0) aiSay("Taşlar bitti, el berabere sayıldı.", "Masa");
      else if (finished)
        aiSay(
          winnerIdx === 0 ? "Helal olsun, güzel açtın! 👏" : `${next.players[winnerIdx].name} bitirdi, maşallah!`
        );
      else aiSay(`${next.players[winnerIdx].name} kazandı, bu el acıdı 😬`);
      // Kazanç çipi veritabanına işlenir (gold 2x) — kazanan + kazanç (1. puanı)
      if (winnerIdx === 0 && me) {
        const base = ranking.find((r) => r.idx === 0)?.gain ?? 0;
        const gain = base > 0 ? (me.gold ? base * 2 : base) : 0;
        if (gain > 0) {
          void api
            .addChips(gain, `${modeConfig(mode).label} oyun sonucu${carpani > 1 ? ` (x${carpani})` : ""}`)
            .then(() => useApp.getState().syncMe())
            .catch(() => {});
          showToast(`Kazandın! +${gain} çip${carpani > 1 ? ` — x${carpani} çarpanlı` : ""}${me.gold ? " (Gold 2x)" : ""}`);
        }
      }
      // Maç istatistikleri: maç bitince oynanan/kazanılan profiline yazılır
      if (matchOver) {
        const myScore = next.scores[0] ?? 0;
        const iWon = next.scores.every((s, i) => i === 0 || s < myScore); // tek başına en yüksek puan
        void api.recordGame(iWon).catch(() => {});
      }
      setSt({ ...next });
      setSonucGizli(false); // yeni sonuç geldi — katman tekrar açılsın
    },
    [me, showToast, classic, aiSay, elSayisi, carpani, esli, canakAcik, acanNick]
  );

  // ---- Yapay zekâ sırası (mola duraklatır; Oto Pilot açıkken oyuncu sırası da AI oynar) ----
  useEffect(() => {
    if (waiting) return;
    if (st.roundOver) return;
    if (st.turn === 0 && !otoPilot) return;
    if (mola) return;
    if (timerRef.current) window.clearTimeout(timerRef.current);
    timerRef.current = window.setTimeout(() => {
      const next: GameState = { ...stRef.current, players: stRef.current.players.map((p) => ({ ...p, hand: [...p.hand], laid: p.laid.map((g) => ({ ...g, tiles: [...g.tiles] })) })), log: [...stRef.current.log] };
      if (next.roundOver || (next.turn === 0 && !otoPilot)) return;
      const ai = next.players[next.turn];
      // Zor AI: yerdeki taşın gerçek katkısını ölçer (sonra düşeceği taşla birlikte)
      // Ayrıca gerçek 101 mantığı: açtığı bir gruba uyan taş varsa onu alır (uzatma)
      let takeDecision = next.discard
        ? aiShouldTake(ai.hand, next.discard, mode, next.dropped)
        : false;
      if (!takeDecision && next.discard && ai.opened && ai.laid.length > 0) {
        takeDecision = ai.laid.some((g) => canExtendGroup(g, next.discard!));
      }
      let took = false;
      let justTookId: string | null = null;
      if (next.discard && takeDecision) {
        justTookId = next.discard.id;
        ai.hand.push(next.discard);
        next.dropped.push(next.discard);
        next.discard = null;
        took = true;
        // Duvar bitmişken yerdeki taş alındıysa bu oyuncunun SON turudur
        if (next.wall.length === 0) next.finalTurn = next.turn;
        pushLog(next, `${ai.name} yerden taş aldı.`);
      } else if (next.wall.length > 0) {
        ai.hand.push(next.wall.pop()!);
        pushLog(next, `${ai.name} ortadan taş çekti.`);
      } else {
        // Duvar bitti: yerden son taş — alan oyuncunun son şansı, turu bitince el biter
        if (next.discard) {
          ai.hand.push(next.discard);
          next.dropped.push(next.discard);
          next.discard = null;
          next.finalTurn = next.turn;
          pushLog(next, `${ai.name} yerdeki son taşı aldı (son şans).`);
        } else if (classic) {
          // Klasik Okey: taşlar bitti, kimse açamadı → el berabere
          pushLog(next, "Ortada taş kalmadı — el berabere.");
          endRound(-1, false, next);
          return;
        } else {
          // Kimse bitiremiyor: en az ölü taşı olan kazanır
          const vals = next.players.map((p) => deadwoodValue(p.hand));
          const best = vals.indexOf(Math.min(...vals));
          endRound(best, false, next);
          return;
        }
      }
      sortHand(ai.hand);
      if (classic) {
        // Klasik Okey: 4 set + 1 per hazırsa eli açar
        const fc = canFinish(ai.hand, mode);
        if (fc.ok && ai.hand.length >= 14) {
          endRound(next.turn, true, next);
          return;
        }
      } else {
        // 101 ailesi — gerçek oyuncu gibi oyna:
        // 1) Açtıysa: elindeki ölü taşları masaya açtığı gruplara UZAT (gerçek 101 kuralı)
        if (ai.opened && ai.laid.length > 0) {
          const d0 = bestDecomposition(ai.hand, false);
          const deadIds = new Set(d0.deadwood.map((t) => t.id));
          for (let gi = 0; gi < ai.laid.length; gi++) {
            const ext = ai.hand.find((t) => deadIds.has(t.id) && canExtendGroup(ai.laid[gi], t));
            if (ext) {
              ai.hand = ai.hand.filter((t) => t.id !== ext.id);
              ai.laid[gi] = { ...ai.laid[gi], tiles: [...ai.laid[gi].tiles, ext] };
              pushLog(next, `${ai.name} ${ai.laid[gi].kind === "seri" ? "serisini" : "kütünü"} ${ext.wild ? "jokerle" : ext.num + " taşıyla"} uzattı.`);
              if (ai.hand.length === 0) {
                endRound(next.turn, true, next);
                return;
              }
              break;
            }
          }
        }
        // 2) Açma botu: eşiği geçen grupları masaya yatır (joker dahil — gerçek 101)
        // Artırmalı: ilk açan openMin, sonrakiler öncekinin +1'i
        const esikAI = artirmali ? openMin + artirmaliRef.current : openMin;
        const plan = aiLayPlan(ai.hand, ai.opened, esikAI);
        if (plan && plan.length > 0) {
          const ids = new Set(plan.flatMap((g) => g.tiles.map((t) => t.id)));
          ai.hand = ai.hand.filter((t) => !ids.has(t.id));
          ai.laid.push(...plan);
          ai.opened = true;
          if (artirmali) artirmaliRef.current += 1;
          pushLog(
            next,
            `${ai.name} masaya ${plan.length} grup açtı (${plan.map((g) => (g.kind === "per" ? "çift" : g.kind)).join(" + ")}).`
          );
          aiSay(`${plan.length} grup açtım, sıra sende!`, ai.name);
        }
        // Bütün taşlarını masaya açtıysa eli boşalır ve eli kazanır
        if (ai.hand.length === 0) {
          endRound(next.turn, true, next);
          return;
        }
      }
      // Düşür: yerden alınan taş hariç her taşı deneyip en iyi kalan eli bırakır (gerçek 101 kuralı)
      const discardPool = justTookId ? ai.hand.filter((t) => t.id !== justTookId) : ai.hand;
      const discard = discardPool.length > 0 ? aiBestDiscard(discardPool, mode, next.dropped) : ai.hand[0];
      ai.hand = ai.hand.filter((t) => t.id !== discard.id);
      next.discard = discard;
      next.dropped.push(discard);
      pushLog(next, `${ai.name} ${discard.wild ? "joker" : discard.num + " taşını"} bıraktı.`);
      // Son taşını da bıraktıysa (101 ailesi) eli kazanır
      if (ai.hand.length === 0) {
        endRound(next.turn, true, next);
        return;
      }
      // Duvar bittikten sonra yerdeki son taşı alan oyuncu turunu oynadı —
      // el hemen biter (son taş dönüp dönüp atılmaz)
      if (next.finalTurn === next.turn) {
        if (classic) {
          pushLog(next, "Son taş da alındı — ortada taş kalmadı, el berabere bitti.");
          endRound(-1, false, next);
        } else {
          const vals = next.players.map((p) => deadwoodValue(p.hand));
          const best = vals.indexOf(Math.min(...vals));
          pushLog(next, "Son taş da alındı — el bitti, en az ölü taşlı kazandı.");
          endRound(best, false, next);
        }
        return;
      }
      next.turn = (next.turn + 1) % 4;
      next.drewThisTurn = false;
      setSt(next);
    }, 900 * oyunHiziCarpani());
    return () => {
      if (timerRef.current) window.clearTimeout(timerRef.current);
    };
  }, [waiting, st.turn, st.roundOver, mode, endRound, aiSay, mola, otoPilot]);

  // ---- Oyuncu aksiyonları ----
  const takeDiscard = () => {
    if (!myTurn || !st.discard || st.drewThisTurn) return;
    const next = { ...st, players: st.players.map((p) => ({ ...p, hand: [...p.hand] })), log: [...st.log] };
    next.justTookId = next.discard!.id; // yerden aldın — bu taşı bu tur atamazsın (gerçek 101 kuralı)
    next.players[0].hand.push(next.discard!);
    next.discard = null;
    next.drewThisTurn = true;
    // Duvar bitmişken yerdeki taş alındıysa oyuncunun SON turudur
    if (next.wall.length === 0) next.finalTurn = 0;
    pushLog(next, next.finalTurn === 0 ? "Yerden son taşı aldın (son şans)." : "Yerden taş aldın.");
    setSelIds([]);
    setSt(next);
  };

  // Referanstaki "Geri Topla": taşa çekmeden son açtığın grubu eline geri al
  const geriTopla = () => {
    if (!myTurn || st.drewThisTurn || st.roundOver) return;
    const p = st.players[0];
    if (p.laid.length === 0) {
      showToast("Geri toplanacak açılmış grup yok.");
      return;
    }
    const last = p.laid[p.laid.length - 1];
    const next = {
      ...st,
      players: st.players.map((pl, i) =>
        i === 0 ? { ...pl, hand: [...pl.hand, ...last.tiles], laid: pl.laid.slice(0, -1) } : { ...pl, hand: [...pl.hand] }
      ),
      log: [...st.log],
    };
    pushLog(next, `Son açtığın ${last.tiles.length} taşı geri topladın.`);
    setSelIds([]);
    setSt(next);
  };

  const drawWall = () => {
    if (!myTurn || st.drewThisTurn) return;
    if (st.wall.length === 0) {
      if (!st.discard) {
        // Duvar da yer de bitti: el biter — en az ölü taşı olan kazanır (gerçek 101)
        const next = { ...st, players: st.players.map((p) => ({ ...p, hand: [...p.hand] })), log: [...st.log] };
        const vals = next.players.map((p) => deadwoodValue(p.hand));
        const best = vals.indexOf(Math.min(...vals));
        pushLog(next, "Ortada taş kalmadı — el en az puanlıyla bitti.");
        endRound(best, false, next);
        return;
      }
      takeDiscard();
      return;
    }
    const next = { ...st, players: st.players.map((p) => ({ ...p, hand: [...p.hand] })), log: [...st.log] };
    const t = next.wall.pop()!;
    next.justTookId = null; // ortadan çektin — isteğine göre taş bırakabilirsin
    next.players[0].hand.push(t);
    next.drewThisTurn = true;
    pushLog(next, `Ortadan taş çektin: ${tileLabel(t)}${t.wild && t.num > 0 ? " (OKEY!)" : ""}.`);
    setSelIds([]);
    setSt(next);
  };

  // Bir taşı masaya bırak — "Bırak" butonu ile ÇİFT TIKLA TAŞ ATMA ortak gövdesi
  const playDiscard = (tile: Tile) => {
    if (!myTurn || !st.drewThisTurn || st.roundOver) return;
    // Gerçek 101 kuralı: yerden aldığın taşı aynı tur atamazsın
    if (st.justTookId === tile.id && st.players[0].hand.length > 1) {
      showToast("Yerden aldığın taşı bu tur atamazsın — başka bir taş bırak!");
      return;
    }
    const next = { ...st, players: st.players.map((p) => ({ ...p, hand: [...p.hand] })), log: [...st.log] };
    next.players[0].hand = next.players[0].hand.filter((t) => t.id !== tile.id);
    next.discard = tile;
    next.dropped = [...next.dropped, tile];
    pushLog(next, `${tileLabel(tile)} taşını bıraktın.`);
    // Son taşını da bıraktıysan (101 ailesi) eli kazanırsın
    if (next.players[0].hand.length === 0) {
      endRound(0, true, next);
      return;
    }
    // Duvar bittikten sonra yerdeki son taşı almıştın — turun bitti, el kapanır
    if (next.finalTurn === 0) {
      if (classic) {
        pushLog(next, "Son taş da alındı — ortada taş kalmadı, el berabere bitti.");
        endRound(-1, false, next);
      } else {
        const vals = next.players.map((p) => deadwoodValue(p.hand));
        const best = vals.indexOf(Math.min(...vals));
        pushLog(next, "Son taş da alındı — el bitti, en az ölü taşlı kazandı.");
        endRound(best, false, next);
      }
      return;
    }
    next.turn = 1;
    next.drewThisTurn = false;
    setSelIds([]);
    setSt(next);
  };

  const discardSelected = () => {
    if (!myTurn || !st.drewThisTurn || selIds.length !== 1) {
      if (selIds.length > 1) showToast("Bırakmak için tek taş seç.");
      return;
    }
    const tile = st.players[0].hand.find((t) => t.id === selIds[0]);
    if (tile) playDiscard(tile);
  };

  // Kullanıcı isteği: İSTAKADAKİ TAŞA ÇİFT TIKLAYINCA o taş doğrudan masaya atılır
  const discardTileById = (id: string) => {
    const tile = st.players[0].hand.find((t) => t.id === id);
    if (!tile) return;
    if (!myTurn || !st.drewThisTurn || st.roundOver) {
      showToast("Taş bırakmak için sıra sende olmalı ve önce taş çekmiş olmalısın.");
      return;
    }
    playDiscard(tile);
  };

  // 101 ailesi: masaya seri/küt aç (Seri Aç) — set toplamı eşiği geçmeli
  const layClick = (kind: "seri" | "per") => {
    if (!myTurn || !st.drewThisTurn || st.roundOver) return;
    const p = st.players[0];
    const esik = artirmali ? openMin + artirmaliRef.current : openMin; // artırmalı: her açılma +1
    let groups: ReturnType<typeof pureLayGroups>;
    if (kind === "seri") {
      // Seri açılışı: seri + küt (aynı sayı farklı renk) — ikisinin toplam puanı eşiği geçmeli
      groups = pureLayGroups(p.hand);
      if (groups.length === 0) {
        showToast("Elinde yatabilecek seri veya küt yok.");
        return;
      }
      const total = groups.reduce((s, g) => s + g.value, 0);
      if (!p.opened && total < esik) {
        showToast(`Masaya açmak için setlerinin toplamı en az ${esik} puan olmalı. (Toplam: ${total})`);
        return;
      }
    } else {
      // Çift (per) açılışı: birebir aynı 2 taş — en az 5 çift, puan şartı yok
      groups = pureLayPairs(p.hand);
      if (groups.length === 0) {
        showToast("Elinde birebir çift (per) yok — aynı sayı ve aynı renkten iki taş gerekir.");
        return;
      }
      if (!p.opened && groups.length < PAIR_OPEN_MIN) {
        showToast(`Çift ile açmak için en az ${PAIR_OPEN_MIN} çift gerekir. (Çift: ${groups.length})`);
        return;
      }
    }
    const next = {
      ...st,
      players: st.players.map((pl) => ({ ...pl, hand: [...pl.hand], laid: [...pl.laid] })),
      log: [...st.log],
    };
    const ids = new Set(groups.flatMap((g) => g.tiles.map((t) => t.id)));
    next.players[0].hand = next.players[0].hand.filter((t) => !ids.has(t.id));
    next.players[0].laid.push(...groups);
    next.players[0].opened = true;
    if (artirmali) artirmaliRef.current += 1; // artırmalı: sonraki oyuncunun eşiği +1
    pushLog(next, `Masaya ${groups.length} grup açtın (${groups.map((g) => (g.kind === "per" ? "çift" : g.kind)).join(" + ")}).`);
    window.setTimeout(
      () => aiSay("Vay, masaya açtın! Biz de bekleriz bakalım 😏"),
      (700 + Math.random() * 1200) * oyunHiziCarpani()
    );
    if (next.players[0].hand.length === 0) {
      endRound(0, true, next);
      return;
    }
    setSelIds([]);
    setSt(next);
  };

  // 101 ailesi: seçtiği taşları masaya yatır — açılışta ne oynayacağını oyuncu seçer (joker dahil)
  const laySelected = () => {
    if (!myTurn || !st.drewThisTurn || st.roundOver) return;
    const p = st.players[0];
    const chosen = p.hand.filter((t) => selIds.includes(t.id));
    if (chosen.length < 2) {
      showToast("Masaya yatırmak için en az 2 taş seç (çift) ya da 3+ taş (seri/küt).");
      return;
    }
    const groups = validateLaySelection(chosen);
    if (!groups) {
      showToast("Seçtiğin taşlar açılamaz — ya tamamı seri/küt olmalı ya da çift (per) + set karışımı.");
      return;
    }
    const esik = artirmali ? openMin + artirmaliRef.current : openMin; // artırmalı: her açılma +1
    if (!p.opened) {
      // Açılış: set toplamı eşiği YA DA en az 5 çift (per)
      const setTotal = groups.filter((g) => g.kind !== "per").reduce((s, g) => s + g.value, 0);
      const pairCount = groups.filter((g) => g.kind === "per").length;
      if (setTotal < esik && pairCount < PAIR_OPEN_MIN) {
        showToast(
          `Açmak için: setlerinin toplamı en az ${esik} puan (Şu an: ${setTotal}) ya da en az ${PAIR_OPEN_MIN} çift (Şu an: ${pairCount}).`
        );
        return;
      }
    }
    const next = {
      ...st,
      players: st.players.map((pl) => ({ ...pl, hand: [...pl.hand], laid: [...pl.laid] })),
      log: [...st.log],
    };
    next.players[0].hand = next.players[0].hand.filter((t) => !selIds.includes(t.id));
    next.players[0].laid.push(...groups);
    next.players[0].opened = true;
    if (artirmali) artirmaliRef.current += 1; // artırmalı: sonraki oyuncunun eşiği +1
    pushLog(next, `Seçtiğin ${groups.length} grubu masaya açtın (${groups.map((g) => (g.kind === "per" ? "çift" : g.kind)).join(" + ")}).`);
    window.setTimeout(
      () => aiSay("Kendi seçtiğin grubu açtın, helal! 👏"),
      (700 + Math.random() * 1200) * oyunHiziCarpani()
    );
    if (next.players[0].hand.length === 0) {
      endRound(0, true, next);
      return;
    }
    setSelIds([]);
    setSt(next);
  };

  // 101 & Okey: ıstakada elle gruplama — seçili taşları per / çift (küt) / seri olarak grupla
  const gruplaSecili = () => {
    const ids = selIds.filter((id) => myHand.some((t) => t.id === id));
    if (ids.length < 2) {
      showToast("Gruplamak için en az 2 taş seç (önce taşı tıkla). ");
      return;
    }
    setGrups((gs) => {
      const rest = gs.map((g) => g.filter((id) => !ids.includes(id))).filter((g) => g.length >= 2);
      return [...rest, ids];
    });
    setSelIds([]);
    showToast("Taşlar gruplandı. Çözmek için gruba tıkla → Grubu Ayır.");
  };

  const grupAyir = (id: string) => {
    setGrups((gs) => gs.filter((g) => !g.includes(id)));
  };

  // Gerçek 101 kuralı: açtıktan sonra seçili tek taşı masaya açtığın gruba EKLE (uzat)
  const extendGroup = (gi: number) => {
    if (!myTurn || !st.drewThisTurn || st.roundOver || selIds.length !== 1) {
      if (selIds.length > 1) showToast("Uzatmak için tek taş seç.");
      return;
    }
    const p = st.players[0];
    const tile = p.hand.find((t) => t.id === selIds[0]);
    const group = p.laid[gi];
    if (!tile || !group) return;
    if (!canExtendGroup(group, tile)) {
      showToast("Bu taş o gruba uymuyor — seri ile bitişik aynı renk ya da küt ile aynı sayı olmalı.");
      return;
    }
    const next = {
      ...st,
      players: st.players.map((pl) => ({ ...pl, hand: [...pl.hand], laid: [...pl.laid] })),
      log: [...st.log],
    };
    next.players[0].hand = next.players[0].hand.filter((t) => t.id !== tile.id);
    next.players[0].laid[gi] = { ...group, tiles: [...group.tiles, tile] };
    pushLog(next, `${tileLabel(tile)} taşını masadaki ${group.kind === "seri" ? "seriye" : "küte"} ekledin (uzattın).`);
    if (next.players[0].hand.length === 0) {
      endRound(0, true, next);
      return;
    }
    setSelIds([]);
    setSt(next);
  };

  const finishHand = () => {
    if (!myTurn || !finishCheck.ok) {
      if (!finishCheck.ok) showToast(finishCheck.reason ?? "El açılamaz.");
      return;
    }
    if (!st.drewThisTurn) {
      showToast("Önce taş çekmen gerekiyor.");
      return;
    }
    endRound(0, true, { ...st, players: st.players.map((p) => ({ ...p, hand: [...p.hand] })), log: [...st.log] });
  };

  const newRoundClick = () => {
    // Masayı kim kurduysa yalnız o el başlatabilir (pratik masasında herkes sahip)
    if (tableOwner && me && tableOwner.toLowerCase() !== me.nick.trim().toLowerCase()) {
      showToast(`Bu masayı ${tableOwner} kurdu — el yalnızca masa sahibi başlatabilir.`);
      return;
    }
    // Maç bittiyse YENİ MAÇ açılır (skorlar sıfırlanır); değilse sıradaki el
    const macBitti = !!st.roundOver?.matchOver && !classic;
    artirmaliRef.current = 0; // artırmalı eşik yeni elde baştan (ilk açan yine 101)
    setSt(
      macBitti
        ? newRound(me?.nick ?? "Sen", [0, 0, 0, 0], classic, aiNamesRef.current, 0)
        : newRound(me?.nick ?? "Sen", st.scores, classic, aiNamesRef.current, st.rounds ?? 0)
    );
    setSelIds([]);
    setManualOrder(null);
    setGrups([]);
    setSonucGizli(false);
  };

  const isTableOwner = !tableOwner || !me || tableOwner.toLowerCase() === me.nick.trim().toLowerCase();

  const modeLabel = modeConfig(mode).label;

  // Masa dolmadısa bekleme lobisi göster — oyun (kartlar) henüz açılmasın
  if (waiting && activeTableId != null) {
    return (
      <AutoFit width={1180} fitScreen className="okey-mavi min-h-screen py-3 px-2" style={{ fontFamily: "Tahoma, Geneva, Verdana, sans-serif" }}>
        <MasaBekleme tableId={activeTableId} gameLabel={modeLabel} opponents={tableOpp} onRefresh={() => {
          const id = useApp.getState().activeTable;
          if (id == null) return;
          void api.table(id).then((r) => {
            const all = parsePlayers(r.table).filter((p) => p.nick !== (me?.nick ?? ""));
            setTableOpp(all.slice(0, 3));
            if (all.length >= 3) {
              const names = all.slice(0, 3).map((p) => p.nick);
              aiNamesRef.current = names;
              if (!gameStartedRef.current) {
                gameStartedRef.current = true;
                setSelIds([]);
                setManualOrder(null);
                setSt(newRound(me?.nick ?? "Sen", [0, 0, 0, 0], classic, names));
              }
              setWaiting(false);
            }
          }).catch(() => {});
        }} />
      </AutoFit>
    );
  }

  const okeyTileDesc =
    st.setup.okeyNum === 13 ? `13'ün (1) ${COLOR_NAMES[st.setup.okeyColor]}` : `${st.setup.okeyNum} ${COLOR_NAMES[st.setup.okeyColor]}`;

  // Masa ortası İKİ AYRI YER (referans doguport düzeni):
  //  - SERİ YERİ: açılan seri/küt grupları MERDİVEN (kademeli) manuel dizilimle aşağı iner
  //  - ÇİFT YERİ: per (birebir aynı 2 taş) grupları DİKEY sütunda alt alta sıralanır
  // Her iki alan da dört oyuncunun tüm açtıklarını gösterir; taşlar küçük gövde + büyük 3B rakam.
  const laidAreas = (["seri", "per"] as const).map((kind) => ({
    kind,
    label: kind === "seri" ? "SERİ AÇMA YERİ" : `ÇİFT AÇMA YERİ (PER)`,
    rows: st.players.flatMap((p) =>
      p.laid.map((g, gi) => ({ p, g, gi })).filter((x) => (kind === "seri" ? x.g.kind !== "per" : x.g.kind === "per"))
    ),
  }));

  return (
    <AutoFit width={1180} fitScreen className="okey-mavi min-h-screen py-3 px-2" style={{ fontFamily: "Tahoma, Geneva, Verdana, sans-serif" }}>
      <div className="max-w-[1500px] mx-auto bg-[#2450c4] border border-[#0f2a80] shadow-pop flex flex-col min-h-[92vh]">
        {/* Klasik siyah pencere başlığı (ÇİFT OKEY) */}
        <div className="flex items-center justify-between gap-2 px-2 py-1 bg-black text-white text-xs font-bold select-none border-b border-[#8b5a2b]">
          <span className="truncate">
            Has Okey [{activeTableId ?? "Pratik"}] [{me?.nick ?? "Sen"}]
          </span>
          <span className="whitespace-nowrap text-yellow-300">
            {st.roundOver ? "[ El Bitti ]" : myTurn ? "[ Sıra Sizde ]" : `[ Sıra: ${st.players[st.turn].name} ]`}
          </span>
          <span className="flex items-center gap-2 shrink-0 text-white/90">
            <span className="px-1 leading-4 cursor-default">—</span>
            <span className="px-1 leading-4 cursor-default">□</span>
            <button onClick={() => void masadanCik(() => useApp.getState().go({ name: "salon", game: mode }))} title="Masadan çık — pencereyi kapat" className="px-1.5 leading-4 hover:text-red-500">×</button>
          </span>
        </div>

        {/* ANA SATIR: hisin + lacivert menü şeridi */}
        <div className="flex flex-1 min-h-0 cq-row">
          {/* HİSİN */}
          <div className="okey-mavi flex-1 min-w-0 relative overflow-hidden border-[4px] border-double border-[#1e40a8]">
            {MASA_TINT[renkIdx] !== "rgba(0,0,0,0)" && (
              <div className="absolute inset-0 pointer-events-none" style={{ background: MASA_TINT[renkIdx] }} />
            )}
            {MASA_RESIM[resimIdx] && (
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <span className="text-[200px] leading-none opacity-[0.07] select-none">{MASA_RESIM[resimIdx]}</span>
              </div>
            )}

            {/* ÜST AHŞAP LOGO BANDI (referans: ortada Has Okey amblemi) */}
            <div className="absolute top-0 left-1/2 -translate-x-1/2 z-30 flex items-center gap-3 px-6 py-1 klasik-ahsap border-x-2 border-b-2 border-[#4a2e13] shadow-[0_3px_8px_rgba(0,0,0,.45)]">
              <div className="flex gap-0.5">{[{ id: "bl1", num: 1, color: 0, wild: false }, { id: "bl2", num: 2, color: 1, wild: false }, { id: "bl3", num: 3, color: 2, wild: false }].map((t) => <OkeyTile key={t.id} tile={t} size="xs" />)}</div>
              <div className="flex flex-col items-center leading-none">
                <span className="text-[11px] mb-0.5">👑</span>
                <span className="hk-logo-text text-[21px] leading-none">Has Okey</span>
              </div>
              <div className="flex gap-0.5">{[{ id: "br1", num: 11, color: 3, wild: false }, { id: "br2", num: 12, color: 0, wild: false }, { id: "br3", num: 13, color: 1, wild: false }].map((t) => <OkeyTile key={t.id} tile={t} size="xs" />)}</div>
            </div>

            {/* BEYAZ SÜTUN ÇİZGİLERİ + OYUN ALANI ÇERÇEVESİ (referans: bire bir) */}
            <div className="absolute top-[64px] bottom-[80px] left-[38px] right-[38px] z-[1] pointer-events-none border border-white/70">
              {[31.8, 60.6, 76.9, 84.6, 89.6, 94.7].map((p) => (
                <span key={p} className="absolute top-0 bottom-0 w-px bg-white/70" style={{ left: `${p}%` }} />
              ))}
            </div>

            {/* SARI/BEYAZ ALAN ETİKETLERİ (referans: aksiyonlar sarı, alan adları beyaz) */}
            <div className="absolute top-[46px] left-0 right-0 z-20 flex items-center gap-3 px-[54px] text-[11px] font-bold select-none pointer-events-none">
              <span className="text-yellow-300">Yazboz</span>
              <span className="text-yellow-300">Otomatik Seri Aç</span>
              <span className="flex-1 text-center text-white">Seri Açma Alanı</span>
              <span className="flex-1 text-center text-white">Çift Açma Alanı</span>
              <span className="text-yellow-300">Oto. Çift Aç</span>
            </div>

            {/* DİKEY AHŞAP RAFLAR (referans: sol/sağ Has Okey yazılı raf) */}
            <div className="absolute left-0 top-[68px] bottom-[80px] w-[34px] z-[6] klasik-ahsap border-r-2 border-[#4a2e13] flex flex-col items-center py-2 gap-1 shadow-[inset_-2px_0_5px_rgba(0,0,0,.35)]">
              <span className="text-[9px] font-black text-white leading-none [text-shadow:0_1px_2px_rgba(0,0,0,.7)]">{st.players[2].opened ? "Açtı" : "Açmadı"}</span>
              <span className="text-[10px]">👑</span>
              <span className="hk-logo-text text-[13px] [writing-mode:vertical-rl] rotate-180 tracking-wider">Has Okey</span>
            </div>
            <div className="absolute right-0 top-[68px] bottom-[80px] w-[34px] z-[6] klasik-ahsap border-l-2 border-[#4a2e13] flex flex-col items-center py-2 gap-1 shadow-[inset_2px_0_5px_rgba(0,0,0,.35)]">
              <span className="text-[9px] font-black text-white leading-none [text-shadow:0_1px_2px_rgba(0,0,0,.7)]">{st.players[3].opened ? "Açtı" : "Açmadı"}</span>
              <span className="text-[10px]">👑</span>
              <span className="hk-logo-text text-[13px] [writing-mode:vertical-rl] tracking-wider">Has Okey</span>
            </div>

            {/* ALT AHŞAP BANT (referans: boş oyuncu kutuları + Geri Bırak · Oyun Salonu · Sayı) */}
            <div className="absolute bottom-0 left-[38px] right-[38px] h-[76px] z-20 flex items-stretch gap-1.5">
              <div className="w-[96px] shrink-0 flex flex-col items-center pt-1 gap-1">
                <div className="w-full h-[50px] bg-white border border-black shadow-pop" />
                <div className="flex flex-col items-center leading-none gap-0.5">
                  <span className="text-[11px] font-black text-[#0d2a7a]">Geri Bırak</span>
                  <span className={`text-[9px] font-bold ${st.players[0].opened ? "text-[#0a7a2f]" : "text-black"}`}>{st.players[0].opened ? "Açtın" : "Açmadı"}</span>
                </div>
              </div>
              <div className="flex-1 min-w-0 klasik-ahsap border border-[#4a2e13] flex flex-col items-center justify-center gap-1 px-2 shadow-pop">
                <div className="flex items-center gap-2 leading-none">
                  <span className="text-[12px]">👑</span>
                  <span className="hk-logo-text text-[18px] leading-none">Has Okey</span>
                </div>
                <span className="text-[13px] italic leading-none text-[#f6e6c4]" style={{ fontFamily: "Georgia, 'Times New Roman', serif" }}>Oyun Salonu</span>
              </div>
              <div className="w-[64px] shrink-0 flex flex-col items-center pt-1 gap-1">
                <div className="w-full h-[50px] bg-white border border-black shadow-pop" />
                <span className="text-[11px] font-black text-[#0d2a7a] leading-none">Sayı</span>
              </div>
            </div>

            {/* Kenar rakipler (üst / sol / sağ) */}
            <EdgeSeat p={st.players[1]} active={st.turn === 1} score={st.scores[1]} edge="top" laid={st.players[1].laid} />
            <EdgeSeat p={st.players[2]} active={st.turn === 2} score={st.scores[2]} edge="left" laid={st.players[2].laid} />
            <EdgeSeat p={st.players[3]} active={st.turn === 3} score={st.scores[3]} edge="right" laid={st.players[3].laid} />

            {/* Gösterge (referans: sol üstte sadece taş — yazısız) */}
            <div className="absolute top-1 left-[46px] z-20 bg-white border border-black p-[2px] shadow-pop">
              <OkeyTile tile={st.setup.gosterge} size="sm" />
            </div>

            {/* Orta içerik — referans düzen: sütun başlıkları + kayıtlar + Geri Al/Topla + ıstaka */}
            <div className="relative z-[5] h-full pt-[66px] pl-[118px] pr-[126px] pb-[80px] min-h-[430px] flex flex-col overflow-y-auto overflow-x-hidden">
              {/* Oyun kaydı (referans: sol üstte satırlar) */}
              <div className="text-[10px] text-white/85 space-y-px mb-1 max-h-14 overflow-hidden">
                {st.log.slice(-4).map((l, i) => (
                  <p key={i} className="truncate">{l}</p>
                ))}
              </div>

              {/* Durum satırı */}
              <p className="text-center text-[11px] text-white font-bold mt-1 min-h-[14px]">
                {st.roundOver
                  ? st.roundOver.matchOver
                    ? "Maç sona erdi!"
                    : "El bitti — yeni el için hazır ol."
                  : myTurn
                  ? st.drewThisTurn
                    ? classic
                      ? "Taşını seç ve bırak — ya da elini aç!"
                      : "Taşını bırak — ya da Seri Aç / Çift Aç ile masaya yatır!"
                    : "Sıra sende: ortadan çek ya da yerden taş al."
                  : `${st.players[st.turn].name} oynuyor...`}
              </p>

              {/* El sonucu bandı altı — sonuç gizliyken geri aç */}
              {st.roundOver && sonucGizli && (
                <button onClick={() => setSonucGizli(false)} className="mt-1 w-full py-1 rounded bg-yellow-500 hover:bg-yellow-400 text-black text-xs font-bold">
                  📋 {st.roundOver.matchOver ? "Maç Sonucu" : "El Sonucu"} Göster
                </button>
              )}

              {/* ORTA — masanın göbeği: duvar sayacı + yere düşen taş + ORTADA SIRALANAN açılan taşlar */}
              <div className="flex-1 min-h-[120px] flex flex-col items-center justify-center gap-2 py-2">
                <div className="w-full flex items-end justify-end gap-2 pr-1">
                  {/* GERİ AL — referans: beyaz kutu (taş + adet) */}
                  <div className="flex flex-col items-center bg-white border border-black px-2 pt-1 pb-1 shadow-pop w-[70px]">
                    <span className="text-[11px] font-black text-[#12315c] leading-none mb-1">Geri Al</span>
                    <button
                      onClick={takeDiscard}
                      disabled={!myTurn || !st.discard || st.drewThisTurn}
                      title="Yerdeki son taşı al"
                      className={`p-0.5 border ${myTurn && st.discard && !st.drewThisTurn ? "border-[#12315c] hover:ring-2 ring-yellow-400" : "border-black/30 opacity-70"}`}
                    >
                      {st.discard ? <OkeyTile tile={st.discard} size="md" /> : <div className="w-[32px] h-[44px] border border-dashed border-black/40 rounded-[3px]" />}
                    </button>
                    <span className="text-[11px] font-black text-black leading-none mt-1">{st.dropped.length}</span>
                  </div>
                  {/* GERİ TOPLA — son açılan grubu geri al */}
                  <div className="flex flex-col items-center bg-white border border-black px-2 pt-1 pb-1 shadow-pop w-[70px]">
                    <span className="text-[11px] font-black text-[#12315c] leading-none mb-1">Geri Topla</span>
                    <button
                      onClick={geriTopla}
                      disabled={!myTurn || !!st.roundOver || st.players[0].laid.length === 0 || st.drewThisTurn}
                      title="Son açtığın taşları geri topla (taşa çekmeden önce)"
                      className={`p-0.5 border ${myTurn && !st.drewThisTurn && st.players[0].laid.length > 0 ? "border-[#12315c] hover:ring-2 ring-yellow-400" : "border-black/30 opacity-70"}`}
                    >
                      {st.players[0].laid.length > 0 ? (
                        <div className="flex -space-x-3">{st.players[0].laid[st.players[0].laid.length - 1].tiles.slice(0, 2).map((t) => <OkeyTile key={t.id} tile={t} size="xs" />)}</div>
                      ) : (
                        <div className="w-[32px] h-[44px] border border-dashed border-black/40 rounded-[3px]" />
                      )}
                    </button>
                    <span className="text-[11px] font-black text-black leading-none mt-1">{st.players[0].laid.reduce((n, g) => n + g.tiles.length, 0)}</span>
                  </div>
                  {/* DÜVAR — mavi küre, sayı içinde */}
                  <button
                    onClick={drawWall}
                    disabled={!myTurn || st.drewThisTurn || st.wall.length === 0}
                    title={`Ortadan taş çek — kalan ${st.wall.length}`}
                    className="group flex flex-col items-center"
                  >
                    <span
                      className={`w-12 h-12 rounded-full border-2 border-white/70 shadow-[inset_-3px_-4px_9px_rgba(0,0,0,.5),0_2px_5px_rgba(0,0,0,.5)] flex items-center justify-center ${myTurn && !st.drewThisTurn ? "ring-2 ring-yellow-300 animate-pulse" : "group-enabled:group-hover:ring-2 group-enabled:group-hover:ring-yellow-300"}`}
                      style={{ background: "radial-gradient(circle at 35% 30%, #4a63b0, #1d2f6b 75%)" }}
                    >
                      <span className={`text-[15px] font-black num-3d ${myTurn && !st.drewThisTurn ? "text-yellow-300" : "text-white"}`}>{st.wall.length}</span>
                    </span>
                  </button>
                </div>

                {/* Masa ortası — İKİ AYRI YER (referans düzen):
                    SERİ: kademeli merdiven dizilimi · ÇİFT: dikey sütun. overflow-x-hidden → sağa sola taşmaz */}
                <div className="w-full max-w-[680px] flex gap-2 items-stretch">
                  {/* SERİ AÇMA YERİ — her grup yeni satırda, basamak basamak aşağı iner */}
                  <div className="flex-[2] min-w-0 max-h-[176px] overflow-y-auto overflow-x-hidden rounded-none border border-white/70 bg-white/[0.05] px-2 py-1">
                    <p className="text-[9px] uppercase tracking-wide font-bold text-center mb-1 text-yellow-300 whitespace-nowrap">SERİ AÇMA ALANI</p>
                    {laidAreas[0].rows.length === 0 ? (
                      <p className="text-[10px] text-white/60 text-center pb-1 leading-tight">Seri açılan yok — Seri Aç ile masaya yatır.</p>
                    ) : (
                      <div className="flex flex-col">
                        {laidAreas[0].rows.map(({ p, g, gi }, ri) => {
                          const canExtend = p.isUser && myTurn && st.drewThisTurn && selIds.length === 1 && (() => { const t = myHand.find((x) => x.id === selIds[0]); return t ? canExtendGroup(g, t) : false; })();
                          const clickable = p.isUser && myTurn && st.drewThisTurn;
                          // Merdiven: her grup bir öncekinden sağa + aşağı kayar (kademeli manuel dizilim)
                          const step = ri % 5;
                          return (
                            <div key={`${gi}-${p.name}-${ri}`} className="flex items-start" style={{ paddingLeft: step * 16, marginTop: ri > 0 ? -4 : 0 }}>
                              <span className={`shrink-0 w-[40px] text-[8px] font-bold leading-tight pt-1 pr-1 text-right ${p.isUser ? "text-yellow-300" : "text-white/75"}`}>{p.isUser ? "Sen" : p.name}</span>
                              <button type="button"
                                onClick={p.isUser ? () => extendGroup(gi) : undefined}
                                className={`flex flex-col items-center rounded p-0.5 -mt-1 ${canExtend ? "ring-2 ring-sky-400 animate-pulse cursor-pointer" : clickable ? "cursor-pointer hover:ring-1 hover:ring-white/40" : ""}`}
                                title={p.isUser ? "Seçili tek taşı bu gruba ekle (uzat)" : `${p.name} masaya açtı`}>
                                <div className="flex">{g.tiles.map((t) => (<OkeyTile key={t.id} tile={t} size="xs" />))}</div>
                                <ClusterTag kind={g.kind} />
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                  {/* ÇİFT AÇMA YERİ — dikey sütun, her grup alt alta */}
                  <div className="flex-1 min-w-0 max-h-[176px] overflow-y-auto overflow-x-hidden rounded-none border border-white/70 bg-white/[0.05] px-1.5 py-1">
                    <p className="text-[9px] uppercase tracking-wide font-bold text-center mb-1 text-yellow-300 whitespace-nowrap">ÇİFT AÇMA ALANI (PER)</p>
                    {laidAreas[1].rows.length === 0 ? (
                      <p className="text-[10px] text-white/60 text-center pb-1 leading-tight">Çift açılan yok — Çift Aç ile en az {PAIR_OPEN_MIN} çift masaya yatırılır.</p>
                    ) : (
                      <div className="flex flex-col gap-0.5">
                        {laidAreas[1].rows.map(({ p, g, gi }) => {
                          const canExtend = p.isUser && myTurn && st.drewThisTurn && selIds.length === 1 && (() => { const t = myHand.find((x) => x.id === selIds[0]); return t ? canExtendGroup(g, t) : false; })();
                          const clickable = p.isUser && myTurn && st.drewThisTurn;
                          return (
                            <button key={`${gi}-${p.name}`} type="button"
                              onClick={p.isUser ? () => extendGroup(gi) : undefined}
                              className={`flex flex-col items-center rounded p-0.5 ${canExtend ? "ring-2 ring-sky-400 animate-pulse cursor-pointer" : clickable ? "cursor-pointer hover:ring-1 hover:ring-white/40" : ""}`}
                              title={`${p.isUser ? "Sen" : p.name} — seçili taşı bu gruba ekle (uzat)`}>
                              <div className="flex flex-wrap justify-center max-w-full">{g.tiles.map((t) => (<OkeyTile key={t.id} tile={t} size="xs" />))}</div>
                              <ClusterTag kind={g.kind} />
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* İSTAKA satırı: Geri Diz etiketi | ahşap ıstaka | Geri Topla + Çift/Seri Diz */}
              <div className="mt-2 flex items-stretch gap-2">
                {/* Sol etiket taşındı: alt banttaki Geri Bırak kutusu */}

                {/* Orta: ahşap ıstaka */}
                <div className="flex-1 min-w-0">
                  {/* Araç çubuğu — kaydırırken hep görünür (menü dizilim butonları) */}
                  <div className="sticky top-0 z-20 bg-[#2450c4]/95 backdrop-blur-[1px] flex items-center justify-between mb-1 flex-wrap gap-1.5 px-0.5 py-0.5">
                    <span className="text-[11px] font-bold text-white">
                      {classic ? "El değeri" : "Ölü taş"}:{" "}
                      <b className={deadwoodValue(myHand) >= 40 ? "text-red-400" : "text-emerald-300"}>{deadwoodValue(myHand)}</b>
                      {!classic && myTurn && st.drewThisTurn && !st.players[0].opened && (layTotal >= openMin || pureLayPairs(myHand).length >= PAIR_OPEN_MIN) && (
                        <b className="ml-2 text-emerald-300 animate-pulse">✓ Açabilirsin!</b>
                      )}
                      {selIds.length > 1 && <b className="ml-2 text-sky-300">({selIds.length} seçili)</b>}
                    </span>
                    <div className="flex gap-1 flex-wrap">
                      {(["set", "sayi", "civit"] as const).map((m) => (
                        <button
                          key={m}
                          onClick={() => { setManualOrder(null); setSortMode(m); }}
                          className={`px-2 py-1 text-[11px] font-bold border ${!manualOrder && sortMode === m ? "bg-[#d4d0c8] text-black border-t border-l border-white border-b border-r border-[#404040]" : "bg-[#c8c4bc] text-black/70 border-t border-l border-[#dfdfdf] border-b border-r border-[#808080] hover:text-black"}`}
                        >
                          {m === "set" ? "Set Diz" : m === "sayi" ? "Sayı Diz" : "Çivit Diz"}
                        </button>
                      ))}
                      {manualOrder && (
                        <button onClick={() => setManualOrder(null)} className="px-2 py-1 text-[11px] font-bold bg-[#c8c4bc] text-black/70 border-t border-l border-[#dfdfdf] border-b border-r border-[#808080] hover:text-black">Otomatik Diz</button>
                      )}
                      {grups.length > 0 && (
                        <button onClick={() => setGrups([])} title="Elle oluşturulan tüm grupları çöz" className="px-2 py-1 text-[11px] font-bold bg-[#c8c4bc] text-black/70 border-t border-l border-[#dfdfdf] border-b border-r border-[#808080] hover:text-black">Grupları Sil</button>
                      )}
                      <button onClick={gruplaSecili} disabled={selIds.length < 2}
                        title="Seçili taşları ıstakada per / çift (küt) / seri olarak grupla"
                        className={`px-2.5 py-1 text-[11px] font-bold ${selIds.length >= 2 ? "bg-[#d4d0c8] text-black border-t border-l border-white border-b border-r border-[#404040]" : "bg-[#c0c0c0] text-black/40 border-t border-l border-[#dfdfdf] border-b border-r border-[#808080] cursor-not-allowed"}`}>
                        Grupla
                      </button>
                      {selIds.length === 1 && grups.some((g) => g.includes(selIds[0])) && (
                        <button onClick={() => { grupAyir(selIds[0]); setSelIds([]); }}
                          className="px-2.5 py-1 text-[11px] font-bold bg-[#c8c4bc] text-black/70 border-t border-l border-[#dfdfdf] border-b border-r border-[#808080] hover:text-black">
                          Grubu Ayır
                        </button>
                      )}
                      {!classic && (
                        <button onClick={laySelected} disabled={!myTurn || !st.drewThisTurn || selIds.length === 0}
                          className={`px-2.5 py-1 text-[11px] font-bold ${myTurn && st.drewThisTurn && selIds.length > 0 ? "bg-[#d4d0c8] text-black border-t border-l border-white border-b border-r border-[#404040]" : "bg-[#c0c0c0] text-black/40 border-t border-l border-[#dfdfdf] border-b border-r border-[#808080] cursor-not-allowed"}`}>
                          Seçileni Aç
                        </button>
                      )}
                      {classic ? (
                        <button onClick={finishHand} disabled={!myTurn || !finishCheck.ok || !st.drewThisTurn} title={finishCheck.reason}
                          className={`px-2.5 py-1 rounded text-[11px] font-bold ${myTurn && finishCheck.ok && st.drewThisTurn ? "bg-emerald-600 text-white" : "bg-black/40 text-white/30 cursor-not-allowed"}`}>
                          El Aç / Bitir
                        </button>
                      ) : (
                        <>
                          <button onClick={() => layClick("seri")} disabled={!myTurn || !st.drewThisTurn}
                            className={`px-2.5 py-1 text-[11px] font-bold ${myTurn && st.drewThisTurn ? "bg-[#d4d0c8] text-[#0a6b32] border-t border-l border-white border-b border-r border-[#404040]" : "bg-[#c0c0c0] text-black/40 border-t border-l border-[#dfdfdf] border-b border-r border-[#808080] cursor-not-allowed"}`}>
                            Seri Aç
                          </button>
                          <button onClick={() => layClick("per")} disabled={!myTurn || !st.drewThisTurn}
                            title={`Birebir aynı 2 taştan oluşan çiftler — en az ${PAIR_OPEN_MIN} çift, puan şartı yok`}
                            className={`px-2.5 py-1 text-[11px] font-bold ${myTurn && st.drewThisTurn ? "bg-[#d4d0c8] text-[#12315c] border-t border-l border-white border-b border-r border-[#404040]" : "bg-[#c0c0c0] text-black/40 border-t border-l border-[#dfdfdf] border-b border-r border-[#808080] cursor-not-allowed"}`}>
                            Çift Aç
                          </button>
                        </>
                      )}
                      <button onClick={discardSelected} disabled={!myTurn || !st.drewThisTurn || selIds.length === 0}
                        className={`px-2.5 py-1 text-[11px] font-bold ${myTurn && st.drewThisTurn && selIds.length > 0 ? "bg-[#d4d0c8] text-[#9b1010] border-t border-l border-white border-b border-r border-[#404040]" : "bg-[#c0c0c0] text-black/40 border-t border-l border-[#dfdfdf] border-b border-r border-[#808080] cursor-not-allowed"}`}>
                        Bırak
                      </button>
                    </div>
                  </div>

                  {/* (Açılan taşlar artık masa ortasında sıralı — göbek bölümünde) */}

                  {/* Ahşap ıstaka — İKİ KADEMELİ (iki raf), sürükle-bırak + ÇİFT TIKLA TAŞ AT */}
                  <div className="relative border-2 border-[#4a2e13] klasik-ahsap px-2 pt-1.5 pb-2 shadow-[inset_0_1px_0_rgba(255,255,255,.22),0_3px_8px_rgba(0,0,0,.55)]">
                    {tiers.map((tierList, ti) => (
                      <div key={ti}>
                        {ti > 0 && <div className="h-2 klasik-oluk my-1" />}
                        <div className="relative z-10 flex items-end justify-center overflow-x-auto min-h-[4.75rem]">
                          {tierList.map((cl, ci) => (
                            <div key={ci} className={`flex flex-col items-center shrink-0 ${ci > 0 ? "ml-2" : ""}`}>
                              <div className="flex items-end">
                                {cl.tiles.map((t) => (
                                  <div key={t.id} className="flex items-end shrink-0">
                                    {dragId && dropTarget?.id === t.id && dropTarget.side === "before" && <DropGap />}
                                    <div data-tile-w={t.id}
                                      onPointerDown={(e) => {
                                        if (e.pointerType === "mouse" && e.button !== 0) return;
                                        suppressClickRef.current = false; // eski yutma bayrağı temizlensin
                                        pressRef.current = { id: t.id, x: e.clientX, y: e.clientY };
                                        try { e.currentTarget.setPointerCapture(e.pointerId); } catch { /* yoksay */ }
                                        // Basılı tut (hareketsiz ~½ sn) → taşı SEÇ — mobilde tek parmakla hızlı seçim
                                        if (longPressRef.current) window.clearTimeout(longPressRef.current);
                                        longPressRef.current = window.setTimeout(() => {
                                          if (pressRef.current?.id !== t.id) return;
                                          pressRef.current.long = true;
                                          toggleSelect(t.id);
                                        }, 450);
                                      }}
                                      onPointerMove={(e) => {
                                        const pr = pressRef.current;
                                        if (!pr || pr.id !== t.id) return;
                                        if (!dragId) {
                                          // Basılı tutup biraz kaydırınca sürükleme başlar (tık = seçimi bozmaz)
                                          if (Math.abs(e.clientX - pr.x) + Math.abs(e.clientY - pr.y) < 8) return;
                                          if (longPressRef.current) { window.clearTimeout(longPressRef.current); longPressRef.current = null; }
                                          setDragId(t.id);
                                          setDropTarget({ id: t.id, side: "self" });
                                        }
                                        const wraps = Array.from(document.querySelectorAll<HTMLElement>("[data-tile-w]"));
                                        let target: { id: string; side: "before" | "after" } | null = null;
                                        for (const w of wraps) {
                                          const id = w.dataset.tileW;
                                          if (!id || id === t.id) continue;
                                          const r = w.getBoundingClientRect();
                                          if (e.clientX >= r.left - 2 && e.clientX <= r.right + 2 && e.clientY >= r.top - 8 && e.clientY <= r.bottom + 8) {
                                            target = { id, side: e.clientX < r.left + r.width / 2 ? "before" : "after" };
                                            break;
                                          }
                                        }
                                        setDropTarget(target); // null = en sona bırak
                                      }}
                                      onPointerUp={() => {
                                        if (longPressRef.current) { window.clearTimeout(longPressRef.current); longPressRef.current = null; }
                                        if (pressRef.current?.id === t.id) {
                                          suppressClickRef.current = true; // click olayı bu bayrağı görüp kendini yutar (zamanlayıcı YOK — setTimeout click'ten önce sıfırlayıp seçimi iki kez değiştiriyordu)
                                          if (dragId) {
                                            applyDrop();
                                          } else if (!pressRef.current.long) {
                                            // KISA DOKUNMA (tık) → taşı seç / kaldır.
                                            // pointer capture yüzünden click olayı tuşa değil sarmalayıcıya
                                            // düşer — seçim burada yapılmazsa Bırak butonu hep pasif kalırdı.
                                            toggleSelect(t.id);
                                          }
                                          pressRef.current = null;
                                          setDragId(null);
                                          setDropTarget(null);
                                        }
                                      }}
                                      onPointerCancel={() => {
                                        if (longPressRef.current) { window.clearTimeout(longPressRef.current); longPressRef.current = null; }
                                        pressRef.current = null; setDragId(null); setDropTarget(null);
                                      }}
                                      onDoubleClick={() => {
                                        // ÇİFT TIK → istakadaki bu taş doğrudan masaya atılır (kullanıcı isteği)
                                        if (longPressRef.current) { window.clearTimeout(longPressRef.current); longPressRef.current = null; }
                                        if (pressRef.current) pressRef.current = null;
                                        setDragId(null);
                                        setDropTarget(null);
                                        discardTileById(t.id);
                                      }}
                                      onClick={(e) => {
                                        // pointerup'ta zaten seçildiyse bu click'i yut (çift seçim olmasın);
                                        // klavye/erişilebilirlik tıklamasıysa seç
                                        if (suppressClickRef.current) { suppressClickRef.current = false; e.stopPropagation(); return; }
                                        toggleSelect(t.id);
                                      }}
                                      onContextMenu={(e) => { e.preventDefault(); toggleRotate(t.id); }}
                                      style={{ touchAction: "none" }}
                                      className={`shrink-0 ${dragId === t.id ? "opacity-40 scale-95" : ""} ${dropTarget?.id === t.id && dropTarget.side === "self" && dragId !== t.id ? "outline outline-2 outline-yellow-400 rounded" : ""}`}
                                      title="Tıkla: seç · Sürükle: yer değiştir · ÇİFT TIK: taşı at · Sağ tık: çevir">
                                      <OkeyTile tile={t} size="xl" selected={selIds.includes(t.id)} rotated={rotatedIds.includes(t.id)}
                                        onClick={() => { /* seçim pointerup/onClick'de sarmalayıcıda yapılıyor */ }} />
                                    </div>
                                    {dragId && dropTarget?.id === t.id && dropTarget.side === "after" && <DropGap />}
                                  </div>
                                ))}
                              </div>
                              {cl.kind !== "serbest" && (
                                <><span className={`h-[3px] w-full rounded-full mt-0.5 ${clusterBarClass(cl.kind)}`} /><ClusterTag kind={cl.kind} /></>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                    <div className="h-1.5 rounded bg-black/60 shadow-[inset_0_2px_4px_rgba(0,0,0,.7)] mx-1 mt-1" />
                  </div>
                </div>

                {/* Sağ: Çift Diz / Seri Diz (Geri Topla yukarı alındı) */}
                <div className="w-[104px] shrink-0 flex flex-col gap-1 items-stretch">
                  {/* Çift Diz / Seri Diz (sarı bağlantılar — referans) */}
                  <div className="flex flex-col items-end gap-0.5 mt-auto">
                    <button onClick={() => { setManualOrder(null); setSortMode("sayi"); }} className={`text-[12px] font-bold leading-tight ${!manualOrder && sortMode === "sayi" ? "text-white" : "text-yellow-300"} hover:text-white hover:underline`}>Çift Diz</button>
                    <button onClick={() => { setManualOrder(null); setSortMode("set"); }} className={`text-[12px] font-bold leading-tight ${!manualOrder && sortMode === "set" ? "text-white" : "text-yellow-300"} hover:text-white hover:underline`}>Seri Diz</button>
                    <span className="text-[10px] text-white font-bold mt-0.5">{deadwoodValue(myHand)}+{selIds.length}ç</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Sağ menü şeridi (referans: aynı mavi zemin + sarı menü yazıları) */}
          <div className="w-28 shrink-0 okey-mavi border-l-2 border-[#1e40a8] flex flex-col items-center py-2 gap-0.5 text-yellow-300 text-[13px] font-bold select-none">
            {/* Logo / salon amblemi (referans: üstte salon resmi) */}
            <div className="mb-1 w-full px-1 text-center border-b border-white/25 pb-1">
              <p className="text-[7px] text-white mb-0.5 font-bold">www.hasokey.com.tr</p>
              <img src="icon-512.png" alt="Has Okey" className="w-full h-14 object-cover border border-white/60 shadow-pop" />
              <div className="flex flex-col items-center leading-none mt-1">
                <span className="text-[10px]">👑</span>
                <span className="hk-logo-text text-[12px] mt-0.5">Has Okey</span>
              </div>
              <p className="text-[7px] text-white mt-1 leading-tight font-bold">
                ONLINE 101 OKEY OYUN SALONU
              </p>
            </div>
            {([
              ["Başlat", () => { if (!isTableOwner) { showToast(`Bu masayı ${tableOwner ?? "başkası"} kurdu — eli yalnız o başlatabilir.`); return; } newRoundClick(); aiSay("Yeni el başlıyor — bol şans!"); }],
              ["Devam", () => { if (!isTableOwner) { showToast(`Eli yalnız masa sahibi (${tableOwner ?? "—"}) başlatır.`); return; } if (st.roundOver) { newRoundClick(); aiSay("Yeni el başlıyor — bol şans!"); } else showToast("El sürüyor — sıranızı bekleyin."); }],
              ["Davet", () => { void (async () => { const nick = await klasikPrompt("Davet edilecek üye nick'i:"); if (!nick || !nick.trim()) return; aiSay(`${me?.nick ?? "Sen"} seni masaya davet etti — hadi katıl!`); showToast(`${nick.trim()} masaya davet edildi.`); })(); }],
              ["Mola", () => setMola((v) => { const nv = !v; aiSay(nv ? "⏸ Mola ilan edildi." : "▶ Mola bitti, oyun devam."); return nv; })],
              ["Renk", () => { setRenkIdx((i) => (i + 1) % MASA_TINT.length); showToast("Masa rengi değiştirildi."); }],
              ["Resim", () => { setResimIdx((i) => (i + 1) % MASA_RESIM.length); showToast("Masa amblemi değiştirildi."); }],
              ["Yardım", () => setYardimAcik((v) => !v)],
            ] as [string, () => void][]).map(([label, fn]) => (
              <button key={label} onClick={fn} className="hover:text-white hover:underline py-0.5 w-full text-center">{label}</button>
            ))}
            {mola && <p className="mt-1 text-[9px] text-red-400 text-center">⏸ Mola</p>}
          </div>
        </div>

        {/* ALT ŞERİT: Masa Ayarları · Sohbet · Nick|Puan · Aksiyonlar */}
        <div className="flex border-t-2 border-[#1e40a8] bg-[#2450c4] text-[11px]">
          {/* Masa Ayarları (referans liste) */}
          <div className="w-40 shrink-0 okey-mavi border-r border-white/50 text-white p-2 leading-snug">
            <p className="font-bold text-yellow-300 mb-1">Masa Ayarları</p>
            <p>{modeLabel}</p>
            <p>Herkes Kendine{esli ? " · Eşli" : ""}</p>
            <p>Cezalı Oyun{artirmali ? " · Artırmalı" : ""}</p>
            <p>{elSayisi} El{carpani > 1 ? ` x${carpani}` : ""}</p>
            <p>{Math.min(st.rounds + (st.roundOver ? 0 : 1), elSayisi)}. El</p>
            <p className="flex items-center justify-between gap-1">
              <span>Ceza: -</span>
              <button
                onClick={() => { setSesAcik((v) => !v); showToast(sesAcik ? "Ses kapatıldı." : "Ses açıldı."); }}
                title="Ses aç / kapat"
                className="text-[13px] leading-none hover:scale-110"
              >{sesAcik ? "🔊" : "🔇"}</button>
            </p>
            <button
              onClick={() => setMesajKapali((v) => !v)}
              className="mt-0.5 w-full text-left font-bold text-yellow-300 hover:text-white hover:underline"
            >{mesajKapali ? "Mesaj Aç" : "Mesaj Kapat"}</button>
            <p className="mt-1 text-white/70 text-[10px]">Okey: <span className="text-yellow-300">{okeyTileDesc}</span></p>
          </div>

          {/* Sohbet */}
          <div className="flex-1 min-w-0 flex flex-col border-r border-[#808080]">
            <div className="flex items-center justify-between px-2 py-0.5 bg-[#d4d0c8] border-b border-[#808080] shrink-0">
              <span className="text-[11px] font-bold text-[#0a246a] underline">Masaya Hoş Geldiniz</span>
              <span className="flex items-center gap-1.5 text-[10px] text-black select-none">— □ ×</span>
            </div>
            {mesajKapali ? (
              <div className="h-[96px] flex items-center justify-center text-[11px] text-black/60 bg-white/80">
                Mesajlar kapalı — "Mesaj Aç" ile geri getir.
              </div>
            ) : (
              <div ref={chatBoxRef} className="vk-chat-bg h-[96px] overflow-y-auto space-y-0.5 px-2 py-1">
                {chat.map((m) => (
                  <p key={m.id} className={`text-[11px] leading-snug ${m.ai ? "text-[#c00000] font-bold" : "text-black"}`}>
                    {m.ai ? `${m.who === "Masa" ? "Sistem: " : ""}${m.text}` : `${m.who}: ${m.text}`}
                  </p>
                ))}
              </div>
            )}
            <div className="flex gap-1 p-1 bg-[#d4d0c8]">
              <input value={chatInput} onChange={(e) => setChatInput(e.target.value)} onKeyDown={(e) => e.key === "Enter" && sendChat()} placeholder="Masaya yaz…" maxLength={120}
                className="flex-1 min-w-0 px-2 py-1 bg-white border border-[#808080] text-black text-[11px] focus:outline-none" />
              <button onClick={() => setChatInput((v) => (v + "🙂").slice(0, 120))} title="Emoji ekle" className="px-2 py-1 text-[14px] leading-none bg-[#f4c542] border border-[#404040] shrink-0">🙂</button>
              <button onClick={sendChat} className="px-3 py-1 text-[11px] font-bold text-black bg-[#d4d0c8] border border-[#404040] shrink-0">Gönder</button>
            </div>
          </div>

          {/* Nick | Puan */}
          <div className="w-44 shrink-0 bg-white border-r border-[#808080] flex flex-col">
            <div className="flex items-center justify-between px-2 py-0.5 bg-[#12315c] text-white font-bold text-[10px]"><span>Nick</span><span>Puan</span></div>
            <div className="flex-1 overflow-y-auto">
              {st.players.map((p, i) => (
                <div key={p.name} className={`flex items-center justify-between px-2 py-0.5 text-[11px] border-b border-[#eee] ${st.turn === i && !st.roundOver ? "bg-[#12315c] text-white font-bold" : "text-black"}`}>
                  <span className="flex items-center gap-1 min-w-0"><span className="w-3.5 h-3.5 shrink-0 bg-[#e8e8e8] border border-[#a0a0a0] text-[8px] flex items-center justify-center">👤</span><span className="truncate">{p.name}{p.isUser ? " (Sen)" : ""}</span></span>
                  <span className="tabular-nums shrink-0">{st.scores[i]}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Aksiyon butonları (referans: mavi zemin, onay kutulu Oto Pilot, sarı Masadan Çık) */}
          <div className="w-28 shrink-0 okey-mavi border-l border-white/40 flex flex-col gap-2 p-2 text-[11px] font-bold text-white">
            <button
              onClick={() => {
                setOtoPilot((v) => {
                  const nv = !v;
                  aiSay(nv ? "🤖 Oto Pilot açıldı — sıran gelince kendim oynarım." : "Oto Pilot kapatıldı — sıran sende, manuel oyna.");
                  return nv;
                });
              }}
              className="flex items-center gap-1.5 py-0.5 text-left"
              title="Aktif edersen sıran geldiğinde elini otomatik oynar"
            >
              <span className={`w-4 h-4 border border-white bg-white/90 flex items-center justify-center leading-none shrink-0 ${otoPilot ? "text-green-600" : "text-transparent"}`}>✓</span>
              Oto Pilot
            </button>
            <button onClick={() => showToast("Resmi maça giriş yakında aktif olacak.")} className="py-0.5 text-left hover:underline">Resmi Gizle</button>
            <button onClick={() => void masadanCik(() => go({ name: "salon", game: mode }))} className="mt-auto pt-1 text-left text-yellow-300 hover:text-white">Masadan Çık</button>
          </div>
        </div>

        {/* El sonucu katmanı */}
        {st.roundOver && !sonucGizli && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
            <div className="bg-[#d4d0c8] border-4 border-[#8b5a2b] rounded shadow-pop p-5 max-w-md w-full animate-floatUp max-h-[85vh] overflow-y-auto">
              <h3 className="text-xl font-bold text-black mb-1">
                {st.roundOver.winner < 0 ? "El Berabere" : st.roundOver.matchOver ? "Maç Bitti" : "El Bitti"}
              </h3>
              {st.roundOver.winner < 0 ? (
                <p className="text-sm text-black/80 mb-3">Ortadaki taşlar bitti, kimse elini açamadı — puan yazmadı.</p>
              ) : (
                <>
                  <p className="text-sm text-black mb-2">
                    🏆 <b>{st.players[st.roundOver.winner].name}</b> kazandı
                    {classic ? " — eli açtı (Okey)!" : st.roundOver.finished ? " — elini açtı!" : " (en az ölü taş)"}
                  </p>
                  {/* El sonu sıralama tablosu: 1. en çok puan · 2. yarısı · 3. -3 · 4. -7 */}
                  <table className="w-full text-sm mb-2 border border-[#808080]">
                    <thead>
                      <tr className="bg-[#12315c] text-white text-xs">
                        <th className="px-2 py-1 text-left">Sıra</th>
                        <th className="px-2 py-1 text-left">Oyuncu</th>
                        <th className="px-2 py-1 text-right">Puan</th>
                        <th className="px-2 py-1 text-right">Toplam</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(st.roundOver.ranking ?? []).map((r, rank) => (
                        <tr key={st.players[r.idx].name} className={`border-t border-[#c0c0c0] ${r.idx === 0 ? "bg-[#e8f0fc] font-bold" : ""}`}>
                          <td className="px-2 py-0.5">{rank + 1}.</td>
                          <td className="px-2 py-0.5 truncate">{st.players[r.idx].name}{st.players[r.idx].isUser ? " (Sen)" : ""}</td>
                          <td className={`px-2 py-0.5 text-right font-bold ${r.gain >= 0 ? "text-[#007a3d]" : "text-[#cc0000]"}`}>
                            {r.gain >= 0 ? `+${r.gain}` : r.gain}
                          </td>
                          <td className="px-2 py-0.5 text-right tabular-nums">{st.scores[r.idx]}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <p className="text-[10px] text-black/60 mb-3">Sıralama: 1. kazancı alır · 2. yarısını alır · 3. −3 · 4. −7 puan</p>
                  {classic && st.roundOver.finished && (
                    <div className="mb-3 p-2 rounded bg-[#33589e] border border-[#8b5a2b]">
                      <p className="text-[10px] uppercase tracking-wide text-yellow-300 font-bold mb-1">Açılan el</p>
                      {arrangeClusters(st.players[st.roundOver.winner].hand, true).map((cl, ci) => (
                        <div key={ci} className="flex items-center mb-0.5"><span className="w-12 shrink-0 flex justify-center"><ClusterTag kind={cl.kind} /></span><div className="flex">{cl.tiles.map((t) => (<OkeyTile key={t.id} tile={t} size="sm" />))}</div></div>
                      ))}
                    </div>
                  )}
                  <div className="text-xs text-black/60 mb-3">
                    {st.roundOver.matchOver
                      ? `Maçın şampiyonu: ${st.players[st.scores.indexOf(Math.max(...st.scores))].name} (${Math.max(...st.scores)} puan)`
                      : classic
                      ? "Kazanan, diğerlerinin eldeki taşları kadar çipi toplar."
                      : `${elSayisi} el sonunda en çok puan kazanan şampiyon olur.`}
                  </div>
                </>
              )}
              <div className="flex gap-2">
                <button onClick={() => setSonucGizli(true)}
                  className="flex-1 py-2 rounded font-bold bg-[#d4d0c8] border border-[#404040] text-black hover:bg-white">
                  Masaya Dön
                </button>
                <button onClick={newRoundClick} disabled={!isTableOwner}
                  title={isTableOwner ? (st.roundOver.matchOver ? "Skorları sıfırlayıp yeni maç aç" : "Sıradaki eli başlat") : "Eli yalnız masa sahibi başlatır"}
                  className={`flex-[2] py-2 rounded font-bold transition-colors ${!isTableOwner ? "bg-[#a0a0a0] text-white/50 cursor-not-allowed" : "bg-yellow-500 hover:bg-yellow-400 text-black"}`}>
                  {!isTableOwner ? `Sahibi: ${tableOwner ?? "—"}` : st.roundOver.matchOver ? "Yeni Maç 🏁" : classic ? "Yeni El (Okey)" : "Yeni El"}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Kurallar katmanı (Yardım) */}
        {yardimAcik && !st.roundOver && (
          <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/50 p-4" onClick={() => setYardimAcik(false)}>
            <div className="bg-[#d4d0c8] border-4 border-[#8b5a2b] rounded shadow-pop p-4 text-[12px] text-black leading-relaxed max-w-lg w-full max-h-[80vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center justify-between mb-2">
                <p className="font-bold text-[#0a246a] uppercase tracking-wider">{modeLabel} Kuralları</p>
                <button onClick={() => setYardimAcik(false)} className="px-2 bg-[#d4d0c8] border border-[#404040] font-bold">×</button>
              </div>
              {classic ? (
                <ul className="space-y-1.5 list-disc list-inside">
                  <li>Deste <b>106 taş</b>: 1-13 × 4 renk × 2 = 104 + numarasız <b>2 sahte okey</b>.</li>
                  <li>Gösterge taşın bir üstü <b>okey</b> olur (13'ün okeyi 1'dir) — köşesinde kırmızı nokta.</li>
                  <li>Her oyuncuya <b>14 taş</b>; sırayla ortadan çekilir ya da yerdeki son taş alınır, bir taş bırakılır.</li>
                  <li>Bitirmek için: <b>4 set</b> (seri/küt) <b>+ 1 per</b> (çift).</li>
                  <li>Okey taşı ve sahte okey jokerdir (20 puan sayılır).</li>
                  <li>Açamayanlar eldeki taş kadar ceza öder; kazanan tüm çipleri toplar.</li>
                </ul>
              ) : (
                <ul className="space-y-1.5 list-disc list-inside">
                  <li>Her oyuncuya <b>21 taş</b>; oyuna ilk başlayana (el atan) <b>22 taş</b> ve ilk hamlede taş bırakır. Ortada 20 taş.</li>
                  <li>Sıra sende: ortadan taş çek ya da yerdeki son taşı al (Geri Al), bir taş bırak. <b>Yerden aldığın taşı o tur atamazsın.</b></li>
                  <li><b>Seri Aç</b>: seri (aynı renkten artan sayılar) + küt (aynı sayı, farklı renkler) gruplarının <b>toplamı en az {openMin} sayı</b> olduğunda (joker dahil) masaya yatır.</li>
                  <li><b>Çift Aç (Per)</b>: birebir aynı 2 taş (örn. iki adet 5 Kırmızı) = 1 çift. <b>En az {PAIR_OPEN_MIN} çift</b> olduğunda puan şartı olmadan açılır.</li>
                  <li><b>Grup uzatma</b>: açtıktan sonra elindeki bir taşı, masadaki grubun yanına <b>tıklayarak</b> ekleyebilirsin.</li>
                  <li><b>Elle dizilim & gruplama</b>: ıstakada taşı <b>basılı tutup sürükley</b> istediğin yere koyabilirsin; seçili 2+ taşla <b>Grupla</b> deyince <b>per (birebir çift) / küt / seri</b> grubu oluşur — gruba tıklayıp <b>Grubu Ayır</b> ile çözersin.</li>
                  <li>Seri: aynı renkte artan sayılar (3+). Küt: aynı sayı, farklı renkler (3-4).</li>
                  <li>Bütün taşlarını açıp elini boşaltan kazanır. Masaya hiç açmayan 2x ceza yazar. <b>{elSayisi} el sonunda en çok puan toplayan şampiyon olur.</b></li>
                </ul>
              )}
            </div>
          </div>
        )}
      </div>
    </AutoFit>
  );
}

function EdgeSeat({ p, active, score, edge, laid }: { p: Player; active: boolean; score: number; edge: "top" | "left" | "right"; laid: { kind: "seri" | "küt" | "per"; tiles: Tile[] }[] }) {
  // Referans düzen: üstte yatay isim plakası; yanlarda dikey ahşap raf + dikey isim plakası
  if (edge === "top") {
    return (
      <div className="absolute top-1 right-[46px] z-10 flex flex-col items-end">
        <div className={`flex items-center gap-1.5 px-2 py-0.5 border border-black shadow-pop ${active ? "bg-white ring-2 ring-yellow-300" : "bg-white"}`}>
          <span className="w-4 h-4 rounded-sm bg-[#c9a24b] border border-[#8a7a3a] text-black text-[9px] flex items-center justify-center font-bold">{p.name[0]}</span>
          <span className="text-black font-bold text-[12px] max-w-[140px] truncate">{p.name}</span>
          <span className="text-[#12315c] text-[10px] font-bold">{score}</span>
        </div>
        <span className={`text-[9px] font-bold mt-0.5 px-1 ${p.opened ? "text-emerald-300" : "text-white"}`}>{p.opened ? "Açtı" : "Açmadı"}</span>
        {/* Açtığı taşlar (altında ortalanmış) */}
        {laid.length > 0 && (
          <div className="mt-0.5 max-w-[300px] overflow-hidden">
            <div className="flex flex-wrap justify-center">
              {laid.flatMap((g) => g.tiles).slice(0, 10).map((t) => (
                <OkeyTile key={t.id} tile={t} size="xs" />
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }
  const isLeft = edge === "left";
  return (
    <div className={`absolute ${isLeft ? "left-[38px]" : "right-[38px]"} top-[74px] z-10 flex ${isLeft ? "" : "flex-row-reverse"} items-start gap-1`}>
      {/* Dikey ahşap raf + taş sırtları (referans) */}
      <div className={`relative klasik-ahsap border border-[#4a2e13] px-1 py-1 rounded-sm ${active ? "ring-2 ring-yellow-300" : ""}`}>
        <div className="flex flex-col items-center">
          {p.hand.slice(0, 12).map((t, i) => (
            <div key={t.id} className={i > 0 ? "-mt-6" : ""}>
              <OkeyTileBack size="sm" />
            </div>
          ))}
        </div>
        <div className="absolute -top-2 -right-2 min-w-[24px] px-1 py-0.5 bg-[#f7f0cf] border border-[#8a7a3a] shadow-pop text-center leading-none">
          <span className="text-[12px] font-bold text-black">{p.hand.length}</span>
        </div>
      </div>
      {/* Dikey isim plakası (referans: yanlarda dikey yazı) */}
      <div className="flex flex-col items-center gap-0.5">
        <div className={`px-1 py-1.5 border border-white/60 shadow-pop ${active ? "bg-[#2a4d96] ring-2 ring-yellow-300" : "bg-[#3a5cae]"}`}>
          <span className="text-yellow-300 font-bold text-[11px] [writing-mode:vertical-rl] rotate-180 max-h-[90px] overflow-hidden text-ellipsis whitespace-nowrap block">{p.name}</span>
        </div>
        <span className="w-4 h-4 rounded-sm bg-[#c9a24b] border border-[#8a7a3a] text-black text-[9px] flex items-center justify-center font-bold">{p.name[0]}</span>
        <span className="text-white text-[10px] font-bold">{score}</span>
        {/* yan durum rafta (Açmadı/Açtı) — tekrar yok */}
      </div>
      {/* Açtığı taşlar (dikey rafta altında) */}
      {laid.length > 0 && (
        <div className="mt-2 max-w-[50px] overflow-hidden">
          <div className="flex flex-col items-center">
            {laid.flatMap((g) => g.tiles).slice(0, 8).map((t) => (
              <OkeyTile key={t.id} tile={t} size="xs" />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
