// ---------------------------------------------------------------------------
// Backend API istemcisi.
// VITE_API_BASE derleme sırasında ayarlanabilir (PHP hosting için boş bırakılır
// → aynı domaindeki /api/public/* uçlarına gider); boşsa varsayılan Youbase
// staging adresi kullanılır.
// Token localStorage'da tutulur.
// ---------------------------------------------------------------------------
import type { Profile, RankId } from "./types";

const RAW_BASE = (import.meta.env.VITE_API_BASE as string | undefined) ?? "";

// Kendi sunucumuzun API'si (PHP reverse-proxy: /api/public/* → Youbase).
// DİKKAT: yollar zaten "/api/public/..." ile başlar — bu yüzden tabana
// "https://hasokey.com.tr" yazılır (SONUNA /api EKLENMEZ, yoksa
// /api/api/public/... olur ve proxy "Bulunamadi" döner — yaşanan hata buysu).
const STORE_API = "https://hasokey.com.tr";
// Youbase birincil adresi (yalnız geliştirme/önizlemede ilk tercih).
const YOUBASE = "https://staging--4hv6t9m7l6i0u0zohoqq.youbase.cloud";

function isElectronApp(): boolean {
  return typeof window !== "undefined" && !!window.vkElectron?.isElectron;
}

/** Denenecek API adresleri — sırayla denenir, ilk çalışan kalır.
 * Boş string = aynı origin'e göreli (/api/public/... — sitede ve app://'de çalışır). */
function pickBases(): string[] {
  if (RAW_BASE !== "") return [RAW_BASE.replace(/\/$/, "")];
  // Program (Electron): youbase bazı ağlarda engelli → önce kendi alan adımız,
  // sonra göreli yol (app:// protocol handler → store), en sonda youbase.
  if (isElectronApp()) return [STORE_API, "", YOUBASE];
  // Sitenin kendisi (hasokey.com.tr / veradekorasyon.store): önce kendi sunucumuz.
  // DİKKAT: eski kontrol "...hasokey.com.tr.store" arıyordu → HİÇ eşleşmiyor ve
  // istekler engelli/staging youbase'e gidiyordu (girişte "sunucuya ulaşılamıyor"
  // ve eski/staging veri hatasının kökeni BUYDU). Alan adı sonu kontrolü artık doğru.
  if (typeof location !== "undefined" && /(^|\.)(hasokey\.com\.tr|veradekorasyon\.store)$/i.test(location.hostname)) {
    return ["", STORE_API, YOUBASE];
  }
  // Youware önizleme vb. diğer kaynaklar: kendi sunucumuz (CORS açık) → youbase yedeği.
  // Göreli yol ("") BURAYA KOYULMAZ: önizleme sunucusu /api/* yerine SPA index.html
  // döndürür → yanıt JSON değil → apiFetch sıradaki adrese geçmez, hata verir.
  return [STORE_API, YOUBASE];
}

const BASES = pickBases();
export const API_BASE = BASES[0];
let baseIndex = 0;

const HAS_TIMEOUT =
  typeof AbortSignal !== "undefined" && typeof (AbortSignal as { timeout?: unknown }).timeout === "function";

/** API istekleri: sırayla denenir; ağ hatası/zaman aşımında sıradaki adrese geçilir,
 * çalışan adres kalıcı olarak işaretlenir. Akış (stream) isteklerinde timeout uygulanmaz.
 * DAYANIKLILIK: kısa ağ kesintileri (Wi-Fi titremesi, DNS/DNS benzeri anlık hata)
 * tüm adresleri birden düşürmesin diye ADRES BAŞINA en fazla 2 deneme yapılır —
 * ilk deneme 2,5 sn'den kısa çökerse 400 ms bekleyip aynı adrese tekrar gidilir;
 * 12 sn zaman aşımında ise bekleme uzamasın diye tekrar yapılmaz. Böylece tek bir
 * kopuuda "Sunucuya ulaşılamıyor" hatası kullanıcıya yansımaz. */
async function apiFetch(path: string, init?: RequestInit): Promise<Response> {
  const headers = { "Content-Type": "application/json", ...(init?.headers ?? {}) };
  let lastErr: unknown = null;
  for (let i = baseIndex; i < BASES.length; i++) {
    for (let deneme = 0; deneme < 2; deneme++) {
      const t0 = Date.now();
      try {
        const signal =
          init?.signal ?? (HAS_TIMEOUT ? AbortSignal.timeout(12_000) : undefined);
        const res = await fetch(`${BASES[i]}${path}`, { ...init, headers, signal });
        baseIndex = i; // bundan sonra bu adresle devam et
        return res;
      } catch (e) {
        lastErr = e; // ağ hatası / zaman aşımı
        const hizliKoptu = Date.now() - t0 < 2500;
        if (deneme === 0 && hizliKoptu && !init?.signal) {
          await new Promise((r) => setTimeout(r, 400)); // kısa kesinti → tekrar dene
          continue;
        }
        break; // zaman aşımı ya da ikinci deneme de başarısız → sıradaki adres
      }
    }
  }
  throw lastErr ?? new Error("Ağ hatası");
}

const LS_TOKEN = "vk_api_token";

export function getToken(): string | null {
  try {
    return localStorage.getItem(LS_TOKEN);
  } catch {
    return null;
  }
}

export function setToken(t: string | null) {
  try {
    if (t) localStorage.setItem(LS_TOKEN, t);
    else localStorage.removeItem(LS_TOKEN);
  } catch {
    /* yok say */
  }
}

export interface ApiUser {
  id: number;
  nick: string;
  rank: RankId;
  gold: number;
  chips: number;
  banned: number;
  mutedUntil: number; // saniye
  createdAt: number;
  points?: number; // puan (profil/yanıtta)
  gender?: string; // "e" | "k"
  avatar?: string; // emoji ("emoji:🦊") veya görsel URL
  bio?: string;
  nickColor?: string; // üyenin seçtiği nick rengi
  textColor?: string; // üyenin seçtiği yazı (mesaj) rengi
  // Oyun istatistikleri (yalnız profil yanıtında)
  gamesPlayed?: number; // oynanan oyun
  gamesWon?: number; // kazanılan oyun
  winRate?: number; // kazanma oranı (%)
  sira?: number; // global sıralama (puan/çip sırası — referanstaki "Sıra: 106.651")
  lastExitTs?: number; // son çıkış zaman damgası (unix, saniye)
  lastExitSalon?: string; // son çıkışın yapıldığı salon anahtarı ("1_1" gibi)
}

export interface ApiChatMsg {
  id: number;
  userId: number | null;
  nick: string;
  salon: string;
  text: string;
  kind: string;
  createdAt: number; // saniye
  rank?: string | null; // gönderenin kademesi (renk için)
  gold?: number | null;
  nickColor?: string | null; // gönderenin seçtiği nick rengi
  textColor?: string | null; // gönderenin seçtiği yazı (mesaj) rengi
}

async function call<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await apiFetch(path, init);
  } catch {
    throw new Error("Sunucuya ulaşılamıyor, internetinizi kontrol edin.");
  }
  let data: T & { error?: string };
  try {
    data = await res.json();
  } catch {
    throw new Error("Sunucudan geçersiz yanıt geldi.");
  }
  if (!res.ok || data?.error) throw new Error(data?.error || `Hata ${res.status}`);
  return data;
}

export interface ApiTable {
  id: number;
  salon: string;
  game: string;
  ownerId: number | null;
  ownerNick: string;
  seats: number;
  players: string; // JSON: [{id, nick}]
  status: string;
  name?: string | null; // masa adı (CreateTableModal)
  settings?: string | null; // JSON: masa ayarları (el sayısı, sohbet, izleyici…)
  createdAt: number;
  updatedAt: number;
}

/** DB masa kaydındaki oyuncu listesini çözer (bot:true — salon botları) */
export function parsePlayers(t: ApiTable): { id: number; nick: string; bot?: boolean }[] {
  try {
    const p = JSON.parse(t.players);
    return Array.isArray(p) ? p : [];
  } catch {
    return [];
  }
}

export interface ApiMember {
  id: number;
  nick: string;
  rank: RankId;
  gold: number;
  chips: number;
  banned: number;
  mutedUntil: number; // saniye
  lastSeen: number | null;
  nickColor?: string | null;
}

export interface ApiRental {
  id: number;
  floor: number;
  slot: number;
  ownerNick: string;
  ownerId: number | null;
  name?: string | null; // site sahibinin verdiği salon adı
  basePrice: number;
  gold: number;
  avatarPkg: number;
  diamondPkg: number;
  entry25Pkg: number;
  asAdminPkg: number;
  mgmtPkg: number;
  createdAt: number;
}

export type SalonRole = "siteowner" | "owner" | "admin" | "superop" | "yonetici" | "member";

export interface ApiTopUser {
  id: number;
  nick: string;
  chips: number;
  rank: string;
  gender?: string;
  avatar?: string;
  gold: number;
}

export interface ApiSalonUser {
  id: number;
  nick: string;
  rank: string;
  gold: number;
  chips?: number;
  gender?: string;
  avatar?: string;
  banned: number;
  lastSeen: number;
  role: SalonRole;
  nickColor?: string | null;
}

export interface ApiSalonStaff {
  id: number;
  salon: string;
  nick: string;
  role: "admin" | "superop" | "yonetici";
  createdAt: number;
}

export interface ApiModLog {
  id: number;
  actorNick: string;
  action: string;
  targetNick: string;
  detail: string | null;
  createdAt: number; // saniye
}

/** Web master'ın sağ tık → Üye Bilgisi'nde gördüğü detay */
export interface ApiMemberInfo {
  nick: string;
  rank: string;
  gold: number;
  chips: number;
  points: number;
  email: string;
  country: string;
  city: string;
  lastIp: string;
  loginRegion: string;
  loginCity: string;
  loginCountry: string;
  loginAt: number;
  lastSeen: number | null;
  createdAt: number;
  banned: number;
  loginWhere: string; // giriş yaptığı il/şehir/ülke
  openAddress: string; // açık adres (IP)
  lat: number; // harita için enlem (0 = yok)
  lng: number; // harita için boylam (0 = yok)
}

export const api = {
  async register(nick: string, password: string, gender: "e" | "k" = "e", email = "", country = "", city = "") {
    const r = await call<{ token: string; user: ApiUser }>("/api/public/register", {
      method: "POST",
      body: JSON.stringify({ nick, password, gender, email, country, city }),
    });
    setToken(r.token);
    return r;
  },
  async login(nick: string, password: string) {
    const r = await call<{ token: string; user: ApiUser }>("/api/public/login", {
      method: "POST",
      body: JSON.stringify({ nick, password }),
    });
    setToken(r.token);
    return r;
  },
  async logout() {
    const token = getToken();
    if (!token) return;
    setToken(null);
    try {
      await call("/api/public/logout", { method: "POST", body: JSON.stringify({ token }) });
    } catch {
      /* çıkış hatası görmezden gelinebilir */
    }
  },
  async me() {
    const token = getToken();
    if (!token) throw new Error("Oturum yok");
    return call<{ user: ApiUser }>(`/api/public/me?token=${encodeURIComponent(token)}`);
  },
  async chat(salon: string, limit = 120, after = 0) {
    const token = getToken();
    return call<{ messages: ApiChatMsg[] }>(
      `/api/public/chat?salon=${encodeURIComponent(salon)}&limit=${limit}&after=${after}${token ? `&token=${encodeURIComponent(token)}` : ""}`
    );
  },

  /** Özel mesaj gelen kutusu — katıldığın PM konuşmaları + son mesaj */
  async pmRooms() {
    const token = getToken();
    if (!token) throw new Error("Önce giriş yapın");
    return call<{
      rooms: {
        room: string;
        peer: string;
        count: number;
        last: { id: number; nick: string; text: string; kind: string; createdAt: number };
      }[];
    }>(`/api/public/pmrooms?token=${encodeURIComponent(token)}`);
  },
  async sendChat(salon: string, text: string) {
    const token = getToken();
    if (!token) throw new Error("Önce giriş yapın");
    return call<{ message: ApiChatMsg }>("/api/public/chat", {
      method: "POST",
      body: JSON.stringify({ token, salon, text }),
    });
  },
  /** Sohbeti temizle — odadaki TÜM mesajları siler (üye profili / özel / salon) */
  async chatClear(salon: string) {
    const token = getToken();
    if (!token) throw new Error("Önce giriş yapın");
    return call<{ ok: boolean; clearedId: number }>("/api/public/chatclear", {
      method: "POST",
      body: JSON.stringify({ token, salon }),
    });
  },
  async addChips(delta: number, reason: string) {
    const token = getToken();
    if (!token) throw new Error("Oturum yok");
    return call<{ chips: number }>("/api/public/result", {
      method: "POST",
      body: JSON.stringify({ token, delta, reason }),
    });
  },
  /** Oyun sonucu kaydı — profil istatistikleri (oynanan/kazanılan) */
  async recordGame(won: boolean) {
    const token = getToken();
    if (!token) return; // oturum yoksa sessizce geç
    return call<{ gamesPlayed: number; gamesWon: number; winRate: number }>(
      "/api/public/gamestat",
      { method: "POST", body: JSON.stringify({ token, won }) }
    );
  },

  /** Sesli görüşme sinyali gönder (WebRTC signaling: call/answer/reject/busy/end) */
  async voiceSignal(to: string, kind: string, payload = "") {
    const token = getToken();
    if (!token) throw new Error("Önce giriş yapın");
    return call<{ ok: boolean }>("/api/public/voice/signal", {
      method: "POST",
      body: JSON.stringify({ token, to, kind, payload }),
    });
  },
  async mod(action: string, targetNick: string, value?: string | number, salon?: string) {
    const token = getToken();
    if (!token) throw new Error("Önce giriş yapın");
    return call<{ ok: boolean }>("/api/public/mod", {
      method: "POST",
      body: JSON.stringify({ token, action, targetNick, value, salon }),
    });
  },
  async tables(salon: string) {
    return call<{ tables: ApiTable[] }>(`/api/public/tables?salon=${encodeURIComponent(salon)}`);
  },
  async createTable(salon: string, game: string, opts?: { name?: string; settings?: Record<string, unknown> }) {
    const token = getToken();
    if (!token) throw new Error("Önce giriş yapın");
    return call<{ table: ApiTable }>("/api/public/tables", {
      method: "POST",
      body: JSON.stringify({ token, salon, game, name: opts?.name, settings: opts?.settings }),
    });
  },
  async joinTable(id: number) {
    const token = getToken();
    if (!token) throw new Error("Önce giriş yapın");
    return call<{ table: ApiTable }>(`/api/public/tables/${id}/join`, {
      method: "POST",
      body: JSON.stringify({ token }),
    });
  },
  async leaveTable(id: number) {
    const token = getToken();
    if (!token) throw new Error("Önce giriş yapın");
    return call<{ table: ApiTable }>(`/api/public/tables/${id}/leave`, {
      method: "POST",
      body: JSON.stringify({ token }),
    });
  },

  /** Tek masa çekme (oyun sayfaları bot isimlerini masadan okur) */
  async table(id: number) {
    return call<{ table: ApiTable }>(`/api/public/tables/${id}`);
  },

  /** Salon botları (site sahibi sağ tık ile atar) */
  async salonBots(salon: string) {
    const token = getToken();
    if (!token) throw new Error("Önce giriş yapın");
    return call<{ bots: { id: number; salon: string; nick: string }[] }>(
      `/api/public/salonbots?token=${encodeURIComponent(token)}&salon=${encodeURIComponent(salon)}`
    );
  },

  /** Salona bot ekle (count 1-12) veya action:"clear" ile temizle — site sahibi */
  async salonBotsAdd(salon: string, count: number) {
    const token = getToken();
    if (!token) throw new Error("Önce giriş yapın");
    return call<{ ok: boolean; added: number }>("/api/public/salonbots", {
      method: "POST",
      body: JSON.stringify({ token, salon, action: "add", count }),
    });
  },

  async salonBotsClear(salon: string) {
    const token = getToken();
    if (!token) throw new Error("Önce giriş yapın");
    return call<{ ok: boolean; removed: number }>("/api/public/salonbots", {
      method: "POST",
      body: JSON.stringify({ token, salon, action: "clear" }),
    });
  },

  /** Genel sohbet ayarları: kilit durumu (salon odası) */
  async salonChat(salon: string) {
    return call<{ locked: boolean }>(
      `/api/public/salonchat?salon=${encodeURIComponent(salon)}&token=${getToken() ?? ""}`
    );
  },

  /** Genel sohbet kaydı — salon yöneticileri (tüm geçmiş, temizlenmiş mesajlar dahil) */
  async salonChatLog(salon: string) {
    return call<{ messages: { id: number; nick: string; text: string; kind: string; createdAt: number }[] }>(
      `/api/public/salonchatlog?salon=${encodeURIComponent(salon)}&token=${getToken() ?? ""}`
    );
  },

  /** Genel sohbet: temizle / kilitle / aç — salon yöneticileri */
  async salonChatAction(salon: string, action: "clear" | "lock" | "unlock") {
    const token = getToken();
    if (!token) throw new Error("Önce giriş yapın");
    return call<{ ok: boolean; locked: boolean }>(`/api/public/salonchat`, {
      method: "POST",
      body: JSON.stringify({ token, salon, action }),
    });
  },

  /** Masaya salon botlarını davet et (boş koltukları doldurur) */
  async inviteTableBots(id: number) {
    const token = getToken();
    if (!token) throw new Error("Önce giriş yapın");
    return call<{ table: ApiTable; joined: number }>(`/api/public/tables/${id}/bots`, {
      method: "POST",
      body: JSON.stringify({ token }),
    });
  },

  /** Masayı kapat (site sahibi / admin / salon sahibi / salon ekibi) */
  async closeTable(id: number) {
    const token = getToken();
    if (!token) throw new Error("Önce giriş yapın");
    return call<{ table: ApiTable }>(`/api/public/tables/${id}/close`, {
      method: "POST",
      body: JSON.stringify({ token }),
    });
  },
  async members() {
    const token = getToken();
    if (!token) throw new Error("Önce giriş yapın");
    return call<{ members: ApiMember[] }>(`/api/public/members?token=${encodeURIComponent(token)}`);
  },
  async modLogs() {
    const token = getToken();
    if (!token) throw new Error("Önce giriş yapın");
    return call<{ logs: ApiModLog[] }>(`/api/public/modlogs?token=${encodeURIComponent(token)}`);
  },

  /** Üye detay bilgisi — web master (sağ tık → Üye Bilgisi): giriş ili + açık adres (IP) */
  async memberInfo(nick: string) {
    const token = getToken();
    if (!token) throw new Error("Önce giriş yapın");
    return call<{ member: ApiMemberInfo }>(
      `/api/public/memberinfo?token=${encodeURIComponent(token)}&nick=${encodeURIComponent(nick)}`
    );
  },

  /** Herkese açık üye profili (nick ile) */
  async profile(nick: string) {
    return call<{ user: ApiUser }>(`/api/public/profile?nick=${encodeURIComponent(nick)}`);
  },

  /** Kendi profilini güncelle (gender / avatar / bio / nickColor / textColor) */
  async updateProfile(patch: { gender?: "e" | "k"; avatar?: string; bio?: string; nickColor?: string; textColor?: string }) {
    const token = getToken();
    if (!token) throw new Error("Önce giriş yapın");
    return call<{ user: ApiUser }>("/api/public/profile", {
      method: "POST",
      body: JSON.stringify({ token, ...patch }),
    });
  },

  async salonRentals() {
    return call<{ rentals: ApiRental[] }>("/api/public/salonrentals");
  },

  /** Salon kiralama/silme/ad değiştirme — action: "rent" | "remove" | "rename" (yalnızca admin) */
  async salonRental(action: {
    action: "rent" | "remove" | "rename";
    floor: number;
    slot: number;
    ownerNick?: string;
    gold?: boolean;
    name?: string;
    packages?: { avatar?: boolean; diamond?: boolean; entry25?: boolean; asAdmin?: boolean; mgmt?: boolean };
  }) {
    const token = getToken();
    if (!token) throw new Error("Önce giriş yapın");
    return call<{ ok?: boolean; rental?: ApiRental; monthly?: number }>("/api/public/salonrental", {
      method: "POST",
      body: JSON.stringify({ token, ...action }),
    });
  },

  async top10() {
    return call<{ top: ApiTopUser[] }>("/api/public/top10");
  },

  /** Salon odasına katıl (last_salon güncellenir) */
  async salonJoin(salon: string) {
    const token = getToken();
    if (!token) throw new Error("Önce giriş yapın");
    return call<{ ok: boolean; salon: string }>("/api/public/salonjoin", {
      method: "POST",
      body: JSON.stringify({ token, salon }),
    });
  },

  /** Salonun mevcut üyeleri (son 5 dk) + sahip */
  async salonUsers(salon: string) {
    const token = getToken();
    if (!token) throw new Error("Önce giriş yapın");
    return call<{ users: ApiSalonUser[]; owner: string | null; salonName?: string; blocked?: string[] }>(
      `/api/public/salonusers?salon=${encodeURIComponent(salon)}&token=${encodeURIComponent(token)}`
    );
  },

  async salonStaffList(salon: string) {
    const token = getToken();
    if (!token) throw new Error("Önce giriş yapın");
    return call<{ staff: ApiSalonStaff[] }>(
      `/api/public/salonstaff?salon=${encodeURIComponent(salon)}&token=${encodeURIComponent(token)}`
    );
  },

  /** Salon yetkilisi ekle/kaldır — rol: admin | superop | yonetici */
  async salonStaffSet(action: {
    salon: string;
    action: "add" | "remove";
    nick: string;
    role: "admin" | "superop" | "yonetici";
  }) {
    const token = getToken();
    if (!token) throw new Error("Önce giriş yapın");
    return call<{ ok: boolean }>("/api/public/salonstaff", {
      method: "POST",
      body: JSON.stringify({ token, ...action }),
    });
  },
  async goldActivate() {
    const token = getToken();
    if (!token) throw new Error("Önce giriş yapın");
    return call<{ ok: boolean; chips: number }>("/api/public/gold/activate", {
      method: "POST",
      body: JSON.stringify({ token }),
    });
  },

  // ── Çevrimiçi eşleşme (34 / 51) ──────────────────────────────
  /** Online eşleşme kuyruğuna gir (veya aktif odayı bul) */
  async matchQueue(mode: "otuzdort" | "ellibir") {
    const token = getToken();
    if (!token) throw new Error("Önce giriş yapın");
    return call<{ status: "waiting" | "playing"; roomId?: number }>(
      "/api/public/match/queue",
      { method: "POST", body: JSON.stringify({ token, mode }) }
    );
  },

  /** Eşleşme kuyruğundan çık */
  async matchCancel(mode: "otuzdort" | "ellibir") {
    const token = getToken();
    if (!token) throw new Error("Önce giriş yapın");
    return call<{ ok: boolean }>("/api/public/match/cancel", {
      method: "POST",
      body: JSON.stringify({ token, mode }),
    });
  },

  /** Oda durumunu çek (AI hamleleri sunucuda işletilir) */
  async roomState(roomId: number) {
    const token = getToken();
    if (!token) throw new Error("Önce giriş yapın");
    return call<{ roomId: number; status: string; view: OnlineOkeyView }>(
      `/api/public/room/${roomId}?token=${encodeURIComponent(token)}`
    );
  },

  /** Hamle gönder: draw | take | discard | finish | newRound */
  async roomAction(roomId: number, type: string, tileId?: string) {
    const token = getToken();
    if (!token) throw new Error("Önce giriş yapın");
    return call<{ view: OnlineOkeyView }>(`/api/public/room/${roomId}/action`, {
      method: "POST",
      body: JSON.stringify({ token, type, tileId }),
    });
  },
};

// ── Çevrimiçi oda görünümü (sunucu tarafı oyun durumu) ──────────
export interface OnlineTile {
  id: string;
  num: number;
  color: number;
  wild: boolean;
}

export interface OnlinePlayerView {
  seat: number;
  nick: string;
  isAI: boolean;
  handCount: number;
  score: number;
}

export interface OnlineRoundOver {
  winner: number;
  penalties: number[];
  finished: boolean;
  matchOver: boolean;
}

export interface OnlineOkeyView {
  mySeat: number;
  mode: string;
  players: OnlinePlayerView[];
  myHand: OnlineTile[];
  wallCount: number;
  discard: OnlineTile | null;
  turn: number;
  drewThisTurn: boolean;
  roundOver: OnlineRoundOver | null;
  log: string[];
  gosterge: OnlineTile;
  okeyNum: number;
  okeyColor: number;
  canFinish: boolean;
  settled: boolean;
}

/**
 * Gerçek zamanlı sohbet akışı (sunucu her ~2 sn'de yeni mesajları gönderir).
 * Bağlantı kurulamaz veya koparsa `onError` çağrılır — istemci pollinge düşer.
 * Dönen fonksiyon akışı kapatır.
 */
export function openChatStream(
  salon: string,
  after: number,
  onBatch: (messages: ApiChatMsg[]) => void,
  onError: () => void
): () => void {
  const token = getToken();
  if (!token) return () => {};
  const ctrl = new AbortController();
  (async () => {
    try {
      const res = await apiFetch(
        `/api/public/stream?salon=${encodeURIComponent(salon)}&token=${encodeURIComponent(token)}&after=${after}`,
        { signal: ctrl.signal }
      );
      if (!res.ok || !res.body) throw new Error("stream");
      const reader = res.body.getReader();
      const dec = new TextDecoder();
      let buf = "";
      for (;;) {
        const { done, value } = await reader.read();
        if (done || ctrl.signal.aborted) break;
        buf += dec.decode(value, { stream: true });
        let nl: number;
        while ((nl = buf.indexOf("\n")) >= 0) {
          const line = buf.slice(0, nl).trim();
          buf = buf.slice(nl + 1);
          if (!line || line.startsWith(":")) continue; // keep-alive satırları
          try {
            const data = JSON.parse(line) as { messages?: ApiChatMsg[] };
            if (Array.isArray(data.messages) && data.messages.length > 0) onBatch(data.messages);
          } catch {
            /* bozuk satır yok sayılır */
          }
        }
      }
      if (!ctrl.signal.aborted) onError(); // akış beklenmedik şekilde bitti
    } catch {
      if (!ctrl.signal.aborted) onError();
    }
  })();
  return () => ctrl.abort();
}

/** Sesli görüşme sinyal akışı — sunucu ~1 sn'de bir gelen çağrı/cevap sinyallerini gönderir */
export interface ApiVoiceSignal {
  id: number;
  from: string;
  kind: string; // call | answer | reject | busy | end
  payload: string;
}

export function openVoiceStream(
  onBatch: (signals: ApiVoiceSignal[]) => void,
  onError: () => void
): () => void {
  const token = getToken();
  if (!token) return () => {};
  const ctrl = new AbortController();
  (async () => {
    try {
      const res = await apiFetch(
        `/api/public/voice/stream?token=${encodeURIComponent(token)}`,
        { signal: ctrl.signal }
      );
      if (!res.ok || !res.body) throw new Error("voice-stream");
      const reader = res.body.getReader();
      const dec = new TextDecoder();
      let buf = "";
      for (;;) {
        const { done, value } = await reader.read();
        if (done || ctrl.signal.aborted) break;
        buf += dec.decode(value, { stream: true });
        let nl: number;
        while ((nl = buf.indexOf("\n")) >= 0) {
          const line = buf.slice(0, nl).trim();
          buf = buf.slice(nl + 1);
          if (!line || line.startsWith(":")) continue; // keep-alive
          try {
            const data = JSON.parse(line) as { signals?: ApiVoiceSignal[] };
            if (Array.isArray(data.signals) && data.signals.length > 0) onBatch(data.signals);
          } catch {
            /* bozuk satır yok sayılır */
          }
        }
      }
      if (!ctrl.signal.aborted) onError();
    } catch {
      if (!ctrl.signal.aborted) onError();
    }
  })();
  return () => ctrl.abort();
}

/** API kullanıcı nesnesini arayüz Profile tipine çevirir (mutedUntil: sn → ms) */
export function toProfile(u: ApiUser): Profile {
  return {
    id: String(u.id),
    nick: u.nick,
    rank: u.rank,
    gold: !!u.gold,
    chips: u.chips,
    mutedUntil: (u.mutedUntil || 0) * 1000,
    banned: !!u.banned,
    gender: u.gender === "k" ? "k" : "e",
    avatar: u.avatar || "",
    bio: u.bio || "",
    nickColor: u.nickColor || "",
    textColor: u.textColor || "",
  };
}
