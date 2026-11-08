import { useEffect, useState } from "react";
import { can, RANKS, rankDef } from "../lib/ranks";
import { isSiteOwner } from "../lib/kira";
import { klasikPrompt } from "../lib/klasikDialog";
import { useApp } from "../store/useApp";
import { api } from "../lib/api";
import type { ApiMemberInfo } from "../lib/api";
import { MemberMap } from "./MemberMap";
import type { ModOp, RankId } from "../lib/types";

export interface MenuTarget {
  nick: string;
  x: number;
  y: number;
}

/**
 * Üye nicksine sağ tıklandığında açılan yönetim menüsü.
 * Menüdeki işlemler kullanıcının kademesine göre filtrelenir
 * (sustur: yetkili+, gold: koordinatörü+, yetki: yönetici+, ban: admin).
 */
export function MemberContextMenu({
  target,
  onClose,
  onDone,
  onProfile,
  salonPower,
  salon,
  targetBlocked,
  targetStaffRole,
  onOpenYonetim,
  canStaffAssign,
}: {
  target: MenuTarget | null;
  onClose: () => void;
  onDone?: () => void;
  onProfile?: (nick: string) => void;
  /** Salon yetkisi: "full" = as admin/salon admini/süper op (tüm işlemler), "mute" = yönetici (susturma) */
  salonPower?: "full" | "mute";
  /** Yetki dayanağı olan salon anahtarı (örn: "1_3") — işleme backend'de salon yetkisi olarak geçer */
  salon?: string;
  /** Hedef üye bu salonda mesaj engelli mi? (Engel/Kaldır butonu metni için) */
  targetBlocked?: boolean;
  /** Hedefin bu salondaki rolleri (admin/superop/yonetici) — ekle/kaldır menüsü için */
  targetStaffRole?: string | null;
  /** Yönetim panelini aç (salon sahibi sağ tık menüsünden) */
  onOpenYonetim?: () => void;
  /** Salon ekibi atama yetkisi (salon sahibi — SalonRoomPage'den geçilir) */
  canStaffAssign?: boolean;
}) {
  const me = useApp((s) => s.me);
  const showToast = useApp((s) => s.showToast);
  const go = useApp((s) => s.go);
  const openPm = useApp((s) => s.openPm);
  const [info, setInfo] = useState<ApiMemberInfo | null>(null);
  const [infoOpen, setInfoOpen] = useState(false);
  const webMaster = !!me && isSiteOwner(me.nick);

  useEffect(() => {
    if (!target) return;
    const close = () => onClose();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    window.addEventListener("click", close);
    window.addEventListener("scroll", close, true);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("click", close);
      window.removeEventListener("scroll", close, true);
      window.removeEventListener("keydown", onKey);
    };
  }, [target, onClose]);

  // Sağ tık menüsü artık her üyeye açıktır (profil + özel mesaj); işlem
  // maddeleri kademe/rol filtresiyle yine yalnızca yetkililere görünür.
  if (!target || !me || target.nick === me.nick) return null;

  // Site sahibi üzerinde kimse işlem yapamaz — menüde yalnızca profili görüntüle
  const targetIsOwner = isSiteOwner(target.nick);

  const act = async (op: ModOp, value?: string | number) => {
    const action =
      op === "mute" || op === "unmute"
        ? op
        : op === "goldOn" || op === "goldOff"
          ? "gold"
          : op;
    const v = op === "mute" ? 10 : op === "goldOn" ? 1 : op === "goldOff" ? 0 : value;
    try {
      await api.mod(action, target.nick, v, salon);
      showToast(`${target.nick} üzerinde işlem uygulandı.`);
      onDone?.();
    } catch (e) {
      showToast(e instanceof Error ? e.message : "İşlem başarısız oldu.");
    }
    onClose();
  };

  // Salon ekibi atama/kaldırma — salon sahibi (canStaffAssign) + site admin (backend ayrıca doğrular)
  const canAssignStaff = !!salon && !targetIsOwner && (canStaffAssign || me.rank === "admin" || isSiteOwner(me.nick));
  const staffAct = async (action: "add" | "remove", role: "admin" | "superop" | "yonetici") => {
    if (!salon) return;
    try {
      await api.salonStaffSet({ salon, action, nick: target.nick, role });
      const rl = role === "admin" ? "Salon Admin" : role === "superop" ? "Süper Op" : "Yönetici";
      showToast(action === "add" ? `${target.nick} ${rl} yapıldı.` : `${target.nick} görevden alındı.`);
      onDone?.();
    } catch (e) {
      showToast(e instanceof Error ? e.message : "İşlem başarısız oldu.");
    }
    onClose();
  };

  // Web master: kredi / puan ver-al
  // NOT: Electron'da window.prompt ÇALIŞMAZ (sessizce null döner) — klasik pencere kullanılır
  const moneyAct = async (action: "credit" | "points") => {
    const raw = await klasikPrompt(
      action === "credit"
        ? `${target.nick} üyesine KREDİ ver/al (örn: 1000 veya -500):`
        : `${target.nick} üyesine PUAN ver/al (örn: 50 veya -50):`,
      action === "credit" ? "1000" : "50"
    );
    if (raw == null) return;
    const amt = Math.trunc(Number(raw));
    if (!Number.isFinite(amt) || amt === 0) {
      showToast("Geçerli bir sayı girin.");
      return;
    }
    try {
      await api.mod(action, target.nick, amt);
      showToast(`${target.nick}: ${amt > 0 ? "+" : ""}${amt} ${action === "credit" ? "kredi" : "puan"} uygulandı.`);
      onDone?.();
    } catch (e) {
      showToast(e instanceof Error ? e.message : "İşlem başarısız oldu.");
    }
    onClose();
  };

  // Web master: üye bilgisi (ilden girdi + açık adres)
  const showInfo = async () => {
    try {
      const r = await api.memberInfo(target.nick);
      setInfo(r.member);
      setInfoOpen(true);
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Bilgi alınamadı.");
    }
  };

  const items: { op: ModOp; label: string; perm: "mute" | "gold" | "ban"; danger?: boolean }[] = [
    { op: "mute", label: "Sustur (10 dk)", perm: "mute" },
    { op: "unmute", label: "Susturmayı Kaldır", perm: "mute" },
    { op: "goldOn", label: "Gold Ver", perm: "gold" },
    { op: "goldOff", label: "Gold Al", perm: "gold" },
    { op: "ban", label: "Banla", perm: "ban", danger: true },
    { op: "unban", label: "Banı Kaldır", perm: "ban" },
  ];
  const visible = targetIsOwner
    ? []
    : salonPower === "full"
      ? items
      : salonPower === "mute"
        ? items.filter((i) => i.op === "mute" || i.op === "unmute" || can(me.rank, i.perm))
        : items.filter((i) => can(me.rank, i.perm));
  // Kademe verme: salon tam yetkiliye en fazla Normal Üye / Gold — site kademesi (yetkili+)
  // yalnız site yöneticileri (yonetici+) tarafından verilebilir
  const rankSel = !targetIsOwner && can(me.rank, "rank");
  const rankCap = rankDef(me.rank).level;

  const left = Math.max(4, Math.min(target.x, window.innerWidth - 236));
  const top = Math.max(4, Math.min(target.y, window.innerHeight - 380));

  return (
    <div
      className="fixed z-[100] w-56 max-h-[86vh] overflow-y-auto bg-wood-950 border-2 border-gold-700 rounded-xl shadow-pop animate-floatUp"
      style={{ left, top }}
      onClick={(e) => e.stopPropagation()}
      onContextMenu={(e) => e.preventDefault()}
    >
      <div className="px-3 py-2 bg-wood-900 border-b border-wood-800">
        <p className="font-bold text-gold-400 text-sm truncate">{target.nick}</p>
        <p className="text-[10px] text-ivory-dark/50">
          {targetIsOwner
            ? "Site sahibi — korumalı, işlem yapılamaz"
            : salonPower === "full"
            ? "Salon yetkilisi — tüm işlemler"
            : salonPower
            ? "Salon yöneticisi"
            : "Sağ tık menüsü — işlem seçin"}
        </p>
      </div>
      <div className="p-1.5 space-y-0.5">
        <button
          onClick={() => {
            onProfile?.(target.nick);
            onClose();
          }}
          className="w-full text-left px-2.5 py-1.5 rounded-lg text-xs font-semibold text-ivory hover:bg-wood-800 transition-colors"
        >
          👤 Profili Görüntüle
        </button>
        <button
          onClick={() => {
            openPm(target.nick);
            onClose();
          }}
          className="w-full text-left px-2.5 py-1.5 rounded-lg text-xs font-semibold text-ivory hover:bg-wood-800 transition-colors"
        >
          💬 Özel Mesaj
        </button>
        {/* Web Master yetkileri — tümü burada */}
        {webMaster && !targetIsOwner && (
          <div className="px-2.5 pt-1.5 pb-1 border-t border-wood-800 mt-1">
            <p className="text-[10px] text-ivory-dark/50 mb-1">👑 Site Sahibi — Tam Yetki</p>
            <div className="flex flex-col gap-0.5">
              <button
                onClick={() => { void showInfo(); }}
                className="w-full text-left px-2 py-1 rounded-lg text-xs font-semibold text-sky-300 hover:bg-wood-800 transition-colors"
              >
                📍 Üye Bilgisi (girdiği il + açık adres)
              </button>
              <button
                onClick={() => void moneyAct("credit")}
                className="w-full text-left px-2 py-1 rounded-lg text-xs font-semibold text-gold-300 hover:bg-wood-800 transition-colors"
              >
                💳 Kredi Ver / Al
                <span className="block text-[9px] font-normal text-wood-400">masa kurmada harcanır</span>
              </button>
              <button
                onClick={() => void moneyAct("points")}
                className="w-full text-left px-2 py-1 rounded-lg text-xs font-semibold text-gold-300 hover:bg-wood-800 transition-colors"
              >
                ⭐ Puan Ver / Al
                <span className="block text-[9px] font-normal text-wood-400">çip bakiyesi</span>
              </button>
            </div>
          </div>
        )}
        {me.rank === "admin" && (
          <button
            onClick={() => {
              go({ name: "kira" });
              onClose();
            }}
            className="w-full text-left px-2.5 py-1.5 rounded-lg text-xs font-semibold text-gold-300 hover:bg-wood-800 transition-colors"
          >
            🏠 Salon Kiralama…
          </button>
        )}
        {salon && !targetIsOwner && (salonPower || can(me.rank, "mute")) && (
          <button
            onClick={() => act((targetBlocked ? "unblock" : "block") as ModOp)}
            className={`w-full text-left px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
              targetBlocked
                ? "text-emerald-300 hover:bg-emerald-900/50"
                : "text-orange-300 hover:bg-orange-900/50"
            }`}
          >
            {targetBlocked ? "✅ Mesaj Engelini Kaldır" : "🚫 Mesaj Engelle (salon)"}
          </button>
        )}
        {salon && salonPower && !targetIsOwner && (
          <button
            onClick={() => act("kick" as ModOp)}
            className="w-full text-left px-2.5 py-1.5 rounded-lg text-xs font-semibold text-orange-300 hover:bg-orange-900/50 transition-colors"
          >
            👢 Salondan At
          </button>
        )}
        {/* Salon ekibi atama — salon sahibi + site admin (backend de doğrular) */}
        {salon && !targetIsOwner && canAssignStaff && (
          <div className="px-2.5 pt-1.5 pb-1 border-t border-wood-800 mt-1">
            <p className="text-[10px] text-ivory-dark/50 mb-1">⭐ Salon Ekibi</p>
            <div className="flex flex-col gap-0.5">
              {targetStaffRole ? (
                <button
                  onClick={() => void staffAct("remove", (targetStaffRole as "admin" | "superop" | "yonetici"))}
                  className="w-full text-left px-2 py-1 rounded-lg text-xs font-semibold text-red-300 hover:bg-red-900/50 transition-colors"
                >
                  ✖ Görevden Al ({targetStaffRole === "admin" ? "Salon Admin" : targetStaffRole === "superop" ? "Süper Op" : "Yönetici"})
                </button>
              ) : (
                ([
                  ["admin", "🔴 Salon Admin Yap"],
                  ["superop", "🟣 Süper Op Yap"],
                  ["yonetici", "🟡 Yönetici Yap"],
                ] as const).map(([role, label]) => (
                  <button
                    key={role}
                    onClick={() => void staffAct("add", role)}
                    className="w-full text-left px-2 py-1 rounded-lg text-xs font-semibold text-ivory hover:bg-wood-800 transition-colors"
                  >
                    {label}
                  </button>
                ))
              )}
            </div>
          </div>
        )}
        {/* Yönetim panelini aç — salon sahibi / site yetkilisi */}
        {salon && salonPower && onOpenYonetim && (
          <button
            onClick={() => {
              onOpenYonetim();
              onClose();
            }}
            className="w-full text-left px-2.5 py-1.5 rounded-lg text-xs font-semibold text-sky-300 hover:bg-sky-900/50 transition-colors"
          >
            🛡️ Yönetim Panelini Aç
          </button>
        )}
        {visible.map((i) => (
          <button
            key={i.op}
            onClick={() => act(i.op)}
            className={`w-full text-left px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
              i.danger
                ? "text-red-300 hover:bg-red-900/60"
                : "text-ivory hover:bg-wood-800"
            }`}
          >
            {i.label}
          </button>
        ))}
        {rankSel && (
          <div className="px-2.5 pt-1.5 pb-1 border-t border-wood-800 mt-1">
            <p className="text-[10px] text-ivory-dark/50 mb-1">Yetki Ver</p>
            <select
              value=""
              onChange={(e) => e.target.value && act("rank" as ModOp, e.target.value as RankId)}
              className="w-full bg-wood-900 border border-wood-700 rounded px-2 py-1 text-xs text-ivory focus:outline-none focus:border-gold-600"
            >
              <option value="">Seçin…</option>
              {RANKS.filter((r) => r.level < rankCap).map((r) => (
                <option key={r.id} value={r.id}>
                  {r.label}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Web Master üye bilgi penceresi (ilden girdi + açık adres) */}
      {infoOpen && info && (
        <div
          className="fixed inset-0 z-[110] bg-black/40 flex items-center justify-center p-3"
          onClick={() => setInfoOpen(false)}
        >
          <div
            className="bg-wood-950 border-2 border-gold-700 rounded-xl shadow-pop w-full max-w-sm overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-3 py-2 bg-wood-900 border-b border-wood-800">
              <span className="font-bold text-gold-400 text-sm">Üye Bilgisi — {info.nick}</span>
              <button onClick={() => setInfoOpen(false)} className="text-ivory-dark hover:text-ivory px-1.5">×</button>
            </div>
            <div className="p-3 text-xs text-ivory space-y-1">
              <InfoRow k="Girdiği İl / Konum" v={info.loginWhere} />
              <InfoRow k="Açık Adres (IP)" v={info.openAddress} />
              <div className="pt-1">
                <p className="text-[10px] font-bold text-ivory-dark/70 mb-1">📍 Giriş Haritası</p>
                <MemberMap lat={info.lat} lng={info.lng} where={info.loginWhere} />
              </div>
              <InfoRow k="Kayıt İl / Ülke" v={[info.city, info.country].filter(Boolean).join(" / ") || "—"} />
              <InfoRow k="E-posta" v={info.email || "—"} />
              <InfoRow k="Kademe" v={info.rank} />
              <InfoRow k="Kredi" v={String(info.points ?? 0)} />
              <InfoRow k="Puan (çip)" v={String(info.chips)} />
              <InfoRow k="Son Giriş" v={info.loginAt ? new Date(info.loginAt * 1000).toLocaleString("tr-TR") : "—"} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function InfoRow({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between gap-2 border-b border-wood-800 pb-0.5">
      <span className="font-bold text-ivory-dark/70">{k}</span>
      <span className="text-right text-gold-200">{v}</span>
    </div>
  );
}
