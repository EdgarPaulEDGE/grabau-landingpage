"use client";

import { useEffect, useRef, type RefObject } from "react";
import maplibregl from "maplibre-gl";

/* ====================================================================
   KorridorMapReal · echte Karte, kinoreif inszeniert.

   Basis: MapLibre GL mit OpenFreeMap-Vektorkacheln (OpenStreetMap-
   Daten, frei nutzbar). Der "dark"-Style wird zur Laufzeit auf die
   Markenwelt umgefärbt: warmes Nacht-Dunkel, Autobahnen in Gold.
   Darüber liegen die scroll-getriebenen Leuchtrouten der Achse
   (Grabau → Hamburg, Lübeck, Fehmarnbelt → Kopenhagen, Berlin),
   wandernde Lichtpulse und HTML-Marker in der Hausschrift.

   progressRef (0..1) wird im rAF-Loop gelesen: kein React-State pro
   Frame, keine Re-Renders.
   ==================================================================== */

const STYLE_URL = "https://tiles.openfreemap.org/styles/dark";

const GOLD = "#C5A572";
const TUNNEL_HELL = "#F2EAD9";

type LonLat = readonly [number, number];

interface Stadt {
  name: string;
  pos: LonLat;
  reveal: number;
  variante?: "grabau" | "hh";
  /** Progress, ab dem das Label wieder ausblendet (Platz im Weitwinkel) */
  fadeOutAb?: number;
}

const STAEDTE: readonly Stadt[] = [
  { name: "GRABAU", pos: [10.468, 53.548], reveal: 0.02, variante: "grabau" },
  { name: "SCHWARZENBEK", pos: [10.48, 53.504], reveal: 0.12, fadeOutAb: 0.55 },
  { name: "HAMBURG", pos: [9.993, 53.551], reveal: 0.24, variante: "hh" },
  { name: "LÜBECK", pos: [10.687, 53.866], reveal: 0.42 },
  { name: "FEHMARN", pos: [11.21, 54.5], reveal: 0.62 },
  { name: "KOPENHAGEN", pos: [12.568, 55.676], reveal: 0.76 },
  { name: "BERLIN", pos: [13.405, 52.52], reveal: 0.9 },
];

interface Route {
  koordinaten: LonLat[];
  von: number;
  bis: number;
  farbe: string;
}

/* A24-Anschluss Talkau als gemeinsamer Knoten */
const TALKAU: LonLat = [10.55, 53.505];

const ROUTEN: readonly Route[] = [
  /* R1 Grabau → A24 → Hamburg */
  {
    koordinaten: [[10.468, 53.548], [10.52, 53.522], TALKAU, [10.35, 53.52], [10.15, 53.545], [9.993, 53.551]],
    von: 0.05, bis: 0.3, farbe: GOLD,
  },
  /* R2 Grabau → Lübeck (B207) */
  {
    koordinaten: [[10.468, 53.548], [10.55, 53.65], [10.62, 53.76], [10.687, 53.866]],
    von: 0.3, bis: 0.5, farbe: GOLD,
  },
  /* R3a Lübeck → Puttgarden (A1/E47) */
  {
    koordinaten: [[10.687, 53.866], [10.78, 54.02], [10.88, 54.22], [11.05, 54.38], [11.21, 54.5]],
    von: 0.5, bis: 0.66, farbe: GOLD,
  },
  /* R3b Fehmarnbelt-Tunnel → Kopenhagen (heller) */
  {
    koordinaten: [[11.21, 54.5], [11.35, 54.66], [11.6, 54.77], [11.97, 55.0], [12.18, 55.35], [12.45, 55.6], [12.568, 55.676]],
    von: 0.66, bis: 0.78, farbe: TUNNEL_HELL,
  },
  /* R4 A24 → Berlin */
  {
    koordinaten: [TALKAU, [11.2, 53.3], [11.8, 53.1], [12.6, 52.85], [13.1, 52.65], [13.405, 52.52]],
    von: 0.78, bis: 0.95, farbe: GOLD,
  },
];

function klemme(v: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, v));
}

function glattstufe(a: number, b: number, x: number): number {
  const t = klemme((x - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
}

/** Planare Distanz in Grad, Längengrade mit Breiten-Korrektur gewichtet */
function gradDistanz(a: LonLat, b: LonLat): number {
  const mLat = ((a[1] + b[1]) / 2) * (Math.PI / 180);
  const dx = (b[0] - a[0]) * Math.cos(mLat);
  const dy = b[1] - a[1];
  return Math.hypot(dx, dy);
}

/** Schneidet eine Linie beim Anteil t (0..1) der Gesamtlänge ab */
function schneideLinie(koordinaten: LonLat[], t: number): LonLat[] {
  if (t <= 0) return [koordinaten[0], koordinaten[0]];
  if (t >= 1) return [...koordinaten];
  const kumulativ: number[] = [0];
  let gesamt = 0;
  for (let i = 1; i < koordinaten.length; i++) {
    gesamt += gradDistanz(koordinaten[i - 1], koordinaten[i]);
    kumulativ.push(gesamt);
  }
  const ziel = gesamt * t;
  const ergebnis: LonLat[] = [koordinaten[0]];
  for (let i = 1; i < koordinaten.length; i++) {
    if (kumulativ[i] <= ziel) {
      ergebnis.push(koordinaten[i]);
    } else {
      const f = (ziel - kumulativ[i - 1]) / (kumulativ[i] - kumulativ[i - 1]);
      const a = koordinaten[i - 1];
      const b = koordinaten[i];
      ergebnis.push([a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f]);
      break;
    }
  }
  return ergebnis;
}

/** Punkt beim Anteil t entlang der Linie */
function punktAufLinie(koordinaten: LonLat[], t: number): LonLat {
  const geschnitten = schneideLinie(koordinaten, klemme(t, 0, 1));
  return geschnitten[geschnitten.length - 1];
}

interface KameraPose {
  center: [number, number];
  zoom: number;
}

interface KorridorMapRealProps {
  progressRef: RefObject<number>;
  className?: string;
}

export default function KorridorMapReal({ progressRef, className }: KorridorMapRealProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let verworfen = false;
    const reduzierteBewegung = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    let map: maplibregl.Map;
    try {
      map = new maplibregl.Map({
        container,
        style: STYLE_URL,
        center: [10.468, 53.548],
        zoom: 9.4,
        pitch: 52,
        bearing: -14,
        interactive: false,
        attributionControl: { compact: true },
        fadeDuration: 120,
      });
    } catch {
      /* Kein WebGL oder Init-Fehler: Sektion bleibt dunkel, Texte tragen */
      return;
    }

    /* Kachel-/Netzwerkfehler still schlucken: Karte bleibt dann dunkel */
    map.on("error", () => undefined);

    const marker: maplibregl.Marker[] = [];
    const markerElemente: HTMLDivElement[] = [];
    let bereit = false;
    /* Drei Keyframes: Grabau nah → Dreieck Hamburg/Lübeck → ganze Achse */
    let k0: KameraPose | null = null;
    let k1: KameraPose | null = null;
    let k2: KameraPose | null = null;
    const K1_PIVOT = 0.45;

    /* ---------- Marken-Umfärbung des Basis-Styles ---------- */
    const faerbeUm = (): void => {
      const style = map.getStyle();
      if (!style?.layers) return;
      for (const layer of style.layers) {
        const id = layer.id;
        try {
          if (layer.type === "background") {
            map.setPaintProperty(id, "background-color", "#171013");
          } else if (layer.type === "fill") {
            if (/water|ocean|sea|river|lake/i.test(id)) {
              map.setPaintProperty(id, "fill-color", "#0D0A0F");
              map.setPaintProperty(id, "fill-outline-color", "#171013");
            } else if (/building/i.test(id)) {
              map.setPaintProperty(id, "fill-color", "#221619");
            } else {
              map.setPaintProperty(id, "fill-color", "#1D1417");
            }
          } else if (layer.type === "line") {
            /* Basiskarten-Straßen stark dämpfen: das Leuchten gehört
               ausschließlich unserer Achse */
            if (/motorway|trunk/i.test(id)) {
              map.setPaintProperty(id, "line-color", "rgba(197,165,114,0.13)");
            } else if (/primary|secondary|rail/i.test(id)) {
              map.setPaintProperty(id, "line-color", "rgba(197,165,114,0.06)");
            } else if (/boundary|admin/i.test(id)) {
              map.setPaintProperty(id, "line-color", "rgba(160,135,110,0.22)");
            } else if (/water|river/i.test(id)) {
              map.setPaintProperty(id, "line-color", "#0D0A0F");
            } else {
              map.setPaintProperty(id, "line-color", "rgba(140,115,100,0.07)");
            }
          } else if (layer.type === "symbol") {
            if (/place|city|town|country|state|capital/i.test(id)) {
              map.setPaintProperty(id, "text-color", "#7E7268");
              map.setPaintProperty(id, "text-halo-color", "#150E11");
              /* Beschriftung auf Deutsch: name:de mit Fallback auf den
                 Lokalnamen (statt der englischen Default-Spalte) */
              map.setLayoutProperty(id, "text-field", [
                "coalesce",
                ["get", "name:de"],
                ["get", "name"],
              ]);
              /* Unsere Marker-Städte aus den Basiskarten-Labels ausschließen,
                 sonst doppeln sich die Schriftzüge (z. B. HAMBURG zweimal) */
              const eigene = [
                "Hamburg", "Lübeck", "Schwarzenbek", "Berlin", "Grabau",
                "København", "Copenhagen", "Kopenhagen",
                "Fehmarn", "Puttgarden", "Burg auf Fehmarn",
              ];
              const ausschluss = [
                "!",
                [
                  "in",
                  ["coalesce", ["get", "name:latin"], ["get", "name"], ""],
                  ["literal", eigene],
                ],
              ] as maplibregl.FilterSpecification;
              const bestehend = map.getFilter(id);
              map.setFilter(
                id,
                bestehend
                  ? (["all", bestehend, ausschluss] as maplibregl.FilterSpecification)
                  : ausschluss,
              );
            } else {
              map.setLayoutProperty(id, "visibility", "none");
            }
          }
        } catch {
          /* Einzelne Style-Eigenschaften dürfen fehlschlagen */
        }
      }
    };

    /* ---------- Routen-Ebenen ---------- */
    const basisDaten: GeoJSON.FeatureCollection = {
      type: "FeatureCollection",
      features: ROUTEN.map((r) => ({
        type: "Feature",
        properties: { farbe: r.farbe },
        geometry: { type: "LineString", coordinates: r.koordinaten.map((k) => [...k]) },
      })),
    };

    const leereSammlung: GeoJSON.FeatureCollection = { type: "FeatureCollection", features: [] };

    const baueEbenen = (): void => {
      map.addSource("achse-basis", { type: "geojson", data: basisDaten });
      map.addSource("achse-hell", { type: "geojson", data: leereSammlung });
      map.addSource("achse-pulse", { type: "geojson", data: leereSammlung });

      /* Basisnetz: die ganze Achse, dezent sichtbar */
      map.addLayer({
        id: "achse-basis",
        type: "line",
        source: "achse-basis",
        layout: { "line-cap": "round", "line-join": "round" },
        paint: { "line-color": GOLD, "line-opacity": 0.16, "line-width": 1.6 },
      });
      /* Halo unter dem hellen Kern */
      map.addLayer({
        id: "achse-halo",
        type: "line",
        source: "achse-hell",
        layout: { "line-cap": "round", "line-join": "round" },
        paint: {
          "line-color": ["get", "farbe"],
          "line-opacity": 0.16,
          "line-width": 11,
          "line-blur": 4,
        },
      });
      /* Heller Kern: wächst mit dem Scroll */
      map.addLayer({
        id: "achse-hell",
        type: "line",
        source: "achse-hell",
        layout: { "line-cap": "round", "line-join": "round" },
        paint: {
          "line-color": ["get", "farbe"],
          "line-opacity": 0.98,
          "line-width": 3.6,
        },
      });
      /* Wandernde Lichtpulse */
      map.addLayer({
        id: "achse-pulse",
        type: "circle",
        source: "achse-pulse",
        paint: {
          "circle-color": "#FFEDC2",
          "circle-radius": 4.5,
          "circle-blur": 0.55,
          "circle-opacity": ["get", "alpha"],
        },
      });
    };

    /* ---------- Städte-Marker (HTML, Hausschrift) ---------- */
    const baueMarker = (): void => {
      for (const stadt of STAEDTE) {
        const el = document.createElement("div");
        el.className =
          "km-marker" +
          (stadt.variante === "grabau" ? " km-marker--grabau" : "") +
          (stadt.variante === "hh" ? " km-marker--hh" : "");
        const dot = document.createElement("div");
        dot.className = "km-dot";
        const label = document.createElement("div");
        label.className = "km-label";
        label.textContent = stadt.name;
        el.appendChild(dot);
        el.appendChild(label);
        el.style.opacity = "0.4";
        markerElemente.push(el);
        marker.push(
          new maplibregl.Marker({ element: el, anchor: "center" })
            .setLngLat([stadt.pos[0], stadt.pos[1]])
            .addTo(map),
        );
      }
    };

    /* ---------- Kamera-Keyframes (aspektbewusst über cameraForBounds) ---------- */
    const poseAusBounds = (
      bounds: [[number, number], [number, number]],
    ): KameraPose | null => {
      const cam = map.cameraForBounds(bounds, {
        padding: { top: 120, bottom: 215, left: 80, right: 80 },
      });
      if (!cam?.center || typeof cam.zoom !== "number") return null;
      const c = maplibregl.LngLat.convert(cam.center as maplibregl.LngLatLike);
      return { center: [c.lng, c.lat], zoom: cam.zoom };
    };

    const berechneKeyframes = (): void => {
      /* Nah an Grabau (mit Schwarzenbek und A24-Anschluss) */
      k0 = poseAusBounds([[10.36, 53.46], [10.61, 53.63]]);
      /* Das Dreieck Hamburg, Grabau, Lübeck */
      k1 = poseAusBounds([[9.83, 53.38], [10.82, 53.94]]);
      /* Die ganze Achse bis Kopenhagen und Berlin */
      k2 = poseAusBounds([[9.65, 52.32], [13.78, 55.92]]);
    };

    /* ---------- Fortschritt anwenden ---------- */
    let angezeigt = -1;

    const wendeAn = (p: number, zeit: number): void => {
      if (!bereit) return;

      /* Kamera: segmentweise Fahrt über drei Keyframes */
      if (k0 && k1 && k2) {
        let von: KameraPose;
        let nach: KameraPose;
        let e: number;
        if (p <= K1_PIVOT) {
          von = k0;
          nach = k1;
          e = glattstufe(0, K1_PIVOT, p);
        } else {
          von = k1;
          nach = k2;
          e = glattstufe(K1_PIVOT, 1, p);
        }
        const gesamt = glattstufe(0, 1, p);
        map.jumpTo({
          center: [
            von.center[0] + (nach.center[0] - von.center[0]) * e,
            von.center[1] + (nach.center[1] - von.center[1]) * e,
          ],
          zoom: von.zoom + (nach.zoom - von.zoom) * e,
          pitch: 52 - gesamt * 20,
          bearing: -14 + gesamt * 14,
        });
      }

      /* Routen aufziehen */
      const helleFeatures: GeoJSON.Feature[] = [];
      const pulsFeatures: GeoJSON.Feature[] = [];
      ROUTEN.forEach((route, i) => {
        const anteil = glattstufe(route.von, route.bis, p);
        if (anteil > 0.001) {
          helleFeatures.push({
            type: "Feature",
            properties: { farbe: route.farbe },
            geometry: {
              type: "LineString",
              coordinates: schneideLinie(route.koordinaten, anteil).map((k) => [...k]),
            },
          });
        }
        if (anteil > 0.15 && !reduzierteBewegung) {
          const t = ((zeit * 0.09 + i * 0.37) % 1) * anteil;
          const punkt = punktAufLinie(route.koordinaten, t);
          pulsFeatures.push({
            type: "Feature",
            properties: { alpha: 0.85 * glattstufe(0.15, 0.4, anteil) },
            geometry: { type: "Point", coordinates: [punkt[0], punkt[1]] },
          });
        }
      });
      const hellSource = map.getSource("achse-hell") as maplibregl.GeoJSONSource | undefined;
      const pulsSource = map.getSource("achse-pulse") as maplibregl.GeoJSONSource | undefined;
      hellSource?.setData({ type: "FeatureCollection", features: helleFeatures });
      pulsSource?.setData({ type: "FeatureCollection", features: pulsFeatures });

      /* Marker ein- und ggf. wieder ausblenden */
      STAEDTE.forEach((stadt, i) => {
        let offen = glattstufe(stadt.reveal - 0.03, stadt.reveal + 0.05, p);
        if (stadt.fadeOutAb !== undefined) {
          offen *= 1 - glattstufe(stadt.fadeOutAb, stadt.fadeOutAb + 0.1, p);
        }
        const el = markerElemente[i];
        if (el) {
          el.style.opacity = String(
            stadt.fadeOutAb !== undefined ? offen : 0.35 + offen * 0.65,
          );
        }
      });

      angezeigt = p;
    };

    map.on("load", () => {
      if (verworfen) return;
      faerbeUm();
      baueEbenen();
      baueMarker();
      berechneKeyframes();
      bereit = true;
      wendeAn(klemme(progressRef.current ?? 0, 0, 1), 0);
    });

    /* Bei Größenänderung Keyframes neu berechnen (MapLibre resized selbst) */
    const beiResize = (): void => {
      if (!bereit || verworfen) return;
      berechneKeyframes();
      wendeAn(klemme(progressRef.current ?? 0, 0, 1), startZeit());
    };
    map.on("resize", beiResize);

    /* ---------- Loop ---------- */
    const t0 = performance.now();
    const startZeit = (): number => (performance.now() - t0) / 1000;

    let rafId = 0;
    let sichtbar = true;

    const schleife = (): void => {
      rafId = 0;
      if (verworfen || document.hidden || !sichtbar) return;
      const ziel = klemme(progressRef.current ?? 0, 0, 1);
      const p = angezeigt < 0 ? ziel : angezeigt + (ziel - angezeigt) * 0.16;
      wendeAn(Math.abs(ziel - p) < 0.0004 ? ziel : p, startZeit());
      rafId = requestAnimationFrame(schleife);
    };
    const starteSchleife = (): void => {
      if (rafId === 0 && !document.hidden && sichtbar && !reduzierteBewegung) {
        rafId = requestAnimationFrame(schleife);
      }
    };
    const stoppeSchleife = (): void => {
      if (rafId !== 0) {
        cancelAnimationFrame(rafId);
        rafId = 0;
      }
    };

    /* Reduced motion: statisch pro Scroll-Ereignis nachziehen */
    const beiScrollStatisch = (): void => {
      if (reduzierteBewegung) wendeAn(klemme(progressRef.current ?? 0, 0, 1), 0);
    };
    window.addEventListener("scroll", beiScrollStatisch, { passive: true });

    const beiSicht = (): void => {
      if (document.hidden) stoppeSchleife();
      else starteSchleife();
    };
    document.addEventListener("visibilitychange", beiSicht);

    const io = new IntersectionObserver(([eintrag]) => {
      sichtbar = eintrag.isIntersecting;
      if (sichtbar) starteSchleife();
      else stoppeSchleife();
    });
    io.observe(container);

    starteSchleife();

    /* ---------- Cleanup ---------- */
    return () => {
      verworfen = true;
      stoppeSchleife();
      window.removeEventListener("scroll", beiScrollStatisch);
      document.removeEventListener("visibilitychange", beiSicht);
      io.disconnect();
      for (const m of marker) m.remove();
      map.remove();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div
      ref={containerRef}
      className={className}
      aria-hidden="true"
      style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}
    />
  );
}
