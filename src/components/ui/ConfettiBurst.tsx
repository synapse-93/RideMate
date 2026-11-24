"use client";

import type { CSSProperties } from "react";

interface ConfettiBurstProps {
  active: boolean;
}

const PARTICLES: ReadonlyArray<{
  tx: string;
  ty: string;
  rot: string;
  color: string;
  delay: string;
}> = [
  { tx: "-44px", ty: "-42px", rot: "-140deg", color: "#FF5A26", delay: "0ms" },
  { tx: "-22px", ty: "-58px", rot: "120deg", color: "#15803D", delay: "30ms" },
  { tx: "0px", ty: "-64px", rot: "-95deg", color: "#F59E0B", delay: "15ms" },
  { tx: "24px", ty: "-56px", rot: "160deg", color: "#FF5A26", delay: "40ms" },
  { tx: "46px", ty: "-40px", rot: "-180deg", color: "#0EA5E9", delay: "20ms" },
  { tx: "-54px", ty: "-14px", rot: "130deg", color: "#F59E0B", delay: "50ms" },
  { tx: "54px", ty: "-16px", rot: "-115deg", color: "#15803D", delay: "35ms" },
  { tx: "10px", ty: "-46px", rot: "200deg", color: "#EC4899", delay: "25ms" },
];

export function ConfettiBurst({ active }: ConfettiBurstProps) {
  if (!active) return null;

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed inset-x-0 bottom-24 z-50 flex justify-center"
    >
      <div className="relative h-2 w-2">
        {PARTICLES.map((p, idx) => {
          const style: CSSProperties & {
            "--tx": string;
            "--ty": string;
            "--rot": string;
          } = {
            backgroundColor: p.color,
            animationDelay: p.delay,
            "--tx": p.tx,
            "--ty": p.ty,
            "--rot": p.rot,
          };
          return (
            <span
              key={idx}
              style={style}
              className="confetti-particle absolute left-0 top-0 h-2.5 w-2.5 rounded-sm"
            />
          );
        })}
      </div>
    </div>
  );
}
