import { useEffect, useRef, useState } from "react";

/**
 * Sabit genişlikteki oyun sahnesini dar kapsayıcıya (masaüstü penceresi,
 * dar web alanı) göre otomatik ölçekler — sayfa her ekrana sığar.
 * `fitScreen` verilince yükseklik de hesaba katılır: pencere boyca da
 * ekrana sığar (salon ve oyun giriş pencereleri tam ekranı doldurur).
 *
 * v1.44.28 — KENAR BOŞLUĞU TAMİRİ: ölçek `transform: scale` yerine **CSS
 * `zoom`** ile uygulanıyor (Chromium/Electron + modern tarayıcılar destekler).
 * Böylece ölçeklenmiş sahnenin YERLİM boyutu da küçülür → uzun sahneler
 * kapsayıcı içinde GERÇEKTEN dikey kaydırılabilir; eskiden `transform`
 * yalnız görseli küçülttüğü için kaydırma imkânsızdı ve yükseklik sığdırmak
 * zorunluydu. Yükseklik sığdırmak büyük kenar boşluğu yaratıyorsa (salon
 * odası kısa bir alana gömüldüğünde) artık genişlik doldurulur, içerik
 * kaydırılır — kenarlarda boşluk kalmaz.
 */
export function AutoFit({
  width = 1180,
  fitScreen = false,
  className = "",
  style,
  children,
}: {
  width?: number;
  fitScreen?: boolean;
  className?: string;
  style?: React.CSSProperties;
  children: React.ReactNode;
}) {
  const outer = useRef<HTMLDivElement>(null);
  const inner = useRef<HTMLDivElement>(null);
  const zoomRef = useRef(1);
  const [scale, setScale] = useState(1);
  const [height, setHeight] = useState<number | undefined>(undefined);
  const [offX, setOffX] = useState(0);

  useEffect(() => {
    const o = outer.current;
    const i = inner.current;
    if (!o || !i) return;
    const update = () => {
      // padding dahil edilmezse içerik (ör. salon odası üye listesi) sağdan kırpılır:
      // ölçek her zaman içerik kutusuna (clientWidth − yatay padding) göre hesaplanır.
      const cs = window.getComputedStyle(o);
      const padX = (parseFloat(cs.paddingLeft) || 0) + (parseFloat(cs.paddingRight) || 0);
      const padY = (parseFloat(cs.paddingTop) || 0) + (parseFloat(cs.paddingBottom) || 0);
      const avail = Math.max(120, (o.clientWidth || width) - padX);
      // zoom uygulanmış sahnenin ÖLÇEKLENMEMİŞ yüksekliği: getBoundingClientRect
      // ekran pikseli (zoom'lu) döndürür — mevcut zoom'a bölünce gerçek CSS
      // yüksekliği verir (offsetHeight zoom sürümüne göre şaşabiliyor).
      const naturalH =
        (i.getBoundingClientRect().height || 1) / (zoomRef.current || 1);
      const sW = Math.min(1, avail / width);
      let s = sW;
      let h = naturalH * s + padY;
      if (fitScreen) {
        const parentH = o.parentElement?.clientHeight || 0;
        const availH = Math.max(
          200,
          Math.min(parentH || window.innerHeight, window.innerHeight) - padY - 6,
        );
        const sFit = Math.min(sW, availH / naturalH);
        // Yan boşluk ≤40px ise tam ekrana sığdır; büyük boşluk yaratıyorsa
        // (kısa kapsayıcıya gömülü uzun sahne) genişlik doldurulur ve içerik
        // dikey KAYDIRILIR — kenarlarda büyük boşluk oluşmaz.
        if (avail - width * sFit <= 40) {
          s = sFit;
          h = naturalH * sFit + padY;
        } else {
          h = Math.min(naturalH * sW + padY, availH + padY);
        }
      }
      zoomRef.current = s;
      i.style.zoom = String(s); // yerleşim boyutu da küçülür → dikey kaydırma çalışır
      setScale(s);
      // YATAY ORTALAAMA: büyük boşluk kalmadıysa da (<40px) içerik tam ortada.
      setOffX(Math.max(0, (avail - width * s) / 2));
      setHeight(h);
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(o);
    ro.observe(i);
    window.addEventListener("resize", update);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", update);
    };
  }, [width, fitScreen]);

  return (
    <div
      ref={outer}
      className={`w-full overflow-x-hidden ${fitScreen ? "overflow-y-auto" : "overflow-hidden"} ${className}`}
      style={{ height, ...style }}
    >
      <div
        ref={inner}
        style={{ width, marginLeft: offX, zoom: scale }}
      >
        {children}
      </div>
    </div>
  );
}
