// ---------------------------------------------------------------------------
// Gerçek zamanlı "sunucu" katmanı.
// Sunucu modunda çalışır: tüm sekmeler tek bir sunucu durumunu paylaşır
// (BroadcastChannel + localStorage), çevrimiçi liste, sohbet, moderasyon
// (susturma / gold / yetki / ban) ve masa listesi anlık yayınlanır.
// Yabanıl kullanıcılar yerine bot üyeler de sunucu tarafından üretilir.
// ---------------------------------------------------------------------------
import type { ChatMsg, GameId, Profile, RankId, SunucuEvent, SunucuState, TableInfo } from "./types";

const CH_NAME = "hasokey.com.tr-sunucu";
const LS_KEY = "hasokey.com.tr-sunucu-state-v1";
const LS_SERVER = "hasokey.com.tr-sunucu-host-v1";
const MAX_CHAT = 300;

export const SALONS: { id: GameId; name: string; playable: boolean; note?: string }[] = [
  { id: "yuzbir", name: "101 Okey", playable: true },
  { id: "otuzdort", name: "34 Oyunu", playable: true },
  { id: "ellibir", name: "51 Oyunu", playable: true },
  { id: "okey", name: "Okey", playable: true },
  { id: "batak", name: "Batak", playable: true },
  { id: "domino", name: "Domino", playable: true },
];

export const YAKINDA = ["Pişti", "King", "Banko", "Aznif", "Okşin", "Kastet", "Yanık"];

const BOT_SEEDS: { nick: string; rank: RankId; gold: boolean }[] = [
  { nick: "Hakkari_Asr", rank: "admin", gold: true },
  { nick: "Zeynep_47", rank: "deneme", gold: false },
  { nick: "Kemal_Batak", rank: "gold", gold: true },
  { nick: "Serkan101", rank: "deneme", gold: false },
  { nick: "Ayse_Okey", rank: "gold", gold: true },
  { nick: "Baran_Kral", rank: "yetkili", gold: false },
  { nick: "Dilara_Hakkari", rank: "deneme", gold: false },
  { nick: "Mehmet_Koordinator", rank: "koordinator", gold: true },
  { nick: "Cansu_55", rank: "deneme", gold: false },
  { nick: "Emre_Yonetici", rank: "yonetici", gold: true },
  { nick: "Seyit_Pasa", rank: "gold", gold: true },
  { nick: "Nurcan_Hanim", rank: "deneme", gold: false },
  { nick: "Okey_Ustasi", rank: "gold", gold: true },
  { nick: "Ferhat_65", rank: "deneme", gold: false },
  { nick: "Meryem_Kar", rank: "deneme", gold: false },
  { nick: "Ahmet_Can", rank: "yetkili", gold: false },
  { nick: "Sare_Hakkari", rank: "deneme", gold: false },
  { nick: "Domino_King", rank: "gold", gold: true },
];

const CHAT_LINES = [
  "Kolay gelsin herkese :)",
  "101 var mı masada?",
  "Hayırlı oyunlar",
  "Okeyim geldi sonunda!",
  "Bu eli bitiriyorum bak :D",
  "Sürekli joker geliyor bana maşallah",
  "Kemiklik bereketli bugün",
  "Kim kilitlenir bakalım :)",
  "Hadi hayırlısı",
  "Yeni masaya geçiyorum",
  "Per per per :)",
  "Gösterge yine işime yaramadı",
  "Batak yakında gelsin artık",
  "Gold üyeler 2x çip unutmayın :)",
  "Efsane bir el oynadım az önce",
];

function randId(): string {
  return Math.random().toString(36).slice(2, 10);
}

function nowTs(): number {
  return Date.now();
}

function seedState(): SunucuState {
  const profiles: Record<string, Profile> = {};
  for (const s of BOT_SEEDS) {
    const id = `bot_${s.nick}`;
    profiles[id] = {
      id,
      nick: s.nick,
      rank: s.rank,
      gold: s.gold,
      chips: 1000 + Math.floor(Math.random() * 9000),
      mutedUntil: 0,
      banned: false,
      bot: true,
    };
  }
  const salonDensity: SunucuState["salonDensity"] = {
    yuzbir: [4, 3, 4, 2, 4, 1, 3, 4],
    okey: [3, 4, 2, 4, 3, 4, 2, 3],
    batak: [2, 1, 3, 0, 2, 1, 2, 3],
    domino: [4, 2, 3, 4, 1, 3, 2, 4],
    otuzdort: [3, 2, 4, 3, 2, 3, 4, 2],
    ellibir: [2, 3, 2, 4, 3, 2, 3, 4],
  };
  const chat: ChatMsg[] = [];
  const botIds = Object.keys(profiles);
  for (let i = 0; i < 14; i++) {
    const id = botIds[Math.floor(Math.random() * botIds.length)];
    const p = profiles[id];
    chat.push({
      id: randId(),
      nick: p.nick,
      rank: p.rank,
      gold: p.gold,
      text: CHAT_LINES[i % CHAT_LINES.length],
      ts: nowTs() - (14 - i) * 45_000,
      room: "lobi",
    });
  }
  const tables: Record<string, TableInfo> = {};
  for (const s of SALONS) {
    s; // salonlar ayrı tutuluyor
  }
  return { profiles, chat, tables, salonDensity };
}

type Listener = (s: SunucuState) => void;

class Sunucu {
  private state: SunucuState;
  private ch: BroadcastChannel | null = null;
  private listeners = new Set<Listener>();
  private botTimer: number | null = null;
  private densityTimer: number | null = null;
  private isServer = false;
  readonly clientId = randId();

  constructor() {
    this.state = this.load();
    this.bootstrap();
  }

  private load(): SunucuState {
    try {
      const raw = localStorage.getItem(LS_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as SunucuState & { hostTs?: number };
        // Sunucu 30 sn'den eskiyse (kapandıysa) yeniden tohumla
        if (parsed.hostTs && nowTs() - parsed.hostTs < 30_000) return parsed;
      }
    } catch {
      /* yok say */
    }
    return seedState();
  }

  private save() {
    try {
      localStorage.setItem(LS_KEY, JSON.stringify({ ...this.state, hostTs: nowTs() }));
    } catch {
      /* kota dolu olabilir */
    }
  }

  private bootstrap() {
    if (typeof BroadcastChannel === "undefined") {
      this.isServer = true;
      this.startServerLoops();
      return;
    }
    let host = "";
    try {
      host = localStorage.getItem(LS_SERVER) ?? "";
    } catch {
      /* yok */
    }
    if (!host) {
      host = this.clientId;
      try {
        localStorage.setItem(LS_SERVER, host);
      } catch {
        /* yok */
      }
    }
    this.isServer = host === this.clientId;

    this.ch = new BroadcastChannel(CH_NAME);
    this.ch.onmessage = (ev: MessageEvent) => {
      const data = ev.data as { kind: "event"; ev: SunucuEvent; from: string } | { kind: "state"; state: SunucuState; from: string };
      if (data.kind === "event") {
        if (this.isServer) {
          this.applyEvent(data.ev);
          this.broadcast();
        }
      } else if (data.kind === "state") {
        if (!this.isServer) {
          this.state = data.state;
          this.emit();
        }
      }
    };

    if (this.isServer) this.startServerLoops();
    else {
      // Sunucudan ilk durumu iste
      this.ch.postMessage({ kind: "event", ev: { type: "noop" }, from: this.clientId });
      this.reclaimCheck();
    }
  }

  /** Sunucu sekmesi kapandığında başka sekme sunuculuğu devralır */
  private reclaimCheck() {
    window.setInterval(() => {
      let hostTs = 0;
      try {
        const raw = localStorage.getItem(LS_KEY);
        if (raw) hostTs = (JSON.parse(raw) as { hostTs?: number }).hostTs ?? 0;
      } catch {
        /* yok */
      }
      if (nowTs() - hostTs > 8_000 && !this.isServer) {
        this.isServer = true;
        try {
          localStorage.setItem(LS_SERVER, this.clientId);
        } catch {
          /* yok */
        }
        this.startServerLoops();
      }
    }, 5_000);
  }

  private startServerLoops() {
    if (this.botTimer === null) {
      this.botTimer = window.setInterval(() => {
        const bots = Object.values(this.state.profiles).filter((p) => p.bot && !p.banned);
        const p = bots[Math.floor(Math.random() * bots.length)];
        if (!p) return;
        this.state.chat.push({
          id: randId(),
          nick: p.nick,
          rank: p.rank,
          gold: p.gold,
          text: CHAT_LINES[Math.floor(Math.random() * CHAT_LINES.length)],
          ts: nowTs(),
          room: "lobi",
        });
        if (this.state.chat.length > MAX_CHAT) this.state.chat.splice(0, this.state.chat.length - MAX_CHAT);
        this.save();
        this.broadcast();
      }, 9_000);
    }
    if (this.densityTimer === null) {
      this.densityTimer = window.setInterval(() => {
        for (const k of Object.keys(this.state.salonDensity) as GameId[]) {
          const arr = this.state.salonDensity[k];
          for (let i = 0; i < arr.length; i++) {
            if (Math.random() < 0.3) {
              arr[i] = Math.max(0, Math.min(4, arr[i] + (Math.random() < 0.5 ? 1 : -1)));
            }
          }
        }
        this.save();
        this.broadcast();
      }, 7_000);
    }
    // İlk yayını yap
    this.save();
    this.broadcast();
  }

  private applyEvent(ev: SunucuEvent) {
    switch (ev.type) {
      case "chat": {
        const prof = this.myProfileFromNick(ev.nick);
        if (prof?.banned) return;
        if (prof && prof.mutedUntil > nowTs()) {
          this.state.chat.push({
            id: randId(),
            nick: "Sunucu",
            rank: "admin",
            gold: true,
            text: `${prof.nick} susturulduğu için yazamıyor.`,
            ts: nowTs(),
            room: ev.room,
            system: true,
          });
          return;
        }
        this.state.chat.push({
          id: randId(),
          nick: ev.nick,
          rank: prof?.rank ?? "deneme",
          gold: prof?.gold ?? false,
          text: ev.text,
          ts: nowTs(),
          room: ev.room,
        });
        if (this.state.chat.length > MAX_CHAT) this.state.chat.splice(0, this.state.chat.length - MAX_CHAT);
        break;
      }
      case "tableCreate": {
        const existing = Object.values(this.state.tables).filter((t) => t.game === ev.game).length;
        if (existing >= 8) return;
        const id = `${ev.game}_${ev.owner}_${nowTs()}`;
        this.state.tables[id] = {
          id,
          game: ev.game,
          owner: ev.owner,
          seats: 1 + Math.floor(Math.random() * 3),
          ts: nowTs(),
        };
        this.state.chat.push({
          id: randId(),
          nick: "Sunucu",
          rank: "admin",
          gold: true,
          text: `${ev.owner} ${SALONS.find((s) => s.id === ev.game)?.name} salonunda masa kurdu.`,
          ts: nowTs(),
          room: `salon:${ev.game}`,
          system: true,
        });
        break;
      }
      case "tableLeave": {
        for (const [k, t] of Object.entries(this.state.tables)) {
          if (t.owner === ev.owner && t.game === ev.game) delete this.state.tables[k];
        }
        break;
      }
      case "chips": {
        const p = this.state.profiles[ev.userId];
        if (!p) return;
        // Gold üye kazancı 2x
        const gain = p.gold ? ev.delta * 2 : ev.delta;
        p.chips = Math.max(0, p.chips + gain);
        break;
      }
      case "selfGold": {
        const p = this.myProfileFromNick(ev.nick);
        if (p) {
          p.gold = true;
          if (p.rank === "deneme") p.rank = "gold";
        }
        break;
      }
      case "mod": {
        const target = this.state.profiles[ev.targetId];
        if (!target) return;
        switch (ev.op) {
          case "mute":
            target.mutedUntil = nowTs() + 10 * 60_000; // 10 dakika
            this.sysMsg(`${target.nick} 10 dakika susturuldu. (Yetkili: ${ev.by})`, ev);
            break;
          case "unmute":
            target.mutedUntil = 0;
            this.sysMsg(`${target.nick} susturması kaldırıldı. (Yetkili: ${ev.by})`, ev);
            break;
          case "goldOn":
            target.gold = true;
            this.sysMsg(`${target.nick} üyesine gold üyelik verildi. (Yetkili: ${ev.by})`, ev);
            break;
          case "goldOff":
            target.gold = false;
            this.sysMsg(`${target.nick} üyesinin gold üyeliği alındı. (Yetkili: ${ev.by})`, ev);
            break;
          case "rank":
            if (ev.value) {
              target.rank = ev.value;
              if (ev.value === "gold") target.gold = true;
              this.sysMsg(`${target.nick} üyesinin yetkisi "${ev.value}" olarak atandı. (Yetkili: ${ev.by})`, ev);
            }
            break;
          case "ban":
            target.banned = true;
            this.sysMsg(`${target.nick} üyesi banlandı! (Admin: ${ev.by})`, ev);
            break;
          case "unban":
            target.banned = false;
            this.sysMsg(`${target.nick} üyesinin banı kaldırıldı. (Admin: ${ev.by})`, ev);
            break;
        }
        break;
      }
      case "noop":
        return;
    }
    this.save();
  }

  private sysMsg(text: string, ev: Extract<SunucuEvent, { type: "mod" }>) {
    this.state.chat.push({
      id: randId(),
      nick: "Sunucu",
      rank: "admin",
      gold: true,
      text,
      ts: nowTs(),
      room: "lobi",
      system: true,
    });
    ev;
  }

  private myProfileFromNick(nick: string): Profile | undefined {
    return Object.values(this.state.profiles).find((p) => p.nick.toLowerCase() === nick.toLowerCase());
  }

  private broadcast() {
    if (this.ch) this.ch.postMessage({ kind: "state", state: this.state, from: this.clientId });
    this.emit();
  }

  private emit() {
    for (const l of this.listeners) l(this.state);
  }

  // ---- Genel API ---------------------------------------------------------

  subscribe(l: Listener): () => void {
    this.listeners.add(l);
    l(this.state);
    return () => this.listeners.delete(l);
  }

  getState(): SunucuState {
    return this.state;
  }

  send(ev: SunucuEvent) {
    if (this.isServer) {
      this.applyEvent(ev);
      this.broadcast();
    } else if (this.ch) {
      this.ch.postMessage({ kind: "event", ev, from: this.clientId });
    }
  }

  /** Giriş: üye yoksa Deneme Üye olarak kaydeder, banlıysa reddeder */
  login(nick: string): { ok: boolean; reason?: string; profile: Profile } {
    const existing = this.myProfileFromNick(nick);
    if (existing?.banned) {
      return { ok: false, reason: "Bu nick banlanmış durumda. Giriş yapamazsınız.", profile: existing };
    }
    if (existing) {
      this.save();
      this.broadcast();
      return { ok: true, profile: existing };
    }
    const profile: Profile = {
      id: `u_${randId()}`,
      nick,
      rank: "deneme",
      gold: false,
      chips: 500,
      mutedUntil: 0,
      banned: false,
    };
    this.state.profiles[profile.id] = profile;
    this.state.chat.push({
      id: randId(),
      nick: "Sunucu",
      rank: "admin",
      gold: true,
      text: `${nick} siteye giriş yaptı. Hoş geldin! (Normal Üye olarak kayıtlı)`,
      ts: nowTs(),
      room: "lobi",
      system: true,
    });
    this.save();
    this.broadcast();
    return { ok: true, profile };
  }

  /** Profil güncelle (oyun çipi vb.) — sunucu üzerinden yansıtılır */
  updateProfile(id: string, patch: Partial<Profile>) {
    const p = this.state.profiles[id];
    if (!p) return;
    Object.assign(p, patch);
    this.save();
    this.broadcast();
  }

  /** Çevrimiçi liste: banlı olmayan tüm üyeler + bu sekmedeki misafir */
  onlineList(): Profile[] {
    return Object.values(this.state.profiles).filter((p) => !p.banned);
  }

  isMuted(profile: Profile): boolean {
    return profile.mutedUntil > nowTs();
  }
}

export const sunucu = new Sunucu();
