import { useCallback, useEffect, useRef, useState } from "react";

/* Klasik Win98 tarzı otomatik güncelleme penceresi — Electron programında
 * açılışta ve 4 saatte bir sunucudaki versiyon.json kontrol edilir; yeni
 * sürüm varsa bu pencere çıkar. "Şimdi Güncelleme" zip'i indirip kurar. */

interface GuncellemeBilgi {
  surum: string;
  mesaj?: string;
  url?: string;
}

const LS_KEY = "vk_gunc_ver_atlanan";

const win98Box = {
  boxShadow:
    "inset -1px -1px 0 #0a0a0a, inset 1px 1px 0 #fff, inset -2px -2px 0 #808080, inset 2px 2px 0 #dfdfdf, 4px 6px 20px rgba(0,0,0,.45)",
} as const;

function KBtn({
  children,
  onClick,
  primary,
  disabled,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  primary?: boolean;
  disabled?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`px-3 h-[23px] text-[11px] font-bold ${primary ? "text-[#000080]" : "text-black"} bg-[#d4d0c8] active:translate-y-px disabled:opacity-50`}
      style={{
        fontFamily: "Tahoma, sans-serif",
        boxShadow:
          "inset -1px -1px 0 #0a0a0a, inset 1px 1px 0 #fff, inset -2px -2px 0 #808080, inset 2px 2px 0 #dfdfdf",
      }}
    >
      {children}
    </button>
  );
}

export function GuncellemeDialog({ show }: { show: boolean }) {
  const [info, setInfo] = useState<GuncellemeBilgi | null>(null);
  const [faz, setFaz] = useState<"bekliyor" | "indiriliyor" | "aciliyor" | "hata">("bekliyor");
  const [pct, setPct] = useState(0);
  const [hata, setHata] = useState("");
  const busyRef = useRef(false);

  useEffect(() => {
    const vk = window.vkElectron;
    if (!vk) return;
    const off = vk.onUpdate((bilgi) => {
      if (localStorage.getItem(LS_KEY) === bilgi.surum) return;
      setInfo((cur) => cur ?? bilgi); // çalışan bir pencere zaten sorduysa ikinci kez sorma
      setFaz("bekliyor");
    });
    const offP = vk.onUpdateProgress((p) => {
      if (p <= 100) {
        setPct(p);
        setFaz("indiriliyor");
      } else if (p === 101) setFaz("aciliyor");
      else if (p === 102) setFaz("aciliyor");
    });
    void vk.updateCheck().catch(() => {});
    return () => {
      off();
      offP();
    };
  }, []);

  const simdi = useCallback(async () => {
    if (busyRef.current || !info) return;
    busyRef.current = true;
    setHata("");
    setPct(0);
    setFaz("indiriliyor");
    try {
      await window.vkElectron?.updateRun();
      /* başarılı dönüş programın kapanmak üzere olması demek */
    } catch (e) {
      setFaz("hata");
      setHata(e instanceof Error ? e.message : "Güncelleme indirilemedi.");
      busyRef.current = false;
    }
  }, [info]);

  const sonra = useCallback(() => {
    if (info) localStorage.setItem(LS_KEY, info.surum);
    setInfo(null);
  }, [info]);

  if (!show || !info) return null;

  return (
    <div className="fixed inset-0 z-[99990] flex items-start justify-center pt-16 bg-black/20 select-none">
      <div className="w-[380px] max-w-[92%] bg-[#d4d0c8]" style={win98Box}>
        <div
          className="flex items-center justify-between h-[22px] px-1.5"
          style={{ background: "linear-gradient(180deg,#3f8cf3 0%,#0a55c8 8%,#0b53c4 40%,#1c6ee4 88%,#2b7cf0 100%)" }}
        >
          <span className="text-white text-[11px] font-bold">🔄 Program Güncellemesi</span>
        </div>
        <div className="p-4 text-[12px] leading-relaxed" style={{ fontFamily: "Tahoma, sans-serif" }}>
          <p className="mb-2">
            <b>Yeni sürüm bulundu: v{info.surum}</b>
            <span className="text-[#555]"> (sizde: v{__VK_SURUM__})</span>
          </p>
          {info.mesaj && <p className="mb-3 text-[11px] text-[#333]">{info.mesaj}</p>}

          {faz === "bekliyor" && (
            <p className="mb-3 text-[11px]">
              Güncellemeyi indirip kurmak ister misiniz? Program kendiliğinden yeniden kurulur.
            </p>
          )}

          {faz === "indiriliyor" && (
            <div className="mb-3">
              <p className="mb-1 text-[11px]">İndiriliyor… %{pct}</p>
              <div
                className="h-[18px] bg-white p-[2px]"
                style={{
                  boxShadow: "inset 1px 1px 0 #808080, inset -1px -1px 0 #fff, inset 2px 2px 0 #404040, inset -2px -2px 0 #dfdfdf",
                }}
              >
                <div className="h-full bg-[#0a55c8]" style={{ width: `${Math.max(2, pct)}%` }} />
              </div>
            </div>
          )}

          {faz === "aciliyor" && (
            <p className="mb-3 text-[11px]">Paket hazırlanıyor… Program kapanınca kurulum otomatik başlayacak.</p>
          )}

          {faz === "hata" && (
            <div className="mb-3">
              <p className="mb-1 text-[11px] text-[#a00]">Güncelleme alınamadı: {hata}</p>
              <p className="text-[11px]">İndirme sayfasından elle de kurabilirsiniz.</p>
            </div>
          )}

          <div className="flex justify-end gap-2">
            {faz !== "indiriliyor" && faz !== "aciliyor" && (
              <>
                <KBtn primary onClick={() => void simdi()}>
                  Şimdi Güncelle
                </KBtn>
                <KBtn onClick={sonra}>Daha Sonra</KBtn>
              </>
            )}
            {faz === "hata" && (
              <KBtn onClick={() => window.open("https://hasokey.com.tr/", "_blank")}>
                İndirme Sayfasını Aç
              </KBtn>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
