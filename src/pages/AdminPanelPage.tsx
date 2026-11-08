import { useEffect, useState } from "react";
import { can, PERMS, RANKS, rankDef, rankLevel } from "../lib/ranks";
import { isSiteOwner, staffTier } from "../lib/kira";
import { useApp } from "../store/useApp";
import type { ModOp, Profile, RankId } from "../lib/types";
import { RankBadge } from "../components/RankBadge";
import { ChatPanel } from "../components/ChatPanel";
import { MemberContextMenu } from "../components/MemberContextMenu";
import type { MenuTarget } from "../components/MemberContextMenu";
import { ProfileModal } from "../components/ProfileModal";
import { isElectronWin } from "../store/useDesktop";
import { api, getToken } from "../lib/api";
import type { ApiModLog } from "../lib/api";

const OP_LABELS: { op: ModOp; label: string; perm: keyof typeof PERMS; danger?: boolean }[] = [
  { op: "mute", label: "Sustur", perm: "mute" },
  { op: "unmute", label: "Susturmayı Kaldır", perm: "mute" },
  { op: "goldOn", label: "Gold Ver", perm: "gold" },
  { op: "goldOff", label: "Gold Al", perm: "gold" },
  { op: "ban", label: "Banla", perm: "ban", danger: true },
  { op: "unban", label: "Banı Kaldır", perm: "ban" },
];

export function AdminPanelPage() {
  const me = useApp((s) => s.me);
  const showToast = useApp((s) => s.showToast);
  const go = useApp((s) => s.go);
  /** Electron'da profiller AYNI anda birden fazla ayrı pencerede açılabilir */
  const profilAc = (n: string) => {
    if (isElectronWin()) go({ name: "profil", nick: n });
    else setProfileNick(n);
  };
  const [dbMembers, setDbMembers] = useState<Profile[]>([]);
  const [dbLogs, setDbLogs] = useState<ApiModLog[]>([]);
  const [q, setQ] = useState("");
  const [menu, setMenu] = useState<MenuTarget | null>(null);
  const [profileNick, setProfileNick] = useState<string | null>(null);
  // Üye listesi sıralaması — başlığa tıklayınca değişir
  const [sortKey, setSortKey] = useState<"uye" | "kademe" | "durum" | "puan">("durum");
  const [sortDir, setSortDir] = useState<1 | -1>(-1);

  // Üyeleri ve işlem kaydını veritabanından periyodik çek
  const load = async () => {
    if (!getToken()) return;
    try {
      const [m, l] = await Promise.all([api.members(), api.modLogs()]);
      setDbMembers(
        m.members.map((u) => ({
          id: String(u.id),
          nick: u.nick,
          rank: u.rank,
          gold: !!u.gold,
          chips: u.chips,
          mutedUntil: (u.mutedUntil || 0) * 1000,
          banned: !!u.banned,
        }))
      );
      setDbLogs(l.logs.slice(-25).reverse());
    } catch {
      /* bağlantı/yetki hatası — sonraki denemede düzelir */
    }
  };

  useEffect(() => {
    void load();
    const t = window.setInterval(() => void load(), 10_000);
    return () => window.clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!me || !can(me.rank, "mute")) {
    return (
      <div className="felt-bg min-h-screen flex items-center justify-center p-4">
        <div className="bg-wood-950/90 border border-red-800 rounded-2xl p-8 max-w-md text-center">
          <h2 className="font-display text-2xl font-bold text-red-400 mb-2">Yetkiniz Yok</h2>
          <p className="text-sm text-ivory-dark/70">
            Yönetim panelini görmek için <b className="text-ivory">Site Yetkilisi</b> kademesinde
            olmanız gerekir. Mevcut kademeniz: <RankBadge rank={me?.rank ?? "deneme"} />
          </p>
        </div>
      </div>
    );
  }

  const toggleSort = (k: "uye" | "kademe" | "durum" | "puan") => {
    if (k === sortKey) setSortDir((d) => (d === 1 ? -1 : 1));
    else {
      setSortKey(k);
      setSortDir(k === "durum" || k === "puan" ? -1 : 1);
    }
  };

  const members = dbMembers
    .filter((p) => p.nick.toLowerCase().includes(q.toLowerCase()))
    .sort((a, b) => {
      // Site sahibi + site yetkilisi/koordinatör her sıralamada en üstte (kademe önceliği)
      const tierTop = staffTier(b.nick, b.rank) - staffTier(a.nick, a.rank);
      if (tierTop) return tierTop;
      let d = 0;
      if (sortKey === "uye") d = a.nick.localeCompare(b.nick, "tr");
      else if (sortKey === "kademe") d = rankLevel(a.rank) - rankLevel(b.rank) || a.nick.localeCompare(b.nick, "tr");
      else if (sortKey === "puan") d = (a.chips ?? 0) - (b.chips ?? 0) || a.nick.localeCompare(b.nick, "tr");
      else d = Number(a.banned) - Number(b.banned) || Number(a.mutedUntil > Date.now()) - Number(b.mutedUntil > Date.now()) || a.nick.localeCompare(b.nick, "tr");
      return d * sortDir;
    });

  const act = async (op: ModOp, target: Profile, value?: RankId) => {
    const action =
      op === "mute" || op === "unmute"
        ? op
        : op === "goldOn" || op === "goldOff"
          ? "gold"
          : op === "ban" || op === "unban"
            ? op
            : "rank";
    const v = op === "mute" ? 10 : op === "goldOn" ? 1 : op === "goldOff" ? 0 : value;
    try {
      await api.mod(action, target.nick, v);
      showToast(`${target.nick}: ${OP_LABELS.find((o) => o.op === op)?.label} işlemi uygulandı.`);
      void load(); // üye listesi ve kaydı hemen tazele
    } catch (e) {
      showToast(e instanceof Error ? e.message : "İşlem başarısız oldu.");
    }
  };

  return (
    <div className="felt-bg min-h-screen">
      <div className="max-w-5xl mx-auto px-4 py-4">
        <h2 className="font-display text-3xl font-bold text-gold-400 mb-1">Yönetim Paneli</h2>
        <p className="text-sm text-ivory-dark/60 mb-5">
          Kademeniz: <RankBadge rank={me.rank} gold={me.gold} /> —{" "}
          {rankDef(me.rank).desc}
        </p>

        {/* Kademe izin özeti */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-2 mb-6">
          {(
            [
              ["Yetkili", "Üye susturur", can(me.rank, "mute")],
              ["Koordinatör", "Gold verir / alır", can(me.rank, "gold")],
              ["Yönetici", "Yetki atar", can(me.rank, "rank")],
              ["Admin", "Üye banlar", can(me.rank, "ban")],
            ] as const
          ).map(([title, desc, ok]) => (
            <div
              key={title}
              className={`rounded-xl px-4 py-3 border text-sm ${
                ok ? "border-emerald-700 bg-emerald-900/20" : "border-wood-800 bg-wood-950/60 opacity-50"
              }`}
            >
              <p className="font-bold text-ivory">{title}</p>
              <p className="text-xs text-ivory-dark/60">{desc}</p>
              <p className={`text-xs font-bold mt-1 ${ok ? "text-emerald-400" : "text-red-400"}`}>
                {ok ? "✔ Yetkiniz var" : "✘ Yetkiniz yok"}
              </p>
            </div>
          ))}
        </div>

        <div className="flex flex-col lg:flex-row gap-6">
          {/* Üye listesi */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3 mb-3">
              <h3 className="font-bold text-ivory">Üye Listesi ({members.length})</h3>
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Üye ara..."
                className="ml-auto bg-wood-900 border border-wood-700 rounded-lg px-3 py-1.5 text-sm text-ivory placeholder:text-ivory-dark/30 focus:outline-none focus:border-gold-600 w-48"
              />
            </div>
            <div className="bg-wood-950/80 border border-wood-800 rounded-xl overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm min-w-[720px]">
                  <thead>
                    <tr className="bg-wood-900 text-ivory-dark/70 text-xs uppercase tracking-wider">
                      {(
                        [
                          ["uye", "Üye", "text-left"],
                          ["kademe", "Kademe", "text-left"],
                          ["durum", "Durum", "text-left"],
                          ["puan", "Çip", "text-right"],
                        ] as const
                      ).map(([k, label, align]) => (
                        <th
                          key={k}
                          className={`${align} px-3 py-2 cursor-pointer select-none hover:text-ivory ${sortKey === k ? "text-gold-400" : ""}`}
                          onClick={() => toggleSort(k)}
                          title="Sıralamak için tıkla"
                        >
                          {label}
                          {sortKey === k ? (sortDir === 1 ? " ▲" : " ▼") : ""}
                        </th>
                      ))}
                      <th className="text-right px-3 py-2">İşlemler</th>
                    </tr>
                  </thead>
                  <tbody>
                    {members.map((p) => (
                      <tr
                        key={p.id}
                        className={`border-t border-wood-800/70 ${p.banned ? "bg-red-950/30" : ""}`}
                        style={p.id !== me.id ? { cursor: "context-menu" } : undefined}
                        onContextMenu={(e) => {
                          if (p.id === me.id) return;
                          e.preventDefault();
                          setMenu({ nick: p.nick, x: e.clientX, y: e.clientY });
                        }}
                        title="Sağ tık: üye işlemleri"
                      >
                        <td className="px-3 py-2">
                          <span
                            className="font-semibold text-ivory cursor-pointer hover:text-gold-300"
                            onClick={() => profilAc(p.nick)}
                          >
                            {p.nick}
                          </span>
                          {p.gold && <span className="text-gold-400 ml-1" title="Gold Üye">★</span>}
                          {p.bot && <span className="text-[10px] text-ivory-dark/40 ml-1">bot</span>}
                        </td>
                        <td className="px-3 py-2">
                          {can(me.rank, "rank") && p.id !== me.id ? (
                            <select
                              value={p.rank}
                              onChange={(e) => act("rank", p, e.target.value as RankId)}
                              className="bg-wood-900 border border-wood-700 rounded px-2 py-1 text-xs text-ivory focus:outline-none focus:border-gold-600"
                              title="Yetki ata (kendi kademeniz altından)"
                            >
                              {RANKS.filter((r) => r.level < rankDef(me.rank).level).map((r) => (
                                <option key={r.id} value={r.id}>
                                  {r.label}
                                </option>
                              ))}
                            </select>
                          ) : (
                            <RankBadge rank={p.rank} />
                          )}
                        </td>
                        <td className="px-3 py-2 text-xs">
                          {p.banned ? (
                            <span className="text-red-400 font-bold">BANLI</span>
                          ) : p.mutedUntil > Date.now() ? (
                            <span className="text-orange-400">
                              Susturuldu ({Math.ceil((p.mutedUntil - Date.now()) / 60000)} dk)
                            </span>
                          ) : (
                            <span className="text-emerald-400">Aktif</span>
                          )}
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums text-gold-300/90">
                          {(p.chips ?? 0).toLocaleString("tr-TR")}
                        </td>
                        <td className="px-3 py-2">
                          <div className="flex justify-end gap-1.5 flex-wrap">
                            {OP_LABELS.filter((o) => can(me.rank, o.perm)).map((o) => {
                              const disabled =
                                p.id === me.id ||
                                (rankDef(p.rank).level >= rankDef(me.rank).level && o.op !== "goldOn");
                              return (
                                <button
                                  key={o.op}
                                  disabled={disabled}
                                  onClick={() => act(o.op, p)}
                                  title={disabled ? "Kendi üzerinizde veya eşit üst kademede işlem yapılamaz." : undefined}
                                  className={`px-2 py-1 rounded text-[11px] font-bold border transition-colors ${
                                    disabled
                                      ? "border-wood-800 text-ivory-dark/25 cursor-not-allowed"
                                      : o.danger
                                      ? "border-red-700 text-red-300 hover:bg-red-900/60"
                                      : "border-gold-700 text-gold-300 hover:bg-gold-700/30"
                                  }`}
                                >
                                  {o.label}
                                </button>
                              );
                            })}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* Sistem kaydı + yönetici sohbeti */}
          <div className="lg:w-80 shrink-0 space-y-6">
            <div>
              <h3 className="font-bold text-ivory mb-3">🔒 Yöneticiler Sohbeti</h3>
              <ChatPanel room="yoneticiler" />
            </div>
            <div>
              <h3 className="font-bold text-ivory mb-3">İşlem Kaydı</h3>
              <div className="bg-wood-950/80 border border-wood-800 rounded-xl p-3 space-y-1.5 text-xs h-[300px] overflow-y-auto">
              {dbLogs.length === 0 && (
                <p className="text-ivory-dark/40">Henüz işlem kaydı yok.</p>
              )}
              {dbLogs.map((m) => (
                <p key={m.id} className="text-gold-500/90">
                  <span className="text-ivory-dark/40">
                    {new Date(m.createdAt * 1000).toLocaleTimeString("tr-TR")}
                  </span>{" "}
                  <b>{m.actorNick}</b> → {m.targetNick}: {m.action}
                  {m.detail ? ` (${m.detail})` : ""}
                </p>
              ))}
            </div>
            <p className="text-[11px] text-ivory-dark/40 mt-2">
              Susturma 10 dakika sürer. Tüm işlemler veritabanına kaydedilir ve herkese anında yansır.
            </p>
            </div>
          </div>
        </div>

        <MemberContextMenu target={menu} onClose={() => setMenu(null)} onDone={() => void load()} onProfile={(n) => profilAc(n)} />
        <ProfileModal nick={profileNick} onClose={() => setProfileNick(null)} />
      </div>
    </div>
  );
}
