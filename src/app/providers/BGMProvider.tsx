// src/app/providers/BGMProvider.tsx
"use client";

import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

type TrackName = "menu" | "game" | null;

type BGMApi = {
  unlock: () => Promise<void>; // call once on user gesture
  fadeTo: (name: TrackName, ms?: number) => Promise<void>; // cross-fade
  duck: (on: boolean, ms?: number) => Promise<void>; // lower volume when paused
  playSfx: (url: string, vol?: number) => void; // one-shot SFX
};

const BGMContext = createContext<BGMApi | null>(null);
export function useBGM() {
  const ctx = useContext(BGMContext);
  if (!ctx) throw new Error("useBGM must be used inside <BGMProvider>");
  return ctx;
}

// helpers
const clamp01 = (x: number) => Math.max(0, Math.min(1, x));

export function BGMProvider({ children }: { children: React.ReactNode }) {
  const [unlocked, setUnlocked] = useState(false);
  const currentRef = useRef<TrackName>(null);
  const duckingRef = useRef(false);
  const baseVolRef = useRef(0.6); // base loudness
  const targetVolRef = useRef(0.6);

  // Create audio elements *only in the browser* after mount
  const menuRef = useRef<HTMLAudioElement | null>(null);
  const gameRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!menuRef.current) {
      const a = new Audio("/audio/menu.mp3");
      a.loop = true;
      a.preload = "auto";
      a.volume = 0;
      menuRef.current = a;
    }
    if (!gameRef.current) {
      const a = new Audio("/audio/game.mp3");
      a.loop = true;
      a.preload = "auto";
      a.volume = 0;
      gameRef.current = a;
    }
  }, []);

  async function unlock() {
    if (unlocked) return;
    // Must be called from a user gesture (click/tap)
    try {
      await Promise.all(
        [menuRef.current, gameRef.current].map(async (a) => {
          if (!a) return;
          try {
            await a.play(); // start silently (volume 0)
            a.pause();
            a.currentTime = 0;
          } catch {}
        })
      );
      setUnlocked(true);
    } catch {
      // ignore; can retry on next gesture
    }
  }

  function playSfx(url: string, vol = 0.8) {
    if (typeof window === "undefined") return;
    const a = new Audio(url);
    a.volume = clamp01(vol);
    void a.play();
  }

  function getEl(name: TrackName): HTMLAudioElement | null {
    if (name === "menu") return menuRef.current;
    if (name === "game") return gameRef.current;
    return null;
  }

  function rampVolume(audio: HTMLAudioElement, to: number, ms: number) {
    const from = clamp01(audio.volume ?? 0);
    const tgt = clamp01(to);
    if (ms <= 0) {
      audio.volume = tgt;
      return Promise.resolve();
    }
    const start = performance.now();
    return new Promise<void>((res) => {
      const tick = (t: number) => {
        const p = Math.min(1, (t - start) / ms);
        const v = from + (tgt - from) * p;
        audio.volume = clamp01(v); // <- CLAMP
        if (p < 1) requestAnimationFrame(tick);
        else res();
      };
      requestAnimationFrame(tick);
    });
  }

  async function fadeTo(name: TrackName, ms = 800) {
    if (!menuRef.current || !gameRef.current) return; // not mounted yet
    if (!unlocked) await unlock().catch(() => {});

    const curName = currentRef.current;
    const curEl = getEl(curName);
    const tgtEl = getEl(name);

    // compute target loudness with ducking applied
    targetVolRef.current = baseVolRef.current * (duckingRef.current ? 0.25 : 1);

    // start target if needed
    if (tgtEl && tgtEl.paused) {
      try {
        await tgtEl.play();
      } catch {}
    }

    const fades: Promise<void>[] = [];
    if (tgtEl) fades.push(rampVolume(tgtEl, targetVolRef.current, ms));
    if (curEl)
      fades.push(
        rampVolume(curEl, 0, ms).then(() => {
          curEl.pause();
        })
      );

    await Promise.all(fades);
    currentRef.current = name;
  }

  async function duck(on: boolean, ms = 400) {
    duckingRef.current = on;
    const cur = getEl(currentRef.current);
    if (!cur) return;
    const newVol = baseVolRef.current * (on ? 0.25 : 1);
    await rampVolume(cur, newVol, ms); // rampVolume clamps to [0,1]
  }

  const api: BGMApi = { unlock, fadeTo, duck, playSfx };
  return <BGMContext.Provider value={api}>{children}</BGMContext.Provider>;
}
