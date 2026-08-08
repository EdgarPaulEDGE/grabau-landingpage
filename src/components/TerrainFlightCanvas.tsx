"use client";

import { useEffect, useRef, type MutableRefObject } from "react";
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/examples/jsm/postprocessing/OutputPass.js";

/**
 * Scroll-gescrubbte Kamerafahrt über echtes Gelände im WFL-Nachtmodell-Look:
 * dunkles Tusche-Gelände mit goldenen Höhenlinien (Vermessungskarten-Ästhetik),
 * goldene Verkehrsachsen, roter Park. Passend zu "Die Achse" und Standortplan.
 *
 * Zwei Datenebenen im selben lokalen Rahmen (Ursprung = Park-Zentrum):
 * - Fernsicht: Copernicus GLO-30 (30-m-Raster, 15 x 18 km)
 * - Nahzone: LiDAR-DGM1 SH (4-m-Raster, 3 x 3 km) mit Gebäuden und Straßen
 * Beim Anflug blendet die Fahrt von der Fern- auf die Nah-Ebene über.
 * Gerendert wird nur, wenn sich der Scroll-Fortschritt ändert.
 */

const EX = 1.6; // vertikale Überhöhung (Sweet Spot aus dem Machbarkeitstest)

const NIGHT = 0x1a1113;
const FOG = 0x251719;
const GOLD = 0xc5a572;

type Frame = { rows: number; cols: number; x0: number; z0: number };
type FarFrame = Frame & { x1: number; z1: number };
type NearFrame = Frame & { cell: number };

/** Bilineares Höhen-Sampling auf einem Int16-Dezimeter-Raster. */
function makeSampler(
  h: Int16Array,
  rows: number,
  cols: number,
  xAt: (c: number) => number,
  zAt: (r: number) => number,
) {
  const cOf = (x: number) => (x - xAt(0)) / (xAt(1) - xAt(0));
  const rOf = (z: number) => (z - zAt(0)) / (zAt(1) - zAt(0));
  return (x: number, z: number): number => {
    const c = Math.max(0, Math.min(cols - 1.001, cOf(x)));
    const r = Math.max(0, Math.min(rows - 1.001, rOf(z)));
    const c0 = Math.floor(c), r0 = Math.floor(r);
    const fu = c - c0, fv = r - r0;
    const i = r0 * cols + c0;
    const h00 = h[i], h10 = h[i + 1], h01 = h[i + cols], h11 = h[i + cols + 1];
    return ((h00 * (1 - fu) + h10 * fu) * (1 - fv) + (h01 * (1 - fu) + h11 * fu) * fv) / 10;
  };
}

/**
 * Gelände-Shader: echtes Luftbild mit Abendlicht-Grading als Basis,
 * warmes Streiflicht aus dem Relief, dezente goldene Höhenlinien darüber.
 * Ohne Textur (uTexAmount 0) fällt er auf den Tusche-Grund zurück.
 */
function terrainMaterial(
  minorStep: number,
  majorStep: number,
  tex: THREE.Texture | null,
  detail?: THREE.Texture | null,
): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: {
      uSunDir: { value: new THREE.Vector3(-0.83, 0.48, 0.28).normalize() },
      uOpacity: { value: 1 },
      uFogColor: { value: new THREE.Color(FOG) },
      uFogNear: { value: 3200 },
      uFogFar: { value: 26000 },
      uMinor: { value: minorStep },
      uMajor: { value: majorStep },
      uGold: { value: new THREE.Color(GOLD) },
      uTex: { value: tex },
      uTexAmount: { value: tex ? 1 : 0 },
      uDetail: { value: detail ?? tex },
      uDetailAmount: { value: detail ? 1 : 0 },
      // Detail-Ausschnitt in Weltmetern: Park-zentriert, 1400 x 1400 m
      uDetailMin: { value: new THREE.Vector2(-700, -700) },
      uDetailInv: { value: 1 / 1400 },
    },
    vertexShader: /* glsl */ `
      attribute float elev;
      varying vec3 vColor;
      varying vec3 vNormal;
      varying float vElev;
      varying float vDist;
      varying vec2 vUv;
      varying vec2 vXZ;
      void main() {
        vColor = color;
        vNormal = normal;
        vElev = elev;
        vUv = uv;
        vXZ = position.xz;
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        vDist = -mv.z;
        gl_Position = projectionMatrix * mv;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 uSunDir;
      uniform float uOpacity;
      uniform vec3 uFogColor;
      uniform float uFogNear;
      uniform float uFogFar;
      uniform float uMinor;
      uniform float uMajor;
      uniform vec3 uGold;
      uniform sampler2D uTex;
      uniform float uTexAmount;
      uniform sampler2D uDetail;
      uniform float uDetailAmount;
      uniform vec2 uDetailMin;
      uniform float uDetailInv;
      varying vec3 vColor;
      varying vec3 vNormal;
      varying float vElev;
      varying float vDist;
      varying vec2 vUv;
      varying vec2 vXZ;

      // Höhenlinie: Abstand zur nächsten Isolinie in Pixeln (fwidth-normiert)
      float contour(float h, float s, float w) {
        float g = abs(fract(h / s - 0.5) - 0.5) * s / max(fwidth(h), 1e-5);
        return 1.0 - min(g / w, 1.0);
      }

      void main() {
        vec3 n = normalize(vNormal);
        float diff = max(dot(n, uSunDir), 0.0);

        vec3 tex = texture2D(uTex, vUv).rgb;

        // Hochauflösender Ausschnitt um den Park, weich eingeblendet
        vec2 duv = (vXZ - uDetailMin) * uDetailInv;
        float dm = smoothstep(0.0, 0.06, duv.x) * smoothstep(0.0, 0.06, 1.0 - duv.x)
                 * smoothstep(0.0, 0.06, duv.y) * smoothstep(0.0, 0.06, 1.0 - duv.y);
        vec3 dtex = texture2D(uDetail, vec2(duv.x, 1.0 - duv.y)).rgb;
        tex = mix(tex, dtex, dm * uDetailAmount);

        // Abendlicht-Grading: abdunkeln, wärmen, entsättigen
        float luma = dot(tex, vec3(0.299, 0.587, 0.114));
        tex = mix(tex, vec3(luma), 0.24);
        tex *= vec3(1.08, 0.9, 0.72) * 0.62;

        vec3 base = mix(vColor, tex, uTexAmount);
        vec3 col = base * (0.62 + 1.1 * diff * vec3(1.0, 0.88, 0.7));

        // Vermessungs-Signatur: feine Linien nah, kräftige auch fern
        float nearFade = 1.0 - smoothstep(uFogNear * 0.4, uFogNear * 1.1, vDist);
        float minorA = mix(0.24, 0.1, uTexAmount);
        float majorA = mix(0.5, 0.22, uTexAmount);
        col = mix(col, uGold * 0.85, contour(vElev, uMinor, 1.1) * minorA * nearFade);
        col = mix(col, uGold, contour(vElev, uMajor, 1.3) * majorA);

        float fog = smoothstep(uFogNear, uFogFar, vDist);
        col = mix(col, uFogColor, fog);
        gl_FragColor = vec4(col, uOpacity);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }
    `,
    vertexColors: true,
    transparent: true,
  });
}

/**
 * Kronendecke: kompaktes Grid-Mesh nur über Vegetationszellen. Die Höhen
 * stammen aus bDOM minus DGM, die Textur ist dasselbe Luftbild — die
 * fotografierten Baumkronen werden also physisch angehoben.
 */
function buildCanopy(
  canopy: Uint8Array,
  grid: number,
  cell: number,
  x0: number,
  z0: number,
  groundY: (x: number, z: number) => number,
  material: THREE.ShaderMaterial,
  stride: number,
): THREE.Mesh | null {
  const G = Math.floor((grid - 1) / stride) + 1;
  const at = (rr: number, cc: number) =>
    canopy[Math.min(grid - 1, rr * stride) * grid + Math.min(grid - 1, cc * stride)];
  // Zellen mit Vegetation oder Vegetations-Nachbarn bekommen einen Vertex
  const vid = new Int32Array(G * G).fill(-1);
  let count = 0;
  for (let r = 0; r < G; r++) {
    for (let c = 0; c < G; c++) {
      let keep = at(r, c) > 0;
      if (!keep) {
        keep =
          (r > 0 && at(r - 1, c) > 0) || (r < G - 1 && at(r + 1, c) > 0) ||
          (c > 0 && at(r, c - 1) > 0) || (c < G - 1 && at(r, c + 1) > 0);
      }
      if (keep) vid[r * G + c] = count++;
    }
  }
  if (count === 0) return null;
  const pos = new Float32Array(count * 3);
  const col = new Float32Array(count * 3);
  const elev = new Float32Array(count);
  const uv = new Float32Array(count * 2);
  const size = grid * cell;
  for (let r = 0; r < G; r++) {
    for (let c = 0; c < G; c++) {
      const id = vid[r * G + c];
      if (id < 0) continue;
      const x = x0 + Math.min(grid - 1, c * stride) * cell + cell / 2;
      const z = z0 + Math.min(grid - 1, r * stride) * cell + cell / 2;
      const h = at(r, c) / 4;
      pos[id * 3] = x;
      pos[id * 3 + 1] = groundY(x, z) + h * EX + 0.4;
      pos[id * 3 + 2] = z;
      elev[id] = h;
      uv[id * 2] = (x - x0) / size;
      uv[id * 2 + 1] = 1 - (z - z0) / size;
      // Fallback-Farbe ohne Textur: dunkles Grün
      col[id * 3] = 0.16; col[id * 3 + 1] = 0.2; col[id * 3 + 2] = 0.12;
    }
  }
  const idx: number[] = [];
  for (let r = 0; r < G - 1; r++) {
    for (let c = 0; c < G - 1; c++) {
      const a = vid[r * G + c], b = vid[r * G + c + 1];
      const d = vid[(r + 1) * G + c], e = vid[(r + 1) * G + c + 1];
      if (a < 0 || b < 0 || d < 0 || e < 0) continue;
      idx.push(a, d, b, b, d, e);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  geo.setAttribute("color", new THREE.BufferAttribute(col, 3));
  geo.setAttribute("elev", new THREE.BufferAttribute(elev, 1));
  geo.setAttribute("uv", new THREE.BufferAttribute(uv, 2));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  return new THREE.Mesh(geo, material);
}

/** Geländefläche als indiziertes Grid mit Höhenfarbrampe und Höhen-Attribut. */
function buildTerrain(
  h: Int16Array,
  rows: number,
  cols: number,
  xAt: (c: number) => number,
  zAt: (r: number) => number,
  ramp: [number, THREE.Color][],
  yLift: number,
  stride: number,
  material: THREE.ShaderMaterial,
): THREE.Mesh {
  const R = Math.floor((rows - 1) / stride) + 1;
  const C = Math.floor((cols - 1) / stride) + 1;
  const pos = new Float32Array(R * C * 3);
  const col = new Float32Array(R * C * 3);
  const elev = new Float32Array(R * C);
  const uv = new Float32Array(R * C * 2);
  const color = (hm: number): THREE.Color => {
    for (let i = 1; i < ramp.length; i++) {
      if (hm <= ramp[i][0]) {
        const t = (hm - ramp[i - 1][0]) / (ramp[i][0] - ramp[i - 1][0]);
        return ramp[i - 1][1].clone().lerp(ramp[i][1], Math.max(0, Math.min(1, t)));
      }
    }
    return ramp[ramp.length - 1][1];
  };
  let k = 0;
  for (let rr = 0; rr < R; rr++) {
    const r = Math.min(rows - 1, rr * stride);
    for (let cc = 0; cc < C; cc++, k++) {
      const c = Math.min(cols - 1, cc * stride);
      const hm = h[r * cols + c] / 10;
      pos[k * 3] = xAt(c);
      pos[k * 3 + 1] = hm * EX + yLift;
      pos[k * 3 + 2] = zAt(r);
      elev[k] = hm;
      uv[k * 2] = c / (cols - 1);
      uv[k * 2 + 1] = 1 - r / (rows - 1); // Zeile 0 = Norden = Bildoberkante
      const cl = color(hm);
      col[k * 3] = cl.r; col[k * 3 + 1] = cl.g; col[k * 3 + 2] = cl.b;
    }
  }
  const idx = new Uint32Array((R - 1) * (C - 1) * 6);
  let j = 0;
  for (let r = 0; r < R - 1; r++) {
    for (let c = 0; c < C - 1; c++) {
      const a = r * C + c, b = a + 1, d = a + C, e = d + 1;
      idx[j++] = a; idx[j++] = d; idx[j++] = b;
      idx[j++] = b; idx[j++] = d; idx[j++] = e;
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  geo.setAttribute("color", new THREE.BufferAttribute(col, 3));
  geo.setAttribute("elev", new THREE.BufferAttribute(elev, 1));
  geo.setAttribute("uv", new THREE.BufferAttribute(uv, 2));
  geo.setIndex(new THREE.BufferAttribute(idx, 1));
  geo.computeVertexNormals();
  return new THREE.Mesh(geo, material);
}

/** Straßen-Polylinie als Band, auf das Gelände gelegt. */
function ribbon(
  pts: number[][],
  w: number,
  lift: number,
  color: number,
  sample: (x: number, z: number) => number,
): THREE.Mesh | null {
  const n = pts.length;
  if (n < 2) return null;
  const pos = new Float32Array(n * 2 * 3);
  for (let i = 0; i < n; i++) {
    const [x, z] = pts[i];
    const [xp, zp] = pts[Math.max(0, i - 1)];
    const [xn, zn] = pts[Math.min(n - 1, i + 1)];
    let dx = xn - xp, dz = zn - zp;
    const L = Math.hypot(dx, dz) || 1;
    dx /= L; dz /= L;
    const ox = (-dz * w) / 2, oz = (dx * w) / 2;
    pos.set([x + ox, sample(x + ox, z + oz) * EX + lift, z + oz], i * 6);
    pos.set([x - ox, sample(x - ox, z - oz) * EX + lift, z - oz], i * 6 + 3);
  }
  const idx: number[] = [];
  for (let i = 0; i < n - 1; i++) {
    const a = i * 2;
    idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  geo.setIndex(idx);
  return new THREE.Mesh(
    geo,
    new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      side: THREE.DoubleSide,
      depthWrite: false,
      fog: true,
    }),
  );
}

/** Text-Sprite (Canvas-Textur), Größe in Weltmetern. */
function makeLabel(
  text: string,
  x: number,
  z: number,
  y: number,
  size: number,
  colorCss: string,
): THREE.Sprite {
  const measure = document.createElement("canvas").getContext("2d")!;
  measure.font = "700 64px system-ui, sans-serif";
  const wpx = Math.ceil(measure.measureText(text).width) + 40;
  const cv = document.createElement("canvas");
  cv.width = wpx; cv.height = 96;
  const c = cv.getContext("2d")!;
  c.font = "700 64px system-ui, sans-serif";
  c.shadowColor = "rgba(0,0,0,.9)"; c.shadowBlur = 14;
  c.fillStyle = colorCss;
  c.textBaseline = "middle";
  c.fillText(text, 20, 48);
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  const sp = new THREE.Sprite(
    new THREE.SpriteMaterial({ map: tex, depthTest: false, transparent: true }),
  );
  sp.scale.set((size * (cv.width / cv.height)) / 6.5, (size / 6.5) * 1.5, 1);
  sp.position.set(x, y, z);
  return sp;
}

const smooth = (t: number, a: number, b: number) => {
  const s = Math.max(0, Math.min(1, (t - a) / (b - a)));
  return s * s * (3 - 2 * s);
};

/** Deckkraft setzen, egal ob Standard- oder Shader-Material. */
function setOpacity(m: THREE.Material, value: number) {
  const sm = m as THREE.ShaderMaterial;
  if (sm.uniforms && sm.uniforms.uOpacity) sm.uniforms.uOpacity.value = value;
  else (m as THREE.MeshBasicMaterial).opacity = value;
}

export default function TerrainFlightCanvas({
  progressRef,
  onFail,
}: {
  progressRef: MutableRefObject<number>;
  onFail: () => void;
}) {
  const hostRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    let disposed = false;
    let renderer: THREE.WebGLRenderer | null = null;
    let raf = 0;
    const disposables: { dispose: () => void }[] = [];

    (async () => {
      try {
        const loader = new THREE.TextureLoader();
        const loadTex = (url: string) =>
          loader.loadAsync(url).then(
            (t) => {
              t.colorSpace = THREE.SRGBColorSpace;
              t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
              return t;
            },
            () => null, // ohne Luftbild fällt der Shader auf den Tusche-Grund zurück
          );
        const [farBuf, nearBuf, canopyBuf, farScene, nearScene, farTex, nearTex, detailTex] =
          await Promise.all([
            fetch("/terrain/far.bin").then((r) => r.arrayBuffer()),
            fetch("/terrain/near.bin").then((r) => r.arrayBuffer()),
            fetch("/terrain/canopy.bin").then((r) => r.arrayBuffer()).catch(() => null),
            fetch("/terrain/far-scene.json").then((r) => r.json()),
            fetch("/terrain/near-scene.json").then((r) => r.json()),
            loadTex("/terrain/far-tex.jpg"),
            loadTex("/terrain/near-tex.jpg"),
            loadTex("/terrain/detail-tex.jpg"),
          ]);
        if (disposed) return;

        const isMobile = window.innerWidth < 768;
        const stride = isMobile ? 2 : 1;

        renderer = new THREE.WebGLRenderer({ antialias: !isMobile, powerPreference: "high-performance" });
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, isMobile ? 1.25 : 1.6));
        renderer.toneMapping = THREE.ACESFilmicToneMapping;
        renderer.toneMappingExposure = 1.3;
        renderer.domElement.style.position = "absolute";
        renderer.domElement.style.inset = "0";
        host.appendChild(renderer.domElement);

        // Schärfe bei flachen Blickwinkeln (Luftbild-Texturen)
        const aniso = Math.min(8, renderer.capabilities.getMaxAnisotropy());
        for (const t of [farTex, nearTex, detailTex]) if (t) t.anisotropy = aniso;

        const scene = new THREE.Scene();
        // Himmel im Farbklima der Seite: Nacht oben, warmer Schimmer am Horizont
        const skyCv = document.createElement("canvas");
        skyCv.width = 2; skyCv.height = 256;
        const sctx = skyCv.getContext("2d")!;
        const grad = sctx.createLinearGradient(0, 0, 0, 256);
        grad.addColorStop(0, "#0f0a0c");
        grad.addColorStop(0.62, "#1a1113");
        grad.addColorStop(0.9, "#2a1b16");
        grad.addColorStop(1, "#382413");
        sctx.fillStyle = grad;
        sctx.fillRect(0, 0, 2, 256);
        const skyTex = new THREE.CanvasTexture(skyCv);
        skyTex.colorSpace = THREE.SRGBColorSpace;
        scene.background = skyTex;
        scene.fog = new THREE.Fog(FOG, 3200, 26000);

        const camera = new THREE.PerspectiveCamera(50, 1, 4, 60000);

        // Bloom auf den hellsten Bildstellen (goldene Straßen/Konturen/Sonnenglanz).
        // Schwelle bewusst hoch, damit der Effekt eine Signatur bleibt statt
        // die gesamte Landschaft zu überstrahlen. Auf Mobile ausgelassen
        // (Kosten eines zweiten Offscreen-Renders bei begrenztem GPU-Budget).
        let composer: EffectComposer | null = null;
        if (!isMobile) {
          composer = new EffectComposer(renderer);
          composer.addPass(new RenderPass(scene, camera));
          const bloom = new UnrealBloomPass(new THREE.Vector2(1, 1), 0.7, 0.4, 0.72);
          composer.addPass(bloom);
          composer.addPass(new OutputPass());
          disposables.push({ dispose: () => composer!.dispose() });
        }
        // Lichter für Lambert-Materialien (Gebäude); Gelände beleuchtet der Shader
        scene.add(new THREE.HemisphereLight(0x4a3a48, 0x241a14, 1.2));
        const sun = new THREE.DirectionalLight(0xffd9a0, 1.8);
        sun.position.set(-8300, 4800, 2800);
        scene.add(sun);

        // ---- Fern-Ebene (Copernicus): Tusche-Grund, Konturen 10 m / 50 m
        const ff = farScene.frame as FarFrame;
        const farH = new Int16Array(farBuf);
        const fx = (c: number) => ff.x0 + ((ff.x1 - ff.x0) * c) / (ff.cols - 1);
        const fz = (r: number) => ff.z0 + ((ff.z1 - ff.z0) * r) / (ff.rows - 1);
        const farSample = makeSampler(farH, ff.rows, ff.cols, fx, fz);
        const farRamp: [number, THREE.Color][] = [
          [6, new THREE.Color(0x241a1d)], [30, new THREE.Color(0x302326)],
          [55, new THREE.Color(0x3d2f2b)], [80, new THREE.Color(0x4a3a30)],
          [109, new THREE.Color(0x584636)],
        ];
        const farMat = terrainMaterial(10, 50, farTex);
        const farTerrain = buildTerrain(farH, ff.rows, ff.cols, fx, fz, farRamp, 0, stride, farMat);
        scene.add(farTerrain);
        disposables.push(farTerrain.geometry, farMat);

        const FAR_STYLE: Record<string, [number, number, number]> = {
          a24: [42, 8, 0xffdf9e], b207: [30, 7, 0xf5cd85],
          bundes: [22, 6, 0x9b8050], neben: [13, 5, 0x635642], bahn: [7, 5, 0x8a8a92],
        };
        const farRoads = new THREE.Group();
        for (const r of farScene.roads) {
          const [w, lift, color] = FAR_STYLE[r.c];
          const m = ribbon(r.p, w, lift, color, farSample);
          if (m) { farRoads.add(m); disposables.push(m.geometry); }
        }
        scene.add(farRoads);

        const farLabels = new THREE.Group();
        for (const l of farScene.labels) {
          farLabels.add(makeLabel(l.t, l.x, l.z, farSample(l.x, l.z) * EX + 320, 620, "#efe3c6"));
        }
        scene.add(farLabels);

        // ---- Nah-Ebene (LiDAR + OSM): Konturen 2 m / 10 m
        const nf = nearScene.frame as NearFrame;
        const nearH = new Int16Array(nearBuf);
        const nx = (c: number) => nf.x0 + c * nf.cell + nf.cell / 2;
        const nz = (r: number) => nf.z0 + r * nf.cell + nf.cell / 2;
        const nearSample = makeSampler(nearH, nf.rows, nf.cols, nx, nz);
        const NEAR_LIFT = 1.4;
        const nearGroup = new THREE.Group();
        const nearRamp: [number, THREE.Color][] = [
          [32, new THREE.Color(0x2d2124)], [43, new THREE.Color(0x3a2c2a)],
          [54, new THREE.Color(0x483830)],
        ];
        const nearMatT = terrainMaterial(2, 10, nearTex, detailTex);
        const nearTerrain = buildTerrain(
          nearH, nf.rows, nf.cols, nx, nz, nearRamp, NEAR_LIFT, stride, nearMatT,
        );
        nearTerrain.renderOrder = 1;
        nearGroup.add(nearTerrain);
        disposables.push(nearTerrain.geometry, nearMatT);

        const NEAR_STYLE: Record<string, [number, number, number]> = {
          b207: [14, 2.6, 0xf5cd85], tert: [9, 2.4, 0x9b8050],
          wohn: [6.5, 2.2, 0x746550], service: [4.5, 2.1, 0x5c5242], track: [3, 2.0, 0x484238],
        };
        for (const r of nearScene.roads) {
          const [w, lift, color] = NEAR_STYLE[r.c];
          const m = ribbon(r.p, w, lift, color, nearSample);
          if (m) { m.renderOrder = 2; nearGroup.add(m); disposables.push(m.geometry); }
        }

        // Gebäude zu einer Geometrie zusammenfassen (ein Draw-Call).
        // Jedes Gebäude trägt seine echte Dachfarbe aus dem Luftbild.
        {
          const geos: THREE.BufferGeometry[] = [];
          for (const b of nearScene.buildings) {
            const base =
              Math.min(...b.p.map(([x, z]: number[]) => nearSample(x, z))) * EX + NEAR_LIFT - 0.6;
            const shape = new THREE.Shape(
              b.p.map(([x, z]: number[]) => new THREE.Vector2(x, -z)),
            );
            const g = new THREE.ExtrudeGeometry(shape, { depth: b.h * EX, bevelEnabled: false });
            g.rotateX(-Math.PI / 2);
            g.translate(0, base, 0);
            // Dachfarbe mit Abend-Grading als konstantes Farb-Attribut
            const rc = b.c ?? [120, 110, 100];
            const cr = (rc[0] / 255) * 0.75, cg = (rc[1] / 255) * 0.66, cb = (rc[2] / 255) * 0.56;
            const n = g.attributes.position.count;
            const ca = new Float32Array(n * 3);
            for (let i = 0; i < n; i++) {
              ca[i * 3] = cr; ca[i * 3 + 1] = cg; ca[i * 3 + 2] = cb;
            }
            g.setAttribute("color", new THREE.BufferAttribute(ca, 3));
            geos.push(g);
          }
          const merged = mergeGeometries(geos, false);
          geos.forEach((g) => g.dispose());
          if (merged) {
            merged.computeVertexNormals();
            const mesh = new THREE.Mesh(
              merged,
              new THREE.MeshLambertMaterial({ vertexColors: true, transparent: true }),
            );
            mesh.renderOrder = 2;
            nearGroup.add(mesh);
            disposables.push(merged);
          }
        }

        // Kronendecke: echte Baum- und Knickhöhen (bDOM minus DGM),
        // texturiert mit denselben Luftbildern wie der Boden
        if (canopyBuf) {
          const canopyMat = terrainMaterial(1e6, 1e6, nearTex, detailTex);
          const canopyMesh = buildCanopy(
            new Uint8Array(canopyBuf), 1500, 2, nf.x0, nf.z0,
            (x, z) => nearSample(x, z) * EX + NEAR_LIFT,
            canopyMat, stride,
          );
          if (canopyMesh) {
            canopyMesh.renderOrder = 2;
            nearGroup.add(canopyMesh);
            disposables.push(canopyMesh.geometry, canopyMat);
          }
        }

        // Parkfläche: rote Fläche + goldene Kontur, dem Gelände folgend
        {
          const shape = new THREE.Shape(
            nearScene.park.map(([x, z]: number[]) => new THREE.Vector2(x, -z)),
          );
          const geo = new THREE.ShapeGeometry(shape, 2);
          geo.rotateX(-Math.PI / 2);
          const pa = geo.attributes.position;
          for (let i = 0; i < pa.count; i++) {
            pa.setY(i, nearSample(pa.getX(i), pa.getZ(i)) * EX + NEAR_LIFT + 1.6);
          }
          const fill = new THREE.Mesh(
            geo,
            new THREE.MeshBasicMaterial({
              color: 0xa8232c, transparent: true, opacity: 0.42,
              side: THREE.DoubleSide, depthWrite: false,
            }),
          );
          fill.renderOrder = 3;
          nearGroup.add(fill);
          disposables.push(geo);
          const outlinePts = nearScene.park.map(
            ([x, z]: number[]) =>
              new THREE.Vector3(x, nearSample(x, z) * EX + NEAR_LIFT + 2.2, z),
          );
          const og = new THREE.BufferGeometry().setFromPoints([...outlinePts, outlinePts[0]]);
          const outline = new THREE.Line(
            og,
            new THREE.LineBasicMaterial({ color: 0xe0c084, transparent: true }),
          );
          outline.renderOrder = 3;
          nearGroup.add(outline);
          disposables.push(og);
        }
        const parkLabel = makeLabel(
          "GRABAUER RUHM", 0, -60, nearSample(0, -60) * EX + 120, 300, "#ffd98f",
        );
        nearGroup.add(parkLabel);
        scene.add(nearGroup);

        // ---- Kamerapfad (Catmull-Rom durch Position und Blickziel)
        const parkY = nearSample(0, 0) * EX;
        const posCurve = new THREE.CatmullRomCurve3([
          new THREE.Vector3(5000, parkY + 4300, 7800),
          new THREE.Vector3(2600, parkY + 2300, 4300),
          new THREE.Vector3(900, parkY + 700, 1500),
          new THREE.Vector3(240, parkY + 230, 520),
          new THREE.Vector3(-300, parkY + 130, 330),
        ]);
        const tgtCurve = new THREE.CatmullRomCurve3([
          new THREE.Vector3(0, parkY - 40, -2200),
          new THREE.Vector3(0, parkY - 8, -600),
          new THREE.Vector3(0, parkY, -150),
          new THREE.Vector3(-30, parkY + 1, -70),
          new THREE.Vector3(10, parkY + 1, -35),
        ]);

        // Material-Sammlungen für die Überblendung
        const nearMats: THREE.Material[] = [];
        nearGroup.traverse((o) => {
          const mesh = o as THREE.Mesh;
          if (mesh.material) nearMats.push(mesh.material as THREE.Material);
        });
        const farFadeMats: THREE.Material[] = [];
        farRoads.traverse((o) => {
          const mesh = o as THREE.Mesh;
          if (mesh.material) farFadeMats.push(mesh.material as THREE.Material);
        });
        farLabels.children.forEach((s) => farFadeMats.push((s as THREE.Sprite).material));

        for (const m of nearMats) {
          const basic = m as THREE.MeshBasicMaterial;
          m.userData.baseOpacity = typeof basic.opacity === "number" ? basic.opacity : 1;
        }

        const resize = () => {
          if (!renderer) return;
          const w = host.clientWidth, h = host.clientHeight;
          renderer.setSize(w, h);
          composer?.setSize(w, h);
          camera.aspect = w / h;
          camera.updateProjectionMatrix();
          lastP = -1;
        };
        const ro = new ResizeObserver(resize);
        ro.observe(host);
        disposables.push({ dispose: () => ro.disconnect() });

        let visible = true;
        const io = new IntersectionObserver(([e]) => { visible = e.isIntersecting; });
        io.observe(host);
        disposables.push({ dispose: () => io.disconnect() });

        // Sanftes Rollen in den Kurven (Grad, an Stützstellen des Pfads)
        const ROLL_T = [0, 0.3, 0.55, 0.8, 1];
        const ROLL_V = [0, -2.6, 2.9, -1.6, 0];
        const rollAt = (p: number) => {
          for (let i = 1; i < ROLL_T.length; i++) {
            if (p <= ROLL_T[i]) {
              const t = (p - ROLL_T[i - 1]) / (ROLL_T[i] - ROLL_T[i - 1]);
              const s = t * t * (3 - 2 * t);
              return ((ROLL_V[i - 1] + (ROLL_V[i] - ROLL_V[i - 1]) * s) * Math.PI) / 180;
            }
          }
          return 0;
        };

        let lastP = -1;
        const pos = new THREE.Vector3();
        const tgt = new THREE.Vector3();
        const tick = () => {
          raf = requestAnimationFrame(tick);
          if (!visible || !renderer) return;
          const p = Math.max(0, Math.min(1, progressRef.current));
          if (Math.abs(p - lastP) < 1e-4) return;
          lastP = p;

          posCurve.getPoint(p, pos);
          tgtCurve.getPoint(p, tgt);
          camera.position.copy(pos);
          camera.lookAt(tgt);
          camera.rotateZ(rollAt(p));

          const nearO = smooth(p, 0.26, 0.5);
          const farO = 1 - smooth(p, 0.34, 0.6);
          nearGroup.visible = nearO > 0.01;
          for (const m of nearMats) {
            const b = typeof m.userData.baseOpacity === "number" ? m.userData.baseOpacity : 1;
            setOpacity(m, nearO * b);
          }
          farRoads.visible = farO > 0.01;
          farLabels.visible = farO > 0.01;
          for (const m of farFadeMats) setOpacity(m, farO);

          // Park-Label bei der Landung ausblenden (Text-Schritt übernimmt)
          parkLabel.material.opacity = nearO * (1 - smooth(p, 0.78, 0.92));

          if (composer) composer.render();
          else renderer.render(scene, camera);
        };

        resize();
        tick();
      } catch (err) {
        console.error("TerrainFlight konnte nicht starten:", err);
        onFail();
      }
    })();

    return () => {
      disposed = true;
      cancelAnimationFrame(raf);
      for (const d of disposables) d.dispose();
      if (renderer) {
        renderer.dispose();
        renderer.domElement.remove();
      }
    };
    // progressRef und onFail sind stabile Refs/Callbacks
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return <div ref={hostRef} className="absolute inset-0" aria-hidden="true" />;
}
