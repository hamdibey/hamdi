import { useCallback, useRef } from "react";
import type { ReactNode } from "react";
import { useDesktop, type DesktopWindow } from "../../store/useDesktop";

const TASKBAR_H = 40;

/** Klasik Windows (XP/2000) pencere çerçevesi: sürüklenebilir, boyutlandırılabilir */
export function Win98Window({ win, children }: { win: DesktopWindow; children: ReactNode }) {
  const focus = useDesktop((s) => s.focus);
  const close = useDesktop((s) => s.close);
  const toggleMin = useDesktop((s) => s.toggleMin);
  const toggleMax = useDesktop((s) => s.toggleMax);
  const setPos = useDesktop((s) => s.setPos);
  const setSize = useDesktop((s) => s.setSize);
  const dragRef = useRef<{ dx: number; dy: number } | null>(null);
  const sizeRef = useRef<{ sx: number; sy: number; w: number; h: number } | null>(null);

  const onTitleDown = useCallback(
    (e: React.PointerEvent) => {
      if ((e.target as HTMLElement).closest("button")) return;
      focus(win.id);
      if (win.max) return;
      dragRef.current = { dx: e.clientX - win.x, dy: e.clientY - win.y };
      const move = (ev: PointerEvent) => {
        const d = dragRef.current;
        if (!d) return;
        const maxX = window.innerWidth - 90;
        const maxY = window.innerHeight - TASKBAR_H - 24;
        setPos(
          win.id,
          Math.min(Math.max(ev.clientX - d.dx, 90 - win.w), maxX),
          Math.min(Math.max(ev.clientY - d.dy, 0), maxY)
        );
      };
      const up = () => {
        dragRef.current = null;
        window.removeEventListener("pointermove", move);
        window.removeEventListener("pointerup", up);
      };
      window.addEventListener("pointermove", move);
      window.addEventListener("pointerup", up);
    },
    [focus, setPos, win.id, win.max, win.x, win.y, win.w]
  );

  const onGripDown = useCallback(
    (e: React.PointerEvent) => {
      e.stopPropagation();
      focus(win.id);
      sizeRef.current = { sx: e.clientX, sy: e.clientY, w: win.w, h: win.h };
      const move = (ev: PointerEvent) => {
        const s = sizeRef.current;
        if (!s) return;
        setSize(
          win.id,
          Math.max(360, s.w + ev.clientX - s.sx),
          Math.max(240, s.h + ev.clientY - s.sy)
        );
      };
      const up = () => {
        sizeRef.current = null;
        window.removeEventListener("pointermove", move);
        window.removeEventListener("pointerup", up);
      };
      window.addEventListener("pointermove", move);
      window.addEventListener("pointerup", up);
    },
    [focus, setSize, win.id, win.w, win.h]
  );

  if (win.min) return null;

  const style: React.CSSProperties = win.max
    ? { left: 0, top: 0, width: "100%", height: `calc(100% - ${TASKBAR_H}px)`, zIndex: win.z }
    : { left: win.x, top: win.y, width: win.w, height: win.h, zIndex: win.z };

  const btn =
    "w-[17px] h-[15px] flex items-center justify-center text-[9px] leading-none font-bold bg-[#d4d0c8] active:translate-y-px text-black";

  return (
    <div
      className="absolute flex flex-col bg-[#d4d0c8] select-none"
      style={{
        ...style,
        boxShadow:
          "inset -1px -1px 0 #0a0a0a, inset 1px 1px 0 #fff, inset -2px -2px 0 #808080, inset 2px 2px 0 #dfdfdf, 2px 3px 10px rgba(0,0,0,.45)",
      }}
      onPointerDown={() => focus(win.id)}
    >
      {/* Başlık çubuğu */}
      <div
        className="flex items-center gap-1.5 h-[24px] px-1 shrink-0 cursor-default"
        style={{ background: "linear-gradient(180deg,#3f8cf3 0%,#0a55c8 8%,#0b53c4 40%,#1c6ee4 88%,#2b7cf0 100%)" }}
        onPointerDown={onTitleDown}
        onDoubleClick={() => win.resizable && toggleMax(win.id)}
      >
        {win.icon.startsWith("/") ? (
          <img src={win.icon} alt="" className="w-[15px] h-[15px] object-cover rounded-[2px]" />
        ) : (
          <span className="text-[11px] leading-none">{win.icon}</span>
        )}
        <span className="text-white text-[11px] font-bold truncate flex-1" style={{ fontFamily: "Tahoma, sans-serif" }}>
          {win.title}
        </span>
        <div className="flex items-center gap-[2px]" onPointerDown={(e) => e.stopPropagation()}>
          <button className={btn} title="Küçült" onClick={() => toggleMin(win.id)}>
            <span className="translate-y-[2px]">_</span>
          </button>
          {win.resizable && (
            <button className={btn} title="Ekranı Kapla" onClick={() => toggleMax(win.id)}>
              ☐
            </button>
          )}
          <button
            className="w-[17px] h-[15px] flex items-center justify-center text-[9px] font-bold text-white active:translate-y-px"
            style={{ background: "linear-gradient(180deg,#f08a72 0%,#d13c1d 45%,#b02a10 100%)" }}
            title="Kapat"
            onClick={() => close(win.id)}
          >
            ✕
          </button>
        </div>
      </div>
      {/* İçerik */}
      <div className="flex-1 min-h-0 overflow-auto relative">{children}</div>
      {/* Boyutlandırma tutamağı */}
      {win.resizable && !win.max && (
        <div
          className="absolute right-0 bottom-0 w-4 h-4 cursor-nwse-resize"
          style={{
            background:
              "repeating-linear-gradient(135deg, transparent 0 2px, #fff 2px 3px, #808080 3px 4px, transparent 4px 6px)",
          }}
          onPointerDown={onGripDown}
        />
      )}
    </div>
  );
}
