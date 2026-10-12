"use client";

import confetti from "canvas-confetti";

/** A short confetti burst in the wedding's colors. Skipped for users who prefer reduced motion. */
export function celebrate(origin?: { x: number; y: number }) {
  if (typeof window === "undefined") return;
  const style = getComputedStyle(document.documentElement);
  const colors = [style.getPropertyValue("--brand"), style.getPropertyValue("--pop"), "#ffffff"]
    .map((c) => c.trim())
    .filter(Boolean);
  void confetti({
    particleCount: 70,
    spread: 70,
    startVelocity: 32,
    ticks: 160,
    scalar: 0.9,
    origin: origin ?? { x: 0.5, y: 0.35 },
    colors,
    disableForReducedMotion: true,
  });
}

/** Confetti from the element that was clicked. */
export function celebrateFrom(el: Element | null) {
  if (!el) return celebrate();
  const r = el.getBoundingClientRect();
  celebrate({ x: (r.left + r.width / 2) / window.innerWidth, y: (r.top + r.height / 2) / window.innerHeight });
}
