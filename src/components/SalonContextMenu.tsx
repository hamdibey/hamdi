import { useEffect, useRef, useState } from "react";
import { klasikPrompt, klasikConfirm } from "../lib/klasikDialog";
import { can, RANKS, rankDef, has } from "../lib/ranks";
import { isSiteOwner, roleLabel } from "../lib/kira";
import { useApp } from "../store/useApp";
import { api } from "../lib/api";
import type { ApiMemberInfo, ApiModLog, ApiSalonStaff, ApiSalonUser, ApiTable } from "../lib/api";
import { MemberMap } from "./MemberMap";
import { KademeliMenu, klasikMenu, menuEylem } from "./SalonMenu";
import type { ModOp, RankId } from "../lib/types";

const TAHOMA = "Tahoma, Geneva, Verdana, sans-serif";

/**
 * Salon odasının SAĞ TIK MENÜSÜ — kademeli görev sistemi (klasik Hakkari düzeni):
 *  · 🟡 YÖNETİCİ → sistemden atma, ban (sebepli), ban kaldırma, off-line ban,
 *    susturma, mesaj engelleme, puanı 1500 yapma, IP görme (gizli), ban sayısı,
 *    bütün masalara mesaj, genel sohbet sil / aç-kapat, yöneticilere mesaj.
 *  · 🟣 SÜPER OP → yöneticinin TÜM görevleri + radyo aç/kapat/değiştir,
 *    yarışma duyurusu, yönetici seviyelerini görme, tüm op ban listesi.
 *  · 🔴 SALON SAHİBİ (Admin/As Admin) → süper op'un TÜM görevleri + yönetici
 *    ata/görevden al/offline al, offline seviye düşürme, diğer nickler,
 *    Cafe Gold mu?, PC başında mı?, açılış mesajı, yöneticilere açılış mesajı,
 *    popup reklamı, salon rengi, tüm masaları izleyiciye kapat.
 * Üst kademe her zaman alt kademenin TÜM maddelerini görür + ekstraları.
 */
export interface SalonCtxTarget {
  x: number;
  y: number;
  nick?: string;
  t?: ApiTable | null;
}

export function SalonContextMenu({
  target,
  onClose,
  onDone,
  onProfile,
  onOpenYonetim,
  salon,
  salonPower,
  canBots,
  canManageTables,
  tableOwner,
  botCount,
  targetBlocked,
  targetStaffRole,
  canStaffAssign,
  onManageStaff,
  onRefresh,
  myStaffRole,
  staffList,
  usersList,
  onClearChat,
  onToggleChat,
  onSetRadio,
  onWatchTable,
}: {
  target: SalonCtxTarget | null;
  onClose: () => void;
  onDone?: () => void;
  onProfile?: (nick: string) => void;
  onOpenYonetim?: () => void;
  salon: string;
  salonPower?: "full" | "mute" | undefined;
  canBots: boolean;
  canManageTables: boolean;
  tableOwner?: boolean;
  botCount: number;
  targetBlocked?: boolean;
  targetStaffRole?: string | null;
  canStaffAssign?: boolean;
  onManageStaff?: () => void;
  onRefresh?: () => void;
  /** Kullanıcının bu salondaki rolü — kademeli görev menüsü için */
  myStaffRole?: string | null;
  /** Salon ekibi listesi (seviye görme / offline düşürme) */
  staffList?: ApiSalonStaff[];
  /** Salondaki üyeler (PC başında mı — son görülme) */
  usersList?: ApiSalonUser[];
  /** Genel sohbeti temizle — yönetici görevi */
  onClearChat?: () => void;
  /** Genel sohbeti aç/kapat — yönetici görevi */
  onToggleChat?: () => void;
  /** Radyoyu değiştir — süper op / admin görevi */
  onSetRadio?: (r: string) => void;
  /** Masayı izleyici olarak aç (oturmadan izle) — herkese açık */
  onWatchTable?: (t: ApiTable) => void;
}) {
  const me = useApp((s) => s.me);
  const showToast = useApp((s) => s.showToast);
  const openPm = useApp((s) => s.openPm);
  const menuRef = useRef<HTMLDivElement | null>(null); // menü İÇİNDE kaydırma/kapatma koruması
  const [info, setInfo] = useState<ApiMemberInfo | null>(null);
  const [infoOpen, setInfoOpen] = useState(false);
  /** Klasik tam menü (web master) — 21 kategori kademeli */
  const [tamMenu, setTamMenu] = useState(false);
  /** Klasik bilgi penceresi — IP / ban sayısı / seviye / cafe gold / PC durumu */
  const [bilgi, setBilgi] = useState<{ baslik: string; satirlar: [string, string][] } | null>(null);

  useEffect(() => {
    if (!target) return;
    const close = () => onClose();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    // Menün İÇİNDE kaydırma menüyü KAPATMAZ (uzun görev listesi aşağı/yukarı kaydırılabilsin)
    const onScroll = (e: Event) => {
      const el = e.target as Node | null;
      if (menuRef.current && el && menuRef.current.contains(el)) return;
      close();
    };
    window.addEventListener("click", close);
    window.addEventListener("scroll", onScroll, true);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("click", close);
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("keydown", onKey);
    };
  }, [target, onClose]);

  if (!target || !me) return null;

  const t = target.t ?? null;
  const nick = target.nick;
  const isSelf = !!nick && nick === me.nick;
  const targetIsOwner = !!nick && isSiteOwner(nick);
  // Web master = "web master" nicksi VEYA admin kademesindeki herkes (site sahibi)
  const webMaster = isSiteOwner(me.nick) || has(me.rank, "admin");

  const showMember = !!nick;
  const showTable = !nick && !!t;
  // Bot bölümü artık YALNIZ boş alanda — salon araçlarıyla TEK listede birleşti
  const showBots = canBots && !t && !nick;
  const showSalonTools = !nick && !t && (salonPower !== undefined || canStaffAssign || webMaster || canBots);

  // ── Kademe hiyerarşisi: Yönetici(1) → Süper Op(2) → Salon Sahibi(3) → site(90) → web master(99) ──
  const myLvl = webMaster
    ? 99
    : has(me.rank, "yetkili")
    ? 90
    : myStaffRole === "admin" || myStaffRole === "owner"
    ? 3
    : myStaffRole === "superop"
    ? 2
    : myStaffRole === "yonetici"
    ? 1
    : salonPower === "full"
    ? 3
    : salonPower === "mute"
    ? 1
    : 0;
  const targetLvl = targetIsOwner
    ? 99
    : targetStaffRole === "admin" || targetStaffRole === "owner"
    ? 3
    : targetStaffRole === "superop"
    ? 2
    : targetStaffRole === "yonetici"
    ? 1
    : 0;
  // "Yöneticiler kendinden daha düşük seviyedeki yöneticiler ve oyuncular üzerinde işlem yapabilir"
  const memberOps = !!nick && !isSelf && !targetIsOwner && myLvl > targetLvl;
  const lvlYon = myLvl >= 1;
  const lvlSuper = myLvl >= 2;
  const lvlAdm = myLvl >= 3;

  // ── KLASİK DÜZEN: site sahibi / admin bir üye nicksine sağ tıklayınca
  // küçük menü yerine DOĞRUDAN 21 kategorili klasik Hakkari menüsü imleçte açılır. ──
  if (showMember && nick && !isSelf && !targetIsOwner && webMaster) {
    return (
      <div
        ref={menuRef}
        onClick={(e) => e.stopPropagation()}
        onContextMenu={(e) => { e.preventDefault(); onClose(); }}
      >
        <KademeliMenu
          x={target.x}
          y={target.y}
          baslik={`${nick}`}
          kategoriler={[
            {
              l: "Üye",
              gorevler: [
                { l: "👤 Profili Görüntüle", a: "__profil" },
                { l: "💬 Özel Mesaj", a: "__pm" },
              ],
            },
            ...klasikMenu(),
          ]}
          onSec={(a) => {
            if (a === "__profil") { onProfile?.(nick); onClose(); return; }
            if (a === "__pm") { openPm(nick); onClose(); return; }
            void menuEylem(a, nick, salon, {
              showToast,
              onDone,
              onOpenYonetim,
              onClearChat,
              onToggleChat,
              onSetRadio,
              go: (r) => useApp.getState().go(r as never),
            });
          }}
          onKapat={onClose}
        />
      </div>
    );
  }

  const act = async (op: ModOp, value?: string | number) => {
    if (!nick) return;
    const action =
      op === "mute" || op === "unmute"
        ? op
        : op === "goldOn" || op === "goldOff"
        ? "gold"
        : op;
    const v = op === "mute" ? 10 : op === "goldOn" ? 1 : op === "goldOff" ? 0 : value;
    try {
      await api.mod(action, nick, v, salon);
      showToast(`${nick} üzerinde işlem uygulandı.`);
      onDone?.();
    } catch (e) {
      showToast(e instanceof Error ? e.message : "İşlem başarısız oldu.");
    }
    onClose();
  };

  /** 1 — Sistemden atma: atılan oyuncu 30 sn içinde tekrar bağlanabilir */
  const sistemdenAt = async () => {
    if (!nick) return;
    if (!await klasikConfirm(`${nick} sistemden atılsın mı?\n(Atılan oyuncu 30 saniye içinde tekrar bağlanabilir.)`)) return;
    await act("kick");
  };

  /** 2 — Ban koyma: geçerli sebep zorunlu (şahsi sebep yasak) */
  const banKoy = async () => {
    if (!nick) return;
    const sebep = await klasikPrompt(
      `${nick} için ban sebebi yazın:\n(küfür, hakaret, reklam, hile şüphesi...)\nŞahsi sebeple banlamak yasaktır.`,
      ""
    );
    if (sebep == null) return;
    if (!sebep.trim()) {
      showToast("Ban için geçerli bir sebep yazmalısınız.");
      return;
    }
    try {
      await api.mod("ban", nick, sebep.trim(), salon);
      showToast(`${nick} banlandı — sebep: ${sebep.trim()}`);
      onDone?.();
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Banlanamadı.");
    }
    onClose();
  };

  /** 9 — Off-line ban: salondan çıkmış oyuncuyu nick ile banla */
  const offLineBan = async () => {
    const n = nick ?? await klasikPrompt("Banlanacak oyuncunun nick'ini yazın:");
    if (!n?.trim()) return;
    const sebep = await klasikPrompt(`Sebep (${n.trim()} için):`, "") ?? "";
    if (!sebep.trim()) {
      showToast("Ban için geçerli bir sebep yazmalısınız.");
      return;
    }
    try {
      await api.mod("ban", n.trim(), `[off-line] ${sebep.trim()}`);
      showToast(`${n.trim()} off-line banlandı — sebep: ${sebep.trim()}`);
      onDone?.();
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Banlanamadı.");
    }
    onClose();
  };

  /** 6 — Puanı 1500 yap: 1500'ün altındakilere; yükseklerde sistem izin vermez */
  const puan1500Yap = async () => {
    if (!nick) return;
    try {
      const r = await api.profile(nick);
      const puan = r.user.points ?? 0;
      if (puan >= 1500) {
        showToast(`${nick} — puanı ${puan}, 1500'ün üstünde. Sistem buna müsaade etmez.`);
        return;
      }
      await api.mod("points", nick, 1500 - puan);
      showToast(`${nick} — puanı 1500'e çıkarıldı.`);
      onDone?.();
    } catch (e) {
      showToast(e instanceof Error ? e.message : "İşlem yapılamadı.");
    }
    onClose();
  };

  /** 4 — IP görme: 2 basamak ** ile gizli + IP detay (ülke/şehir) */
  const ipGor = async () => {
    if (!nick) return;
    try {
      const r = await api.memberInfo(nick);
      const m = r.member;
      const gizli = m.openAddress ? m.openAddress.replace(/(\d+)\.(\d+)/, "$1.$2.**.**") : "—";
      setBilgi({
        baslik: `IP Görme — ${nick}`,
        satirlar: [
          ["IP (gizli)", gizli],
          ["Ülke", m.country || "—"],
          ["En yakın il", `${m.city || "—"} (kesin değildir)`],
        ],
      });
    } catch (e) {
      showToast(e instanceof Error ? e.message : "IP bilgisi alınamadı.");
    }
  };

  /** 13 — Diğer nickleri (sadece salon adminleri) */
  const digerNickleri = async () => {
    if (!nick) return;
    try {
      const r = await api.memberInfo(nick);
      const m = r.member;
      setBilgi({
        baslik: `Diğer Nickler — ${nick}`,
        satirlar: [
          ["Girdiği yer", m.loginWhere || "—"],
          ["Açık IP", m.openAddress || "—"],
          ["Not", "Cafe/okul gibi ortamlarda hatalı sonuç çıkabilir; kesin değildir. Bilgi paylaşımı yasaktır."],
        ],
      });
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Bilgi alınamadı.");
    }
  };

  /** 16 — Ban sayısı */
  const banSayisiGor = async () => {
    if (!nick) return;
    try {
      const r = await api.modLogs();
      const n = r.logs.filter((l) => l.targetNick === nick && l.action === "ban").length;
      setBilgi({ baslik: `Ban Sayısı — ${nick}`, satirlar: [["Toplam ban", `${n} kez`]] });
    } catch {
      setBilgi({ baslik: `Ban Sayısı — ${nick}`, satirlar: [["Toplam ban", "kayıt alınamadı"]] });
    }
  };

  /** 15 — Cafe Gold mu? */
  const cafeGoldMi = async () => {
    if (!nick) return;
    try {
      const r = await api.memberInfo(nick);
      setBilgi({
        baslik: `Cafe Gold — ${nick}`,
        satirlar: [
          ["Gold üye", r.member.gold ? "Evet" : "Hayır"],
          ["Cafe", r.member.loginWhere || "—"],
        ],
      });
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Bilgi alınamadı.");
    }
  };

  /** 29 — PC başında mı (10 dk hareketsizse nick eğik görünür) */
  const pcBasindaMi = () => {
    if (!nick) return;
    const u = (usersList ?? []).find((x) => x.nick === nick);
    if (!u) {
      setBilgi({ baslik: `PC Durumu — ${nick}`, satirlar: [["Durum", "Oyuncu şu an salonda değil (off-line)"]] });
      return;
    }
    const dk = Math.max(0, Math.round((Date.now() / 1000 - u.lastSeen) / 60));
    setBilgi({
      baslik: `PC Durumu — ${nick}`,
      satirlar: [
        ["Salonda", "Evet"],
        ["Son hareket", dk === 0 ? "Az önce" : `${dk} dakika önce`],
        ["Not", dk >= 10 ? "10 dakikadır hareket yok — nick'i eğik görünür." : "Oyuncu aktif."],
      ],
    });
  };

  /** 5 — Bütün masalara mesaj (genel duyuru) */
  const tumMasalaraMesaj = async () => {
    const msg = await klasikPrompt("Bütün masalara gönderilecek duyuru mesajı:");
    if (!msg?.trim()) return;
    try {
      await api.sendChat(salon, `📢 DUYURU: ${msg.trim()}`);
      showToast("Duyuru tüm masalara gönderildi.");
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Mesaj gönderilemedi.");
    }
    onClose();
  };

  /** 19 — Radyoyu aç/kapat/değiştir */
  const radyoDegistir = async () => {
    const r = await klasikPrompt("Radyo istasyonu yazın (örn: Akın FM, Power Türk) veya boş bırakın kapatmak için:");
    if (r == null) return;
    onSetRadio?.(r.trim() || "Kapalı");
    showToast(r.trim() ? `Radyo: ${r.trim()}` : "Radyo kapatıldı.");
    onClose();
  };

  /** Süper op — yarışma duyurusu */
  const yarismaDuyurusu = async () => {
    const msg = await klasikPrompt("Yarışma duyuru mesajı:", "Yarışmamız başlamıştır! Katılım için masalara oturun.");
    if (!msg?.trim()) return;
    try {
      await api.sendChat(salon, `🏁 YARIŞMA: ${msg.trim()}`);
      showToast("Yarışma duyurusu yapıldı.");
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Duyuru gönderilemedi.");
    }
    onClose();
  };

  /** 19 (süper op) — yönetici seviyelerini gör */
  const seviyeGor = () => {
    const liste = staffList ?? [];
    setBilgi({
      baslik: "Yönetici Seviyeleri",
      satirlar: liste.length
        ? liste.map((s) => [s.nick, s.role === "admin" ? "Salon Admin (Seviye 2)" : s.role === "superop" ? "Süper Op (Seviye 2)" : "Yönetici (Seviye 1)"])
        : [["Kayıt", "Bu salonda yönetici yok"]],
    });
  };

  /** 19 (süper op) — ban listesi (diğer op banları dahil) */
  const banListesiGor = async () => {
    try {
      const r = await api.modLogs();
      const bans = r.logs.filter((l) => l.action === "ban").slice(-15).reverse();
      setBilgi({
        baslik: "Ban Listesi",
        satirlar: bans.length
          ? bans.map((b) => [
              b.targetNick,
              `${b.actorNick}${b.detail ? ` — ${b.detail}` : ""} · ${new Date(b.createdAt * 1000).toLocaleString("tr-TR")}`,
            ])
          : [["Kayıt", "Ban kaydı yok"]],
      });
    } catch {
      setBilgi({ baslik: "Ban Listesi", satirlar: [["Kayıt", "alınamadı"]] });
    }
  };

  /** 23 — Yönetici ata / görevden al (admin) — 1550 puan, 3'ten az ban şartı */
  const yoneticiAta = async (role: "admin" | "superop" | "yonetici") => {
    if (!nick) return;
    // Sistem şartları: en az 1550 puan, 3'ten az ban
    try {
      const r = await api.profile(nick);
      if ((r.user.points ?? 0) < 1550) {
        showToast(`${nick} — en az 1550 puanı olmalı. Sistem izin vermiyor.`);
        return;
      }
      const logs = await api.modLogs();
      const banSayisi = logs.logs.filter((l) => l.targetNick === nick && l.action === "ban").length;
      if (banSayisi >= 3) {
        showToast(`${nick} — 3 veya daha fazla banı var. Sistem izin vermiyor.`);
        return;
      }
    } catch {
      /* kontrol atlanır — backend yine doğrular */
    }
    try {
      await api.salonStaffSet({ salon, action: "add", nick, role });
      showToast(`${nick} ${role === "admin" ? "Salon Admin" : role === "superop" ? "Süper Op" : "Yönetici"} yapıldı.`);
      onDone?.();
    } catch (e) {
      showToast(e instanceof Error ? e.message : "İşlem başarısız oldu.");
    }
    onClose();
  };

  /** 23 — Offline yöneticilikten al (nick ile) */
  const offlineYoneticiAl = async () => {
    const n = nick ?? await klasikPrompt("Yöneticilikten alınacak nick:");
    if (!n?.trim()) return;
    const s = (staffList ?? []).find((x) => x.nick === n.trim());
    if (!s) {
      showToast(`${n.trim()} bu salonda yönetici değil.`);
      return;
    }
    try {
      await api.salonStaffSet({ salon, action: "remove", nick: s.nick, role: s.role });
      showToast(`${s.nick} offline yöneticilikten alındı.`);
      onDone?.();
    } catch (e) {
      showToast(e instanceof Error ? e.message : "İşlem başarısız oldu.");
    }
    onClose();
  };

  /** 25 — Offline yönetici seviyesini düşür (süper op → yönetici) */
  const offlineSeviyeDusur = async () => {
    const n = nick ?? await klasikPrompt("Seviyesi düşürülecek yönetici nick:");
    if (!n?.trim()) return;
    const s = (staffList ?? []).find((x) => x.nick === n.trim());
    if (!s || s.role !== "superop") {
      showToast(`${n.trim()} süper op değil — düşürme yapılamadı.`);
      return;
    }
    try {
      await api.salonStaffSet({ salon, action: "remove", nick: s.nick, role: "superop" });
      await api.salonStaffSet({ salon, action: "add", nick: s.nick, role: "yonetici" });
      showToast(`${s.nick} seviye 1'e (yönetici) düşürüldü.`);
      onDone?.();
    } catch (e) {
      showToast(e instanceof Error ? e.message : "İşlem başarısız oldu.");
    }
    onClose();
  };

  /** 20 — Açılış mesajını belirle (salona girişte tüm üyelere) */
  const acilisMesaji = async () => {
    const m = await klasikPrompt("Salona girişte oyunculara gösterilecek mesajı yazın:", localStorage.getItem(`vk_acilis_${salon}`) ?? "");
    if (m == null) return;
    localStorage.setItem(`vk_acilis_${salon}`, m.trim());
    showToast("Açılış mesajı kaydedildi.");
    onClose();
  };

  /** 21 — Yöneticilere açılış mesajı (sadece yöneticilere gösterilir) */
  const yoneticiAcilisMesaji = async () => {
    const m = await klasikPrompt("Salona girişte SADECE YÖNETİCİLERE gösterilecek mesaj:", localStorage.getItem(`vk_acilis_yon_${salon}`) ?? "");
    if (m == null) return;
    localStorage.setItem(`vk_acilis_yon_${salon}`, m.trim());
    showToast("Yöneticilere açılış mesajı kaydedildi.");
    onClose();
  };

  /** 22 — Popup reklamı değiştir (salona girişte açılacak adres) */
  const popupReklam = async () => {
    const u = await klasikPrompt("Salona girişte açılacak popup adresi (http://... — ahlak dışı/yasadışı sayfalar yasak):", localStorage.getItem(`vk_popup_${salon}`) ?? "");
    if (u == null) return;
    localStorage.setItem(`vk_popup_${salon}`, u.trim());
    showToast(u.trim() ? "Popup reklam adresi kaydedildi." : "Popup kapatıldı.");
    onClose();
  };

  /** 26 — Salon rengi / orijinal renklere dön */
  const salonRengi = async () => {
    const c = await klasikPrompt("Salon yazı rengi (hex, örn #cc0000) — orijinal için boş bırakın:", localStorage.getItem(`vk_renk_${salon}`) ?? "");
    if (c == null) return;
    if (c.trim()) localStorage.setItem(`vk_renk_${salon}`, c.trim());
    else localStorage.removeItem(`vk_renk_${salon}`);
    showToast(c.trim() ? "Salon rengi değişti — yenileyin." : "Orijinal renklere dönüldü.");
    onClose();
  };

  /** 30 — Tüm masaları izleyiciye kapat (masa sahibi tekrar açabilir — tekrar tıklayınca açılır) */
  const izleyicileKapat = async () => {
    const anahtar = `vk_izleyici_${salon}`;
    const kapali = !!localStorage.getItem(anahtar);
    if (kapali) {
      localStorage.removeItem(anahtar);
      showToast("Masalar yeniden izleyiciye açıldı.");
      onClose();
      return;
    }
    if (!await klasikConfirm("Salondaki tüm açık masalar izleyiciye kapalı işaretlensin mi?\n(Masa sahipleri isterse tekrar açabilir; yeni açılan masalar etkilenmez.)")) return;
    localStorage.setItem(anahtar, String(Date.now()));
    showToast("Tüm masalar izleyiciye kapatıldı.");
    onClose();
  };

  /** Web master: üye bilgisi */
  const showInfo = async () => {
    if (!nick) return;
    try {
      const r = await api.memberInfo(nick);
      setInfo(r.member);
      setInfoOpen(true);
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Bilgi alınamadı.");
    }
  };

  /** Web master: kredi / puan ver-al */
  const moneyAct = async (action: "credit" | "points") => {
    if (!nick) return;
    const raw = await klasikPrompt(
      action === "credit"
        ? `${nick} üyesine KREDİ ver/al.\nÖrn: 1000 (ver) veya -500 (al):`
        : `${nick} üyesine PUAN ver/al.\nÖrn: 50 (ver) veya -50 (al):`,
      action === "credit" ? "1000" : "50"
    );
    if (raw == null) return;
    const amt = Math.trunc(Number(raw));
    if (!Number.isFinite(amt) || amt === 0) {
      showToast("Geçerli bir sayı girin.");
      return;
    }
    try {
      await api.mod(action, nick, amt);
      showToast(`${nick}: ${amt > 0 ? "+" : ""}${amt} ${action === "credit" ? "kredi" : "puan"} uygulandı.`);
      onDone?.();
    } catch (e) {
      showToast(e instanceof Error ? e.message : "İşlem başarısız oldu.");
    }
    onClose();
  };

  /** Salon ekibi atama/kaldırma (rol menüden seçilecek — yoneticiAta kullanın) */
  const staffAct = async (action: "add" | "remove", role: "admin" | "superop" | "yonetici") => {
    if (!nick) return;
    try {
      await api.salonStaffSet({ salon, action, nick, role });
      showToast(action === "add" ? `${nick} ${roleLabel(role)} yapıldı.` : `${nick} görevden alındı.`);
      onDone?.();
    } catch (e) {
      showToast(e instanceof Error ? e.message : "İşlem başarısız oldu.");
    }
    onClose();
  };
  const canAssignStaff = !!nick && memberOps && (canStaffAssign || me.rank === "admin" || webMaster);

  /** Bot işlemleri — site sahibi + admin */
  const botEkle = async (n: number) => {
    try {
      const r = await api.salonBotsAdd(salon, n);
      showToast(`${r.added} bot salona eklendi.`);
      onDone?.();
    } catch {
      showToast("Bot eklenemedi.");
    }
    onClose();
  };
  const botTemizle = async () => {
    try {
      const r = await api.salonBotsClear(salon);
      showToast(`${r.removed} bot salondan çıkarıldı.`);
      onDone?.();
    } catch {
      showToast("Botlar temizlenemedi.");
    }
    onClose();
  };

  /** Masa işlemleri */
  /** İzle — klasik kural 8: izleyiciye kapalı masalara bile yönetici girebilir */
  const masaIzle = () => {
    if (!t) return;
    // izleyici kapalı işareti varsa ve üye yetkisizse engelle; yönetici/site yetkilisi geçer
    const izleyiciKapali = !!localStorage.getItem(`vk_izleyici_${salon}`);
    if (izleyiciKapali && myLvl < 1) {
      showToast("Bu salonda masalar izleyiciye kapalı — yalnızca yöneticiler girebilir.");
      return;
    }
    onWatchTable?.(t);
    onClose();
  };
  const masaBotDavet = async () => {
    if (!t) return;
    try {
      const r = await api.inviteTableBots(t.id);
      showToast(`${r.joined} oyuncu masaya oturdu.`);
      onDone?.();
    } catch {
      showToast("Oyuncular davet edilemedi.");
    }
    onClose();
  };
  const masaKapat = async () => {
    if (!t) return;
    if (!await klasikConfirm(`${t.name || `Masa ${t.id}`} kapatılsın mı?`)) return;
    try {
      await api.closeTable(t.id);
      showToast("Masa kapatıldı.");
      onDone?.();
    } catch {
      showToast("Masa kapatılamadı.");
    }
    onClose();
  };

  // Başlıklar
  const headTitle = nick ? nick : t ? t.name || `Masa ${t.id}` : "Salon İşlemleri";
  const headSub = nick
    ? targetIsOwner
      ? "Site sahibi — korumalı"
      : myLvl >= 90
      ? "Site yetkilisi — tüm yetkiler"
      : myLvl === 3
      ? "Salon Sahibi — tüm görevler"
      : myLvl === 2
      ? "Süper Op — yönetici + ek görevler"
      : myLvl === 1
      ? "Yönetici — temel görevler"
      : "Üye — profil / özel mesaj"
    : t
    ? "Masa işlemi"
    : "Bot + salon işlemleri";

  const posLeft = Math.max(4, Math.min(target.x, window.innerWidth - 290));
  const posTop = Math.max(4, Math.min(target.y, window.innerHeight - 350));

  const btn = "block w-full text-left px-3 py-1 text-[12px] text-black hover:bg-[#0a246a] hover:text-white";
  const seclabel = "px-3 pt-1.5 pb-0.5 text-[10px] font-bold uppercase tracking-wide";
  const lvlTag = (renk: string, ad: string, ek: string) => (
    <p className={seclabel} style={{ color: renk }}>
      {ad} <span className="font-normal normal-case tracking-normal opacity-70">— {ek}</span>
    </p>
  );

  return (
    <div
      ref={menuRef}
      className="fixed z-[100] bg-[#d4d0c8] border-t border-l border-[#dfdfdf] border-b border-r border-[#404040] shadow-pop min-w-[240px] max-w-[300px] max-h-[86vh] overflow-y-auto"
      style={{ left: posLeft, top: posTop, fontFamily: TAHOMA }}
      onClick={(e) => e.stopPropagation()}
      onContextMenu={(e) => { e.preventDefault(); onClose(); }}
    >
      {/* Başlık */}
      <div className="px-3 py-1 bg-gradient-to-b from-[#3a6ea5] to-[#0a246a] text-white">
        <p className="font-bold text-[12px] truncate">{headTitle}</p>
        <p className="text-[10px] opacity-90 truncate">{headSub}</p>
      </div>

      {/* ═══ ÜYE İŞLEMLERİ (üye nicksine sağ tıklayınca) ═══ */}
      {showMember && nick && (
        <>
          <button onClick={() => { onProfile?.(nick); onClose(); }} className={btn}>
            👤 Profili Görüntüle
          </button>
          <button onClick={() => { openPm(nick); onClose(); }} className={btn}>
            💬 Özel Mesaj
          </button>

          {/* ── Web Master / Salon Sahibi: TAM KLASİK MENÜ (21 kategori — hepsi aktif) ── */}
          {(webMaster || lvlAdm) && !targetIsOwner && (
            <div className="border-t border-[#a0a0a0]">
              <p className={seclabel} style={{ color: "#0a246a" }}>👑 Site Sahibi — Tam Yetki</p>
              <button onClick={() => setTamMenu(true)} className={`${btn} !bg-[#0a246a] !text-white font-bold`}>
                🌐 Tam Klasik Menü (21 Kategori)
              </button>
              <button onClick={() => void showInfo()} className={btn}>📍 Üye Bilgisi (girdiği il + açık adres)</button>
              <button onClick={() => void moneyAct("credit")} className={btn}>💳 Kredi Ver / Al</button>
              <button onClick={() => void moneyAct("points")} className={btn}>⭐ Puan Ver / Al</button>
            </div>
          )}

          {memberOps && (
            <>
              {/* ═══ 🟡 YÖNETİCİ GÖREVLERİ (en alt kademe — üst kademelerde de görünür) ═══ */}
              {lvlYon && (
                <div className="border-t border-[#a0a0a0]">
                  {lvlTag("#b45309", "🟡 Yönetici Görevleri", "Seviye 1")}
                  <button onClick={() => void sistemdenAt()} className={btn}>1. Sistemden At (30 sn sonra dönebilir)</button>
                  <button onClick={() => void banKoy()} className={`${btn} !text-[#991b1b]`}>2. Ban Koy (sebep zorunlu)</button>
                  <button onClick={() => void act("unban")} className={btn}>3. Ban Kaldır</button>
                  <button onClick={() => void ipGor()} className={btn}>4. IP Gör (gizli — 2 basamak **)</button>
                  <button onClick={() => void tumMasalaraMesaj()} className={btn}>5. Bütün Masalara Mesaj</button>
                  <button onClick={() => void puan1500Yap()} className={btn}>6. Puanı 1500 Yap</button>
                  <button onClick={() => void offLineBan()} className={`${btn} !text-[#991b1b]`}>9. Off-Line Ban Koy</button>
                  {onToggleChat && (
                    <button onClick={() => { onToggleChat(); onClose(); }} className={btn}>11. Genel Sohbeti Aç / Kapat</button>
                  )}
                  {onOpenYonetim && (
                    <button onClick={() => { onOpenYonetim(); onClose(); }} className={btn}>12. Yöneticilere Mesaj (Yönetim Paneli)</button>
                  )}
                  <button onClick={() => void cafeGoldMi()} className={btn}>15. Cafe Gold mu?</button>
                  <button onClick={() => void banSayisiGor()} className={btn}>16. Ban Sayısı</button>
                  {onClearChat && (
                    <button onClick={() => { onClearChat(); onClose(); }} className={btn}>17. Genel Sohbeti Sil</button>
                  )}
                  {isSelf && myStaffRole === "yonetici" && (
                    <button onClick={() => void staffAct("remove", "yonetici")} className={btn}>18. Yöneticilikten Ayrıl</button>
                  )}
                  <button onClick={() => void act((targetBlocked ? "unblock" : "block") as ModOp)} className={btn}>
                    {targetBlocked ? "✅ Mesaj Engelini Kaldır" : "🚫 Mesaj Engelle (salon)"}
                  </button>
                  <button onClick={() => void act("mute")} className={btn}>🔇 Sustur (10 dk)</button>
                  <button onClick={() => void act("unmute")} className={btn}>🔊 Susturmayı Kaldır</button>
                </div>
              )}

              {/* ═══ 🟣 SÜPER OP EK GÖREVLERİ (yöneticinin tümü + bunlar) ═══ */}
              {lvlSuper && (
                <div className="border-t border-[#a0a0a0]">
                  {lvlTag("#7c3aed", "🟣 Süper Op Ek Görevleri", "Seviye 2")}
                  <button onClick={radyoDegistir} className={btn}>19. Radyoyu Aç / Kapat / Değiştir</button>
                  <button onClick={() => void yarismaDuyurusu()} className={btn}>🏁 Yarışma Duyurusu Yap</button>
                  <button onClick={seviyeGor} className={btn}>24. Yönetici Seviyelerini Gör</button>
                  <button onClick={() => void banListesiGor()} className={btn}>📋 Ban Listesi (tüm op banları)</button>
                </div>
              )}

              {/* ═══ 🔴 SALON SAHİBİ EK GÖREVLERİ (admin / as admin — süper op'un tümü + bunlar) ═══ */}
              {lvlAdm && (
                <div className="border-t border-[#a0a0a0]">
                  {lvlTag("#b91c1c", "🔴 Salon Sahibi Ek Görevleri", "Admin")}
                  {canAssignStaff && !targetStaffRole && (
                    <>
                      <button onClick={() => void yoneticiAta("yonetici")} className={btn}>23. Yönetici Ata (en az 1550 puan, &lt;3 ban)</button>
                      <button onClick={() => void yoneticiAta("superop")} className={btn}>28. Süper Op Ata (2 kişi)</button>
                      <button onClick={() => void yoneticiAta("admin")} className={btn}>27. Admin Ata (2 kişi)</button>
                    </>
                  )}
                  {canAssignStaff && targetStaffRole && (
                    <button onClick={() => void staffAct("remove", targetStaffRole as "admin" | "superop" | "yonetici")} className={`${btn} !text-[#991b1b]`}>
                      ✖ Görevden Al ({targetStaffRole === "admin" ? "Salon Admin" : targetStaffRole === "superop" ? "Süper Op" : "Yönetici"})
                    </button>
                  )}
                  <button onClick={() => void offlineYoneticiAl()} className={btn}>23. Offline Yöneticilikten Al</button>
                  <button onClick={() => void offlineSeviyeDusur()} className={btn}>25. Offline Yönetici Seviyesini Düşür</button>
                  <button onClick={() => void digerNickleri()} className={btn}>13. Diğer Nickleri (sadece admin)</button>
                  <button onClick={() => void pcBasindaMi()} className={btn}>29. PC Başında mı?</button>
                  <button onClick={acilisMesaji} className={btn}>20. Açılış Mesajını Belirle</button>
                  <button onClick={yoneticiAcilisMesaji} className={btn}>21. Yöneticilere Açılış Mesajı</button>
                  <button onClick={popupReklam} className={btn}>22. Popup Reklamı Değiştir</button>
                  <button onClick={salonRengi} className={btn}>26. Salon Rengi / Orijinale Dön</button>
                  <button onClick={izleyicileKapat} className={btn}>
                    30. {localStorage.getItem(`vk_izleyici_${salon}`) ? "Masaları İzleyiciye Yeniden Aç" : "Tüm Masaları İzleyiciye Kapat"}
                  </button>
                  {isSelf && (myStaffRole === "superop" || myStaffRole === "yonetici") && (
                    <button onClick={() => void staffAct("remove", myStaffRole as "superop" | "yonetici")} className={btn}>18. Yöneticilikten Ayrıl</button>
                  )}
                </div>
              )}
            </>
          )}
        </>
      )}

      {/* ═══ SADECE MASA İŞLEMLERİ ═══ */}
      {showTable && t && (
        <div>
          <p className={seclabel}>🪑 {t.name || `Masa ${t.id}`}</p>
          {/* İzle — herkese açık (izleyiciye kapalı salonlarda yönetici girebilir, kural 8) */}
          <button onClick={masaIzle} className={btn} title="Masaya oturmadan izleyici olarak gir">
            👁️ Masayı İzle
          </button>
          {(canManageTables || tableOwner) && (
            <button onClick={() => void masaBotDavet()} className={btn}>Rakip Davet Et (boş koltukları doldur)</button>
          )}
          {(canManageTables || tableOwner) && (
            <button onClick={() => void masaKapat()} className={`${btn} !text-[#991b1b] hover:!bg-[#7f1d1d] hover:!text-white`}>
              ✖ Masayı Kapat
            </button>
          )}
        </div>
      )}

      {/* ═══ SALON İŞLEMLERİ — botlar dahil TEK listede (boş alanda) ═══ */}
      {showSalonTools && (
        <div>
          <p className={seclabel}>🛠️ Salon İşlemleri</p>
          {onManageStaff && (canStaffAssign || webMaster) && (
            <button onClick={() => { onManageStaff(); onClose(); }} className={btn}>★ Salon Ekibi</button>
          )}
          {(salonPower !== undefined || webMaster) && onOpenYonetim && (
            <button onClick={() => { onOpenYonetim(); onClose(); }} className={btn}>🛡️ Yönetim Paneli</button>
          )}
          {onRefresh && (
            <button onClick={() => { onRefresh(); onClose(); }} className={btn}>⟳ Yenile</button>
          )}
          {canBots && (
            <>
              <p className={seclabel}>🤖 Botlar — {botCount} bot var</p>
              <button onClick={() => void botEkle(1)} className={btn}>🤖 1 Bot At</button>
              <button onClick={() => void botEkle(5)} className={btn}>🤖 5 Bot At</button>
              <button onClick={() => void botEkle(10)} className={btn}>🤖 10 Bot At</button>
              <button onClick={() => void botEkle(20)} className={btn}>🤖 20 Bot At (Dolu Salon)</button>
              <div className="px-3 py-1">
                <p className="text-[10px] font-bold text-[#404040] mb-0.5">İstediğin kadar bot at</p>
                <div className="flex gap-1">
                  <input
                    id="vk-bot-custom"
                    type="number"
                    min={1}
                    max={100}
                    defaultValue={30}
                    className="flex-1 min-w-0 bg-white border border-[#808080] px-1 py-0.5 text-[12px]"
                    onClick={(e) => e.stopPropagation()}
                  />
                  <button
                    onClick={() => {
                      const el = document.getElementById("vk-bot-custom") as HTMLInputElement | null;
                      const n = Math.min(Math.max(parseInt(el?.value || "1") || 1, 1), 100);
                      void botEkle(n);
                    }}
                    className="px-2 py-0.5 text-[12px] bg-[#d4d0c8] border-t border-l border-[#dfdfdf] border-b border-r border-[#404040]"
                  >
                    At
                  </button>
                </div>
              </div>
              <button onClick={() => void botTemizle()} className={btn}>🧹 Tüm Botları Çıkar</button>
            </>
          )}
        </div>
      )}

      {!showMember && !showBots && !showTable && !showSalonTools && (
        <p className="px-3 py-2 text-[11px] text-[#404040]">Bu öğe için yapılabilecek işlem yok.</p>
      )}

      <p className="px-3 py-1 text-[10px] text-[#404040] border-t border-[#a0a0a0]">
        {showMember ? "Üye işlemleri — ESC veya tıkla ile kapanır." : "ESC veya tıkla ile kapanır."}
      </p>

      {/* Web Master üye bilgi penceresi */}
      {infoOpen && info && (
        <div className="fixed inset-0 z-[110] bg-black/40 flex items-center justify-center p-3" onClick={() => setInfoOpen(false)}>
          <div className="bg-[#d4d0c8] border-t border-l border-[#dfdfdf] border-b border-r border-[#404040] shadow-pop w-full max-w-sm" style={{ fontFamily: TAHOMA }} onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-2 py-1 bg-gradient-to-b from-[#3a6ea5] to-[#0a246a] text-white text-xs font-bold">
              <span>[ Üye Bilgisi — {info.nick} ]</span>
              <button onClick={() => setInfoOpen(false)} className="px-1.5 bg-[#d4d0c8] text-black leading-4">×</button>
            </div>
            <div className="p-3 text-[12px] text-black space-y-1">
              <Satir k="Girdiği İl / Konum" v={info.loginWhere} />
              <Satir k="Açık Adres (IP)" v={info.openAddress} />
              <div className="pt-1">
                <p className="text-[10px] font-bold text-[#404040] mb-1">📍 Giriş Haritası</p>
                <MemberMap lat={info.lat} lng={info.lng} where={info.loginWhere} />
              </div>
              <Satir k="Kayıt İl / Ülke" v={[info.city, info.country].filter(Boolean).join(" / ") || "—"} />
              <Satir k="E-posta" v={info.email || "—"} />
              <Satir k="Kademe" v={info.rank} />
              <Satir k="Kredi (çip)" v={String(info.chips)} />
              <Satir k="Puan" v={String(info.points)} />
              <Satir k="Son Giriş" v={info.loginAt ? new Date(info.loginAt * 1000).toLocaleString("tr-TR") : "—"} />
              <Satir k="Kayıt Tarihi" v={new Date(info.createdAt * 1000).toLocaleDateString("tr-TR")} />
            </div>
          </div>
        </div>
      )}

      {/* ── TAM KLASİK MENÜ (web master) — 21 kategori, hepsi aktif ── */}
      {tamMenu && nick && (
        <KademeliMenu
          kategoriler={klasikMenu()}
          baslik={`👑 ${nick} — Tam Menü`}
          x={target.x}
          y={target.y}
          onSec={(a) => {
            void menuEylem(a, nick, salon, {
              showToast,
              onDone,
              onOpenYonetim,
              onClearChat,
              onToggleChat,
              onSetRadio,
              go: (r) => useApp.getState().go(r as never),
            });
          }}
          onKapat={() => setTamMenu(false)}
        />
      )}

      {/* Klasik bilgi penceresi — IP / ban sayısı / seviye / cafe gold / PC durumu */}
      {bilgi && (
        <div className="fixed inset-0 z-[110] bg-black/40 flex items-center justify-center p-3" onClick={() => setBilgi(null)}>
          <div className="bg-[#d4d0c8] border-t border-l border-[#dfdfdf] border-b border-r border-[#404040] shadow-pop w-full max-w-sm" style={{ fontFamily: TAHOMA }} onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-2 py-1 bg-gradient-to-b from-[#3a6ea5] to-[#0a246a] text-white text-xs font-bold">
              <span className="truncate">[ {bilgi.baslik} ]</span>
              <button onClick={() => setBilgi(null)} className="px-1.5 bg-[#d4d0c8] text-black leading-4">×</button>
            </div>
            <div className="p-3 text-[12px] text-black space-y-1">
              {bilgi.satirlar.map(([k, v], i) => (
                <Satir key={i} k={k} v={v} />
              ))}
            </div>
            <div className="flex justify-end px-3 pb-2">
              <button
                onClick={() => setBilgi(null)}
                className="px-3 py-1 text-[12px] text-black bg-[#d4d0c8] border-t border-l border-white border-b border-r border-[#404040]"
              >
                Tamam
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Satir({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between gap-2 border-b border-[#c0c0c0] pb-0.5">
      <span className="font-bold text-[#404040]">{k}</span>
      <span className="text-right">{v}</span>
    </div>
  );
}
