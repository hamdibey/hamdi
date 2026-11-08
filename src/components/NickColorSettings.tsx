import { useState } from "react";
import { useApp } from "../store/useApp";
import { api } from "../lib/api";
import { NICK_PALETTE, isBlueishHex, isStaffNick } from "../lib/colors";

/**
 * Üyenin nick / yazı rengi ayarı — lobi sol sütununda durur.
 * Paletten veya serbest renk seçiciden renk seçilir; mavi tonları
 * yalnızca yöneticilere açık olduğundan üyeye uygulanamaz.
 */
export function NickColorSettings() {
  const me = useApp((s) => s.me);
  const syncMe = useApp((s) => s.syncMe);
  const showToast = useApp((s) => s.showToast);
  const [busy, setBusy] = useState(false);

  if (!me) return null;

  const current = me.nickColor && /^#[0-9a-fA-F]{6}$/.test(me.nickColor) ? me.nickColor : "";
  const staff = isStaffNick(me.nick, me.rank);

  const save = async (color: string) => {
    if (busy) return;
    setBusy(true);
    try {
      await api.updateProfile({ nickColor: color });
      await syncMe();
      showToast(color ? "Nick renginiz kaydedildi." : "Varsayılan renge dönüldü.");
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Renk kaydedilemedi.");
    }
    setBusy(false);
  };

  return (
    <div className="bg-wood-950/70 border border-wood-800 rounded-xl p-4">
      <p className="text-xs font-bold text-gold-500 uppercase tracking-wider mb-1">⚙️ Ayarlar</p>
      <p className="text-[11px] text-ivory-dark/60 mb-3">
        {staff
          ? "Yöneticilerin nick rengi her yerde mavidir."
          : "Sohbette görünmek istediğiniz nick rengini seçin."}
      </p>

      <div className="flex flex-wrap gap-1.5 mb-3">
        {NICK_PALETTE.map((p) => (
          <button
            key={p.color}
            disabled={staff || busy}
            onClick={() => void save(p.color)}
            title={p.label}
            className={`w-7 h-7 rounded-full border-2 transition-transform hover:scale-110 disabled:hover:scale-100 disabled:opacity-50 ${
              current.toLowerCase() === p.color ? "border-gold-400" : "border-wood-700"
            }`}
            style={{ backgroundColor: p.color }}
          />
        ))}
      </div>

      <div className="flex items-center gap-2 mb-2">
        <input
          type="color"
          disabled={staff || busy}
          className="w-8 h-8 rounded bg-wood-900 border border-wood-700 cursor-pointer disabled:opacity-50"
          onChange={(e) => {
            const v = e.target.value;
            if (isBlueishHex(v) && !staff) {
              showToast("Mavi renk yalnızca yönetcilere ayrılmıştır.");
              return;
            }
            void save(v.toLowerCase());
          }}
        />
        <span className="text-[11px] text-ivory-dark/50">veya kendi renginizi seçin</span>
      </div>

      {current && !staff && (
        <button
          disabled={busy}
          onClick={() => void save("")}
          className="w-full mt-1 py-1.5 rounded-lg bg-wood-900 hover:bg-wood-800 border border-wood-700 text-ivory-dark text-[11px] font-semibold"
        >
          Varsayılan renge dön
        </button>
      )}

      <div className="mt-3 pt-3 border-t border-wood-800">
        <p className="text-[10px] text-ivory-dark/40 mb-1">Önizleme</p>
        <p className="text-sm font-bold" style={{ color: staff ? "#60a5fa" : current || "#e7e0d5" }}>
          {me.nick}: merhaba, nasılsın?
        </p>
      </div>
    </div>
  );
}
