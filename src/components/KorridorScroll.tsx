"use client";

import { useEffect, useRef } from "react";
import dynamic from "next/dynamic";

// Karte nur im Browser laden (WebGL/MapLibre, kein SSR)
const KorridorMapReal = dynamic(() => import("./KorridorMapReal"), {
  ssr: false,
});

/** Text-Schritte des Scroll-Kinos. Bereich = Scroll-Fortschritt [von, bis]. */
const STEPS: { from: number; to: number; title: string; sub: string }[] = [
  {
    from: 0.02,
    to: 0.3,
    title: "Direkt an der B207.",
    sub: "Die Bundesstraße liegt vor der Tür. Ihre Lkw rollen ohne Umweg.",
  },
  {
    from: 0.3,
    to: 0.5,
    title: "7 km zur A24, 40 km bis Hamburg.",
    sub: "Hafen, Flughafen und die Fachkräfte der Metropolregion in Reichweite.",
  },
  {
    from: 0.5,
    to: 0.78,
    title: "Lübeck und die Ostsee im Norden.",
    sub: "Über die B207 in 40 Minuten am zweitgrößten deutschen Ostseehafen.",
  },
  {
    from: 0.78,
    to: 1,
    title: "Das Tor nach Skandinavien.",
    sub: "Mit dem Fehmarnbelttunnel wird die Achse ab 2031 zur direkten Verbindung nach Kopenhagen.",
  },
];

/** Deckkraft eines Schritts abhängig vom Fortschritt (weiches Ein-/Ausblenden). */
function stepOpacity(p: number, from: number, to: number, last: boolean): number {
  const fadeIn = Math.min(Math.max((p - from) / 0.06, 0), 1);
  const fadeOut = last ? 1 : Math.min(Math.max((to - p) / 0.06, 0), 1);
  return Math.min(fadeIn, fadeOut);
}

/**
 * Gepinnte Story-Sektion "Die Achse": Beim Scrollen zeichnet die 3D-Karte
 * die Verkehrsrouten von Grabau nach Hamburg, Lübeck, Skandinavien und Berlin.
 * Fortschritt und Text-Deckkraft werden ohne React-State direkt gesetzt.
 */
export default function KorridorScroll() {
  const sectionRef = useRef<HTMLElement>(null);
  const progressRef = useRef(0);
  const stepRefs = useRef<(HTMLDivElement | null)[]>([]);
  const counterRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const section = sectionRef.current;
    if (!section) return;

    const update = () => {
      const rect = section.getBoundingClientRect();
      const vh = window.innerHeight;
      const total = rect.height - vh;
      const p = total > 0 ? Math.min(Math.max(-rect.top / total, 0), 1) : 0;
      progressRef.current = p;

      // Text-Schritte direkt am DOM steuern (keine Re-Renders)
      STEPS.forEach((s, i) => {
        const el = stepRefs.current[i];
        if (!el) return;
        const o = stepOpacity(p, s.from, s.to, i === STEPS.length - 1);
        el.style.opacity = String(o);
        el.style.transform = `translateY(${(1 - o) * 14}px)`;
        el.style.pointerEvents = o > 0.5 ? "auto" : "none";
      });

      if (counterRef.current) {
        counterRef.current.textContent = `${String(Math.min(Math.floor(p * 4) + 1, 4)).padStart(2, "0")} / 04`;
      }
    };
    // Direktes Update im Scroll-Handler: billig (nur wenige Style-Writes)
    // und funktioniert auch ohne laufendes requestAnimationFrame.
    update();
    window.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update, { passive: true });
    return () => {
      window.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
    };
  }, []);

  return (
    <section
      ref={sectionRef}
      aria-label="Die Verkehrsachse des Standorts, animierte Karte"
      className="relative h-[300vh] bg-night"
    >
      <div className="sticky top-0 h-screen overflow-hidden">
        {/* Echte Karte (MapLibre, markengefärbt) */}
        <KorridorMapReal progressRef={progressRef} />

        {/* Weiche Vignette für Lesbarkeit */}
        <div className="pointer-events-none absolute inset-0 z-[2] bg-gradient-to-t from-night via-transparent to-night/70" />

        {/* Kopfzeile */}
        <div className="absolute inset-x-0 top-0 z-[3] pt-24 md:pt-28">
          <div className="mx-auto flex max-w-7xl items-center justify-between px-5 md:px-8">
            <div className="flex items-center gap-3">
              <span className="h-px w-8 bg-gold" />
              <span className="eyebrow text-gold">Die Achse · Zum Scrollen</span>
            </div>
            <span
              ref={counterRef}
              className="numeral text-sm font-bold tracking-[0.2em] text-paper/50"
            >
              01 / 04
            </span>
          </div>
        </div>

        {/* Text-Schritte (überlagert, per Scroll ein- und ausgeblendet) */}
        <div className="absolute inset-x-0 bottom-0 z-[3] pb-16 md:pb-20">
          <div className="mx-auto max-w-7xl px-5 md:px-8">
            <div className="relative h-40 max-w-2xl md:h-36">
              {STEPS.map((s, i) => (
                <div
                  key={s.title}
                  ref={(el) => {
                    stepRefs.current[i] = el;
                  }}
                  className="absolute inset-x-0 bottom-0"
                  style={{ opacity: i === 0 ? 1 : 0 }}
                >
                  <h3 className="text-balance text-3xl font-bold leading-[1.05] text-paper sm:text-4xl md:text-[2.9rem]">
                    {s.title}
                  </h3>
                  <p className="mt-3 max-w-xl text-base leading-relaxed text-paper/70 md:text-lg">
                    {s.sub}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
