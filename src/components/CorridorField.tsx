"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";

/**
 * CorridorField: prozeduraler GLSL-Flowfield-Shader ohne Textur.
 *
 * Gedacht als atmosphaerische, TRANSPARENTE Ebene ueber einem dunklen
 * Section-Hintergrund ("Hansebelt-Korridor"). Der Renderer laeuft mit
 * alpha:true und Clear-Alpha 0, die goldenen Lichtlinien werden additiv
 * darueber gelegt. So scheint das warme Dunkel der Section durch und der
 * Effekt bleibt sehr ruhig und edel.
 *
 * Motiv: langsam stroemende, diagonale Lichtlinien in Gold (#C5A572),
 * die eine Verkehrs. bzw. Transportachse andeuten (Fluss von links-unten
 * nach rechts-oben). Optionaler minimaler Parallax ueber die Maus.
 */

// Marken-Gold #C5A572 als linearer RGB-Vektor (grob, reicht fuer additive Optik).
const GOLD = new THREE.Vector3(0.773, 0.647, 0.447);

// Vertex-Shader: trivialer Full-Screen-Quad. uv wird durchgereicht.
const vertexShader = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = vec4(position.xy, 0.0, 1.0);
  }
`;

// Fragment-Shader: diagonale Flowfield-Linien mit sanftem Rauschen.
// Ausgabe ist premultiplied-freundlich fuer AdditiveBlending: schwarzer
// Grund (Alpha via .a), goldene Linien addieren Licht.
const fragmentShader = /* glsl */ `
  precision highp float;

  varying vec2 vUv;

  uniform float uTime;
  uniform vec2 uResolution;
  uniform vec2 uMouse;
  uniform vec3 uColor;

  // Hash. und Value-Noise (kompakt, texturfrei).
  float hash(vec2 p) {
    p = fract(p * vec2(123.34, 456.21));
    p += dot(p, p + 45.32);
    return fract(p.x * p.y);
  }

  float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    float a = hash(i + vec2(0.0, 0.0));
    float b = hash(i + vec2(1.0, 0.0));
    float c = hash(i + vec2(0.0, 1.0));
    float d = hash(i + vec2(1.0, 1.0));
    return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
  }

  // Fraktales Rauschen fuer weiche Stroemung.
  float fbm(vec2 p) {
    float v = 0.0;
    float amp = 0.5;
    for (int i = 0; i < 4; i++) {
      v += amp * noise(p);
      p *= 2.02;
      amp *= 0.5;
    }
    return v;
  }

  void main() {
    // Seitenverhaeltnis-korrigierte Koordinaten, zentriert.
    vec2 uv = vUv;
    float aspect = uResolution.x / max(uResolution.y, 1.0);
    vec2 p = uv - 0.5;
    p.x *= aspect;

    // Diagonale Achse: Fluss von links-unten nach rechts-oben.
    // Richtung normiert (1,1). "along" laeuft entlang der Achse,
    // "across" steht senkrecht dazu und definiert die einzelnen Linien.
    vec2 dir = normalize(vec2(1.0, 1.0));
    vec2 perp = vec2(-dir.y, dir.x);
    float along = dot(p, dir);
    float across = dot(p, perp);

    // Minimaler Parallax: Maus verschiebt das Feld leicht.
    float parX = (uMouse.x - 0.5) * 0.08;
    float parY = (uMouse.y - 0.5) * 0.08;
    along += parX + parY;
    across += (parX - parY) * 0.5;

    // Langsame Stroemung entlang der Achse.
    float flow = uTime * 0.045;

    // Sanfte Verzerrung der Querkoordinate, damit die Linien "atmen".
    float warp = fbm(vec2(along * 1.6 - flow * 1.2, across * 2.2)) - 0.5;
    float lane = across * 9.0 + warp * 1.6;

    // Periodisches Linienmuster quer zur Achse.
    float lines = abs(sin(lane));
    // Scharfe, aber weiche Lichtlinien: kleiner Kern, breiter Halo.
    float core = smoothstep(0.0, 0.06, 1.0 - lines);
    float halo = smoothstep(0.0, 0.55, 1.0 - lines) * 0.35;
    float strand = core + halo;

    // Wandernde Helligkeit ENTLANG der Achse (Partikel-Anmutung).
    float travel = fbm(vec2(along * 2.4 - flow * 5.0, across * 1.3 + 3.0));
    float pulses = smoothstep(0.35, 0.95, travel);

    // Weiches Auslaufen an den Raendern (kein harter Kasten).
    float edge = smoothstep(0.72, 0.15, length(p));
    float band = smoothstep(0.85, 0.0, abs(across) * 1.15);

    // Grund-Schimmer, damit auch bei uTime=0 (pausiertes rAF) Struktur da ist.
    float base = fbm(vec2(along * 1.1 + 2.0, across * 1.4 - 1.0)) * 0.12;

    float intensity = (strand * (0.35 + pulses * 0.65) + base) * edge * band;

    // Deckkraft der Linien deutlich unter 0.25 halten (sehr ruhig, edel).
    float alpha = clamp(intensity, 0.0, 1.0) * 0.22;

    // Additive Optik: Farbe mit Alpha premultipliziert ausgeben.
    vec3 col = uColor * intensity;
    gl_FragColor = vec4(col, alpha);
  }
`;

interface CorridorFieldProps {
  /** Optionale zusaetzliche Klassen fuer den Container. */
  className?: string;
}

export default function CorridorField({ className }: CorridorFieldProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // Reduced-Motion respektieren: dann nur ein einziger statischer Frame.
    const prefersReducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;

    // WebGL-Verfuegbarkeit auf einem SEPARATEN Wegwerf-Canvas pruefen.
    // Wichtig: Ein Canvas gibt nur EINEN Kontext heraus. Wuerde man den
    // Probe-Kontext auf demselben Canvas holen, das spaeter der Renderer
    // nutzt, kann die Renderer-Kontext-Erstellung fehlschlagen. Deshalb
    // ein eigener Test-Canvas, dessen Kontext sofort freigegeben wird.
    const probeCanvas = document.createElement("canvas");
    const probeContext =
      probeCanvas.getContext("webgl2") ||
      probeCanvas.getContext("webgl") ||
      probeCanvas.getContext("experimental-webgl");
    if (!probeContext) {
      // Kein WebGL: Komponente rendert nur den leeren Container.
      return;
    }
    // Probe-Kontext sofort freigeben, damit keine GPU-Ressource haengt.
    const loseExt = (
      probeContext as WebGLRenderingContext
    ).getExtension("WEBGL_lose_context");
    if (loseExt) loseExt.loseContext();

    // Eigentliches Render-Canvas.
    const canvas = document.createElement("canvas");
    canvas.style.position = "absolute";
    canvas.style.inset = "0";
    canvas.style.width = "100%";
    canvas.style.height = "100%";
    canvas.style.display = "block";

    // Renderer defensiv erzeugen: bei Kontext-Fehlschlag sauberer Fallback.
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({
        canvas,
        antialias: true,
        alpha: true,
        powerPreference: "high-performance",
      });
    } catch {
      // Kontext konnte nicht erstellt werden: leerer Container bleibt.
      return;
    }

    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
    // Clear-Alpha 0 => Ausgabe transparent, Section-Hintergrund scheint durch.
    renderer.setClearColor(0x000000, 0);

    const initialWidth = Math.max(container.clientWidth, 1);
    const initialHeight = Math.max(container.clientHeight, 1);
    renderer.setSize(initialWidth, initialHeight, false);

    container.appendChild(canvas);

    // Full-Screen-Quad. OrthographicCamera reicht ein triviales Setup.
    const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    const scene = new THREE.Scene();
    const geometry = new THREE.PlaneGeometry(2, 2);

    // Uniforms typisiert.
    const uniforms: {
      uTime: { value: number };
      uResolution: { value: THREE.Vector2 };
      uMouse: { value: THREE.Vector2 };
      uColor: { value: THREE.Vector3 };
    } = {
      uTime: { value: 0 },
      uResolution: {
        value: new THREE.Vector2(initialWidth, initialHeight),
      },
      uMouse: { value: new THREE.Vector2(0.5, 0.5) },
      uColor: { value: GOLD.clone() },
    };

    const material = new THREE.ShaderMaterial({
      vertexShader,
      fragmentShader,
      uniforms,
      transparent: true,
      // Additive Blending: goldenes Licht addiert sich auf den dunklen Grund.
      blending: THREE.AdditiveBlending,
      depthTest: false,
      depthWrite: false,
    });

    const mesh = new THREE.Mesh(geometry, material);
    scene.add(mesh);

    // Maus-Ziel und gesmoothter Wert fuer den Parallax.
    const mouseTarget = new THREE.Vector2(0.5, 0.5);

    const handlePointerMove = (event: PointerEvent) => {
      const rect = container.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) return;
      const x = (event.clientX - rect.left) / rect.width;
      const y = (event.clientY - rect.top) / rect.height;
      // y invertieren, damit oben = 1 (passt zur Shader-Konvention).
      mouseTarget.set(
        THREE.MathUtils.clamp(x, 0, 1),
        THREE.MathUtils.clamp(1 - y, 0, 1),
      );
    };
    container.addEventListener("pointermove", handlePointerMove);

    // Resize: Canvas bleibt per CSS 100%/100%, Buffer + uResolution updaten.
    const applySize = () => {
      const width = Math.max(container.clientWidth, 1);
      const height = Math.max(container.clientHeight, 1);
      renderer.setSize(width, height, false);
      uniforms.uResolution.value.set(width, height);
    };

    let resizeObserver: ResizeObserver | null = null;
    if (typeof ResizeObserver !== "undefined") {
      resizeObserver = new ResizeObserver(() => applySize());
      resizeObserver.observe(container);
    } else {
      window.addEventListener("resize", applySize);
    }

    // Kontextverlust abfangen, damit kein Absturz passiert.
    const handleContextLost = (event: Event) => {
      event.preventDefault();
    };
    canvas.addEventListener("webglcontextlost", handleContextLost);

    let frameId = 0;
    const startTime = performance.now();

    const renderFrame = (time: number) => {
      uniforms.uTime.value = time;
      // Maus weich nachziehen (lerp).
      uniforms.uMouse.value.lerp(mouseTarget, 0.05);
      renderer.render(scene, camera);
    };

    const loop = () => {
      // Pausieren, wenn Tab im Hintergrund liegt.
      if (document.hidden) {
        frameId = requestAnimationFrame(loop);
        return;
      }
      const elapsed = (performance.now() - startTime) / 1000;
      renderFrame(elapsed);
      frameId = requestAnimationFrame(loop);
    };

    // Erster Frame muss sofort gut aussehen (uTime=0 hat bereits Struktur).
    renderFrame(0);

    if (!prefersReducedMotion) {
      frameId = requestAnimationFrame(loop);
    }

    // CLEANUP.
    return () => {
      if (frameId) cancelAnimationFrame(frameId);
      container.removeEventListener("pointermove", handlePointerMove);
      canvas.removeEventListener("webglcontextlost", handleContextLost);
      if (resizeObserver) {
        resizeObserver.disconnect();
      } else {
        window.removeEventListener("resize", applySize);
      }
      geometry.dispose();
      material.dispose();
      renderer.dispose();
      renderer.forceContextLoss();
      if (canvas.parentNode === container) {
        container.removeChild(canvas);
      }
    };
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
