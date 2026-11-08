import { useEffect, useRef, useState } from "react";
import { useApp } from "../store/useApp";
import { api, getToken, openChatStream } from "../lib/api";
import type { ApiChatMsg } from "../lib/api";
import { nickTextColor } from "../lib/colors";
import { markPmSeen } from "./MessageInbox";

/** Özel mesaj odası anahtarı: "ozel:nick1|nick2" (küçük harf, sıralı) */
export function pmRoomKey(a: string, b: string): string {
  return "ozel:" + [a.trim().toLowerCase(), b.trim().toLowerCase()].sort().join("|");
}

/**
 * Klasik tarzı özel mesaj penceresi — sağ altta açılır, birden fazla
 * pencere alt alta dizilir. Backend'de yalnızca iki katılımcı okuyabilir.
 */
export function PrivateChatWindow({ peer, onClose }: { peer: string; onClose: () => void }) {
  const me = useApp((s) => s.me);
  const showToast = useApp((s) => s.showToast);
  const [msgs, setMsgs] = useState<ApiChatMsg[]>([]);
  const [text, setText] = useState("");
  const listRef = useRef<HTMLDivElement>(null);
  const lastIdRef = useRef(0);
  const room = me ? pmRoomKey(me.nick, peer) : "";

  useEffect(() => {
    if (!room || !getToken()) return;
    let stopped = false;

    const apply = (batch: ApiChatMsg[]) => {
      if (stopped || batch.length === 0) return;
      let maxId = lastIdRef.current;
      for (const m of batch) {
        if (m.id > maxId) maxId = m.id;
        if (m.id > lastIdRef.current) lastIdRef.current = m.id;
      }
      // Pencere açıkken gelen mesajlar otomatik okundu sayılır
      markPmSeen(room, maxId);
      setMsgs((prev) => {
        const map = new Map(prev.map((x) => [x.id, x]));
        for (const m of batch) map.set(m.id, m);
        return Array.from(map.values()).sort((a, b) => a.id - b.id).slice(-200);
      });
    };

    void api
      .chat(room, 150)
      .then((r) => !stopped && apply(r.messages))
      .catch(() => {});

    const stop = openChatStream(room, lastIdRef.current, apply, () => {
      // akış koparsa hafif poll
    });
    return () => {
      stopped = true;
      stop();
    };
  }, [room]);

  useEffect(() => {
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [msgs.length]);

  if (!me) return null;

  const send = async () => {
    const t = text.trim();
    if (!t) return;
    try {
      await api.sendChat(room, t.slice(0, 200));
      setText("");
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Mesaj gönderilemedi.");
    }
  };

  return (
    <div className="w-[360px] border border-[#808080] bg-[#d4d0c8] flex flex-col h-[320px] shadow-pop">
      <div className="px-2 py-0.5 bg-gradient-to-b from-[#3a6ea5] to-[#0a246a] text-white text-xs font-bold flex items-center justify-between">
        <span className="truncate">🔒 Özel: {peer}</span>
        <span className="flex items-center gap-1.5">
          <span className="flex items-center gap-1 text-[10px] font-normal opacity-90" title="Anlık sohbet — mesajlar canlı gelir">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" /> Canlı
          </span>
          <button onClick={onClose} className="px-1.5 font-bold hover:bg-red-700 rounded-sm" title="Kapat">
            ×
          </button>
        </span>
      </div>
      <div ref={listRef} className="vk-chat-bg vk-chat-bg-kalp flex-1 min-h-0 overflow-y-auto px-2 py-1 text-[12px] leading-[1.6]">
        {msgs.length === 0 && <p className="text-[#808080]">Bu kişiye özel mesaj yazmaya başla…</p>}
        {msgs.map((m) =>
          m.kind === "system" ? (
            <p key={m.id} className="font-bold text-[#cc3300]">
              {m.text}
            </p>
          ) : (
            <div key={m.id} className="leading-snug">
              <span
                className="font-bold"
                style={{
                  color:
                    nickTextColor({
                      nick: m.nick,
                      rank: m.rank,
                      custom: m.nickColor,
                    }) ?? (m.nick.toLowerCase() === peer.toLowerCase() ? "#7c2d12" : "#111111"),
                }}
              >
                {m.nick}
              </span>
              <span
                style={m.textColor ? { color: m.textColor } : undefined}
                className={m.textColor ? "" : "text-black"}
              >
                : {m.text}
              </span>
            </div>
          )
        )}
      </div>
      <div className="p-1 border-t border-[#808080] bg-[#d4d0c8] flex gap-1">
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && void send()}
          placeholder={`${peer} kişisine mesaj yaz...`}
          maxLength={200}
          className="flex-1 min-w-0 bg-white border border-[#808080] px-2 py-1 text-[12px] text-black focus:outline-none"
        />
        <button
          onClick={() => void send()}
          className="px-3 py-1 text-[12px] font-bold text-black bg-[#d4d0c8] border border-[#ffffff] border-b-[#404040] border-r-[#404040] active:border-b-[#ffffff] active:border-r-[#ffffff]"
        >
          Gönder
        </button>
      </div>
    </div>
  );
}

/** Açık özel mesaj pencerelerini sağ altta dizer */
export function PrivateChatDock() {
  const peers = useApp((s) => s.pmPeers);
  const closePm = useApp((s) => s.closePm);
  if (peers.length === 0) return null;
  return (
    <div className="fixed bottom-4 right-4 z-[95] flex flex-col-reverse gap-2 items-end">
      {peers.map((p) => (
        <PrivateChatWindow key={p} peer={p} onClose={() => closePm(p)} />
      ))}
    </div>
  );
}
