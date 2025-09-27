"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  FilesetResolver,
  PoseLandmarker,
  type PoseLandmarkerResult,
} from "@mediapipe/tasks-vision";

const GRID_SIZE = 3;
const STARTING_LIVES = 3;
const CANVAS_HEIGHT = 720;
const CANVAS_WIDTH = 1280;
const ACTIVE_MS = 800;

export default function GamePage() {
  const router = useRouter();

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const landmarkerRef = useRef<PoseLandmarker | null>(null);

  const [lives, setLives] = useState(STARTING_LIVES);
  const livesRef = useRef(STARTING_LIVES);
  useEffect(() => {
    livesRef.current = lives;
  }, [lives]);

  const [elapsedMs, setElapsedMs] = useState(0);
  const elapsedRef = useRef(0);
  useEffect(() => {
    elapsedRef.current = elapsedMs;
  }, [elapsedMs]);

  const [round, setRound] = useState(1);
  const roundRef = useRef(1);
  useEffect(() => {
    roundRef.current = round;
  }, [round]);

  type Zone = { idx: number; startedAt: number; state: "warn" | "active" };
  const zonesRef = useRef<Zone[]>([]);
  const lastLandmarks = useRef<Array<{ x: number; y: number }> | null>(null);

  const rafRef = useRef<number | null>(null);
  const lastFrame = useRef<number | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const pickZones = (num: number, prev: number[] | null = null) => {
    const all = Array.from({ length: GRID_SIZE * GRID_SIZE }, (_, i) => i);
    const out = new Set<number>();
    while (out.size < num) {
      const idx = all[(Math.random() * all.length) | 0];
      if (prev && prev.length < all.length - 1 && prev.includes(idx)) continue;
      out.add(idx);
    }
    return Array.from(out);
  };

  const formatTime = (ms: number) => {
    const s = Math.floor(ms / 1000);
    const m = Math.floor(s / 60);
    const r = s % 60;
    return `${String(m).padStart(2, "0")}:${String(r).padStart(2, "0")}`;
  };

  useEffect(() => {
    let cancelled = false;

    const start = async () => {
      try {
        const s = await navigator.mediaDevices.getUserMedia({
          video: {
            width: CANVAS_WIDTH,
            height: CANVAS_HEIGHT,
            facingMode: "user",
          },
          audio: false,
        });
        streamRef.current = s;
        const v = videoRef.current!;
        v.srcObject = s;
        await new Promise<void>((res) =>
          v.addEventListener("loadedmetadata", () => res(), { once: true })
        );
        v.muted = true;
        await v.play().catch(() => {});

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

        const c = canvasRef.current!;
        const ctx = c.getContext("2d")!;
        c.width = v.videoWidth || CANVAS_WIDTH;
        c.height = v.videoHeight || CANVAS_HEIGHT;

        lastFrame.current = performance.now();

        const cellRect = (idx: number) => {
          const W = c.width;
          const H = c.height;
          const cellW = W / GRID_SIZE;
          const cellH = H / GRID_SIZE;
          const row = Math.floor(idx / GRID_SIZE);
          const col = idx % GRID_SIZE;
          return { x: col * cellW, y: row * cellH, w: cellW, h: cellH };
        };

        const drawGrid = () => {
          ctx.save();
          ctx.strokeStyle = "rgba(255,255,255,0.28)";
          ctx.lineWidth = 2;
          for (let i = 1; i < GRID_SIZE; i++) {
            const x = (i * c.width) / GRID_SIZE;
            const y = (i * c.height) / GRID_SIZE;
            ctx.beginPath();
            ctx.moveTo(x, 0);
            ctx.lineTo(x, c.height);
            ctx.stroke();
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(c.width, y);
            ctx.stroke();
          }
          ctx.restore();
        };

        const drawWarning = (idx: number) => {
          const r = cellRect(idx);
          ctx.save();
          ctx.fillStyle = "rgba(255,215,0,0.28)";
          ctx.fillRect(r.x, r.y, r.w, r.h);
          ctx.fillStyle = "rgba(255,215,0,0.95)";
          ctx.font = `${Math.floor(r.h * 0.28)}px Arial`;
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.fillText("⚠️", r.x + r.w / 2, r.y + r.h / 2);
          ctx.restore();
        };

        const drawActive = (idx: number) => {
          const r = cellRect(idx);
          ctx.save();
          ctx.fillStyle = "rgba(244,67,54,0.55)";
          ctx.fillRect(r.x, r.y, r.w, r.h);
          ctx.restore();
        };

        const drawLandmarks = (lm: Array<{ x: number; y: number }>) => {
          ctx.save();
          ctx.fillStyle = "rgba(0,200,150,0.95)";
          for (const p of lm) {
            ctx.beginPath();
            ctx.arc(
              p.x * c.width,
              p.y * c.height,
              Math.max(2, c.width * 0.007),
              0,
              Math.PI * 2
            );
            ctx.fill();
          }
          ctx.restore();
        };

        // initial zones
        const initDangers = 2;
        zonesRef.current = pickZones(initDangers).map((idx) => ({
          idx,
          startedAt: performance.now(),
          state: "warn",
        }));

        const loop = (timeNow: number) => {
          if (cancelled) return;
          const now = timeNow || performance.now();
          const last = lastFrame.current ?? now;
          const dt = (now - last) / 1000;
          lastFrame.current = now;

          ctx.save();
          ctx.clearRect(0, 0, c.width, c.height);
          ctx.translate(c.width, 0);
          ctx.scale(-1, 1);
          ctx.drawImage(v, 0, 0, c.width, c.height);
          ctx.restore();

          const lmLocal = landmarkerRef.current;
          if (lmLocal) {
            lmLocal.detectForVideo(v, now, (res: PoseLandmarkerResult) => {
              const kps = res.landmarks?.[0];
              lastLandmarks.current = kps
                ? kps.map((p) => ({ x: 1 - p.x, y: p.y }))
                : null;
            });
          }

          drawGrid();

          // determine number of dangers and warning time based on round
          let numDangers = 2;
          let warningTime = 5000;
          if (roundRef.current >= 6 && roundRef.current <= 10) {
            numDangers = 3;
            warningTime = 4000;
          } else if (roundRef.current >= 11 && roundRef.current <= 15) {
            numDangers = 4;
            warningTime = 2000;
          }

          const zones = zonesRef.current;
          for (let i = 0; i < zones.length; i++) {
            const z = zones[i];
            const elapsed = now - z.startedAt;
            if (z.state === "warn") {
              if (elapsed >= warningTime) {
                z.state = "active";
                z.startedAt = now;

                // check collision
                const lmArr = lastLandmarks.current;
                let hit = false;
                if (lmArr) {
                  const rect = cellRect(z.idx);
                  for (const p of lmArr) {
                    const px = p.x * c.width;
                    const py = p.y * c.height;
                    if (
                      px >= rect.x &&
                      px <= rect.x + rect.w &&
                      py >= rect.y &&
                      py <= rect.y + rect.h
                    ) {
                      hit = true;
                      break;
                    }
                  }
                }
                if (hit) {
                  setLives((prev) => Math.max(0, prev - 1));
                  livesRef.current = Math.max(0, livesRef.current - 1);
                }
              } else {
                drawWarning(z.idx);
              }
            }
            if (z.state === "active") drawActive(z.idx);
          }

          // spawn next dangers if any active expired
          const anyActiveExpired = zones.some(
            (z) => z.state === "active" && now - z.startedAt >= ACTIVE_MS
          );
          if (anyActiveExpired) {
            const prevIdxs = zones.map((z) => z.idx);
            zonesRef.current = pickZones(numDangers, prevIdxs).map((idx) => ({
              idx,
              startedAt: now,
              state: "warn",
            }));
            setRound((r) => {
              roundRef.current = r + 1;
              return r + 1;
            });
          }

          if (lastLandmarks.current) drawLandmarks(lastLandmarks.current);

          setElapsedMs((t) => t + dt * 1000);

          if (livesRef.current <= 0) {
            setTimeout(() => router.push("/lose"), 200);
            return;
          }

          rafRef.current = requestAnimationFrame(loop);
        };

        rafRef.current = requestAnimationFrame(loop);
      } catch (err) {
        console.error(err);
      }
    };

    start();

    return () => {
      cancelled = true;
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
      landmarkerRef.current?.close();
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, [router]);

  return (
    <div className="min-h-screen flex flex-col items-center bg-[#FFA94D]">
      <div className="w-[95%] max-w-[1200px] mt-6 p-3 rounded-2xl bg-white/90 flex items-center justify-between">
        <div className="font-bold">Round: {round}</div>
        <div className="font-mono">{formatTime(elapsedMs)}</div>
        <div className="text-red-600 font-bold">Lives: {"❤".repeat(lives)}</div>
      </div>

      <div className="w-[95%] max-w-[1200px] mt-6 aspect-[16/9] rounded-2xl overflow-hidden relative shadow-lg border-4 border-[#FFA94D] bg-black">
        <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" />
        <video ref={videoRef} className="sr-only" playsInline muted />
      </div>
    </div>
  );
}
