import { useApp } from "../store/useApp";
import { RankBadge } from "./RankBadge";
import { can } from "../lib/ranks";
import { nickTextColor } from "../lib/colors";
import { MessageInbox } from "./MessageInbox";
import { WinIcon } from "./desktop/WinIcon";

export function Header() {
  const me = useApp((s) => s.me);
  const go = useApp((s) => s.go);
  const logout = useApp((s) => s.logout);
  const route = useApp((s) => s.route);

  const navBtn = (label: string, active: boolean, onClick: () => void) => (
    <button
      key={label}
      onClick={onClick}
      className={`px-3 py-1.5 rounded-lg text-sm font-semibold transition-colors ${
        active ? "bg-gold-600 text-wood-950" : "text-ivory-dark hover:bg-wood-800 hover:text-ivory"
      }`}
    >
      {label}
    </button>
  );

  return (
    <header className="wood-bg border-b-2 border-gold-700/60 sticky top-0 z-40 shadow-pop">
      <div className="max-w-7xl mx-auto px-4 py-3 flex flex-wrap items-center gap-x-4 gap-y-2">
        <button onClick={() => go({ name: "lobi" })} className="flex items-baseline gap-2 group">
          <span className="font-display text-2xl font-bold text-gold-400 group-hover:text-gold-300 transition-colors">
            hasokey.com.tr
          </span>
          <span className="font-display text-lg text-ivory-dark/80">.store</span>
        </button>

        {me && (
          <nav className="flex items-center gap-1 ml-2">
            {navBtn("Salonlar", route.name === "lobi", () => go({ name: "lobi" }))}
            {navBtn("Kiralar", route.name === "kira", () => go({ name: "kira" }))}
            {navBtn("Yardım", route.name === "sohbet" && route.room === "yardim", () =>
              go({ name: "sohbet", room: "yardim" })
            )}
            {navBtn("Gold Üyelik", route.name === "gold", () => go({ name: "gold" }))}
            {navBtn("Oyunu İndir", route.name === "indir", () => go({ name: "indir" }))}
            {can(me.rank, "mute") &&
              navBtn(
                "Yöneticiler",
                route.name === "sohbet" && route.room === "yoneticiler",
                () => go({ name: "sohbet", room: "yoneticiler" })
              )}
            {can(me.rank, "mute") &&
              navBtn("Yönetim", route.name === "panel", () => go({ name: "panel" }))}
          </nav>
        )}

        <div className="ml-auto flex items-center gap-3">
          <button
            onClick={() => go({ name: "masaustu" })}
            className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-sky-900/70 hover:bg-sky-800 text-white border border-sky-600/60 transition-colors flex items-center gap-1.5"
            title="Windows masaüstü platformu"
          >
            <WinIcon name="monitor" size={15} />
            Masaüstü
          </button>
          {me ? (
            <>
              <MessageInbox />
              <div className="text-right leading-tight hidden sm:block">
                <div className="text-sm font-bold flex items-center gap-1.5 justify-end" style={{ color: nickTextColor({ nick: me.nick, rank: me.rank, custom: me.nickColor, dark: true }) ?? "#e7e0d5" }}>
                  {me.nick}
                  {me.gold && <span className="text-gold-400" title="Gold Üye — kazançta 2x çip">★</span>}
                </div>
                <div className="flex items-center gap-1.5 justify-end">
                  <RankBadge rank={me.rank} />
                  <span className="text-xs text-gold-400 font-semibold">
                    {me.chips.toLocaleString("tr-TR")} çip
                  </span>
                </div>
              </div>
              <button
                onClick={logout}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-wood-800 hover:bg-red-900/70 text-ivory-dark border border-wood-700 transition-colors"
              >
                Çıkış
              </button>
            </>
          ) : (
            <span className="text-xs text-ivory-dark/60">Giriş yapın</span>
          )}
        </div>
      </div>
    </header>
  );
}
