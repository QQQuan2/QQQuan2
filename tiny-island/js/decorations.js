import * as THREE from 'three';
import { createDecoration } from './nature.js?v=20261128b';
import { edgeRadius, surfaceHeight } from './island.js?v=20261128b';
import { RESERVED } from './growth.js?v=20261128b';
import { readJSON, writeJSON, TAU } from './utils.js?v=20261128b';

/* ------------------------------------------------------------------ *
 * "Make It Yours" — placement with a live ghost preview, validity
 * checks, erase tool and localStorage persistence.
 * ------------------------------------------------------------------ */

const KEY = 'tiny-island.decorations.v1';
const VALID_TYPES = ['tree', 'flower', 'rock', 'lantern'];

// Keep clear of the house, pond, mailbox, dock, the fixed props and
// the reserved growth spots (so growth items never overlap later).
const FORBID = [
  { x: 0, z: -1.4, r: 3.05 },      // cottage
  { x: 3.7, z: -2.9, r: 1.75 },    // pond
  { x: 2.55, z: 1.35, r: 1.05 },   // mailbox
  { x: 8.2, z: 3.6, r: 1.3 },      // dock foot
  // base trees
  { x: -4.3, z: -2.1, r: 1.35 }, { x: 4.9, z: -4.7, r: 1.2 },
  { x: -3.5, z: 2.6, r: 1.2 }, { x: -1.9, z: 4.3, r: 1.0 },
  // path lanterns
  { x: 1.1, z: 2.3, r: 0.8 }, { x: 7.0, z: 2.35, r: 0.8 },
  // landscape rocks
  { x: -5.2, z: -3.7, r: 0.8 }, { x: 5.9, z: 1.5, r: 0.8 },
  { x: -3.4, z: 5.6, r: 0.8 }, { x: 3.1, z: -5.3, r: 0.8 },
  { x: -6.2, z: -0.8, r: 0.8 },
  // fixed flower beds
  { x: -2.6, z: 1.5, r: 0.7 }, { x: -1.7, z: 2.3, r: 0.7 },
  { x: 1.9, z: -3.5, r: 0.7 }, { x: 5.4, z: -2.3, r: 0.7 },
  { x: 3.0, z: 4.4, r: 0.7 },
  ...RESERVED,
];

function defaultScale(type) {
  return { tree: 0.8, flower: 1.0, rock: 1.0, lantern: 1.0 }[type] || 1;
}

export function createDecorationSystem(world, refs) {
  const group = new THREE.Group();
  group.name = 'decorations';
  world.scene.add(group);

  const raycaster = new THREE.Raycaster();
  let tool = null;
  let ghost = null;
  let hoverId = null;

  let items = readJSON(KEY, []);
  if (!Array.isArray(items)) items = [];
  items = items.filter(
    (d) => d && VALID_TYPES.includes(d.type) &&
      typeof d.x === 'number' && typeof d.z === 'number'
  );

  function spawn(data) {
    const o = createDecoration(data.type, data);
    // Always re-seat on the current terrain — stored heights go stale when
    // the landscape is tweaked between versions.
    o.position.set(data.x, surfaceHeight(data.x, data.z), data.z);
    o.rotation.y = data.rot || 0;
    o.userData.decorationId = data.id;
    group.add(o);
    return o;
  }
  items.forEach(spawn);

  function validAt(x, z) {
    const a = Math.atan2(z, x);
    if (Math.hypot(x, z) > edgeRadius(a) * 0.9) return false;
    for (const f of FORBID) if (Math.hypot(x - f.x, z - f.z) < f.r) return false;
    for (const it of items) if (Math.hypot(x - it.x, z - it.z) < 0.88) return false;
    return true;
  }

  function clearGhost() {
    if (!ghost) return;
    group.remove(ghost);
    const m = ghost.userData.mats;
    if (m) { m.valid.dispose(); m.invalid.dispose(); }
    ghost = null;
  }

  function buildGhost(type) {
    clearGhost();
    if (!type || type === 'erase') return;
    const g = createDecoration(type, {
      seed: 4242, scale: defaultScale(type),
      kind: 'round', count: 4,
    });
    const valid = new THREE.MeshBasicMaterial({
      color: '#a7e58f', transparent: true, opacity: 0.48, depthWrite: false,
    });
    const invalid = new THREE.MeshBasicMaterial({
      color: '#e88d7d', transparent: true, opacity: 0.45, depthWrite: false,
    });
    g.traverse((o) => {
      if (o.isMesh) {
        o.material = valid;
        o.castShadow = false;
        o.receiveShadow = false;
      }
      if (o.isLight) o.intensity = 0;
      if (o.isSprite) o.visible = false;
    });
    g.visible = false;
    g.userData.mats = { valid, invalid };
    g.userData.lastHit = null;
    group.add(g);
    ghost = g;
  }

  function setTool(next) {
    tool = tool === next ? null : next;
    buildGhost(tool);
    hoverId = null;
    return tool;
  }

  function findRoot(obj) {
    let o = obj;
    while (o && o !== group) {
      if (o.userData && o.userData.decorationId !== undefined) return o.userData.decorationId;
      o = o.parent;
    }
    return null;
  }

  function decorationMeshes() {
    return group.children.filter((o) => o.userData.decorationId !== undefined);
  }

  function updatePointer(ndc, camera) {
    raycaster.setFromCamera(ndc, camera);

    if (ghost) {
      const hits = raycaster.intersectObject(refs.ground, false);
      if (hits.length) {
        const p = hits[0].point;
        const ok = validAt(p.x, p.z);
        ghost.visible = true;
        ghost.position.set(p.x, p.y, p.z);
        ghost.userData.lastHit = { x: p.x, y: p.y, z: p.z, ok };
        const m = ok ? ghost.userData.mats.valid : ghost.userData.mats.invalid;
        ghost.traverse((o) => { if (o.isMesh) o.material = m; });
      } else {
        ghost.visible = false;
        ghost.userData.lastHit = null;
      }
    }

    hoverId = null;
    if (tool === 'erase') {
      const hits = raycaster.intersectObjects(decorationMeshes(), true);
      if (hits.length) hoverId = findRoot(hits[0].object);
    }
  }

  function handleClick(ndc, camera) {
    if (!tool) return null;
    raycaster.setFromCamera(ndc, camera);

    if (tool === 'erase') {
      const hits = raycaster.intersectObjects(decorationMeshes(), true);
      if (!hits.length) return 'erase-empty';
      const id = findRoot(hits[0].object);
      if (id === null) return 'erase-empty';
      const idx = items.findIndex((d) => d.id === id);
      if (idx >= 0) {
        items.splice(idx, 1);
        const obj = group.children.find((o) => o.userData.decorationId === id);
        if (obj) group.remove(obj);
        writeJSON(KEY, items);
      }
      return 'removed';
    }

    // Recompute the ground hit from the click itself instead of relying on
    // the last pointermove — this makes touch / tap (and quick clicks that
    // land slightly away from the preview) work correctly.
    const hits = raycaster.intersectObject(refs.ground, false);
    if (!hits.length) return 'invalid';
    const p = hits[0].point;
    if (!validAt(p.x, p.z)) return 'invalid';

    const data = {
      id: 'd' + Date.now().toString(36) + Math.floor(Math.random() * 997),
      type: tool,
      x: p.x, y: p.y, z: p.z,
      rot: Math.random() * TAU,
      scale: defaultScale(tool) * (0.85 + Math.random() * 0.35),
      seed: Math.floor(Math.random() * 9999),
      kind: tool === 'tree' ? (Math.random() > 0.72 ? 'pine' : 'round') : undefined,
      count: tool === 'flower' ? 4 : undefined,
    };
    items.push(data);
    spawn(data);
    writeJSON(KEY, items);
    return 'placed';
  }

  function reset() {
    for (const o of decorationMeshes()) group.remove(o);
    items = [];
    writeJSON(KEY, []);
  }

  return {
    setTool, getTool: () => tool, updatePointer, handleClick, reset,
    getHoverId: () => hoverId,
    count: () => items.length,
    getAll: () => items.map((d) => ({ x: d.x, z: d.z })),
    hasTool: () => tool !== null,
  };
}
