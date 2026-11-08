import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useApp } from "../store/useApp";
import { RoleStar } from "./RoleStar";
import { api, openChatStream } from "../lib/api";
import type { ApiUser, ApiChatMsg } from "../lib/api";
import { isSiteOwner } from "../lib/kira";
import { gozardiEkle, gozardiKaldir, gozardiVar } from "../lib/gozardi";
import { klasikConfirm } from "../lib/klasikDialog";

const AVATAR_EMOJIS = ["🦊", "🐼", "🐯", "🦁", "🐸", "🐵", "🐰", "🦄", "🐺", "🐨", "🦅", "🦉", "♠️", "♥️", "🎲", "🀄", "🏆", "⭐", "👑", "🎯"];
const EMOJIS = ["😀", "😂", "🙂", "😉", "😍", "😎", "🤔", "😐", "😢", "😡", "👍", "👎", "👏", "🙏", "💪", "🔥", "🎉", "🎁", "❤️", "💔", "☕", "🍺", "🏆", "🎲", "🃏", "🍀", "💰", "⭐", "🌙", "☀️"];

/** Şikayet formu sebepleri */
const SIKAYET_SEBEPLERI = [
  "Sohbette küfür / hakaret",
  "Spam / reklam",
  "Dolandırıcılık / kandırma",
  "Hile / program kullanımı",
  "Uygunsuz profil / avatar",
  "Diğer",
];

/** Özel mesaj odası anahtarı — PrivateChat ile AYNI (mesajlar iki tarafta da görünür + kalıcı) */
function ozelOda(a: string, b: string): string {
  return "ozel:" + [a.trim().toLowerCase(), b.trim().toLowerCase()].sort().join("|");
}

/**
 * Tek gösterilen unvan — görev neyse O yazılır:
 * site sahibi → "Site Sahibi", admin → "Admin", üye → "Üye".
 */
function profilUnvan(user: ApiUser): string {
  if (isSiteOwner(user.nick)) return "Site Sahibi";
  switch (user.rank) {
    case "admin":
      return "Admin";
    case "yonetici":
      return "Yönetici";
    case "denetmen":
      return "Denetmen";
    case "koordinator":
      return "Site Koordinatörü";
    case "yetkili":
      return "Site Yetkilisi";
    default:
      return "Üye";
  }
}

/** Referanstaki yeşil "••İyi Oyuncu••" satırı — oynanan/kazanma oranından */
function oyuncuSeviyesi(user: ApiUser): string {
  const oynanan = user.gamesPlayed ?? 0;
  const wr = user.winRate ?? 0;
  if (oynanan < 5) return "••Yeni Üye••";
  if (wr >= 60) return "••Usta Oyuncu••";
  if (wr >= 45) return "••İyi Oyuncu••";
  if (wr >= 30) return "••Normal Oyuncu••";
  return "••Acemi Oyuncu••";
}

/** Referanstaki istatistik satırı — solda ikon+etiket, sağda değer */
/** Hakkarim tarzı geçen süre — en fazla ilk iki anlamlı birim ("1 yıl 23 gün önce") */
function gecenSure(fromTs: number): string {
  const sn = Math.max(0, Math.floor(Date.now() / 1000) - fromTs);
  const dk = Math.floor(sn / 60);
  const sa = Math.floor(dk / 60);
  const gun = Math.floor(sa / 24);
  const yil = Math.floor(gun / 365);
  const ay = Math.floor((gun % 365) / 30);
  const kalanGun = yil > 0 || ay > 0 ? (gun % 365) % 30 : gun;
  const birimler: string[] = [];
  if (yil > 0) birimler.push(`${yil} yıl`);
  if (ay > 0) birimler.push(`${ay} ay`);
  if (kalanGun > 0) birimler.push(`${kalanGun} gün`);
  if (birimler.length === 0 && sa > 0) birimler.push(`${sa} saat`);
  if (birimler.length === 0 && dk > 0) birimler.push(`${dk} dakika`);
  if (birimler.length === 0) return "az önce";
  return birimler.slice(0, 2).join(" ") + " önce";
}

/** Referanstaki son çıkış satırı: "1.10.2025 21:53:03 tarihinde (1 yıl 23 gün önce) 1. Kat 1. Salon'dan çıkış yaptı" */
function sonCikisSatiri(user: ApiUser): string | null {
  const ts = user.lastExitTs ?? 0;
  const salon = (user.lastExitSalon ?? "").trim();
  if (!ts || !salon) return null;
  const d = new Date(ts * 1000);
  const p2 = (n: number) => String(n).padStart(2, "0");
  const tarih = `${d.getDate()}.${d.getMonth() + 1}.${d.getFullYear()} ${p2(d.getHours())}:${p2(d.getMinutes())}:${p2(d.getSeconds())}`;
  const [kat, slot] = salon.split("_");
  const salonAd = kat && slot ? `${kat}. Kat ${slot}. Salon` : salon;
  const sonEk = salonAd.endsWith("Salon") ? `${salonAd}'dan` : `${salonAd}dan`;
  return `${tarih} tarihinde (${gecenSure(ts)}) ${sonEk} çıkış yaptı`;
}

function Satir({ icon, label, value }: { icon?: string; label: string; value: string }) {
  return (
    <div className="flex items-center gap-1">
      <span className="w-4 text-center shrink-0 text-[11px] leading-none">{icon ?? ""}</span>
      <span className="font-bold whitespace-nowrap">{label}</span>
      <span className="flex-1" />
      <span className="font-bold">{value}</span>
    </div>
  );
}

/** Avatarı render et: "emoji:X" veya görsel URL (GIF destekli), boşsa cinsiyete göre varsayılan */
export function Avatar({
  avatar,
  gender,
  size = 40,
}: {
  avatar?: string;
  gender?: "e" | "k";
  size?: number;
}) {
  const cls = "rounded-full object-cover shrink-0 border-2 border-gold-700/70 bg-wood-900 flex items-center justify-center";
  const style = { width: size, height: size, fontSize: size * 0.55 };
  if (avatar?.startsWith("http")) {
    return <img src={avatar} alt="" className={cls} style={{ width: size, height: size }} />;
  }
  if (avatar?.startsWith("emoji:")) {
    return (
      <span className={cls} style={style} aria-hidden>
        {avatar.slice(6)}
      </span>
    );
  }
  return (
    <span className={cls} style={style} aria-hidden>
      {gender === "k" ? "👩" : "👨"}
    </span>
  );
}

export function ProfileModal({
  nick,
  salon,
  onClose,
  full,
}: {
  nick: string | null;
  /** Bulunduğun salon — şikayetin hangi salonun yönetimine gideceğini belirler */
  salon?: string;
  onClose: () => void;
  /** AYRI pencerede (ProfilPage): modal TÜM pencereyi kaplar — boşluk/taşma yok */
  full?: boolean;
}) {
  const me = useApp((s) => s.me);
  const showToast = useApp((s) => s.showToast);
  const syncMe = useApp((s) => s.syncMe);
  const go = useApp((s) => s.go);
  const [user, setUser] = useState<ApiUser | null>(null);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState(false);
  const [g, setG] = useState<"e" | "k">("e");
  const [av, setAv] = useState("");
  const [bio, setBio] = useState("");
  const [avUrl, setAvUrl] = useState("");
  const [complaining, setComplaining] = useState(false);
  const [sikayetSebep, setSikayetSebep] = useState(SIKAYET_SEBEPLERI[0]);
  const [sikayetNot, setSikayetNot] = useState("");
  const [sikayetYonetici, setSikayetYonetici] = useState("");
  const [goz, setGoz] = useState(false); // Gözardı Et / İzin Ver durumu

  // ── Alt sohbet (kalıcı — ozel: odası, PrivateChat ile aynı) ──
  const [msgs, setMsgs] = useState<{ id: string; nick: string; text: string; ts: number }[]>([]);
  const [mesaj, setMesaj] = useState("");
  const [emo, setEmo] = useState(false);
  const chatRef = useRef<HTMLDivElement>(null);

  // ── Pencereyi tutup taşıma (başlık çubuğundan sürüklenir) ──
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  const dragRef = useRef<{ sx: number; sy: number; ox: number; oy: number } | null>(null);
  const dragStart = (e: React.PointerEvent) => {
    if (full) return; // ayrı pencere zaten program tarafından taşınır
    if ((e.target as HTMLElement).closest("button")) return; // ✕ tuşu taşımasın
    dragRef.current = { sx: e.clientX, sy: e.clientY, ox: pos?.x ?? 0, oy: pos?.y ?? 0 };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };
  const dragMove = (e: React.PointerEvent) => {
    const d = dragRef.current;
    if (!d) return;
    // Ekran dışına tamamen taşmayı engelle
    const maxX = Math.max(0, window.innerWidth / 2 - 60);
    const maxY = Math.max(0, window.innerHeight / 2 - 30);
    const nx = d.ox + (e.clientX - d.sx);
    const ny = d.oy + (e.clientY - d.sy);
    setPos({ x: Math.max(-maxX, Math.min(maxX, nx)), y: Math.max(-maxY, Math.min(maxY, ny)) });
  };
  const dragEnd = () => {
    dragRef.current = null;
  };

  const isMe = !!me && !!nick && me.nick === nick;
  const oda = useMemo(() => (nick && me ? ozelOda(me.nick, nick) : ""), [nick, me]);

  useEffect(() => {
    if (!nick) return;
    setUser(null);
    setErr("");
    setEditing(false);
    setComplaining(false);
    setSikayetNot("");
    setSikayetYonetici("");
    // Yeniden açılınca her şey sıfır: yazılmış taslaklar ve taşınmış konum kalmasın
    setMesaj("");
    setEmo(false);
    setPos(null);
    setGoz(gozardiVar(nick));
    api
      .profile(nick)
      .then((r) => {
        setUser(r.user);
        setG(r.user.gender === "k" ? "k" : "e");
        setAv(r.user.avatar || "");
        setBio(r.user.bio || "");
        setAvUrl(r.user.avatar?.startsWith("http") ? r.user.avatar : "");
      })
      .catch((e) => setErr(e instanceof Error ? e.message : "Profil yüklenemedi"));
  }, [nick]);

  // ANLIK yenileme — istatistikler/puanlar ~5 sn'de bir tazelensin (oyun bitince
  // puanı/kazanma oranı profilde canlı görünsün); yalnız sayısal alanlar güncellenir
  useEffect(() => {
    if (!nick) return;
    const t = window.setInterval(() => {
      api
        .profile(nick)
        .then((r) => setUser((u) => (u ? { ...u, ...r.user } : r.user)))
        .catch(() => {});
    }, 5000);
    return () => window.clearInterval(t);
  }, [nick]);

  // Sohbet — GERÇEK ZAMANLI akış: sunucu NDJSON akışı (~2 sn'de bir yeni mesajları
  // anında iletir); akış kurulamazsa otomatik olarak 2.5 sn pollinge düşülür.
  // Mesajlar kalıcıdır; karşı taraf PrivateChat'ten de görür.
  const lastIdRef = useRef(0);
  useEffect(() => {
    if (!nick || !me || !oda) return;
    let stopped = false;
    let pollTimer: number | null = null;
    lastIdRef.current = 0;
    setMsgs([]);

    const birlestir = (messages: ApiChatMsg[]) => {
      if (stopped || messages.length === 0) return;
      for (const m of messages) if (m.id > lastIdRef.current) lastIdRef.current = m.id;
      setMsgs((prev) => {
        const map = new Map(prev.map((x) => [x.id, x]));
        for (const m of messages) {
          if (m.salon !== oda) continue;
          // Gönderirken eklenen yerel (anlık) kopya — veritabanı kopyası gelince kaldırılır
          for (const [k, v] of map) {
            if (k.startsWith("l") && v.nick === m.nick && v.text === m.text) map.delete(k);
          }
          map.set(`db${m.id}`, { id: `db${m.id}`, nick: m.nick, text: m.text, ts: m.createdAt * 1000 });
        }
        return Array.from(map.values()).sort((a, b) => a.ts - b.ts).slice(-150);
      });
    };

    const yukle = async () => {
      try {
        const r = await api.chat(oda, 100, lastIdRef.current);
        if (!stopped) birlestir(r.messages);
      } catch {
        /* kısa bağlantı hatası göz ardı */
      }
    };

    const startPolling = () => {
      if (pollTimer !== null || stopped) return;
      void yukle();
      pollTimer = window.setInterval(() => void yukle(), 2500);
    };

    const stopStream = openChatStream(
      oda,
      lastIdRef.current,
      (messages) => birlestir(messages),
      () => startPolling()
    );

    // İlk yükleme (geçmiş mesajlar) — akış bağlanana kadar beklemeden gelsin
    void yukle();

    return () => {
      stopped = true;
      stopStream();
      if (pollTimer !== null) window.clearInterval(pollTimer);
    };
  }, [nick, me, oda]);

  useEffect(() => {
    const el = chatRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [msgs.length]);

  const mesajGonder = async () => {
    const t = mesaj.trim();
    if (!t || !me || !nick) return;
    // Anında temizle (yazılan silinmiyor kalmasın); hata olursa geri koy
    const localId = `l${Date.now()}`;
    setMesaj("");
    setMsgs((p) => [...p, { id: localId, nick: me.nick, text: t.slice(0, 300), ts: Date.now() }]);
    try {
      await api.sendChat(oda, t.slice(0, 300));
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Mesaj gönderilemedi.");
      setMesaj(t);
      setMsgs((p) => p.filter((m) => m.id !== localId)); // yerel kopyayı geri al
    }
  };

  /** Sohbeti .txt olarak indir (klasik "sohbeti kaydet") */
  const sohbetiKaydet = () => {
    const satirlar = msgs.map((m) => `[${new Date(m.ts).toLocaleString("tr-TR")}] ${m.nick}: ${m.text}`);
    const blob = new Blob([`${nick} ile sohbet kaydı\n${"=".repeat(40)}\n${satirlar.join("\n")}\n`], { type: "text/plain;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `sohbet-${nick}-${new Date().toISOString().slice(0, 10)}.txt`;
    a.click();
    URL.revokeObjectURL(a.href);
    showToast("Sohbet kaydedildi (.txt).");
  };

  /** Sohbeti SİL — odadaki tüm mesajlar sunucudan da kaldırılır (her iki taraf için) */
  const sohbetiSil = async () => {
    if (!oda || !nick) return;
    if (!(await klasikConfirm(`Bu sohbetteki TÜM mesajlar silinsin mi?\n(${nick} ile konuşma — geri alınamaz)`))) return;
    try {
      await api.chatClear(oda);
      lastIdRef.current = 0;
      setMsgs([]);
      showToast("Sohbet temizlendi — tüm mesajlar silindi.");
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Sohbet silinemedi.");
    }
  };

  /** Klasik "Ping" — profili çeken sunucu gecikmesini ölçer */
  const pingOlcek = async () => {
    if (!nick) return;
    const t0 = performance.now();
    try {
      await api.profile(nick);
      showToast(`Ping: ${Math.round(performance.now() - t0)} ms`);
    } catch {
      showToast("Ping alınamadı.");
    }
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  // Şikayet: salondaki ÇEVRİMİÇİ yöneticileri çek — seçilen yöneticiye gider
  const [yoneticiListe, setYoneticiListe] = useState<{ nick: string; rol: string }[]>([]);
  useEffect(() => {
    if (!complaining || !salon || !nick) return;
    let alive = true;
    api.salonStaffList(salon)
      .then((r) => {
        if (!alive) return;
        const liste = (r.staff ?? [])
          .filter((s) => ["admin", "superop", "yonetici"].includes(s.role))
          .map((s) => ({ nick: s.nick, rol: s.role }));
        setYoneticiListe(liste);
        setSikayetYonetici((v) => v || liste[0]?.nick || "");
      })
      .catch(() => alive && setYoneticiListe([]));
    return () => {
      alive = false;
    };
  }, [complaining, salon, nick]);

  // Şikayet gönderimi: seçilen yöneticinin yönetim odasına anlık bildirim + yerel kayıt
  const sikayetGonder = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const kayitlar = JSON.parse(localStorage.getItem("vk_sikayetler") || "[]") as unknown[];
      kayitlar.push({ hedef: nick, sebep: sikayetSebep, not: sikayetNot.trim(), bildiren: me?.nick ?? "misafir", yonetici: sikayetYonetici, ts: Date.now() });
      localStorage.setItem("vk_sikayetler", JSON.stringify(kayitlar.slice(-200)));
      // Seçilen yöneticiye ANLIK gönder (yonetim sohbetine düşer — hemen görür)
      if (sikayetYonetici && salon) {
        try {
          await api.sendChat(`yonetim:${salon}`, `🚫 ŞİKAYET → ${sikayetYonetici}: ${nick} hakkında — ${sikayetSebep}${sikayetNot.trim() ? ` — "${sikayetNot.trim()}"` : ""} (bildiren: ${me?.nick ?? "misafir"})`);
        } catch {
          /* yonetim odası yoksa yalnız yerel kayıt */
        }
      }
      showToast(sikayetYonetici ? `Şikayet ${sikayetYonetici} adına yetkililere iletildi.` : "Şikayetiniz yetkililere iletildi.");
    } catch {
      showToast("Şikayet kaydedilemedi.");
    }
    setBusy(false);
    setComplaining(false);
    setSikayetNot("");
  };

  if (!nick) return null;

  const save = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const avatar = avUrl.trim() ? avUrl.trim() : av;
      const r = await api.updateProfile({ gender: g, avatar, bio });
      setUser(r.user);
      setEditing(false);
      showToast("Profiliniz güncellendi.");
      if (isMe) void syncMe();
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Güncellenemedi.");
    }
    setBusy(false);
  };

  // Referanstaki büyük "üye sayfası" zemini: üyenin görsel URL'si varsa o,
  // yoksa klasik duvar kağıdı
  const sayfaResmi = user?.avatar?.startsWith("http") ? user.avatar : "/masaustu/duvar-kagidi.png";
  // 0 oyun oynayan üyede kayıp oranı %100 gibi görünmesin — 0 gösterilir
  const kayipOran = (user?.gamesPlayed ?? 0) > 0 ? Math.max(0, 100 - (user?.winRate ?? 0)) : 0;
  const kayipSayi = Math.max(0, (user?.gamesPlayed ?? 0) - (user?.gamesWon ?? 0));
  const superop = user ? profilUnvan(user) : "";
  const cikisSatiri = user ? sonCikisSatiri(user) : null;

  return createPortal(
    <div
      className={`fixed inset-0 z-[90] ${
        full ? "bg-white" : "bg-black/50 flex items-center justify-center p-0"
      }`}
      onClick={full ? undefined : onClose}
    >
      {/* KLASİK ÜYE PROFİLİ — referans (KIZILTEPELİ) düzeni: üstte sol 108px kare
          avatar + sağda istatistik satırları, yeşil oyuncu seviyesi, kırmızı
          "Üye Sayfasını Göster" satırı, Gözardı Et/İzin Ver + Ping, ortada büyük
          üye sayfası zemini (sohbet bindirmeli), altta mesaj kutusu + sarı emoji. */}
      <div
        className={`bg-[#d4d0c8] border-t border-l border-[#dfdfdf] border-b border-r border-[#404040] shadow-pop flex flex-col ${
          full ? "w-full h-full max-w-none" : "w-full max-w-[320px] max-h-[100vh]"
        }`}
        style={{
          fontFamily: "Tahoma, Geneva, Verdana, sans-serif",
          transform: !full && pos ? `translate(${pos.x}px, ${pos.y}px)` : undefined,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Başlık çubuğu — REFERANS: başlık = nick, sağda — □ × (yalnız modal;
            Electron'da pencere NATİF başlık çubuğu kullanır — tutunca taşınır) */}
        {!full && (
          <div
            onPointerDown={dragStart}
            onPointerMove={dragMove}
            onPointerUp={dragEnd}
            onPointerCancel={dragEnd}
            className="flex items-center justify-between px-1 py-0.5 bg-gradient-to-b from-[#0a246a] to-[#3a6ea5] text-white text-[12px] font-bold shrink-0 cursor-move select-none touch-none"
            title="Tutup taşıyabilirsiniz"
          >
            <span className="truncate">{nick}</span>
            <span className="flex items-center gap-px">
              <span className="px-1.5 bg-[#d4d0c8] text-black font-bold leading-4 border-t border-l border-white border-b border-r border-[#404040] opacity-60" title="Küçült">—</span>
              <span className="px-1.5 bg-[#d4d0c8] text-black font-bold leading-4 border-t border-l border-white border-b border-r border-[#404040] opacity-60" title="Ekranı kapla">□</span>
              <button
                onClick={onClose}
                className="px-1.5 bg-[#d4d0c8] text-black font-bold leading-4 border-t border-l border-white border-b border-r border-[#404040]"
                title="Kapat"
              >
                ✕
              </button>
            </span>
          </div>
        )}

        {err ? (
          <div className="p-6 text-center text-[#991b1b] text-[13px] font-bold">{err}</div>
        ) : !user ? (
          <div className="p-6 text-center text-black text-[13px]">Yükleniyor…</div>
        ) : (
          <div className={`overflow-y-auto flex flex-col min-h-0 bg-white ${full ? "flex-1 p-1 gap-1" : "p-1 gap-1"}`}>
            {/* ÜST BLOK: sol — 108px kare avatar · sağ — istatistik satırları */}
            <div className="flex gap-2">
              <div className="w-[108px] h-[108px] shrink-0 border border-[#808080] bg-[#cfe0f5] flex items-center justify-center overflow-hidden">
                {user.avatar?.startsWith("http") ? (
                  <img src={user.avatar} alt="" className="w-full h-full object-cover" />
                ) : (
                  <span style={{ fontSize: 54 }} aria-hidden>
                    {user.avatar?.startsWith("emoji:") ? user.avatar.slice(6) : user.gender === "k" ? "👩" : "👨"}
                  </span>
                )}
              </div>
              <div className="flex-1 min-w-0 text-[12px] leading-[1.5] text-black">
                <Satir label="Puanı:" value={(user.chips ?? 0).toLocaleString("tr-TR")} />
                {user.sira != null && user.sira > 0 && (
                  <Satir label="Sıra:" value={(user.sira as number).toLocaleString("tr-TR")} />
                )}
                <Satir label="Kredi:" value={(user.points ?? 0).toLocaleString("tr-TR")} />
                <Satir icon="🎯" label="Oynadığı:" value={String(user.gamesPlayed ?? 0)} />
                <Satir icon="⭐" label={`Kazandığı: %${user.winRate ?? 0}`} value={String(user.gamesWon ?? 0)} />
                <Satir icon="💔" label={`Kaybettiği: %${kayipOran}`} value={String(kayipSayi)} />
                <Satir icon="🍅" label={`Yarım Bıraktığı: %0`} value="0" />
                {/* Ünvan satırı — üye neyse (görvi) o yazılır, başında yıldız */}
                <Satir icon="⭐" label={superop} value="" />
                {/* Referanstaki yeşil seviye yazısı + üyelik tarihi */}
                <div className="flex items-center gap-1 mt-0.5">
                  <span className="flex-1 min-w-0 truncate text-center font-bold text-[#008000] whitespace-nowrap">{oyuncuSeviyesi(user)}</span>
                  <span className="text-[10px] text-[#606060] shrink-0">
                    Üyelik: {new Date(user.createdAt * 1000).toLocaleDateString("tr-TR")}
                  </span>
                </div>
              </div>
            </div>

            {/* Son çıkış satırı — referans üye profiliyle aynı ("44 nolu salondan çıkış yaptı") */}
            {cikisSatiri && (
              <div className="text-center text-[11px] leading-snug text-black bg-[#eef2fb] border border-[#c9d4ea] px-1 py-[3px]">
                {cikisSatiri}
              </div>
            )}

            {/* Rozet satırı — görev NEYSE o yazılır; gold üye 👑 rozeti */}
            <div className="flex items-center gap-1.5 flex-wrap">
              <RoleStar role={isSiteOwner(user.nick) ? "siteowner" : ""} rank={user.rank} size={13} />
              <span className="px-1.5 py-0.5 bg-[#0a246a] text-white text-[10px] font-bold border border-[#404040]">
                {profilUnvan(user)}
              </span>
              {user.gold != 0 && (
                <span className="px-1 py-0.5 bg-[#f7e463] border border-[#a08c1a] text-[10px] font-bold text-black" title="Gold Üye">👑 Gold</span>
              )}
            </div>

            {/* KIRMIZI "Üye Sayfasını Göster" satırı (referanstaki gibi) */}
            <button
              onClick={() => go({ name: "profil", nick })}
              className="flex items-center justify-between w-full px-1.5 py-0.5 bg-[#fbe3e3] hover:bg-[#fcd5d5] border border-[#c08080] text-[12px] font-bold"
              title="Üye sayfasını aç"
            >
              <span className="text-[#dc2626]">❤️ Üye Sayfasını Göster</span>
              <span className="text-[12px]">🎁🍬</span>
            </button>

            {/* Gözardı Et / İzin Ver + Ping + Şikayet/Düzenle */}
            <div className="flex items-center gap-1.5 flex-wrap">
              {!isMe && me && (
                <>
                  <button
                    onClick={() => {
                      gozardiEkle(nick);
                      setGoz(true);
                      showToast(`${nick} göz ardı edildi — sohbet mesajları görünmez.`);
                    }}
                    className={`px-2 py-0.5 text-[11px] font-bold text-black border-t border-l border-white border-b border-r border-[#404040] ${goz ? "bg-[#a0a0a0]" : "bg-[#d4d0c8] hover:bg-[#e0dcd4]"}`}
                  >
                    Gözardı Et
                  </button>
                  <button
                    onClick={() => {
                      gozardiKaldir(nick);
                      setGoz(false);
                      showToast(`${nick} için izin verildi — mesajlar görünür.`);
                    }}
                    className={`px-2 py-0.5 text-[11px] font-bold text-black border-t border-l border-white border-b border-r border-[#404040] ${!goz ? "bg-[#a0a0a0]" : "bg-[#d4d0c8] hover:bg-[#e0dcd4]"}`}
                  >
                    İzin Ver
                  </button>
                </>
              )}
              <span className="flex-1" />
              <button
                onClick={() => void pingOlcek()}
                className="text-[#0000cc] underline hover:text-[#cc0000] text-[11px] font-bold"
                title="Sunucu gecikmesini ölç"
              >
                Ping
              </button>
              {!isMe && me && (
                <button
                  onClick={() => setComplaining((v) => !v)}
                  className={`px-2 py-0.5 text-[11px] font-bold border ${
                    complaining
                      ? "bg-[#dc2626] text-white border-t border-l border-[#f87171] border-b border-r border-[#7f1d1d]"
                      : "text-black bg-[#f7e463] hover:bg-[#ffe95c] border-t border-l border-[#fffbe0] border-b border-r border-[#a08c1a]"
                  }`}
                >
                  🚫 Şikayet
                </button>
              )}
              {isMe && (
                <button
                  onClick={() => setEditing((v) => !v)}
                  className="px-2 py-0.5 text-[11px] font-bold text-black bg-[#f7e463] hover:bg-[#ffe95c] border border-[#a08c1a]"
                >
                  ✏️ {editing ? "Kapat" : "Düzenle"}
                </button>
              )}
            </div>

            {/* ÜYE SAYFASI — referanstaki büyük zemin; sohbet mesajları şeffaf
                panel olarak bindirilir; altta "Üye sayfası" linki + 💾 kaydet */}
            <div
              className="relative flex-1 min-h-[140px] border border-[#808080] overflow-hidden bg-white"
              style={{ backgroundImage: `url(${sayfaResmi})`, backgroundSize: "cover", backgroundPosition: "center" }}
            >
              {user.bio && (
                <div className="absolute top-0 inset-x-0 z-10 bg-white/75 px-1.5 py-0.5 text-[11px] text-black truncate border-b border-[#c0c0c0]">
                  {user.bio}
                </div>
              )}
              <div ref={chatRef} className="absolute inset-0 overflow-y-auto px-1.5 py-1 text-[12px] leading-[1.5] text-black bg-white/45">
                {msgs.length === 0 && <p className="text-[#404040]">Henüz mesaj yok — alttaki kutudan yazabilirsiniz.</p>}
                {msgs.map((m) => (
                  <p key={m.id}>
                    <span className="text-[#404040] text-[10px]">[{new Date(m.ts).toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" })}]</span>{" "}
                    <b>{m.nick}</b>: {m.text}
                  </p>
                ))}
              </div>

              {/* Şikayet formu — salon yöneticisi SEÇ ve ona gönder (zemin üzerinde) */}
              {!isMe && me && complaining && (
                <div className="absolute inset-0 z-20 overflow-y-auto p-1.5 bg-white/95 border border-[#808080] space-y-1.5 text-[12px] text-black">
                  <p className="font-bold">Şikayet Formu — {nick} hakkında</p>
                  {salon && yoneticiListe.length > 0 && (
                    <div>
                      <p className="text-[11px] font-bold mb-0.5">Salondaki yönetici (anlık iletilir):</p>
                      <select
                        value={sikayetYonetici}
                        onChange={(e) => setSikayetYonetici(e.target.value)}
                        className="w-full bg-white border border-[#404040] px-1.5 py-1 text-black focus:outline-none"
                      >
                        {yoneticiListe.map((y) => (
                          <option key={y.nick} value={y.nick}>{y.nick} ({y.rol})</option>
                        ))}
                      </select>
                    </div>
                  )}
                  <select
                    value={sikayetSebep}
                    onChange={(e) => setSikayetSebep(e.target.value)}
                    className="w-full bg-white border border-[#404040] px-1.5 py-1 text-black focus:outline-none"
                  >
                    {SIKAYET_SEBEPLERI.map((s) => (
                      <option key={s}>{s}</option>
                    ))}
                  </select>
                  <textarea
                    value={sikayetNot}
                    onChange={(e) => setSikayetNot(e.target.value)}
                    maxLength={200}
                    rows={2}
                    placeholder="Açıklama (isteğe bağlı)…"
                    className="w-full bg-white border border-[#404040] px-1.5 py-1 text-black resize-none focus:outline-none"
                  />
                  <button
                    onClick={sikayetGonder}
                    disabled={busy}
                    className="w-full py-1 bg-[#dc2626] hover:bg-[#b91c1c] disabled:opacity-60 text-white font-bold text-[12px] border-t border-l border-[#f87171] border-b border-r border-[#7f1d1d]"
                  >
                    Şikayeti Gönder
                  </button>
                </div>
              )}

              {/* Profil düzenleme (kendi profili) — resim URL/GIF + emoji + hakkımda */}
              {isMe && editing && (
                <div className="absolute inset-0 z-20 overflow-y-auto p-1.5 bg-white/95 border border-[#808080] space-y-2 text-[12px] text-black">
                  <div>
                    <p className="font-bold mb-1">Cinsiyet</p>
                    <div className="flex gap-2">
                      {([["e", "♂ Bay"], ["k", "♀ Bayan"]] as const).map(([v, label]) => (
                        <button
                          key={v}
                          onClick={() => setG(v)}
                          className={`flex-1 py-1 text-[12px] font-bold border ${
                            g === v
                              ? "bg-[#0a246a] text-white border-[#404040]"
                              : "bg-[#d4d0c8] text-black border-t border-l border-white border-b border-r border-[#404040]"
                          }`}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <p className="font-bold mb-1">Profil Resmi (emoji seç veya GIF/görsel URL)</p>
                    <div className="flex flex-wrap gap-1 mb-1.5">
                      {AVATAR_EMOJIS.map((e) => (
                        <button
                          key={e}
                          onClick={() => {
                            setAv(`emoji:${e}`);
                            setAvUrl("");
                          }}
                          className={`w-7 h-7 text-[15px] flex items-center justify-center border ${
                            av === `emoji:${e}`
                              ? "bg-[#0a246a] border-[#404040]"
                              : "bg-[#d4d0c8] border-t border-l border-white border-b border-r border-[#404040]"
                          }`}
                        >
                          {e}
                        </button>
                      ))}
                    </div>
                    <input
                      value={avUrl}
                      onChange={(e) => setAvUrl(e.target.value)}
                      placeholder="…veya görsel/HAREKETLİ GIF URL girin"
                      className="w-full bg-white border border-[#404040] px-2 py-1 text-black text-[12px] focus:outline-none"
                    />
                  </div>
                  <div>
                    <p className="font-bold mb-1">Hakkımda</p>
                    <textarea
                      value={bio}
                      onChange={(e) => setBio(e.target.value)}
                      maxLength={200}
                      rows={2}
                      placeholder="Kendinizden kısaca bahsedin…"
                      className="w-full bg-white border border-[#404040] px-2 py-1 text-black text-[12px] resize-none focus:outline-none"
                    />
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setEditing(false)}
                      className="flex-1 py-1 bg-[#d4d0c8] text-black text-[12px] font-bold border-t border-l border-white border-b border-r border-[#404040]"
                    >
                      Vazgeç
                    </button>
                    <button
                      onClick={save}
                      disabled={busy}
                      className="flex-1 py-1 bg-[#f7e463] hover:bg-[#ffe95c] disabled:opacity-60 text-black text-[12px] font-bold border-t border-l border-[#fffbe0] border-b border-r border-[#a08c1a]"
                    >
                      {busy ? "Kaydediliyor…" : "Kaydet"}
                    </button>
                  </div>
                </div>
              )}

              {/* Zemin alt şeridi: Üye sayfası linki + sohbet kaydet */}
              <div className="absolute bottom-0 inset-x-0 z-10 flex items-center justify-between px-1.5 py-0.5 bg-white/75 border-t border-[#c0c0c0]">
                <a
                  href="#profil"
                  onClick={(e) => {
                    e.preventDefault();
                    go({ name: "profil", nick });
                  }}
                  className="text-[#0000cc] underline hover:text-[#cc0000] font-bold text-[12px]"
                >
                  Üye sayfası
                </a>
                <button onClick={sohbetiKaydet} title="Sohbeti kaydet (.txt)" className="px-1 text-[12px] leading-4 hover:bg-white">
                  💾
                </button>
                {me && (
                  <button
                    onClick={() => void sohbetiSil()}
                    title="Sohbetteki tüm mesajları sil"
                    className="px-1 text-[12px] leading-4 text-[#dc2626] font-bold hover:bg-[#fcd5d5]"
                  >
                    🗑️ Sil
                  </button>
                )}
              </div>
            </div>

            {/* Emoji paleti — sarı 😗 düğmesiyle açılır */}
            {emo && (
              <div className="px-1 py-0.5 border border-[#808080] bg-[#d4d0c8] flex flex-wrap gap-0.5 max-h-[54px] overflow-y-auto shrink-0">
                {EMOJIS.map((e) => (
                  <button key={e} onClick={() => setMesaj((t) => (t + e).slice(0, 300))} title="Mesaja ekle" className="w-6 h-6 text-[14px] leading-none hover:bg-[#e8f0fc]">
                    {e}
                  </button>
                ))}
              </div>
            )}

            {/* ALT: mesaj kutusu + sarı emoji düğmesi (referanstaki gibi) */}
            <div className="flex gap-1 shrink-0">
              <input
                value={mesaj}
                onChange={(e) => setMesaj(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && void mesajGonder()}
                placeholder={me ? "Mesaj yaz… (Enter)" : "Sohbet için giriş yapın"}
                disabled={!me}
                maxLength={300}
                className="flex-1 min-w-0 bg-white border border-[#808080] px-1.5 py-1 text-black text-[12px] focus:outline-none disabled:bg-[#f0f0f0]"
              />
              <button
                onClick={() => setEmo((v) => !v)}
                title="Emojiler"
                className={`px-2 text-[14px] leading-none text-black border-t border-l border-[#fffbe0] border-b border-r border-[#a08c1a] ${emo ? "bg-[#ffe95c]" : "bg-[#f7e463] hover:bg-[#ffe95c]"}`}
              >
                🙂
              </button>
            </div>
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}
