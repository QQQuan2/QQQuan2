import * as THREE from 'three';
import {
  ISLAND_R, SEG, TAU, damp, makeRng, shade, faceNormal,
  readJSON, writeJSON, standard, glowTexture,
} from './utils.js';
import {
  edgeRadius, topHeight, layerRadius, GRASS, LAYERS,
} from './island.js';

/* ------------------------------------------------------------------ *
 * Island Growth System 1.1 — Milestone A
 *
 * The island grows with the LIFETIME number of memories ever kept
 * (deleting notes never shrinks it). Five levels:
 *
 *   Lv.1 初生之岛  0+   scale 1.00
 *   Lv.2 萌芽之岛  10+  scale 1.10
 *   Lv.3 生长之岛  25+  scale 1.25
 *   Lv.4 繁盛之岛  50+  scale 1.45
 *   Lv.5 永恒之岛  100+ scale 1.60 (capped)
 *
 * Terrain expansion NEVER scales the scene. The core island body is
 * untouched; growth adds a parameterized "skirt" — a grass shelf plus
 * a translated copy of the cliff strata — whose width W = (s-1)*R
 * is re-filled into preallocated buffers while a damped scale eases
 * toward its target. At scale 1.0 the skirt is degenerate and hidden,
 * so the default composition is pixel-identical to before.
 *
 * Landscape auto-spawning is retired (Milestone A): growth now only
 * UNLOCKS landscape categories permanently; placing them arrives in
 * Milestone C via placeLandscape(). RESERVED stays exported so the
 * decoration tool keeps its existing keep-clear zones.
 * ------------------------------------------------------------------ */

const STORE_KEY = 'tiny-island.growth.v1';
const SHORE_BASE = 11.0;               // surf ring radius at scale 1 (world.js)

const LEVELS = [
  { at: 0,   scale: 1.00, zh: '初生之岛', en: 'Nursing Isle' },
  { at: 10,  scale: 1.10, zh: '萌芽之岛', en: 'Sprouting Isle' },
  { at: 25,  scale: 1.25, zh: '生长之岛', en: 'Growing Isle' },
  { at: 50,  scale: 1.45, zh: '繁盛之岛', en: 'Flourishing Isle' },
  { at: 100, scale: 1.60, zh: '永恒之岛', en: 'Everlasting Isle' },
];

const MILESTONES = [10, 25, 50, 100];

/* Permanent unlocks granted at each milestone (placement = Milestone C) */
const UNLOCK_DEFS = {
  10:  { key: 'grove', zh: '树林', en: 'Grove', emoji: '🌳',
         text: 'A grove of young trees is waiting to be planted.' },
  25:  { key: 'meadow', zh: '花甸', en: 'Meadow', emoji: '🌼',
         text: 'A wildflower meadow has revealed itself.' },
  50:  { key: 'stone', zh: '岩园', en: 'Stone Garden', emoji: '🪨',
         text: 'A quiet garden of stones has surfaced.' },
  100: { key: 'lanternShore', zh: '灯岸', en: 'Lantern Shore', emoji: '🏮',
         text: 'A shore where lanterns gather to light the night.' },
};

/* Piecewise-linear scale for a lifetime count (capped at Lv.5). */
export function scaleFor(n) {
  const v = Math.max(0, n);
  for (let i = 0; i < LEVELS.length - 1; i++) {
    if (v < LEVELS[i + 1].at) {
      const t = (v - LEVELS[i].at) / (LEVELS[i + 1].at - LEVELS[i].at);
      return LEVELS[i].scale + (LEVELS[i + 1].scale - LEVELS[i].scale) * t;
    }
  }
  return LEVELS[LEVELS.length - 1].scale;
}

/** 1-based island level for a lifetime count. */
export function levelFor(n) {
  let lv = 1;
  for (let i = 0; i < LEVELS.length; i++) if (n >= LEVELS[i].at) lv = i + 1;
  return lv;
}

/* Footprints the decoration tool keeps clear — legacy growth spawn
 * spots, preserved so decorations.js needs no changes. */
export const RESERVED = [
  { x: -4.7, z: 1.2, r: 0.95 }, { x: -5.2, z: 2.6, r: 0.95 },
  { x: 0.2, z: -4.9, r: 0.95 }, { x: 1.4, z: -5.4, r: 0.95 },
  { x: -3.0, z: -3.6, r: 0.95 }, { x: -3.6, z: -4.4, r: 0.95 },
  { x: 2.2, z: -4.6, r: 0.95 }, { x: 1.1, z: -4.3, r: 0.95 },
  { x: -3.3, z: -0.4, r: 0.95 }, { x: -4.2, z: 0.2, r: 0.95 },
  { x: -5.8, z: 2.2, r: 0.95 }, { x: -6.1, z: 3.3, r: 0.95 },
  { x: 5.8, z: 2.6, r: 0.95 }, { x: 4.9, z: 1.0, r: 0.95 },
  { x: -0.4, z: 5.0, r: 0.95 }, { x: -1.0, z: 5.6, r: 0.95 },
];

/* ================================================================== *
 * Expansion skirt geometry
 * ================================================================== */

const SHELF_SEGS = 4;                    // radial segments of the grass shelf
const SKIRT_W_NOMINAL = 2.0;             // width used to bake face lighting

/* Irregular outer edge so the new land never reads as a perfect ring. */
const edgeWobble = (a) =>
  1 + 0.055 * Math.sin(a * 5 + 1.3) +
      0.035 * Math.sin(a * 9 - 0.7) +
      0.020 * Math.sin(a * 13 + 2.1);

/* Outer lip of the shelf — always below the island edge and below the
 * first stratum so the cliff wall never tilts inward. */
const lipY = (a) =>
  Math.min(topHeight(a, 1) - 0.08, -0.24 + 0.04 * Math.sin(a * 3 + 0.5));

const LIGHT_DIR = new THREE.Vector3(-0.52, 0.76, 0.4).normalize();

/**
 * Build the skirt topology: a list of vertex functions W -> [x,y,z]
 * plus per-face paint descriptors. Preallocated once; positions are
 * re-filled whenever the damped scale changes.
 */
function buildShelfTopology() {
  const V = [];
  const faces = [];                      // one entry per quad (6 verts)
  for (let i = 0; i < SEG; i++) {
    const a0 = (i / SEG) * TAU, a1 = ((i + 1) / SEG) * TAU;
    for (let g = 0; g < SHELF_SEGS; g++) {
      const u0 = g / SHELF_SEGS, u1 = (g + 1) / SHELF_SEGS;
      const P = (a, u) => (W) => {
        const ow = W * edgeWobble(a);
        const y = u >= 1 ? lipY(a) : topHeight(a, 1);
        const r = edgeRadius(a) + ow * u;
        return [Math.cos(a) * r, y, Math.sin(a) * r];
      };
      const p00 = P(a0, u0), p10 = P(a1, u0), p11 = P(a1, u1), p01 = P(a0, u1);
      V.push(p00, p10, p11, p00, p11, p01);
      faces.push({ kind: 'grass' });
    }
  }
  return { V, faces };
}

function buildCliffTopology() {
  const V = [];
  const faces = [];
  const cl = (li, a) => (W) => {
    const r = layerRadius(li, a) + W * edgeWobble(a);
    const y = li === 0 ? lipY(a) : LAYERS[li].y;
    return [Math.cos(a) * r, y, Math.sin(a) * r];
  };
  for (let li = 0; li < LAYERS.length - 1; li++) {
    for (let i = 0; i < SEG; i++) {
      const a0 = (i / SEG) * TAU, a1 = ((i + 1) / SEG) * TAU;
      const A0 = cl(li, a0), A1 = cl(li, a1), B0 = cl(li + 1, a0), B1 = cl(li + 1, a1);
      V.push(A0, A1, B1, A0, B1, B0);
      faces.push({ kind: 'rock', li, pts: [A0, A1, B1, B0] });
    }
  }
  // close the keel ring with a small jagged fan (mirrors the island tip)
  const last = LAYERS.length - 1;
  for (let i = 0; i < SEG; i++) {
    const a0 = (i / SEG) * TAU, a1 = ((i + 1) / SEG) * TAU;
    const am = ((i + 0.5) / SEG) * TAU;
    const A = cl(last, a0), B = cl(last, a1);
    const T = (W) => {
      const ow = W * edgeWobble(am);
      return [Math.cos(am) * ow * 0.15, LAYERS[last].y - 0.5, Math.sin(am) * ow * 0.15];
    };
    V.push(A, B, T);
    faces.push({ kind: 'tip' });
  }
  return { V, faces };
}

function makeSkirtMesh(topo, seed) {
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(topo.V.length * 3), 3));
  const colors = new Float32Array(topo.V.length * 3);
  const rng = makeRng(seed);
  let k = 0;
  for (const f of topo.faces) {
    let c;
    if (f.kind === 'grass') {
      c = shade(GRASS[Math.floor(rng() * GRASS.length)], 0.9 + rng() * 0.18);
    } else if (f.kind === 'rock') {
      // bake the directional lighting exactly like island.js strata
      const [A0, A1, B1] = f.pts.map((fn) => fn(SKIRT_W_NOMINAL));
      const n = faceNormal(A0, A1, B1);
      const lit = 0.76 + 0.34 * Math.max(0, n[0] * LIGHT_DIR.x + n[1] * LIGHT_DIR.y + n[2] * LIGHT_DIR.z);
      c = shade(new THREE.Color(LAYERS[f.li].c), lit * (0.9 + rng() * 0.2));
    } else {
      c = shade(new THREE.Color(LAYERS[LAYERS.length - 1].c), 0.85 + rng() * 0.2);
    }
    const nVerts = f.kind === 'tip' ? 3 : 6;
    for (let i = 0; i < nVerts; i++) {
      colors[k * 3] = c.r; colors[k * 3 + 1] = c.g; colors[k * 3 + 2] = c.b;
      k++;
    }
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  const m = new THREE.Mesh(geo, standard('#ffffff', {
    vertexColors: true, roughness: 1.0, side: THREE.DoubleSide,
  }));
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}

function fillSkirt(geo, V, W) {
  const p = geo.attributes.position.array;
  let k = 0;
  for (const v of V) {
    const q = v(W);
    p[k++] = q[0]; p[k++] = q[1]; p[k++] = q[2];
  }
  geo.attributes.position.needsUpdate = true;
  geo.computeVertexNormals();
  geo.computeBoundingSphere();
}

/* ================================================================== *
 * System
 * ================================================================== */

function freshState() {
  return {
    version: 1,
    lifetime: 0,
    countedIds: [],
    milestones: [],
    unlocks: [],
    placements: [],
    effects: { motes: true },
  };
}

function loadState() {
  const s = readJSON(STORE_KEY, null);
  if (!s || typeof s !== 'object') return freshState();
  const base = freshState();
  return {
    version: 1,
    lifetime: Number.isFinite(s.lifetime) ? Math.max(0, Math.floor(s.lifetime)) : 0,
    countedIds: Array.isArray(s.countedIds)
      ? s.countedIds.filter((x) => typeof x === 'string') : [],
    milestones: Array.isArray(s.milestones)
      ? s.milestones.filter((x) => MILESTONES.includes(x)) : [],
    unlocks: Array.isArray(s.unlocks)
      ? s.unlocks.filter((x) => typeof x === 'string') : [],
    placements: Array.isArray(s.placements) ? s.placements : [],
    effects: { motes: s.effects ? s.effects.motes !== false : true },
  };
}

export function createGrowthSystem({ parent, mailbox, onMilestone }) {
  const group = new THREE.Group();
  group.name = 'growth';
  parent.add(group);

  const state = loadState();
  const listeners = [];
  let nightLvl = 0;
  let expanding = false;

  /* ------------------- expansion skirt (terrain) ------------------- */
  const skirtGroup = new THREE.Group();
  skirtGroup.name = 'growthSkirt';
  skirtGroup.visible = false;
  group.add(skirtGroup);

  const shelfTopo = buildShelfTopology();
  const cliffTopo = buildCliffTopology();
  const shelfMesh = makeSkirtMesh(shelfTopo, 91001);
  const cliffMesh = makeSkirtMesh(cliffTopo, 91077);
  shelfMesh.castShadow = false;          // like the island's grass top
  skirtGroup.add(shelfMesh, cliffMesh);
  let lastSkirtW = 0;

  /* --------------- unlock motes (fireflies on new land) ------------ */
  const moteRng = makeRng(88041);
  const motePos = [];
  for (let i = 0; i < SEG; i++) {
    const a = (i / SEG) * TAU;
    const r = edgeRadius(a) + 0.6 + moteRng() * 0.35;
    const y = topHeight(a, 1) + 0.38 + moteRng() * 0.3;
    motePos.push(Math.cos(a) * r, y, Math.sin(a) * r);
  }
  const moteGeo = new THREE.BufferGeometry();
  moteGeo.setAttribute('position', new THREE.Float32BufferAttribute(motePos, 3));
  moteGeo.setDrawRange(0, 0);
  const moteMat = new THREE.PointsMaterial({
    size: 0.34, map: glowTexture(), color: '#ffe1a0',
    transparent: true, opacity: 0.8, depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  const motes = new THREE.Points(moteGeo, moteMat);
  motes.renderOrder = 6;
  group.add(motes);

  /* --------------------- feedback fx (rings etc) ------------------- */
  const fxGroup = new THREE.Group();
  fxGroup.name = 'growthFx';
  group.add(fxGroup);
  const FX_DAY = new THREE.Color('#ffdf9e');
  const FX_NIGHT = new THREE.Color('#aebfff');
  const rippleMat = new THREE.MeshBasicMaterial({
    transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide,
  });
  const ripple = new THREE.Mesh(
    new THREE.RingGeometry(0.72, 0.9, 48).rotateX(-Math.PI / 2), rippleMat
  );
  ripple.visible = false;
  ripple.renderOrder = 7;
  fxGroup.add(ripple);

  const sparks = [];
  for (let i = 0; i < 12; i++) {
    const sm = new THREE.SpriteMaterial({
      map: glowTexture(), transparent: true, opacity: 0, depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    const sp = new THREE.Sprite(sm);
    sp.scale.set(0.42, 0.42, 1);
    sp.visible = false;
    fxGroup.add(sp);
    sparks.push({ sp, vel: new THREE.Vector3(), k: 1 });
  }
  let fxK = 1;
  let fxMaxR = 9;

  /* ------------------------- scale state --------------------------- */
  let sTarget = scaleFor(state.lifetime);
  let sCur = sTarget;

  function applySkirt() {
    const W = (sCur - 1) * ISLAND_R;
    if (W > 0.02) {
      skirtGroup.visible = true;
      if (Math.abs(W - lastSkirtW) > 0.004) {
        fillSkirt(shelfMesh.geometry, shelfTopo.V, W);
        fillSkirt(cliffMesh.geometry, cliffTopo.V, W);
        lastSkirtW = W;
      }
    } else {
      skirtGroup.visible = false;
      lastSkirtW = 0;
    }
  }

  function setMotes(level) {
    moteGeo.setDrawRange(0, Math.round(SEG * (level - 1) / 4));
    motes.visible = level > 1 && state.effects.motes !== false;
  }

  function persist() {
    writeJSON(STORE_KEY, state);
    for (const fn of listeners) {
      try { fn(); } catch (e) { /* a listener must never break growth */ }
    }
  }

  /** Grant + mark every milestone the lifetime count has earned. */
  function checkMilestones() {
    let crossed = null;
    for (const m of MILESTONES) {
      if (state.lifetime >= m && !state.milestones.includes(m)) {
        state.milestones.push(m);
        const u = UNLOCK_DEFS[m];
        if (u && !state.unlocks.includes(u.key)) state.unlocks.push(u.key);
        crossed = m;                     // keep the highest
      }
    }
    return crossed;
  }

  function beginExpansion() {
    sTarget = scaleFor(state.lifetime);
    expanding = true;
    setMotes(levelFor(state.lifetime));
    playFx(true);
  }

  function playFx(big) {
    const c = FX_DAY.clone().lerp(FX_NIGHT, nightLvl);
    rippleMat.color.copy(c);
    fxMaxR = 9.0 + (sCur - 1) * ISLAND_R * 1.05;
    fxK = 0;
    ripple.visible = true;
    const org = mailbox && mailbox.position
      ? mailbox.position
      : { x: 2.55, y: 1.2, z: 1.35 };
    const rng = makeRng(((state.lifetime * 7919 + 13) >>> 0) + (big ? 5 : 0));
    for (const s of sparks) {
      const a = rng() * TAU;
      const up = 1.9 + rng() * (big ? 2.6 : 1.6);
      const out = 0.7 + rng() * (big ? 1.9 : 1.1);
      s.vel.set(Math.cos(a) * out, up, Math.sin(a) * out);
      s.sp.position.set(
        org.x + (rng() - 0.5) * 0.3,
        org.y + 1.35,
        org.z + (rng() - 0.5) * 0.3
      );
      s.sp.material.color.copy(c);
      s.sp.material.opacity = 0.95;
      s.sp.visible = true;
      s.k = 0;
    }
  }

  function updateFx(dt) {
    if (fxK < 1) {
      fxK = Math.min(1, fxK + dt / 1.6);
      const e = 1 - Math.pow(1 - fxK, 2.2);
      ripple.scale.setScalar(0.4 + e * fxMaxR);
      rippleMat.opacity = 0.7 * (1 - fxK);
      if (fxK >= 1) ripple.visible = false;
    }
    for (const s of sparks) {
      if (s.k >= 1) continue;
      s.k = Math.min(1, s.k + dt / 1.15);
      s.vel.y -= 3.4 * dt;
      s.sp.position.addScaledVector(s.vel, dt);
      s.sp.material.opacity = 0.95 * (1 - s.k);
      if (s.k >= 1) s.sp.visible = false;
    }
  }

  /* --------------------------- public API -------------------------- */

  /**
   * A brand-new memory was just persisted. Idempotent per entry id:
   * re-saves / duplicates of the same id never double-count.
   */
  function onMemoryCreated(id) {
    if (typeof id === 'string' && !state.countedIds.includes(id)) {
      state.countedIds.push(id);
      state.lifetime++;
    }
    const milestone = checkMilestones();
    persist();
    if (milestone !== null) {
      beginExpansion();
      if (onMilestone) onMilestone(milestone);
    } else {
      playFx(false);
    }
    return {
      lifetime: state.lifetime,
      level: levelFor(state.lifetime),
      milestone,
    };
  }

  /**
   * Silent boot-time sync: fold existing entry ids into the lifetime
   * count (zero migration), grant already-earned milestones/unlocks
   * without any modal, and snap the terrain to its target instantly.
   */
  function sync(ids) {
    let changed = false;
    for (const id of ids || []) {
      if (typeof id === 'string' && !state.countedIds.includes(id)) {
        state.countedIds.push(id);
        state.lifetime++;
        changed = true;
      }
    }
    if (checkMilestones() !== null) changed = true;
    if (changed) persist();
    sTarget = scaleFor(state.lifetime);
    sCur = sTarget;
    expanding = false;
    applySkirt();
    setMotes(levelFor(state.lifetime));
  }

  /** Jump the expansion straight to its target (Skip button). */
  function skipExpansion() {
    sTarget = scaleFor(state.lifetime);
    sCur = sTarget;
    expanding = false;
    applySkirt();
    setMotes(levelFor(state.lifetime));
  }

  function update(dt, t) {
    if (Math.abs(sCur - sTarget) > 1e-4) {
      sCur = damp(sCur, sTarget, expanding ? 1.3 : 3.0, dt);
      if (Math.abs(sCur - sTarget) < 0.0012) {
        sCur = sTarget;
        expanding = false;
      }
      applySkirt();
    }
    if (motes.visible) {
      motes.rotation.y = t * 0.045;
      moteMat.opacity = 0.55 + 0.28 * Math.sin(t * 1.6);
    }
    updateFx(dt);
  }

  function setNightLevel(nl) { nightLvl = nl; }

  /* ---------------- Milestone B / C reserved surface --------------- */
  // unlocks = earned categories; placements = what the user actually
  // built (Milestone C consumes these). Kept separate on purpose.

  function placeLandscape(key, data) {
    const u = Object.values(UNLOCK_DEFS).find((d) => d.key === key);
    if (!u || !state.unlocks.includes(key)) return false;
    state.placements.push({
      key, data: data ?? null, at: new Date().toISOString(),
    });
    persist();
    return true;
  }

  function removeLandscape(index) {
    if (!Number.isInteger(index) || index < 0 || index >= state.placements.length) return false;
    state.placements.splice(index, 1);
    persist();
    return true;
  }

  function setEffectEnabled(key, on) {
    state.effects[key] = !!on;
    if (key === 'motes') setMotes(levelFor(state.lifetime));
    persist();
  }

  /* --------------------------- info API ---------------------------- */

  function levelInfo() {
    const lv = levelFor(state.lifetime);
    const L = LEVELS[lv - 1];
    return { level: lv, zh: L.zh, en: L.en, at: L.at, scale: L.scale };
  }

  function progress() {
    const n = state.lifetime;
    const nextAt = MILESTONES.find((m) => m > n);
    if (!nextAt) return null;
    const prevAt = [...MILESTONES].reverse().find((m) => m <= n) || 0;
    const lv = levelFor(nextAt);
    return {
      nextAt,
      nextLevel: lv,
      nextZh: LEVELS[lv - 1].zh,
      pct: Math.round((100 * (n - prevAt)) / (nextAt - prevAt)),
    };
  }

  function unlockList() {
    return Object.entries(UNLOCK_DEFS).map(([at, u]) => ({
      at: Number(at),
      key: u.key,
      zh: u.zh,
      en: u.en,
      emoji: u.emoji,
      text: u.text,
      unlocked: state.unlocks.includes(u.key),
    }));
  }

  function milestoneInfo(m) {
    const idx = LEVELS.findIndex((L) => L.at === m);
    const lv = idx >= 0 ? idx + 1 : LEVELS.length;
    const L = LEVELS[lv - 1];
    const u = UNLOCK_DEFS[m];
    return {
      level: lv,
      levelName: L.zh,
      levelEn: L.en,
      text: `第 ${m} 段记忆，让岛屿向外生长了一圈。地形正在缓缓延展——这份辽阔，是你们一起写出来的。`,
      unlockText: u ? `解锁景观 · ${u.zh} ${u.en} — ${u.text}（自由建设即将开放）` : '',
    };
  }

  /* --------------------------- debug hooks ------------------------- */

  function debugSetCount(n) {
    state.lifetime = Math.max(0, Math.floor(n));
    const milestone = checkMilestones();
    persist();
    if (milestone !== null) {
      beginExpansion();
      if (onMilestone) onMilestone(milestone);
    } else {
      beginExpansion();
    }
  }

  function debugSetScaleInstant(n) {
    sTarget = scaleFor(Math.max(0, n));
    sCur = sTarget;
    expanding = false;
    applySkirt();
    setMotes(levelFor(Math.max(0, n)));
  }

  function debugReset() {
    const fresh = freshState();
    Object.assign(state, fresh);
    persist();
    skipExpansion();
  }

  applySkirt();
  setMotes(levelFor(state.lifetime));

  return {
    group,
    update,
    setNightLevel,
    onMemoryCreated,
    sync,
    skipExpansion,
    // info
    lifetime: () => state.lifetime,
    level: () => levelFor(state.lifetime),
    levelInfo,
    progress,
    unlockList,
    milestoneInfo,
    scale: () => sCur,
    shoreRadius: () => SHORE_BASE + (sCur - 1) * ISLAND_R,
    // Milestone B / C reserved surface
    getUnlocks: () => [...state.unlocks],
    isUnlocked: (key) => state.unlocks.includes(key),
    getPlacements: () => state.placements.map((p) => ({ ...p })),
    placeLandscape,
    removeLandscape,
    setEffectEnabled,
    subscribe: (fn) => {
      listeners.push(fn);
      return () => {
        const i = listeners.indexOf(fn);
        if (i >= 0) listeners.splice(i, 1);
      };
    },
    // test hooks
    debugSetCount,
    debugSetScaleInstant,
    debugReset,
  };
}
