"use client";

import { useMemo } from "react";

export default function WarningGifScene() {
  // Palette (matches your MOVE cover)
  const ORANGE = "#FFA94D";
  const WHITE = "#FFFFFF";
  const RED = "#E52525";

  // Grid + timing (smooth pacing)
  const cols = 3;
  const rows = 3;
  const tileMs = 420;     // how long a tile takes to fill
  const staggerMs = 240;  // delay between starting each tile
  const holdBlackMs = 900;

  const tiles = cols * rows;

  // snake path for a pleasing fill
  const order = useMemo(() => {
    const o: number[] = [];
    for (let r = 0; r < rows; r++) {
      const row = Array.from({ length: cols }, (_, c) => r * cols + c);
      if (r % 2 === 1) row.reverse();
      o.push(...row);
    }
    return o;
  }, [cols, rows]);

  const fillDoneAt = (tiles - 1) * staggerMs + tileMs;
  const totalMs = useMemo(() => fillDoneAt + holdBlackMs, [fillDoneAt, holdBlackMs]);

  return (
    <div
      className="relative w-full h-[70vh] max-w-5xl mx-auto overflow-hidden rounded-2xl border-8 border-white shadow-2xl"
      style={{
        backgroundColor: ORANGE,
        // Longhand animation props (no shorthand)
        animationName: "sceneLoop",
        animationDuration: `${totalMs}ms`,
        animationTimingFunction: "linear",
        animationIterationCount: "infinite",
      }}
    >
      {/* MOVE cover corner triangles */}
      <div className="absolute top-0 left-0 w-0 h-0 border-t-[80px] border-t-white border-r-[80px] border-r-transparent" />
      <div className="absolute top-0 right-0 w-0 h-0 border-t-[80px] border-t-white border-l-[80px] border-l-transparent" />
      <div className="absolute bottom-0 left-0 w-0 h-0 border-b-[80px] border-b-white border-r-[80px] border-r-transparent" />
      <div className="absolute bottom-0 right-0 w-0 h-0 border-b-[80px] border-b-white border-l-[80px] border-l-transparent" />

      {/* Centered MOVE title box */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <div className="bg-white px-12 py-4 rounded-2xl shadow-md">
          <h1 className="text-[96px] leading-none font-extrabold" style={{ color: ORANGE }}>
            MOVE
          </h1>
        </div>
      </div>

      {/* 3×3 solid red fill grid */}
      <div
        className="absolute inset-0 grid"
        style={{
          gridTemplateColumns: `repeat(${cols}, 1fr)`,
          gridTemplateRows: `repeat(${rows}, 1fr)`,
        }}
      >
        {order.map((id, i) => {
          const delay = i * staggerMs;
          return (
            <div
              key={id}
              className="relative"
              style={{
                background: RED,
                opacity: 0,
                outline: "1px solid rgba(0,0,0,0.08)",
                willChange: "opacity, transform",
                // Longhand animation props
                animationName: "tileFill",
                animationDuration: `${tileMs}ms`,
                animationFillMode: "forwards",
                animationDelay: `${delay}ms`,
                animationTimingFunction: "cubic-bezier(0.22, 0.61, 0.36, 1)",
                animationIterationCount: 1 as any,
              }}
            />
          );
        })}
      </div>

      {/* Gentle blackout overlay (no flash) */}
      <div
        className="pointer-events-none absolute inset-0 bg-black"
        style={{
          opacity: 0,
          willChange: "opacity",
          // Longhand animation props
          animationName: "blackHold",
          animationDuration: `${holdBlackMs}ms`,
          animationFillMode: "forwards",
          animationDelay: `${fillDoneAt}ms`,
          animationTimingFunction: "ease",
          animationIterationCount: 1 as any,
        }}
      />

      {/* Keyframes */}
      <style jsx>{`
        @keyframes tileFill {
          0%   { opacity: 0; transform: scale(0.985); }
          60%  { opacity: 1; transform: scale(1.008); }
          100% { opacity: 1; transform: scale(1); }
        }
        @keyframes blackHold {
          0%   { opacity: 0; }
          18%  { opacity: 1; } /* quick but non-harsh fade to black */
          100% { opacity: 1; }
        }
        /* Defines the loop window for screen capture; does not change visuals */
        @keyframes sceneLoop {
          0% {}
          100% {}
        }
      `}</style>
    </div>
  );
}
