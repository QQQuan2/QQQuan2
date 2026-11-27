import * as THREE from 'three';

/* ------------------------------------------------------------------ *
 * Tiny Island — shared helpers
 * Kept dependency-free (only three) so every builder can reuse the
 * same geometries/materials instead of allocating per object.
 * ------------------------------------------------------------------ */

export const ISLAND_R = 8.4;
export const SEG = 44;
export const SEA_Y = -9.6;
export const TAU = Math.PI * 2;

/** Deterministic PRNG so the island looks identical on every reload. */
export function makeRng(seed = 20261122) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
export const lerp = (a, b, t) => a + (b - a) * t;
export const damp = (a, b, lambda, dt) => lerp(a, b, 1 - Math.exp(-lambda * dt));

/* ---- shared resource caches ------------------------------------- */
const _geos = new Map();
const _mats = new Map();

export function geo(key, factory) {
  if (!_geos.has(key)) _geos.set(key, factory());
  return _geos.get(key);
}
export function mat(key, factory) {
  if (!_mats.has(key)) _mats.set(key, factory());
  return _mats.get(key);
}

export function standard(color, opts = {}) {
  return new THREE.MeshStandardMaterial({
    color,
    roughness: 0.92,
    metalness: 0.0,
    flatShading: true,
    ...opts,
  });
}

export function emissive(color, intensity = 1, opts = {}) {
  return new THREE.MeshStandardMaterial({
    color,
    emissive: color,
    emissiveIntensity: intensity,
    roughness: 0.55,
    flatShading: true,
    ...opts,
  });
}

/* ---- deterministic spatial hash (keeps duplicated vertices together) */
function hash3(x, y, z) {
  const s = Math.sin(x * 12.9898 + y * 78.233 + z * 37.719) * 43758.5453;
  return s - Math.floor(s);
}

/** Low-poly jittered icosahedron, shared by rocks / tree crowns / clouds. */
export function rockGeometry(key = 'r0', jitter = 0.22, detail = 0) {
  return geo(`rock-${key}-${jitter}-${detail}`, () => {
    const g = new THREE.IcosahedronGeometry(1, detail);
    const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
      const k =
        1 - jitter * 0.5 +
        hash3(
          Math.round(x * 1000) / 1000,
          Math.round(y * 1000) / 1000,
          Math.round(z * 1000) / 1000
        ) * jitter;
      p.setXYZ(i, x * k, y * k, z * k);
    }
    p.needsUpdate = true;
    g.computeVertexNormals();
    return g;
  });
}

export function blobGeometry(key = 'b0', jitter = 0.12) {
  return geo(`blob-${key}-${jitter}`, () => {
    const g = new THREE.IcosahedronGeometry(1, 1);
    const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
      const k =
        1 - jitter * 0.5 +
        hash3(
          Math.round(x * 100) / 100,
          Math.round(y * 100) / 100,
          Math.round(z * 100) / 100
        ) * jitter;
      p.setXYZ(i, x * k, y * k, z * k);
    }
    p.needsUpdate = true;
    g.computeVertexNormals();
    return g;
  });
}

/** Non-indexed triangle soup builder — gives each face a flat, pure colour. */
export class TriBuilder {
  constructor() {
    this.pos = [];
    this.col = [];
  }
  tri(a, b, c, color) {
    this.pos.push(
      a[0], a[1], a[2],
      b[0], b[1], b[2],
      c[0], c[1], c[2]
    );
    for (let i = 0; i < 3; i++) this.col.push(color.r, color.g, color.b);
  }
  quad(a, b, c, d, color) {
    this.tri(a, b, c, color);
    this.tri(a, c, d, color);
  }
  build() {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(this.col, 3));
    g.computeVertexNormals();
    g.computeBoundingSphere();
    return g;
  }
}

export function faceNormal(a, b, c) {
  const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2];
  const vx = c[0] - a[0], vy = c[1] - a[1], vz = c[2] - a[2];
  const nx = uy * vz - uz * vy;
  const ny = uz * vx - ux * vz;
  const nz = ux * vy - uy * vx;
  const l = Math.hypot(nx, ny, nz) || 1;
  return [nx / l, ny / l, nz / l];
}

export const shade = (color, k) => color.clone().multiplyScalar(k);

export function box(w, h, d) {
  return new THREE.BoxGeometry(w, h, d);
}

/** Convenience mesh factory with sane shadow defaults. */
export function mesh(geometry, material, opts = {}) {
  const m = new THREE.Mesh(geometry, material);
  if (opts.pos) m.position.set(...opts.pos);
  if (opts.rot) m.rotation.set(...opts.rot);
  if (opts.scale) m.scale.set(...opts.scale);
  m.castShadow = opts.cast !== false;
  m.receiveShadow = opts.receive !== false;
  return m;
}

/* ---- localStorage with graceful degradation ---------------------- */
export function readJSON(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    const v = JSON.parse(raw);
    if (Array.isArray(fallback)) return Array.isArray(v) ? v : fallback;
    return v ?? fallback;
  } catch (e) {
    return fallback;
  }
}
export function writeJSON(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch (e) {
    return false;
  }
}

/** Small radial sprite texture drawn at runtime — no external assets. */
export function glowTexture() {
  return geo('glowTex', () => {
    const c = document.createElement('canvas');
    c.width = c.height = 128;
    const ctx = c.getContext('2d');
    const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
    g.addColorStop(0.0, 'rgba(255,255,255,1)');
    g.addColorStop(0.25, 'rgba(255,246,214,0.9)');
    g.addColorStop(0.6, 'rgba(255,220,160,0.25)');
    g.addColorStop(1.0, 'rgba(255,210,150,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 128, 128);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  });
}
