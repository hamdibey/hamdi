import { useCallback, useEffect, useRef, useState } from "react";
import { useApp } from "../store/useApp";
import { isElectronWin } from "../store/useDesktop";
import { ChatPanel } from "../components/ChatPanel";
import { ProfileModal, Avatar } from "../components/ProfileModal";
import { api, getToken, parsePlayers } from "../lib/api";
import type { ApiRental, ApiSalonUser, ApiSalonStaff, ApiTable, ApiTopUser } from "../lib/api";
import { FLOORS, SLOTS_PER_FLOOR, salonTitle, roleLabel, STAFF_ROLES, isSiteOwner, STAFF_TIER_RANKS, staffTier } from "../lib/kira";
import { nickTextColor, NICK_PALETTE, isStaffNick } from "../lib/colors";
// (kademeler `me.rank` üzerinden doğrudan kontrol edilir)
import type { GameId } from "../lib/types";
import { RoleStar } from "../components/RoleStar";
import { SalonContextMenu } from "../components/SalonContextMenu";
import type { SalonCtxTarget } from "../components/SalonContextMenu";
import { CreateTableModal, CARPAN_KREDI, X9_ICIN_GEREKLI, X99_ICIN_GEREKLI, girisKisiti, type Carpan } from "../components/CreateTableModal";
import type { TableSettings } from "../components/CreateTableModal";
import { ayarlariKaydet, ayarlariYukle, ZIL_TURLERI } from "../lib/ayarlar";
import type { Ayarlar } from "../lib/ayarlar";
import { zilOnizle } from "../components/VoiceCall";
import { AutoFit } from "../components/AutoFit";
import { klasikPrompt, klasikConfirm } from "../lib/klasikDialog";
import { radyoBaslat, radyoDurdur, radyoSesAyarla, radyoKayitliUrl, radyoKayitliIstasyon, radyoUrlKaydet } from "../lib/radyo";

// ---------------------------------------------------------------------------
// Klasik masaüstü tarzı salon odası (hakkarim.net düzeni):
// pencere başlığı · kat sekmeleri · salon bandı (oyuncu/ping) · menü çubuğu ·
// masa listesi tablosu · klasik sohbet · üye listesi + TOP 10 · alt düğmeler.
// Yöneticiler avatar yerine rol yıldızı taşır; salon adını site sahibi belirler.
// ---------------------------------------------------------------------------

const TAHOMA = "Tahoma, Geneva, Verdana, sans-serif";

/** Üye listesi sıralaması: site sahibi en üstte, sonra rol önceliği (sağdaki yıldız sırası) */
const ROLE_ORDER: Record<string, number> = { siteowner: 0, owner: 1, admin: 2, superop: 3, yonetici: 4, member: 5 };
type MemberSortKey = "nick" | "role" | "puan" | "masa";

const GAME_LABEL: Record<string, string> = {
  yuzbir: "101", otuzdort: "34", ellibir: "51",
  okey: "Okey", batak: "Batak", domino: "Domino",
};

/** Referanstaki klasik radyo kutusu seçenekleri */
const RADIOS = ["Akın FM", "Radyo Vatan", "Power Türk", "Joy Türk", "Slow Türk"];

/** Referanstaki klasik masa ikonu: kırmızı daire içinde beyaz oyun kodu (101 → "10") */
const GAME_BADGE: Record<string, string> = {
  yuzbir: "10", okey: "O", otuzdort: "34", ellibir: "51",
  batak: "B", domino: "D",
};

/** Klasik masaüstü düğmesi (kabartma kenarlık) */
function KBtn({
  children, onClick, disabled, title,
}: { children: React.ReactNode; onClick?: () => void; disabled?: boolean; title?: string }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={title}
      className="px-2.5 py-1 text-[12px] text-black bg-[#d4d0c8] border-t border-l border-white border-b border-r border-[#404040] active:border-t active:border-l active:border-[#404040] active:border-b active:border-r active:border-white disabled:opacity-50 whitespace-nowrap"
    >
      {children}
    </button>
  );
}

/** Klasik panel başlığı (mavi çubuk) */
function KTitle({ children, right }: { children: React.ReactNode; right?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between px-2 py-0.5 bg-gradient-to-b from-[#3a6ea5] to-[#0a246a] text-white text-[11px] font-bold">
      <span>{children}</span>
      {right && <span className="font-normal opacity-90">{right}</span>}
    </div>
  );
}

/** Gömülü lobi kabuğu: kısa salon adı + canlı üye sayısını üst başlık çubuğu için bildirir */
function InfoBridge({
  onInfo,
  title,
  count,
}: {
  onInfo?: (t: string, n: number) => void;
  title: string;
  count: number;
}) {
  useEffect(() => {
    onInfo?.(title, count);
  }, [onInfo, title, count]);
  return null;
}

/** Ayarlar penceresi avatar paleti (klasik üye avatarları) */
const AYAR_AVATARS = ["🦊", "🐼", "🐯", "🦁", "🐸", "🐵", "🐰", "🦄", "🐺", "🐨", "🦅", "🦉", "♠️", "♥️", "🎲", "🀄", "🏆", "⭐", "👑", "🎯"];

/** Klasik "Ayarlar" penceresi — ses · oyun hızı · görüntü · profil (avatar/nick/yazı rengi) */
function AyarlarPenceresi({
  value,
  onChange,
  onClose,
}: {
  value: Ayarlar;
  onChange: (a: Ayarlar) => void;
  onClose: () => void;
}) {
  const me = useApp((s) => s.me);
  const syncMe = useApp((s) => s.syncMe);
  const showToast = useApp((s) => s.showToast);
  const [profilBusy, setProfilBusy] = useState(false);

  const set = (patch: Partial<Ayarlar>) => {
    const a = { ...value, ...patch };
    onChange(a);
    ayarlariKaydet(a);
  };

  // Profil ayarları — avatar / nick rengi / yazı rengi backend'e yazılır
  const profilKaydet = async (patch: { avatar?: string; nickColor?: string; textColor?: string }) => {
    if (profilBusy) return;
    setProfilBusy(true);
    try {
      await api.updateProfile(patch);
      await syncMe();
      showToast("Ayarınız kaydedildi.");
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Ayar kaydedilemedi.");
    }
    setProfilBusy(false);
  };

  const staffNick = me ? isStaffNick(me.nick, me.rank) : false;
  return (
    <div className="fixed inset-0 z-[96] bg-black/60 flex items-center justify-center p-4" onClick={onClose}>
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-[#d4d0c8] border-t border-l border-[#dfdfdf] border-b border-r border-[#404040] shadow-pop w-full max-w-[400px]"
        style={{ fontFamily: TAHOMA }}
      >
        <div className="flex items-center justify-between px-2 py-1 bg-gradient-to-b from-[#3a6ea5] to-[#0a246a] text-white text-xs font-bold">
          <span>[ Ayarlar ]</span>
          <button onClick={onClose} className="px-1.5 bg-[#d4d0c8] text-black leading-4">×</button>
        </div>
        <div className="p-3 space-y-3 text-[12px] text-black">
          <fieldset className="border border-[#808080] px-3 pb-3 pt-1">
            <legend className="px-1 font-bold">Ses</legend>
            <label className="flex items-center gap-2 mb-1.5 cursor-pointer">
              <input type="checkbox" checked={value.efekt} onChange={(e) => set({ efekt: e.target.checked })} />
              Efekt sesleri
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              Radyo sesi
              <input
                type="range"
                min={0}
                max={100}
                value={value.radyo}
                onChange={(e) => set({ radyo: Number(e.target.value) })}
                className="flex-1"
              />
              <span className="w-9 text-right tabular-nums">%{value.radyo}</span>
            </label>
            {/* Sesli görüşme zil sesi — dinle butonuyla önizlenir */}
            <label className="flex items-center gap-2 mt-1.5 cursor-pointer">
              Zil sesi
              <select
                value={value.zil}
                onChange={(e) => set({ zil: e.target.value as Ayarlar["zil"] })}
                className="border border-[#a0a0a0] bg-white px-1 py-0.5 ml-1"
              >
                {ZIL_TURLERI.map((z) => (
                  <option key={z.tur} value={z.tur}>
                    {z.ad}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => zilOnizle()}
                title="Seçili zil sesini dinle"
                className="px-2 py-0.5 bg-[#d4d0c8] border border-[#ffffff] border-b-[#404040] border-r-[#404040] text-[11px]"
              >
                ▶ Dinle
              </button>
            </label>
          </fieldset>
          <fieldset className="border border-[#808080] px-3 pb-3 pt-1">
            <legend className="px-1 font-bold">
              Oyun Hızı <span className="font-normal text-[10px] text-black">— AI hamlelerinin hızı (oyun masalarına yansır)</span>
            </legend>
            <div className="flex gap-5">
              {([ ["yavas", "Yavaş"], ["normal", "Normal"], ["hizli", "Hızlı"] ] as const).map(([v, l]) => (
                <label key={v} className="flex items-center gap-1.5 cursor-pointer">
                  <input type="radio" name="vk-hiz" checked={value.hiz === v} onChange={() => set({ hiz: v })} />
                  {l}
                </label>
              ))}
            </div>
          </fieldset>
          <fieldset className="border border-[#808080] px-3 pb-3 pt-1">
            <legend className="px-1 font-bold">Görüntü</legend>
            <label className="flex items-center gap-2 mb-1.5 cursor-pointer">
              <input type="checkbox" checked={value.emojiler} onChange={(e) => set({ emojiler: e.target.checked })} />
              Emojileri göster
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              Masa deseni
              <select
                value={value.desen}
                onChange={(e) => set({ desen: Number(e.target.value) })}
                className="border border-[#a0a0a0] bg-white px-1 py-0.5 ml-2"
              >
                {[12, 24, 36].map((d) => (
                  <option key={d} value={d}>Desen {d}</option>
                ))}
              </select>
            </label>
          </fieldset>
          <fieldset className="border border-[#808080] px-3 pb-3 pt-1">
            <legend className="px-1 font-bold">Profilim</legend>
            {/* Avatar seçimi */}
            <p className="text-[11px] text-black mb-1">Avatar seçin:</p>
            <div className="flex flex-wrap gap-1 mb-2">
              {AYAR_AVATARS.map((e) => {
                const val = `emoji:${e}`;
                const aktif = me?.avatar === val;
                return (
                  <button
                    key={e}
                    disabled={profilBusy}
                    onClick={() => void profilKaydet({ avatar: val })}
                    title={`Avatar ${e}`}
                    className={`w-8 h-8 text-lg leading-none bg-white border ${
                      aktif ? "border-[#0a246a] border-2" : "border-[#a0a0a0]"
                    } hover:bg-[#e8e4dc] disabled:opacity-50`}
                  >
                    {e}
                  </button>
                );
              })}
            </div>
            {/* Nick rengi */}
            <p className="text-[11px] text-black mb-1">
              Nick rengi:{staffNick ? " (yöneticiler için mavi)" : ""}
            </p>
            <div className="flex flex-wrap gap-1 mb-2">
              {NICK_PALETTE.map((p) => (
                <button
                  key={p.color}
                  disabled={staffNick || profilBusy}
                  onClick={() => void profilKaydet({ nickColor: p.color })}
                  title={p.label}
                  className={`w-6 h-6 rounded-full border disabled:opacity-40 hover:scale-110 transition-transform ${
                    me?.nickColor?.toLowerCase() === p.color ? "border-[#0a246a]" : "border-[#808080]"
                  }`}
                  style={{ backgroundColor: p.color }}
                />
              ))}
              {me?.nickColor && !staffNick && (
                <button
                  disabled={profilBusy}
                  onClick={() => void profilKaydet({ nickColor: "" })}
                  className="px-1.5 text-[10px] bg-white border border-[#a0a0a0] hover:bg-[#e8e4dc] disabled:opacity-50"
                >
                  Varsayılan
                </button>
              )}
            </div>
            {/* Yazı (mesaj) rengi */}
            <p className="text-[11px] text-black mb-1">Yazı rengi (mesajlarınız):</p>
            <div className="flex flex-wrap gap-1 items-center">
              {NICK_PALETTE.map((p) => (
                <button
                  key={p.color}
                  disabled={profilBusy}
                  onClick={() => void profilKaydet({ textColor: p.color })}
                  title={p.label}
                  className={`w-6 h-6 rounded-full border disabled:opacity-40 hover:scale-110 transition-transform ${
                    me?.textColor?.toLowerCase() === p.color ? "border-[#0a246a]" : "border-[#808080]"
                  }`}
                  style={{ backgroundColor: p.color }}
                />
              ))}
              <input
                type="color"
                disabled={profilBusy}
                value={me?.textColor || "#111111"}
                onChange={(e) => void profilKaydet({ textColor: e.target.value.toLowerCase() })}
                title="Serbest renk"
                className="w-7 h-6 bg-white border border-[#a0a0a0] cursor-pointer disabled:opacity-50"
              />
              {me?.textColor && (
                <button
                  disabled={profilBusy}
                  onClick={() => void profilKaydet({ textColor: "" })}
                  className="px-1.5 text-[10px] bg-white border border-[#a0a0a0] hover:bg-[#e8e4dc] disabled:opacity-50"
                >
                  Varsayılan
                </button>
              )}
            </div>
          </fieldset>
        </div>
        <div className="flex justify-end px-3 pb-3">
          <KBtn onClick={onClose}>Tamam</KBtn>
        </div>
      </div>
    </div>
  );
}

/** Masa ayarlarından okunabilir metin: "101, Cezalı, 5 El, Eşli, Artırmalı, x9" */
const ayarMetni = (t: ApiTable) => {
  let s: Record<string, unknown> = {};
  try { s = t.settings ? JSON.parse(t.settings) : {}; } catch { s = {}; }
  // Referans klasik istemcide Ayarlar sütununda yalnızca ayarlar görünür ("Cezalı, 11 El") — oyun adı kırmızı daire ikonunda
  const parts: string[] = [];
  if (s.cezali) parts.push("Cezalı");
  if (s.eglence) parts.push("Eğlence");
  if (s.klasman) parts.push("Klasman");
  if (s.esli) parts.push("Eşli");
  if (s.artirmali) parts.push("Artırmalı");
  if (s.defineli) parts.push("Defineli");
  const carpan = Number(s.carpan);
  if (carpan > 1) parts.push(`x${carpan}`);
  if (carpan > 1 && s.sure) parts.push(`${s.sure} Saat`);
  if (s.hediye && carpan > 1) parts.push("Hediye");
  if (s.canak) parts.push("Çanaklı");
  if (s.herkes) parts.push("Herkes Açık");
  if (s.elSayisi) parts.push(`${s.elSayisi} El`);
  return parts.join(", ");
};

/** Masa "davetli" ayarıyla açılmış mı? (boş koltukta "Davetli" yazması için) */
const masaDavetli = (t: ApiTable) => {
  try {
    const s: Record<string, unknown> = t.settings ? JSON.parse(t.settings) : {};
    return !!s.davet;
  } catch { return false; }
};

export function SalonRoomPage({
  floor,
  slot,
  embedded = false,
  onInfo,
}: {
  floor: number;
  slot: number;
  embedded?: boolean;
  /** Gömülü (lobi) modda: kısa salon adı + içerideki üye sayısı üst kabuğa bildirilir */
  onInfo?: (title: string, count: number) => void;
}) {
  const go = useApp((s) => s.go);
  const me = useApp((s) => s.me);
  const logout = useApp((s) => s.logout);
  const showToast = useApp((s) => s.showToast);
  const setTableGame = useApp((s) => s.setTableGame);
  const setActiveTable = useApp((s) => s.setActiveTable);
  const setTableOpponents = useApp((s) => s.setTableOpponents);
  const openPm = useApp((s) => s.openPm);
  const salon = `${floor}_${slot}`;

  const [users, setUsers] = useState<ApiSalonUser[]>([]);
  const [owner, setOwner] = useState<string | null>(null);
  const [salonName, setSalonName] = useState<string | null>(null);
  const [staff, setStaff] = useState<ApiSalonStaff[]>([]);
  const [blocked, setBlocked] = useState<string[]>([]); // salon içi mesaj engelli üyeler
  // Kat → salon menüsü (klasik HasOkey tarzı popup)
  const [katMenu, setKatMenu] = useState<number | null>(null);
  const [katRentals, setKatRentals] = useState<ApiRental[]>([]);
  const [katDoluluk, setKatDoluluk] = useState<Record<number, number>>({});
  const katVeri = (f: number) => {
    if (katRentals.length === 0) {
      api.salonRentals().then((r) => setKatRentals(r.rentals ?? [])).catch(() => {});
    }
    if (Object.keys(katDoluluk).length >= SLOTS_PER_FLOOR) return;
    const out: Record<number, number> = {};
    let idx = 1;
    const worker = async () => {
      while (idx <= SLOTS_PER_FLOOR) {
        const slot = idx++;
        try {
          const r = await api.salonUsers(`${f}_${slot}`);
          out[slot] = (r.users ?? []).length;
        } catch {
          out[slot] = 0;
        }
      }
    };
    void Promise.all(Array.from({ length: 10 }, worker)).then(() => setKatDoluluk(out));
  };
  const [tables, setTables] = useState<ApiTable[]>([]);
  const [bots, setBots] = useState<{ id: number; nick: string }[]>([]); // salon botları
  const [chatLocked, setChatLocked] = useState(false); // genel sohbet kilitli mi (salon yöneticisi kapatmış)
  const [chatLog, setChatLog] = useState<{ id: number; nick: string; text: string; kind: string; createdAt: number }[] | null>(null); // sohbet kaydı penceresi
  // ── Yönetim paneli: salon yöneticisi salona girince otomatik açılır ──
  // (salon ekibi + salon sahibi + site sahibi/admin/yönetici) — managers-only
  // sohbet odası `yonetim:<salon>` + genel sohbet temizle / kilitle kontrolleri.
  const [yonetimAcik, setYonetimAcik] = useState(false);
  const yonetimOtoRef = useRef(false); // panel salona girişte bir kez otomatik açılsın
  // ── Tek sağ tık menüsü: üye + bot + masa işlemleri tek listede ──
  const [ctx, setCtx] = useState<SalonCtxTarget | null>(null);
  const [top, setTop] = useState<ApiTopUser[]>([]);
  const [ping, setPing] = useState(0);
  const [profileNick, setProfileNick] = useState<string | null>(null);
  const [manageOpen, setManageOpen] = useState(false);
  const [modalGame, setModalGame] = useState<GameId | null>(null);
  const [modalHerkes, setModalHerkes] = useState(false); // "Herkes Açabilir" ayrı butonu
  // Üye listesi sıralaması — başlığa tıklayınca değişir
  const [sortKey, setSortKey] = useState<MemberSortKey>("role");
  const [sortDir, setSortDir] = useState<1 | -1>(1);
  // Menü çubuğu açılır listesi + radyo kutusu (referans düzeni)
  const [barMenu, setBarMenu] = useState(false);
  const [radio, setRadio] = useState(RADIOS[0]);
  // Gerçek radyo: URL girince gerçekten çalar (mp3/aac/stream)
  const [radyoUrl, setRadyoUrl] = useState(radyoKayitliUrl());
  const [radyoIstasyon, setRadyoIstasyon] = useState(radyoKayitliIstasyon());
  const [radyoCalıyor, setRadyoCalıyor] = useState(false);
  const radyoCal = () => {
    const u = radyoUrl.trim();
    if (!u) { showToast("Önce bir radyo URL'si girin (mp3/aac/stream)."); return; }
    radyoUrlKaydet(u, radyoIstasyon);
    const d = radyoBaslat(u, radyoIstasyon || radio, ayarlar.radyo);
    setRadyoCalıyor(d.caliyor);
    if (d.caliyor) showToast(`📻 ${d.istasyon} çalıyor.`);
    else showToast("Radyo başlatılamadı — URL'yi kontrol edin.");
  };
  const radyoDurdurBtn = () => { radyoDurdur(); setRadyoCalıyor(false); showToast("Radyo durduruldu."); };
  const radyoSesDegistir = (v: number) => { radyoSesAyarla(v); };
  // Klasik Ayarlar penceresi (ses / oyun hızı / görüntü) + "Oyun yükleniyor" ekranı
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [ayarlar, setAyarlar] = useState<Ayarlar>(() => ayarlariYukle());
  const [loading, setLoading] = useState(false);

  const myRole = users.find((u) => u.nick === me?.nick)?.role ?? "member";
  const canManage = myRole === "siteowner" || myRole === "owner" || me?.rank === "admin";
  // Salon yetkisi: site sahibi/admin + yönetici ve üstü (denetmen+) TÜM salonlarda tam yetki;
  // site yetkilisi/koordinatör yalnız susturma; salon ekibi: as admin/admin/süper op → tam, yönetici → susturma
  const myRankFull = me != null && (isSiteOwner(me.nick) || ["admin", "yonetici", "denetmen"].includes(me.rank));
  const myRankMute = me != null && (["koordinator", "yetkili"].includes(me.rank));
  const myPower: "full" | "mute" | undefined =
    myRankFull || myRole === "siteowner" || myRole === "owner" || myRole === "admin" || myRole === "superop"
      ? "full"
      : myRankMute || myRole === "yonetici"
      ? "mute"
      : undefined;
  const staffCount = users.filter((u) => u.role !== "member").length;
  // Bot atma yetkisi: site sahibi (web master) + admin
  const canBots = !!me && (isSiteOwner(me.nick) || me.rank === "admin");
  // Masa kapatma / bot davet yetkisi: salon ekibi (yönetici dahil) + site sahibi + admin
  const canManageTables = !!me && (myPower !== undefined || me.rank === "admin" || isSiteOwner(me.nick));

  // Yönetim paneli + üye profili: ELECTRON'da AYNI pencerede modal yerine AYRI pencere açılır
  const yonetimAc = () => {
    if (isElectronWin()) go({ name: "yonetim", salon, floor, slot });
    else setYonetimAcik(true);
  };
  const profilAc = (n: string) => {
    if (isElectronWin()) go({ name: "profil", nick: n });
    else setProfileNick(n);
  };

  // Salon yöneticisi salona girer girmez yönetim paneli otomatik açılır (bir kez)
  useEffect(() => {
    if (myPower !== undefined && !yonetimOtoRef.current) {
      yonetimOtoRef.current = true;
      yonetimAc();
    }
  }, [myPower]);

  const load = useCallback(async () => {
    if (!getToken()) return;
    const t0 = performance.now();
    try {
      const [u, s, tb, bt] = await Promise.all([
        api.salonUsers(salon), api.salonStaffList(salon), api.tables(salon),
        api.salonBots(salon).catch(() => ({ bots: [] as { id: number; nick: string }[] })),
      ]);
      setPing(performance.now() - t0);
      setUsers(u.users);
      setOwner(u.owner);
      setSalonName(u.salonName || null);
      setStaff(s.staff);
      setBlocked(u.blocked ?? []);
      setTables(tb.tables);
      setBots(bt.bots);
      api.salonChat(salon).then((r) => setChatLocked(r.locked)).catch(() => {});
    } catch {
      /* bağlantı hatası göz ardı */
    }
  }, [salon]);

  // Salona katıl + periyodik tazeleme; TOP 10 30 sn'de bir
  useEffect(() => {
    void api.salonJoin(salon).catch(() => {});
    void load();
    void api.top10().then((r) => setTop(r.top)).catch(() => {});
    const t = window.setInterval(() => void load(), 5000);
    const t2 = window.setInterval(
      () => void api.top10().then((r) => setTop(r.top)).catch(() => {}),
      30_000
    );
    return () => {
      window.clearInterval(t);
      window.clearInterval(t2);
    };
  }, [salon, load]);

  // "Oyun yükleniyor..." ekranı (referans) — kısa yükleme sonra oyuna gir
  const yukleVeGit = (r: Parameters<typeof go>[0]) => {
    setLoading(true);
    window.setTimeout(() => {
      setLoading(false);
      go(r);
    }, 1200);
  };

  // Masa kurma penceresi onaylandı: 34/51 online eşleşmeli, diğerleri yerel oyun
  const masaKur = async (s: TableSettings) => {
    if (!me) {
      showToast("Oturum doğrulanamadı — masa açılamadı. Lütfen yeniden deneyin.");
      return;
    }
    setModalGame(null);
    if (modalHerkes) { s = { ...s, herkes: true, izleyici: true, davet: false }; setModalHerkes(false); }
    if (s.game === "otuzdort" || s.game === "ellibir") {
      yukleVeGit({ name: "oyunOnline", game: s.game });
      return;
    }

    // ── ÇARpanLI MASA KURALLARI ──
    // x99/x111: sayaçla HEDİYE (20 x9 → x99, 7 x99 → x111) — kredi kesilmez
    const sayacKey = `vk_carpansayac_${salon}`;
    let sayac: Record<string, number> = {};
    try { sayac = JSON.parse(localStorage.getItem(sayacKey) || "{}"); } catch { sayac = {}; }

    let hediye = false;
    if (s.carpan === 99) {
      if ((sayac.x9 ?? 0) < X9_ICIN_GEREKLI) {
        showToast(`x99 masa için ${X9_ICIN_GEREKLI} adet normal x9 masa açılması gerekir (şu an: ${sayac.x9 ?? 0}/${X9_ICIN_GEREKLI}).`);
        return;
      }
      hediye = true;
    } else if (s.carpan === 111) {
      if ((sayac.x99 ?? 0) < X99_ICIN_GEREKLI) {
        showToast(`x111 masa için ${X99_ICIN_GEREKLI} adet x99 masa açılması gerekir (şu an: ${sayac.x99 ?? 0}/${X99_ICIN_GEREKLI}).`);
        return;
      }
      hediye = true;
    }

    // Giriş kısıtı: x123 → 120M+ , x999 → 100M+ puanlı üyeler bu masalara GİREMEZ
    const kisit = girisKisiti(s.carpan);
    if (kisit !== null) {
      try {
        const r = await api.profile(me.nick);
        if ((r.user.points ?? 0) > kisit) {
          showToast(`Bu çarpanlı masaya ${kisit.toLocaleString("tr-TR")} puandan yüksek üyeler giremez (top list rekabeti korunur).`);
          return;
        }
      } catch { /* profil alınamazsa açmaya izin ver */ }
    }

    // Kredi: kesintiyi SUNUCU yapar (POST /tables points'ten 1 kez keser) — istemci ayrıca çip/kredi kesmez
    const bedel = hediye ? 0 : (CARPAN_KREDI[s.carpan]?.[s.sure] ?? 0);
    if (bedel > 0) {
      if ((me.points ?? 0) < bedel) {
        showToast(`x${s.carpan} (${s.sure} saat) masa için ${bedel.toLocaleString("tr-TR")} kredi gerekiyor — yetersiz kredi (${(me.points ?? 0).toLocaleString("tr-TR")}).`);
        return;
      }
    }

    // Sayaçlar: 24 saatlik normal x9 → x99 sayacını artırır (12 saatlik x9 ARTIRMAZ);
    // hediye x99/x111 açıldığında ilgili sayaç düşer (sonsuza kadar hediye olmasın)
    if (s.carpan === 9 && s.sure === 24) sayac.x9 = (sayac.x9 ?? 0) + 1;
    if (hediye && s.carpan === 99) { sayac.x9 = Math.max(0, (sayac.x9 ?? 0) - X9_ICIN_GEREKLI); sayac.x99 = (sayac.x99 ?? 0) + 1; }
    if (hediye && s.carpan === 111) { sayac.x99 = Math.max(0, (sayac.x99 ?? 0) - X99_ICIN_GEREKLI); }
    localStorage.setItem(sayacKey, JSON.stringify(sayac));

    try {
      const r = await api.createTable(salon, s.game, {
        name: s.masaAdi,
        settings: {
          cezali: s.cezali, eglence: s.eglence, klasman: s.klasman,
          esli: s.esli, artirmali: s.artirmali, defineli: s.defineli,
          carpan: s.carpan, sure: s.sure, canak: s.canak, hediye,
          acan: me.nick, herkes: s.herkes,
          // Süre bitişi: süre dolunca masa otomatik geçersiz — herkes çıksa bile
          // aynı çarpanla oynanabilir, dolunca kapanır
          bitisTs: Date.now() + s.sure * 3_600_000,
          elSayisi: s.elSayisi, sohbet: s.sohbet, izleyici: s.izleyici, davet: s.davet,
        },
      });
      setActiveTable(r.table.id);
      if (hediye) showToast(`Sayaç doldu — x${s.carpan} masa KREDİ GEREKMEDEN hediye olarak açıldı!`);
      else showToast(`"${s.masaAdi}" masası kuruldu — oyun penceresi açılıyor…`);
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Masa kurulamadı.");
      return;
    }
    void load();
    setTableGame(s.game);
    yukleVeGit({ name: "oyun", game: s.game as GameId });
  };

  // Masaya otur (boş koltuğa) → oyuna git
  const otur = async (t: ApiTable) => {
    if (!me) return;
    // Çarpanlı masa süre kontrolü — süresi dolmuş masaya oturulmaz
    let ss: Record<string, unknown> = {};
    try { ss = t.settings ? JSON.parse(t.settings) : {}; } catch { ss = {}; }
    const tp = Number(ss.bitisTs || 0);
    if (tp && Date.now() > tp) {
      showToast("Bu çarpanlı masanın süresi dolmuş — yeniden açılması gerekir.");
      return;
    }
    // Giriş kısıtı: x123 → 120M+ , x999 → 100M+ puanlı üyeler oturamaz
    const kisit = girisKisiti(Number(ss.carpan || 1) as Carpan);
    if (kisit !== null) {
      try {
        const r = await api.profile(me.nick);
        if ((r.user.points ?? 0) > kisit) {
          showToast(`${kisit.toLocaleString("tr-TR")} puandan yüksek üyeler bu çarpanlı masaya oturamaz.`);
          return;
        }
      } catch { /* atlanır */ }
    }
    if (t.game === "otuzdort" || t.game === "ellibir") {
      yukleVeGit({ name: "oyunOnline", game: t.game as "otuzdort" | "ellibir" });
      return;
    }
    try {
      const r = await api.joinTable(t.id);
      setActiveTable(r.table.id);
      setTableOpponents(parsePlayers(r.table).filter((p) => p.nick !== me.nick).map((p) => p.nick));
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Masaya oturulamadı.");
      return;
    }
    const g = t.game as GameId;
    setTableGame(g);
    yukleVeGit({ name: "oyun", game: g });
  };

  const title = salonTitle(floor, slot, salonName);
  // Referanstaki klasik kısa salon adı: 1. Kat · 1. Salon → "Ana Salon", diğerleri "N. Salon"
  const shortTitle =
    salonName && salonName.trim()
      ? salonName.trim()
      : floor === 1 && slot === 1
        ? "Ana Salon"
        : `${slot}. Salon`;
  const pingSn = (ping / 1000).toFixed(3).replace(".", ",");
  const seated = tables.reduce((n, t) => n + parsePlayers(t).length, 0);
  const viewers = Math.max(0, users.length - seated);

  // Üye hangi masada oturuyor? (masa listesinden — sıralama için)
  const tableOf = (nick: string): number | null => {
    const t = tables.find((tb) => parsePlayers(tb).some((p) => p.nick === nick));
    return t ? Number(t.id) : null;
  };

  // Başlığa tıklayınca sıralamayı değiştir (aynı başlık → yön çevir)
  const toggleSort = (k: MemberSortKey) => {
    if (k === sortKey) setSortDir((d) => (d === 1 ? -1 : 1));
    else {
      setSortKey(k);
      setSortDir(k === "puan" ? -1 : 1); // puan varsayılan büyükten küçüğe
    }
  };

  const sortedUsers = [...users].sort((a, b) => {
    // Site sahibi + site yetkilisi/koordinatör her sıralamada en üstte (kademe önceliği)
    const tierTop = staffTier(b.nick, b.rank, b.role) - staffTier(a.nick, a.rank, a.role);
    if (tierTop) return tierTop;
    let d = 0;
    if (sortKey === "nick") d = a.nick.localeCompare(b.nick, "tr");
    else if (sortKey === "puan") d = (a.chips ?? 0) - (b.chips ?? 0) || a.nick.localeCompare(b.nick, "tr");
    else if (sortKey === "masa") {
      const ta = tableOf(a.nick), tb = tableOf(b.nick);
      // Masada olmayanlar (null) en sonda
      d = (ta ?? Number.MAX_SAFE_INTEGER) - (tb ?? Number.MAX_SAFE_INTEGER) || a.nick.localeCompare(b.nick, "tr");
    } else d = (ROLE_ORDER[a.role] ?? 4) - (ROLE_ORDER[b.role] ?? 4) || a.nick.localeCompare(b.nick, "tr");
    return d * sortDir;
  });

  // Sağdaki üye listesi: puan (çip) sırasına göre — site sahibi en üstte

  // "Arkadaşım Nerede" — referanstaki klasik özellik: nick yaz, masasını göster
  const arkadasimNerede = async () => {
    // Electron'da window.prompt ÇALIŞMAZ (sessizce null döner) — klasik pencere kullanılır
    const nick = await klasikPrompt("Arkadaşının nick'ini yaz:");
    if (!nick) return;
    const u = users.find((x) => x.nick.toLocaleLowerCase("tr") === nick.trim().toLocaleLowerCase("tr"));
    if (!u) {
      showToast(`${nick} şu an bu salonda değil.`);
      return;
    }
    const t = tableOf(u.nick);
    showToast(t ? `${u.nick} — ${t}. masada oturuyor.` : `${u.nick} salonda ama masasız (boşta geziniyor).`);
  };

  // ── Genel sohbet: temizleme + kilit (salon yöneticileri) ──
  const sohbetTemizle = async () => {
    if (!(await klasikConfirm("Genel sohbetteki tüm mesajlar silinsin mi?"))) return;
    try {
      await api.salonChatAction(salon, "clear");
      showToast("Genel sohbet temizlendi.");
      void load();
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Sohbet temizlenemedi.");
    }
  };

  const sohbetKilit = async () => {
    try {
      const r = await api.salonChatAction(salon, chatLocked ? "unlock" : "lock");
      setChatLocked(r.locked);
      showToast(
        r.locked
          ? "Genel sohbet kapatıldı — yalnızca salon yöneticileri yazabilir."
          : "Genel sohbet açıldı — herkes yazabilir."
      );
    } catch (e) {
      showToast(e instanceof Error ? e.message : "İşlem yapılamadı.");
    }
  };

  const sohbetKayit = async () => {
    try {
      const r = await api.salonChatLog(salon);
      setChatLog(r.messages);
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Sohbet kaydı alınamadı.");
    }
  };

  const kayitIndir = () => {
    if (!chatLog) return;
    const satirlar = chatLog.map(
      (m) => `[${new Date(m.createdAt * 1000).toLocaleString("tr-TR")}] ${m.nick}: ${m.text}`
    );
    const blob = new Blob([`${title} — Genel sohbet kaydı\n\n${satirlar.join("\n")}\n`], {
      type: "text/plain;charset=utf-8",
    });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `sohbet-kaydi-${salon}.txt`;
    a.click();
    URL.revokeObjectURL(a.href);
    showToast("Sohbet kaydı indirildi (.txt).");
  };

  // Üye listesi başlığı (tıklanabilir) — düz fonksiyon (bileşen değil, remount olmasın)
  const uyeTh = (k: MemberSortKey | null, label: string, cls: string) => {
    const active = k !== null && sortKey === k;
    return (
      <span
        className={`${cls} ${k ? "cursor-pointer select-none hover:bg-[#c0d4ee]" : ""} ${active ? "text-[#0a246a]" : ""}`}
        onClick={k ? () => toggleSort(k) : undefined}
        title={k ? "Sıralamak için tıkla" : undefined}
      >
        {label}
        {active ? (sortDir === 1 ? " ▲" : " ▼") : ""}
      </span>
    );
  };

  return (
    <>
    {/* Gömülü lobi kabuğu: kısa ad + canlı üye sayısını üst başlık çubuğu için bildir */}
    <InfoBridge onInfo={onInfo} title={shortTitle} count={users.length + bots.length} />
    <AutoFit
      width={1220}
      fitScreen
      className={embedded ? "felt-bg h-full" : "felt-bg min-h-screen py-1 px-2"}
      style={{ fontFamily: TAHOMA }}
    >
      <div
        className="max-w-[1500px] mx-auto bg-[#d4d0c8] text-black border-t border-l border-[#dfdfdf] border-b border-r border-[#404040] shadow-pop"
        onContextMenu={(e) => {
          // Sağ tık → TEK liste: bot + salon işlemleri (boş bir yere tıklayınca)
          if ((canBots || myPower !== undefined || canManageTables) && !(e.target as HTMLElement).closest("button, a, input, select")) {
            e.preventDefault();
            setCtx({ x: e.clientX, y: e.clientY });
          }
        }}
      >
        {!embedded && (
          <>
        {/* ── Pencere başlığı ─────────────────────────────────────── */}
        <div className="flex items-center justify-between gap-2 px-2 py-0.5 bg-gradient-to-b from-[#3a6ea5] to-[#0a246a] text-white text-xs font-bold select-none">
          <span className="truncate flex items-center gap-1"><img src="icon.jpg" alt="" className="w-4 h-4" /> {typeof window !== "undefined" && window.location.hostname.includes("okeyhasi") ? "OKEY HASI" : "HAS OKEY"}</span>
          <span className="hidden md:inline">101, Okey, Domino ve Kart Oyunları</span>
          <span className="flex items-center gap-2 truncate">
            <span className="truncate">{shortTitle} [{users.length + bots.length}]</span>
            <span className="flex items-center gap-1 opacity-90">
              <span className="px-1.5 bg-[#d4d0c8] text-black border-t border-l border-white border-b border-r border-[#404040] leading-4">—</span>
              <span className="px-1.5 bg-[#d4d0c8] text-black border-t border-l border-white border-b border-r border-[#404040] leading-4">□</span>
              <button
                onClick={() => go({ name: "lobi", floor })}
                title="Lobiye dön"
                className="px-1.5 bg-[#d4d0c8] text-black border-t border-l border-white border-b border-r border-[#404040] leading-4 hover:bg-[#e0dcd4]"
              >
                ×
              </button>
            </span>
          </span>
        </div>

        {/* ── Kat sekmeleri (referans: kırmızı düz metin sekmeler + ortada salon adı) ── */}
        <div className="relative flex items-center gap-3 px-2 pt-0.5 pb-0.5 bg-white select-none flex-wrap border-b border-[#a0a0a0]">
          <span className="absolute left-1/2 -translate-x-1/2 text-[13px] font-bold text-[#cc0000] whitespace-nowrap pointer-events-none">
            [{shortTitle}]
          </span>
          {FLOORS.map((f) => (
            <button
              key={f}
              onClick={() => {
                setKatMenu((m) => (m === f ? null : f));
                katVeri(f);
              }}
              className={`px-1 text-[13px] font-bold text-[#cc0000] ${f === floor ? "underline decoration-2" : "hover:underline"}`}
            >
              {f}.Kat
            </button>
          ))}
        </div>

        {/* ── KAT → SALON MENÜSÜ (klasik HasOkey tarzı çok sütunlu popup) ── */}
        {katMenu !== null && (
          <div
            className="absolute left-1 right-1 top-[92px] z-[70] max-h-[380px] overflow-auto bg-[#d4d0c8] p-1"
            style={{ border: "1px solid #404040", boxShadow: "2px 3px 12px rgba(0,0,0,.5)" }}
            onMouseLeave={() => setKatMenu(null)}
          >
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-x-3 content-start">
              {Array.from({ length: SLOTS_PER_FLOOR }, (_, i) => i + 1).map((slot) => {
                const rental = katRentals.find((r) => r.floor === katMenu && r.slot === slot);
                const ad = rental?.name?.trim() || `salon${slot}`;
                const dolu = katDoluluk[slot] ?? 0;
                const renk = rental ? "text-[#0a55c8]" : dolu >= 9 ? "text-[#c22020]" : dolu === 0 ? "text-[#157a15]" : "text-[#111]";
                return (
                  <button
                    key={slot}
                    onClick={() => {
                      setKatMenu(null);
                      go({ name: "salonRoom", floor: katMenu, slot });
                    }}
                    className={`flex items-center justify-between gap-1 px-1 py-[1px] text-[12px] text-left hover:bg-[#0a246a] hover:text-white ${renk}`}
                    title={`${katMenu}. Kat · ${ad} — tıkla gir`}
                  >
                    <span className="truncate font-bold">
                      [{slot}-{ad}]{rental ? " 🔑" : ""}
                    </span>
                    <span className="text-[10px] shrink-0">({dolu}/12)</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}
          </>
        )}

        {/* ── Salon bandı: beyaz zemin ★★ salon adı ★★ Sevd. + oyuncu/ping/radyo (bire bir referans; gömülü lobide de görünür) ── */}
        <div className="flex items-center gap-3 px-2 py-1 bg-white border-b border-[#a0a0a0]">
          <div className="flex-1 min-w-0 flex items-center justify-center gap-2">
            <span className="text-[#cc0000] font-bold text-2xl leading-none">★★</span>
            <b
              className="text-[#0033cc] font-bold text-2xl leading-none truncate"
              title={owner ? `${owner} üyesinin salonu — herkese iyi oyunlar` : "101, Okey, Domino ve Kart Oyunları"}
            >
              {shortTitle}
            </b>
            <span className="text-[#cc0000] font-bold text-2xl leading-none">★★</span>
            <span className="text-[#0033cc] font-bold italic text-xl leading-none shrink-0">Salon</span>
          </div>
          <div className="shrink-0 flex items-center gap-2 text-[11px] text-black whitespace-nowrap">
            <span>
              <b className="text-[#cc0000]">{users.length + bots.length}</b> Oyuncu ·{" "}
              <b className="text-[#cc0000]">{staffCount}</b> Op
            </span>
            <span>
              Ping: <b className={ping < 300 ? "text-[#007a3d]" : "text-[#cc3300]"}>{pingSn}</b> sn
            </span>
            {/* Radyo kutusu — referansla aynı: koyu kutu · URL · yeşil ▶ · 🔊 · mavi ses çubuğu */}
            <span className="flex items-center gap-1.5 bg-[#1a1a1a] text-white px-1.5 py-0.5 border border-[#404040]">
              <input
                value={radyoUrl}
                onChange={(e) => setRadyoUrl(e.target.value)}
                placeholder="Radyo URL (mp3/aac/stream)"
                className="bg-transparent text-[10px] text-white w-[140px] focus:outline-none placeholder:text-white/40"
                onKeyDown={(e) => { if (e.key === "Enter") radyoCal(); }}
              />
              <button
                onClick={radyoCalıyor ? radyoDurdurBtn : radyoCal}
                title={radyoCalıyor ? "Durdur" : "URL'den çal"}
                className={`w-[15px] h-[15px] rounded-full text-[8px] leading-none ${radyoCalıyor ? "bg-[#c02020]" : "bg-[#16a34a]"} text-white hover:opacity-80`}
              >
                {radyoCalıyor ? "■" : "▶"}
              </button>
              <span className="text-[10px] leading-none" title="Ses">🔊</span>
              <input
                type="range"
                min={0}
                max={100}
                value={ayarlar.radyo}
                onChange={(e) => { const v = Number(e.target.value); setAyarlar({ ...ayarlar, radyo: v }); radyoSesDegistir(v); }}
                className="w-[56px] h-[3px] accent-[#0033cc]"
                title={`Ses: %${ayarlar.radyo}`}
              />
              {radyoCalıyor && <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" title="Çalıyor" />}
            </span>
          </div>
        </div>

        {/* ── Menü çubuğu: Yeni Masa · Desen · Menü · Ayarlar + sağda oyuncu/radyo ── */}
        <div className="relative flex flex-wrap items-center gap-1 px-1 py-0.5 bg-[#d4d0c8] border-b border-[#808080]">
          <KBtn onClick={() => setModalGame("yuzbir")}>Yeni Masa</KBtn>
          <KBtn onClick={() => { setModalHerkes(true); setModalGame("yuzbir"); }} title="Herkes açabilir / herkes oturabilir masa">🔓 Herkes Açabilir</KBtn>
          <KBtn onClick={() => setSettingsOpen(true)} title="Masa deseni">Desen {ayarlar.desen}</KBtn>
          <KBtn onClick={() => setBarMenu((v) => !v)}>Menü ▾</KBtn>
          <KBtn onClick={() => setSettingsOpen(true)}>Ayarlar</KBtn>
          <KBtn onClick={() => void load()} title="Listeyi tazele">⟳ Yenile</KBtn>
          {me?.rank === "admin" && <KBtn onClick={() => go({ name: "kira" })} title="Yeni salon kiralama">➕ Salon Ekle</KBtn>}
          {canManage && <KBtn onClick={() => setManageOpen(true)}>★ Salon Ekibi</KBtn>}
          {myPower !== undefined && (
            <KBtn onClick={() => yonetimAc()} title="Salon yönetim paneli — yönetici sohbeti + sohbet kontrolleri">
              🛡️ Yönetim
            </KBtn>
          )}

          {/* Referans: menü çubuğu ortası boş · sağda sabit "★ DUYURU" */}
          <div className="flex-1" />
          <span className="px-2 text-[11px] font-bold text-black whitespace-nowrap select-none">★ DUYURU</span>

          {/* Menü açılır liste */}
          {barMenu && (
            <div className="absolute left-1 top-full z-40 bg-[#d4d0c8] border border-[#404040] shadow-pop min-w-[170px]">
              {[
                ["⚙ Ayarlar", () => setSettingsOpen(true)],
                ["Yardım", () => go({ name: "sohbet", room: "yardim" })],
                ["Gold Üyelik", () => go({ name: "gold" })],
                ["Arkadaşım Nerede", arkadasimNerede],
                ["Lobi", () => go({ name: "lobi", floor })],
                ["Çıkış", logout],
              ].map(([label, fn]) => (
                <button
                  key={label as string}
                  onClick={() => {
                    setBarMenu(false);
                    (fn as () => void)();
                  }}
                  className="block w-full text-left px-3 py-1 text-[12px] text-black hover:bg-[#0a246a] hover:text-white"
                >
                  {label as string}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* ── Ana alan: sol (masa listesi + sohbet) · sağ (üyeler + TOP 10) ──
            AutoFit tuvali sabit 1220px — media query (lg:) pencereye baktığı için
            içerik dar sütuna sıkışıyordu; bu yüzden TEK sabit satır düzeni kullanılır. ── */}
        <div className="flex gap-1 m-1 h-[560px]">
          {/* Sol: masa listesi (beyaz klasik tablo) */}
          <div className="flex-1 min-w-0 flex flex-col gap-1 min-h-0">
            <div className="border border-[#a0a0a0] bg-white overflow-auto flex-[3] min-h-[220px]">
              <table className="w-full text-[12px] border-collapse">
                <thead>
                  <tr>
                    {["Masa Adı", "Ayarlar", "Oyuncu 1", "Oyuncu 2", "Oyuncu 3", "Oyuncu 4", "Masa No", "İzleyici"].map((h) => (
                      <th
                        key={h}
                        className="border border-[#c8c8c8] px-1.5 py-0.5 text-left font-bold bg-white whitespace-nowrap sticky top-0 z-10"
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {tables.map((t) => {
                    const players = parsePlayers(t);
                    const full = players.length >= t.seats || t.status !== "open";
                    return (
                      <tr
                        key={t.id}
                        className="hover:bg-[#e8f0fc]"
                        onContextMenu={(e) => {
                          // Yetkili sağ tıklayınca: bot davet + masayı kapat
                          if (canManageTables || t.ownerId === Number(me?.id ?? -1)) {
                            e.preventDefault();
                            e.stopPropagation();
                            setCtx({ x: e.clientX, y: e.clientY, t });
                          }
                        }}
                      >
                        <td className="border border-[#c0c0c0] px-2 py-1 whitespace-nowrap">
                          <span className="flex items-center gap-1.5">
                            <span
                              className="w-3.5 h-3.5 text-[8px] font-bold text-white flex items-center justify-center rounded-full shrink-0 bg-[#cc0000]"
                            >
                              {GAME_BADGE[t.game] ?? "?"}
                            </span>
                            <b className="text-[#cc0000]">{t.name || `Masa ${t.id}`}</b>
                          </span>
                        </td>
                        <td className="border border-[#c0c0c0] px-2 py-1 text-black whitespace-nowrap">{ayarMetni(t)}</td>
                        {Array.from({ length: 4 }, (_, i) => {
                          const p = players[i];
                          return (
                            <td key={i} className="border border-[#c0c0c0] px-2 py-1 min-w-[64px]">
                              {p ? (
                                <span
                                  className={`truncate ${String(p.id) === me?.id ? "font-bold" : ""}`}
                                  style={
                                    nickTextColor({ nick: p.nick, rank: users.find((u) => u.nick === p.nick)?.rank, custom: users.find((u) => u.nick === p.nick)?.nickColor })
                                      ? { color: nickTextColor({ nick: p.nick, rank: users.find((u) => u.nick === p.nick)?.rank, custom: users.find((u) => u.nick === p.nick)?.nickColor })! }
                                      : undefined
                                  }
                                >
                                  {p.nick}
                                </span>
                              ) : full ? (
                                <span className="text-black">—</span>
                              ) : (
                                <button
                                  onClick={() => void otur(t)}
                                  title="Boş koltuğa otur"
                                  className="text-[#0000cc] underline hover:text-[#cc0000]"
                                >
                                  {masaDavetli(t) ? "Davetli" : "Oyna"}
                                </button>
                              )}
                            </td>
                          );
                        })}
                        <td className="border border-[#c0c0c0] px-2 py-1 text-center text-[#cc0000]">{t.id}</td>
                        <td className="border border-[#c0c0c0] px-2 py-1 text-center whitespace-nowrap">
                          <span className="text-black">{viewers}</span>{" "}
                          <button
                            onClick={() => {
                              if (t.game === "otuzdort" || t.game === "ellibir") {
                                go({ name: "oyunOnline", game: t.game as "otuzdort" | "ellibir" });
                                return;
                              }
                              const g = t.game as GameId;
                              setTableGame(g);
                              go({ name: "oyun", game: g });
                            }}
                            className="text-[#0000cc] underline hover:text-[#cc0000]"
                          >
                            İzle
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                  {/* Boş "Yeni Masa" satırları — referanstaki dolu liste görünümü */}
                  {Array.from({ length: Math.max(0, 12 - tables.length) }).map((_, i) => (
                    <tr
                      key={`bos-${i}`}
                      className="hover:bg-[#e8f0fc] cursor-pointer"
                      onClick={() => setModalGame("yuzbir")}
                    >
                      <td className="border border-[#c0c0c0] px-2 py-1 whitespace-nowrap">
                        <span className="flex items-center gap-1.5">
                          <span
                            className="w-3.5 h-3.5 text-[8px] font-bold text-white flex items-center justify-center rounded-full shrink-0 bg-[#cc0000]"
                          >
                            {GAME_BADGE[["yuzbir", "okey", "otuzdort", "ellibir", "batak"][i % 5]] ?? "10"}
                          </span>
                          <b className="text-[#cc0000]">Yeni Masa</b>
                        </span>
                      </td>
                      <td className="border border-[#c0c0c0] px-2 py-1 text-black whitespace-nowrap">
                        {["11 El", "11 El", "Cezalı, 11 El", "9 El", "9 El"][i % 5]}
                      </td>
                      {Array.from({ length: 4 }).map((_, j) => (
                        <td key={j} className="border border-[#c0c0c0] px-2 py-1 min-w-[64px]" />
                      ))}
                      <td className="border border-[#c0c0c0] px-2 py-1 text-center text-black" />
                      <td className="border border-[#c0c0c0] px-2 py-1 text-center whitespace-nowrap">
                        <span className="text-black">0</span> <span className="text-[#0000cc] underline">İzle</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Klasik beyaz sohbet (giriş/çıkış mesajları kırmızı) + yönetici kontrolleri */}
            {myPower !== undefined && (
              <div className="flex items-center gap-1 flex-wrap px-1 py-0.5 bg-[#d4d0c8] border border-[#808080] border-b-0">
                <span className="text-[10px] font-bold text-black px-1">Genel Sohbet</span>
                <KBtn onClick={() => void sohbetTemizle()} title="Tüm mesajları sil">🧹 Temizle</KBtn>
                <KBtn onClick={() => void sohbetKilit()} title="Herkes yazabilir / yalnızca yöneticiler">
                  {chatLocked ? "🔓 Aç" : "🔒 Kapat"}
                </KBtn>
                <KBtn onClick={() => void sohbetKayit()} title="Salon yazışmalarını kaydet / indir">📒 Kayıt</KBtn>
                {chatLocked && (
                  <span className="text-[10px] font-bold text-[#cc0000] px-1">Kapalı — yalnızca yöneticiler yazabilir</span>
                )}
              </div>
            )}
            <div className="flex-1 min-h-[160px] border border-[#808080] bg-white flex flex-col">
              <ChatPanel room={`salon:${salon}`} classic ctxPower={myPower} ctxSalon={salon} locked={chatLocked} />
            </div>
          </div>

          {/* Sağ: Üye listesi (beyaz klasik) + TOP 10 */}
          <aside className="w-[300px] shrink-0 flex flex-col gap-1 min-h-0">
            <div className="border border-[#808080] bg-[#d4d0c8] flex flex-col flex-1 min-h-0">
              <KTitle right={`${users.length + bots.length} kişi`}>Nick | K | P | Puan | Masa</KTitle>
              {/* Referans durum satırı: Oyuncu/Op · İstek · Ping */}
              <div className="flex items-center justify-between px-1 py-0.5 bg-[#d4d0c8] border-b border-[#a0a0a0] text-[11px] font-bold text-black select-none">
                <span>{users.length + bots.length} Oyuncu:{staffCount} Op</span>
                <span className="text-[#606060]">İstek</span>
                <span>Ping</span>
              </div>
              {/* Kapris Açtın Sesi açılır kutusu + bilgi düğmeleri (referans) */}
              <div className="flex items-center gap-1 px-1 py-0.5 bg-[#d4d0c8] border-b border-[#a0a0a0]">
                <select
                  className="flex-1 min-w-0 h-[18px] text-[11px] bg-black text-white border border-[#404040] px-1"
                  defaultValue=""
                  aria-label="Kapris Açtın Sesi"
                >
                  <option value="">Kapris Açtın Sesi</option>
                </select>
                <span className="w-[18px] h-[18px] shrink-0 bg-white border border-[#808080] text-[9px] leading-[16px] text-black text-center select-none">▼</span>
              </div>
              <div className="flex items-center justify-between px-1 py-0.5 bg-[#d4d0c8] border-b border-[#a0a0a0]">
                <button title="Bilgi" className="w-[18px] h-[18px] rounded-full bg-[#2b6fd4] border border-[#17408f] text-white text-[10px] font-bold leading-[16px] select-none">i</button>
                <button title="Bilgi" className="w-[18px] h-[18px] rounded-full bg-[#2b6fd4] border border-[#17408f] text-white text-[10px] font-bold leading-[16px] select-none">i</button>
              </div>
              <div className="grid grid-cols-[1fr_16px_12px_52px_34px_24px] text-[11px] font-bold text-black bg-gradient-to-b from-white to-[#d4d0c8] border-b border-[#a0a0a0]">
                {uyeTh("nick", "Nick", "px-1.5 py-0.5 border-r border-[#c0c0c0]")}
                {uyeTh("role", "K", "px-0.5 py-0.5 text-center border-r border-[#c0c0c0]")}
                <span className="px-0.5 py-0.5 text-center border-r border-[#c0c0c0]" title="Salonda">P</span>
                {uyeTh("puan", "Puan", "px-1 py-0.5 text-right border-r border-[#c0c0c0]")}
                {uyeTh("masa", "Masa", "px-1 py-0.5 text-right border-r border-[#c0c0c0]")}
                <span className="px-0.5 py-0.5 text-center" title="Özel mesaj">MSJ</span>
              </div>
              <div className="flex-1 min-h-0 overflow-y-auto bg-white">
                {sortedUsers.map((u) => (
                  <div
                    key={u.id}
                    className="grid grid-cols-[1fr_16px_12px_52px_34px_24px] items-center text-[12px] text-black hover:bg-[#0a246a] hover:text-white cursor-pointer border-b border-[#eeeeee]"
                    onClick={() => profilAc(u.nick)}
                    onContextMenu={(e) => {
                      e.preventDefault();
                      setCtx({ nick: u.nick, x: e.clientX, y: e.clientY });
                    }}
                    title="Tıkla: profil · Sağ tık: mesaj ve işlemler"
                  >
                    <span className="flex items-center gap-1 px-1.5 py-0.5 min-w-0">
                      {u.role !== "member" || isSiteOwner(u.nick) || STAFF_TIER_RANKS.includes(u.rank) ? (
                        <RoleStar role={isSiteOwner(u.nick) ? "siteowner" : u.role} rank={u.rank} size={13} />
                      ) : (
                        <Avatar avatar={u.avatar} gender={u.gender === "k" ? "k" : "e"} size={15} />
                      )}
                      <span
                        className={`truncate ${u.nick === me?.nick ? "font-bold" : ""}`}
                        style={
                          nickTextColor({ nick: u.nick, rank: u.rank, salonRole: u.role, custom: u.nickColor })
                            ? { color: nickTextColor({ nick: u.nick, rank: u.rank, salonRole: u.role, custom: u.nickColor })! }
                            : undefined
                        }
                      >
                        {u.nick}
                      </span>
                      {blocked.includes(u.nick) && (
                        <span title="Bu salonda mesajı engellendi" className="text-[10px]">🚫</span>
                      )}
                      {u.gold === 1 && <span className="text-[#c08a00] text-[10px]">★</span>}
                    </span>
                    <span className="text-center">
                      {u.role !== "member" || isSiteOwner(u.nick) || STAFF_TIER_RANKS.includes(u.rank) ? <RoleStar role={isSiteOwner(u.nick) ? "siteowner" : u.role} rank={u.rank} size={11} /> : ""}
                    </span>
                    <span className="text-center text-[7px] text-[#1a7a1a] leading-none" title="Salonda">●</span>
                    <span className="text-right tabular-nums">{(u.chips ?? 0).toLocaleString("tr-TR")}</span>
                    <span className="text-right tabular-nums pr-1 text-[11px] text-[#0000cc]" title="Oturduğu masa">
                      {tableOf(u.nick) ?? "—"}
                    </span>
                    <span className="text-center">
                      {u.nick !== me?.nick && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            openPm(u.nick);
                          }}
                          title={`${u.nick} kişisine özel mesaj gönder`}
                          className="px-1 text-[11px] text-black hover:text-white hover:bg-[#2a52a8] rounded-sm"
                        >
                          💬
                        </button>
                      )}
                    </span>
                  </div>
                ))}
                {/* Eklenen salon oyuncuları — normal üye gibi görünür, bot oldukları belli olmaz */}
                {bots.map((b) => (
                  <div
                    key={`bot-${b.id}`}
                    className="grid grid-cols-[1fr_16px_12px_52px_34px_24px] items-center text-[12px] text-black border-b border-[#eeeeee]"
                  >
                    <span className="flex items-center gap-1 px-1.5 py-0.5 min-w-0">
                      <Avatar avatar="" gender={b.id % 2 === 0 ? "e" : "k"} size={15} />
                      <span className="truncate">{b.nick}</span>
                    </span>
                    <span />
                    <span className="text-center text-[7px] text-[#1a7a1a] leading-none" title="Salonda">●</span>
                    <span className="text-right tabular-nums">0</span>
                    <span className="text-right tabular-nums pr-1 text-[11px] text-[#0000cc]" title="Oturduğu masa">
                      {tableOf(b.nick) ?? "—"}
                    </span>
                    <span />
                  </div>
                ))}
                {users.length === 0 && bots.length === 0 && (
                  <p className="text-[#808080] text-[11px] px-2 py-2">Bu salonda şu an kimse yok. İlk sen gir!</p>
                )}
              </div>
            </div>

            {/* TOP 10 — beyaz klasik panel (referans: Nick | K | T | A | Puan) */}
            <div className="border border-[#808080] bg-[#d4d0c8] flex flex-col h-[190px] shrink-0">
              <KTitle right="Puan">🏆 TOP 10</KTitle>
              <div className="grid grid-cols-[22px_1fr_16px_64px] text-[11px] font-bold text-black bg-gradient-to-b from-white to-[#d4d0c8] border-b border-[#a0a0a0]">
                <span className="px-1 py-0.5 text-center border-r border-[#c0c0c0]">#</span>
                <span className="px-1.5 py-0.5 border-r border-[#c0c0c0]">Nick</span>
                <span className="px-0.5 py-0.5 text-center border-r border-[#c0c0c0]" title="Kadro">K</span>
                <span className="px-1 py-0.5 text-right">Puan</span>
              </div>
              <div className="flex-1 min-h-0 overflow-y-auto bg-white">
                {top.map((p, i) => (
                  <div
                    key={p.id}
                    className="grid grid-cols-[22px_1fr_16px_64px] items-center text-[12px] text-black hover:bg-[#0a246a] hover:text-white cursor-pointer border-b border-[#eeeeee]"
                    onClick={() => profilAc(p.nick)}
                  >
                    <span className="px-1 text-[11px] text-center">
                      {i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : <span className="text-[10px] text-[#808080]">{i + 1}</span>}
                    </span>
                    <span className="flex items-center gap-1 px-1 py-0 min-w-0">
                      {STAFF_TIER_RANKS.includes(p.rank) || isSiteOwner(p.nick) ? (
                        <RoleStar role={isSiteOwner(p.nick) ? "siteowner" : "member"} rank={p.rank} size={12} />
                      ) : (
                        <Avatar avatar={p.avatar} gender={p.gender === "k" ? "k" : "e"} size={14} />
                      )}
                      <span className="truncate">{p.nick}</span>
                      {p.gold === 1 && <span className="text-[#c08a00] text-[9px]">★</span>}
                    </span>
                    <span className="text-center">
                      {STAFF_TIER_RANKS.includes(p.rank) || isSiteOwner(p.nick) ? (
                        <RoleStar role={isSiteOwner(p.nick) ? "siteowner" : "member"} rank={p.rank} size={10} />
                      ) : (
                        ""
                      )}
                    </span>
                    <span className="text-right tabular-nums pr-1">{p.chips.toLocaleString("tr-TR")}</span>
                  </div>
                ))}
                {top.length === 0 && (
                  <p className="text-[#808080] text-[11px] px-2 py-1">Yükleniyor…</p>
                )}
              </div>
            </div>
          </aside>
        </div>

        {/* ── Alt bağlantı çubuğu (bire bir referans: | ayraçlı mavi metin linkler) ── */}
        <div className="flex flex-wrap items-center gap-x-0.5 px-2 py-0.5 border-t border-white bg-[#d4d0c8] text-[12px] select-none">
          {([
            ["Yardım", () => go({ name: "sohbet", room: "yardim" })],
            ["Arkadaşım Nerede", arkadasimNerede],
            ["Cafe Gold", () => go({ name: "gold" })],
            ["Gold Üyelik", () => go({ name: "gold" })],
            ["Avatar", () => me && profilAc(me.nick)],
            ["Kredi", () => go({ name: "gold" })],
            ["Şikayet Prosedürü", () => go({ name: "sohbet", room: "yardim" })],
            ["Üye Bilgileri Değiştir", () => me && profilAc(me.nick)],
            ["Nick Değiştir", () => me && profilAc(me.nick)],
            ...(me?.rank === "admin" ? [["Salon Kiralama", () => go({ name: "kira" })]] : []),
          ] as [string, () => void][]).map(([label, fn], i) => (
            <span key={label} className="flex items-center">
              {i > 0 && <span className="text-[#808080] px-1">|</span>}
              <button
                onClick={fn}
                className="text-[#0000cc] hover:text-[#cc0000] hover:underline whitespace-nowrap"
              >
                {label}
              </button>
            </span>
          ))}
          <div className="flex-1" />
          {([
            ["Özel Nick Değiştir", () => showToast("Özel nick rengini Lobi → ⚙️ Ayarlar panelinden seçebilirsin.")],
            ["Şifre Bul/Mail Sil", () => go({ name: "sohbet", room: "yardim" })],
            ["Canlı Destek", () => go({ name: "sohbet", room: "yardim" })],
            ["Çıkış", logout],
          ] as [string, () => void][]).map(([label, fn], i) => (
            <span key={label} className="flex items-center">
              <span className="text-[#808080] px-1">|</span>
              <button
                onClick={fn}
                className={`hover:underline whitespace-nowrap ${label === "Çıkış" ? "text-[#cc0000] font-bold" : "text-[#0000cc] hover:text-[#cc0000]"} ${i === 0 ? "ml-0" : ""}`}
              >
                {label}
              </button>
            </span>
          ))}
        </div>
      </div>

      <ProfileModal nick={profileNick} onClose={() => setProfileNick(null)} />

      {/* Genel sohbet kaydı penceresi — salon yazışmaları (temizlenmiş olsa bile) */}
      {chatLog && (
        <div
          className="fixed inset-0 z-[97] bg-black/60 flex items-center justify-center p-4"
          onClick={() => setChatLog(null)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-[#d4d0c8] border-t border-l border-[#dfdfdf] border-b border-r border-[#404040] shadow-pop w-full max-w-[680px] max-h-[80vh] flex flex-col"
            style={{ fontFamily: TAHOMA }}
          >
            <div className="flex items-center justify-between px-2 py-1 bg-gradient-to-b from-[#3a6ea5] to-[#0a246a] text-white text-xs font-bold select-none">
              <span className="truncate">[ Genel Sohbet Kaydı — {title} ]</span>
              <button onClick={() => setChatLog(null)} className="px-1.5 bg-[#d4d0c8] text-black leading-4 hover:bg-[#e0dcd4]">×</button>
            </div>
            <div className="vk-chat-bg flex-1 min-h-0 overflow-y-auto p-2 space-y-0.5 text-[12px]">
              {chatLog.length === 0 && <p className="text-[#808080] px-1">Bu salonda henüz yazışma kaydı yok.</p>}
              {chatLog.map((m) => (
                <p key={m.id} className={m.kind === "system" ? "text-[#cc0000] font-bold" : "text-black"}>
                  <span className="text-[#808080] font-normal">[{new Date(m.createdAt * 1000).toLocaleString("tr-TR")}]</span>{" "}
                  {m.kind === "system" ? m.text : <><b>{m.nick}</b>: {m.text}</>}
                </p>
              ))}
            </div>
            <div className="flex items-center justify-between gap-1 px-2 py-1 border-t border-[#a0a0a0]">
              <span className="text-[10px] text-black">{chatLog.length} mesaj · temizlenmiş kayıtlar dahil</span>
              <span className="flex gap-1">
                <KBtn onClick={kayitIndir}>💾 İndir (.txt)</KBtn>
                <KBtn onClick={() => setChatLog(null)}>Kapat</KBtn>
              </span>
            </div>
          </div>
        </div>
      )}

      {/* TEK sağ tık listesi — üye + bot + masa işlemleri aynı menüde */}
      <SalonContextMenu
        target={ctx}
        onClose={() => setCtx(null)}
        onDone={() => void load()}
        onProfile={(n) => profilAc(n)}
        onOpenYonetim={() => yonetimAc()}
        salon={salon}
        salonPower={myPower}
        canBots={canBots}
        canManageTables={canManageTables}
        tableOwner={ctx?.t ? ctx.t.ownerId === Number(me?.id ?? -1) : false}
        botCount={bots.length}
        targetBlocked={ctx?.nick ? blocked.includes(ctx.nick) : false}
        targetStaffRole={ctx?.nick ? staff.find((s) => s.nick === ctx.nick)?.role ?? null : null}
        canStaffAssign={canManage}
        onManageStaff={() => setManageOpen(true)}
        onRefresh={() => void load()}
        myStaffRole={myRole}
        staffList={staff}
        usersList={users}
        onClearChat={() => void sohbetTemizle()}
        onToggleChat={() => void sohbetKilit()}
        onSetRadio={(r) => {
          if (r === "ac") { radyoCal(); return; }
          if (r === "kapa") { radyoDurdurBtn(); return; }
          // URL olarak yollandı — gerçekten çal
          setRadyoUrl(r);
          radyoUrlKaydet(r, r);
          const d = radyoBaslat(r, r, ayarlar.radyo);
          setRadyoCalıyor(d.caliyor);
          showToast(d.caliyor ? `📻 Radyo çalıyor: ${r}` : "Radyo başlatılamadı.");
        }}
        onWatchTable={(tb) => {
          // Sağ tık → Masayı İzle: oturmadan izleyici olarak aç (liste-"İzle" ile aynı mantık)
          if (tb.game === "otuzdort" || tb.game === "ellibir") {
            go({ name: "oyunOnline", game: tb.game as "otuzdort" | "ellibir" });
            return;
          }
          const g = tb.game as GameId;
          setTableGame(g);
          go({ name: "oyun", game: g });
        }}
      />

      {/* Klasik masa kurma penceresi (Ayarlar) */}
      {modalGame && (
        <CreateTableModal
          defaultGame={modalGame}
          defaultName={`${me?.nick ?? "Yeni"} Masası`}
          onConfirm={masaKur}
          onClose={() => { setModalGame(null); setModalHerkes(false); }}
        />
      )}

      {/* Salon ekibi yönetimi */}
      {manageOpen && (
        <SalonStaffModal
          salon={salon}
          users={users}
          staff={staff}
          isOwner={canManage}
          onClose={() => setManageOpen(false)}
          onChanged={() => void load()}
        />
      )}

      {/* Klasik Ayarlar penceresi (ses · oyun hızı · görüntü) */}
      {settingsOpen && (
        <AyarlarPenceresi value={ayarlar} onChange={setAyarlar} onClose={() => setSettingsOpen(false)} />
      )}

      {/* "Oyun yükleniyor..." ekranı (referans) */}
      {loading && (
        <div className="fixed inset-0 z-[97] bg-black/60 flex items-center justify-center p-4">
          <div
            className="bg-[#d4d0c8] border-t border-l border-[#dfdfdf] border-b border-r border-[#404040] shadow-pop w-full max-w-sm"
            style={{ fontFamily: TAHOMA }}
          >
            <div className="flex items-center justify-between px-2 py-1 bg-gradient-to-b from-[#3a6ea5] to-[#0a246a] text-white text-xs font-bold">
              <span>[ Oyun Yükleniyor ]</span>
              <span className="px-1.5 bg-[#d4d0c8] text-black leading-4">×</span>
            </div>
            <div className="px-5 py-6 text-center">
              <p className="text-[13px] font-bold text-black mb-3">Oyun yükleniyor...</p>
              <div className="h-4 bg-white border border-[#808080] p-[2px]">
                <div className="h-full bg-gradient-to-b from-[#6a94d0] to-[#0a246a] vk-loadbar" />
              </div>
              <p className="text-[11px] text-black mt-3">Lütfen bekleyiniz — masa hazırlanıyor…</p>
            </div>
          </div>
        </div>
      )}
    </AutoFit>

    {/* ── Yönetim paneli — salon yöneticileri: kendi aralarında sohbet +
        genel sohbet temizle / kilitle kontrolleri (salona girince otomatik açılır).
        AutoFit'in DIŞINDA render edilir — mobilde ölçeklenmeden tam ekran çalışır. ── */}
    {yonetimAcik && myPower !== undefined && (
      <div
        className="fixed inset-0 z-[95] bg-black/50 flex items-end sm:items-center justify-center sm:p-3"
        onClick={() => setYonetimAcik(false)}
      >
        <div
          onClick={(e) => e.stopPropagation()}
          className="bg-[#d4d0c8] border-t border-l border-[#dfdfdf] border-b border-r border-[#404040] shadow-pop w-full sm:max-w-[760px] max-h-[92dvh] sm:max-h-[86dvh] flex flex-col rounded-t-lg sm:rounded-none"
          style={{ fontFamily: TAHOMA }}
        >
          {/* Pencere başlığı */}
          <div className="flex items-center justify-between px-2 py-1.5 sm:py-1 bg-gradient-to-b from-[#3a6ea5] to-[#0a246a] text-white text-xs font-bold select-none">
            <span className="truncate">🛡️ [ Yönetim Paneli — {title} ]</span>
            <button
              onClick={() => setYonetimAcik(false)}
              className="px-2 py-0.5 bg-[#d4d0c8] text-black leading-5 hover:bg-[#e0dcd4] min-w-[30px] min-h-[26px]"
              title="Kapat"
            >
              ×
            </button>
          </div>

          {/* Bilgi şeridi — mobilde kısa, masaüstünde açıklama tam */}
          <div className="px-2 py-1 text-[11px] text-black bg-[#e8e4dc] border-b border-[#a0a0a0]">
            <b>Salon yöneticileri paneli</b>
            <span className="hidden sm:inline">
              {" "}— bu panel yalnızca salon yöneticilerine açılır; buradaki sohbeti yalnızca yönetici kademesi görür. Aşağıdaki kontroller <b>genel sohbeti</b> yönetir.
            </span>
            <span className="sm:hidden"> — sohbet ve kontroller aşağıda ↓</span>
          </div>

          {/* İçerik: mobilde sekme (Sohbet/Kontrol/Ekip), masaüstünde iki sütun */}
          <YonetimIcerik
            salon={salon}
            title={title}
            myPower={myPower}
            staffCount={staffCount}
            users={users}
            chatLocked={chatLocked}
            onTemizle={() => void sohbetTemizle()}
            onKilit={() => void sohbetKilit()}
            onKayit={() => void sohbetKayit()}
          />

          {/* Alt buton çubuğu */}
          <div className="flex items-center justify-between gap-1 px-2 py-1.5 sm:py-1 border-t border-[#a0a0a0]">
            <span className="text-[10px] text-black truncate">
              Yetkin: {myPower === "full" ? "tam yetki (temizle/kilitle/kayıt)" : "susturma"}
            </span>
            <KBtn onClick={() => setYonetimAcik(false)}>Kapat</KBtn>
          </div>
        </div>
      </div>
    )}
    </>
  );
}

// ---------------------------------------------------------------------------
// Yönetim paneli içeriği — mobilde sekme düzeni (Sohbet / Kontrol / Ekip),
// masaüstünde (sm+) klasik iki sütun. Dokunma hedefleri mobilde büyütülür.
// ---------------------------------------------------------------------------
export function YonetimIcerik({
  salon, title, myPower, staffCount, users, chatLocked, onTemizle, onKilit, onKayit,
}: {
  salon: string;
  title: string;
  myPower: "full" | "mute";
  staffCount: number;
  users: ApiSalonUser[];
  chatLocked: boolean;
  onTemizle: () => void;
  onKilit: () => void;
  onKayit: () => void;
}) {
  const [sekme, setSekme] = useState<"sohbet" | "kontrol" | "ekip">("sohbet");

  // Masaüstü: iki sütun (sekme şeridi gizli). Mobil: tek sütun + sekme.
  return (
    <div className="flex-1 min-h-0 flex flex-col">
      {/* Mobil sekme şeridi — Win98 tarzı, dokunma hedefi yüksek */}
      <div className="flex sm:hidden border-b border-[#808080] bg-[#d4d0c8] select-none">
        {([["sohbet", "💬 Sohbet"], ["kontrol", "🛠️ Kontrol"], ["ekip", "★ Ekip"]] as const).map(([k, label]) => (
          <button
            key={k}
            onClick={() => setSekme(k)}
            className={`flex-1 py-2.5 text-[12px] font-bold text-black border-r border-[#808080] last:border-r-0 ${
              sekme === k ? "bg-white border-b border-b-white -mb-px" : "bg-gradient-to-b from-[#e0dcd4] to-[#c8c4bc] hover:bg-[#e8e4dc]"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="flex-1 min-h-0 grid grid-cols-1 sm:grid-cols-[1fr_220px] sm:grid-rows-[1fr_auto] gap-2 p-2">
        {/* Sol: yönetici sohbeti (yonetim:<salon> odası — yalnız yetkili) */}
        <div className={`flex flex-col min-h-0 sm:col-start-1 sm:row-start-1 sm:row-span-2 ${sekme !== "sohbet" ? "hidden sm:flex" : ""}`}>
          <div className="text-[11px] font-bold text-[#0a246a] px-1 pb-1">
            💬 Yönetici Sohbeti — {staffCount + 1} yetkili bu salonda
          </div>
          <div className="flex-1 min-h-[45dvh] sm:min-h-[260px] border border-[#808080] bg-white flex flex-col">
            <ChatPanel room={`yonetim:${salon}`} classic ctxPower={myPower} ctxSalon={salon} />
          </div>
        </div>

        {/* Sağ üst: genel sohbet kontrolleri — temizle / kilitle / kaydet */}
        <div className={`flex flex-col gap-2 min-h-0 sm:col-start-2 sm:row-start-1 ${sekme !== "kontrol" ? "hidden sm:flex" : ""}`}>
          <div className="border border-[#808080] bg-[#d4d0c8] flex flex-col">
            <div className="px-2 py-0.5 bg-gradient-to-b from-[#3a6ea5] to-[#0a246a] text-white text-[11px] font-bold">
              Genel Sohbet Kontrolü
            </div>
            <div className="p-2 flex flex-col gap-1.5">
              <button
                onClick={onTemizle}
                className="px-2 py-2.5 sm:py-1.5 text-[13px] sm:text-[12px] font-bold text-black bg-[#d4d0c8] border-t border-l border-white border-b border-r border-[#404040] hover:bg-[#e0dcd4] active:bg-[#c8c4bc]"
                title="Genel sohbetteki tüm mesajları sil"
              >
                🧹 Sohbeti Temizle
              </button>
              <button
                onClick={onKilit}
                className={`px-2 py-2.5 sm:py-1.5 text-[13px] sm:text-[12px] font-bold text-black bg-[#d4d0c8] border-t border-l border-white border-b border-r border-[#404040] hover:bg-[#e0dcd4] active:bg-[#c8c4bc] ${chatLocked ? "!bg-[#ffe0e0]" : ""}`}
                title="Herkes yazabilir / yalnızca yöneticiler"
              >
                {chatLocked ? "🔓 Sohbeti Aç" : "🔒 Sohbeti Kapat"}
              </button>
              <button
                onClick={onKayit}
                className="px-2 py-2.5 sm:py-1.5 text-[13px] sm:text-[12px] font-bold text-black bg-[#d4d0c8] border-t border-l border-white border-b border-r border-[#404040] hover:bg-[#e0dcd4] active:bg-[#c8c4bc]"
                title="Salon yazışmalarını kaydet / indir"
              >
                📒 Yazışma Kaydı
              </button>
              <div className="mt-1 text-[11px] sm:text-[10px] leading-relaxed text-black border-t border-[#a0a0a0] pt-1.5">
                Durum:{" "}
                {chatLocked ? (
                  <b className="text-[#cc0000]">Kapalı — yalnızca yöneticiler yazabilir</b>
                ) : (
                  <b className="text-[#007a3d]">Açık — herkes yazabilir</b>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Ekip — mobilde üçüncü sekme, masaüstünde sağ sütunun alt satırı */}
        <div className={`flex flex-col gap-2 min-h-0 sm:col-start-2 sm:row-start-2 ${sekme !== "ekip" ? "hidden sm:flex" : ""}`}>
          <div className="border border-[#808080] bg-white flex-1 min-h-0 max-h-[180px] sm:max-h-none flex flex-col">
            <div className="px-2 py-0.5 bg-gradient-to-b from-[#3a6ea5] to-[#0a246a] text-white text-[11px] font-bold">
              ★ Salon Ekibi
            </div>
            <div className="flex-1 min-h-0 overflow-y-auto text-[12px] sm:text-[11px]">
              {users.filter((u) => u.role !== "member").length === 0 && (
                <p className="text-[#808080] px-2 py-1">
                  Bu salonda henüz salon ekibi yok — ★ Salon Ekibi ile ekip ata.
                </p>
              )}
              {users
                .filter((u) => u.role !== "member")
                .map((u) => (
                  <div key={u.nick} className="flex items-center justify-between px-2 py-1 sm:py-0.5 border-b border-[#e0e0e0]">
                    <span
                      className="truncate font-bold"
                      style={
                        nickTextColor({ nick: u.nick, rank: u.rank, salonRole: u.role, custom: u.nickColor })
                          ? { color: nickTextColor({ nick: u.nick, rank: u.rank, salonRole: u.role, custom: u.nickColor })! }
                          : undefined
                      }
                    >
                      {u.nick}
                    </span>
                    <span className="text-[10px] text-black shrink-0 ml-1">{roleLabel(u.role)}</span>
                  </div>
                ))}
            </div>
          </div>

          {/* Masaüstünde kontrollerin altındaki "sohbet/kayıt" ipucu — mobilde gizli */}
          <div className="hidden sm:block text-[10px] text-black px-1 leading-snug">
            {title} · yöneticiler dışı bu sohbeti göremez.
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Salon ekibi modalı: sahip 2 admin / 2 süper op / 20 yönetici atayabilir.
// ---------------------------------------------------------------------------
function SalonStaffModal({
  salon,
  users,
  staff,
  isOwner,
  onClose,
  onChanged,
}: {
  salon: string;
  users: ApiSalonUser[];
  staff: ApiSalonStaff[];
  isOwner: boolean;
  onClose: () => void;
  onChanged: () => void;
}) {
  const showToast = useApp((s) => s.showToast);
  const [busy, setBusy] = useState(false);
  const [nick, setNick] = useState("");
  const [role, setRole] = useState<"admin" | "superop" | "yonetici">("yonetici");

  const counts = (r: string) => staff.filter((s) => s.role === r).length;

  const act = async (action: "add" | "remove", targetNick: string, targetRole: "admin" | "superop" | "yonetici") => {
    if (busy) return;
    setBusy(true);
    try {
      await api.salonStaffSet({ salon, action, nick: targetNick, role: targetRole });
      showToast(action === "add" ? `${targetNick} ${roleLabel(targetRole)} yapıldı.` : `${targetNick} görevden alındı.`);
      onChanged();
    } catch (e) {
      showToast(e instanceof Error ? e.message : "İşlem başarısız.");
    }
    setBusy(false);
  };

  return (
    <div className="fixed inset-0 z-[95] bg-black/70 flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-wood-950 border-2 border-gold-700 rounded-2xl w-full max-w-md shadow-pop animate-floatUp"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-5 py-4 border-b border-wood-800">
          <h3 className="font-display text-xl font-bold text-gold-300">⚙️ Salon Ekibi</h3>
          <p className="text-xs text-ivory-dark/60 mt-0.5">
            Kendi ekibini kur: en fazla <b className="text-ivory">2 admin</b>,{" "}
            <b className="text-ivory">2 süper op</b>, <b className="text-ivory">20 yönetici</b>.
          </p>
        </div>

        <div className="p-5 space-y-4">
          {/* Ekle */}
          <div className="bg-wood-900/60 border border-wood-800 rounded-xl p-3">
            <p className="text-xs font-bold text-gold-500 mb-2">Yetkili Ekle</p>
            <div className="flex gap-2">
              <input
                value={nick}
                onChange={(e) => setNick(e.target.value)}
                placeholder="Üye nick'i"
                className="flex-1 bg-wood-900 border border-wood-700 rounded-lg px-3 py-2 text-sm text-ivory placeholder:text-ivory-dark/30 focus:outline-none focus:border-gold-600"
              />
              <select
                value={role}
                onChange={(e) => setRole(e.target.value as typeof role)}
                className="bg-wood-900 border border-wood-700 rounded-lg px-2 py-2 text-sm text-ivory focus:outline-none focus:border-gold-600"
              >
                {STAFF_ROLES.map((r) => (
                  <option key={r.role} value={r.role}>
                    {r.label} ({counts(r.role)}/{r.limit})
                  </option>
                ))}
              </select>
              <button
                onClick={() => nick.trim() && act("add", nick.trim(), role)}
                disabled={busy || !nick.trim()}
                className="px-3 py-2 rounded-lg bg-gold-600 hover:bg-gold-500 disabled:opacity-60 text-wood-950 text-sm font-bold"
              >
                Ekle
              </button>
            </div>
          </div>

          {/* Rol listeleri */}
          {STAFF_ROLES.map((r) => {
            const list = staff.filter((s) => s.role === r.role);
            return (
              <div key={r.role}>
                <p className="text-xs font-bold text-gold-500 mb-1.5 flex items-center gap-2">
                  {r.label}
                  <span className="text-ivory-dark/50 font-normal">
                    {list.length}/{r.limit}
                  </span>
                </p>
                {list.length === 0 ? (
                  <p className="text-[11px] text-ivory-dark/40 px-1">— kimse yok —</p>
                ) : (
                  <div className="space-y-1">
                    {list.map((s) => (
                      <div
                        key={s.id}
                        className="flex items-center justify-between px-2.5 py-1.5 rounded-lg bg-wood-900/60 border border-wood-800"
                      >
                        <span className="text-sm text-ivory">{s.nick}</span>
                        <button
                          onClick={() => act("remove", s.nick, s.role)}
                          disabled={busy}
                          className="text-xs text-red-400 hover:text-red-300 font-semibold disabled:opacity-50"
                        >
                          Kaldır
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <button
          onClick={onClose}
          className="w-full py-2.5 border-t border-wood-800 text-ivory-dark/70 hover:text-ivory text-sm font-semibold transition-colors"
        >
          Kapat
        </button>
      </div>
    </div>
  );
}
