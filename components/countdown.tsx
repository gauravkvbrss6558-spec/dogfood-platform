"use client";

import { useEffect, useState } from "react";

// Apna deadline yahan change karo, ya .env me NEXT_PUBLIC_SUBMISSION_DEADLINE set karo
const DEADLINE = new Date(
  process.env.NEXT_PUBLIC_SUBMISSION_DEADLINE ?? "2026-10-15T18:00:00+05:30"
).getTime();

const pad = (n: number) => String(n).padStart(2, "0");

export default function Countdown({ className = "" }: { className?: string }) {
  // null = server render / first paint, taaki hydration mismatch na ho
  const [left, setLeft] = useState<number | null>(null);

  useEffect(() => {
    const tick = () => setLeft(Math.max(0, DEADLINE - Date.now()));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  if (left === 0) {
    return (
      <p className={`text-2xl font-bold ${className}`}>Submissions are closed.</p>
    );
  }

  const total = left === null ? null : Math.floor(left / 1000);
  const segments = [
    { label: "days", value: total === null ? "--" : pad(Math.floor(total / 86400)) },
    { label: "hours", value: total === null ? "--" : pad(Math.floor((total % 86400) / 3600)) },
    { label: "min", value: total === null ? "--" : pad(Math.floor((total % 3600) / 60)) },
    { label: "sec", value: total === null ? "--" : pad(total % 60) },
  ];

  return (
    <div role="timer" aria-live="off" className={`grid grid-cols-4 gap-2 sm:gap-3 ${className}`}>
      {segments.map((s) => (
        <div
          key={s.label}
          className="rounded-2xl bg-[#12163B] px-2 py-3 text-center sm:py-4"
        >
          <div className="text-3xl font-extrabold tabular-nums leading-none text-[#FFC933] sm:text-5xl">
            {s.value}
          </div>
          <div className="mt-2 text-xs font-medium text-[#E7E9F5]/70">{s.label}</div>
        </div>
      ))}
    </div>
  );
}
