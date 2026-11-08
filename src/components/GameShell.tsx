import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { useIsMobile } from "../lib/mobile";

/**
 * Masaüstü oyun düzeninin referans ölçüsü. Mobilde içerik bu genişliğe
 * kilitlenir ve ekrana sığacak şekilde transform: scale ile küçültülür.
 */
const DESIGN_W = 1024;
const DESIGN_H = 720;

/**
 * Mobil oyun kabuğu:
 * 1) Oyun sayfasına girerken tam ekran + yatay (landscape) yön kilidi dener
 *    (Android Chrome/Edge; API desteklemiyorsa sessizce geçer).
 * 2) Yön kilitlenemeyen cihazlarda (iOS Safari) dikeyken "telefonu yatay
 *    çevir" kapak gösterir.
 * 3) Masaüstü düzenini ekrana sığdıracak şekilde ölçekler.
 */
export function GameShell({ children }: { children: ReactNode }) {
  const isMobile = useIsMobile();
  const stageRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const enteredFs = useRef(false);
  const [scale, setScale] = useState(1);
  const [boxH, setBoxH] = useState<number | null>(null);
  const [portrait, setPortrait] = useState(
    () => typeof window !== "undefined" && window.innerHeight > window.innerWidth
  );
  const [portraitDismissed, setPortraitDismissed] = useState(false);

  // ── 1) Tam ekran + yatay yön kilidi ─────────────────────────────
  useEffect(() => {
    if (!isMobile) return;
    let cancelled = false;
    const lock = async () => {
      try {
        if (!document.fullscreenElement && document.documentElement.requestFullscreen) {
          await document.documentElement.requestFullscreen();
          if (cancelled) return;
          enteredFs.current = true;
        }
      } catch {
        /* tam ekran izni yok — yoksay */
      }
      try {
        const so = screen.orientation as (ScreenOrientation & { lock?: (o: string) => Promise<void> }) | undefined;
        if (so?.lock) await so.lock("landscape");
      } catch {
        /* yön kilidi desteklenmiyor (iOS vb.) — kapak devreye girer */
      }
    };
    void lock();
    return () => {
      cancelled = true;
      try {
        const so = screen.orientation as (ScreenOrientation & { unlock?: () => void }) | undefined;
        so?.unlock?.();
        if (enteredFs.current && document.fullscreenElement && document.exitFullscreen) {
          void document.exitFullscreen();
        }
        enteredFs.current = false;
      } catch {
        /* temizlik hatası yoksayılır */
      }
    };
  }, [isMobile]);

  // ── 2) Dikey/yatay takibi (kilit tutmazsa kapak için) ───────────
  useEffect(() => {
    if (!isMobile) return;
    const update = () => {
      const p = window.innerHeight > window.innerWidth;
      setPortrait(p);
      if (!p) setPortraitDismissed(false); // yatay moda dönünce kapak yeniden hazır olsun
    };
    update();
    window.addEventListener("resize", update);
    window.addEventListener("orientationchange", update);
    return () => {
      window.removeEventListener("resize", update);
      window.removeEventListener("orientationchange", update);
    };
  }, [isMobile]);

  // ── 3) Ekrana sığdırma ölçeği ───────────────────────────────────
  useLayoutEffect(() => {
    if (!isMobile) {
      setScale(1);
      setBoxH(null);
      return;
    }
    const fit = () => {
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      const contentH = contentRef.current?.scrollHeight ?? DESIGN_H;
      // genislige sigdir; mumkunse yukseklige de sigdir (her sey tek ekranda)
      const widthFit = Math.min(1, vw / DESIGN_W);
      const fullFit = Math.min(widthFit, vh / contentH);
      // her seyi sigdirmak 0.45'in altina dusurecekse kaydirilmis genislik moduna gec
      const s = fullFit < 0.45 ? widthFit : fullFit;
      setScale(s);
      setBoxH(Math.ceil(contentH * s));
    };
    fit();
    window.addEventListener("resize", fit);
    const ro = new ResizeObserver(fit);
    if (contentRef.current) ro.observe(contentRef.current);
    return () => {
      window.removeEventListener("resize", fit);
      ro.disconnect();
    };
  }, [isMobile]);

  // Masaüstü: içerik olduğu gibi (medya sorguları normal lg: kırılımlarıyla çalışır)
  if (!isMobile) {
    return <div ref={stageRef}>{children}</div>;
  }

  return (
    <>
      {/* Yön kilidi tutmadıysa (iOS vb.) yatay çevirme kapak */}
      {portrait && !portraitDismissed && (
        <div className="fixed inset-0 z-[90] bg-wood-950/95 backdrop-blur-sm flex flex-col items-center justify-center gap-5 px-6 text-center">
          <div className="rotate-phone-anim select-none" aria-hidden>
            📱
          </div>
          <p className="font-display text-xl font-bold text-gold-400">Telefonunu yatay çevir</p>
          <p className="text-sm text-ivory-dark/70 max-w-xs leading-relaxed">
            Oyun tam ekran ve yatay modda açıldı. Telefonunu yan çevirince masa tam olarak sığacak.
          </p>
          <button
            onClick={() => setPortraitDismissed(true)}
            className="mt-2 px-4 py-2 rounded-lg bg-wood-800 hover:bg-wood-700 text-ivory-dark text-sm font-semibold border border-wood-600"
          >
            Dikey devam et
          </button>
        </div>
      )}

      <div
        ref={stageRef}
        className="relative overflow-hidden"
        style={{ height: boxH ?? "100dvh", width: "100%" }}
      >
        <div
          ref={contentRef}
          className="game-stage origin-top-left"
          style={{
            width: DESIGN_W,
            transform: `scale(${scale})`,
            willChange: "transform",
          }}
        >
          {children}
        </div>
      </div>
    </>
  );
}
