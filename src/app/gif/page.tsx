"use client";

import { useMemo } from "react";

export default function WarningGifScene() {
  // Palette
  const ORANGE = "#FFA94D";
  const RED = "#E52525";

  // Grid + timing
  const cols = 3;
  const rows = 3;
  const tileMs = 420;
  const staggerMs = 240;
  const holdBlackMs = 900;

  // Softer black blink just before blackout
  const blinkCount = 4;  // number of pulses
  const blinkMs = 180;   // duration of each pulse (ms)

  const tiles = cols * rows;

  // Snake order (includes center so orange under MOVE turns red too)
  const order = useMemo(() => {
    const seq: number[] = [];
    for (let r = 0; r < rows; r++) {
      const row = Array.from({ length: cols }, (_, c) => r * cols + c);
      if (r % 2 === 1) row.reverse();
      seq.push(...row);
    }
    return seq;
  }, [rows, cols]);

  // Timings
  const fillDoneAt = (tiles - 1) * staggerMs + tileMs;
  const blinkTotal = blinkCount * blinkMs;
  const totalMs = useMemo(
    () => fillDoneAt + blinkTotal + holdBlackMs,
    [fillDoneAt, blinkTotal, holdBlackMs]
  );

  // center index for subtle style tweak (no outline)
  const centerIndex = Math.floor(rows / 2) * cols + Math.floor(cols / 2);

  return (
    <div
      className="relative w-full h-[70vh] max-w-5xl mx-auto overflow-hidden rounded-2xl border-8 border-white shadow-2xl"
      style={{
        backgroundColor: ORANGE,
        // loop window
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

      {/* 3×3 red fill grid — UNDER the text */}
      <div
        className="absolute inset-0 grid z-10"
        style={{
          gridTemplateColumns: `repeat(${cols}, 1fr)`,
          gridTemplateRows: `repeat(${rows}, 1fr)`,
        }}
      >
        {order.map((id, i) => {
          const delay = i * staggerMs;
          const isCenter = id === centerIndex;
          return (
            <div
              key={id}
              className="relative"
              style={{
                background: RED,
                opacity: 0,
                outline: isCenter ? "none" : "1px solid rgba(0,0,0,0.08)",
                willChange: "opacity, transform",
                // Longhand animation props
                animationName: "tileFill",
                animationDuration: `${tileMs}ms`,
                animationFillMode: "forwards",
                animationDelay: `${delay}ms`,
                animationTimingFunction: "cubic-bezier(0.22, 0.61, 0.36, 1)",
                animationIterationCount: 1,
              }}
            />
          );
        })}
      </div>

      {/* MOVE word (white, NO box) — ABOVE grid, BELOW blink/blackout */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-20">
        <h1
          className="text-[96px] leading-none font-extrabold"
          style={{
            color: "#FFFFFF",
            textShadow:
              "0 1px 0 rgba(0,0,0,0.12), 0 4px 24px rgba(0,0,0,0.18)",
          }}
        >
          MOVE
        </h1>
      </div>

      {/* Softer BLACK blink — ABOVE grid, UNDER text */}
      <div
        className="pointer-events-none absolute inset-0 z-[15] bg-black"
        style={{
          opacity: 0,
          willChange: "opacity",
          animationName: "blackPulse",
          animationDuration: `${blinkMs}ms`,
          animationIterationCount: blinkCount,
          animationTimingFunction: "ease-in-out",
          animationFillMode: "none",
          animationDelay: `${fillDoneAt}ms`,
        }}
      />

      {/* Final blackout — TOPMOST */}
      <div
        className="pointer-events-none absolute inset-0 bg-black z-30"
        style={{
          opacity: 0,
          willChange: "opacity",
          animationName: "blackHold",
          animationDuration: `${holdBlackMs}ms`,
          animationFillMode: "forwards",
          animationDelay: `${fillDoneAt + blinkTotal}ms`,
          animationTimingFunction: "ease",
          animationIterationCount: 1,
        }}
      />

      <style jsx>{`
        @keyframes tileFill {
          0%   { opacity: 0; transform: scale(0.985); }
          60%  { opacity: 1; transform: scale(1.008); }
          100% { opacity: 1; transform: scale(1); }
        }
        /* softer black pulse (peak ~0.22 opacity) */
        @keyframes blackPulse {
          0%   { opacity: 0; }
          45%  { opacity: 0.22; }
          100% { opacity: 0; }
        }
        @keyframes blackHold {
          0%   { opacity: 0; }
          18%  { opacity: 1; }
          100% { opacity: 1; }
        }
        @keyframes sceneLoop {
          0% {}
          100% {}
        }
      `}</style>
    </div>
  );
}
