"use client";

/**
 * Interne Debug-Seite zum visuellen Abnehmen der 3D-Szenen.
 * Rendert eine Szene isoliert im Viewport (Screenshot-fähig bei Scroll 0).
 * Aufruf: /dev?scene=korridor&p=0.5  oder  /dev?scene=siteplan
 * VOR DEM DEPLOY LÖSCHEN.
 */

import { Suspense, useRef } from "react";
import { useSearchParams } from "next/navigation";
import KorridorMapReal from "@/components/KorridorMapReal";
import SitePlan3D from "@/components/SitePlan3D";
import { PLOTS } from "@/config/site";

function DevInner() {
  const params = useSearchParams();
  const rawP = Number(params.get("p") ?? "0.5");
  const p = Number.isFinite(rawP) ? Math.min(Math.max(rawP, 0), 1) : 0.5;
  const scene = params.get("scene") ?? "korridor";

  const progressRef = useRef(p);
  progressRef.current = p;

  return (
    <main className="relative h-screen w-screen overflow-hidden bg-night">
      {scene === "korridor" ? (
        <KorridorMapReal progressRef={progressRef} />
      ) : (
        <SitePlan3D
          plots={PLOTS}
          selectedId="9"
          hoveredId={null}
          filter="alle"
          onSelect={() => {}}
        />
      )}
      <div className="pointer-events-none absolute left-4 top-4 z-10 text-xs text-paper/60">
        dev · {scene} · p={p}
      </div>
    </main>
  );
}

export default function DevPage() {
  return (
    <Suspense fallback={null}>
      <DevInner />
    </Suspense>
  );
}
