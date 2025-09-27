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
  const [status, setStatus] = useState("loading…");

  useEffect(() => {
    let running = true;
    let landmarker: PoseLandmarker | null = null;
    let raf = 0;

    (async () => {
      // 1) Camera
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 640, height: 360, facingMode: "user" },
        audio: false,
      });
      const v = videoRef.current!;
      v.srcObject = stream;
      await v.play();

      // 2) MediaPipe init
      setStatus("loading model…");
      const vision = await FilesetResolver.forVisionTasks("/wasm");
      landmarker = await PoseLandmarker.createFromOptions(vision, {
        baseOptions: {
          modelAssetPath: "/models/pose_landmarker_full.task",
          delegate: "GPU",
        },
        runningMode: "VIDEO",
        numPoses: 1,
      });
      setStatus("running");

      // 3) Draw loop
      const c = canvasRef.current!;
      const ctx = c.getContext("2d")!;
      c.width = v.videoWidth || 640;
      c.height = v.videoHeight || 360;
      const draw = new DrawingUtils(ctx);

      const loop = () => {
        if (!running || !landmarker) return;
        const ts = performance.now();
        landmarker.detectForVideo(v, ts, (res: PoseLandmarkerResult) => {
          ctx.clearRect(0, 0, c.width, c.height);
          for (const lm of res.landmarks ?? []) {
            draw.drawLandmarks(lm);
            draw.drawConnectors(lm, PoseLandmarker.POSE_CONNECTIONS);
          }
        });
        raf = requestAnimationFrame(loop);
      };
      raf = requestAnimationFrame(loop);
    })();

    return () => {
      running = false;
      cancelAnimationFrame(raf);
      landmarker?.close();
      const v = videoRef.current;
      (v?.srcObject as MediaStream | undefined)
        ?.getTracks()
        .forEach((t) => t.stop());
    };
  }, []);

  return (
    <main
      style={{
        display: "grid",
        placeItems: "center",
        height: "100vh",
        gap: 12,
      }}
    >
      <div>{status}</div>
      <video ref={videoRef} playsInline muted style={{ display: "none" }} />
      <canvas
        ref={canvasRef}
        style={{ background: "#000", width: 960, height: 540 }}
      />
    </main>
  );
}
