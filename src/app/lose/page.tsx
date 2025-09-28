"use client";

import { Suspense } from "react";
import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

// Optional: disable static prerender for this route
export const dynamic = "force-dynamic";

const HIGH_SCORE_KEY = "pose-dodge-highscore-round";

export default function LosePage() {
  return (
    <Suspense fallback={<LoseFallback />}>
      <YouLostInner />
    </Suspense>
  );
}

function LoseFallback() {
  return (
    <div className="relative flex items-center justify-center min-h-screen bg-[#FFA94D] text-white">
      Loading…
    </div>
  );
}

function YouLostInner() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // Last run's rounds (from query string)
  const lastRound = useMemo(() => {
    const raw = searchParams.get("round");
    const n = Number(raw);
    return Number.isFinite(n) && n > 0 ? n : 0;
  }, [searchParams]);

  const [highRound, setHighRound] = useState<number>(0);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const stored = Number(localStorage.getItem(HIGH_SCORE_KEY) || "0");
      const nextHigh = Math.max(stored || 0, lastRound || 0);
      if (nextHigh !== stored)
        localStorage.setItem(HIGH_SCORE_KEY, String(nextHigh));
      setHighRound(nextHigh);
    } catch {
      setHighRound(lastRound || 0);
    }
  }, [lastRound]);

  const btnClass =
    "bg-transparent text-white text-3xl font-semibold px-16 py-5 rounded-xl border-4 border-white hover:bg-white/10 transition-all";

  return (
    <div className="relative flex flex-col items-center justify-center min-h-screen bg-[#FFA94D] overflow-hidden">
      {/* corners */}
      <div className="absolute top-0 left-0 w-0 h-0 border-t-[80px] border-t-white border-r-[80px] border-r-transparent" />
      <div className="absolute top-0 right-0 w-0 h-0 border-t-[80px] border-t-white border-l-[80px] border-l-transparent" />
      <div className="absolute bottom-0 left-0 w-0 h-0 border-b-[80px] border-b-white border-r-[80px] border-r-transparent" />
      <div className="absolute bottom-0 right-0 w-0 h-0 border-b-[80px] border-b-white border-l-[80px] border-l-transparent" />

      {/* Title */}
      <div className="bg-white px-12 py-4 rounded-2xl shadow-md mb-6 text-center">
        <h1 className="text-[96px] font-extrabold text-[#FFA94D] leading-none">
          GAME OVER
        </h1>
      </div>

      {/* Score panel */}
      <div className="w-[92%] max-w-[900px] mb-8">
        <div className="rounded-2xl border-4 border-white px-8 py-10 text-center shadow-xl">
          <div className="space-y-4 text-white font-extrabold text-2xl md:text-3xl leading-relaxed">
            <p>
              YOUR SCORE: {lastRound} {lastRound === 1 ? "ROUND" : "ROUNDS"}
            </p>
            <p>
              HIGH SCORE: {highRound} {highRound === 1 ? "ROUND" : "ROUNDS"}
            </p>
          </div>
        </div>
      </div>

      {/* Buttons */}
      <div className="flex flex-col sm:flex-row gap-6">
        <button onClick={() => router.push("/game")} className={btnClass}>
          Play Again
        </button>
        <button onClick={() => router.push("/")} className={btnClass}>
          Home
        </button>
      </div>
    </div>
  );
}
