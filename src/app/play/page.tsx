"use client";

import { useEffect, useRef, useState } from "react";
import {
  FilesetResolver,
  PoseLandmarker,
  DrawingUtils,
  type PoseLandmarkerResult,
} from "@mediapipe/tasks-vision";
import { useRouter } from "next/navigation";

export default function PlayPage() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const router = useRouter();

  const [status, setStatus] = useState("Allow camera…");
  const [centeredTime, setCenteredTime] = useState(0);
  const [readyToNext, setReadyToNext] = useState(false);

  const CENTER_BOX = { x: 0.25, y: 0.2, width: 0.5, height: 0.6 }; // relative box
  const REQUIRED_SECONDS = 3;
  const STILLNESS_THRESHOLD = 10; // pixels/frame

  const lastPose = useRef<{ x: number; y: number }[] | null>(null);
  const landmarkerRef = useRef<PoseLandmarker | null>(null);

  useEffect(() => {
    let stream: MediaStream | null = null;
    let raf = 0;

    (async () => {
      try {
        // 1) Camera
        const v = videoRef.current!;
        stream = await navigator.mediaDevices.getUserMedia({
          video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: "user" },
          audio: false,
        });
        v.srcObject = stream;

        await new Promise<void>((res) =>
          v.addEventListener("loadedmetadata", () => res(), { once: true })
        );
        v.muted = true;
        await v.play().catch(() => {});
        setStatus("Loading model…");

        // 2) MediaPipe Pose init
        const vision = await FilesetResolver.forVisionTasks("/wasm");
        const landmarker = await PoseLandmarker.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath: "/models/pose_landmarker_full.task",
            delegate: "GPU",
          },
          runningMode: "VIDEO",
          numPoses: 1,
        });
        landmarkerRef.current = landmarker;
        setStatus("");

        const c = canvasRef.current!;
        const ctx = c.getContext("2d")!;
        const draw = new DrawingUtils(ctx);

        c.width = v.videoWidth || 640;
        c.height = v.videoHeight || 360;

        const loop = () => {
          if (!landmarkerRef.current) return;

          ctx.clearRect(0, 0, c.width, c.height);

          const boxX = CENTER_BOX.x * c.width;
          const boxY = CENTER_BOX.y * c.height;
          const boxW = CENTER_BOX.width * c.width;
          const boxH = CENTER_BOX.height * c.height;

          landmarkerRef.current.detectForVideo(
            v,
            performance.now(),
            (res: PoseLandmarkerResult) => {
              if (res.landmarks && res.landmarks.length > 0) {
                const lm = res.landmarks[0];

                // Draw skeleton
                draw.drawLandmarks(lm);
                draw.drawConnectors(lm, PoseLandmarker.POSE_CONNECTIONS);

                // Check if all key landmarks are inside the box
                const keyIndexes = [0, 11, 12, 23, 24, 25, 26, 27, 28];
                let inBox = true;
                const currentPose: { x: number; y: number }[] = [];

                for (const i of keyIndexes) {
                  const pt = lm[i];
                  const x = pt.x * c.width;
                  const y = pt.y * c.height;
                  currentPose.push({ x, y });
                  if (x < boxX || x > boxX + boxW || y < boxY || y > boxY + boxH) {
                    inBox = false;
                  }
                }

                // Check stillness
                let still = true;
                if (lastPose.current) {
                  for (let j = 0; j < keyIndexes.length; j++) {
                    const dx = currentPose[j].x - lastPose.current[j].x;
                    const dy = currentPose[j].y - lastPose.current[j].y;
                    const dist = Math.sqrt(dx * dx + dy * dy);
                    if (dist > STILLNESS_THRESHOLD) {
                      still = false;
                      break;
                    }
                  }
                }
                lastPose.current = currentPose;

                // Update timer
                if (inBox && still) {
                  setCenteredTime((prev) => {
                    const newTime = Math.min(prev + 1 / 60, REQUIRED_SECONDS);
                    if (newTime >= REQUIRED_SECONDS) setReadyToNext(true);
                    return newTime;
                  });
                } else {
                  setCenteredTime(0);
                  setReadyToNext(false);
                }

                // Draw semi-transparent green box if valid
                if (inBox && still) {
                  ctx.fillStyle = "rgba(0,255,0,0.2)";
                  ctx.fillRect(boxX, boxY, boxW, boxH);
                }

                // Draw white outline
                ctx.strokeStyle = "white";
                ctx.lineWidth = 4;
                ctx.strokeRect(boxX, boxY, boxW, boxH);

                // Countdown or COMPLETE text
                ctx.fillStyle = "white";
                ctx.font = "48px Arial";
                ctx.textAlign = "center";
                if (centeredTime < REQUIRED_SECONDS) {
                  ctx.fillText(
                    `${centeredTime.toFixed(1)}s`,
                    boxX + boxW / 2,
                    boxY + boxH / 2
                  );
                } else {
                  ctx.fillText("COMPLETE!", boxX + boxW / 2, boxY + boxH / 2);
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
      stream?.getTracks().forEach((t) => t.stop());
      landmarkerRef.current?.close();
    };
  }, [centeredTime]);

  return (
    <div className="relative flex flex-col items-center justify-start min-h-screen bg-[#FFA94D] overflow-hidden">
      {/* Corner triangles */}
      <div className="absolute top-0 left-0 w-0 h-0 border-t-[80px] border-t-white border-r-[80px] border-r-transparent" />
      <div className="absolute top-0 right-0 w-0 h-0 border-t-[80px] border-t-white border-l-[80px] border-l-transparent" />
      <div className="absolute bottom-0 left-0 w-0 h-0 border-b-[80px] border-b-white border-r-[80px] border-r-transparent" />
      <div className="absolute bottom-0 right-0 w-0 h-0 border-b-[80px] border-b-white border-l-[80px] border-l-transparent" />

      <h1 className="text-white text-[64px] font-extrabold mt-20 text-center">
        Make Sure You're Centered
      </h1>

      <p className="text-white text-2xl mt-4 mb-16 text-center max-w-2xl">
        Stand back from the camera so your full body is visible and hold still in
        the box for 3 seconds.
      </p>

      {/* Video + overlay */}
      <div className="relative w-[80%] max-w-[800px] h-[450px] rounded-2xl shadow-lg border-4 border-[#FFA94D] bg-white overflow-hidden">
        <video
          ref={videoRef}
          playsInline
          className="absolute inset-0 w-full h-full object-contain bg-black"
          style={{ transform: "scaleX(-1)" }}
        />
        <canvas
          ref={canvasRef}
          className="absolute inset-0 w-full h-full pointer-events-none"
          style={{ transform: "scaleX(-1)" }}
        />
        {status && (
          <div className="absolute inset-0 grid place-items-center text-[#FFA94D] text-xl font-semibold">
            {status}
          </div>
        )}

        {/* NEXT button */}
        {readyToNext && (
          <button
            onClick={() => router.push("/game")}
            className="absolute bottom-10 left-1/2 -translate-x-1/2 bg-white text-[#FFA94D] font-bold text-2xl px-8 py-4 rounded-lg shadow-lg hover:scale-105 transition"
          >
            NEXT
          </button>
        )}
      </div>
    </div>
  );
}
