"use client";

export default function PlayPage() {
  return (
    <div className="relative flex flex-col items-center justify-start min-h-screen bg-[#FFA94D] overflow-hidden">
      {/* Decorative corner triangles */}
      <div className="absolute top-0 left-0 w-0 h-0 border-t-[80px] border-t-white border-r-[80px] border-r-transparent"></div>
      <div className="absolute top-0 right-0 w-0 h-0 border-t-[80px] border-t-white border-l-[80px] border-l-transparent"></div>
      <div className="absolute bottom-0 left-0 w-0 h-0 border-b-[80px] border-b-white border-r-[80px] border-r-transparent"></div>
      <div className="absolute bottom-0 right-0 w-0 h-0 border-b-[80px] border-b-white border-l-[80px] border-l-transparent"></div>

      {/* Main Header */}
      <h1 className="text-white text-[64px] font-extrabold mt-20 text-center">
        Make Sure You're Centered
      </h1>

      {/* Subheader / instruction */}
      <p className="text-white text-2xl mt-4 mb-16 text-center max-w-2xl">
        Stand back from the camera so your full body is visible. Once you're
        centered, we’ll guide you into the game.
      </p>

      {/* Placeholder for camera */}
      <div className="w-[80%] max-w-[800px] h-[450px] bg-white rounded-2xl shadow-lg border-4 border-[#FFA94D] flex items-center justify-center text-[#FFA94D] text-2xl font-semibold">
        Camera Feed Placeholder
      </div>
    </div>
  );
}
