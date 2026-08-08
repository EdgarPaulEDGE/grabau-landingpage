"use client";

import { useEffect, useRef, type MutableRefObject } from "react";
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";

/**
 * Scroll-gescrubbte Kamerafahrt über echtes Gelände.
 *
 * Zwei Datenebenen im selben lokalen Rahmen (Ursprung = Park-Zentrum):
 * - Fernsicht: Copernicus GLO-30 (30-m-Raster, 15 x 18 km) mit Verkehrsachsen
 * - Nahzone: LiDAR-DGM1 des Landes SH (4-m-Raster, 3 x 3 km) mit Gebäuden,
 *   Straßen und der markierten Parkfläche
 * Beim Anflug blendet die Fahrt von der Fern- auf die Nah-Ebene über.
 * Gerendert wird nur, wenn sich der Scroll-Fortschritt ändert.
 */

const EX = 1.6; // vertikale Überhöhung (Sweet Spot aus dem Machbarkeitstest)

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
  // Umkehrfunktionen aus zwei Stützstellen (lineares Raster)
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

/** Geländefläche als indiziertes Grid mit Höhenfarbrampe. */
function buildTerrain(
  h: Int16Array,
  rows: number,
  cols: number,
  xAt: (c: number) => number,
  zAt: (r: number) => number,
  ramp: [number, THREE.Color][],
  yLift: number,
  stride: number,
): THREE.Mesh {
  const R = Math.floor((rows - 1) / stride) + 1;
  const C = Math.floor((cols - 1) / stride) + 1;
  const pos = new Float32Array(R * C * 3);
  const col = new Float32Array(R * C * 3);
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
  geo.setIndex(new THREE.BufferAttribute(idx, 1));
  geo.computeVertexNormals();
  return new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ vertexColors: true }));
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
  const sp = new THREE.Sprite(
    new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(cv), depthTest: false, transparent: true }),
  );
  sp.scale.set((size * (cv.width / cv.height)) / 6.5, (size / 6.5) * 1.5, 1);
  sp.position.set(x, y, z);
  return sp;
}

const smooth = (t: number, a: number, b: number) => {
  const s = Math.max(0, Math.min(1, (t - a) / (b - a)));
  return s * s * (3 - 2 * s);
};

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
        const [farBuf, nearBuf, farScene, nearScene] = await Promise.all([
          fetch("/terrain/far.bin").then((r) => r.arrayBuffer()),
          fetch("/terrain/near.bin").then((r) => r.arrayBuffer()),
          fetch("/terrain/far-scene.json").then((r) => r.json()),
          fetch("/terrain/near-scene.json").then((r) => r.json()),
        ]);
        if (disposed) return;

        const isMobile = window.innerWidth < 768;
        const stride = isMobile ? 2 : 1;

        renderer = new THREE.WebGLRenderer({ antialias: !isMobile, powerPreference: "high-performance" });
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, isMobile ? 1.25 : 1.6));
        renderer.toneMapping = THREE.ACESFilmicToneMapping;
        renderer.toneMappingExposure = 1.35;
        renderer.domElement.style.position = "absolute";
        renderer.domElement.style.inset = "0";
        host.appendChild(renderer.domElement);

        const scene = new THREE.Scene();
        const skyCv = document.createElement("canvas");
        skyCv.width = 2; skyCv.height = 256;
        const sctx = skyCv.getContext("2d")!;
        const grad = sctx.createLinearGradient(0, 0, 0, 256);
        grad.addColorStop(0, "#120e1a");
        grad.addColorStop(0.55, "#241a22");
        grad.addColorStop(1, "#4a3128");
        sctx.fillStyle = grad;
        sctx.fillRect(0, 0, 2, 256);
        scene.background = new THREE.CanvasTexture(skyCv);
        scene.fog = new THREE.Fog(0x241a20, 3200, 26000);

        const camera = new THREE.PerspectiveCamera(50, 1, 4, 60000);
        scene.add(new THREE.HemisphereLight(0x4a4060, 0x2a2018, 1.35));
        const sun = new THREE.DirectionalLight(0xffd9a0, 2.0);
        sun.position.set(-9000, 5200, 3500);
        scene.add(sun);

        // ---- Fern-Ebene (Copernicus)
        const ff = farScene.frame as FarFrame;
        const farH = new Int16Array(farBuf);
        const fx = (c: number) => ff.x0 + ((ff.x1 - ff.x0) * c) / (ff.cols - 1);
        const fz = (r: number) => ff.z0 + ((ff.z1 - ff.z0) * r) / (ff.rows - 1);
        const farSample = makeSampler(farH, ff.rows, ff.cols, fx, fz);
        const farRamp: [number, THREE.Color][] = [
          [6, new THREE.Color(0x28351f)], [25, new THREE.Color(0x3a4a26)],
          [45, new THREE.Color(0x59572e)], [65, new THREE.Color(0x6e5c33)],
          [85, new THREE.Color(0x82653c)], [109, new THREE.Color(0x9a7a4e)],
        ];
        const farTerrain = buildTerrain(farH, ff.rows, ff.cols, fx, fz, farRamp, 0, stride);
        scene.add(farTerrain);
        disposables.push(farTerrain.geometry);

        const FAR_STYLE: Record<string, [number, number, number]> = {
          a24: [42, 8, 0xe3b76a], b207: [30, 7, 0xd0a055],
          bundes: [22, 6, 0x8f7647], neben: [13, 5, 0x5c4f3c], bahn: [7, 5, 0x8a8a92],
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
          farLabels.add(makeLabel(l.t, l.x, l.z, farSample(l.x, l.z) * EX + 320, 620, "#e8dcbc"));
        }
        scene.add(farLabels);

        // ---- Nah-Ebene (LiDAR + OSM), leicht angehoben gegen Z-Fighting
        const nf = nearScene.frame as NearFrame;
        const nearH = new Int16Array(nearBuf);
        const nx = (c: number) => nf.x0 + c * nf.cell + nf.cell / 2;
        const nz = (r: number) => nf.z0 + r * nf.cell + nf.cell / 2;
        const nearSample = makeSampler(nearH, nf.rows, nf.cols, nx, nz);
        const NEAR_LIFT = 1.4;
        const nearGroup = new THREE.Group();
        const nearRamp: [number, THREE.Color][] = [
          [32, new THREE.Color(0x2e3d22)], [42, new THREE.Color(0x565430)],
          [54, new THREE.Color(0x8a7146)],
        ];
        const nearTerrain = buildTerrain(nearH, nf.rows, nf.cols, nx, nz, nearRamp, NEAR_LIFT, stride);
        nearGroup.add(nearTerrain);
        disposables.push(nearTerrain.geometry);

        const NEAR_STYLE: Record<string, [number, number, number]> = {
          b207: [14, 2.6, 0xd0a055], tert: [9, 2.4, 0x8f7647],
          wohn: [6.5, 2.2, 0x6b5c44], service: [4.5, 2.1, 0x544a3a], track: [3, 2.0, 0x453d31],
        };
        for (const r of nearScene.roads) {
          const [w, lift, color] = NEAR_STYLE[r.c];
          const m = ribbon(r.p, w, lift, color, nearSample);
          if (m) { nearGroup.add(m); disposables.push(m.geometry); }
        }

        // Gebäude zu einer Geometrie zusammenfassen (ein Draw-Call)
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
            geos.push(g);
          }
          const merged = mergeGeometries(geos, false);
          geos.forEach((g) => g.dispose());
          if (merged) {
            merged.computeVertexNormals();
            const mesh = new THREE.Mesh(
              merged,
              new THREE.MeshLambertMaterial({ color: 0x4a4038, transparent: true }),
            );
            nearGroup.add(mesh);
            disposables.push(merged);
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
              color: 0x971b22, transparent: true, opacity: 0.34,
              side: THREE.DoubleSide, depthWrite: false,
            }),
          );
          nearGroup.add(fill);
          disposables.push(geo);
          const outlinePts = nearScene.park.map(
            ([x, z]: number[]) =>
              new THREE.Vector3(x, nearSample(x, z) * EX + NEAR_LIFT + 2.2, z),
          );
          const og = new THREE.BufferGeometry().setFromPoints([...outlinePts, outlinePts[0]]);
          const outline = new THREE.Line(
            og,
            new THREE.LineBasicMaterial({ color: 0xe3b76a, transparent: true }),
          );
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
          new THREE.Vector3(7000, parkY + 6200, 10800),
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

        // Deckkraft-Sammlungen für die Überblendung
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

        const resize = () => {
          if (!renderer) return;
          const w = host.clientWidth, h = host.clientHeight;
          renderer.setSize(w, h);
          camera.aspect = w / h;
          camera.updateProjectionMatrix();
          lastP = -1; // Neuzeichnen erzwingen
        };
        const ro = new ResizeObserver(resize);
        ro.observe(host);
        disposables.push({ dispose: () => ro.disconnect() });

        // Nur rendern, wenn die Sektion sichtbar ist und sich etwas ändert
        let visible = true;
        const io = new IntersectionObserver(([e]) => { visible = e.isIntersecting; });
        io.observe(host);
        disposables.push({ dispose: () => io.disconnect() });

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

          const nearO = smooth(p, 0.26, 0.5);
          const farO = 1 - smooth(p, 0.34, 0.6);
          nearGroup.visible = nearO > 0.01;
          for (const m of nearMats) {
            const base = "opacity" in m && (m as THREE.MeshBasicMaterial).userData.baseOpacity;
            const b = typeof base === "number" ? base : 1;
            (m as THREE.MeshBasicMaterial).opacity = nearO * b;
          }
          farRoads.visible = farO > 0.01;
          farLabels.visible = farO > 0.01;
          for (const m of farFadeMats) (m as THREE.MeshBasicMaterial).opacity = farO;

          // Park-Label bei der Landung ausblenden (Text-Schritt übernimmt)
          parkLabel.material.opacity = nearO * (1 - smooth(p, 0.78, 0.92));

          renderer.render(scene, camera);
        };

        // Grund-Deckkraft je Material merken (Parkfläche ist halbtransparent)
        for (const m of nearMats) {
          (m as THREE.MeshBasicMaterial).userData.baseOpacity =
            (m as THREE.MeshBasicMaterial).opacity ?? 1;
        }

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
