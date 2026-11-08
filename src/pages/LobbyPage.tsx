import { useCallback, useState } from "react";
import { useApp } from "../store/useApp";
import { isElectronWin } from "../store/useDesktop";
import { FLOORS, SLOTS_PER_FLOOR } from "../lib/kira";
import { api } from "../lib/api";
import type { ApiRental } from "../lib/api";
import { SalonRoomPage } from "./SalonRoomPage";

/* ---------------------------------------------------------------------------
 * Lobi — klasik akış (v1.44.5 düzeni korunur):
 *   Kat 1-4 → açılır salon MENÜSÜ (popup) → salona tıkla →
 *   ORTA ALAN o salonun MASA tablosu olur (aynı pencere, aynı ekran).
 *   Masa oyunu her zaman ayrı pencere açar.
 *
 * v1.44.31 — REFERANS PENCERE DÜZENİ: lobi kabuğu artık klasik salONUN
 *   kendi penceresi gibi görünür — mavi başlık çubuğu ([nick] · oyun adı ·
 *   salon adı [üye] · — □ ×), kat şeridi + ortada "[salon adı]".
 *   Salon bandı (★★ ad ★★ Sevd. · oyuncu/ping/radyo), menü çubuğu
 *   (Yeni Masa · … · ★ DUYURU), masa tablosu, sohbet, üye listesi,
 *   TOP 10 ve alt bağlantı çubuğu GÖMÜLÜ SalonRoomPage'ten gelir —
 *   lobi ile salon ekranı birbirinin aynısı olur (bire bir referans).
 * ------------------------------------------------------------------------- */

const dlgStyle: React.CSSProperties = {
  boxShadow:
    "inset -1px -1px 0 #0a0a0a, inset 1px 1px 0 #fff, inset -2px -2px 0 #808080, inset 2px 2px 0 #dfdfdf, 4px 6px 20px rgba(0,0,0,.45)",
};

export function LobbyPage({ floor }: { floor?: number }) {
  const me = useApp((s) => s.me);

  const [floorTab, setFloorTab] = useState<number>(floor ?? 1);
  const [sel, setSel] = useState(1);
  const [katMenu, setKatMenu] = useState<number | null>(null);
  const [katRentals, setKatRentals] = useState<ApiRental[]>([]);
  const [katDoluluk, setKatDoluluk] = useState<Record<number, number>>({});
  // Gömülü salonun kısa adı + içerideki üye sayısı — başlık çubuğu bunları gösterir
  const [salonAd, setSalonAd] = useState("Ana Salon");
  const [salonUye, setSalonUye] = useState<number | null>(null);
  const salonBilgi = useCallback((t: string, n: number) => {
    setSalonAd(t);
    setSalonUye(n);
  }, []);

  // Kat menüsü verisi: kiralı adlar + doluluk
  const katVeri = (f: number) => {
    if (katRentals.length === 0) {
      api.salonRentals().then((r) => setKatRentals(r.rentals ?? [])).catch(() => {});
    }
    if (Object.keys(katDoluluk).length >= SLOTS_PER_FLOOR) return;
    const out: Record<number, number> = {};
    let idx = 1;
    const worker = async () => {
      while (idx <= SLOTS_PER_FLOOR) {
        const slot = idx++;
        try {
          const r = await api.salonUsers(`${f}_${slot}`);
          out[slot] = (r.users ?? []).length;
        } catch {
          out[slot] = 0;
        }
      }
    };
    void Promise.all(Array.from({ length: 10 }, worker)).then(() => setKatDoluluk(out));
  };

  const sec = (f: number, slot: number) => {
    setKatMenu(null);
    setFloorTab(f);
    setSel(slot);
  };

  return (
    <div
      className="fixed inset-0 flex flex-col text-[11px] select-none overflow-hidden"
      style={{ fontFamily: "Tahoma, 'Segoe UI', sans-serif", background: "#d4d0c8" }}
    >
      {/* ── Pencere başlığı (bire bir referans) ─────────────────────── */}
      <div className="flex items-center justify-between gap-2 px-2 py-[2px] bg-gradient-to-b from-[#3a6ea5] to-[#0a246a] text-white text-[11px] font-bold select-none shrink-0">
        <span className="truncate flex items-center gap-1"><img src="icon.jpg" alt="" className="w-4 h-4" /> {typeof window !== "undefined" && window.location.hostname.includes("okeyhasi") ? "OKEY HASI" : "HAS OKEY"}</span>
        <span className="hidden md:inline">101, Okey, Domino ve Kart Oyunları</span>
        <span className="flex items-center gap-2 truncate">
          <span className="truncate">
            {salonAd} [{salonUye ?? "…"}]
          </span>
          <span className="flex items-center gap-1 opacity-90">
            <span className="px-1.5 bg-[#d4d0c8] text-black leading-4">—</span>
            <span className="px-1.5 bg-[#d4d0c8] text-black leading-4">□</span>
            <button
              onClick={() => {
                if (isElectronWin()) window.close();
              }}
              title="Kapat"
              className="px-1.5 bg-[#d4d0c8] text-black leading-4 hover:bg-[#e0dcd4]"
            >
              ×
            </button>
          </span>
        </span>
      </div>

      {/* ── Kat linkleri + ortada salon adı şeridi ──────────────────── */}
      <div className="relative flex items-center gap-2 px-2 py-[2px] bg-[#d4d0c8] border-b border-[#a0a0a0] shrink-0 flex-wrap z-[80]">
        <span className="flex gap-2">
          {FLOORS.map((f) => (
            <button
              key={f}
              onClick={() => {
                setKatMenu((m) => (m === f ? null : f));
                katVeri(f);
              }}
              className={`font-bold ${
                floorTab === f ? "text-[#7a1414] underline decoration-dotted" : "text-[#c22020] hover:underline"
              }`}
            >
              {f}.Kat
            </button>
          ))}
        </span>
        <span className="mx-auto font-bold text-[#cc0000]">[{salonAd}]</span>

        {/* ── KAT → SALON MENÜSÜ (klasik HasOkey tarzı çok sütunlu popup) ── */}
        {katMenu !== null && (
          <div
            className="absolute left-1 top-[22px] z-[90] w-[680px] max-w-[96%] max-h-[360px] overflow-auto bg-[#d4d0c8] p-1"
            style={{ border: "1px solid #404040", boxShadow: "2px 3px 12px rgba(0,0,0,.5)" }}
            onMouseLeave={() => setKatMenu(null)}
          >
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-x-3 content-start">
              {Array.from({ length: SLOTS_PER_FLOOR }, (_, i) => i + 1).map((slot) => {
                const rental = katRentals.find((r) => r.floor === katMenu && r.slot === slot);
                const ad = rental?.name?.trim() || `salon${slot}`;
                const dolu = katDoluluk[slot] ?? 0;
                const renk = rental
                  ? "text-[#0a55c8]"
                  : dolu >= 9
                    ? "text-[#c22020]"
                    : dolu === 0
                      ? "text-[#157a15]"
                      : "text-[#111]";
                const aktif = katMenu === floorTab && slot === sel;
                return (
                  <button
                    key={slot}
                    onClick={() => sec(katMenu, slot)}
                    className={`flex items-center justify-between gap-1 px-1 py-[1px] text-[12px] text-left hover:bg-[#0a246a] hover:text-white ${renk} ${
                      aktif ? "bg-[#c8d8f0] font-black" : ""
                    }`}
                    title={`${katMenu}. Kat · ${ad} — tıkla, masaları burada gör`}
                  >
                    <span className="truncate font-bold">
                      [{slot}-{ad}]{rental ? " 🔑" : ""}
                    </span>
                    <span className="text-[10px] shrink-0">({dolu}/12)</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* ── ORTA ALAN: o salonun MASA TABLOSU (+ sohbet + üye listesi) ──
          Band · menü çubuğu · ★ DUYURU · alt bağlantı çubuğu artık gömülü
          SalonRoomPage'ten gelir — ekran referans salonla birebir aynı. ── */}
      <div className="flex-1 min-h-0">
        <SalonRoomPage floor={floorTab} slot={sel} embedded onInfo={salonBilgi} />
      </div>
    </div>
  );
}
