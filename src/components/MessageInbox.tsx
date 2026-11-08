import { useCallback, useEffect, useRef, useState } from "react";
import { useApp } from "../store/useApp";
import { api, getToken } from "../lib/api";

// ── Okunmamış takibi: oda anahtarı → okunan son mesaj id (localStorage) ──
const LS_SEEN = "vk_pm_seen";

function readSeen(): Record<string, number> {
  try {
    return JSON.parse(localStorage.getItem(LS_SEEN) || "{}") as Record<string, number>;
  } catch {
    return {};
  }
}

function markSeen(room: string, id: number) {
  try {
    const m = readSeen();
    if ((m[room] ?? 0) < id) {
      m[room] = id;
      localStorage.setItem(LS_SEEN, JSON.stringify(m));
    }
  } catch {
    /* depolama yok sayılır */
  }
}

/** Açık PM penceresi mesaj aldıkça okundu olarak işaretler (MessageInbox rozeti için) */
export function markPmSeen(room: string, id: number) {
  markSeen(room, id);
}

interface PmRoomInfo {
  room: string;
  peer: string;
  count: number;
  last: { id: number; nick: string; text: string; kind: string; createdAt: number };
}

/**
 * Header'daki "Mesajlar" gelen kutusu — PM konuşmalarını listeler,
 * okunmamış mesaj rozeti gösterir ve tıklayınca özel mesaj penceresini açar.
 */
export function MessageInbox() {
  const me = useApp((s) => s.me);
  const openPm = useApp((s) => s.openPm);
  const showToast = useApp((s) => s.showToast);
  const [rooms, setRooms] = useState<PmRoomInfo[]>([]);
  const [open, setOpen] = useState(false);
  const [unread, setUnread] = useState(0);
  const notifiedRef = useRef<Set<number>>(new Set());
  const seededRef = useRef(false);
  const panelRef = useRef<HTMLDivElement>(null);

  const refresh = useCallback(async () => {
    if (!me || !getToken()) return;
    try {
      const r = await api.pmRooms();
      setRooms(r.rooms);
      const seen = readSeen();
      const meLc = me.nick.trim().toLowerCase();
      let n = 0;
      for (const rm of r.rooms) {
        if (rm.last.kind === "system") continue;
        // Kendi yazdığın son mesajsa okunmamış sayılmaz
        if (rm.last.nick.trim().toLowerCase() === meLc) continue;
        if (rm.last.id > (seen[rm.room] ?? 0)) {
          n += 1;
          // İlk yüklemede eski mesajlar bildirilmez; sonrası tek seferlik toast
          if (!notifiedRef.current.has(rm.last.id)) {
            if (seededRef.current) showToast(`📩 ${rm.last.nick} size özel mesaj gönderdi`);
            notifiedRef.current.add(rm.last.id);
          }
        }
      }
      setUnread(n);
      seededRef.current = true;
    } catch {
      /* oturum/ağ hatası sessizce geçilir */
    }
  }, [me, showToast]);

  useEffect(() => {
    void refresh();
    const t = window.setInterval(() => void refresh(), 8000);
    return () => window.clearInterval(t);
  }, [refresh]);

  // Dışarı tıklayınca paneli kapat
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("mousedown", onDown);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("mousedown", onDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  if (!me) return null;

  const fmt = (ts: number) => new Date(ts * 1000).toLocaleString("tr-TR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });

  const openRoom = (rm: PmRoomInfo) => {
    markSeen(rm.room, rm.last.id);
    setUnread((u) => Math.max(0, u - 1));
    openPm(rm.peer);
    setOpen(false);
  };

  return (
    <div className="relative" ref={panelRef}>
      <button
        onClick={() => setOpen((v) => !v)}
        className={`relative px-3 py-1.5 rounded-lg text-sm font-semibold transition-colors ${
          open ? "bg-gold-600 text-wood-950" : "text-ivory-dark hover:bg-wood-800 hover:text-ivory"
        }`}
        title="Özel mesajlar"
      >
        📨 Mesajlar
        {unread > 0 && (
          <span className="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] px-1 rounded-full bg-red-600 text-white text-[10px] font-bold flex items-center justify-center border border-wood-950 animate-pulse">
            {unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-72 bg-wood-950 border-2 border-gold-700 rounded-xl shadow-pop overflow-hidden z-[100] animate-floatUp">
          <div className="px-3 py-2 bg-wood-900 border-b border-wood-800 flex items-center justify-between">
            <p className="font-bold text-gold-400 text-sm">📩 Özel Mesajlar</p>
            {unread > 0 && (
              <button
                onClick={() => {
                  for (const rm of rooms) markSeen(rm.room, rm.last.id);
                  setUnread(0);
                }}
                className="text-[10px] text-ivory-dark/60 hover:text-ivory underline"
              >
                tümünü okundu işaretle
              </button>
            )}
          </div>
          <div className="vk-chat-bg vk-chat-bg-kalp vk-chat-bg-koyu max-h-80 overflow-y-auto">
            {rooms.length === 0 && (
              <p className="p-4 text-center text-xs text-ivory-dark/50">
                Henüz özel mesaj yok. Üye listesinde birinin nick'ine tıklayıp{" "}
                <b>💬 Özel Mesaj</b> ile başlayabilirsin.
              </p>
            )}
            {rooms
              .slice()
              .sort((a, b) => b.last.id - a.last.id)
              .map((rm) => {
                const isUnread =
                  rm.last.kind !== "system" &&
                  rm.last.nick.trim().toLowerCase() !== me.nick.trim().toLowerCase() &&
                  rm.last.id > (readSeen()[rm.room] ?? 0);
                return (
                  <button
                    key={rm.room}
                    onClick={() => openRoom(rm)}
                    className={`w-full text-left px-3 py-2 border-b border-wood-800/60 hover:bg-wood-800/60 transition-colors flex items-start gap-2 ${
                      isUnread ? "bg-wood-900/50" : ""
                    }`}
                  >
                    <span className="shrink-0 mt-0.5 text-sm">{isUnread ? "📩" : "✉️"}</span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center justify-between gap-2">
                        <span className={`text-sm truncate ${isUnread ? "text-gold-300 font-bold" : "text-ivory"}`}>
                          {rm.peer}
                        </span>
                        <span className="text-[10px] text-ivory-dark/40 shrink-0">{fmt(rm.last.createdAt)}</span>
                      </span>
                      <span className="block text-xs text-ivory-dark/60 truncate">
                        {rm.last.nick.trim().toLowerCase() === me.nick.trim().toLowerCase() ? "Sen: " : ""}
                        {rm.last.text}
                      </span>
                    </span>
                    {isUnread && <span className="shrink-0 mt-1 w-2 h-2 rounded-full bg-red-500" />}
                  </button>
                );
              })}
          </div>
        </div>
      )}
    </div>
  );
}
