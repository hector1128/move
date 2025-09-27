"use client";

import { useRouter } from "next/navigation";

export default function YouLost() {
  const router = useRouter();

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
      <div className="bg-white px-12 py-4 rounded-2xl shadow-md mb-20">
        <h1 className="text-[96px] font-extrabold text-[#FFA94D] leading-none">
          YOU LOST
        </h1>
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
