"use client";

import { useEffect, useRef } from "react";

/**
 * Feine goldene Fortschrittslinie am oberen Rand.
 * Läuft komplett ohne React-State: scaleX wird direkt am DOM gesetzt.
 */
export default function ScrollProgress() {
  const barRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const bar = barRef.current;
    if (!bar) return;

    // Direktes Update im Scroll-Handler: nur ein Style-Write, kein rAF nötig.
    const update = () => {
      const max = document.documentElement.scrollHeight - window.innerHeight;
      const p = max > 0 ? Math.min(window.scrollY / max, 1) : 0;
      bar.style.transform = `scaleX(${p})`;
    };

    update();
    window.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update, { passive: true });
    return () => {
      window.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
    };
  }, []);

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed inset-x-0 top-0 z-[55] h-[2px]"
    >
      <div
        ref={barRef}
        className="h-full w-full origin-left bg-gradient-to-r from-wine via-gold to-gold"
        style={{ transform: "scaleX(0)" }}
      />
    </div>
  );
}
