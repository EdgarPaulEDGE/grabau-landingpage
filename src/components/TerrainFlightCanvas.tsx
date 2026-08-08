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
// Park-Deckkraft: deutlich unter dem früheren flachen 0.42-Wash (wirkte wie
// eine Gefahrenzone), aber hoch genug, um gegen die warme Landungs-Grading
// noch als klar erkennbare wein-rote Markierung zu lesen (0.16 verschwand
// dort praktisch, siehe Verifikation mit erzwungenem Debug-Render).
const PARK_FILL_OPACITY = 0.3;

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
      // Zeit-Dramaturgie (siehe LIGHT_STOPS): Sonnenfarbe und Grading werden
      // pro Scroll-Frame überschrieben. Startwerte entsprechen dem bisherigen
      // statischen Look, falls vor dem ersten tick() gerendert wird.
      uSunColor: { value: new THREE.Color(1.0, 0.88, 0.7) },
      uGradeTint: { value: new THREE.Vector3(1.08 * 0.62, 0.9 * 0.62, 0.72 * 0.62) },
      uGradeDesat: { value: 0.24 },
      // Dynamische Überhöhungs-Korrektur (nur nah/Kronendecke angesteuert,
      // fern bleibt immer 0): reduziert die vertikale Übertreibung, je näher
      // die Landung rückt, damit Hecken und Feldkanten dort nicht wie
      // aufgeschüttete Erdwälle wirken. Pivot-relativ um die Park-Referenzhöhe,
      // sonst verschiebt sich die absolute Meereshöhe (~30-54 m) um zig Meter
      // statt nur die lokale Unruhe zu glätten.
      uExAdjust: { value: 0 },
      uExPivot: { value: 0 },
    },
    vertexShader: /* glsl */ `
      attribute float elev;
      attribute float groundElev;
      attribute float edgeFade;
      uniform float uExAdjust;
      uniform float uExPivot;
      varying vec3 vColor;
      varying vec3 vNormal;
      varying float vElev;
      varying float vDist;
      varying vec2 vUv;
      varying vec2 vXZ;
      varying float vEdgeFade;
      void main() {
        vColor = color;
        vNormal = normal;
        vElev = elev;
        vUv = uv;
        vEdgeFade = edgeFade;
        // Nur die Abweichung von der Park-Referenzhöhe (Pivot) wird gestaucht,
        // nicht die absolute Meereshöhe selbst — sonst sackt bei Terrain UND
        // Kronendecke gleichermaßen die gesamte Fläche um zig Meter ab, statt
        // nur lokale Unruhe (Hügel/Senken/Hecken relativ zum Pivot) zu glätten.
        vec3 pos = position + vec3(0.0, (groundElev - uExPivot) * uExAdjust, 0.0);
        vXZ = pos.xz;
        vec4 mv = modelViewMatrix * vec4(pos, 1.0);
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
      uniform vec3 uSunColor;
      uniform vec3 uGradeTint;
      uniform float uGradeDesat;
      varying vec3 vColor;
      varying vec3 vNormal;
      varying float vElev;
      varying float vDist;
      varying vec2 vUv;
      varying vec2 vXZ;
      varying float vEdgeFade;

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

        // Zeit-Grading: Entsättigung, Warmton und Sonnenfarbe kommen aus
        // Uniforms, damit sie mit dem Scroll-Fortschritt von kühler
        // Dämmerung zu warmem Gold wandern können (siehe LIGHT_STOPS).
        float luma = dot(tex, vec3(0.299, 0.587, 0.114));
        tex = mix(tex, vec3(luma), uGradeDesat);
        tex *= uGradeTint;

        vec3 base = mix(vColor, tex, uTexAmount);
        vec3 col = base * (0.62 + 1.1 * diff * uSunColor);

        // Vermessungs-Signatur: feine Linien nah, kräftige auch fern
        float nearFade = 1.0 - smoothstep(uFogNear * 0.4, uFogNear * 1.1, vDist);
        float minorA = mix(0.24, 0.1, uTexAmount);
        float majorA = mix(0.5, 0.22, uTexAmount);
        col = mix(col, uGold * 0.85, contour(vElev, uMinor, 1.1) * minorA * nearFade);
        col = mix(col, uGold, contour(vElev, uMajor, 1.3) * majorA);

        float fog = smoothstep(uFogNear, uFogFar, vDist);
        col = mix(col, uFogColor, fog);
        // Rand-Auflösung: Gelände löst sich am Kartenrand in den Himmel auf,
        // statt als harte Silhouette gegen eine leere Fläche zu stehen.
        gl_FragColor = vec4(col, uOpacity * vEdgeFade);
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
  rawGroundSample: (x: number, z: number) => number,
  groundLift: number,
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
  // Roh-Bodenhöhe je Vertex (unskaliert): erlaubt es dem Shader, Boden- und
  // Kronenanteil der Überhöhung gemeinsam zurückzunehmen (uExAdjust), statt
  // dass die Kronendecke vom flacher werdenden Gelände abhebt.
  const groundElev = new Float32Array(count);
  const edgeFade = new Float32Array(count).fill(1);
  const uv = new Float32Array(count * 2);
  const size = grid * cell;
  for (let r = 0; r < G; r++) {
    for (let c = 0; c < G; c++) {
      const id = vid[r * G + c];
      if (id < 0) continue;
      const x = x0 + Math.min(grid - 1, c * stride) * cell + cell / 2;
      const z = z0 + Math.min(grid - 1, r * stride) * cell + cell / 2;
      const h = at(r, c) / 4;
      const gy = rawGroundSample(x, z);
      pos[id * 3] = x;
      pos[id * 3 + 1] = gy * EX + groundLift + h * EX + 0.4;
      pos[id * 3 + 2] = z;
      elev[id] = h;
      groundElev[id] = gy;
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
  geo.setAttribute("groundElev", new THREE.BufferAttribute(groundElev, 1));
  geo.setAttribute("edgeFade", new THREE.BufferAttribute(edgeFade, 1));
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
  edgeBand = 0,
): THREE.Mesh {
  const R = Math.floor((rows - 1) / stride) + 1;
  const C = Math.floor((cols - 1) / stride) + 1;
  const pos = new Float32Array(R * C * 3);
  const col = new Float32Array(R * C * 3);
  const elev = new Float32Array(R * C);
  // Für Terrain identisch mit `elev` (absolute Geländehöhe) — als eigenes
  // Attribut geführt, damit dieselbe Pivot-relative uExAdjust-Formel im
  // Shader für Terrain UND Kronendecke funktioniert (dort trägt groundElev
  // die Bodenhöhe unter der Krone, `elev` bleibt die reine Kronenhöhe).
  const groundElev = new Float32Array(R * C);
  // Deckkraft-Rampe zum Kartenrand: löst die Silhouette in den Himmel auf,
  // statt sie als harte Kante gegen die Hintergrundfarbe stehen zu lassen.
  const edgeFade = new Float32Array(R * C);
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
      groundElev[k] = hm;
      uv[k * 2] = c / (cols - 1);
      uv[k * 2 + 1] = 1 - r / (rows - 1); // Zeile 0 = Norden = Bildoberkante
      const cl = color(hm);
      col[k * 3] = cl.r; col[k * 3 + 1] = cl.g; col[k * 3 + 2] = cl.b;
      if (edgeBand > 0) {
        const d = Math.min(rr, R - 1 - rr, cc, C - 1 - cc);
        const t = Math.min(1, d / edgeBand);
        edgeFade[k] = t * t * (3 - 2 * t);
      } else {
        edgeFade[k] = 1;
      }
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
  geo.setAttribute("groundElev", new THREE.BufferAttribute(groundElev, 1));
  geo.setAttribute("edgeFade", new THREE.BufferAttribute(edgeFade, 1));
  geo.setAttribute("uv", new THREE.BufferAttribute(uv, 2));
  geo.setIndex(new THREE.BufferAttribute(idx, 1));
  geo.computeVertexNormals();
  return new THREE.Mesh(geo, material);
}

/**
 * Straßen-Polylinie als Band, auf das Gelände gelegt. Die Fahrbahndecke
 * schwebt weiterhin `lift` Meter über dem Rohgelände. Zusätzlich läuft an
 * beiden Rändern eine schmale Schulter nach außen, die auf die tatsächliche
 * Geländeoberfläche zurückfällt (Rohhöhe plus groundLift, derselbe Lift-Wert,
 * den die jeweilige Terrain-Ebene selbst benutzt) und dabei zu einem
 * Schattenton abdunkelt — schließt die früher sichtbare Lücke unter der
 * Fahrbahnkante geometrisch, statt sie nur mit Alpha zu kaschieren.
 * `fadeAt` blendet optional zum Kartenrand hin aus (nur für die Fernebene
 * genutzt, damit Straßen nicht über die jetzt in den Himmel auflösende
 * Geländekante hinaus sichtbar bleiben).
 */
function ribbon(
  pts: number[][],
  w: number,
  lift: number,
  color: number,
  sample: (x: number, z: number) => number,
  groundLift = 0,
  fadeAt?: (x: number, z: number) => number,
  shoulderW = Math.max(1.2, w * 0.55),
): THREE.Mesh | null {
  const n = pts.length;
  if (n < 2) return null;
  const rc = new THREE.Color(color);
  const sc = rc.clone().multiplyScalar(0.3).lerp(new THREE.Color(FOG), 0.45);
  const hw = w / 2, ow = hw + shoulderW;
  const pos = new Float32Array(n * 4 * 3);
  const col = new Float32Array(n * 4 * 4); // RGBA (itemSize 4) für die Rand-Ausblendung
  for (let i = 0; i < n; i++) {
    const [x, z] = pts[i];
    const [xp, zp] = pts[Math.max(0, i - 1)];
    const [xn, zn] = pts[Math.min(n - 1, i + 1)];
    let dx = xn - xp, dz = zn - zp;
    const L = Math.hypot(dx, dz) || 1;
    dx /= L; dz /= L;
    const nx = -dz, nz = dx;
    const a = fadeAt ? fadeAt(x, z) : 1;

    const oxL = x + nx * ow, ozL = z + nz * ow;
    pos.set([oxL, sample(oxL, ozL) * EX + groundLift + 0.05, ozL], i * 12);
    col.set([sc.r, sc.g, sc.b, a], i * 16);

    const ixL = x + nx * hw, izL = z + nz * hw;
    pos.set([ixL, sample(ixL, izL) * EX + lift, izL], i * 12 + 3);
    col.set([rc.r, rc.g, rc.b, a], i * 16 + 4);

    const ixR = x - nx * hw, izR = z - nz * hw;
    pos.set([ixR, sample(ixR, izR) * EX + lift, izR], i * 12 + 6);
    col.set([rc.r, rc.g, rc.b, a], i * 16 + 8);

    const oxR = x - nx * ow, ozR = z - nz * ow;
    pos.set([oxR, sample(oxR, ozR) * EX + groundLift + 0.05, ozR], i * 12 + 9);
    col.set([sc.r, sc.g, sc.b, a], i * 16 + 12);
  }
  const idx: number[] = [];
  for (let i = 0; i < n - 1; i++) {
    const a = i * 4;
    idx.push(a, a + 4, a + 1, a + 1, a + 4, a + 5); // linke Schulter-Rampe
    idx.push(a + 1, a + 5, a + 2, a + 2, a + 5, a + 6); // Fahrbahndecke
    idx.push(a + 2, a + 6, a + 3, a + 3, a + 6, a + 7); // rechte Schulter-Rampe
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  geo.setAttribute("color", new THREE.BufferAttribute(col, 4));
  geo.setIndex(idx);
  return new THREE.Mesh(
    geo,
    new THREE.MeshBasicMaterial({
      vertexColors: true,
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

/**
 * Licht-Dramaturgie des Flugs: kühle Blaue Stunde beim hohen Überblick
 * (p=0) über eine wärmer werdende Dämmerung (p=0.55) hin zu warmem Gold bei
 * der Landung auf dem Grundstück (p=1). Bewusst NIE Mitternacht — die Szene
 * soll als "Ankunft im späten Licht" lesen, nicht als nächtlicher Übungsflug,
 * damit sie zur B2B-Zielgruppe passt statt wie ein Videospiel-Establishing-
 * Shot zu wirken. Dieses Array ist die einzige Quelle der Wahrheit: Himmel,
 * Sonnenlicht, Nebel, Gelände-Grading und Bloom lesen alle nur daraus.
 */
type LightStop = {
  p: number;
  /** Canvas-Gradient von oben (0) nach Horizont (1), wie ctx.createLinearGradient */
  skyGradient: [number, string][];
  glowInner: string;
  glowOuter: string;
  glowCy: number;
  glowR: number;
  starAlpha: number;
  starColor: [number, number, number];
  cloudColor: string;
  cloudAlpha: number;
  /** Sonnenfarbe: treibt sowohl das DirectionalLight als auch uSunColor im Shader */
  sunColor: [number, number, number];
  sunIntensity: number;
  fogColor: number;
  /** ersetzt die bisherige feste Grading-Multiplikation im Fragment-Shader */
  gradeTint: [number, number, number];
  gradeDesat: number;
  bloomStrength: number;
  bloomThreshold: number;
  bloomRadius: number;
};

const LIGHT_STOPS: LightStop[] = [
  {
    // p = 0: hoher Überblick, kühle Blaue Stunde mit sichtbar warmem Horizont
    p: 0,
    skyGradient: [
      [0, "#10192c"], [0.5, "#1c2c46"], [0.78, "#3a4260"], [0.92, "#7d6a5a"], [1, "#c99a5c"],
    ],
    glowInner: "rgba(220,180,120,0.4)", glowOuter: "rgba(220,180,120,0)",
    glowCy: 0.98, glowR: 0.5,
    starAlpha: 0.4, starColor: [220, 225, 255],
    cloudColor: "#2a2436", cloudAlpha: 0.22,
    sunColor: [0.85, 0.82, 0.95], sunIntensity: 1.5,
    fogColor: 0x2a2c40,
    // Dieselbe ~0.62-Dämpfung wie im ursprünglichen statischen Grading,
    // sonst wirkt die Szene bei jedem Stop heller als das bewährte Original.
    gradeTint: [0.58, 0.62, 0.72], gradeDesat: 0.3,
    bloomStrength: 0.55, bloomThreshold: 0.8, bloomRadius: 0.35,
  },
  {
    // p = 0.55: wärmer werdende Dämmerung, Sterne treten zurück
    p: 0.55,
    skyGradient: [
      [0, "#140f10"], [0.5, "#2a1c16"], [0.78, "#4a2a18"], [0.92, "#7a4520"], [1, "#c8863c"],
    ],
    glowInner: "rgba(230,190,120,0.6)", glowOuter: "rgba(230,190,120,0)",
    glowCy: 0.98, glowR: 0.62,
    starAlpha: 0.15, starColor: [255, 238, 210],
    cloudColor: "#2a1810", cloudAlpha: 0.3,
    sunColor: [1.02, 0.85, 0.65], sunIntensity: 1.85,
    fogColor: 0x2e1c14,
    gradeTint: [0.72, 0.58, 0.44], gradeDesat: 0.2,
    bloomStrength: 0.72, bloomThreshold: 0.7, bloomRadius: 0.42,
  },
  {
    // p = 1: Landung auf dem Grundstück, warme goldene Stunde, keine Sterne mehr
    p: 1,
    skyGradient: [
      [0, "#1c0f08"], [0.5, "#3f2110"], [0.78, "#7d4118"], [0.92, "#c26c26"], [1, "#f2a748"],
    ],
    glowInner: "rgba(255,214,140,0.8)", glowOuter: "rgba(255,214,140,0)",
    glowCy: 0.98, glowR: 0.78,
    starAlpha: 0, starColor: [255, 235, 205],
    cloudColor: "#3d2010", cloudAlpha: 0.4,
    sunColor: [1.15, 0.85, 0.55], sunIntensity: 2.1,
    fogColor: 0x3d2110,
    // Wärmer und moderat heller als das Original-Grading (0.67/0.56/0.45),
    // aber bewusst nicht ungedämpft — sonst brennt die Landung zusammen mit
    // dem verstärkten Sonnenlicht und Bloom die ganze Szene aus.
    gradeTint: [0.82, 0.62, 0.42], gradeDesat: 0.1,
    bloomStrength: 0.85, bloomThreshold: 0.62, bloomRadius: 0.48,
  },
];

/** Findet die zwei Stützstellen um p und den geglätteten Zwischenwert t. */
function findLightSegment(p: number): [LightStop, LightStop, number] {
  for (let i = 1; i < LIGHT_STOPS.length; i++) {
    if (p <= LIGHT_STOPS[i].p) {
      const a = LIGHT_STOPS[i - 1], b = LIGHT_STOPS[i];
      return [a, b, smooth(p, a.p, b.p)];
    }
  }
  const last = LIGHT_STOPS[LIGHT_STOPS.length - 1];
  return [last, last, 0];
}

const lerp3 = (
  a: [number, number, number], b: [number, number, number], t: number,
): [number, number, number] => [
  a[0] + (b[0] - a[0]) * t,
  a[1] + (b[1] - a[1]) * t,
  a[2] + (b[2] - a[2]) * t,
];

const _tmpColorA = new THREE.Color();
const _tmpColorB = new THREE.Color();

/** Wiederverwendbarer, pro Tick mutierter Licht-Zustand (keine Allokation im Scroll-Pfad). */
type LightState = {
  sunColor: THREE.Color;
  sunIntensity: number;
  fogColor: THREE.Color;
  gradeTint: THREE.Vector3;
  gradeDesat: number;
  bloomStrength: number;
  bloomThreshold: number;
  bloomRadius: number;
  skyLowIdx: number;
  skyHighIdx: number;
  skyT: number;
};

function sampleLight(p: number, out: LightState): LightState {
  const [a, b, t] = findLightSegment(p);
  const [sr, sg, sb] = lerp3(a.sunColor, b.sunColor, t);
  out.sunColor.setRGB(sr, sg, sb);
  out.sunIntensity = a.sunIntensity + (b.sunIntensity - a.sunIntensity) * t;
  out.fogColor.copy(_tmpColorA.set(a.fogColor)).lerp(_tmpColorB.set(b.fogColor), t);
  const [gr, gg, gb] = lerp3(a.gradeTint, b.gradeTint, t);
  out.gradeTint.set(gr, gg, gb);
  out.gradeDesat = a.gradeDesat + (b.gradeDesat - a.gradeDesat) * t;
  out.bloomStrength = a.bloomStrength + (b.bloomStrength - a.bloomStrength) * t;
  out.bloomThreshold = a.bloomThreshold + (b.bloomThreshold - a.bloomThreshold) * t;
  out.bloomRadius = a.bloomRadius + (b.bloomRadius - a.bloomRadius) * t;
  out.skyLowIdx = LIGHT_STOPS.indexOf(a);
  out.skyHighIdx = LIGHT_STOPS.indexOf(b);
  out.skyT = t;
  return out;
}

/** Zeichnet einen Himmel-Keyframe (Verlauf, Horizont-Glanz, Sterne, Wolken) auf einen Canvas-Context. */
function paintSky(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  stop: LightStop,
  stars: { x: number; y: number; yf: number; r: number; tw: number }[],
  clouds: { cx: number; cy: number; rw: number }[],
) {
  ctx.clearRect(0, 0, w, h);
  const grad = ctx.createLinearGradient(0, 0, 0, h);
  for (const [pos, color] of stop.skyGradient) grad.addColorStop(pos, color);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, h);

  ctx.save();
  ctx.filter = "blur(46px)";
  const hg = ctx.createRadialGradient(
    w * 0.4, h * stop.glowCy, 10, w * 0.4, h * stop.glowCy, w * stop.glowR,
  );
  hg.addColorStop(0, stop.glowInner);
  hg.addColorStop(1, stop.glowOuter);
  ctx.fillStyle = hg;
  ctx.fillRect(0, h * 0.5, w, h * 0.5);
  ctx.restore();

  if (stop.starAlpha > 0.01) {
    const [sr, sg, sb] = stop.starColor;
    for (const s of stars) {
      const a = (1 - s.yf * 0.55) * (0.35 + s.tw * 0.55) * stop.starAlpha;
      if (a <= 0.01) continue;
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(${sr},${Math.min(255, sg + s.tw * 14)},${Math.min(255, sb + s.tw * 24)},${a.toFixed(2)})`;
      ctx.fill();
    }
  }

  ctx.save();
  ctx.filter = "blur(16px)";
  ctx.globalAlpha = stop.cloudAlpha;
  ctx.fillStyle = stop.cloudColor;
  for (const c of clouds) {
    ctx.beginPath();
    ctx.ellipse(w * c.cx, h * c.cy, w * c.rw, w * c.rw * 0.16, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

/** Weiche Verlaufs-Textur für die Parkfläche: warmer Schimmer statt flacher Wash. */
function buildParkSheenTexture(): THREE.CanvasTexture {
  const S = 256;
  const cv = document.createElement("canvas");
  cv.width = cv.height = S;
  const c = cv.getContext("2d")!;
  const g = c.createRadialGradient(S * 0.5, S * 0.42, S * 0.05, S * 0.5, S * 0.5, S * 0.72);
  g.addColorStop(0, "rgba(255,255,255,1)");
  g.addColorStop(0.55, "rgba(255,240,215,0.72)");
  g.addColorStop(1, "rgba(255,225,180,0.28)");
  c.fillStyle = g;
  c.fillRect(0, 0, S, S);
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/** Weicher, dunkler Radialverlauf für Kontaktschatten-Decals unter Gebäuden/Park. */
function buildContactShadowTexture(): THREE.CanvasTexture {
  const S = 128;
  const cv = document.createElement("canvas");
  cv.width = cv.height = S;
  const c = cv.getContext("2d")!;
  const g = c.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
  g.addColorStop(0, "rgba(0,0,0,0.9)");
  g.addColorStop(0.55, "rgba(0,0,0,0.45)");
  g.addColorStop(1, "rgba(0,0,0,0)");
  c.fillStyle = g;
  c.fillRect(0, 0, S, S);
  return new THREE.CanvasTexture(cv);
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
        // Himmel als drei vorgebackene Keyframe-Canvases (kühle Blaue Stunde,
        // wärmer werdende Dämmerung, warmes Gold), die pro Scroll-Frame nur
        // noch ineinander geblendet werden. Ein kompletter Neuaufbau (Verlauf
        // + 280 Sterne + Weichzeichner-Wolken) bei jedem p wäre teuer UND
        // würde die Sterne bei jedem Aufruf neu auswürfeln, sie würden beim
        // Scrollen sichtbar springen. Stattdessen wird derselbe Sternen- und
        // Wolkensatz einmalig erzeugt, dreimal mit unterschiedlicher Färbung
        // gebacken, und zur Laufzeit sind es nur noch zwei drawImage-Blits
        // plus ein Textur-Upload — ein 2D-Screenspace-Hintergrund statt einer
        // Skybox, bewegt sich nicht mit der Kamera, fällt bei diesem eher
        // linearen Flugpfad nicht auf.
        const SKY_W = 1024, SKY_H = 640;
        const skyStars = Array.from({ length: 280 }, () => {
          const yf = Math.pow(Math.random(), 1.7);
          return {
            x: Math.random() * SKY_W,
            y: yf * SKY_H * 0.78,
            yf,
            r: Math.random() < 0.12 ? 0.9 + Math.random() * 1.1 : 0.3 + Math.random() * 0.6,
            tw: Math.random(),
          };
        });
        const skyClouds = Array.from({ length: 4 }, () => ({
          cx: 0.08 + Math.random() * 0.84,
          cy: 0.76 + Math.random() * 0.14,
          rw: 0.12 + Math.random() * 0.15,
        }));

        const skyCanvases = LIGHT_STOPS.map(() => {
          const cv = document.createElement("canvas");
          cv.width = SKY_W; cv.height = SKY_H;
          return cv;
        });
        LIGHT_STOPS.forEach((stop, i) => {
          paintSky(skyCanvases[i].getContext("2d")!, SKY_W, SKY_H, stop, skyStars, skyClouds);
        });

        const skyComposite = document.createElement("canvas");
        skyComposite.width = SKY_W; skyComposite.height = SKY_H;
        const skyCompositeCtx = skyComposite.getContext("2d")!;
        skyCompositeCtx.drawImage(skyCanvases[0], 0, 0);

        const skyTex = new THREE.CanvasTexture(skyComposite);
        skyTex.colorSpace = THREE.SRGBColorSpace;
        scene.background = skyTex;
        disposables.push(skyTex);

        const fog = new THREE.Fog(LIGHT_STOPS[0].fogColor, 3200, 26000);
        scene.fog = fog;

        const camera = new THREE.PerspectiveCamera(50, 1, 4, 60000);

        // Bloom auf den hellsten Bildstellen (goldene Straßen/Konturen/Sonnenglanz).
        // Schwelle und Stärke wandern mit der Licht-Dramaturgie (LIGHT_STOPS)
        // mit — kräftiger und wärmer bei der golden ausgeleuchteten Landung.
        // Auf Mobile ausgelassen (Kosten eines zweiten Offscreen-Renders bei
        // begrenztem GPU-Budget).
        let composer: EffectComposer | null = null;
        let bloom: UnrealBloomPass | null = null;
        if (!isMobile) {
          composer = new EffectComposer(renderer);
          composer.addPass(new RenderPass(scene, camera));
          bloom = new UnrealBloomPass(new THREE.Vector2(1, 1), 0.7, 0.4, 0.72);
          composer.addPass(bloom);
          composer.addPass(new OutputPass());
          disposables.push({ dispose: () => composer!.dispose() });
        }
        // Lichter für Lambert-Materialien (Gebäude); Gelände beleuchtet der Shader
        scene.add(new THREE.HemisphereLight(0x4a3a48, 0x241a14, 1.2));
        const sunDir = new THREE.Vector3(-8300, 4800, 2800);
        const sun = new THREE.DirectionalLight(0xffd9a0, 1.8);
        sun.position.copy(sunDir);
        scene.add(sun);

        // Sonnen-Flare: weicher additiver Kreis weit hinter dem Gelände, exakt
        // in Richtung des Streiflichts. Kein eigenes Bloom-Objekt nötig, die
        // Helligkeit reicht, um vom UnrealBloomPass aufgenommen zu werden.
        {
          const cv = document.createElement("canvas");
          cv.width = cv.height = 256;
          const c = cv.getContext("2d")!;
          const g = c.createRadialGradient(128, 128, 0, 128, 128, 128);
          g.addColorStop(0, "rgba(255,238,204,0.95)");
          g.addColorStop(0.35, "rgba(240,205,140,0.5)");
          g.addColorStop(1, "rgba(240,205,140,0)");
          c.fillStyle = g;
          c.fillRect(0, 0, 256, 256);
          const flareTex = new THREE.CanvasTexture(cv);
          const flare = new THREE.Sprite(
            new THREE.SpriteMaterial({
              map: flareTex, transparent: true, depthWrite: false,
              blending: THREE.AdditiveBlending, fog: false,
            }),
          );
          const flarePos = sunDir.clone().normalize().multiplyScalar(24000);
          flare.position.set(flarePos.x, flarePos.y + 2600, flarePos.z);
          flare.scale.setScalar(9000);
          scene.add(flare);
          disposables.push(flareTex, { dispose: () => flare.material.dispose() });
        }

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
        // edgeBand: die äußeren ~55 Rasterzellen lösen sich in den Himmel auf,
        // statt als harte Silhouette gegen eine leere Fläche zu stehen —
        // besonders im Eröffnungsbild bei hoher Kameraposition sichtbar.
        const farTerrain = buildTerrain(farH, ff.rows, ff.cols, fx, fz, farRamp, 0, stride, farMat, 55);
        scene.add(farTerrain);
        disposables.push(farTerrain.geometry, farMat);

        // Straßen/Fernebene: dieselbe Rand-Auflösung wie das Gelände, damit
        // keine Fahrbahn mehr sichtbar über die jetzt auflösende Kante hinaus
        // in die leere Fläche ragt.
        const FAR_EDGE_BAND = 1500;
        const farFadeAt = (x: number, z: number) => {
          const dx = Math.min(x - ff.x0, ff.x1 - x);
          const dz = Math.min(z - ff.z0, ff.z1 - z);
          const t = Math.max(0, Math.min(1, Math.min(dx, dz) / FAR_EDGE_BAND));
          return t * t * (3 - 2 * t);
        };

        const FAR_STYLE: Record<string, [number, number, number]> = {
          a24: [46, 8, 0xfff0c2], b207: [30, 7, 0xf5cd85],
          bundes: [22, 6, 0x9b8050], neben: [13, 5, 0x635642], bahn: [7, 5, 0x8a8a92],
        };
        const farRoads = new THREE.Group();
        for (const r of farScene.roads) {
          const [w, lift, color] = FAR_STYLE[r.c];
          const m = ribbon(r.p, w, lift, color, farSample, 0, farFadeAt);
          if (m) { farRoads.add(m); disposables.push(m.geometry); }
        }
        scene.add(farRoads);

        const farLabels = new THREE.Group();
        for (const l of farScene.labels) {
          // A24 ist der einzige konkret nachprüfbare Distanz-Claim im Text
          // ("7 Kilometer bis zur A24") — bekommt mehr visuelles Gewicht.
          const size = l.t === "A 24" ? 880 : 620;
          farLabels.add(makeLabel(l.t, l.x, l.z, farSample(l.x, l.z) * EX + 320, size, "#efe3c6"));
        }
        scene.add(farLabels);

        // ---- Nah-Ebene (LiDAR + OSM): Konturen 2 m / 10 m
        const nf = nearScene.frame as NearFrame;
        const nearH = new Int16Array(nearBuf);
        const nx = (c: number) => nf.x0 + c * nf.cell + nf.cell / 2;
        const nz = (r: number) => nf.z0 + r * nf.cell + nf.cell / 2;
        const nearSample = makeSampler(nearH, nf.rows, nf.cols, nx, nz);

        // Goldstaub: treibende Partikel für atmosphärische Tiefe. Statisch
        // positioniert (kein eigener rAF-Trieb), da die Szene ohnehin nur bei
        // Scroll-Änderung neu zeichnet — beim Durchfliegen wirkt das Feld
        // trotzdem lebendig, weil die Kamera durch die Punktwolke wandert.
        {
          const groundY = nearSample(0, 0) * EX;
          const dotCv = document.createElement("canvas");
          dotCv.width = dotCv.height = 64;
          const dc = dotCv.getContext("2d")!;
          const dg = dc.createRadialGradient(32, 32, 0, 32, 32, 32);
          dg.addColorStop(0, "rgba(255,240,210,1)");
          dg.addColorStop(1, "rgba(255,240,210,0)");
          dc.fillStyle = dg;
          dc.fillRect(0, 0, 64, 64);
          const dotTex = new THREE.CanvasTexture(dotCv);

          const COUNT = isMobile ? 150 : 480;
          const pPos = new Float32Array(COUNT * 3);
          for (let i = 0; i < COUNT; i++) {
            pPos[i * 3] = -3600 + Math.random() * 8200;
            pPos[i * 3 + 1] = groundY + 120 + Math.random() * 1500;
            pPos[i * 3 + 2] = -3200 + Math.random() * 12800;
          }
          const pGeo = new THREE.BufferGeometry();
          pGeo.setAttribute("position", new THREE.BufferAttribute(pPos, 3));
          const pMat = new THREE.PointsMaterial({
            size: 26, map: dotTex, transparent: true, depthWrite: false,
            blending: THREE.AdditiveBlending, color: new THREE.Color(GOLD),
            sizeAttenuation: true, fog: true, opacity: 0.55,
          });
          const dust = new THREE.Points(pGeo, pMat);
          scene.add(dust);
          disposables.push(pGeo, pMat, dotTex);
        }

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
          // groundLift = NEAR_LIFT: Schulter fällt exakt auf die Höhe der
          // Nah-Terrainebene zurück (vorher schwebten Nah-Straßen 0,8-1,2 m
          // über dem sichtbaren Gelände, weil ihr eigener lift größer war).
          const m = ribbon(r.p, w, lift, color, nearSample, NEAR_LIFT);
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
        // texturiert mit denselben Luftbildern wie der Boden. Material bleibt
        // in äußerem Scope verfügbar, damit tick() auch hier uExAdjust und
        // die Zeit-Dramaturgie-Uniforms pflegen kann.
        let canopyMat: THREE.ShaderMaterial | null = null;
        if (canopyBuf) {
          canopyMat = terrainMaterial(1e6, 1e6, nearTex, detailTex);
          const canopyMesh = buildCanopy(
            new Uint8Array(canopyBuf), 1500, 2, nf.x0, nf.z0,
            nearSample, NEAR_LIFT,
            canopyMat, stride,
          );
          if (canopyMesh) {
            canopyMesh.renderOrder = 2;
            nearGroup.add(canopyMesh);
            disposables.push(canopyMesh.geometry, canopyMat);
          }
        }

        // Parkfläche: goldig schimmernde Markierung statt flacher Wash-Fläche,
        // dem Gelände folgend. Deckkraft bleibt niedrig (Luftbild bleibt
        // sichtbar), die Kontur trägt die Hauptaussage. Eigene, spätere
        // Einblendung in tick() statt der generischen Nah/Fern-Überblendung —
        // sonst ist die Fläche schon beim Anflug sichtbar und wirkt bei der
        // Landung, direkt vor dem Handlungsaufruf, wie eine Gefahrenzone statt
        // wie eine bewusste Enthüllung des Grundstücks.
        let parkFillMat: THREE.MeshBasicMaterial;
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
          const sheenTex = buildParkSheenTexture();
          parkFillMat = new THREE.MeshBasicMaterial({
            map: sheenTex, color: 0xb94049, transparent: true, opacity: PARK_FILL_OPACITY,
            side: THREE.DoubleSide, depthWrite: false,
          });
          const fill = new THREE.Mesh(geo, parkFillMat);
          fill.renderOrder = 3;
          nearGroup.add(fill);
          disposables.push(geo, sheenTex);
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

        // Kontaktschatten: weiche, dunkle Fußabdrücke unter Gebäuden und der
        // Parkfläche, damit beide sichtbar auf dem Gelände aufsitzen statt
        // aufgeklebt zu wirken. Ein gemeinsamer Draw-Call für alle Footprints.
        {
          const shadowTex = buildContactShadowTexture();
          const geos: THREE.BufferGeometry[] = [];
          const BUILDING_MARGIN = 2.2; // m Halo über den Gebäude-Umriss hinaus

          for (const b of nearScene.buildings) {
            let cx = 0, cz = 0;
            for (const [x, z] of b.p) { cx += x; cz += z; }
            cx /= b.p.length; cz /= b.p.length;
            let rad = 0;
            for (const [x, z] of b.p) rad = Math.max(rad, Math.hypot(x - cx, z - cz));
            rad += BUILDING_MARGIN;
            const y = nearSample(cx, cz) * EX + NEAR_LIFT + 0.08;
            const geo = new THREE.PlaneGeometry(rad * 2, rad * 2);
            geo.rotateX(-Math.PI / 2);
            geo.translate(cx, y, cz);
            geos.push(geo);
          }

          // Dieselbe Technik für die Parkfläche, nur mit größerem Halo —
          // landet im selben Draw-Call wie die Gebäudeschatten.
          {
            let cx = 0, cz = 0;
            for (const [x, z] of nearScene.park) { cx += x; cz += z; }
            cx /= nearScene.park.length; cz /= nearScene.park.length;
            let rad = 0;
            for (const [x, z] of nearScene.park) rad = Math.max(rad, Math.hypot(x - cx, z - cz));
            rad += 9;
            const y = nearSample(cx, cz) * EX + NEAR_LIFT + 0.08;
            const geo = new THREE.PlaneGeometry(rad * 2, rad * 2);
            geo.rotateX(-Math.PI / 2);
            geo.translate(cx, y, cz);
            geos.push(geo);
          }

          const merged = mergeGeometries(geos, false);
          geos.forEach((g) => g.dispose());
          if (merged) {
            const shadowMat = new THREE.MeshBasicMaterial({
              map: shadowTex, color: 0x000000, transparent: true, opacity: 0.5,
              depthWrite: false, depthTest: true, side: THREE.DoubleSide, fog: true,
            });
            const shadowMesh = new THREE.Mesh(merged, shadowMat);
            // Zwischen Terrain (renderOrder 1) und Straßen/Gebäuden/Park (2/3)
            // einsortiert: überdeckt das Terrain, wird selbst von allem
            // darüber überdeckt.
            shadowMesh.renderOrder = 1.5;
            nearGroup.add(shadowMesh);
            disposables.push(merged, shadowMat, shadowTex);
          }
        }
        const parkLabel = makeLabel(
          "GRABAUER RUHM", 0, -60, nearSample(0, -60) * EX + 120, 300, "#ffd98f",
        );
        nearGroup.add(parkLabel);
        scene.add(nearGroup);

        // ---- Kamerapfad (Catmull-Rom durch Position und Blickziel)
        const parkY = nearSample(0, 0) * EX;
        // Startpunkt bewusst steiler als geometrisch nötig: bei 50°-FOV zeigt ein
        // zu flacher Blick am Anfang über den Terrain-Rand hinweg ins Nichts
        // (schwarzer Leerraum über dem Horizont). Näher heran und stärker
        // nach unten geneigt hält den Horizont knapp unter der Bildoberkante.
        const posCurve = new THREE.CatmullRomCurve3([
          new THREE.Vector3(3800, parkY + 3800, 6000),
          new THREE.Vector3(2600, parkY + 2300, 4300),
          new THREE.Vector3(900, parkY + 700, 1500),
          new THREE.Vector3(240, parkY + 230, 520),
          new THREE.Vector3(-300, parkY + 130, 330),
        ]);
        const tgtCurve = new THREE.CatmullRomCurve3([
          new THREE.Vector3(0, parkY - 100, -1600),
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

        // Für die Licht-Dramaturgie (LIGHT_STOPS): alle drei Gelände-Shader
        // bekommen Sonnenfarbe/Nebel/Grading; die dynamische Überhöhungs-
        // Korrektur (uExAdjust) betrifft nur Nah- und Kronendecke — die
        // Fernebene ist nie so nah dran, dass ihre Übertreibung stört.
        const lightMats = [farMat, nearMatT, ...(canopyMat ? [canopyMat] : [])];
        const exMats = [nearMatT, ...(canopyMat ? [canopyMat] : [])];
        // Pivot einmalig setzen (rohe, unskalierte Park-Referenzhöhe) — ändert
        // sich nie zur Laufzeit, deshalb kein Platz in tick() nötig.
        const exPivot = nearSample(0, 0);
        for (const m of exMats) m.uniforms.uExPivot.value = exPivot;

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

        // Wiederverwendbarer Licht-Zustand (keine Allokation im Scroll-Pfad)
        const lightState: LightState = {
          sunColor: new THREE.Color(),
          sunIntensity: 0,
          fogColor: new THREE.Color(),
          gradeTint: new THREE.Vector3(),
          gradeDesat: 0,
          bloomStrength: 0,
          bloomThreshold: 0,
          bloomRadius: 0,
          skyLowIdx: 0,
          skyHighIdx: 0,
          skyT: 0,
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

          // Licht-Dramaturgie: zwei gebackene Himmel-Keyframes blenden statt
          // neu zu zeichnen, Nebel/Sonne/Gelände-Grading auf bestehenden
          // Objekten mutieren (nichts wird pro Frame neu angelegt).
          const light = sampleLight(p, lightState);

          skyCompositeCtx.globalAlpha = 1;
          skyCompositeCtx.drawImage(skyCanvases[light.skyLowIdx], 0, 0);
          if (light.skyT > 0.001 && light.skyHighIdx !== light.skyLowIdx) {
            skyCompositeCtx.globalAlpha = light.skyT;
            skyCompositeCtx.drawImage(skyCanvases[light.skyHighIdx], 0, 0);
            skyCompositeCtx.globalAlpha = 1;
          }
          skyTex.needsUpdate = true;

          fog.color.copy(light.fogColor);
          sun.color.copy(light.sunColor);
          sun.intensity = light.sunIntensity;

          for (const m of lightMats) {
            const u = m.uniforms;
            (u.uFogColor.value as THREE.Color).copy(light.fogColor);
            (u.uSunColor.value as THREE.Color).copy(light.sunColor);
            (u.uGradeTint.value as THREE.Vector3).copy(light.gradeTint);
            u.uGradeDesat.value = light.gradeDesat;
          }
          if (bloom) {
            bloom.threshold = light.bloomThreshold;
            bloom.strength = light.bloomStrength;
            bloom.radius = light.bloomRadius;
          }

          // Vertikale Überhöhung nimmt erst kurz vor der Landung ab, damit
          // Hecken und Feldkanten dort nicht wie aufgeschüttete Erdwälle
          // wirken, während der Rest des Flugs unverändert bleibt.
          const exAdjust = -0.45 * smooth(p, 0.6, 0.95);
          for (const m of exMats) m.uniforms.uExAdjust.value = exAdjust;

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

          // Park-Füllung: eigene, spätere Einblendung statt der generischen
          // Nah/Fern-Überblendung — erst wenn Stufe 3 ("Zentimetergenau
          // vermessen") beginnt, damit die Fläche als bewusste Enthüllung
          // wirkt statt schon beim Anflug aufzupoppen.
          const parkReveal = smooth(p, 0.5, 0.64);
          parkFillMat.opacity = nearO * PARK_FILL_OPACITY * parkReveal;

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
