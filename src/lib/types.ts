// ---------------------------------------------------------------------------
// Genel tipler: yetki kademesi, salonlar, üyeler, sohbet, masalar
// ---------------------------------------------------------------------------

export type RankId =
  | "deneme"
  | "gold"
  | "yetkili"
  | "koordinator"
  | "denetmen"
  | "yonetici"
  | "admin";

export type GameId = "yuzbir" | "okey" | "batak" | "domino" | "otuzdort" | "ellibir";

export interface ChatMsg {
  id: string;
  nick: string;
  rank: RankId;
  gold: boolean;
  text: string;
  ts: number;
  room: string; // "lobi" | "salon:yuzbir" ...
  system?: boolean;
  nickColor?: string; // gönderenin seçtiği nick rengi ("" = varsayılan)
  textColor?: string; // gönderenin seçtiği yazı (mesaj) rengi
}

export interface Profile {
  id: string;
  nick: string;
  rank: RankId;
  gold: boolean;
  chips: number;
  points?: number; // KREDİ (harcanabilir birim — masa kurma vb.)
  credits?: number; // API döngünde kredi (points ile aynı değer)
  mutedUntil: number; // epoch ms, 0 = susturulmamış
  banned: boolean;
  gender?: "e" | "k";
  avatar?: string; // "emoji:🦊" veya görsel URL
  bio?: string;
  nickColor?: string; // üyenin seçtiği nick rengi ("#rrggbb"; boş = varsayılan)
  textColor?: string; // üyenin seçtiği yazı (mesaj) rengi
  bot?: boolean;
}

export interface TableInfo {
  id: string;
  game: GameId;
  owner: string;
  seats: number; // dolu koltuk (botlar dahil)
  ts: number;
}

export interface SunucuState {
  profiles: Record<string, Profile>;
  chat: ChatMsg[];
  tables: Record<string, TableInfo>;
  salonDensity: Record<GameId, number[]>; // her salonda 8 masanın doluluk oranı
}

export type ModOp =
  | "mute"
  | "unmute"
  | "goldOn"
  | "goldOff"
  | "rank"
  | "ban"
  | "unban"
  | "kick";

export type SunucuEvent =
  | { type: "chat"; nick: string; text: string; room: string }
  | { type: "tableCreate"; game: GameId; owner: string }
  | { type: "tableLeave"; game: GameId; owner: string }
  | { type: "chips"; userId: string; delta: number }
  | {
      type: "mod";
      op: ModOp;
      targetId: string;
      value?: RankId;
      by: string;
    }
  | { type: "selfGold"; nick: string }
  | { type: "noop" };

export interface ClientPing {
  id: string;
  nick: string | null;
  rank: RankId;
  gold: boolean;
  ts: number;
}
