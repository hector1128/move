"use client";

import { useEffect, useRef, useState } from "react";
import {
  FilesetResolver,
  PoseLandmarker,
  type PoseLandmarkerResult,
} from "@mediapipe/tasks-vision";

// ---------- helpers ----------
// clamp - turns pose coordinates to grid indices
function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}
// pickN - picks from either 1-9 to choose which obstacles will display
function pickN(from: number[], n: number) {
  const a = from.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = (Math.random() * (i + 1)) | 0;
    [a[i], a[j]] = [a[j], a[i]];
  }
  return new Set(a.slice(0, n));
}
// difficultyForRound - determine how many obstacles and how much time the obstacle will be there per round intervals
function difficultyForRound(round: number) {
  if (round <= 5) return { obstacles: 2, windowSec: 5 };
  if (round <= 10) return { obstacles: 3, windowSec: 4 };
  return { obstacles: 5, windowSec: 3 };
}
// formatTime - mm:ss for timer
function formatTime(ms: number) {
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${String(m).padStart(2, "0")}:${String(r).padStart(2, "0")}`;
}

// ---------- tuning ----------
const COUNTDOWN_HOLD_MS = 1200; // require ~1.2s in center column before countdown (less accidental starts)
const HIT_DWELL_MS = 600; // stay on an obstacle cell this long to lose a life
const HYST = 0.05; // 5% hysteresis on grid boundaries to reduce jitter

type PauseReason = "tracking" | "user" | "system" | "none";

// ---------- component ----------
export default function PlayPage() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const playerCellRef = useRef<number | null>(null);
  const latestColRef = useRef<number | null>(null); // still handy for countdown

  // UI state
  const [lives, setLives] = useState(3); // hearts
  const [round, setRound] = useState(1); // round count
  const [timerMs, setTimerMs] = useState(0); // elapsed timer
  const [status, setStatus] = useState("Allow camera…"); // status text
  const [countdownUI, setCountdownUI] = useState<number | null>(null); // screen countdown 3, 2, 1

  // Mirrors for loop (immutable across frames unless updated via setState)
  const roundRef = useRef(round);
  const livesRef = useRef(lives);
  useEffect(() => {
    roundRef.current = round;
  }, [round]);
  useEffect(() => {
    livesRef.current = lives;
  }, [lives]);

  // ---- state mirrors for ref-only flags (prevents stuck overlays / missed renders)
  const [poseOkUI, setPoseOkUI] = useState(false);
  const [pausedUI, setPausedUI] = useState(true);
  const [gameStartedUI, setGameStartedUI] = useState(false);

  const poseOK = useRef(false);
  const paused = useRef(true);
  const gameStarted = useRef(false);
  const pausedReasonRef = useRef<PauseReason>("system");

  const setPoseOk = (v: boolean) => {
    if (poseOkUI !== v) setPoseOkUI(v);
    poseOK.current = v;
  };
  const setPaused = (v: boolean, reason?: PauseReason) => {
    if (pausedUI !== v) setPausedUI(v);
    paused.current = v;
    pausedReasonRef.current = v ? reason ?? pausedReasonRef.current : "none";
  };
  const setGameStarted = (v: boolean) => {
    if (gameStartedUI !== v) setGameStartedUI(v);
    gameStarted.current = v;
  };

  // countdown in memory
  const countdown = useRef<number | null>(null);
  const prevCountdownInt = useRef<number | null>(null);

  // round window & obstacles
  const lastSpawnAt = useRef(0);
  const windowRemaining = useRef(0); // seconds remaining in current round window
  const obstacles = useRef<Set<number>>(new Set());
  const lastHitAt = useRef(0);

  // when you step onto an obstacle cell, we start a dwell timer. If you stay ≥ HIT_DWELL_MS, you lose a life.
  const violationStart = useRef<Map<number, number>>(new Map());

  // pose/runtime state
  const landmarkerRef = useRef<PoseLandmarker | null>(null);
  const hipsEMA = useRef<{ x: number | null; y: number | null }>({
    x: null,
    y: null,
  });
  const centerHoldMs = useRef(0);

  // stable grid indices with hysteresis
  const colRef = useRef<number | null>(null); // 0,1,2
  const rowRef = useRef<number | null>(null); // 0,1,2

  // ---------- ENGINE BOOT ----------
  useEffect(() => {
    let stream: MediaStream | null = null;
    let raf = 0;
    let lastT = performance.now();

    const start = async () => {
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

        // 2) Model
        const vision = await FilesetResolver.forVisionTasks("/wasm");
        const lm = await PoseLandmarker.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath: "/models/pose_landmarker_full.task",
            delegate: "GPU",
          },
          runningMode: "VIDEO",
          numPoses: 1,
        });
        landmarkerRef.current = lm;
        setStatus("");

        // 3) Canvas
        const c = canvasRef.current!;
        const ctx = c.getContext("2d")!;
        c.width = v.videoWidth || 640;
        c.height = v.videoHeight || 360;
        // creates grid lines
        const drawGrid = () => {
          const { width: W, height: H } = c;
          ctx.strokeStyle = "rgba(255,255,255,0.35)";
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(W / 3, 0);
          ctx.lineTo(W / 3, H);
          ctx.moveTo((2 * W) / 3, 0);
          ctx.lineTo((2 * W) / 3, H);
          ctx.moveTo(0, H / 3);
          ctx.lineTo(W, H / 3);
          ctx.moveTo(0, (2 * H) / 3);
          ctx.lineTo(W, (2 * H) / 3);
          ctx.stroke();
        };

        // fills a cell (1-9) with a color
        // 1 2 3
        // 4 5 6
        // 7 8 9
        const fillCell = (idx: number, color: string) => {
          const { width: W, height: H } = c;
          const r = Math.floor((idx - 1) / 3);
          const col = (idx - 1) % 3;
          const x = (col * W) / 3;
          const y = (r * H) / 3;
          ctx.fillStyle = color;
          ctx.fillRect(x, y, W / 3, H / 3);
        };

        const spawnObstacles = () => {
          // picks new obstacles every round
          if (livesRef.current <= 0) return; // do not progress after game over
          const { obstacles: n, windowSec } = difficultyForRound(
            roundRef.current
          );
          obstacles.current = pickN([1, 2, 3, 4, 5, 6, 7, 8, 9], n);
          windowRemaining.current = windowSec;
          lastSpawnAt.current = performance.now();
          violationStart.current.clear();
          // (visual cell highlight can remain; it's just player position)
        };

        const startCountdown = () => {
          countdown.current = 3; // seconds
          prevCountdownInt.current = null; // reset UI delta
          setCountdownUI(3);
          setPaused(true, "system");
        };

        // updates countdown timer each frame 3→2→1→GO
        const updateCountdown = (dt: number) => {
          if (countdown.current == null) return;
          countdown.current -= dt;

          const ui = Math.max(0, Math.ceil(countdown.current));
          if (ui !== prevCountdownInt.current) {
            prevCountdownInt.current = ui;
            setCountdownUI(countdown.current > 0 ? ui : null);
          }

          if (countdown.current <= 0) {
            countdown.current = null;
            setPaused(false);
            setGameStarted(true);
            setRound(1);
            roundRef.current = 1; // keep ref in sync
            setTimerMs(0);
            setLives(3);
            livesRef.current = 3;
            spawnObstacles();
          }
        };

        // checks if player is in an obstacle cell; holds for HIT_DWELL_MS before losing a life
        const checkCollision = (playerCell: number | null) => {
          if (playerCell == null || livesRef.current <= 0) return;
          const now = performance.now();

          if (obstacles.current.has(playerCell)) {
            if (!violationStart.current.has(playerCell)) {
              violationStart.current.set(playerCell, now);
            }
            const startedAt = violationStart.current.get(playerCell)!;

            // grace & cooldown windows reduce instant double-hits
            const spawnGrace = now - lastSpawnAt.current < 600;
            const hitCooldown = now - lastHitAt.current < 700;

            if (
              !spawnGrace &&
              !hitCooldown &&
              now - startedAt >= HIT_DWELL_MS
            ) {
              lastHitAt.current = now;
              violationStart.current.clear(); // don't chain-hit immediately
              setLives((L) => {
                const n = Math.max(0, L - 1);
                livesRef.current = n;
                return n;
              });
              // if lives hit 0, main loop will freeze progression
            }
          } else {
            // left obstacle cell: clear its dwell timer
            violationStart.current.delete(playerCell);
          }
        };

        // hysteresis mapping for columns/rows
        const gridFromXY = (ax: number, ay: number) => {
          const b1 = 1 / 3,
            b2 = 2 / 3;

          // COL
          let col = colRef.current;
          if (col == null) {
            col = clamp(Math.floor(ax * 3), 0, 2);
          } else {
            if (col === 0 && ax >= b1 + HYST) col = 1;
            else if (col === 2 && ax <= b2 - HYST) col = 1;
            else if (col === 1) {
              if (ax <= b1 - HYST) col = 0;
              else if (ax >= b2 + HYST) col = 2;
            }
          }
          colRef.current = col;

          // ROW
          let row = rowRef.current;
          if (row == null) {
            row = clamp(Math.floor(ay * 3), 0, 2);
          } else {
            if (row === 0 && ay >= b1 + HYST) row = 1;
            else if (row === 2 && ay <= b2 - HYST) row = 1;
            else if (row === 1) {
              if (ay <= b1 - HYST) row = 0;
              else if (ay >= b2 + HYST) row = 2;
            }
          }
          rowRef.current = row;

          const cell = row * 3 + col + 1;
          return { col, row, cell };
        };

        const loop = () => {
          const now = performance.now();
          const dt = (now - lastT) / 1000;
          lastT = now;

          // draw camera (mirrored)
          ctx.save();
          ctx.translate(c.width, 0);
          ctx.scale(-1, 1);
          ctx.drawImage(v, 0, 0, c.width, c.height);

          // pose
          let playerCell: number | null = null;
          const lmLocal = landmarkerRef.current;
          if (lmLocal) {
            lmLocal.detectForVideo(v, now, (res: PoseLandmarkerResult) => {
              const kps = res.landmarks?.[0];
              setPoseOk(!!kps);
              if (!kps) {
                // enter tracking pause if we lose pose while running
                if (gameStartedUI) setPaused(true, "tracking");
                return;
              }

              const hipL = kps[23],
                hipR = kps[24];
              let x = (hipL.x + hipR.x) / 2;
              const y = (hipL.y + hipR.y) / 2;

              // We mirror the canvas *and* flip x from the model so the grid and visuals align.
              x = 1 - x; // mirror to match canvas transform

              // smoothing
              const ax =
                hipsEMA.current.x == null
                  ? x
                  : hipsEMA.current.x * 0.7 + x * 0.3;
              const ay =
                hipsEMA.current.y == null
                  ? y
                  : hipsEMA.current.y * 0.7 + y * 0.3;
              hipsEMA.current = { x: ax, y: ay };

              const { col, cell } = gridFromXY(ax, ay);
              playerCellRef.current = cell;
              latestColRef.current = col;
              playerCell = cell; // keep local so same-frame collision checks still work

              // draw player cell (teal) using the last computed value
              const pc = playerCellRef.current;
              if (pc != null) {
                fillCell(pc, "rgba(0,220,190,0.22)");
              }

              // countdown trigger in center column
              if (!gameStartedUI && countdown.current == null) {
                if (col === 1) centerHoldMs.current += dt * 1000;
                else centerHoldMs.current = 0;
                if (centerHoldMs.current >= COUNTDOWN_HOLD_MS) {
                  startCountdown();
                }
              }

              // live collision check while running
              if (gameStartedUI && !pausedUI) {
                checkCollision(playerCell);
              }
            });
          }

          // obstacles + grid
          // draw obstacles; darken if currently dwelling on them
          obstacles.current.forEach((idx) => {
            const startedAt = violationStart.current.get(idx);
            if (startedAt != null) {
              // dark red while dwelling
              fillCell(idx, "rgba(176,0,32,0.55)");
            } else {
              // normal red
              fillCell(idx, "rgba(244,67,54,0.35)");
            }
          });

          drawGrid();
          ctx.restore();

          // ---- state machine ----
          if (livesRef.current <= 0) {
            // freeze game progression on game over
            if (!pausedUI) setPaused(true, "system");
          } else if (countdown.current != null) {
            updateCountdown(dt);
          } else if (gameStartedUI) {
            // auto-resume only if pause was caused by tracking loss and pose is OK
            if (
              pausedUI &&
              poseOkUI &&
              pausedReasonRef.current === "tracking"
            ) {
              setPaused(false);
            }

            if (!pausedUI) {
              setTimerMs((t) => (t + dt * 1000) | 0);

              // tick obstacle window
              windowRemaining.current -= dt;

              // spawn next set at end of window (only if alive)
              if (windowRemaining.current <= 0 && livesRef.current > 0) {
                setRound((r) => {
                  const nr = r + 1;
                  roundRef.current = nr;
                  return nr;
                });
                spawnObstacles();
              }
            }
          }

          raf = requestAnimationFrame(loop);
        };

        raf = requestAnimationFrame(loop);
      } catch (e: any) {
        setStatus(e?.message ?? "Camera/model error");
        console.error(e);
      }
    };

    start();
    return () => {
      cancelAnimationFrame(raf);
      landmarkerRef.current?.close();
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, [gameStartedUI, pausedUI, poseOkUI]); // re-subscribe to state mirrors used in loop guards

  // ---------- UI ----------
  return (
    <div className="relative flex flex-col items-center justify-start min-h-screen bg-[#FFA94D] overflow-hidden">
      {/* Decorative corners */}
      <div className="absolute top-0 left-0 w-0 h-0 border-t-[80px] border-t-white border-r-[80px] border-r-transparent" />
      <div className="absolute top-0 right-0 w-0 h-0 border-t-[80px] border-t-white border-l-[80px] border-l-transparent" />
      <div className="absolute bottom-0 left-0 w-0 h-0 border-b-[80px] border-b-white border-r-[80px] border-r-transparent" />
      <div className="absolute bottom-0 right-0 w-0 h-0 border-b-[80px] border-b-white border-l-[80px] border-l-transparent" />

      {/* HUD bar */}
      <div className="mt-6 w-[90%] max-w-[1100px] rounded-2xl bg-white/90 shadow p-4 flex items-center justify-between">
        <div className="px-4 py-1 rounded-full bg-[#FFA94D] text-white font-bold">
          Round {Math.max(1, round)}
        </div>
        <div className="px-4 py-1 rounded-full bg-[#FFA94D] text-white font-mono font-bold">
          Elapsed {formatTime(timerMs)}
        </div>
        <div className="text-[#FFA94D] font-bold text-lg">
          Lives{" "}
          <span className="text-red-500">
            {"❤".repeat(lives)}
            <span className="opacity-30">
              {"❤".repeat(Math.max(0, 3 - lives))}
            </span>
          </span>
        </div>
      </div>

      {/* Camera card */}
      <div className="relative w-[90%] max-w-[1100px] aspect-video rounded-2xl shadow-lg border-4 border-[#FFA94D] bg-white overflow-hidden mt-6">
        <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" />
        <video ref={videoRef} playsInline className="sr-only" />

        {/* overlays */}
        {status && (
          <div className="absolute inset-0 grid place-items-center text-[#FFA94D] text-xl font-semibold bg-white/0">
            {status}
          </div>
        )}

        {/* countdown */}
        {countdownUI !== null && (
          <div className="absolute inset-0 grid place-items-center">
            <div className="text-white text-[100px] font-extrabold drop-shadow-[0_4px_12px_rgba(0,0,0,0.5)]">
              {countdownUI}
            </div>
          </div>
        )}

        {/* pause / tracking / game over */}
        {((pausedUI && gameStartedUI && countdownUI === null) ||
          !poseOkUI ||
          lives <= 0) && (
          <div className="absolute inset-0 grid place-items-center">
            <div className="px-6 py-3 rounded-xl bg-black/55 text-white text-lg font-semibold">
              {lives <= 0
                ? "Game Over"
                : !poseOkUI
                ? "Tracking lost — step into frame"
                : "Paused"}
            </div>
          </div>
        )}
      </div>

      {/* instructions */}
      <p className="text-white mt-4 opacity-90">
        Hold the center column to start. Avoid red cells. Survive each window.
        Hips drive your cell.
      </p>
    </div>
  );
}
