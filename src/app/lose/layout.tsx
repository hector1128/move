// app/lose/layout.tsx  (no "use client" needed)
import { Suspense } from "react";

export default function LoseLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <Suspense
      fallback={
        <div className="relative flex items-center justify-center min-h-screen bg-[#FFA94D] text-white">
          Loading…
        </div>
      }
    >
      {children}
    </Suspense>
  );
}
