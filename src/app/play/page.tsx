"use client";

import { useEffect, useRef, useState } from "react";
import {
  FilesetResolver,
  PoseLandmarker,
  DrawingUtils,
  type PoseLandmarkerResult,
} from "@mediapipe/tasks-vision";

export default function PlayPage() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const [status, setStatus] = useState("Allow camera…");

  useEffect(() => {
    let stream: MediaStream | null = null;
    let landmarker: PoseLandmarker | null = null;
    let raf = 0;

    (async () => {
      try {
        // 1) Camera
        stream = await navigator.mediaDevices.getUserMedia({
          video: {
            width: { ideal: 1280 },
            height: { ideal: 720 },
            facingMode: "user",
          },
          audio: false,
        });

        const v = videoRef.current!;
        v.srcObject = stream;

        await new Promise<void>((res) =>
          v.addEventListener("loadedmetadata", () => res(), { once: true })
        );
        v.muted = true;
        await v.play().catch(() => {});
        setStatus("Loading model…");

        // 2) MediaPipe Pose init
        const vision = await FilesetResolver.forVisionTasks("/wasm");
        landmarker = await PoseLandmarker.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath: "/models/pose_landmarker_full.task",
            delegate: "GPU",
          },
          runningMode: "VIDEO",
          numPoses: 1,
        });
        setStatus(""); // ready

        // 3) Overlay loop (draw landmarks on the transparent canvas)
        const c = canvasRef.current!;
        const ctx = c.getContext("2d")!;
        const draw = new DrawingUtils(ctx);

        // match canvas pixels to the actual video resolution (once; CSS handles fit)
        c.width = v.videoWidth || 640;
        c.height = v.videoHeight || 360;

        const loop = () => {
          if (!landmarker) return;

          ctx.clearRect(0, 0, c.width, c.height);

          landmarker.detectForVideo(
            v,
            performance.now(),
            (res: PoseLandmarkerResult) => {
              if (res.landmarks) {
                for (const lm of res.landmarks) {
                  draw.drawLandmarks(lm);
                  draw.drawConnectors(lm, PoseLandmarker.POSE_CONNECTIONS);
                }
              }
            }
          );

          raf = requestAnimationFrame(loop);
        };
        raf = requestAnimationFrame(loop);
      } catch (e: any) {
        setStatus(e?.message ?? "Camera or model error");
        console.error(e);
      }
    })();

    return () => {
      cancelAnimationFrame(raf);
      landmarker?.close();
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  return (
    <div className="relative flex flex-col items-center justify-start min-h-screen bg-[#FFA94D] overflow-hidden">
      {/* Decorative corner triangles */}
      <div className="absolute top-0 left-0 w-0 h-0 border-t-[80px] border-t-white border-r-[80px] border-r-transparent" />
      <div className="absolute top-0 right-0 w-0 h-0 border-t-[80px] border-t-white border-l-[80px] border-l-transparent" />
      <div className="absolute bottom-0 left-0 w-0 h-0 border-b-[80px] border-b-white border-r-[80px] border-r-transparent" />
      <div className="absolute bottom-0 right-0 w-0 h-0 border-b-[80px] border-b-white border-l-[80px] border-l-transparent" />

      {/* Main Header */}
      <h1 className="text-white text-[64px] font-extrabold mt-20 text-center">
        Make Sure You're Centered
      </h1>

      {/* Subheader / instruction */}
      <p className="text-white text-2xl mt-4 mb-16 text-center max-w-2xl">
        Stand back from the camera so your full body is visible. Once you're
        centered, we’ll guide you into the game.
      </p>

      {/* Camera card with video + transparent overlay */}
      <div className="relative w-[80%] max-w-[800px] h-[450px] rounded-2xl shadow-lg border-4 border-[#FFA94D] bg-white overflow-hidden">
        <video
          ref={videoRef}
          playsInline
          className="absolute inset-0 w-full h-full object-contain bg-black"
          style={{ transform: "scaleX(-1)" }} // mirror video
        />
        <canvas
          ref={canvasRef}
          className="absolute inset-0 w-full h-full pointer-events-none"
          style={{ transform: "scaleX(-1)" }} // mirror overlay to match video
        />
        {status && (
          <div className="absolute inset-0 grid place-items-center text-[#FFA94D] text-xl font-semibold">
            {status}
          </div>
        )}
      </div>
    </div>
  );
}
