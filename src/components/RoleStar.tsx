import { roleStar } from "../lib/kira";

/**
 * Rol yıldızı (★) amblemi — rengi role göre kira.ts'te tanımlı.
 * Site sahibi: siyah parlak (metalik parlaklık) ve biraz daha büyük;
 * site yetkilisi siyah, koordinatör açık kahve,
 * as admin/admin kırmızı-beyaz, süper op sarı gold, yönetici sarı.
 */
export function RoleStar({ role, rank, size = 14 }: { role: string; rank?: string; size?: number }) {
  const s = roleStar(role, rank);
  if (!s) return null;

  // Site sahibi yıldızı her zaman biraz daha büyük
  const px = s.glossy ? size + 3 : size;

  if (s.glossy) {
    return (
      <span
        title={s.title}
        className="shrink-0 select-none leading-none"
        style={{
          fontSize: px,
          background: "linear-gradient(160deg, #9a9a9a 0%, #2b2b2b 28%, #000000 48%, #1f1f1f 62%, #6e6e6e 82%, #0a0a0a 100%)",
          WebkitBackgroundClip: "text",
          backgroundClip: "text",
          color: "transparent",
          WebkitTextStroke: "0.5px #d4d4d8",
          filter: "drop-shadow(0 1px 1px rgba(0,0,0,0.7)) drop-shadow(0 0 2px rgba(255,255,255,0.35))",
        }}
      >
        ★
      </span>
    );
  }

  return (
    <span
      title={s.title}
      className="shrink-0 select-none leading-none"
      style={{
        color: s.color,
        fontSize: px,
        WebkitTextStroke: s.stroke ? `0.5px ${s.stroke}` : undefined,
        filter: s.stroke ? "drop-shadow(0 0 1px rgba(0,0,0,0.8))" : undefined,
      }}
    >
      ★
    </span>
  );
}
