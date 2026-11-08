import { rankDef } from "../lib/ranks";
import type { RankId } from "../lib/types";

export function RankBadge({ rank, gold }: { rank: RankId; gold?: boolean }) {
  const r = rankDef(rank);
  const showGold = gold && rank !== "gold";
  return (
    <span className="inline-flex items-center gap-1">
      <span
        className={`px-1.5 py-0.5 rounded border text-[10px] font-semibold tracking-wide uppercase ${r.badge}`}
        title={r.desc}
      >
        {r.short}
      </span>
      {showGold && (
        <span
          className="text-gold-400 text-xs"
          title="Gold Üye — kazançta 2x çip"
        >
          ★
        </span>
      )}
    </span>
  );
}

export function GoldStar({ gold }: { gold: boolean }) {
  if (!gold) return null;
  return (
    <span className="text-gold-400 animate-pulseGold" title="Gold Üye — kazançta 2x çip">
      ★
    </span>
  );
}
