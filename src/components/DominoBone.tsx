import type { Bone } from "../lib/domino";

interface Props {
  bone: Bone;
  vertical?: boolean;
  size?: "sm" | "md";
  onClick?: () => void;
  selected?: boolean;
  glow?: boolean;
}

const PIP_POS: Record<number, [number, number][]> = {
  0: [],
  1: [[50, 50]],
  2: [[25, 25], [75, 75]],
  3: [[25, 25], [50, 50], [75, 75]],
  4: [[25, 25], [75, 25], [25, 75], [75, 75]],
  5: [[25, 25], [75, 25], [50, 50], [25, 75], [75, 75]],
  6: [[25, 25], [75, 25], [25, 50], [75, 50], [25, 75], [75, 75]],
};

function Half({ n }: { n: number }) {
  return (
    <div className="relative flex-1">
      {PIP_POS[n].map(([x, y], i) => (
        <span
          key={i}
          className="absolute w-[14%] h-[14%] rounded-full bg-wood-950 -translate-x-1/2 -translate-y-1/2"
          style={{ left: `${x}%`, top: `${y}%` }}
        />
      ))}
    </div>
  );
}

export function DominoBone({ bone, vertical, size = "md", onClick, selected, glow }: Props) {
  const dim = size === "sm" ? "w-9 h-16" : "w-11 h-20";
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!onClick}
      className={`bone-face ${dim} rounded-md p-1 flex ${vertical ? "flex-col" : "flex-row"} gap-1 shrink-0
        border border-wood-900/40 transition-all duration-100
        ${onClick ? "cursor-pointer hover:-translate-y-1" : "cursor-default"}
        ${selected ? "-translate-y-2 ring-2 ring-gold-400" : ""}
        ${glow ? "ring-2 ring-gold-400 animate-pulseGold" : ""}`}
    >
      <Half n={bone.a} />
      <div className={`${vertical ? "h-px" : "w-px"} bg-wood-900/40 shrink-0`} />
      <Half n={bone.b} />
    </button>
  );
}

export function DominoBoneBack({ size = "sm" }: { size?: "sm" | "md" }) {
  const dim = size === "sm" ? "w-7 h-12" : "w-9 h-16";
  return (
    <div
      className={`tile-back ${dim} rounded-md shrink-0 border border-wood-900/60`}
      style={{
        background:
          "repeating-linear-gradient(45deg, rgba(232,193,90,.12) 0 2px, transparent 2px 5px), linear-gradient(160deg,#5f3d2c,#241610)",
      }}
    />
  );
}
