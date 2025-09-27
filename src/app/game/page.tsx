"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  FilesetResolver,
  PoseLandmarker,
  type PoseLandmarkerResult,
} from "@mediapipe/tasks-vision";

/**
 * Game page:
 * - 3x3 grid overlayed on camera
 * - 2 warning zones spawn (yellow) for WARNING_MS, then turn active (red) for ACTIVE_MS
 * - If any pose landmark is inside an active red zone -> lose a life
 * - After active period, new 2 warnings spawn immediately
 * - Start with 3 lives, redirect to /lose when lives <= 0
 */

// tuning
const GRID_SIZE = 3;
const STARTING_LIVES = 3;
const WARNING_MS = 5000; // ms that warning appears before turning active
const ACTIVE_MS = 800; // ms active red stays visible (and collision is checked)
const CANVAS_HEIGHT = 720;
const CANVAS_WIDTH = 1280;

function pickTwoDistinct(prev: number[] | null = null) {
  const all = Array.from({ length: GRID_SIZE * GRID_SIZE }, (_, i) => i);
  const out = new Set<number>();
  while (out.size < 2) {
    const idx = all[(Math.random() * all.length) | 0];
    // avoid picking previous ones if possible
    if (prev && prev.length < all.length - 1 && prev.includes(idx)) continue;
    out.add(idx);
  }
  return Array.from(out);
}

function formatTime(ms: number) {
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${String(m).padStart(2, "0")}:${String(r).padStart(2, "0")}`;
}

export default function GamePage() {
  const router = useRouter();

  // refs for media/pose
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const landmarkerRef = useRef<PoseLandmarker | null>(null);

  // HUD state
  const [lives, setLives] = useState(STARTING_LIVES);
  const livesRef = useRef(STARTING_LIVES);
  useEffect(() => { livesRef.current = lives; }, [lives]);

  const [elapsedMs, setElapsedMs] = useState(0);
  const elapsedRef = useRef(0);
  useEffect(() => { elapsedRef.current = elapsedMs; }, [elapsedMs]);

  // zone state kept in refs for speed
  type Zone = { idx: number; startedAt: number; state: "warn" | "active" };
  const zonesRef = useRef<Zone[]>([]); // currently visible zones (2 items)
  const lastLandmarks = useRef<Array<{ x: number; y: number }> | null>(null);

  const rafRef = useRef<number | null>(null);
  const lastFrame = useRef<number | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // start with two warnings
  useEffect(() => {
    zonesRef.current = pickTwoDistinct(null).map((idx) => ({
      idx,
      startedAt: performance.now(),
      state: "warn" as const,
    }));
  }, []);

  useEffect(() => {
    let cancelled = false;

    const start = async () => {
      try {
        // camera
        const s = await navigator.mediaDevices.getUserMedia({
          video: { width: CANVAS_WIDTH, height: CANVAS_HEIGHT, facingMode: "user" },
          audio: false,
        });
        streamRef.current = s;
        const v = videoRef.current!;
        v.srcObject = s;
        await new Promise<void>((res) => v.addEventListener("loadedmetadata", () => res(), { once: true }));
        v.muted = true;
        await v.play().catch(() => {});

        // mediapipe model
        const vision = await FilesetResolver.forVisionTasks("/wasm");
        const landmarker = await PoseLandmarker.createFromOptions(vision, {
          baseOptions: { modelAssetPath: "/models/pose_landmarker_full.task", delegate: "GPU" },
          runningMode: "VIDEO",
          numPoses: 1,
        });
        landmarkerRef.current = landmarker;

        // canvas sizing
        const c = canvasRef.current!;
        const ctx = c.getContext("2d")!;
        // set canvas natural size to video resolution (CSS will scale)
        c.width = v.videoWidth || CANVAS_WIDTH;
        c.height = v.videoHeight || CANVAS_HEIGHT;

        lastFrame.current = performance.now();

        // helper: get cell rect for a 0-based idx
        const cellRect = (idx: number) => {
          const W = c.width;
          const H = c.height;
          const cellW = W / GRID_SIZE;
          const cellH = H / GRID_SIZE;
          const row = Math.floor(idx / GRID_SIZE);
          const col = idx % GRID_SIZE;
          return { x: col * cellW, y: row * cellH, w: cellW, h: cellH };
        };

        // draw helpers
        const drawGrid = () => {
          ctx.save();
          ctx.strokeStyle = "rgba(255,255,255,0.28)";
          ctx.lineWidth = 2;
          for (let i = 1; i < GRID_SIZE; i++) {
            const x = (i * c.width) / GRID_SIZE;
            const y = (i * c.height) / GRID_SIZE;
            ctx.beginPath();
            ctx.moveTo(x, 0); ctx.lineTo(x, c.height); ctx.stroke();
            ctx.beginPath();
            ctx.moveTo(0, y); ctx.lineTo(c.width, y); ctx.stroke();
          }
          ctx.restore();
        };

        const drawWarning = (idx: number) => {
          const r = cellRect(idx);
          ctx.save();
          ctx.fillStyle = "rgba(255,215,0,0.28)"; // yellow
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
          ctx.fillStyle = "rgba(244,67,54,0.55)"; // red
          ctx.fillRect(r.x, r.y, r.w, r.h);
          ctx.restore();
        };

        const drawLandmarks = (lm: Array<{ x: number; y: number }>) => {
          ctx.save();
          ctx.fillStyle = "rgba(0,200,150,0.95)";
          for (const p of lm) {
            ctx.beginPath();
            ctx.arc(p.x * c.width, p.y * c.height, Math.max(2, c.width * 0.007), 0, Math.PI * 2);
            ctx.fill();
          }
          ctx.restore();
        };

        // main loop
        const loop = (timeNow: number) => {
          if (cancelled) return;
          const now = timeNow || performance.now();
          const last = lastFrame.current ?? now;
          const dt = (now - last) / 1000;
          lastFrame.current = now;

          // draw mirrored video background
          ctx.save();
          ctx.clearRect(0, 0, c.width, c.height);
          ctx.translate(c.width, 0);
          ctx.scale(-1, 1);
          ctx.drawImage(v, 0, 0, c.width, c.height);
          ctx.restore();

          // pose detection (if model ready)
          const lmLocal = landmarkerRef.current;
          if (lmLocal) {
            // detectForVideo with callback; store simplified landmarks mirrored in X
            lmLocal.detectForVideo(v, now, (res: PoseLandmarkerResult) => {
              const kps = res.landmarks?.[0];
              if (kps) {
                lastLandmarks.current = kps.map((p) => ({ x: 1 - p.x, y: p.y })); // mirror x to match drawn image
              } else {
                lastLandmarks.current = null;
              }
            });
          }

          // draw grid overlay on top of video
          drawGrid();

          // handle zones: render warnings or active, manage transitions
          const zones = zonesRef.current;
          if (zones.length === 0) {
            // initialize if empty (unlikely because we pre-seeded)
            zonesRef.current = pickTwoDistinct(null).map((idx) => ({ idx, startedAt: now, state: "warn" }));
          } else {
            // For each zone determine state by time
            for (let i = 0; i < zones.length; i++) {
              const z = zones[i];
              const elapsed = now - z.startedAt;
              if (z.state === "warn") {
                if (elapsed >= WARNING_MS) {
                  // move to active
                  z.state = "active";
                  z.startedAt = now; // reset timestamp for active display
                  // check collision immediately at activation
                  const lmArr = lastLandmarks.current;
                  let hit = false;
                  if (lmArr && lmArr.length > 0) {
                    const rect = cellRect(z.idx);
                    for (const p of lmArr) {
                      const px = p.x * c.width;
                      const py = p.y * c.height;
                      if (px >= rect.x && px <= rect.x + rect.w && py >= rect.y && py <= rect.y + rect.h) {
                        hit = true;
                        break;
                      }
                    }
                  }
                  if (hit) {
                    // lose life
                    setLives((prev) => {
                      const n = Math.max(0, prev - 1);
                      livesRef.current = n;
                      return n;
                    });
                  }
                } else {
                  // still warning draw
                  drawWarning(z.idx);
                }
              }
              // active draw (if now in active window)
              if (z.state === "active") {
                drawActive(z.idx);
                // if active time elapsed, we will spawn new warnings (handled below)
              }
            }

            // After drawing all, check if any active zone has exceeded ACTIVE_MS, then advance
            const anyActive = zones.some((z) => z.state === "active");
            if (anyActive) {
              // if every active zone has been active for >= ACTIVE_MS, OR when we find any active zone older than ACTIVE_MS, we advance
              const oldestActive = zones.find((z) => z.state === "active" && (now - z.startedAt >= ACTIVE_MS));
              if (oldestActive) {
                // spawn fresh warnings immediately (replace zones)
                const prevIdxs = zones.map((z) => z.idx);
                zonesRef.current = pickTwoDistinct(prevIdxs).map((idx) => ({ idx, startedAt: now, state: "warn" }));
              }
            }
          }

          // draw landmarks last so they're on top
          if (lastLandmarks.current) drawLandmarks(lastLandmarks.current);

          // update elapsed timer
          setElapsedMs((t) => {
            const newT = t + dt * 1000;
            elapsedRef.current = newT;
            return newT;
          });

          // check lives -> redirect if zero
          if (livesRef.current <= 0) {
            // short delay so user sees last red
            setTimeout(() => router.push("/lose"), 200);
            return; // don't request another frame
          }

          rafRef.current = requestAnimationFrame(loop);
        };

        rafRef.current = requestAnimationFrame(loop);
      } catch (err: any) {
        console.error("game start error:", err);
      }
    };

    start();

    return () => {
      cancelled = true;
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
      landmarkerRef.current?.close();
      if (streamRef.current) streamRef.current.getTracks().forEach((t) => t.stop());
    };
  }, [router]);

  // render HUD + canvas
  return (
    <div className="min-h-screen flex flex-col items-center bg-[#FFA94D]">
      {/* HUD */}
      <div className="w-[95%] max-w-[1200px] mt-6 p-3 rounded-2xl bg-white/90 flex items-center justify-between">
        <div className="font-bold">Round: —</div>
        <div className="font-mono">{formatTime(elapsedMs)}</div>
        <div className="text-red-600 font-bold">Lives: {"❤".repeat(lives)}</div>
      </div>

      {/* Camera + canvas */}
      <div className="w-[95%] max-w-[1200px] mt-6 aspect-[16/9] rounded-2xl overflow-hidden relative shadow-lg border-4 border-[#FFA94D] bg-black">
        <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" />
        <video ref={videoRef} className="sr-only" playsInline muted />
      </div>
    </div>
  );
}
