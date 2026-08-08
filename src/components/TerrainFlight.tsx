"use client";

import { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import Image from "next/image";
import { ArrowRight } from "lucide-react";

// 3D-Szene nur im Browser laden (WebGL, kein SSR)
const TerrainFlightCanvas = dynamic(() => import("./TerrainFlightCanvas"), {
  ssr: false,
});

/** Text-Schritte der Kamerafahrt. Bereich = Scroll-Fortschritt [von, bis]. */
const STEPS: { from: number; to: number; title: string; sub: string }[] = [
  {
    from: 0.02,
    to: 0.28,
    title: "Der Anflug auf Ihren Standort.",
    sub: "Echtes Gelände aus Satellitenvermessung: die Metropolregion zwischen Hamburg und Lübeck, mitten im Hansebelt-Korridor.",
  },
  {
    from: 0.28,
    to: 0.55,
    title: "7 Kilometer bis zur A24.",
    sub: "Anschlussstelle Talkau, dann über die B207 direkt vor das Grundstück. Ohne Ortsdurchfahrt.",
  },
  {
    from: 0.55,
    to: 0.8,
    title: "Zentimetergenau vermessen.",
    sub: "Das Laser-Geländemodell des Landes zeigt: Erschließungsstraßen, Kreisverkehr und Baufelder sind fertig.",
  },
  {
    from: 0.8,
    to: 1,
    title: "Bereit für Ihren Neubau.",
    sub: "11 Hektar, voll erschlossen, sofort bebaubar.",
  },
];

function stepOpacity(p: number, from: number, to: number, last: boolean): number {
  const fadeIn = Math.min(Math.max((p - from) / 0.06, 0), 1);
  const fadeOut = last ? 1 : Math.min(Math.max((to - p) / 0.06, 0), 1);
  return Math.min(fadeIn, fadeOut);
}

/**
 * Gepinnte Sektion "Der Anflug": Scroll steuert eine Kamerafahrt über das
 * echte Gelände, von der Region bis auf das Park-Plateau. Fällt WebGL aus
 * oder wünscht das System reduzierte Bewegung, erscheint das Standbild.
 */
export default function TerrainFlight() {
  const sectionRef = useRef<HTMLElement>(null);
  const progressRef = useRef(0);
  const stepRefs = useRef<(HTMLDivElement | null)[]>([]);
  const counterRef = useRef<HTMLSpanElement>(null);
  const [mode, setMode] = useState<"idle" | "3d" | "poster">("idle");

  // 3D erst starten, wenn die Sektion in die Nähe des Viewports kommt
  useEffect(() => {
    const section = sectionRef.current;
    if (!section) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setMode("poster");
      return;
    }
    const io = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting) {
          setMode((m) => (m === "idle" ? "3d" : m));
          io.disconnect();
        }
      },
      { rootMargin: "600px 0px" },
    );
    io.observe(section);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    const section = sectionRef.current;
    if (!section) return;

    const update = () => {
      const rect = section.getBoundingClientRect();
      const vh = window.innerHeight;
      const total = rect.height - vh;
      const p = total > 0 ? Math.min(Math.max(-rect.top / total, 0), 1) : 0;
      progressRef.current = p;

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
      id="anflug"
      aria-label="Kamerafahrt über das echte Gelände des Gewerbeparks"
      className="relative h-[380vh] bg-night"
    >
      <div className="sticky top-0 h-screen overflow-hidden">
        {mode === "3d" && (
          <TerrainFlightCanvas
            progressRef={progressRef}
            onFail={() => setMode("poster")}
          />
        )}
        {mode === "poster" && (
          <Image
            src="/terrain/poster.jpg"
            alt="Geländemodell des Gewerbeparks Grabauer Ruhm mit markierter Fläche"
            fill
            className="object-cover"
            sizes="100vw"
          />
        )}

        {/* Weiche Vignette für Lesbarkeit */}
        <div className="pointer-events-none absolute inset-0 z-[2] bg-gradient-to-t from-night via-transparent to-night/70" />

        {/* Kopfzeile */}
        <div className="absolute inset-x-0 top-0 z-[3] pt-24 md:pt-28">
          <div className="mx-auto flex max-w-7xl items-center justify-between px-5 md:px-8">
            <div className="flex items-center gap-3">
              <span className="h-px w-8 bg-gold" />
              <span className="eyebrow text-gold">Der Anflug</span>
            </div>
            <span
              ref={counterRef}
              className="numeral text-sm font-bold tracking-[0.2em] text-paper/50"
            >
              01 / 04
            </span>
          </div>
        </div>

        {/* Text-Schritte */}
        <div className="absolute inset-x-0 bottom-0 z-[3] pb-28 md:pb-20">
          <div className="mx-auto max-w-7xl px-5 md:px-8">
            <div className="relative h-48 max-w-2xl md:h-44">
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
                  {i === STEPS.length - 1 && (
                    <a
                      href="#standortplan"
                      className="group mt-5 inline-flex items-center gap-2 rounded-full bg-wine px-6 py-3 text-sm font-semibold text-paper transition-all hover:-translate-y-0.5 hover:bg-wine-light"
                    >
                      Grundstück wählen
                      <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                    </a>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Pflicht-Attribution der offenen Geodaten */}
        <p className="absolute bottom-3 right-4 z-[3] text-[10px] leading-tight text-paper/40">
          Gelände: © ESA Copernicus DEM · DGM1 © GeoBasis-DE/LVermGeo SH (CC BY 4.0) ·
          © OpenStreetMap-Mitwirkende
        </p>
      </div>
    </section>
  );
}
