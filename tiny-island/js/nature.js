import * as THREE from 'three';
import {
  standard, emissive, mesh, mat, geo, box, TAU, makeRng,
  rockGeometry, blobGeometry, glowTexture,
} from './utils.js?v=20261127a';
import { surfaceHeight, edgeRadius } from './island.js?v=20261127a';

/* ------------------------------------------------------------------ *
 * Reusable nature props. Also used by the decoration tool, so every
 * factory returns a Group whose origin sits on the ground.
 * ------------------------------------------------------------------ */

const GREENS = ['#5a9c46', '#68ac50', '#4d8c3e', '#7bb85a', '#3f7c3a', '#86c065'];
const AUTUMNS = ['#d97b3c', '#c9602f', '#e6a24c', '#b9522c', '#e0b055'];
const PINES = ['#2f6b46', '#35794d', '#285c3c', '#3d8757'];
const PETALS = ['#f2a7b6', '#f7e6b0', '#e6b6d6', '#fbf1e2', '#c9a9e0', '#f4c27a'];

const barkMat = () => mat('n-bark', () => standard('#6b4a32'));
const leafMat = (i, arr = GREENS) => mat(`n-leaf-${arr === GREENS ? 'g' : arr === AUTUMNS ? 'a' : 'p'}${i}`,
  () => standard(arr[i % arr.length]));
const stoneMat = (i) => mat(`n-stone${i}`, () => standard(['#b9a89a', '#cbb8a6', '#9d8b7d', '#a89c8f'][i % 4]));
const stemMat = () => mat('n-stem', () => standard('#5f8a3e'));
const coreMat = () => mat('n-core', () => standard('#f6cf63'));
const glowMat = () => mat('n-glow', () => emissive('#ffd07a', 0.4));

/* ----------------------------- trees ----------------------------- */
export function createTree(kind = 'round', scale = 1, seed = 0) {
  const rng = makeRng(3100 + seed * 97);
  const g = new THREE.Group();
  const trunkGeo = geo('n-trunk', () => new THREE.CylinderGeometry(0.13, 0.21, 1.5, 6));

  if (kind === 'pine') {
    g.add(mesh(trunkGeo, barkMat(), { pos: [0, 0.62, 0], scale: [0.8, 0.85, 0.8] }));
    const tiers = [
      [1.02, 1.3, 0.62], [0.84, 1.2, 1.32], [0.64, 1.05, 1.98], [0.42, 0.82, 2.55],
    ];
    tiers.forEach(([r, h, y], i) => {
      g.add(mesh(
        geo(`n-pine${i}`, () => new THREE.ConeGeometry(1, 1, 7)),
        leafMat(i, PINES),
        { pos: [0, y + h / 2, 0], scale: [r, h, r] }
      ));
    });
  } else if (kind === 'glow') {
    g.add(mesh(trunkGeo, barkMat(), { pos: [0, 0.78, 0] }));
    const blobs = [
      [0, 2.15, 0, 1.1], [-0.66, 1.85, 0.22, 0.74], [0.64, 1.9, -0.2, 0.8],
      [0.12, 2.66, 0.08, 0.7], [-0.22, 2.42, -0.58, 0.62],
    ];
    blobs.forEach(([x, y, z, r], i) => {
      g.add(mesh(blobGeometry('crown', 0.16), leafMat(i, AUTUMNS), {
        pos: [x, y, z], scale: [r, r * 0.9, r],
      }));
    });
    const sparkMat = mat('n-spark', () => emissive('#ffe6a0', 2.2));
    for (let i = 0; i < 9; i++) {
      const a = rng() * TAU, r = 0.4 + rng() * 0.85;
      g.add(mesh(geo('n-sparkGeo', () => new THREE.OctahedronGeometry(0.075, 0)), sparkMat, {
        pos: [Math.cos(a) * r, 1.5 + rng() * 1.6, Math.sin(a) * r], cast: false,
      }));
    }
  } else {
    const autumn = kind === 'autumn';
    const palette = autumn ? AUTUMNS : GREENS;
    g.add(mesh(trunkGeo, barkMat(), { pos: [0, 0.78, 0] }));
    const blobs = [
      [0, 2.08, 0, 1.08], [-0.64, 1.82, 0.24, 0.74], [0.62, 1.88, -0.2, 0.8],
      [0.14, 2.6, 0.1, 0.7], [-0.26, 2.38, -0.56, 0.62],
    ];
    blobs.forEach(([x, y, z, r], i) => {
      g.add(mesh(blobGeometry('crown', 0.16), leafMat(i, palette), {
        pos: [x, y, z], scale: [r, r * 0.92, r],
      }));
    });
    // a couple of low shrubs at the base
    g.add(mesh(blobGeometry('shrub', 0.2), leafMat(2, palette), {
      pos: [0.42, 0.36, 0.4], scale: [0.34, 0.3, 0.34],
    }));
  }
  g.scale.setScalar(scale);
  g.userData.propType = 'tree';
  return g;
}

/* ----------------------------- flowers ---------------------------- */
export function createFlowerCluster(count = 4, seed = 0, scale = 1) {
  const rng = makeRng(7700 + seed * 131);
  const g = new THREE.Group();
  const stemGeo = geo('n-stemGeo', () => new THREE.CylinderGeometry(0.02, 0.03, 1, 4));
  const headGeo = blobGeometry('flowerHead', 0.16);
  const coreGeo = geo('n-coreGeo', () => new THREE.IcosahedronGeometry(1, 0));
  for (let i = 0; i < count; i++) {
    const a = rng() * TAU, r = rng() * 0.4;
    const x = Math.cos(a) * r, z = Math.sin(a) * r;
    const h = 0.26 + rng() * 0.2;
    const p = rng() * PETALS.length;
    g.add(mesh(stemGeo, stemMat(), { pos: [x, h / 2, z], scale: [1, h, 1] }));
    g.add(mesh(headGeo, mat(`n-petal${Math.floor(p)}`, () => standard(PETALS[Math.floor(p) % PETALS.length])), {
      pos: [x, h, z], scale: [0.13, 0.085, 0.13],
    }));
    g.add(mesh(coreGeo, coreMat(), { pos: [x, h + 0.05, z], scale: [0.045, 0.045, 0.045] }));
  }
  g.scale.setScalar(scale);
  g.userData.propType = 'flower';
  return g;
}

/* ------------------------------ rocks ----------------------------- */
export function createRock(scale = 1, seed = 0) {
  const rng = makeRng(5500 + seed * 71);
  const g = new THREE.Group();
  const r = 0.42 + rng() * 0.3;
  const m = mesh(rockGeometry('pebble', 0.34), stoneMat(Math.floor(rng() * 4)), {
    pos: [0, r * 0.55, 0], scale: [r * 1.2, r * 0.78, r],
  });
  m.rotation.set(rng(), rng() * TAU, rng() * 0.4);
  g.add(m);
  if (rng() > 0.4) {
    g.add(mesh(rockGeometry('pebble2', 0.4), stoneMat(2), {
      pos: [r * 0.9, r * 0.22, -r * 0.3], scale: [r * 0.5, r * 0.38, r * 0.45],
    }));
  }
  // moss cap
  g.add(mesh(blobGeometry('moss', 0.2), mat('n-moss', () => standard('#6f9b4a')), {
    pos: [0, r * 0.92, 0], scale: [r * 0.5, r * 0.14, r * 0.42],
  }));
  g.scale.setScalar(scale);
  g.userData.propType = 'rock';
  return g;
}

/* ---------------------------- lantern ----------------------------- */
export function createLantern(scale = 1) {
  const g = new THREE.Group();
  const wood = mat('n-lanternWood', () => standard('#5b3a28'));
  const metal = mat('n-lanternMetal', () => standard('#3f3630'));
  const glass = mat('n-lanternGlass', () => emissive('#ffc477', 0.5));
  g.add(mesh(geo('n-lanternBase', () => new THREE.CylinderGeometry(0.22, 0.26, 0.16, 6)), metal, {
    pos: [0, 0.08, 0],
  }));
  g.add(mesh(geo('n-lanternPole', () => new THREE.CylinderGeometry(0.055, 0.07, 1.5, 6)), wood, {
    pos: [0, 0.85, 0],
  }));
  g.add(mesh(box(0.3, 0.34, 0.3), glass, { pos: [0, 1.72, 0], cast: false }));
  g.add(mesh(geo('n-lanternCap', () => new THREE.ConeGeometry(0.27, 0.22, 4)), metal, {
    pos: [0, 2.0, 0], rot: [0, Math.PI / 4, 0],
  }));
  for (const s of [-1, 1]) {
    g.add(mesh(box(0.035, 0.36, 0.035), metal, { pos: [s * 0.16, 1.72, 0.16] }));
  }
  const light = new THREE.PointLight('#ffb45e', 0.0, 7, 2);
  light.position.set(0, 1.72, 0);
  g.add(light);
  g.userData.light = light;
  g.userData.glass = glass;
  g.scale.setScalar(scale);
  g.userData.propType = 'lantern';
  return g;
}

/** Uniform entry point for the decoration tool. */
export function createDecoration(type, data = {}) {
  const seed = data.seed ?? Math.floor(Math.random() * 9999);
  let g;
  if (type === 'tree') g = createTree(data.kind || 'round', data.scale || 0.85, seed);
  else if (type === 'flower') g = createFlowerCluster(data.count || 4, seed, data.scale || 1);
  else if (type === 'rock') g = createRock(data.scale || 1, seed);
  else if (type === 'lantern') g = createLantern(data.scale || 1);
  else g = createRock(1, seed);
  g.userData.decorationType = type;
  g.userData.decorationData = data;
  g.traverse((o) => { if (o.isMesh) o.userData.decorationRoot = g; });
  return g;
}

/* ------------------- scattered ground detail ---------------------- */
export function createGroundDetails(count = 130) {
  const rng = makeRng(88231);
  const blade = new THREE.ConeGeometry(0.05, 0.42, 3);
  blade.translate(0, 0.21, 0);
  const inst = new THREE.InstancedMesh(blade, standard('#ffffff', { vertexColors: false, side: THREE.DoubleSide }), count);
  inst.castShadow = false;
  inst.receiveShadow = true;
  const dummy = new THREE.Object3D();
  const colors = ['#7fb04a', '#8fc257', '#6ea442', '#9ccb63'].map((c) => new THREE.Color(c));

  // keep-clear zones: buildings, water, path corridor and named props
  const CLEAR = [
    [0, -1.4, 3.3],      // cottage + porch
    [3.7, -2.9, 1.7],    // pond
    [2.55, 1.35, 1.1],   // mailbox
    [8.2, 3.6, 1.7],     // dock foot
    // path corridor
    [0.9, 0.6, 0.8], [1.3, 1.4, 0.8], [1.9, 2.2, 0.8], [2.8, 2.7, 0.8],
    [3.9, 2.95, 0.8], [5.1, 3.05, 0.8], [6.3, 3.15, 0.8], [7.5, 3.35, 0.8],
    [8.3, 3.6, 0.8],
    // tree trunks
    [-4.3, -2.1, 0.6], [4.9, -4.7, 0.6], [-3.5, 2.6, 0.6], [-1.9, 4.3, 0.6],
    // landscape rocks
    [-5.2, -3.7, 0.7], [5.9, 1.5, 0.7], [-3.4, 5.6, 0.7], [3.1, -5.3, 0.7],
    [-6.2, -0.8, 0.7],
    // lanterns
    [1.1, 2.3, 0.6], [7.0, 2.35, 0.6],
    // flower beds (keep the blooms readable)
    [-2.6, 1.5, 0.55], [-1.7, 2.3, 0.55], [1.9, -3.5, 0.55],
    [5.4, -2.3, 0.55], [3.0, 4.4, 0.55],
  ];

  let n = 0;
  let guard = 0;
  while (n < count && guard++ < count * 20) {
    const a = rng() * TAU;
    const rr = Math.sqrt(rng()) * edgeRadius(a) * 0.95;
    const x = Math.cos(a) * rr, z = Math.sin(a) * rr;
    if (CLEAR.some(([cx, cz, cr]) => Math.hypot(x - cx, z - cz) < cr)) continue;
    dummy.position.set(x, surfaceHeight(x, z) - 0.02, z);
    dummy.rotation.set((rng() - 0.5) * 0.35, rng() * TAU, (rng() - 0.5) * 0.35);
    const s = 0.6 + rng() * 1.1;
    dummy.scale.set(s, s * (0.7 + rng() * 0.8), s);
    dummy.updateMatrix();
    inst.setMatrixAt(n, dummy.matrix);
    inst.setColorAt(n, colors[Math.floor(rng() * colors.length)]);
    n++;
  }
  inst.count = n;
  inst.instanceMatrix.needsUpdate = true;
  if (inst.instanceColor) inst.instanceColor.needsUpdate = true;
  return inst;
}

/** A light scattering of flowers & pebbles along the grassy rim. */
export function createEdgeDetails(count = 14) {
  const rng = makeRng(12007);
  const g = new THREE.Group();
  const DOCK_A = Math.atan2(3.6, 8.2); // dock approach sector
  const keepClear = [
    [-5.2, -3.7], [5.9, 1.5], [-3.4, 5.6], [3.1, -5.3], [-6.2, -0.8],
  ];
  let i = 0;
  let guard = 0;
  while (i < count && guard++ < count * 12) {
    const a = rng() * TAU;
    if (Math.abs(a - DOCK_A) < 0.42) continue; // keep the dock foot clear
    const r = edgeRadius(a) * (0.86 + rng() * 0.1);
    const x = Math.cos(a) * r, z = Math.sin(a) * r;
    if (keepClear.some(([kx, kz]) => Math.hypot(x - kx, z - kz) < 1.0)) continue;
    const y = surfaceHeight(x, z);
    if (rng() > 0.55) {
      const f = createFlowerCluster(2 + Math.floor(rng() * 2), i, 0.8);
      f.position.set(x, y, z);
      g.add(f);
    } else {
      const rock = createRock(0.55 + rng() * 0.5, i);
      rock.position.set(x, y, z);
      g.add(rock);
    }
    i++;
  }
  return g;
}

export { glowMat };
