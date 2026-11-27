import * as THREE from 'three';
import {
  ISLAND_R, SEG, TAU, TriBuilder, standard, shade, faceNormal,
  makeRng, rockGeometry, mat, mesh,
} from './utils.js?v=20261127a';

/* ------------------------------------------------------------------ *
 * Island body
 *  - irregular polar outline (never a disc)
 *  - gently domed, faceted grass surface
 *  - 12 strata rings tapering into a jagged floating rock keel
 * ------------------------------------------------------------------ */

export function outline(a) {
  return (
    1 +
    0.115 * Math.sin(3 * a + 0.6) +
    0.070 * Math.sin(5 * a - 1.1) +
    0.050 * Math.sin(2 * a + 2.3) +
    0.030 * Math.sin(8 * a + 0.9) +
    0.020 * Math.cos(11 * a - 0.4)
  );
}

export const edgeRadius = (a) => ISLAND_R * outline(a);

export function topHeight(a, t) {
  const dome = 0.52 * (1 - t * t);
  const bump =
    0.19 * Math.sin(a * 3 + 1.4) * Math.sin(t * Math.PI) +
    0.13 * Math.cos(a * 5 - 0.4) * t +
    0.07 * Math.sin(a * 7 + 2.0) * t * t +
    0.05 * Math.sin(a * 4 + 0.8) * t * Math.sin(t * Math.PI);
  return dome + bump * Math.min(1, t * 1.6);
}

/** Height of the grass at any (x,z) — used to seat props. */
export function surfaceHeight(x, z) {
  const a = Math.atan2(z, x);
  const t = Math.min(1, Math.hypot(x, z) / edgeRadius(a));
  return topHeight(a, t);
}

// Shared with growth.js so the expansion skirt reuses the exact same
// palette and strata profile — new land must match the old land.
export const GRASS = ['#8cbf52', '#7fb249', '#96c95e', '#86b94e', '#a0cf68', '#79aa45', '#8ec158']
  .map((c) => new THREE.Color(c));

export const LAYERS = [
  { y: 0.00, s: 1.000, c: '#7ba747' }, // grass lip (matches top ring)
  { y: -0.30, s: 1.014, c: '#8d9b56' },
  { y: -0.74, s: 0.982, c: '#b28b56' },
  { y: -1.34, s: 0.947, c: '#c0703f' }, // warm sandstone band
  { y: -2.06, s: 0.890, c: '#a95736' },
  { y: -2.90, s: 0.810, c: '#8c4830' },
  { y: -3.80, s: 0.703, c: '#753c2c' },
  { y: -4.72, s: 0.576, c: '#5e3126' },
  { y: -5.60, s: 0.427, c: '#49271f' },
  { y: -6.40, s: 0.284, c: '#381f1b' },
  { y: -7.06, s: 0.149, c: '#2a1816' },
  { y: -7.62, s: 0.022, c: '#1e1211' },
];

export function layerRadius(li, a) {
  if (li === 0) return edgeRadius(a);
  const wob =
    0.065 * Math.sin(a * (4 + (li % 3)) + li * 1.7) +
    0.050 * Math.sin(a * (7 + (li % 4)) - li * 0.9) +
    0.032 * Math.cos(a * (11 + (li % 5)) + li * 2.1);
  return edgeRadius(a) * LAYERS[li].s * (1 + wob);
}

export function layerY(li, a) {
  return li === 0 ? topHeight(a, 1) : LAYERS[li].y;
}

const LIGHT_DIR = new THREE.Vector3(-0.52, 0.76, 0.4).normalize();

export function buildIsland() {
  const group = new THREE.Group();
  group.name = 'island';
  const rng = makeRng(77123);

  /* ---------------- grass top ---------------- */
  const tb = new TriBuilder();
  const ringT = [0, 0.2, 0.4, 0.6, 0.78, 0.9, 1.0];
  const P = (t, a) => {
    const r = edgeRadius(a) * t;
    return [Math.cos(a) * r, topHeight(a, t), Math.sin(a) * r];
  };
  const center = P(0, 0);

  for (let i = 0; i < SEG; i++) {
    const a0 = (i / SEG) * TAU, a1 = ((i + 1) / SEG) * TAU;
    const p0 = P(ringT[1], a0), p1 = P(ringT[1], a1);
    tb.tri(
      center, p1, p0,
      shade(GRASS[Math.floor(rng() * GRASS.length)], 0.94 + rng() * 0.14)
    );
  }
  for (let ri = 1; ri < ringT.length - 1; ri++) {
    for (let i = 0; i < SEG; i++) {
      const a0 = (i / SEG) * TAU, a1 = ((i + 1) / SEG) * TAU;
      const p00 = P(ringT[ri], a0), p10 = P(ringT[ri], a1);
      const p01 = P(ringT[ri + 1], a0), p11 = P(ringT[ri + 1], a1);
      tb.quad(
        p00, p10, p11, p01,
        shade(GRASS[Math.floor(rng() * GRASS.length)], 0.9 + rng() * 0.18)
      );
    }
  }

  const grassTop = mesh(
    tb.build(),
    standard('#ffffff', { vertexColors: true, roughness: 1.0, side: THREE.DoubleSide }),
    { cast: false }
  );
  grassTop.name = 'grassTop';
  grassTop.userData.ground = true;
  group.add(grassTop);

  /* ---------------- cliff strata ---------------- */
  const cb = new TriBuilder();
  const ring = (li, i) => {
    const a = (i / SEG) * TAU;
    const r = layerRadius(li, a);
    return [Math.cos(a) * r, layerY(li, a), Math.sin(a) * r];
  };

  for (let li = 0; li < LAYERS.length - 1; li++) {
    const base = new THREE.Color(LAYERS[li].c);
    for (let i = 0; i < SEG; i++) {
      const A0 = ring(li, i), A1 = ring(li, i + 1);
      const B0 = ring(li + 1, i), B1 = ring(li + 1, i + 1);
      const n = faceNormal(A0, A1, B1);
      const lit = 0.76 + 0.34 * Math.max(0, n[0] * LIGHT_DIR.x + n[1] * LIGHT_DIR.y + n[2] * LIGHT_DIR.z);
      const c = shade(base, lit * (0.9 + rng() * 0.2));
      cb.quad(A0, A1, B1, B0, c);
    }
  }
  // close the keel with a small fan
  const tip = [0, LAYERS[LAYERS.length - 1].y - 0.35, 0];
  const tipBase = new THREE.Color(LAYERS[LAYERS.length - 1].c);
  const last = LAYERS.length - 1;
  for (let i = 0; i < SEG; i++) {
    cb.tri(ring(last, i), ring(last, i + 1), tip, shade(tipBase, 0.85 + rng() * 0.2));
  }

  const cliffs = mesh(
    cb.build(),
    standard('#ffffff', { vertexColors: true, roughness: 1.0, side: THREE.DoubleSide }),
    { cast: true }
  );
  cliffs.name = 'cliffs';
  group.add(cliffs);

  /* ---------------- protruding boulders in the strata ---------------- */
  for (let i = 0; i < 27; i++) {
    const a = rng() * TAU;
    const li = 3 + Math.floor(rng() * 7);
    const r = layerRadius(li, a) * 0.97;
    const s = 0.32 + rng() * 0.62;
    const m = mesh(
      rockGeometry(`cliff${li}`, 0.38),
      mat(`cliffRock${li}`, () => standard(LAYERS[li].c)),
      {
        pos: [Math.cos(a) * r, LAYERS[li].y + (rng() - 0.5) * 0.5, Math.sin(a) * r],
        scale: [s * 1.35, s * 0.85, s],
      }
    );
    m.rotation.set(rng() * 3, rng() * 3, rng() * 3);
    group.add(m);
  }

  return { group, grassTop };
}
