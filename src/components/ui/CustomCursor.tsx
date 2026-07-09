"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Dezenter goldener Cursor-Begleiter (nur auf Geräten mit feinem Zeiger).
 * Ein kleiner Punkt folgt sofort, ein Ring zieht weich hinterher und
 * weitet sich über interaktiven Elementen. Der native Cursor bleibt sichtbar.
 * Kein React-State pro Frame: Positionen werden direkt am DOM gesetzt.
 */
export default function CustomCursor() {
  const dotRef = useRef<HTMLDivElement>(null);
  const ringRef = useRef<HTMLDivElement>(null);
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    // Nur Desktop-Zeiger, und Bewegungs-Empfindliche nicht belästigen
    const fine = window.matchMedia("(pointer: fine)").matches;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (!fine || reduced) return;
    setEnabled(true);
  }, []);

  useEffect(() => {
    if (!enabled) return;
    const dot = dotRef.current;
    const ring = ringRef.current;
    if (!dot || !ring) return;

    let x = -100;
    let y = -100;
    let rx = -100;
    let ry = -100;
    let raf = 0;
    let visible = false;
    let hot = false; // über interaktivem Element

    const loop = () => {
      // Ring zieht weich hinterher
      rx += (x - rx) * 0.16;
      ry += (y - ry) * 0.16;
      dot.style.transform = `translate(${x}px, ${y}px) translate(-50%, -50%)`;
      ring.style.transform = `translate(${rx}px, ${ry}px) translate(-50%, -50%) scale(${hot ? 1.7 : 1})`;
      raf = requestAnimationFrame(loop);
    };

    const show = () => {
      if (!visible) {
        visible = true;
        dot.style.opacity = "1";
        ring.style.opacity = "1";
      }
    };
    const hide = () => {
      visible = false;
      dot.style.opacity = "0";
      ring.style.opacity = "0";
    };

    const onMove = (e: PointerEvent) => {
      if (e.pointerType !== "mouse") return;
      x = e.clientX;
      y = e.clientY;
      show();
    };
    const onOver = (e: PointerEvent) => {
      const t = e.target as Element | null;
      hot = !!t?.closest(
        "a, button, input, select, textarea, label, [role='button'], canvas",
      );
    };

    document.addEventListener("pointermove", onMove, { passive: true });
    document.addEventListener("pointerover", onOver, { passive: true });
    document.documentElement.addEventListener("pointerleave", hide);
    raf = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(raf);
      document.removeEventListener("pointermove", onMove);
      document.removeEventListener("pointerover", onOver);
      document.documentElement.removeEventListener("pointerleave", hide);
    };
  }, [enabled]);

  if (!enabled) return null;

  return (
    <>
      <div
        ref={dotRef}
        aria-hidden="true"
        className="pointer-events-none fixed left-0 top-0 z-[70] h-1.5 w-1.5 rounded-full bg-gold opacity-0 transition-opacity duration-300"
      />
      <div
        ref={ringRef}
        aria-hidden="true"
        className="pointer-events-none fixed left-0 top-0 z-[70] h-9 w-9 rounded-full border border-gold/60 opacity-0 transition-opacity duration-300"
        style={{ transitionProperty: "opacity, transform" }}
      />
    </>
  );
}
