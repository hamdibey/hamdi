import { api } from "../lib/api";
import { useApp } from "../store/useApp";

export interface SeatPlayer {
  nick: string;
  bot?: boolean;
}

/**
 * Masa bekleme lobisi — masa açıldığında koltuklar BOŞTUR.
 * Oyun, koltuklar (gerçek üyeler kendi isteğiyle oturunca / bot davet edilince)
 * dolana kadar BEKLER. Sahte AI otomatik dolmaz.
 */
export function MasaBekleme({
  tableId,
  gameLabel,
  opponents,
  onRefresh,
}: {
  tableId: number;
  gameLabel: string;
  opponents: SeatPlayer[];
  onRefresh: () => void;
}) {
  const me = useApp((s) => s.me);
  const showToast = useApp((s) => s.showToast);
  const go = useApp((s) => s.go);

  const dolu = opponents.length;
  const bos = Math.max(0, 3 - dolu);

  const botDavet = async () => {
    try {
      const r = await api.inviteTableBots(tableId);
      showToast(`${r.joined} oyuncu masaya oturdu.`);
      onRefresh();
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Oyuncular davet edilemedi.");
    }
  };

  const koltuk = (i: number) => {
    if (i === 0) {
      return (
        <div
          key="me"
          className="flex flex-col items-center gap-1 px-3 py-2 bg-[#d4d0c8] border-t border-l border-white border-b border-r border-[#404040] min-w-[120px]"
        >
          <span className="w-7 h-7 bg-white border border-[#808080] text-base flex items-center justify-center">👤</span>
          <span className="text-[12px] font-bold text-[#0a246a]">{me?.nick ?? "Sen"}</span>
          <span className="text-[9px] text-[#333]">Sen</span>
        </div>
      );
    }
    const p = opponents[i - 1];
    if (p) {
      return (
        <div
          key={`o${i}`}
          className="flex flex-col items-center gap-1 px-3 py-2 bg-[#d4d0c8] border-t border-l border-white border-b border-r border-[#404040] min-w-[120px]"
        >
          <span className="w-7 h-7 bg-white border border-[#808080] text-base flex items-center justify-center">
            👤
          </span>
          <span className="text-[12px] font-bold text-black">{p.nick}</span>
          <span className="text-[9px] text-[#333]">Üye</span>
        </div>
      );
    }
    return (
      <div
        key={`b${i}`}
        className="flex flex-col items-center gap-1 px-3 py-2 bg-[#e6e2da] border-t border-l border-white border-b border-r border-[#404040] min-w-[120px] border-dashed"
      >
        <span className="w-7 h-7 bg-white border border-[#808080] text-base flex items-center justify-center text-[#999]">＋</span>
        <span className="text-[12px] font-bold text-[#7a7a7a]">Boş Koltuk</span>
        <span className="text-[9px] text-[#999]">Oturulmayı bekliyor</span>
      </div>
    );
  };

  return (
    <div className="max-w-[820px] mx-auto bg-[#d4d0c8] border-t border-l border-[#dfdfdf] border-b border-r border-[#404040] shadow-pop mt-10">
      <div className="flex items-center justify-between px-2 py-1 bg-gradient-to-b from-[#3a6ea5] to-[#0a246a] text-white text-xs font-bold select-none">
        <span>[ {gameLabel} · Masa {tableId} ]</span>
        <span className="flex gap-1">
          <span className="px-1.5 bg-[#d4d0c8] text-black border-t border-l border-white border-b border-r border-[#404040] leading-4">□</span>
          <button
            onClick={() => go({ name: "salonRoom", floor: 1, slot: 1 })}
            className="px-1.5 bg-[#d4d0c8] text-black border-t border-l border-white border-b border-r border-[#404040] leading-4 hover:bg-[#e0dcd4]"
          >
            ×
          </button>
        </span>
      </div>

      <div className="p-6 text-center">
        <h2 className="text-lg font-bold text-[#0a246a] mb-1">Oyuncular Bekleniyor</h2>
        <p className="text-[12px] text-black mb-1">
          Masa <b>{tableId}</b> kuruldu — koltuklar boş.
        </p>
        <p className="text-[12px] text-[#444] mb-4">
          Üyeler <b>kendi isteğiyle</b> oturur ya da sen <b>rakip davet edersin</b>. Oyun, masa dolunca başlar.
        </p>

        <div className="flex justify-center gap-3 mb-5 flex-wrap">
          {[0, 1, 2, 3].map((i) => koltuk(i))}
        </div>

        <div className="text-[12px] font-bold text-[#0a246a] mb-4">
          {dolu} / 3 rakip oturdu{bos > 0 ? ` · ${bos} koltuk boş` : ""}
        </div>

        <div className="flex justify-center gap-2 flex-wrap">
          <button
            onClick={() => void botDavet()}
            className="px-3 py-1.5 text-[12px] bg-[#d4d0c8] border-t border-l border-white border-b border-r border-[#404040] hover:bg-[#e0dcd4]"
          >
            Rakip Davet Et
          </button>
          <button
            onClick={onRefresh}
            className="px-3 py-1.5 text-[12px] bg-[#d4d0c8] border-t border-l border-white border-b border-r border-[#404040] hover:bg-[#e0dcd4]"
          >
            ⟳ Yenile
          </button>
          <button
            onClick={() => go({ name: "salonRoom", floor: 1, slot: 1 })}
            className="px-3 py-1.5 text-[12px] bg-[#d4d0c8] border-t border-l border-white border-b border-r border-[#404040] hover:bg-[#e0dcd4]"
          >
            ← Salona Dön
          </button>
        </div>

        <p className="text-[10px] text-[#666] mt-4">
          Masa 5 sn'de bir otomatik yenilenir; bir üye oturunca oyun kendiliğinden başlar.
        </p>
      </div>
    </div>
  );
}
