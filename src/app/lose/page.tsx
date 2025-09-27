"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

const HIGH_SCORE_KEY = "pose-dodge-highscore-round"; // numeric high score (best rounds)

export default function YouLost() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // Last run's rounds (from query string)
  const lastRound = useMemo(() => {
    const raw = searchParams.get("round");
    const n = Number(raw);
    return Number.isFinite(n) && n > 0 ? n : 0;
  }, [searchParams]);

  // Persisted high score (rounds)
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
      // Fallback if localStorage is blocked
      setHighRound(lastRound || 0);
    }
  }, [lastRound]);

  const btnClass =
    "bg-[#FFA94D] text-white text-3xl font-semibold px-16 py-5 rounded-xl border-4 border-white hover:bg-[#ff9e33] transition-all";

  return (
    <div className="relative flex flex-col items-center justify-center min-h-screen bg-[#FFA94D] overflow-hidden">
      {/* Decorative corner triangles (same as title page) */}
      <div className="absolute top-0 left-0 w-0 h-0 border-t-[80px] border-t-white border-r-[80px] border-r-transparent"></div>
      <div className="absolute top-0 right-0 w-0 h-0 border-t-[80px] border-t-white border-l-[80px] border-l-transparent"></div>
      <div className="absolute bottom-0 left-0 w-0 h-0 border-b-[80px] border-b-white border-r-[80px] border-r-transparent"></div>
      <div className="absolute bottom-0 right-0 w-0 h-0 border-b-[80px] border-b-white border-l-[80px] border-l-transparent"></div>

      {/* Title box */}
      <div className="bg-white px-12 py-4 rounded-2xl shadow-md mb-4 text-center">
        <h1 className="text-[96px] font-extrabold text-[#FFA94D] leading-none">
          YOU LOST
        </h1>

        {/* Last run (if present) */}
        {lastRound > 0 && (
          <p className="text-2xl font-semibold mt-4 text-gray-800">
            Rounds survived: {lastRound} {lastRound === 1 ? "round" : "rounds"}
          </p>
        )}

        {/* High score (always shown) */}
        <p className="text-2xl font-semibold mt-2 text-gray-800">
          Highscore: {highRound} {highRound === 1 ? "round" : "rounds"}
        </p>
      </div>

      {/* Buttons row (both match) */}
      <div className="flex flex-col sm:flex-row gap-6">
        <button onClick={() => router.push("/game")} className={btnClass}>
          Try Again
        </button>
        <button onClick={() => router.push("/")} className={btnClass}>
          Home
        </button>
      </div>
    </div>
  );
}
