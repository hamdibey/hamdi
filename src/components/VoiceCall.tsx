// ---------------------------------------------------------------------------
// 🔊 SESLİ GÖRÜŞME (WebRTC) — profilden başlatılır, klasik pencereyle yönetilir.
// Sinyalleme backend'deki voice_signals tablosu üzerinden yürür (NDJSON akış);
// ses doğrudan tarayıcılar arası (P2P) akar — sunucudan geçmez.
// ---------------------------------------------------------------------------
import { useEffect, useRef, useState } from "react";
import { create } from "zustand";
import { useApp } from "../store/useApp";
import { api, getToken, openVoiceStream } from "../lib/api";
import type { ApiVoiceSignal } from "../lib/api";
import { ayarlariYukle, ayarlariKaydet, ZIL_TURLERI } from "../lib/ayarlar";
import type { ZilTuru } from "../lib/ayarlar";

// ── Durum mağazası (arayüz + motor ortak) ──────────────────────
type VoiceStatus = "idle" | "calling" | "incoming" | "active";

interface VoiceState {
  status: VoiceStatus;
  peer: string | null;
  muted: boolean;
  seconds: number;
}

export const useVoiceStore = create<VoiceState>(() => ({
  status: "idle",
  peer: null,
  muted: false,
  seconds: 0,
}));

// ── Modül seviyesi WebRTC kaynakları ───────────────────────────
let peerPc: RTCPeerConnection | null = null;
let localStream: MediaStream | null = null;
let peerNick: string | null = null;
let incomingSdp = "";
let callTimeout = 0;
let incomingTimeout = 0;

const ICE_SERVERS: RTCIceServer[] = [
  { urls: ["stun:stun.l.google.com:19302", "stun:stun1.l.google.com:19302"] },
];

const remoteAudio: HTMLAudioElement | null =
  typeof Audio !== "undefined" ? new Audio() : null;
if (remoteAudio) remoteAudio.autoplay = true;

// ── Zil sesleri (WebAudio — dosya indirmeden üretilir) ────────
// Her zil türü bir "nota kalıbı": [frekans, başlangıç(sn), süre(sn), vol, dalga tipi]
// Kalıp bittiğinde baştan çalınır (aralarda sessizlik).
type ZilNota = [number, number, number, number?, OscillatorType?];
interface ZilKalip {
  toplam: number; // kalıp süresi (sn) — döngü aralığı
  notlar: ZilNota[];
}

/** Hızlı iki tonlu çınlama (eski telefon zili trilli) */
function trill(f1: number, f2: number, start: number, dur: number, vol = 0.085): ZilNota[] {
  const notes: ZilNota[] = [];
  let t = start;
  let i = 0;
  while (t < start + dur) {
    notes.push([i % 2 === 0 ? f1 : f2, t - start, 0.06, vol, "sine"]);
    t += 0.05;
    i++;
  }
  return notes;
}

const ZIL_KALIPLARI: Record<Exclude<ZilTuru, "sessiz">, ZilKalip> = {
  // 🔔 Klasik: "çın-çın… bekleme" — iki tonlu trill iki kez
  klasik: {
    toplam: 2.4,
    notlar: [
      ...trill(470, 525, 0, 0.55),
      ...trill(470, 525, 0.75, 0.55),
    ],
  },
  // 🎵 Melodi: do-mi-sol-do… yumuşak arpej
  melodi: {
    toplam: 1.9,
    notlar: [
      [523, 0.0, 0.22, 0.09, "triangle"],
      [659, 0.2, 0.22, 0.09, "triangle"],
      [784, 0.4, 0.22, 0.09, "triangle"],
      [1047, 0.6, 0.4, 0.1, "triangle"],
      [784, 1.05, 0.22, 0.08, "triangle"],
      [659, 1.25, 0.4, 0.08, "triangle"],
    ],
  },
  // 🌙 Ninni: yavaş, alçak, yumuşak uyku melodisi
  ninni: {
    toplam: 3.6,
    notlar: [
      [392, 0.0, 0.6, 0.055, "sine"],
      [330, 0.65, 0.6, 0.055, "sine"],
      [262, 1.3, 0.9, 0.06, "sine"],
      [330, 2.3, 0.5, 0.05, "sine"],
      [392, 2.85, 0.6, 0.05, "sine"],
    ],
  },
  // 📱 Cep: hızlı ikili bip — modern telefon uyarısı
  cep: {
    toplam: 1.25,
    notlar: [
      [1319, 0.0, 0.1, 0.075, "triangle"],
      [1319, 0.16, 0.1, 0.075, "triangle"],
      [1047, 0.32, 0.12, 0.07, "triangle"],
      [1319, 0.6, 0.1, 0.075, "triangle"],
      [1319, 0.76, 0.1, 0.075, "triangle"],
      [1047, 0.92, 0.14, 0.07, "triangle"],
    ],
  },
};

let ringCtx: AudioContext | null = null;
let ringTimer = 0;

function audioCtx(): AudioContext | null {
  try {
    const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    return Ctx ? new Ctx() : null;
  } catch {
    return null;
  }
}

/** Bir kalıbı verilen zamandan itibaren kuyruğa al */
function calKalip(ctx: AudioContext, kalip: ZilKalip, base: number) {
  for (const [freq, start, dur, vol = 0.08, type = "sine"] of kalip.notlar) {
    try {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = type;
      o.frequency.value = freq;
      const t0 = base + start;
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.exponentialRampToValueAtTime(vol, t0 + 0.02);
      g.gain.setValueAtTime(vol, t0 + dur - 0.03);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      o.connect(g);
      g.connect(ctx.destination);
      o.start(t0);
      o.stop(t0 + dur + 0.05);
    } catch {
      /* yok say */
    }
  }
}

/** Seçili zil sesini kesintisiz çal (gelen arama süresince) */
function startRingtone() {
  stopRingtone();
  const tur = ayarlariYukle().zil;
  if (tur === "sessiz") return;
  const kalip = ZIL_KALIPLARI[tur];
  ringCtx = audioCtx();
  if (!ringCtx) return;
  const ctx = ringCtx;
  const cycle = () => calKalip(ctx, kalip, ctx.currentTime + 0.05);
  cycle();
  // Kalıp + kısa nefes aralığı kadar tekrar
  ringTimer = window.setInterval(cycle, (kalip.toplam + 0.3) * 1000);
}

/** Seçili zil sesini bir kez çal — Ayarlar penceresindeki "Dinle" butonu */
export function zilOnizle() {
  const tur = ayarlariYukle().zil;
  if (tur === "sessiz") return;
  const kalip = ZIL_KALIPLARI[tur];
  const ctx = audioCtx();
  if (!ctx) return;
  calKalip(ctx, kalip, ctx.currentTime + 0.05);
  // Kalıp bitince context'i kapat (artık titreşim kalmasın)
  window.setTimeout(() => void ctx.close().catch(() => {}), (kalip.toplam + 0.4) * 1000);
}

function stopRingtone() {
  if (ringTimer) {
    window.clearInterval(ringTimer);
    ringTimer = 0;
  }
  if (ringCtx) {
    void ringCtx.close().catch(() => {});
    ringCtx = null;
  }
}

// ICE toplanmasını bekle (non-trickle — adaylar SDP'nin içine gömülür,
// böylece sinyal kanalında ayrı "candidate" mesajı taşımak gerekmez)
function waitIce(pc: RTCPeerConnection): Promise<void> {
  if (pc.iceGatheringState === "complete") return Promise.resolve();
  return new Promise((resolve) => {
    const t = window.setTimeout(resolve, 2500);
    const done = () => {
      if (pc.iceGatheringState === "complete") {
        window.clearTimeout(t);
        pc.removeEventListener("icegatheringstatechange", done);
        resolve();
      }
    };
    pc.addEventListener("icegatheringstatechange", done);
  });
}

function attachRemoteAudio(pc: RTCPeerConnection) {
  pc.ontrack = (e) => {
    if (remoteAudio) {
      remoteAudio.srcObject = e.streams[0];
      void remoteAudio.play().catch(() => {});
    }
  };
  pc.onconnectionstatechange = () => {
    if (pc.connectionState === "failed") {
      const who = peerNick;
      cleanup(true);
      useApp.getState().showToast(`${who ?? "Karşı taraf"} ile bağlantı koptu.`);
    }
  };
}

function cleanup(reset: boolean) {
  if (callTimeout) {
    window.clearTimeout(callTimeout);
    callTimeout = 0;
  }
  if (incomingTimeout) {
    window.clearTimeout(incomingTimeout);
    incomingTimeout = 0;
  }
  stopRingtone();
  try {
    peerPc?.close();
  } catch {
    /* yok say */
  }
  peerPc = null;
  try {
    localStream?.getTracks().forEach((t) => t.stop());
  } catch {
    /* yok say */
  }
  localStream = null;
  peerNick = null;
  incomingSdp = "";
  if (remoteAudio) remoteAudio.srcObject = null;
  if (reset) useVoiceStore.setState({ status: "idle", peer: null, muted: false, seconds: 0 });
}

async function getMic(): Promise<MediaStream | null> {
  if (!navigator.mediaDevices?.getUserMedia) {
    useApp.getState().showToast("Tarayıcınız sesli görüşmeyi desteklemiyor.");
    return null;
  }
  try {
    return await navigator.mediaDevices.getUserMedia({ audio: true });
  } catch {
    useApp.getState().showToast("Mikrofon izni verilmedi — tarayıcı ayarlarından izin verin.");
    return null;
  }
}

/** Profilden sesli görüşme başlat */
export async function startVoiceCall(nick: string) {
  const st = useVoiceStore.getState();
  if (st.status !== "idle") {
    useApp.getState().showToast("Zaten bir görüşme var.");
    return;
  }
  const me = useApp.getState().me;
  if (!me || !getToken()) {
    useApp.getState().showToast("Önce giriş yapın.");
    return;
  }
  if (nick.toLowerCase() === me.nick.toLowerCase()) return;
  cleanup(false);
  const stream = await getMic();
  if (!stream) return;
  localStream = stream;
  peerNick = nick;
  const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
  peerPc = pc;
  for (const t of stream.getTracks()) pc.addTrack(t, stream);
  attachRemoteAudio(pc);
  try {
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    await waitIce(pc);
    await api.voiceSignal(nick, "call", JSON.stringify({ sdp: pc.localDescription?.sdp ?? "" }));
  } catch (e) {
    cleanup(true);
    useApp.getState().showToast(e instanceof Error ? e.message : "Arama gönderilemedi.");
    return;
  }
  useVoiceStore.setState({ status: "calling", peer: nick, muted: false, seconds: 0 });
  callTimeout = window.setTimeout(() => {
    if (useVoiceStore.getState().status === "calling") {
      void api.voiceSignal(nick, "end").catch(() => {});
      cleanup(true);
      useApp.getState().showToast("Cevap verilmedi.");
    }
  }, 45000);
}

/** Gelen aramayı kabul et */
export async function acceptVoiceCall() {
  const st = useVoiceStore.getState();
  if (st.status !== "incoming" || !st.peer || !incomingSdp) return;
  const from = st.peer;
  stopRingtone();
  if (incomingTimeout) {
    window.clearTimeout(incomingTimeout);
    incomingTimeout = 0;
  }
  const stream = await getMic();
  if (!stream) {
    void api.voiceSignal(from, "reject").catch(() => {});
    cleanup(true);
    return;
  }
  localStream = stream;
  peerNick = from;
  const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
  peerPc = pc;
  for (const t of stream.getTracks()) pc.addTrack(t, stream);
  attachRemoteAudio(pc);
  try {
    await pc.setRemoteDescription({ type: "offer", sdp: incomingSdp });
    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);
    await waitIce(pc);
    await api.voiceSignal(from, "answer", JSON.stringify({ sdp: pc.localDescription?.sdp ?? "" }));
  } catch {
    cleanup(true);
    useApp.getState().showToast("Görüşme başlatılamadı.");
    return;
  }
  useVoiceStore.setState({ status: "active", peer: from, muted: false, seconds: 0 });
}

/** Gelen aramayı reddet */
export function rejectVoiceCall() {
  const st = useVoiceStore.getState();
  if (st.status !== "incoming" || !st.peer) return;
  void api.voiceSignal(st.peer, "reject").catch(() => {});
  cleanup(true);
}

/** Görüşmeyi bitir (arayan ya da aranan) */
export function hangupVoiceCall() {
  const st = useVoiceStore.getState();
  if (st.status === "idle" || !st.peer) return;
  void api.voiceSignal(st.peer, "end").catch(() => {});
  cleanup(true);
}

/** Mikrofonu aç/kapat */
export function toggleVoiceMute() {
  const st = useVoiceStore.getState();
  if (st.status !== "active") return;
  const next = !st.muted;
  try {
    localStream?.getAudioTracks().forEach((t) => (t.enabled = !next));
  } catch {
    /* yok say */
  }
  useVoiceStore.setState({ muted: next });
}

/** Gelen sinyalleri işle (akış tek yerden çağırır) */
function handleVoiceSignals(sigs: ApiVoiceSignal[]) {
  const me = useApp.getState().me;
  if (!me) return;
  const myNick = me.nick.toLowerCase();
  for (const s of sigs) {
    if (s.from.toLowerCase() === myNick) continue;
    const st = useVoiceStore.getState();
    const samePeer = !!st.peer && st.peer.toLowerCase() === s.from.toLowerCase();

    if (s.kind === "call") {
      if (st.status !== "idle") {
        void api.voiceSignal(s.from, "busy").catch(() => {});
        continue;
      }
      let sdp = "";
      try {
        sdp = String((JSON.parse(s.payload) as { sdp?: string }).sdp ?? "");
      } catch {
        /* bozuk sinyal */
      }
      if (!sdp) continue;
      incomingSdp = sdp;
      useVoiceStore.setState({ status: "incoming", peer: s.from, muted: false, seconds: 0 });
      startRingtone();
      // 45 sn cevap gelmezse zil kapanır
      incomingTimeout = window.setTimeout(() => {
        if (useVoiceStore.getState().status === "incoming") cleanup(true);
      }, 45000);
    } else if (s.kind === "answer") {
      if (st.status === "calling" && samePeer && peerPc) {
        let sdp = "";
        try {
          sdp = String((JSON.parse(s.payload) as { sdp?: string }).sdp ?? "");
        } catch {
          /* bozuk */
        }
        if (!sdp) continue;
        void peerPc
          .setRemoteDescription({ type: "answer", sdp })
          .then(() => {
            if (callTimeout) {
              window.clearTimeout(callTimeout);
              callTimeout = 0;
            }
            useVoiceStore.setState({ status: "active" });
          })
          .catch(() => {});
      }
    } else if (s.kind === "busy") {
      if (st.status === "calling" && samePeer) {
        cleanup(true);
        useApp.getState().showToast(`${s.from} şu anda meşgul.`);
      }
    } else if (s.kind === "reject") {
      if ((st.status === "calling" || st.status === "incoming") && samePeer) {
        cleanup(true);
        useApp.getState().showToast(`${s.from} aramayı reddetti.`);
      }
    } else if (s.kind === "end") {
      if (st.status !== "idle" && samePeer) {
        cleanup(true);
        useApp.getState().showToast("Görüşme sonlandırıldı.");
      }
    }
  }
}

// ── Arayüz ─────────────────────────────────────────────────────

function fmt(sec: number) {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

const winBtn =
  "px-3 py-1 text-[12px] font-bold text-black bg-[#d4d0c8] border border-[#ffffff] border-b-[#404040] border-r-[#404040] active:border-b-[#ffffff] active:border-r-[#ffffff]";

/** Sesli görüşme pencereleri — gelen arama bildirimi + aktif görüşme (sağ alt) */
export function VoiceCallDock() {
  const me = useApp((s) => s.me);
  const status = useVoiceStore((s) => s.status);
  const peer = useVoiceStore((s) => s.peer);
  const muted = useVoiceStore((s) => s.muted);
  const seconds = useVoiceStore((s) => s.seconds);
  const [retry, setRetry] = useState(0);
  const [zil, setZil] = useState<ZilTuru>(() => ayarlariYukle().zil);
  const tickRef = useRef(0);

  // Sinyal akışı — girişliyken sürekli açık; koparsa 4 sn'de bir yeniden bağlanır
  useEffect(() => {
    if (!me || !getToken()) return;
    let stopped = false;
    const stop = openVoiceStream(
      (batch) => handleVoiceSignals(batch),
      () => {
        if (stopped) return;
        window.setTimeout(() => !stopped && setRetry((r) => r + 1), 4000);
      }
    );
    return () => {
      stopped = true;
      stop();
    };
  }, [me, retry]);

  // Görüşme süresi sayacı
  useEffect(() => {
    if (status !== "active") return;
    tickRef.current = window.setInterval(() => {
      useVoiceStore.setState((s) => ({ seconds: s.seconds + 1 }));
    }, 1000);
    return () => window.clearInterval(tickRef.current);
  }, [status]);

  // Sayfa kapanınca temizle
  useEffect(() => () => cleanup(true), []);

  if (!me) return null;

  return (
    <>
      {/* Gelen arama bildirimi */}
      {status === "incoming" && peer && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-[97] animate-floatUp">
          <div className="w-[300px] border border-[#808080] bg-[#d4d0c8] shadow-pop">
            <div className="px-2 py-0.5 bg-gradient-to-b from-[#3a6ea5] to-[#0a246a] text-white text-xs font-bold flex items-center justify-between">
              <span>📞 Sesli Görüşme</span>
              <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
            </div>
            <div className="p-4 text-center space-y-3">
              <p className="text-[13px] text-black">
                <b>{peer}</b> sizi arıyor…
              </p>
              {/* Zil sesi seçimi — arama çalarken değiştirilebilir, anında yeni ses çalar */}
              <label className="flex items-center justify-center gap-1.5 text-[11px] text-[#404040]">
                🔔 Zil sesi:
                <select
                  value={zil}
                  onChange={(e) => {
                    const v = e.target.value as ZilTuru;
                    setZil(v);
                    ayarlariKaydet({ ...ayarlariYukle(), zil: v });
                    stopRingtone();
                    if (v !== "sessiz") startRingtone(); // yeni sesi hemen dinlet
                  }}
                  className="border border-[#a0a0a0] bg-white px-1 py-0.5 text-[11px]"
                >
                  {ZIL_TURLERI.map((z) => (
                    <option key={z.tur} value={z.tur}>
                      {z.ad}
                    </option>
                  ))}
                </select>
              </label>
              <div className="flex gap-2 justify-center">
                <button onClick={() => void acceptVoiceCall()} className={`${winBtn} !bg-emerald-300`}>
                  ✅ Kabul Et
                </button>
                <button onClick={rejectVoiceCall} className={`${winBtn} !bg-red-300`}>
                  ❌ Reddet
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Aranan / aktif görüşme penceresi */}
      {(status === "calling" || status === "active") && peer && (
        <div className="fixed bottom-4 left-4 z-[96]">
          <div className="w-[280px] border border-[#808080] bg-[#d4d0c8] shadow-pop">
            <div className="px-2 py-0.5 bg-gradient-to-b from-[#3a6ea5] to-[#0a246a] text-white text-xs font-bold flex items-center justify-between">
              <span className="truncate">🔊 Sesli Görüşme — {peer}</span>
              {status === "active" && (
                <span className="flex items-center gap-1 text-[10px] font-normal opacity-90">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" /> Açık
                </span>
              )}
            </div>
            <div className="p-3 space-y-2 text-center">
              <p className="text-[13px] text-black font-semibold">
                {status === "calling" ? (
                  <span className="text-[#0a246a]">📡 {peer} aranıyor…</span>
                ) : (
                  <>
                    🎙️ {muted ? "Mikrofon kapalı" : "Mikrofon açık"} ·{" "}
                    <span className="tabular-nums">{fmt(seconds)}</span>
                  </>
                )}
              </p>
              <div className="flex gap-2 justify-center">
                {status === "active" && (
                  <button onClick={toggleVoiceMute} className={winBtn}>
                    {muted ? "🔇 Mikrofonu Aç" : "🔈 Mikrofonu Kapat"}
                  </button>
                )}
                <button onClick={hangupVoiceCall} className={`${winBtn} !bg-red-300`}>
                  📴 Görüşmeyi Bitir
                </button>
              </div>
              {status === "active" && (
                <p className="text-[10px] text-[#404040]">
                  Ses doğrudan karşı tarafa iletilir (P2P).
                </p>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
