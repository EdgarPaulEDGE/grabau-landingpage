"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";

/** Verkaufsstatus einer Parzelle */
export type SitePlan3DStatus = "verfuegbar" | "reserviert" | "verkauft";

/** Eine Parzelle des Gewerbeparks. x und y sind Prozentwerte auf dem Lageplan (Seitenverhaeltnis 2.22:1). */
export interface SitePlan3DPlot {
  id: string;
  label: string;
  size: number | null;
  status: SitePlan3DStatus;
  x: number;
  y: number;
}

interface SitePlan3DProps {
  plots: SitePlan3DPlot[];
  selectedId: string | null;
  hoveredId?: string | null;
  filter: "alle" | SitePlan3DStatus;
  onSelect: (id: string) => void;
  onHover?: (id: string | null) => void;
  /** Wird vom Anfrage-Button der aufpoppenden Info-Karte aufgerufen */
  onRequest?: (id: string) => void;
  className?: string;
}

/** Anzeige-Texte und Farben der Popup-Karte je Status */
const STATUS_TEXT: Record<SitePlan3DStatus, { label: string; farbe: string }> = {
  verfuegbar: { label: "Verfügbar", farbe: "#5FA86D" },
  reserviert: { label: "Reserviert", farbe: "#C0912F" },
  verkauft: { label: "Verkauft", farbe: "#A4938D" },
};

/* Reine Farb- und Datenkonstanten. Kein DOM-, window- oder Renderer-Zugriff auf Modulebene. */
const FARBE_GOLD = 0xc5a572;
const FARBE_BODEN = 0x201518;
const FARBE_BUSCH = 0x1e2a1b;

interface StatusKonfig {
  basis: number;
  emissiv: number;
  emissivIntensitaet: number;
  hoehe: number;
  badgeFarbe: string;
  kanten: boolean;
}

/** Material- und Formparameter je Status.
    Bewusst entsaettigte Architekturmodell-Toene: der Status bleibt lesbar,
    aber die Koerper wirken wie ein Modell, nicht wie Spielsteine. */
const STATUS_KONFIG: Record<SitePlan3DStatus, StatusKonfig> = {
  verfuegbar: { basis: 0x44524a, emissiv: 0x4f8a5b, emissivIntensitaet: 0.08, hoehe: 0.55, badgeFarbe: "#4F8A5B", kanten: true },
  reserviert: { basis: 0x594e36, emissiv: 0xc0912f, emissivIntensitaet: 0.11, hoehe: 0.4, badgeFarbe: "#C0912F", kanten: true },
  verkauft: { basis: 0x2e2a29, emissiv: 0x241d1b, emissivIntensitaet: 0.04, hoehe: 0.22, badgeFarbe: "#A4938D", kanten: false },
};

/** Prozentkoordinaten des Lageplans in Weltkoordinaten umrechnen. Boden liegt in XZ, Y ist Hoehe. */
function prozentZuWelt(x: number, y: number): { x: number; z: number } {
  return { x: (x - 50) * 0.24, z: (y - 50) * 0.12 };
}

/** Deterministischer Pseudo-Zufallsgenerator (linearer Kongruenzgenerator, seeded) */
function erzeugeZufall(startwert: number): () => number {
  let s = startwert >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

/** Kubisches Ease-Out fuer die Eintrittsanimation */
function easeOutCubic(t: number): number {
  const u = 1 - t;
  return 1 - u * u * u;
}

/** Wert in einen Bereich klemmen */
function klemme(wert: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, wert));
}

/** Abgerundetes Rechteck als THREE.Shape, zentriert um den Ursprung */
function abgerundetesRechteck(breite: number, tiefe: number, radius: number): THREE.Shape {
  const b = breite / 2;
  const t = tiefe / 2;
  const r = Math.min(radius, b * 0.9, t * 0.9);
  const form = new THREE.Shape();
  form.moveTo(-b + r, -t);
  form.lineTo(b - r, -t);
  form.absarc(b - r, -t + r, r, -Math.PI / 2, 0, false);
  form.lineTo(b, t - r);
  form.absarc(b - r, t - r, r, 0, Math.PI / 2, false);
  form.lineTo(-b + r, t);
  form.absarc(-b + r, t - r, r, Math.PI / 2, Math.PI, false);
  form.lineTo(-b, -t + r);
  form.absarc(-b + r, -t + r, r, Math.PI, Math.PI * 1.5, false);
  return form;
}

/** Abstand eines Punkts zu einer Strecke in der XZ-Ebene (fuer die Vegetations-Platzierung) */
function abstandZuStrecke(px: number, pz: number, ax: number, az: number, bx: number, bz: number): number {
  const dx = bx - ax;
  const dz = bz - az;
  const l2 = dx * dx + dz * dz;
  const t = l2 === 0 ? 0 : klemme(((px - ax) * dx + (pz - az) * dz) / l2, 0, 1);
  return Math.hypot(px - (ax + t * dx), pz - (az + t * dz));
}

/** Interner Zustand einer Parzelle in der Szene */
interface PlotRecord {
  plot: SitePlan3DPlot;
  konfig: StatusKonfig;
  gruppe: THREE.Group;
  mesh: THREE.Mesh<THREE.ExtrudeGeometry, THREE.MeshStandardMaterial>;
  kanten: THREE.LineSegments<THREE.EdgesGeometry, THREE.LineBasicMaterial> | null;
  badge: THREE.Sprite;
  hoehe: number;
  ringGroesse: number;
  hub: number;
  opazitaet: number;
}

/**
 * SitePlan3D: interaktiver 3D-Standortplan (Digital Twin) des Gewerbeparks Grabau.
 * Die Szene wird genau einmal aufgebaut. Laufzeit-Props (selectedId, hoveredId, filter)
 * werden in Refs gespiegelt und im Animations-Loop gelesen, damit kein Rebuild noetig ist.
 */
export default function SitePlan3D({
  plots,
  selectedId,
  hoveredId = null,
  filter,
  onSelect,
  onHover,
  onRequest,
  className,
}: SitePlan3DProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  // Anker des Info-Overlays: wird im Loop per Bildschirmprojektion bewegt
  const ankerRef = useRef<HTMLDivElement | null>(null);

  // Laufzeit-Props als Refs, damit der Loop immer die aktuellen Werte liest
  const selectedRef = useRef<string | null>(selectedId);
  const externHoverRef = useRef<string | null>(hoveredId);
  const filterRef = useRef<"alle" | SitePlan3DStatus>(filter);
  const onSelectRef = useRef(onSelect);
  const onHoverRef = useRef(onHover);

  // Plots werden nur beim Mount verbaut (statische Grundstuecksdaten)
  const plotsRef = useRef<SitePlan3DPlot[]>(plots);

  // Bei reduced-motion rendert dieser Callback nach Prop-Aenderungen genau ein Standbild
  const statischRenderRef = useRef<(() => void) | null>(null);

  // Callbacks bei jedem Render spiegeln (Identitaet darf sich aendern, ohne die Szene anzufassen)
  useEffect(() => {
    onSelectRef.current = onSelect;
    onHoverRef.current = onHover;
  });

  // Laufzeit-Props in Refs schreiben und bei reduced-motion ein Einzelbild rendern
  useEffect(() => {
    selectedRef.current = selectedId;
    externHoverRef.current = hoveredId;
    filterRef.current = filter;
    statischRenderRef.current?.();
  }, [selectedId, hoveredId, filter]);

  // Szene genau einmal aufbauen
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let istEntsorgt = false;

    // Bewegungsvorlieben des Nutzers respektieren
    const reduzierteBewegung = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    // WebGL-Probe auf einem Wegwerf-Canvas. Ohne WebGL bleibt der Container leer,
    // dahinter liegt der statische Fallback der Seite.
    const probe = document.createElement("canvas");
    const probeGl = probe.getContext("webgl2") ?? probe.getContext("webgl");
    if (!probeGl) return;
    probeGl.getExtension("WEBGL_lose_context")?.loseContext();

    // Renderer mit transparentem Hintergrund (liegt in einer dunklen Karte #1A1113)
    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
      powerPreference: "high-performance",
    });
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
    renderer.setClearColor(0x000000, 0);
    // Filmisches Tone-Mapping + weiche Schatten: der Unterschied zwischen
    // "Spielbrett" und Architekturmodell
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.18;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    const canvas = renderer.domElement;
    canvas.style.position = "absolute";
    canvas.style.inset = "0";
    canvas.style.width = "100%";
    canvas.style.height = "100%";
    canvas.style.display = "block";
    canvas.style.userSelect = "none";
    container.appendChild(canvas);

    // Kontextverlust abfangen, damit der Browser den Kontext wiederherstellen kann
    const beiKontextVerlust = (e: Event) => {
      e.preventDefault();
    };
    canvas.addEventListener("webglcontextlost", beiKontextVerlust, false);

    // Sammelbecken fuer die vollstaendige Entsorgung
    const geometrien: THREE.BufferGeometry[] = [];
    const materialien: THREE.Material[] = [];
    const texturen: THREE.Texture[] = [];
    const merkeGeo = <T extends THREE.BufferGeometry>(g: T): T => {
      geometrien.push(g);
      return g;
    };
    const merkeMat = <T extends THREE.Material>(m: T): T => {
      materialien.push(m);
      return m;
    };
    const merkeTex = <T extends THREE.Texture>(t: T): T => {
      texturen.push(t);
      return t;
    };

    const szene = new THREE.Scene();

    // Kamera: fov 38, Start (0, 13, 14), Blick auf (0, 0, 0.5)
    const kameraZiel = new THREE.Vector3(0, 0, 0.5);
    const radius = Math.hypot(13, 13.5);
    const basisPolar = Math.acos(13 / radius);
    const polarMin = Math.min(basisPolar, 0.9);
    const startBreite = Math.max(container.clientWidth, 1);
    const startHoehe = Math.max(container.clientHeight, 1);
    const kamera = new THREE.PerspectiveCamera(38, startBreite / startHoehe, 0.1, 120);
    kamera.position.set(0, 13, 14);
    kamera.lookAt(kameraZiel);
    renderer.setSize(startBreite, startHoehe, false);

    // Licht: warmes Ambient, schattenwerfende Sonne von schraeg oben,
    // dezenter goldener Akzent. Die weichen Schatten verankern die Koerper
    // auf der Platte, statt sie schweben zu lassen.
    const ambient = new THREE.AmbientLight(0xffe3c4, 0.55);
    szene.add(ambient);
    const sonne = new THREE.DirectionalLight(0xfff0dc, 1.35);
    sonne.position.set(9, 15, 7);
    sonne.castShadow = true;
    sonne.shadow.mapSize.set(2048, 2048);
    sonne.shadow.camera.left = -16;
    sonne.shadow.camera.right = 16;
    sonne.shadow.camera.top = 12;
    sonne.shadow.camera.bottom = -12;
    sonne.shadow.camera.near = 2;
    sonne.shadow.camera.far = 45;
    sonne.shadow.bias = -0.0004;
    szene.add(sonne);
    const goldLicht = new THREE.PointLight(FARBE_GOLD, 8, 30, 2);
    goldLicht.position.set(0, 6.5, 0.5);
    szene.add(goldLicht);

    // Leichter Tiefen-Nebel Richtung Sektionshintergrund
    szene.fog = new THREE.Fog(0x1a1113, 24, 46);

    // Boden: flaches Plateau als extrudiertes, abgerundetes Rechteck, Oberkante bei y = 0
    const plateauForm = abgerundetesRechteck(26, 14, 1.1);
    const plateauGeo = merkeGeo(
      new THREE.ExtrudeGeometry(plateauForm, {
        depth: 0.5,
        bevelEnabled: true,
        bevelThickness: 0.06,
        bevelSize: 0.06,
        bevelSegments: 2,
        curveSegments: 8,
      })
    );
    plateauGeo.rotateX(-Math.PI / 2);
    plateauGeo.translate(0, -0.56, 0);
    const plateauMat = merkeMat(
      new THREE.MeshStandardMaterial({ color: FARBE_BODEN, roughness: 0.95, metalness: 0.05 })
    );
    const plateau = new THREE.Mesh(plateauGeo, plateauMat);
    plateau.receiveShadow = true;
    szene.add(plateau);

    // Sehr feines goldenes Vermessungsraster als prozeduraler Grid-Shader auf einer zweiten Ebene.
    // Kein Zugriff auf material.extensions.derivatives (in three 0.185 entfernt), keine fwidth-Nutzung.
    const rasterGeo = merkeGeo(new THREE.PlaneGeometry(25.2, 13.2));
    rasterGeo.rotateX(-Math.PI / 2);
    const rasterMat = merkeMat(
      new THREE.ShaderMaterial({
        transparent: true,
        depthWrite: false,
        uniforms: { uFarbe: { value: new THREE.Color(FARBE_GOLD) } },
        vertexShader: `
          varying vec2 vUv;
          void main() {
            vUv = uv;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          }
        `,
        fragmentShader: `
          varying vec2 vUv;
          uniform vec3 uFarbe;
          void main() {
            vec2 zellen = vUv * vec2(52.0, 28.0);
            vec2 abstand = abs(fract(zellen) - 0.5);
            float naehe = min(abstand.x, abstand.y);
            float linie = 1.0 - smoothstep(0.0, 0.05, naehe);
            vec2 rand = smoothstep(0.0, 0.06, vUv) * smoothstep(0.0, 0.06, 1.0 - vUv);
            float maske = rand.x * rand.y;
            gl_FragColor = vec4(uFarbe, linie * 0.04 * maske);
          }
        `,
      })
    );
    const raster = new THREE.Mesh(rasterGeo, rasterMat);
    raster.position.y = 0.006;
    szene.add(raster);

    // Strassen: flache goldene Baender, additiv gemischt fuer einen edlen Schimmer
    const strassenMat = merkeMat(
      new THREE.MeshBasicMaterial({
        color: FARBE_GOLD,
        transparent: true,
        opacity: 0.16,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      })
    );
    const baueStrassenSegment = (
      a: { x: number; z: number },
      b: { x: number; z: number },
      breite: number,
      hoeheY: number
    ): void => {
      const laenge = Math.hypot(b.x - a.x, b.z - a.z);
      const geo = merkeGeo(new THREE.PlaneGeometry(laenge + breite * 0.4, breite));
      geo.rotateX(-Math.PI / 2);
      const mesh = new THREE.Mesh(geo, strassenMat);
      mesh.position.set((a.x + b.x) / 2, hoeheY, (a.z + b.z) / 2);
      mesh.rotation.y = -Math.atan2(b.z - a.z, b.x - a.x);
      szene.add(mesh);
    };

    // B207 als Gerade durch (18%, 100%) -> (62%, -2%)
    const b207a = prozentZuWelt(18, 100);
    const b207b = prozentZuWelt(62, -2);
    baueStrassenSegment(b207a, b207b, 0.5, 0.01);

    // Interne Erschliessungsstrasse als Polyline plus Abzweig
    const hauptzug = [
      prozentZuWelt(31, 66),
      prozentZuWelt(38, 57),
      prozentZuWelt(44, 47),
      prozentZuWelt(50, 38),
      prozentZuWelt(54, 28),
      prozentZuWelt(57, 18),
    ];
    for (let i = 0; i < hauptzug.length - 1; i++) {
      baueStrassenSegment(hauptzug[i], hauptzug[i + 1], 0.35, 0.013);
    }
    const abzweig = [
      prozentZuWelt(44, 47),
      prozentZuWelt(52, 52),
      prozentZuWelt(58, 55),
      prozentZuWelt(63, 52),
    ];
    for (let i = 0; i < abzweig.length - 1; i++) {
      baueStrassenSegment(abzweig[i], abzweig[i + 1], 0.35, 0.013);
    }

    // Kreisverkehr bei (31%, 66%) als flacher goldener Ring
    const kreiselPos = prozentZuWelt(31, 66);
    const kreiselGeo = merkeGeo(new THREE.RingGeometry(0.36, 0.66, 40));
    kreiselGeo.rotateX(-Math.PI / 2);
    const kreisel = new THREE.Mesh(kreiselGeo, strassenMat);
    kreisel.position.set(kreiselPos.x, 0.016, kreiselPos.z);
    szene.add(kreisel);

    // Weiche runde Canvas-Textur fuer die Lichtpulse auf der B207
    const pulsCanvas = document.createElement("canvas");
    pulsCanvas.width = 64;
    pulsCanvas.height = 64;
    const pulsCtx = pulsCanvas.getContext("2d");
    if (pulsCtx) {
      const grad = pulsCtx.createRadialGradient(32, 32, 0, 32, 32, 32);
      grad.addColorStop(0, "rgba(255, 240, 210, 1)");
      grad.addColorStop(0.4, "rgba(197, 165, 114, 0.7)");
      grad.addColorStop(1, "rgba(197, 165, 114, 0)");
      pulsCtx.fillStyle = grad;
      pulsCtx.fillRect(0, 0, 64, 64);
    }
    const pulsTextur = merkeTex(new THREE.CanvasTexture(pulsCanvas));
    pulsTextur.colorSpace = THREE.SRGBColorSpace;

    // Drei goldene Lichtpulse, die endlos die B207 entlangwandern
    const pulse: THREE.Sprite[] = [];
    for (let i = 0; i < 3; i++) {
      const mat = merkeMat(
        new THREE.SpriteMaterial({
          map: pulsTextur,
          transparent: true,
          opacity: 0,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
        })
      );
      const sprite = new THREE.Sprite(mat);
      sprite.scale.set(0.55, 0.55, 1);
      sprite.position.set(b207a.x, 0.1, b207a.z);
      szene.add(sprite);
      pulse.push(sprite);
    }

    // Vegetation: dunkelgruene Low-Poly-Bueschel als lockerer Guertel um das Gelaende.
    // Deterministisch aus einem seeded Hash platziert, keine Zufallswerte zur Renderzeit.
    const buschGeo = merkeGeo(new THREE.IcosahedronGeometry(0.3, 0));
    const buschMat = merkeMat(
      new THREE.MeshStandardMaterial({ color: FARBE_BUSCH, roughness: 0.95, metalness: 0 })
    );
    const buesche = new THREE.InstancedMesh(buschGeo, buschMat, 120);
    const zufall = erzeugeZufall(20260709);
    const dummy = new THREE.Object3D();
    let platziert = 0;
    let versuche = 0;
    while (platziert < 120 && versuche < 600) {
      versuche++;
      const winkel = zufall() * Math.PI * 2;
      const rx = 10.2 + zufall() * 2.4;
      const rz = 5.4 + zufall() * 1.3;
      const px = Math.cos(winkel) * rx;
      const pz = Math.sin(winkel) * rz;
      // Bueschel nicht auf der B207 platzieren
      if (abstandZuStrecke(px, pz, b207a.x, b207a.z, b207b.x, b207b.z) < 0.9) continue;
      const s = 0.55 + zufall() * 0.75;
      dummy.position.set(px, 0.1 * s, pz);
      dummy.scale.set(s, s * 0.55, s);
      dummy.rotation.set(0, zufall() * Math.PI * 2, 0);
      dummy.updateMatrix();
      buesche.setMatrixAt(platziert, dummy.matrix);
      platziert++;
    }
    buesche.count = platziert;
    buesche.instanceMatrix.needsUpdate = true;
    szene.add(buesche);

    // Nummern-Badge als Canvas-Textur: dunkler Kern, Ring in Statusfarbe,
    // weisse Nummer ohne "Nr."-Praefix (ruhiger, edler als Vollfarbkreise)
    const erzeugeBadgeTextur = (label: string, farbe: string): THREE.CanvasTexture => {
      const nummer = label.replace(/^Nr\.\s*/, "");
      const c = document.createElement("canvas");
      c.width = 256;
      c.height = 256;
      const ctx = c.getContext("2d");
      if (ctx) {
        ctx.clearRect(0, 0, 256, 256);
        ctx.beginPath();
        ctx.arc(128, 128, 100, 0, Math.PI * 2);
        ctx.fillStyle = "rgba(22, 14, 16, 0.88)";
        ctx.fill();
        ctx.lineWidth = 12;
        ctx.strokeStyle = farbe;
        ctx.stroke();
        ctx.fillStyle = "rgba(250, 248, 246, 0.96)";
        ctx.font = `700 ${nummer.length > 2 ? 88 : 112}px "Museo Sans Rounded", "Fira Sans", system-ui, sans-serif`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(nummer, 128, 140);
      }
      const tex = new THREE.CanvasTexture(c);
      tex.colorSpace = THREE.SRGBColorSpace;
      return merkeTex(tex);
    };

    // ---------- Parzellen-Layout: Fussabdruecke berechnen und Ueberlappungen aufloesen ----------
    // Alle Parzellen teilen die Rotation -0.72. Im gedrehten Bezugssystem sind
    // sie deshalb achsenparallele Rechtecke, und Ueberlappungen lassen sich
    // durch iteratives Auseinanderschieben sauber aufloesen (Relaxation).
    const ROTATION = -0.72;
    interface ParzellenLayout {
      plot: SitePlan3DPlot;
      breite: number;
      tiefe: number;
      rx: number; // Position im gedrehten Bezugssystem
      rz: number;
    }
    const cosR = Math.cos(ROTATION);
    const sinR = Math.sin(ROTATION);
    const layouts: ParzellenLayout[] = plotsRef.current.map((plot) => {
      const seite = plot.size !== null ? Math.sqrt(plot.size) * 0.026 : 1.25;
      const breite = seite * 1.2 * 0.84;
      const tiefe = seite * 0.85 * 0.84;
      const welt = prozentZuWelt(plot.x, plot.y);
      // Welt -> gedrehtes Bezugssystem: Punkt um -ROTATION um Y drehen
      return {
        plot,
        breite,
        tiefe,
        rx: welt.x * cosR - welt.z * sinR,
        rz: welt.x * sinR + welt.z * cosR,
      };
    });
    // Relaxation: ueberlappende Paare entlang der Achse mit der geringsten
    // Durchdringung auseinanderdruecken, bis alles frei liegt.
    const FUGE = 0.07;
    for (let runde = 0; runde < 48; runde++) {
      let bewegt = false;
      for (let i = 0; i < layouts.length; i++) {
        for (let j = i + 1; j < layouts.length; j++) {
          const A = layouts[i];
          const B = layouts[j];
          const dx = B.rx - A.rx;
          const dz = B.rz - A.rz;
          const ox = (A.breite + B.breite) / 2 + FUGE - Math.abs(dx);
          const oz = (A.tiefe + B.tiefe) / 2 + FUGE - Math.abs(dz);
          if (ox > 0 && oz > 0) {
            bewegt = true;
            if (ox < oz) {
              const s = (dx >= 0 ? 1 : -1) * (ox / 2);
              A.rx -= s;
              B.rx += s;
            } else {
              const s = (dz >= 0 ? 1 : -1) * (oz / 2);
              A.rz -= s;
              B.rz += s;
            }
          }
        }
      }
      if (!bewegt) break;
    }

    // Parzellen aufbauen: extrudierte, abgerundete Koerper mit Bevel, an der Strassenrichtung ausgerichtet
    const aufzeichnungen: PlotRecord[] = [];
    const meshZuRecord = new Map<THREE.Object3D, PlotRecord>();
    const idZuRecord = new Map<string, PlotRecord>();
    for (const lay of layouts) {
      const plot = lay.plot;
      const konfig = STATUS_KONFIG[plot.status];
      const breite = lay.breite;
      const tiefe = lay.tiefe;
      // Zurueck ins Weltsystem: Punkt um +ROTATION um Y drehen
      const welt = {
        x: lay.rx * cosR + lay.rz * sinR,
        z: -lay.rx * sinR + lay.rz * cosR,
      };

      const form = abgerundetesRechteck(breite, tiefe, Math.min(breite, tiefe) * 0.18);
      const geo = merkeGeo(
        new THREE.ExtrudeGeometry(form, {
          depth: konfig.hoehe,
          bevelEnabled: true,
          bevelThickness: 0.035,
          bevelSize: 0.035,
          bevelSegments: 2,
          curveSegments: 5,
        })
      );
      // Extrusion von Z auf Y drehen, damit scale.y die Hoehe steuert
      geo.rotateX(-Math.PI / 2);

      const mat = merkeMat(
        new THREE.MeshStandardMaterial({
          color: konfig.basis,
          emissive: konfig.emissiv,
          emissiveIntensity: konfig.emissivIntensitaet,
          roughness: plot.status === "verkauft" ? 0.92 : 0.8,
          metalness: 0.02,
          transparent: true,
          opacity: 1,
        })
      );

      const gruppe = new THREE.Group();
      gruppe.position.set(welt.x, 0, welt.z);
      gruppe.rotation.y = -0.72;

      const mesh = new THREE.Mesh(geo, mat);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      gruppe.add(mesh);

      // Goldene Kanten nur auf verfuegbaren und reservierten Parzellen
      let kanten: THREE.LineSegments<THREE.EdgesGeometry, THREE.LineBasicMaterial> | null = null;
      if (konfig.kanten) {
        const kantenGeo = merkeGeo(new THREE.EdgesGeometry(geo, 20));
        const kantenMat = merkeMat(
          new THREE.LineBasicMaterial({ color: FARBE_GOLD, transparent: true, opacity: 0.5 })
        );
        kanten = new THREE.LineSegments(kantenGeo, kantenMat);
        gruppe.add(kanten);
      }

      // Schwebendes Nummern-Badge knapp ueber der Parzelle
      const badgeTex = erzeugeBadgeTextur(plot.label, konfig.badgeFarbe);
      const badgeMat = merkeMat(
        new THREE.SpriteMaterial({ map: badgeTex, transparent: true, depthWrite: false })
      );
      const badge = new THREE.Sprite(badgeMat);
      badge.scale.set(0.42, 0.42, 1);
      badge.position.set(0, konfig.hoehe + 0.42, 0);
      gruppe.add(badge);

      szene.add(gruppe);

      const record: PlotRecord = {
        plot,
        konfig,
        gruppe,
        mesh,
        kanten,
        badge,
        hoehe: konfig.hoehe,
        ringGroesse: (Math.hypot(breite, tiefe) / 2) * 1.35,
        hub: 0,
        opazitaet: 1,
      };
      aufzeichnungen.push(record);
      meshZuRecord.set(mesh, record);
      idZuRecord.set(plot.id, record);
    }

    // Flacher goldener Leuchtring auf dem Boden um die ausgewaehlte Parzelle (geteilt, wird umpositioniert)
    const ringGeo = merkeGeo(new THREE.RingGeometry(0.92, 1.06, 48));
    ringGeo.rotateX(-Math.PI / 2);
    const ringMat = merkeMat(
      new THREE.MeshBasicMaterial({
        color: FARBE_GOLD,
        transparent: true,
        opacity: 0.4,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        side: THREE.DoubleSide,
      })
    );
    const auswahlRing = new THREE.Mesh(ringGeo, ringMat);
    auswahlRing.position.y = 0.02;
    auswahlRing.visible = false;
    szene.add(auswahlRing);

    // Einmalige Schockwelle beim Auswahlwechsel: expandierender, verblassender Ring
    const welleGeo = merkeGeo(new THREE.RingGeometry(0.94, 1.0, 64));
    welleGeo.rotateX(-Math.PI / 2);
    const welleMat = merkeMat(
      new THREE.MeshBasicMaterial({
        color: FARBE_GOLD,
        transparent: true,
        opacity: 0,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        side: THREE.DoubleSide,
      })
    );
    const welle = new THREE.Mesh(welleGeo, welleMat);
    welle.position.y = 0.03;
    welle.visible = false;
    szene.add(welle);

    // Interaktions- und Kamerazustand (nur Closure-Variablen, kein React-State im Loop)
    const raycaster = new THREE.Raycaster();
    const zeigerNdc = new THREE.Vector2();
    let mausGedrueckt = false;
    let dragLaeuft = false;
    let startX = 0;
    let startY = 0;
    let vorherX = 0;
    let vorherY = 0;
    let dragAzZiel = 0;
    let dragPolarZiel = 0;
    let dragAz = 0;
    let dragPolar = 0;
    let parallaxAzZiel = 0;
    let parallaxPolarZiel = 0;
    let parallaxAz = 0;
    let parallaxPolar = 0;
    let internesHover: string | null = null;
    let hoverAusstehend = false;
    let hoverX = 0;
    let hoverY = 0;
    let letzterStatischerHover = 0;
    let schleifeLaeuft = false;
    let rafId = 0;
    let vorherigeZeit = 0;
    let imSichtfeld = false;
    // Zustand der Schockwelle und der Overlay-Projektion
    let letzteAuswahlId: string | null = selectedRef.current;
    let welleZeit = -1;
    let welleBasis = 1;
    const projektion = new THREE.Vector3();

    // Eintrittsanimation: bei verstecktem Tab oder reduced-motion sofort voll ausgewachsen
    let wachstumZeit = document.hidden || reduzierteBewegung ? 99 : 0;

    const istGefiltert = (r: PlotRecord): boolean =>
      filterRef.current !== "alle" && r.plot.status !== filterRef.current;

    /** Raycast an einer Bildschirmposition. Gefilterte Parzellen sind ausgeschlossen. */
    const ermittleTreffer = (clientX: number, clientY: number): PlotRecord | null => {
      const rect = canvas.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) return null;
      zeigerNdc.set(
        ((clientX - rect.left) / rect.width) * 2 - 1,
        -(((clientY - rect.top) / rect.height) * 2 - 1)
      );
      raycaster.setFromCamera(zeigerNdc, kamera);
      const kandidaten: THREE.Object3D[] = [];
      for (const r of aufzeichnungen) {
        if (!istGefiltert(r)) kandidaten.push(r.mesh);
      }
      const treffer = raycaster.intersectObjects(kandidaten, false);
      if (treffer.length === 0) return null;
      return meshZuRecord.get(treffer[0].object) ?? null;
    };

    /** Szene fuer einen Frame fortschreiben. sofort = true setzt alle Werte ohne Lerp auf ihr Ziel. */
    const aktualisiere = (dt: number, zeit: number, sofort: boolean): void => {
      const glatt = sofort ? 1 : 1 - Math.exp(-dt * 7);
      const glattKamera = sofort ? 1 : 1 - Math.exp(-dt * 4);

      // Faellt die intern gehoverte Parzelle durch den Filter, Hover sofort aufloesen.
      // Sonst bleiben Cursor und Eltern-Hover-State nach einem Filterwechsel haengen.
      if (internesHover !== null) {
        const hoverRec = idZuRecord.get(internesHover);
        if (!hoverRec || istGefiltert(hoverRec)) {
          internesHover = null;
          if (!dragLaeuft) canvas.style.cursor = "";
          onHoverRef.current?.(null);
        }
      }

      // Eintrittswachstum nur im laufenden Loop voranschreiten lassen
      if (!sofort) wachstumZeit = Math.min(wachstumZeit + dt, 99);

      // Kamera: sehr langsame Idle-Drehung, gelerpte Maus-Parallaxe, gedaempftes Drag
      parallaxAz += (parallaxAzZiel - parallaxAz) * glattKamera;
      parallaxPolar += (parallaxPolarZiel - parallaxPolar) * glattKamera;
      dragAz += (dragAzZiel - dragAz) * glattKamera;
      dragPolar += (dragPolarZiel - dragPolar) * glattKamera;
      const idle = reduzierteBewegung ? 0 : Math.sin(zeit * 0.1) * 0.06;
      const az = idle + parallaxAz + dragAz;
      const polar = klemme(basisPolar + parallaxPolar + dragPolar, polarMin, 1.25);
      kamera.position.set(
        kameraZiel.x + radius * Math.sin(polar) * Math.sin(az),
        kameraZiel.y + radius * Math.cos(polar),
        kameraZiel.z + radius * Math.sin(polar) * Math.cos(az)
      );
      kamera.lookAt(kameraZiel);

      const auswahlId = selectedRef.current;
      // Internes Canvas-Hover hat Vorrang, externes hoveredId wirkt genauso (ohne onHover-Echo)
      const hoverId = internesHover ?? externHoverRef.current;
      let auswahlRecord: PlotRecord | null = null;

      for (let index = 0; index < aufzeichnungen.length; index++) {
        const r = aufzeichnungen[index];
        const gefiltert = istGefiltert(r);
        const istAuswahl = !gefiltert && auswahlId === r.plot.id;
        const istHover = !gefiltert && hoverId === r.plot.id;
        if (istAuswahl) auswahlRecord = r;

        // Gestaffeltes Wachstum: 40 ms Versatz pro Index, easeOutCubic, insgesamt unter 1.6 s
        const fortschritt = klemme((wachstumZeit - index * 0.04) / 0.7, 0, 1);
        const sy = Math.max(easeOutCubic(fortschritt), 0.001);
        r.mesh.scale.y = sy;
        if (r.kanten) r.kanten.scale.y = sy;

        // Hub bei Hover oder Auswahl, weich gelerpt
        const hubZiel = istAuswahl || istHover ? 0.15 : 0;
        r.hub += (hubZiel - r.hub) * glatt;
        r.gruppe.position.y = r.hub;

        // Gefilterte Parzellen stark abblenden
        const opazZiel = gefiltert ? 0.12 : 1;
        r.opazitaet += (opazZiel - r.opazitaet) * glatt;
        r.mesh.material.opacity = r.opazitaet;

        // Emissive: Auswahl pulsiert weich, Hover leuchtet etwas staerker
        let intensitaet = r.konfig.emissivIntensitaet;
        if (istAuswahl) {
          intensitaet += sofort || reduzierteBewegung ? 0.3 : 0.22 + Math.sin(zeit * 3.1) * 0.14;
        } else if (istHover) {
          intensitaet += 0.15;
        }
        r.mesh.material.emissiveIntensity = intensitaet * (gefiltert ? 0.25 : 1);

        if (r.kanten) {
          r.kanten.material.opacity = gefiltert ? 0.05 : istAuswahl || istHover ? 1 : 0.5;
        }
        r.badge.material.opacity = gefiltert ? 0.15 : 1;
        r.badge.position.y = r.hoehe * sy + 0.42;
      }

      // Leuchtring unter der ausgewaehlten Parzelle
      if (auswahlRecord) {
        auswahlRing.visible = true;
        auswahlRing.position.set(auswahlRecord.gruppe.position.x, 0.02, auswahlRecord.gruppe.position.z);
        auswahlRing.scale.setScalar(auswahlRecord.ringGroesse);
        ringMat.opacity =
          0.35 + (sofort || reduzierteBewegung ? 0.15 : Math.sin(zeit * 2.6) * 0.15 + 0.15);
      } else {
        auswahlRing.visible = false;
      }

      // Schockwelle: beim Auswahlwechsel einmal ausloesen, dann expandieren
      if (auswahlId !== letzteAuswahlId) {
        letzteAuswahlId = auswahlId;
        if (auswahlRecord && !sofort && !reduzierteBewegung) {
          welleZeit = 0;
          welleBasis = auswahlRecord.ringGroesse;
          welle.position.set(
            auswahlRecord.gruppe.position.x,
            0.03,
            auswahlRecord.gruppe.position.z
          );
        } else {
          welleZeit = -1;
        }
      }
      if (welleZeit >= 0) {
        welleZeit += dt;
        const wt = welleZeit / 0.65;
        if (wt >= 1) {
          welleZeit = -1;
          welle.visible = false;
        } else {
          welle.visible = true;
          welle.scale.setScalar(welleBasis * (1 + wt * 2.1));
          welleMat.opacity = Math.pow(1 - wt, 1.6) * 0.85;
        }
      } else {
        welle.visible = false;
      }

      // Lichtpulse auf der B207: an den Enden weich ein- und ausblenden
      for (let i = 0; i < pulse.length; i++) {
        const t = (zeit * 0.06 + i * 0.34) % 1;
        pulse[i].position.set(
          b207a.x + (b207b.x - b207a.x) * t,
          0.1,
          b207a.z + (b207b.z - b207a.z) * t
        );
        pulse[i].material.opacity = reduzierteBewegung ? 0 : Math.sin(t * Math.PI) * 0.85;
      }

      // Info-Overlay der ausgewaehlten Parzelle per Bildschirmprojektion ausrichten
      const anker = ankerRef.current;
      if (anker) {
        if (auswahlRecord) {
          const oberkante =
            auswahlRecord.hoehe * auswahlRecord.mesh.scale.y +
            auswahlRecord.gruppe.position.y;
          projektion.set(
            auswahlRecord.gruppe.position.x,
            oberkante,
            auswahlRecord.gruppe.position.z
          );
          projektion.project(kamera);
          const breite = container.clientWidth;
          const hoehe = container.clientHeight;
          if (projektion.z < 1 && breite > 0) {
            const px = (projektion.x * 0.5 + 0.5) * breite;
            const py = (-projektion.y * 0.5 + 0.5) * hoehe;
            anker.style.display = "";
            anker.style.transform = `translate(${px}px, ${py}px)`;
            // Karte nach links klappen, wenn rechts der Platz ausgeht
            anker.classList.toggle("sp-flip", px > breite - 280);
          } else {
            anker.style.display = "none";
          }
        } else {
          anker.style.display = "none";
        }
      }
    };

    /** Genau ein fertiges Standbild rendern (Endzustand, ohne Lerp) */
    const renderEinzelbild = (): void => {
      if (istEntsorgt) return;
      aktualisiere(1 / 60, performance.now() / 1000, true);
      renderer.render(szene, kamera);
    };

    /** Hover-Raycast auswerten und onHover nur bei echten Aenderungen melden */
    const verarbeiteHover = (): void => {
      if (istEntsorgt || dragLaeuft) return;
      const rec = ermittleTreffer(hoverX, hoverY);
      const id = rec ? rec.plot.id : null;
      if (id !== internesHover) {
        internesHover = id;
        canvas.style.cursor = id ? "pointer" : "";
        onHoverRef.current?.(id);
      }
    };

    // Genau ein requestAnimationFrame-Loop fuer die gesamte Szene
    const schleife = (jetzt: number): void => {
      rafId = requestAnimationFrame(schleife);
      const dt = klemme((jetzt - vorherigeZeit) / 1000, 0, 0.05);
      vorherigeZeit = jetzt;
      // pointermove wird rAF-gedrosselt hier verarbeitet
      if (hoverAusstehend) {
        hoverAusstehend = false;
        verarbeiteHover();
      }
      aktualisiere(dt, jetzt / 1000, false);
      renderer.render(szene, kamera);
    };
    const starteSchleife = (): void => {
      if (schleifeLaeuft || reduzierteBewegung || istEntsorgt) return;
      schleifeLaeuft = true;
      vorherigeZeit = performance.now();
      rafId = requestAnimationFrame(schleife);
    };
    const stoppeSchleife = (): void => {
      if (!schleifeLaeuft) return;
      schleifeLaeuft = false;
      cancelAnimationFrame(rafId);
    };
    // Loop pausiert bei verstecktem Tab oder wenn der Container nicht im Viewport liegt
    const pruefeLaufzustand = (): void => {
      if (!document.hidden && imSichtfeld) starteSchleife();
      else stoppeSchleife();
    };

    // Zeiger-Eingaben: Drag nur mit der Maus, Touch bleibt frei zum Scrollen (kein preventDefault)
    const beiZeigerRunter = (e: PointerEvent): void => {
      startX = e.clientX;
      startY = e.clientY;
      vorherX = e.clientX;
      vorherY = e.clientY;
      if (e.pointerType === "mouse") {
        mausGedrueckt = true;
        try {
          canvas.setPointerCapture(e.pointerId);
        } catch {
          /* Capture ist optional */
        }
      }
    };

    const beiZeigerBewegung = (e: PointerEvent): void => {
      const istMaus = e.pointerType === "mouse";
      // Maus-Parallaxe nur fuer Maus-Zeiger und nur ohne reduced-motion,
      // sonst springt die Kamera in den statischen Einzelbildern
      if (istMaus && !reduzierteBewegung) {
        const rect = canvas.getBoundingClientRect();
        if (rect.width > 0 && rect.height > 0) {
          const nx = ((e.clientX - rect.left) / rect.width) * 2 - 1;
          const ny = ((e.clientY - rect.top) / rect.height) * 2 - 1;
          parallaxAzZiel = -nx * 0.04;
          parallaxPolarZiel = ny * 0.02;
        }
      }
      if (mausGedrueckt && istMaus) {
        const dx = e.clientX - vorherX;
        const dy = e.clientY - vorherY;
        vorherX = e.clientX;
        vorherY = e.clientY;
        if (Math.hypot(e.clientX - startX, e.clientY - startY) > 4) dragLaeuft = true;
        if (dragLaeuft) {
          dragAzZiel = klemme(dragAzZiel - dx * 0.005, -0.45, 0.45);
          dragPolarZiel = klemme(dragPolarZiel + dy * 0.004, polarMin - basisPolar, 1.25 - basisPolar);
          canvas.style.cursor = "grabbing";
          return;
        }
      }
      // Hover nur fuer Maus-Zeiger: Touch dient ausschliesslich Tap und Seiten-Scroll
      if (!istMaus) return;
      hoverX = e.clientX;
      hoverY = e.clientY;
      if (schleifeLaeuft) {
        // Verarbeitung erfolgt rAF-gedrosselt im Loop
        hoverAusstehend = true;
      } else {
        // Ohne Loop (reduced-motion oder pausiert) zeitgedrosselt direkt auswerten
        const jetzt = performance.now();
        if (jetzt - letzterStatischerHover > 60) {
          letzterStatischerHover = jetzt;
          verarbeiteHover();
          if (reduzierteBewegung) renderEinzelbild();
        }
      }
    };

    const beiZeigerHoch = (e: PointerEvent): void => {
      if (mausGedrueckt) {
        try {
          canvas.releasePointerCapture(e.pointerId);
        } catch {
          /* Capture ist optional */
        }
      }
      mausGedrueckt = false;
      const warDrag = dragLaeuft;
      dragLaeuft = false;
      canvas.style.cursor = internesHover ? "pointer" : "";
      // Klick bzw. Tap nur bei Bewegungs-Toleranz unter 6 Pixeln
      if (!warDrag && Math.hypot(e.clientX - startX, e.clientY - startY) < 6) {
        const rec = ermittleTreffer(e.clientX, e.clientY);
        if (rec) onSelectRef.current(rec.plot.id);
      }
    };

    const beiZeigerAbbruch = (): void => {
      mausGedrueckt = false;
      dragLaeuft = false;
      canvas.style.cursor = internesHover ? "pointer" : "";
    };

    const beiZeigerVerlassen = (): void => {
      parallaxAzZiel = 0;
      parallaxPolarZiel = 0;
      hoverAusstehend = false;
      if (internesHover !== null) {
        internesHover = null;
        canvas.style.cursor = "";
        onHoverRef.current?.(null);
        if (reduzierteBewegung) renderEinzelbild();
      }
    };

    canvas.addEventListener("pointerdown", beiZeigerRunter);
    canvas.addEventListener("pointermove", beiZeigerBewegung);
    canvas.addEventListener("pointerup", beiZeigerHoch);
    canvas.addEventListener("pointercancel", beiZeigerAbbruch);
    canvas.addEventListener("pointerleave", beiZeigerVerlassen);

    const beiSichtbarkeit = (): void => {
      pruefeLaufzustand();
    };
    document.addEventListener("visibilitychange", beiSichtbarkeit);

    // Loop nur laufen lassen, wenn der Container tatsaechlich im Viewport liegt
    const intersectionObserver = new IntersectionObserver(
      (eintraege) => {
        for (const eintrag of eintraege) {
          imSichtfeld = eintrag.isIntersecting;
        }
        pruefeLaufzustand();
      },
      { threshold: 0.01 }
    );
    intersectionObserver.observe(container);

    // Groessenaenderungen: Renderer und Kamera anpassen, danach genau ein Frame
    const resizeObserver = new ResizeObserver(() => {
      if (istEntsorgt) return;
      const b = Math.max(container.clientWidth, 1);
      const h = Math.max(container.clientHeight, 1);
      renderer.setSize(b, h, false);
      kamera.aspect = b / h;
      kamera.updateProjectionMatrix();
      if (schleifeLaeuft) renderer.render(szene, kamera);
      else renderEinzelbild();
    });
    resizeObserver.observe(container);

    // Bei reduced-motion rendert dieser Callback nach jeder Prop-Aenderung ein frisches Standbild
    statischRenderRef.current = () => {
      if (istEntsorgt) return;
      if (!schleifeLaeuft) renderEinzelbild();
    };

    // Erster Frame muss fertig aussehen: bei hidden oder reduced-motion ist das Wachstum
    // bereits auf 99 gesetzt, renderEinzelbild zeigt den vollen Endzustand
    renderEinzelbild();

    // Vollstaendige Entsorgung beim Unmount
    return () => {
      istEntsorgt = true;
      stoppeSchleife();
      statischRenderRef.current = null;
      resizeObserver.disconnect();
      intersectionObserver.disconnect();
      document.removeEventListener("visibilitychange", beiSichtbarkeit);
      canvas.removeEventListener("pointerdown", beiZeigerRunter);
      canvas.removeEventListener("pointermove", beiZeigerBewegung);
      canvas.removeEventListener("pointerup", beiZeigerHoch);
      canvas.removeEventListener("pointercancel", beiZeigerAbbruch);
      canvas.removeEventListener("pointerleave", beiZeigerVerlassen);
      canvas.removeEventListener("webglcontextlost", beiKontextVerlust);
      for (const g of geometrien) g.dispose();
      for (const m of materialien) m.dispose();
      for (const t of texturen) t.dispose();
      buesche.dispose();
      renderer.dispose();
      try {
        renderer.forceContextLoss();
      } catch {
        /* Kontext ist eventuell schon verloren */
      }
      canvas.remove();
    };
  }, []);

  // Daten der Popup-Karte (Positionierung übernimmt der Loop, Inhalt React)
  const ausgewaehlt = selectedId
    ? plots.find((p) => p.id === selectedId) ?? null
    : null;

  return (
    <div
      ref={containerRef}
      className={className}
      aria-label="Interaktiver 3D-Standortplan des Gewerbeparks Grabau"
      style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}
    >
      {/* Aufpoppende Info-Karte an der ausgewählten Parzelle */}
      <div className="pointer-events-none absolute inset-0 z-10 overflow-hidden">
        <div ref={ankerRef} className="sp-anker" style={{ display: "none" }}>
          {ausgewaehlt && (
            <div key={ausgewaehlt.id} className="sp-aufbau">
              <span className="sp-leader" aria-hidden="true" />
              <div className="sp-card">
                <div className="sp-row flex items-center justify-between gap-4">
                  <span className="eyebrow !text-[0.58rem] text-paper/50">
                    Grundstück
                  </span>
                  <span
                    className="inline-flex items-center gap-1.5 text-[0.68rem] font-bold uppercase tracking-wider"
                    style={{ color: STATUS_TEXT[ausgewaehlt.status].farbe }}
                  >
                    <span
                      className="h-1.5 w-1.5 rounded-full"
                      style={{
                        backgroundColor: STATUS_TEXT[ausgewaehlt.status].farbe,
                      }}
                    />
                    {STATUS_TEXT[ausgewaehlt.status].label}
                  </span>
                </div>
                <div className="sp-row mt-1.5 flex items-baseline gap-2.5">
                  <span className="numeral text-[2.4rem] font-bold leading-none text-paper">
                    {ausgewaehlt.label.replace(/^Nr\.\s*/, "")}
                  </span>
                  <span className="text-sm font-semibold text-gold">
                    {ausgewaehlt.size
                      ? `${ausgewaehlt.size.toLocaleString("de-DE")} m²`
                      : "vergeben"}
                  </span>
                </div>
                <div className="sp-row mt-2 flex gap-3 text-[0.68rem] text-paper/55">
                  <span>GE-Gebiet</span>
                  <span>GRZ 0,8</span>
                  <span>bis 18 m Höhe</span>
                </div>
                {ausgewaehlt.status !== "verkauft" ? (
                  <button
                    type="button"
                    onClick={() => onRequest?.(ausgewaehlt.id)}
                    className="sp-row pointer-events-auto mt-3.5 inline-flex w-full items-center justify-center rounded-full bg-wine px-4 py-2 text-xs font-semibold text-paper transition-all hover:-translate-y-0.5 hover:bg-wine-dark"
                  >
                    Dieses Grundstück anfragen
                  </button>
                ) : (
                  <p className="sp-row mt-3 text-[0.7rem] leading-snug text-paper/50">
                    Bereits vergeben. Die Nachbarflächen sind noch frei.
                  </p>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
