"use client";

import { useEffect, useRef, useState } from "react";

export default function PlayRound() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [round, setRound] = useState(1);
  const [lives, setLives] = useState(3);

  // ⏱️ Timer (seconds)
  const [elapsed, setElapsed] = useState(0);

  // Start camera
  useEffect(() => {
    async function enableCam() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "user" },
          audio: false,
        });
        if (videoRef.current) videoRef.current.srcObject = stream;
      } catch (e) {
        console.error("Camera error:", e);
      }
    }
    enableCam();
  }, []);

  // Start timer (increments every second)
  useEffect(() => {
    const id = setInterval(() => setElapsed((s) => s + 1), 1000);
    return () => clearInterval(id);
  }, []);

  // Format mm:ss
  const mm = String(Math.floor(elapsed / 60)).padStart(2, "0");
  const ss = String(elapsed % 60).padStart(2, "0");

  return (
    <div className="relative min-h-screen w-full bg-[#FFA94D] overflow-hidden flex flex-col items-center">
      {/* Decorative corner triangles (same as other screens) */}
      <div className="absolute top-0 left-0 w-0 h-0 border-t-[80px] border-t-white border-r-[80px] border-r-transparent" />
      <div className="absolute top-0 right-0 w-0 h-0 border-t-[80px] border-t-white border-l-[80px] border-l-transparent" />
      <div className="absolute bottom-0 left-0 w-0 h-0 border-b-[80px] border-b-white border-r-[80px] border-r-transparent" />
      <div className="absolute bottom-0 right-0 w-0 h-0 border-b-[80px] border-b-white border-l-[80px] border-l-transparent" />

      {/* CONTENT */}
      <div className="relative z-10 w-full max-w-7xl px-4 md:px-6 pt-6 pb-4 flex flex-col gap-6">
        {/* Top bar: Round badge + Timer + Lives */}
        <div className="w-full bg-white rounded-2xl shadow-md border-4 border-white flex items-center justify-between px-4 md:px-6 py-3">
          {/* Round */}
          <div className="flex items-center gap-3">
            <div className="rounded-full bg-[#FFA94D] border-4 border-white text-white font-extrabold px-5 py-2 text-xl leading-none">
              Round {round}
            </div>
          </div>

          {/* Timer (mm:ss) */}
          <div className="rounded-full bg-[#FFA94D] border-4 border-white text-white font-extrabold px-6 py-2 text-xl leading-none font-mono tracking-widest">
            {mm}:{ss}
          </div>

          {/* Lives */}
          <div className="flex items-center gap-3">
            <span className="text-[#FFA94D] font-extrabold text-xl">Lives</span>
            <div className="flex items-center gap-2">
              {Array.from({ length: 3 }).map((_, i) => (
                <span
                  key={i}
                  aria-label={i < lives ? "life full" : "life empty"}
                  className={`text-3xl leading-none ${
                    i < lives ? "text-red-500" : "text-red-300"
                  }`}
                >
                  ♥
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* Camera area: perfectly centered + large */}
        <div className="flex-1 grid place-items-center pb-6">
          <div className="w-[98%] md:w-[96%] max-w-[1600px] mx-auto">
            <div className="relative aspect-[16/11] rounded-2xl shadow-xl border-4 border-white bg-black overflow-hidden mx-auto">
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="absolute inset-0 w-full h-full object-cover transform -scale-x-100"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
