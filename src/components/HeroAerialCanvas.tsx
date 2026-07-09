"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";

/**
 * HeroAerialCanvas v2
 *
 * Rendert ein echtes Drohnen-Luftbild als Full-Screen-Quad mit GLSL-Shader:
 * goldener Vermessungs-Scan, scroll-gesteuerter Kino-Zoom, Maus-Parallaxe,
 * Vignette. Darueber liegt ein 3D-Goldstaub-Partikelfeld in echter Perspektive.
 *
 * Drop-in kompatibel zur v1: identischer Props-Vertrag { src, className }.
 * Bei fehlendem WebGL bleibt der Container leer (statischer Fallback dahinter).
 */

// Marken-Gold #C5A572 als normierte RGB-Werte (reines Datenobjekt, kein DOM-Zugriff)
const GOLD_RGB = { r: 197 / 255, g: 165 / 255, b: 114 / 255 } as const;

// Anzahl der Goldstaub-Partikel: edler Staub, kein Schneesturm
const PARTICLE_COUNT = 350;

/**
 * Deterministischer Pseudozufallsgenerator (Mulberry32).
 * Sorgt dafuer, dass das Partikelfeld bei jedem Mount identisch aussieht.
 */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Vertex-Shader: Quad fuellt den gesamten Clipspace, UVs werden durchgereicht
const VERTEX_SHADER = /* glsl */ `
varying vec2 vUv;

void main() {
  vUv = uv;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}
`;

// Fragment-Shader: Cover-Fit, Scroll-Zoom, Vermessungs-Scan, Parallaxe, Vignette
const FRAGMENT_SHADER = /* glsl */ `
precision highp float;

uniform float uTime;
uniform vec2 uResolution;
uniform vec2 uMouse;
uniform float uScroll;
uniform sampler2D uTexture;
uniform float uImageAspect;
uniform vec3 uGold;
uniform float uReducedMotion;

varying vec2 vUv;

// Luminanz nach Rec. 601
float luma(vec3 c) {
  return dot(c, vec3(0.299, 0.587, 0.114));
}

void main() {
  // (a) Scroll-Zoom um das Zentrum plus leichte vertikale Drift (Kamera-Nachfahren)
  float zoom = 1.0 + uScroll * 0.16;
  vec2 uv = (vUv - 0.5) / zoom + 0.5;
  uv.y += uScroll * 0.045;

  // Cover-Fit: Bild fuellt den Screen, ueberschuessiger Rand wird beschnitten
  float screenAspect = uResolution.x / max(uResolution.y, 1.0);
  vec2 cuv = uv - 0.5;
  if (screenAspect > uImageAspect) {
    cuv.y *= uImageAspect / screenAspect;
  } else {
    cuv.x *= screenAspect / uImageAspect;
  }
  cuv += 0.5;

  // (c) Maus-Parallaxe, sehr dezent
  cuv += uMouse * 0.006;

  vec3 col = texture2D(uTexture, cuv).rgb;

  // Filmischer Warm-Grade: entsaettigt das stumpfe Wiesengruen leicht,
  // waermt die Mitteltoene und vergoldet die Lichter. So passt das Foto
  // in die Weinrot-Gold-Markenwelt statt sich mit ihr zu beissen.
  float lg = luma(col);
  col = mix(vec3(lg), col, 0.78);
  col *= vec3(1.08, 1.0, 0.88);
  col += uGold * lg * lg * 0.12;
  col *= 1.08;

  // (b) Goldener Vermessungs-Scan: weicher diagonaler Streifen wandert langsam.
  // Bei reduzierter Bewegung steht der Scan statisch in der Mitte.
  float diag = (vUv.x + vUv.y) * 0.5;
  float scanPos = mix(fract(uTime * 0.05), 0.5, uReducedMotion);
  float dist = abs(diag - scanPos);
  dist = min(dist, 1.0 - dist); // nahtloser Umlauf des Streifens
  float band = 1.0 - smoothstep(0.0, 0.16, dist);

  // Feine goldene Hoehenlinien aus der posterisierten Bild-Luminanz,
  // Kantenglaettung ueber fwidth (Derivatives sind auf WebGL2 Core verfuegbar)
  float p = luma(col) * 9.0;
  float f = fract(p);
  float edge = min(f, 1.0 - f);
  float w = fwidth(p) * 1.2 + 0.02;
  float contour = 1.0 - smoothstep(0.0, w, edge);

  // Scan-Intensitaet klart beim Scrollen auf
  float scanStrength = 1.0 - uScroll;
  float glow = band * (contour * 0.85 + 0.06) * scanStrength;
  col += uGold * min(glow, 0.15); // additiv, hart auf 0.15 gedeckelt

  // (d) Dezente Vignette plus staerkere Abdunklung unten fuer Textlesbarkeit
  vec2 vc = vUv - 0.5;
  float vig = 1.0 - smoothstep(0.35, 0.95, length(vc));
  col *= mix(0.9, 1.0, vig);
  float bottomShade = (1.0 - smoothstep(0.0, 0.45, vUv.y)) * 0.12;
  col *= 1.0 - bottomShade;

  gl_FragColor = vec4(col, 1.0);
}
`;

/**
 * Prueft WebGL2-Faehigkeit auf einem Wegwerf-Canvas und gibt den Kontext
 * danach sofort wieder frei (WEBGL_lose_context).
 * WICHTIG: three 0.185 setzt WebGL2 zwingend voraus (WebGL1-Support wurde
 * in r163 entfernt), deshalb wird hier NUR webgl2 geprobt.
 */
function probeWebGL(): boolean {
  try {
    const probeCanvas = document.createElement("canvas");
    const gl = probeCanvas.getContext("webgl2");
    if (!gl) return false;
    const loseExt = gl.getExtension("WEBGL_lose_context");
    if (loseExt) loseExt.loseContext();
    return true;
  } catch {
    return false;
  }
}

/**
 * Erzeugt eine weiche, runde Gold-Textur auf einem 2D-Canvas
 * fuer die Partikel-Sprites.
 */
function createDustTexture(): THREE.CanvasTexture | null {
  const size = 64;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  const half = size / 2;
  const gradient = ctx.createRadialGradient(half, half, 0, half, half, half);
  gradient.addColorStop(0, "rgba(197, 165, 114, 1)");
  gradient.addColorStop(0.35, "rgba(197, 165, 114, 0.55)");
  gradient.addColorStop(1, "rgba(197, 165, 114, 0)");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, size, size);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

export default function HeroAerialCanvas({
  src,
  className,
}: {
  src: string;
  className?: string;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);

  // Loader-Funktion im Ref: so kann der src-Effekt die Textur neu laden,
  // ohne dass die Szene bei Prop-Updates neu aufgebaut wird
  const loadTextureRef = useRef<((url: string) => void) | null>(null);

  // Haupt-Effekt: baut die Szene genau EINMAL auf (bewusst leere Dependency-Liste)
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // Kein WebGL2: Container bleibt leer, dahinter liegt der statische Fallback
    if (!probeWebGL()) return;

    // Schutz gegen spaete asynchrone Callbacks nach dem Unmount
    let disposed = false;

    const reducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;

    // ---------- Renderer ----------
    // try/catch: falls die Kontext-Erstellung trotz Probe fehlschlaegt,
    // brechen wir sauber ab statt die App mit einer Exception zu crashen
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({
        antialias: true,
        alpha: true,
        powerPreference: "high-performance",
      });
    } catch {
      return;
    }
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
    renderer.setClearColor(0x000000, 0);
    // autoClear aus: wir rendern zwei Szenen uebereinander (Quad, dann Partikel)
    renderer.autoClear = false;

    const canvas = renderer.domElement;
    canvas.style.position = "absolute";
    canvas.style.inset = "0";
    canvas.style.width = "100%";
    canvas.style.height = "100%";
    canvas.style.display = "block";
    container.appendChild(canvas);

    const onContextLost = (e: Event) => {
      e.preventDefault();
    };
    canvas.addEventListener("webglcontextlost", onContextLost, false);

    // ---------- Ebene 1: Full-Screen-Quad mit Luftbild-Shader ----------
    const quadScene = new THREE.Scene();
    const orthoCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    const quadGeometry = new THREE.PlaneGeometry(2, 2);

    // Platzhalter-Textur in warmem Nacht-Dunkel #1A1113,
    // damit vor dem Bild-Laden kein hartes Schwarz sichtbar ist
    const placeholderData = new Uint8Array([26, 17, 19, 255]);
    const placeholderTexture = new THREE.DataTexture(
      placeholderData,
      1,
      1,
      THREE.RGBAFormat
    );
    placeholderTexture.colorSpace = THREE.SRGBColorSpace;
    placeholderTexture.needsUpdate = true;

    const uniforms: {
      uTime: { value: number };
      uResolution: { value: THREE.Vector2 };
      uMouse: { value: THREE.Vector2 };
      uScroll: { value: number };
      uTexture: { value: THREE.Texture };
      uImageAspect: { value: number };
      uGold: { value: THREE.Vector3 };
      uReducedMotion: { value: number };
    } = {
      uTime: { value: 0 },
      uResolution: { value: new THREE.Vector2(1, 1) },
      uMouse: { value: new THREE.Vector2(0, 0) },
      uScroll: { value: 0 },
      uTexture: { value: placeholderTexture },
      uImageAspect: { value: 16 / 9 },
      uGold: {
        value: new THREE.Vector3(GOLD_RGB.r, GOLD_RGB.g, GOLD_RGB.b),
      },
      uReducedMotion: { value: reducedMotion ? 1 : 0 },
    };

    const quadMaterial = new THREE.ShaderMaterial({
      vertexShader: VERTEX_SHADER,
      fragmentShader: FRAGMENT_SHADER,
      uniforms,
      depthTest: false,
      depthWrite: false,
    });
    const quadMesh = new THREE.Mesh(quadGeometry, quadMaterial);
    // Der Vertex-Shader ignoriert die Kameramatrizen, CPU-Culling waere
    // hier eine falsche Basis: deshalb Culling fuer das Quad abschalten
    quadMesh.frustumCulled = false;
    quadScene.add(quadMesh);

    // ---------- Ebene 2: Goldstaub-Partikelfeld in echter Perspektive ----------
    const particleScene = new THREE.Scene();
    const particleCamera = new THREE.PerspectiveCamera(55, 1, 0.1, 50);
    particleCamera.position.set(0, 0, 6);

    // Deterministische Startpositionen im Quader x +-5, y +-3, z 0..5
    const rand = mulberry32(20260709);
    const positions = new Float32Array(PARTICLE_COUNT * 3);
    const baseX = new Float32Array(PARTICLE_COUNT);
    const phases = new Float32Array(PARTICLE_COUNT);
    const speeds = new Float32Array(PARTICLE_COUNT);
    for (let i = 0; i < PARTICLE_COUNT; i++) {
      const x = (rand() * 2 - 1) * 5;
      const y = (rand() * 2 - 1) * 3;
      const z = rand() * 5;
      positions[i * 3] = x;
      positions[i * 3 + 1] = y;
      positions[i * 3 + 2] = z;
      baseX[i] = x;
      phases[i] = rand() * Math.PI * 2;
      speeds[i] = 0.6 + rand() * 0.8;
    }

    const particleGeometry = new THREE.BufferGeometry();
    const positionAttribute = new THREE.BufferAttribute(positions, 3);
    particleGeometry.setAttribute("position", positionAttribute);

    const dustTexture = createDustTexture();
    const particleMaterial = new THREE.PointsMaterial({
      color: new THREE.Color(GOLD_RGB.r, GOLD_RGB.g, GOLD_RGB.b),
      size: 0.05,
      sizeAttenuation: true,
      transparent: true,
      opacity: 0.5,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      map: dustTexture,
    });
    const particles = new THREE.Points(particleGeometry, particleMaterial);
    // Positionen mutieren pro Frame, die einmal berechnete Bounding Sphere
    // wuerde veralten: Culling fuer die Partikel abschalten
    particles.frustumCulled = false;
    // Gruppe fuer den Scroll-Offset (Partikel ziehen beim Scrollen nach oben)
    const particleGroup = new THREE.Group();
    particleGroup.add(particles);
    particleScene.add(particleGroup);

    // ---------- Zustand ----------
    const mouseTarget = new THREE.Vector2(0, 0);
    let scrollTarget = 0;
    let scrollCurrent = 0;
    let isInViewport = true;
    let loopRunning = false;
    let rafId = 0;
    // Zeit wird manuell aus geklemmten Deltas akkumuliert: so springt der
    // Scan nach Tab-Pausen nicht (clock.elapsedTime enthielte die Pausenzeit)
    let timeAccum = 0;
    const clock = new THREE.Clock();

    // Roh-Scrollwert: 0 am Seitenanfang, 1 nach 90 Prozent Viewport-Hoehe
    const computeScroll = (): number => {
      const denom = window.innerHeight * 0.9;
      if (denom <= 0) return 0;
      return Math.min(Math.max(window.scrollY / denom, 0), 1);
    };

    // Scrollwert auf Shader und Partikel-Gruppe anwenden
    const applyScroll = (value: number) => {
      uniforms.uScroll.value = value;
      particleGroup.position.y = value * 1.2;
    };

    // Beide Szenen in einem Durchgang rendern: erst Quad (ortho), dann Partikel (persp)
    const renderFrame = () => {
      if (disposed) return;
      renderer.clear();
      renderer.render(quadScene, orthoCamera);
      renderer.render(particleScene, particleCamera);
    };

    // ---------- Animations-Loop (genau EIN requestAnimationFrame-Loop) ----------
    const tick = () => {
      if (disposed || !loopRunning) return;
      rafId = requestAnimationFrame(tick);

      // Delta klemmen, damit nach Tab-Pausen kein Zeitsprung entsteht
      const dt = Math.min(clock.getDelta(), 0.05);
      timeAccum += dt;
      uniforms.uTime.value = timeAccum;

      // Maus sanft nachziehen (gelerpt)
      uniforms.uMouse.value.lerp(mouseTarget, 0.06);

      // Scroll sanft nachziehen (Smooth Scrub)
      scrollCurrent += (scrollTarget - scrollCurrent) * Math.min(1, dt * 6);
      applyScroll(scrollCurrent);

      // Partikel: sehr langsames Aufsteigen mit Wrap plus sanftes seitliches Schweben
      for (let i = 0; i < PARTICLE_COUNT; i++) {
        let y = positions[i * 3 + 1] + dt * 0.05;
        if (y > 3) y -= 6;
        positions[i * 3 + 1] = y;
        positions[i * 3] =
          baseX[i] + Math.sin(timeAccum * 0.25 * speeds[i] + phases[i]) * 0.3;
      }
      positionAttribute.needsUpdate = true;

      // Kamera-Parallaxe: Position sanft Richtung Mausziel lerpen
      particleCamera.position.x +=
        (mouseTarget.x * 0.4 - particleCamera.position.x) * 0.05;
      particleCamera.position.y +=
        (mouseTarget.y * 0.4 - particleCamera.position.y) * 0.05;

      renderFrame();
    };

    const startLoop = () => {
      // Bei reduzierter Bewegung laeuft kein Loop, nur statische Frames
      if (reducedMotion || disposed || loopRunning) return;
      if (document.hidden || !isInViewport) return;
      loopRunning = true;
      // Delta zuruecksetzen, damit die Pause nicht als riesiger Schritt ankommt
      clock.getDelta();
      rafId = requestAnimationFrame(tick);
    };

    const stopLoop = () => {
      loopRunning = false;
      cancelAnimationFrame(rafId);
    };

    // ---------- Listener ----------
    const onScroll = () => {
      scrollTarget = computeScroll();
      if (reducedMotion) {
        // Endwert direkt setzen und genau EINEN Frame rendern (statisch, aber korrekt)
        scrollCurrent = scrollTarget;
        applyScroll(scrollCurrent);
        renderFrame();
      }
    };
    window.addEventListener("scroll", onScroll, { passive: true });

    const onPointerMove = (e: PointerEvent) => {
      const nx = (e.clientX / window.innerWidth) * 2 - 1;
      const ny = -((e.clientY / window.innerHeight) * 2 - 1);
      mouseTarget.set(nx, ny);
    };
    if (!reducedMotion) {
      window.addEventListener("pointermove", onPointerMove, { passive: true });
    }

    const onVisibilityChange = () => {
      if (document.hidden) {
        stopLoop();
      } else {
        startLoop();
      }
    };
    document.addEventListener("visibilitychange", onVisibilityChange);

    // Loop pausieren, wenn der Container den Viewport verlaesst
    const intersectionObserver = new IntersectionObserver((entries) => {
      const entry = entries[0];
      isInViewport = entry ? entry.isIntersecting : true;
      if (isInViewport) {
        startLoop();
      } else {
        stopLoop();
      }
    });
    intersectionObserver.observe(container);

    // ---------- Resize ----------
    const resize = () => {
      if (disposed) return;
      const w = container.clientWidth || 1;
      const h = container.clientHeight || 1;
      renderer.setSize(w, h, false);
      uniforms.uResolution.value.set(w, h);
      particleCamera.aspect = w / h;
      particleCamera.updateProjectionMatrix();
      renderFrame();
    };
    const resizeObserver = new ResizeObserver(() => {
      resize();
    });
    resizeObserver.observe(container);

    // ---------- Textur laden (auch bei src-Wechsel, ohne Szenen-Neuaufbau) ----------
    const textureLoader = new THREE.TextureLoader();
    let loadedTexture: THREE.Texture | null = null;
    // Lade-Token: schnelle src-Wechsel duerfen sich nicht gegenseitig ueberholen
    let loadToken = 0;

    const loadTexture = (url: string) => {
      loadToken += 1;
      const token = loadToken;
      textureLoader.load(url, (texture) => {
        // disposed-Guard: Komponente koennte abgebaut oder src erneut gewechselt sein
        if (disposed || token !== loadToken) {
          texture.dispose();
          return;
        }
        texture.colorSpace = THREE.SRGBColorSpace;
        texture.minFilter = THREE.LinearFilter;
        texture.magFilter = THREE.LinearFilter;
        texture.generateMipmaps = false;
        texture.wrapS = THREE.ClampToEdgeWrapping;
        texture.wrapT = THREE.ClampToEdgeWrapping;
        const image = texture.image as HTMLImageElement | undefined;
        if (image) {
          const iw = image.naturalWidth || image.width;
          const ih = image.naturalHeight || image.height;
          if (iw > 0 && ih > 0) {
            uniforms.uImageAspect.value = iw / ih;
          }
        }
        // Alte Textur freigeben, bevor die neue aktiv wird
        if (loadedTexture) loadedTexture.dispose();
        loadedTexture = texture;
        uniforms.uTexture.value = texture;
        // Nach dem Laden sofort einen Frame rendern
        renderFrame();
      });
    };
    loadTextureRef.current = loadTexture;

    // ---------- Initialzustand ----------
    // Der erste Frame muss fertig aussehen: Scrollwert direkt auf den Endwert
    // setzen (kein Einschwingen), auch wenn der Tab hidden ist oder
    // reduced-motion aktiv ist.
    scrollTarget = computeScroll();
    scrollCurrent = scrollTarget;
    applyScroll(scrollCurrent);
    resize(); // setzt Groesse und rendert den ersten vollstaendigen Frame
    startLoop();

    // ---------- Cleanup ----------
    return () => {
      disposed = true;
      loadTextureRef.current = null;
      stopLoop();
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("pointermove", onPointerMove);
      document.removeEventListener("visibilitychange", onVisibilityChange);
      resizeObserver.disconnect();
      intersectionObserver.disconnect();
      canvas.removeEventListener("webglcontextlost", onContextLost);

      quadGeometry.dispose();
      quadMaterial.dispose();
      particleGeometry.dispose();
      particleMaterial.dispose();
      if (dustTexture) dustTexture.dispose();
      placeholderTexture.dispose();
      if (loadedTexture) loadedTexture.dispose();

      renderer.dispose();
      try {
        renderer.forceContextLoss();
      } catch {
        // Kontextverlust kann je nach Browser fehlschlagen, unkritisch
      }
      if (canvas.parentNode === container) {
        container.removeChild(canvas);
      }
    };
    // Bewusst leere Dependency-Liste: die Szene wird genau einmal aufgebaut,
    // Prop-Updates (src) laufen ueber den separaten Effekt darunter
  }, []);

  // Prop-Effekt: bei src-Aenderung nur die Textur neu laden,
  // die Szene selbst wird NICHT neu aufgebaut
  useEffect(() => {
    loadTextureRef.current?.(src);
  }, [src]);

  return (
    <div
      ref={containerRef}
      className={className}
      aria-hidden="true"
      style={{
        position: "absolute",
        inset: 0,
        width: "100%",
        height: "100%",
      }}
    />
  );
}
