import { useEffect, useMemo, useRef, useState } from "react";
import { sunucu } from "../lib/sunucu";
import { useApp } from "../store/useApp";
import { RankBadge } from "./RankBadge";
import type { ChatMsg, Profile } from "../lib/types";
import { api, getToken, openChatStream } from "../lib/api";
import type { ApiChatMsg } from "../lib/api";
import { can } from "../lib/ranks";
import { nickTextColor } from "../lib/colors";
import { MemberContextMenu } from "./MemberContextMenu";
import type { MenuTarget } from "./MemberContextMenu";
import { ProfileModal, Avatar } from "./ProfileModal";
import { isElectronWin } from "../store/useDesktop";
import { RoleStar } from "./RoleStar";
import { isSiteOwner, staffTier } from "../lib/kira";
import { gozardiListesi } from "../lib/gozardi";

/** Site yetkili kademesi — bu üyeler çevrimiçi listede avatar yerine yıldız taşır */
const STAFF_RANKS = ["admin", "yonetici", "koordinator", "yetkili"];

/** Klasik sohbet emoji paleti (referanstaki renkli emojiler) */
const EMOJIS = ["😀", "😂", "😍", "😘", "😎", "😜", "❤️", "🔥", "👍", "👎", "☕", "🎵", "🎀", "💋", "⚠️", "💤", "✌️", "🏆", "⭐", "🎲", "🀄", "♠️"];

/**
 * classic=true: klasik masaüstü tarzı sohbet (hakkarim.net benzeri) —
 * beyaz zemin, siyah yazı, mavi nick, kırmızı kalın bağlanma /
 * turuncu kalın ayrılma mesajları. Üye sekmesi gizlenir (üye listesi
 * salon odasının sağ panelinde durur).
 */
export function ChatPanel({ room, classic = false, ctxPower, ctxSalon, locked }: { room: string; classic?: boolean; ctxPower?: "full" | "mute"; ctxSalon?: string; locked?: boolean }) {
  const me = useApp((s) => s.me);
  const refreshMe = useApp((s) => s.refreshMe);
  const showToast = useApp((s) => s.showToast);
  const openPm = useApp((s) => s.openPm);
  const go = useApp((s) => s.go);
  /** ÜYE PROFİLİ: Electron'da her profil AYRI pencere olarak açılır —
   * birden fazla üye profili aynı anda açık olabilir. Tarayıcıda modal. */
  const profilAc = (n: string) => {
    if (isElectronWin()) go({ name: "profil", nick: n });
    else setProfileNick(n);
  };
  const [chat, setChat] = useState<ChatMsg[]>([]);
  const [dbChat, setDbChat] = useState<ChatMsg[]>([]);
  const [online, setOnline] = useState<Profile[]>([]);
  const [text, setText] = useState("");
  const [tab, setTab] = useState<"sohbet" | "uye">("sohbet");
  const [menu, setMenu] = useState<MenuTarget | null>(null);
  const [profileNick, setProfileNick] = useState<string | null>(null);
  const [emo, setEmo] = useState(false); // klasik sohbet emoji paleti
  const listRef = useRef<HTMLDivElement>(null);

  // Klasik kayan mesaj + yasak kelime filtresi (sağ tık menüsü → Sistem Ayarları)
  const [kayan, setKayan] = useState("");
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const oku = () => {
      setKayan(localStorage.getItem("vk_kayan_acik") === "1" ? localStorage.getItem("vk_kayan") ?? "" : "");
      setTick((t) => t + 1);
    };
    oku();
    const t = window.setInterval(oku, 3000);
    return () => window.clearInterval(t);
  }, []);
  const yasaklar = useMemo(() => {
    try { return JSON.parse(localStorage.getItem("vk_yasak") ?? "[]") as string[]; } catch { return []; }
  }, [tick]);

  // Sağ tık: her üye menüyü açabilir (profil + özel mesaj); işlem maddeleri
  // MemberContextMenu içinde kademeye göre filtrelenir
  const openMenu = (e: React.MouseEvent, nick: string) => {
    if (!me || nick === me.nick) return;
    e.preventDefault();
    setMenu({ nick, x: e.clientX, y: e.clientY });
  };

  useEffect(() => {
    return sunucu.subscribe((st) => {
      setChat(st.chat.filter((m) => m.room === room || (room === "lobi" && m.room === "lobi") || (room !== "yoneticiler" && !room.startsWith("salon:") && !room.startsWith("yonetim:") && !room.startsWith("ozel:") && m.room === "lobi")).slice(-120));
      setOnline(Object.values(st.profiles).filter((p) => !p.banned));
      refreshMe();
    });
  }, [room, refreshMe]);

  const lastIdRef = useRef(0);

  // Gercek zamanli sohbet: sunucu akisi (her ~2 sn); akis kurulamazsa
  // otomatik olarak hizli pollinge (2.5 sn) dusulur.
  useEffect(() => {
    if (!getToken()) return;
    let stopped = false;
    let pollTimer: number | null = null;

    const mapMsg = (m: ApiChatMsg): ChatMsg => ({
      id: `db_${m.id}`,
      nick: m.nick,
      rank: (m.rank as ChatMsg["rank"]) || "deneme",
      gold: !!m.gold,
      text: m.text,
      ts: m.createdAt * 1000,
      room: m.salon,
      system: m.kind === "system",
      nickColor: m.nickColor || "",
      textColor: m.textColor || "",
    });

    const applyBatch = (messages: ApiChatMsg[]) => {
      if (stopped || messages.length === 0) return;
      for (const m of messages) if (m.id > lastIdRef.current) lastIdRef.current = m.id;
      setDbChat((prev) => {
        const map = new Map(prev.map((x) => [x.id, x]));
        for (const m of messages) map.set(`db_${m.id}`, mapMsg(m));
        return Array.from(map.values())
          .sort((a, b) => a.ts - b.ts)
          .slice(-150);
      });
    };

    const startPolling = () => {
      if (pollTimer !== null || stopped) return;
      const load = async () => {
        try {
          const r = await api.chat(room, 150);
          if (!stopped) applyBatch(r.messages);
        } catch {
          /* kısa süreli bağlantı hatası göz ardı edilir */
        }
      };
      void load();
      pollTimer = window.setInterval(() => void load(), 2500);
    };

    const stopStream = openChatStream(
      room,
      lastIdRef.current,
      (messages) => applyBatch(messages),
      () => startPolling()
    );

    return () => {
      stopped = true;
      stopStream();
      if (pollTimer !== null) window.clearInterval(pollTimer);
    };
  }, [room]);

  // Yerel (bot) mesajlarla veritabanı mesajlarını birleştir
  // Salon/yönetim sohbeti OTURUM İÇİ TEMİZ: salondan çıkınca eski mesajlar
  // kalmasın — çıkışta son temizlik anı saklanır, dönüşte o andan yenileri gösterilir
  const temizOda = room.startsWith("salon:") || room.startsWith("yonetim:");
  const clearedKey = `vk_cleared_${room}`;
  const clearedTs = useMemo(() => {
    if (!temizOda) return 0;
    try { return Number(localStorage.getItem(clearedKey) ?? 0) || 0; } catch { return 0; }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [room, temizOda]);
  useEffect(() => {
    if (!temizOda) return;
    return () => {
      try { localStorage.setItem(clearedKey, String(Date.now())); } catch { /* yok say */ }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [room, temizOda]);

  const view = useMemo(() => {
    // Göz ardı edilen üyelerin mesajları sohbette görünmez (üye profili → Gözardı Et)
    const goz = new Set(gozardiListesi().map((n) => n.toLowerCase()));
    const seen = new Set<string>();
    return [...chat, ...dbChat]
      .filter((m) => {
        if (clearedTs && m.ts < clearedTs) return false;
        if (!m.system && goz.has(m.nick.trim().toLowerCase())) return false;
        const key = m.system ? `s_${m.nick}_${m.text}_${Math.round(m.ts / 60_000)}` : m.id;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      })
      .sort((a, b) => a.ts - b.ts)
      .slice(-150)
      .map((m) => {
        // Yasak kelime filtresi — yetkili olmayan üyelerde yasaklı kelime *** olur
        const yetkili = !me || can(me.rank, "mute") || isSiteOwner(me.nick);
        if (m.system || yetkili || !yasaklar.length) return m;
        let text = m.text;
        for (const k of yasaklar) {
          if (!k) continue;
          text = text.replace(new RegExp(k.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "gi"), "***");
        }
        return text === m.text ? m : { ...m, text };
      });
  }, [chat, dbChat, me, yasaklar, clearedTs]);

  useEffect(() => {
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [view.length, tab]);

  if (!me) return null;
  const muted = sunucu.isMuted(me) || me.mutedUntil > Date.now();

  const send = async () => {
    const t = text.trim();
    if (!t) return;
    if (muted) {
      showToast("Susturulduğunuz için yazamazsınız.");
      return;
    }
    try {
      await api.sendChat(room, t.slice(0, 200));
      setText("");
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Mesaj gönderilemedi.");
    }
  };

  const fmt = (ts: number) => new Date(ts).toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" });

  // ── Klasik mod: masaüstü uygulaması tarzı beyaz sohbet ──────────────
  if (classic) {
    return (
      <div className="flex flex-col h-full min-h-0 border border-[#808080] bg-[#d4d0c8]">
        <div className="px-2 py-0.5 bg-gradient-to-b from-[#3a6ea5] to-[#0a246a] text-white text-xs font-bold flex items-center justify-between">
          <span>Sohbet</span>
          <span className="font-normal opacity-80">{online.length} çevrimiçi</span>
        </div>
        {kayan && (
          <div className="bg-black text-white text-[12px] py-0.5 overflow-hidden whitespace-nowrap border-y border-[#808080]">
            <span className="vk-marquee">{kayan}</span>
          </div>
        )}
        <div ref={listRef} className="vk-chat-bg flex-1 min-h-0 overflow-y-auto px-2 py-1 text-[12px] leading-[1.6] text-black">
          {view.map((m) => (
            <div key={m.id} className="leading-snug">
              {m.system ? (
                /* Referans klasik istemcide: giriş/çıkış mesajları kırmızı ince, diğer sistem mesajları mavi kalın */
                <span className={/sisteme bağlan|sistemden ayrıl/i.test(m.text) ? "text-[#cc0000]" : "font-bold text-[#0000cc]"}>
                  {m.text}
                </span>
              ) : (
                <>
                  <span
                    className="font-bold cursor-pointer hover:underline"
                    style={
                      nickTextColor({ nick: m.nick, rank: m.rank, custom: m.nickColor })
                        ? { color: nickTextColor({ nick: m.nick, rank: m.rank, custom: m.nickColor })! }
                        : { color: "#111111" }
                    }
                    onClick={() => profilAc(m.nick)}
                    onContextMenu={(e) => openMenu(e, m.nick)}
                  >
                    {m.nick}
                  </span>
                  {(STAFF_RANKS.includes(m.rank) || isSiteOwner(m.nick)) && (
                    <RoleStar role={isSiteOwner(m.nick) ? "siteowner" : "member"} rank={m.rank} size={11} />
                  )}
                  {m.gold && <span className="text-[#c08a00] ml-0.5" title="Gold Üye">★</span>}
                  <span
                    style={m.textColor ? { color: m.textColor } : undefined}
                    className={m.textColor ? "" : "text-black"}
                  >
                    : {m.text}
                  </span>
                </>
              )}
            </div>
          ))}
          {view.length === 0 && (
            <p className="text-[#808080]">Sohbette henüz mesaj yok — ilk mesajı sen yaz!</p>
          )}
        </div>
        {/* Emoji paleti (klasik sohbet) — referanstaki renkli emojiler */}
        {emo && (
          <div className="px-1.5 py-1 border-t border-[#808080] bg-[#d4d0c8] flex flex-wrap gap-0.5">
            {EMOJIS.map((e) => (
              <button
                key={e}
                onClick={() => setText((t) => (t + e).slice(0, 200))}
                title="Mesaja ekle"
                className="w-6 h-6 text-[14px] leading-none hover:bg-white"
              >
                {e}
              </button>
            ))}
          </div>
        )}
        <div className="p-1 border-t border-[#808080] bg-[#d4d0c8] flex gap-1">
          {muted ? (
            <div className="flex-1 text-center text-xs text-[#cc3300] font-bold py-1">
              Susturuldunuz — yazamazsınız.
            </div>
          ) : locked && !ctxPower ? (
            <div className="flex-1 text-center text-xs text-[#cc3300] font-bold py-1">
              Genel sohbet kapatıldı — yalnızca salon yöneticileri yazabilir.
            </div>
          ) : (
            <>
              <input
                value={text}
                onChange={(e) => setText(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && send()}
                placeholder="Mesaj yaz..."
                maxLength={200}
                className="flex-1 min-w-0 bg-white border border-[#808080] px-2 py-1 text-[12px] text-black focus:outline-none"
              />
              <button
                onClick={() => setEmo((v) => !v)}
                title="Emojiler"
                className={`px-2 py-1 text-[13px] text-black border border-[#ffffff] border-b-[#404040] border-r-[#404040] active:border-b-[#ffffff] active:border-r-[#ffffff] ${emo ? "bg-white" : "bg-[#d4d0c8]"}`}
              >
                ☺
              </button>
              <button
                onClick={send}
                className="px-3 py-1 text-[12px] font-bold text-black bg-[#d4d0c8] border border-[#ffffff] border-b-[#404040] border-r-[#404040] active:border-b-[#ffffff] active:border-r-[#ffffff]"
              >
                Gönder
              </button>
            </>
          )}
        </div>
        <MemberContextMenu target={menu} onClose={() => setMenu(null)} onProfile={(n) => profilAc(n)} salonPower={ctxPower} salon={ctxSalon} />
        <ProfileModal nick={profileNick} onClose={() => setProfileNick(null)} />
      </div>
    );
  }

  // ── Koyu tema (lobi, yardım/yöneticiler salonları) ──────────────────
  return (
    <aside className="w-full lg:w-80 shrink-0 flex flex-col bg-wood-950/80 border border-wood-800 rounded-xl overflow-hidden h-[540px] lg:h-[calc(100vh-140px)] lg:sticky lg:top-24">
      <div className="flex border-b border-wood-800">
        {(["sohbet", "uye"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex-1 py-2 text-sm font-semibold uppercase tracking-wider transition-colors ${
              tab === t ? "bg-wood-800 text-gold-400" : "text-ivory-dark/70 hover:text-ivory"
            }`}
          >
            {t === "sohbet" ? "Sohbet" : `Çevrimiçi (${online.length})`}
          </button>
        ))}
      </div>

      {tab === "sohbet" ? (
        <>
          {kayan && (
          <div className="bg-black text-white text-[12px] py-0.5 overflow-hidden whitespace-nowrap border-b border-wood-800">
            <span className="vk-marquee">{kayan}</span>
          </div>
        )}
        <div ref={listRef} className="vk-chat-bg vk-chat-bg-bulut vk-chat-bg-koyu flex-1 overflow-y-auto p-3 space-y-1.5 text-sm">
            {view.map((m) => (
              <div key={m.id} className="animate-floatUp leading-snug">
                {m.system ? (
                  <span className="text-gold-500/80 italic text-xs">• {m.text}</span>
                ) : (
                  <>
                    <span className="text-ivory-dark/40 text-[10px] mr-1">{fmt(m.ts)}</span>
                    <span
                      className="font-semibold cursor-pointer hover:underline"
                      style={
                        nickTextColor({ nick: m.nick, rank: m.rank, custom: m.nickColor, dark: true })
                          ? {
                              color: nickTextColor({
                                nick: m.nick,
                                rank: m.rank,
                                custom: m.nickColor,
                                dark: true,
                              })!,
                            }
                          : undefined
                      }
                      onClick={() => profilAc(m.nick)}
                      onContextMenu={(e) => openMenu(e, m.nick)}
                      title={me && can(me.rank, "mute") ? "Profil için tıkla · Sağ tık: üye işlemleri" : "Profil için tıkla"}
                    >
                      {m.nick}
                    </span>
                    {(STAFF_RANKS.includes(m.rank) || isSiteOwner(m.nick)) && (
                      <RoleStar role={isSiteOwner(m.nick) ? "siteowner" : "member"} rank={m.rank} size={11} />
                    )}
                    {m.gold && <span className="text-gold-400 ml-0.5" title="Gold Üye">★</span>}
                    <span className="text-ivory-dark/50">:</span>{" "}
                    <span
                      className="break-words"
                      style={m.textColor ? { color: m.textColor } : { color: "#f5f0e1" }}
                    >
                      {m.text}
                    </span>
                  </>
                )}
              </div>
            ))}
          </div>
          <div className="p-2 border-t border-wood-800">
            {muted ? (
              <div className="text-center text-xs text-red-400 py-2">
                Susturuldunuz — yazamazsınız.
              </div>
            ) : locked && !ctxPower ? (
              <div className="text-center text-xs text-red-400 py-2">
                Genel sohbet kapatıldı — yalnızca salon yöneticileri yazabilir.
              </div>
            ) : (
              <div className="flex gap-2">
                <input
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && send()}
                  placeholder="Mesaj yaz..."
                  maxLength={200}
                  className="flex-1 bg-wood-900 border border-wood-700 rounded-lg px-3 py-2 text-sm text-ivory placeholder:text-ivory-dark/30 focus:outline-none focus:border-gold-600"
                />
                <button
                  onClick={send}
                  className="px-3 py-2 rounded-lg bg-gold-600 hover:bg-gold-500 text-wood-950 text-sm font-bold transition-colors"
                >
                  Gönder
                </button>
              </div>
            )}
          </div>
        </>
      ) : (
        <div className="flex-1 overflow-y-auto p-2 space-y-0.5 text-sm">
          {online
            .slice()
            // Site sahibi en üstte, sonra yetkili kademesi (admin → yönetici → koordinatör → yetkili), sonra gold, alfabetik
            .sort(
              (a, b) =>
                staffTier(b.nick, b.rank) - staffTier(a.nick, a.rank) ||
                Number(b.gold) - Number(a.gold) ||
                a.nick.localeCompare(b.nick)
            )
            .map((p) => (
              <div
                key={p.id}
                className="flex items-center justify-between gap-2 px-2 py-1.5 rounded-lg hover:bg-wood-800/60 cursor-pointer"
                onClick={() => profilAc(p.nick)}
                onContextMenu={(e) => openMenu(e, p.nick)}
              >
                <span className="flex items-center gap-1.5 min-w-0">
                  {STAFF_RANKS.includes(p.rank) || isSiteOwner(p.nick) ? (
                    // Yetkililer avatar yerine rol yıldızı taşır; site sahibi siyah parlak yıldız
                    <RoleStar role={isSiteOwner(p.nick) ? "siteowner" : "member"} rank={p.rank} size={16} />
                  ) : (
                    <Avatar avatar={p.avatar} gender={p.gender} size={20} />
                  )}
                  <span
                    className="truncate"
                    style={
                      nickTextColor({ nick: p.nick, rank: p.rank, custom: p.nickColor, dark: true })
                        ? {
                            color: nickTextColor({
                              nick: p.nick,
                              rank: p.rank,
                              custom: p.nickColor,
                              dark: true,
                            })!,
                          }
                        : { color: "#e7e0d5" }
                    }
                  >
                    {p.nick}
                  </span>
                  {p.gold && <span className="text-gold-400 text-xs">★</span>}
                  {p.mutedUntil > Date.now() && <span className="text-red-400 text-xs" title="Susturuldu">🔇</span>}
                </span>
                <span className="flex items-center gap-1.5 shrink-0">
                  {p.nick !== me.nick && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        openPm(p.nick);
                      }}
                      title={`${p.nick} kişisine özel mesaj gönder`}
                      className="px-1.5 py-0.5 rounded text-xs text-ivory-dark/60 hover:text-gold-300 hover:bg-wood-700 transition-colors"
                    >
                      💬
                    </button>
                  )}
                  <RankBadge rank={p.rank} />
                </span>
              </div>
            ))}
        </div>
      )}
      <MemberContextMenu target={menu} onClose={() => setMenu(null)} onProfile={(n) => profilAc(n)} />
      <ProfileModal nick={profileNick} onClose={() => setProfileNick(null)} />
    </aside>
  );
}
