"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

export default function InstructionsPage() {
  const router = useRouter();
  useEffect(() => { router.prefetch("/game"); }, [router]); // or "/center"

  const btn =
    "bg-[#FFA94D] text-white text-lg md:text-xl font-semibold px-8 md:px-10 py-3 md:py-4 rounded-xl border-4 border-white hover:bg-[#ff9e33] transition-all";

  return (
    <div className="relative flex flex-col items-center justify-center min-h-screen bg-[#FFA94D] overflow-hidden px-4">
      {/* corners */}
      <div className="absolute top-0 left-0 w-0 h-0 border-t-[80px] border-t-white border-r-[80px] border-r-transparent" />
      <div className="absolute top-0 right-0 w-0 h-0 border-t-[80px] border-t-white border-l-[80px] border-l-transparent" />
      <div className="absolute bottom-0 left-0 w-0 h-0 border-b-[80px] border-b-white border-r-[80px] border-r-transparent" />
      <div className="absolute bottom-0 right-0 w-0 h-0 border-b-[80px] border-b-white border-l-[80px] border-l-transparent" />

      {/* Title pill — same as Home */}
      <div className="bg-white px-8 md:px-12 py-3 md:py-4 rounded-2xl shadow-md mb-6 md:mb-8">
        <h1 className="text-[64px] md:text-[96px] font-extrabold text-[#FFA94D] leading-none">
          INSTRUCTIONS
        </h1>
      </div>

      {/* Compact centered copy (bold, one line each) */}
      <div className="w-full max-w-[820px] border-4 border-white rounded-2xl px-6 md:px-8 py-6 md:py-8 bg-transparent">
        <div className="text-white text-lg md:text-xl text-center leading-tight space-y-3">
          <p className="font-bold">Step out of any yellow cell before it turns red.</p>
          <p className="font-bold">Each red cell touching you costs 1 life (you have 3).</p>
          <p className="font-bold">Rounds speed up and add more cells (max 4).</p>
          <p className="font-bold">Dodge by stepping/leaning, jumping, or ducking.</p>
          <p className="font-bold">Have Fun and MOVE</p>
        </div>
      </div>

      {/* Buttons */}
      <div className="mt-6 md:mt-8 flex gap-3 md:gap-4">
        <button
          onClick={() => router.push("/")}
          className="bg-transparent text-white text-lg md:text-xl font-semibold px-8 py-3 rounded-xl border-4 border-white hover:bg-white/10 transition-all"
        >
          Back
        </button>
        <button onClick={() => router.push("/game")} className={btn}>
          Continue
        </button>
        {/* Or use router.push("/center") if you want the centering gate next */}
      </div>
    </div>
  );
}
