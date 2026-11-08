import { useEffect, useState } from "react";

/**
 * Üye bilgi penceresinde giriş konumunu gösteren harita.
 * Koordinat (lat/lng) varsa OpenStreetMap embed ile doğrudan işaretler;
 * yoksa konum adını (örn "Istanbul / Kadikoy") Nominatim ile kodlayıp
 * haritada gösterir. API anahtarı gerektirmez.
 */
export function MemberMap({ lat, lng, where }: { lat: number; lng: number; where: string }) {
  const [pt, setPt] = useState<{ lat: number; lng: number } | null>(
    lat && lng ? { lat, lng } : null
  );
  const [loading, setLoading] = useState(!lat && !lng && !!where);
  const [err, setErr] = useState("");

  // Koordinat yoksa konum adından kodla (Nominatim, anahtarsız)
  useEffect(() => {
    if (pt || !where || where === "Bilinmiyor") {
      setLoading(false);
      if (!pt && (!where || where === "Bilinmiyor")) setErr("Konum bilgisi yok");
      return;
    }
    let alive = true;
    (async () => {
      try {
        const r = await fetch(
          `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(where)}`,
          { headers: { "Accept-Language": "tr" } }
        );
        const arr = await r.json();
        if (alive && Array.isArray(arr) && arr[0]) {
          setPt({ lat: Number(arr[0].lat), lng: Number(arr[0].lon) });
        } else if (alive) {
          setErr("Bu konum haritada bulunamadı");
        }
      } catch {
        if (alive) setErr("Harita yüklenemedi");
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [where]);

  if (err) {
    return (
      <div className="h-28 border border-[#808080] bg-white flex items-center justify-center text-[11px] text-black">
        📍 {err}
      </div>
    );
  }
  if (!pt) {
    return (
      <div className="h-28 border border-[#808080] bg-white flex items-center justify-center text-[11px] text-black">
        {loading ? "Harita yükleniyor…" : "Harita yok"}
      </div>
    );
  }

  // İşaret çevresinde küçük bir kutu (bbox) hesapla
  const d = 0.04;
  const bbox = [pt.lng - d, pt.lat - d, pt.lng + d, pt.lat + d].join(",");
  const src =
    `https://www.openstreetmap.org/export/embed.html?bbox=${bbox}` +
    `&layer=mapnik&marker=${pt.lat},${pt.lng}`;

  return (
    <div className="relative h-28 border border-[#808080] bg-white overflow-hidden">
      <iframe
        title="Giriş konumu haritası"
        src={src}
        className="w-full h-full border-0"
        loading="lazy"
      />
      <a
        href={`https://www.openstreetmap.org/?mlat=${pt.lat}&mlon=${pt.lng}#map=14/${pt.lat}/${pt.lng}`}
        target="_blank"
        rel="noreferrer"
        className="absolute bottom-0 right-0 bg-[#d4d0c8]/90 border-t border-l border-[#808080] px-1 text-[10px] text-[#0a246a] underline"
      >
        Haritada aç ↗
      </a>
    </div>
  );
}
