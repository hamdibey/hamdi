import { useState } from "react";
import { useApp } from "../store/useApp";
import { RANKS } from "../lib/ranks";
import { RankBadge } from "../components/RankBadge";
import { api } from "../lib/api";

const GOLD_PRICE = 1000;

export function GoldPage() {
  const me = useApp((s) => s.me);
  const showToast = useApp((s) => s.showToast);
  const syncMe = useApp((s) => s.syncMe);
  const [busy, setBusy] = useState(false);

  const buyGold = async () => {
    if (!me || busy) return;
    if (me.gold) {
      showToast("Zaten gold üyesiniz.");
      return;
    }
    setBusy(true);
    try {
      await api.goldActivate();
      await syncMe();
      showToast("Gold üyeliğiniz aktif! Artık kazançlarınız 2x çip.");
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Gold üyelik alınamadı.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="felt-bg min-h-screen">
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="text-center mb-8">
          <h2 className="font-display text-4xl font-bold text-gold-400">Gold Üyelik</h2>
          <p className="text-ivory-dark/70 mt-2">
            Gold üye rozeti + kazançlarda <b className="text-gold-300">2x çip</b>
          </p>
        </div>

        <div className="grid sm:grid-cols-2 gap-4 mb-8">
          <div className="bg-wood-950/80 border border-gold-700 rounded-2xl p-6">
            <p className="text-xs font-bold text-gold-500 uppercase tracking-wider mb-3">
              Gold Üyelik Avantajları
            </p>
            <ul className="space-y-2 text-sm text-ivory-dark/85 list-disc list-inside">
              <li>
                Nickinizin yanında <b className="text-gold-400">★ Gold rozeti</b> görünür
              </li>
              <li>
                Oyun kazançlarınız <b className="text-gold-300">2 katı çip</b> olur
              </li>
              <li>Çevrimiçi listede üst sıralarda görünürsünüz</li>
              <li>Sohbette gold yıldızı ile ayrışırsınız</li>
            </ul>
            <button
              onClick={buyGold}
              disabled={!me || me.gold || busy}
              className={`mt-6 w-full py-3 rounded-xl font-bold text-lg transition-all ${
                me?.gold
                  ? "bg-wood-900 text-gold-500 cursor-default border border-gold-700"
                  : "bg-gold-600 hover:bg-gold-500 text-wood-950 hover:-translate-y-0.5 shadow-tile disabled:opacity-60"
              }`}
            >
              {me?.gold ? "★ Gold Üyesiniz" : busy ? "İşleniyor..." : `Gold Üye Ol (${GOLD_PRICE} çip)`}
            </button>
            {!me?.gold && (
              <p className="text-[11px] text-ivory-dark/50 mt-2 text-center">
                Gold üyelik {GOLD_PRICE} çipe anında aktifleşir; çipiniz yetersizse oyun oynayarak kazanın.
              </p>
            )}
          </div>

          <div className="bg-wood-950/80 border border-wood-800 rounded-2xl p-6">
            <p className="text-xs font-bold text-gold-500 uppercase tracking-wider mb-3">
              Yetki Kademesi
            </p>
            <ol className="space-y-2.5">
              {RANKS.map((r, i) => (
                <li key={r.id} className="flex items-start gap-2 text-sm">
                  <span className="text-gold-600 font-bold w-5">{i + 1}.</span>
                  <div>
                    <RankBadge rank={r.id} />
                    <p className="text-xs text-ivory-dark/60 mt-0.5">{r.desc}</p>
                  </div>
                </li>
              ))}
            </ol>
            <p className="text-[11px] text-ivory-dark/50 mt-4">
              Kademe yükseltmeleri Site Koordinatörü ve Yöneticiler tarafından yapılır.
            </p>
          </div>
        </div>

        {me && (
          <div className="bg-wood-950/60 border border-wood-800 rounded-xl p-4 text-center text-sm text-ivory-dark/70">
            Mevcut durumunuz: <RankBadge rank={me.rank} gold={me.gold} /> ·{" "}
            <b className="text-gold-400">{me.chips.toLocaleString("tr-TR")} çip</b>
            {me.gold && " · Kazanç çarpanınız: 2x"}
          </div>
        )}
      </div>
    </div>
  );
}
