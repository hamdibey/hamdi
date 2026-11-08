import { useEffect, useState } from "react";
import { useApp } from "../store/useApp";
import { api } from "../lib/api";
import type { ApiRental } from "../lib/api";
import { FLOORS, SLOTS_PER_FLOOR, salonLabel, salonTitle } from "../lib/kira";

/**
 * Salon Kiraları — site sahibi (admin) her salonu bir üye adına açar.
 * Miktar gösterilmez; sadece sahip ataması ve paket işaretleri yapılır.
 */
export function KiraPage() {
  const me = useApp((s) => s.me);
  const showToast = useApp((s) => s.showToast);
  const go = useApp((s) => s.go);
  const isAdmin = me?.rank === "admin";

  const [rentals, setRentals] = useState<ApiRental[]>([]);
  const [loading, setLoading] = useState(true);
  const [sel, setSel] = useState<{ floor: number; slot: number } | null>(null);
  const [ownerNick, setOwnerNick] = useState("");
  const [salonAdi, setSalonAdi] = useState("");
  const [gold, setGold] = useState(true);
  const [pkgs, setPkgs] = useState<Record<string, boolean>>({});
  const [busy, setBusy] = useState(false);

  const load = async () => {
    try {
      const r = await api.salonRentals();
      setRentals(r.rentals);
    } catch {
      /* göz ardı */
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    void load();
  }, []);

  const rentalAt = (floor: number, slot: number) =>
    rentals.find((r) => r.floor === floor && r.slot === slot);

  const openSel = (floor: number, slot: number) => {
    if (!isAdmin) return;
    const r = rentalAt(floor, slot);
    setSel({ floor, slot });
    setOwnerNick(r?.ownerNick ?? "");
    setSalonAdi(r?.name ?? "");
    setGold(r ? !!r.gold : true);
    setPkgs(
      r
        ? {
            avatar: !!r.avatarPkg,
            diamond: !!r.diamondPkg,
            entry25: !!r.entry25Pkg,
            asAdmin: !!r.asAdminPkg,
            mgmt: !!r.mgmtPkg,
          }
        : {}
    );
  };

  const save = async () => {
    if (!sel || busy) return;
    setBusy(true);
    try {
      await api.salonRental({
        action: "rent",
        floor: sel.floor,
        slot: sel.slot,
        ownerNick,
        name: salonAdi,
        gold,
        packages: pkgs,
      });
      showToast(`${salonLabel(sel.floor, sel.slot)} → ${ownerNick} adına açıldı.`);
      setSel(null);
      void load();
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Kaydedilemedi.");
    }
    setBusy(false);
  };

  const remove = async () => {
    if (!sel || busy) return;
    setBusy(true);
    try {
      await api.salonRental({ action: "remove", floor: sel.floor, slot: sel.slot });
      showToast("Salon sahipsiz bırakıldı.");
      setSel(null);
      void load();
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Silinemedi.");
    }
    setBusy(false);
  };

  return (
    <div className="felt-bg min-h-screen">
      <div className="max-w-7xl mx-auto px-4 py-6">
        <h2 className="font-display text-3xl font-bold text-gold-400 mb-1">Salon Kiraları</h2>
        <p className="text-sm text-ivory-dark/70 mb-6">
          6 kat × 40 salon. Her salon bir üye adına (as admin) açılır; salon sahibi kendi ekibini
          kurar. {isAdmin ? "Bir salon seçerek sahip atayabilir, salon adını değiştirebilirsiniz." : "Yalnızca site sahibi atama yapabilir."}
        </p>

        {!isAdmin && (
          <p className="mb-4 text-xs text-ivory-dark/50 border border-wood-800 rounded-lg px-3 py-2 bg-wood-950/60 w-fit">
            ⚠️ Bu sayfada düzenleme yetkiniz yok — sadece görüntüleyebilirsiniz.
          </p>
        )}

        {/* Katlar */}
        <div className="space-y-6">
          {FLOORS.map((floor) => (
            <div key={floor} className="bg-wood-950/70 border border-wood-800 rounded-xl p-4">
              <p className="text-sm font-bold text-ivory mb-3">{floor}. Kat</p>
              {loading ? (
                <p className="text-ivory-dark/50 animate-pulse text-sm">Yükleniyor…</p>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5">
                  {Array.from({ length: SLOTS_PER_FLOOR }, (_, i) => i + 1).map((slot) => {
                    const r = rentalAt(floor, slot);
                    const selected = sel?.floor === floor && sel?.slot === slot;
                    return (
                      <button
                        key={slot}
                        onClick={() => openSel(floor, slot)}
                        title={r ? `${r.ownerNick} adına` : "Sahipsiz"}
                        disabled={!isAdmin}
                        className={`text-left rounded-xl border p-2.5 transition-colors ${
                          selected
                            ? "border-gold-400 bg-gold-600/20"
                            : r
                            ? "border-emerald-700 bg-emerald-900/30 hover:border-emerald-500"
                            : "border-wood-700 bg-wood-900/60 hover:border-gold-700"
                        } ${!isAdmin ? "opacity-80 cursor-default" : ""}`}
                      >
                        <p className="text-sm font-bold text-ivory truncate">
                          {r?.name && String(r.name).trim() ? String(r.name).trim() : `${slot}. Salon`}
                        </p>
                        <p className="text-[11px] truncate">
                          {r ? (
                            <span className="text-emerald-300">{r.ownerNick}</span>
                          ) : (
                            <span className="text-ivory-dark/40">boş</span>
                          )}
                        </p>
                        {r?.gold === 1 && (
                          <span className="text-[10px] text-gold-400">★ gold</span>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Admin sahip atama modalı */}
      {sel && isAdmin && (
        <div className="fixed inset-0 z-[95] bg-black/70 flex items-center justify-center p-4" onClick={() => setSel(null)}>
          <div
            className="bg-wood-950 border-2 border-gold-700 rounded-2xl w-full max-w-sm shadow-pop animate-floatUp p-5"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="font-display text-xl font-bold text-gold-300 mb-1">
              {salonTitle(sel.floor, sel.slot, salonAdi)}
            </h3>
            <p className="text-xs text-ivory-dark/60 mb-4">
              Salonu bir üye adına (as admin) açın. O üye salonu yönetir, kendi ekibini kurar.
            </p>

            <label className="block text-xs font-bold text-gold-500 mb-1">Salon Adı (site sahibi belirler)</label>
            <input
              value={salonAdi}
              onChange={(e) => setSalonAdi(e.target.value)}
              placeholder={`Boş bırakılırsa: ${sel.slot}. Salon`}
              maxLength={40}
              className="w-full bg-wood-900 border border-wood-700 rounded-lg px-3 py-2 text-sm text-ivory placeholder:text-ivory-dark/30 focus:outline-none focus:border-gold-600 mb-3"
            />

            <label className="block text-xs font-bold text-gold-500 mb-1">Salon Sahibi (nick)</label>
            <input
              value={ownerNick}
              onChange={(e) => setOwnerNick(e.target.value)}
              placeholder="Üye nick'i"
              className="w-full bg-wood-900 border border-wood-700 rounded-lg px-3 py-2 text-sm text-ivory placeholder:text-ivory-dark/30 focus:outline-none focus:border-gold-600 mb-3"
            />

            <label className="flex items-center gap-2 mb-3 cursor-pointer">
              <input type="checkbox" checked={gold} onChange={(e) => setGold(e.target.checked)} className="accent-gold-500 w-4 h-4" />
              <span className="text-sm text-ivory">Salon Gold</span>
            </label>

            <p className="text-xs font-bold text-gold-500 mb-1.5">Ek Paketler</p>
            <div className="space-y-1.5 mb-4">
              {(
                [
                  ["avatar", "Avatar Paketi"],
                  ["diamond", "Diamond Paketi"],
                  ["entry25", "+25 Giriş Paketi"],
                  ["asAdmin", "Ek As Admin"],
                  ["mgmt", "Ek Yönetim Paketi"],
                ] as const
              ).map(([k, label]) => (
                <label key={k} className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={!!pkgs[k]}
                    onChange={(e) => setPkgs({ ...pkgs, [k]: e.target.checked })}
                    className="accent-gold-500 w-4 h-4"
                  />
                  <span className="text-sm text-ivory">{label}</span>
                </label>
              ))}
            </div>

            <div className="flex gap-2">
              {rentalAt(sel.floor, sel.slot) && (
                <button
                  onClick={remove}
                  disabled={busy}
                  className="px-3 py-2 rounded-lg border border-red-700 text-red-300 hover:bg-red-900/60 text-sm font-bold disabled:opacity-60"
                >
                  Sahipsiz Bırak
                </button>
              )}
              <button
                onClick={() => setSel(null)}
                className="flex-1 py-2 rounded-lg bg-wood-900 border border-wood-700 text-ivory-dark text-sm font-semibold"
              >
                Kapat
              </button>
              <button
                onClick={save}
                disabled={busy || !ownerNick.trim()}
                className="flex-1 py-2 rounded-lg bg-gold-600 hover:bg-gold-500 disabled:opacity-60 text-wood-950 text-sm font-bold"
              >
                {busy ? "Kaydediliyor…" : "Kaydet"}
              </button>
            </div>

            <button
              onClick={() => {
                setSel(null);
                go({ name: "salonRoom", floor: sel.floor, slot: sel.slot });
              }}
              className="w-full mt-2 py-1.5 text-xs text-ivory-dark/60 hover:text-gold-400 transition-colors"
            >
              Salonu Aç →
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
