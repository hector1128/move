// src/app/page.tsx
"use client";
import { useRouter } from "next/navigation";

export default function Home() {
  const router = useRouter();

  return (
    <div className="relative flex flex-col items-center justify-center min-h-screen bg-[#FFA94D] overflow-hidden">
      {/* corners */}
      <div className="absolute top-0 left-0 w-0 h-0 border-t-[80px] border-t-white border-r-[80px] border-r-transparent" />
      <div className="absolute top-0 right-0 w-0 h-0 border-t-[80px] border-t-white border-l-[80px] border-l-transparent" />
      <div className="absolute bottom-0 left-0 w-0 h-0 border-b-[80px] border-b-white border-r-[80px] border-r-transparent" />
      <div className="absolute bottom-0 right-0 w-0 h-0 border-b-[80px] border-b-white border-l-[80px] border-l-transparent" />

      {/* Title box */}
      <div className="bg-white px-12 py-4 rounded-2xl shadow-md mb-20">
        <h1 className="text-[96px] font-extrabold text-[#FFA94D]">MOVE</h1>
      </div>

      {/* Start -> instructions */}
      <button
        onClick={() => router.push("/instructions")}
        className="bg-[#FFA94D] text-white text-3xl font-semibold px-20 py-6 rounded-xl border-4 border-white hover:bg-[#ff9e33] transition-all mt-8"
      >
        Start
      </button>
    </div>
  );
}