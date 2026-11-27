import * as THREE from 'three';
import {
  standard, emissive, mesh, mat, geo, box, TAU, makeRng,
  blobGeometry, glowTexture, TriBuilder, shade,
} from './utils.js?v=20261127a';
import { surfaceHeight, edgeRadius } from './island.js?v=20261127a';
import { createTree, createFlowerCluster, createRock, createLantern } from './nature.js?v=20261127a';

/* ------------------------------------------------------------------ *
 * The little world: winding path, pond, dock, sailboat, garden,
 * lamps, fence and — most importantly — the memory mailbox.
 * ------------------------------------------------------------------ */

function place(o, x, z, dy = 0, rot = 0) {
  o.position.set(x, surfaceHeight(x, z) + dy, z);
  o.rotation.y = rot;
  return o;
}

/* ---------------------------- path -------------------------------- */
function createPath() {
  const g = new THREE.Group();
  const pts = [
    [0.9, 0.6], [1.3, 1.4], [1.9, 2.2], [2.8, 2.7],
    [3.9, 2.95], [5.1, 3.05], [6.3, 3.15], [7.5, 3.35], [8.3, 3.6],
  ].map(([x, z]) => new THREE.Vector3(x, surfaceHeight(x, z) + 0.045, z));
  const curve = new THREE.CatmullRomCurve3(pts);
  const rng = makeRng(6644);
  const slabMats = ['#d6c9ac', '#c9bda0', '#ded2b8', '#c3b497'].map((c, i) =>
    mat(`s-slab${i}`, () => standard(c))
  );
  const N = 22;
  for (let i = 0; i < N; i++) {
    const t = (i + 0.5) / N;
    const p = curve.getPoint(t);
    const tan = curve.getTangent(t);
    const s = mesh(box(0.66, 0.075, 0.5), slabMats[Math.floor(rng() * 4)], {
      pos: [p.x, p.y, p.z],
    });
    s.rotation.y = Math.atan2(tan.x, tan.z) + (rng() - 0.5) * 0.38;
    s.scale.set(0.85 + rng() * 0.35, 1, 0.85 + rng() * 0.3);
    s.castShadow = false;
    g.add(s);
  }
  return g;
}

/* ---------------------------- pond -------------------------------- */
function createPond() {
  const g = new THREE.Group();
  const rng = makeRng(3391);
  const x = 3.7, z = -2.9;
  const y = surfaceHeight(x, z);

  const rimGeo = new THREE.CircleGeometry(1.45, 14);
  const rp = rimGeo.attributes.position;
  for (let i = 1; i < rp.count; i++) {
    const vx = rp.getX(i), vy = rp.getY(i);
    const k = 0.9 + rng() * 0.2;
    rp.setXY(i, vx * k, vy * k);
  }
  rp.needsUpdate = true;
  const rim = mesh(rimGeo, mat('s-rim', () => standard('#6e8c43')), {
    pos: [0, 0.012, 0], rot: [-Math.PI / 2, 0, 0], cast: false,
  });
  g.add(rim);

  const waterGeo = new THREE.CircleGeometry(1.2, 13);
  const wp = waterGeo.attributes.position;
  for (let i = 1; i < wp.count; i++) {
    const vx = wp.getX(i), vy = wp.getY(i);
    const k = 0.92 + rng() * 0.14;
    wp.setXY(i, vx * k, vy * k);
  }
  wp.needsUpdate = true;
  const water = mesh(waterGeo, new THREE.MeshStandardMaterial({
    color: '#4bb4c6', roughness: 0.2, metalness: 0.14,
    transparent: true, opacity: 0.92, side: THREE.DoubleSide,
    emissive: new THREE.Color('#12495c'), emissiveIntensity: 0.3,
  }), { pos: [0, 0.032, 0], rot: [-Math.PI / 2, 0, 0], cast: false });
  g.add(water);

  // lily pads + a tiny water flower
  for (let i = 0; i < 4; i++) {
    const a = rng() * TAU, r = 0.3 + rng() * 0.7;
    g.add(mesh(geo('s-lily', () => new THREE.CircleGeometry(0.2, 9)),
      mat('s-lilyMat', () => standard('#5c9a4a', { side: THREE.DoubleSide })), {
        pos: [Math.cos(a) * r, 0.048, Math.sin(a) * r],
        rot: [-Math.PI / 2, 0, rng() * TAU], cast: false,
      }));
  }
  g.add(mesh(blobGeometry('pondFlower', 0.16), mat('s-pondFlower', () => standard('#f6e8c8')), {
    pos: [-0.25, 0.09, 0.3], scale: [0.13, 0.08, 0.13], cast: false,
  }));

  // reeds
  const reedMat = mat('s-reed', () => standard('#6d9a45'));
  const tipMat = mat('s-reedTip', () => standard('#a9813f'));
  for (let i = 0; i < 9; i++) {
    const a = rng() * TAU, r = 1.25 + rng() * 0.3;
    const h = 0.4 + rng() * 0.45;
    const px = Math.cos(a) * r, pz = Math.sin(a) * r;
    g.add(mesh(geo('s-reedGeo', () => new THREE.CylinderGeometry(0.018, 0.028, 1, 4)), reedMat, {
      pos: [px, h / 2, pz], scale: [1, h, 1],
    }));
    g.add(mesh(geo('s-reedTipGeo', () => new THREE.ConeGeometry(0.055, 0.2, 5)), tipMat, {
      pos: [px, h + 0.08, pz],
    }));
  }
  // a few pebbles at the shore
  for (let i = 0; i < 5; i++) {
    const a = rng() * TAU, r = 1.5 + rng() * 0.25;
    const rock = createRock(0.4 + rng() * 0.25, 90 + i);
    rock.position.set(Math.cos(a) * r, 0, Math.sin(a) * r);
    g.add(rock);
  }
  g.position.set(x, y, z);
  return g;
}

/* ---------------------------- dock -------------------------------- */
function createDock() {
  const g = new THREE.Group();
  const woodMats = ['#a2714a', '#93633f', '#b07e52'].map((c, i) =>
    mat(`s-dock${i}`, () => standard(c))
  );
  const start = new THREE.Vector2(8.2, 3.6);
  const dir = new THREE.Vector2(0.93, 0.37).normalize();
  const side = new THREE.Vector2(-dir.y, dir.x);
  const baseY = surfaceHeight(start.x, start.y) - 0.06;

  for (let i = 0; i < 7; i++) {
    const px = start.x + dir.x * (i * 0.52);
    const pz = start.y + dir.y * (i * 0.52);
    const plank = mesh(box(1.55, 0.12, 0.44), woodMats[i % 3], {
      pos: [px, baseY - i * 0.012, pz],
    });
    plank.rotation.y = Math.atan2(dir.x, dir.y);
    g.add(plank);
    if (i === 0 || i === 3 || i === 6) {
      for (const s of [-1, 1]) {
        const post = mesh(geo('s-post', () => new THREE.CylinderGeometry(0.075, 0.09, 2.6, 6)),
          mat('s-postMat', () => standard('#6d4a30')), {
            pos: [px + side.x * 0.68 * s, baseY - 1.25, pz + side.y * 0.68 * s],
          });
        g.add(post);
      }
    }
  }
  // mooring bollards
  for (const s of [-1, 1]) {
    g.add(mesh(geo('s-bollard', () => new THREE.CylinderGeometry(0.1, 0.11, 0.42, 7)),
      mat('s-postMat', () => standard('#6d4a30')), {
        pos: [start.x + dir.x * 3.2 + side.x * 0.6 * s, baseY + 0.2, start.y + dir.y * 3.2 + side.y * 0.6 * s],
      }));
  }
  return { group: g, tip: new THREE.Vector3(start.x + dir.x * 3.55, baseY, start.y + dir.y * 3.55) };
}

/* --------------------------- sailboat ----------------------------- */
/** Hand-built faceted hull: a tapered U-section swept along the boat length. */
function createHullGeometry() {
  const tb = new TriBuilder();
  const rng = makeRng(8821);
  const L = 2.25, W = 0.64, NZ = 9;
  const cPort = new THREE.Color('#9a6a3e');
  const cStar = new THREE.Color('#8a5a34');
  const cBottom = new THREE.Color('#6b4428');
  const hw = (j) => W * Math.pow(Math.sin((Math.PI * j) / NZ), 0.62);
  const zOf = (j) => -L / 2 + (L * j) / NZ;
  for (let j = 0; j < NZ; j++) {
    const h0 = hw(j), h1 = hw(j + 1);
    const z0 = zOf(j), z1 = zOf(j + 1);
    const L0 = [-h0, 0.36, z0], L1 = [-h1, 0.36, z1];
    const l0 = [-h0 * 0.48, 0.0, z0], l1 = [-h1 * 0.48, 0.0, z1];
    const R0 = [h0, 0.36, z0], R1 = [h1, 0.36, z1];
    const r0 = [h0 * 0.48, 0.0, z0], r1 = [h1 * 0.48, 0.0, z1];
    tb.quad(L0, L1, l1, l0, shade(cPort, 0.9 + rng() * 0.2));
    tb.quad(r1, r0, R0, R1, shade(cStar, 0.9 + rng() * 0.2));
    tb.quad(l0, l1, r1, r0, shade(cBottom, 0.9 + rng() * 0.2));
  }
  return tb.build();
}

function createBoat() {
  const g = new THREE.Group();
  const hull = mesh(createHullGeometry(), standard('#ffffff', { vertexColors: true, side: THREE.DoubleSide }));
  g.add(hull);
  // deck
  g.add(mesh(box(0.86, 0.06, 1.55), mat('s-deck', () => standard('#6f482c')), {
    pos: [0, 0.16, 0],
  }));
  // mast
  g.add(mesh(geo('s-mast', () => new THREE.CylinderGeometry(0.035, 0.045, 1.75, 6)),
    mat('s-mastMat', () => standard('#6b4a30')), { pos: [0, 1.05, -0.12] }));
  // sail
  const sailGeo = new THREE.BufferGeometry();
  sailGeo.setAttribute('position', new THREE.Float32BufferAttribute([
    0, 0.42, -0.1, 0, 1.88, -0.1, 0, 0.52, 0.92,
  ], 3));
  sailGeo.computeVertexNormals();
  g.add(mesh(sailGeo, mat('s-sail', () => standard('#f6ecd2', { side: THREE.DoubleSide })), {
    cast: true,
  }));
  // little pennant
  const flagGeo = new THREE.BufferGeometry();
  flagGeo.setAttribute('position', new THREE.Float32BufferAttribute([
    0, 1.88, -0.1, 0, 1.68, -0.1, 0.34, 1.79, -0.1,
  ], 3));
  flagGeo.computeVertexNormals();
  g.add(mesh(flagGeo, mat('s-flag', () => standard('#d2553c', { side: THREE.DoubleSide })), {
    cast: false,
  }));
  // a soft cloud puff under the boat (it floats on the sea of clouds)
  const puffMat = new THREE.MeshBasicMaterial({
    color: '#eaf4f2', transparent: true, opacity: 0.55, depthWrite: false,
  });
  for (let i = 0; i < 4; i++) {
    const p = mesh(blobGeometry('seaCloud', 0.16), puffMat, {
      pos: [(i - 1.5) * 0.48, -0.28, (i % 2 ? 0.22 : -0.2)],
      scale: [0.6, 0.2, 0.42], cast: false, receive: false,
    });
    g.add(p);
  }
  g.userData.update = (t) => {
    g.position.y = g.userData.baseY + Math.sin(t * 0.9) * 0.09;
    g.rotation.z = Math.sin(t * 0.7) * 0.045;
    g.rotation.x = Math.sin(t * 0.55 + 1) * 0.03;
    g.rotation.y = g.userData.baseRot + Math.sin(t * 0.35) * 0.06;
  };
  g.userData.baseY = -0.75;
  g.userData.baseRot = -0.5;
  g.userData.interactive = 'dock';
  return g;
}

/* --------------------------- mailbox ------------------------------ */
function createMailbox() {
  const g = new THREE.Group();
  const wood = mat('s-mbWood', () => standard('#5b3a28'));
  const red = mat('s-mbRed', () => standard('#c8533a'));
  const redDark = mat('s-mbRedDark', () => standard('#9d3e2c'));
  const cream = mat('s-mbCream', () => standard('#f6e9cf'));

  g.add(mesh(box(0.5, 0.16, 0.5), mat('s-mbBase', () => standard('#9d8e79')), {
    pos: [0, 0.08, 0],
  }));
  g.add(mesh(geo('s-mbPost', () => new THREE.CylinderGeometry(0.075, 0.095, 1.35, 7)), wood, {
    pos: [0, 0.82, 0],
  }));
  // body
  const body = mesh(box(0.72, 0.56, 0.52), red, { pos: [0, 1.62, 0] });
  g.add(body);
  // curved lid
  const lidShape = new THREE.Shape();
  lidShape.moveTo(0.36, 0);
  lidShape.absarc(0, 0, 0.36, 0, Math.PI, false);
  lidShape.lineTo(0.36, 0);
  const lidGeo = new THREE.ExtrudeGeometry(lidShape, { depth: 0.54, bevelEnabled: false, curveSegments: 12 });
  lidGeo.translate(0, 0, -0.27);
  g.add(mesh(lidGeo, redDark, { pos: [0, 1.9, 0] }));
  // mail slot
  g.add(mesh(box(0.42, 0.055, 0.03), mat('s-mbSlot', () => standard('#3d2b22')), {
    pos: [0, 1.72, 0.275],
  }));
  // little envelope emblem
  g.add(mesh(box(0.22, 0.15, 0.02), cream, { pos: [0, 1.5, 0.272] }));
  g.add(mesh(box(0.22, 0.016, 0.024), redDark, { pos: [0, 1.55, 0.286], rot: [0, 0, 0.55] }));
  g.add(mesh(box(0.22, 0.016, 0.024), redDark, { pos: [0, 1.55, 0.286], rot: [0, 0, -0.55] }));
  // flag
  g.add(mesh(geo('s-mbFlagPole', () => new THREE.CylinderGeometry(0.018, 0.018, 0.42, 5)), wood, {
    pos: [0.4, 1.86, -0.1],
  }));
  const flag = mesh(box(0.2, 0.14, 0.02), mat('s-mbFlag', () => standard('#e0a33c')), {
    pos: [0.5, 2.0, -0.1],
  });
  g.add(flag);
  g.userData.flag = flag;

  // glowing memory indicator
  const indicatorMat = mat('s-mbIndicator', () => emissive('#ffd07a', 0.5));
  const indicator = mesh(geo('s-mbOrb', () => new THREE.IcosahedronGeometry(0.095, 1)), indicatorMat, {
    pos: [0, 2.36, 0], cast: false,
  });
  g.add(indicator);
  const halo = new THREE.Sprite(new THREE.SpriteMaterial({
    map: glowTexture(), color: '#ffcf85', transparent: true,
    opacity: 0.35, depthWrite: false, blending: THREE.AdditiveBlending,
  }));
  halo.scale.set(1.15, 1.15, 1);
  halo.position.set(0, 2.36, 0);
  g.add(halo);

  // small hanging lamp
  const lampGlass = mat('s-mbLamp', () => emissive('#ffc477', 0.45));
  g.add(mesh(box(0.1, 0.16, 0.1), wood, { pos: [-0.44, 1.85, 0] }));
  g.add(mesh(geo('s-mbLampGeo', () => new THREE.IcosahedronGeometry(0.075, 1)), lampGlass, {
    pos: [-0.44, 1.72, 0], cast: false,
  }));

  // flowers at the foot
  const foot = createFlowerCluster(4, 321, 0.85);
  foot.position.set(0.38, 0, 0.2);
  g.add(foot);
  const foot2 = createFlowerCluster(3, 322, 0.8);
  foot2.position.set(-0.36, 0, 0.24);
  g.add(foot2);

  g.userData.interactive = 'mailbox';
  g.userData.indicator = indicator;
  g.userData.indicatorMat = indicatorMat;
  g.userData.halo = halo;
  g.userData.hover = false;
  g.userData.glow = 0;
  g.userData.flash = 0;
  g.userData.indicatorBase = 0.5;
  g.userData.setHover = (v) => { g.userData.hover = v; };
  g.userData.update = (t, dt = 0.016) => {
    g.userData.flash = Math.max(0, g.userData.flash - dt * 1.15);
    const target = g.userData.hover ? 0.22 : 0;
    g.position.y = g.userData.baseY + target + Math.sin(t * 1.6) * 0.018;
    indicator.rotation.y = t * 0.8;
    indicator.position.y = 2.36 + Math.sin(t * 1.8) * 0.05;
    halo.position.y = indicator.position.y;
    const pulse = 0.5 + Math.sin(t * 2.2) * 0.12;
    halo.material.opacity = Math.min(
      1, (0.25 + g.userData.glow * 0.55) * pulse * 2 + g.userData.flash * 0.55
    );
    halo.scale.setScalar(1.15 + g.userData.flash * 1.5);
    indicatorMat.emissiveIntensity = g.userData.indicatorBase + g.userData.flash * 2.4;
    flag.rotation.z = Math.sin(t * 2.5) * 0.12;
  };
  return g;
}

/* ---------------------------- fence ------------------------------- */
function createFence(points) {
  const g = new THREE.Group();
  const wood = mat('s-fence', () => standard('#8a6343'));
  const rail = mat('s-fenceRail', () => standard('#a07a52'));
  for (let i = 0; i < points.length; i++) {
    const [x, z] = points[i];
    const y = surfaceHeight(x, z);
    g.add(mesh(geo('s-fencePost', () => new THREE.CylinderGeometry(0.045, 0.055, 0.62, 5)), wood, {
      pos: [x, y + 0.31, z],
    }));
    if (i < points.length - 1) {
      const [x2, z2] = points[i + 1];
      const y2 = surfaceHeight(x2, z2);
      const dx = x2 - x, dz = z2 - z;
      const len = Math.hypot(dx, dz);
      for (const hy of [0.24, 0.44]) {
        const b = mesh(box(len, 0.05, 0.05), rail, {
          pos: [(x + x2) / 2, (y + y2) / 2 + hy, (z + z2) / 2],
        });
        b.rotation.y = Math.atan2(dx, dz) + Math.PI / 2;
        g.add(b);
      }
    }
  }
  return g;
}

/* --------------------------- assembly ----------------------------- */
export function buildStructures() {
  const group = new THREE.Group();
  group.name = 'structures';
  const rng = makeRng(20261);

  group.add(createPath());
  group.add(createPond());

  const dock = createDock();
  dock.group.userData.interactive = 'dock';
  group.add(dock.group);

  const boat = createBoat();
  boat.position.set(dock.tip.x + 0.45, boat.userData.baseY, dock.tip.z + 0.95);
  boat.rotation.y = boat.userData.baseRot;
  group.add(boat);

  const mailbox = createMailbox();
  place(mailbox, 2.55, 1.35, 0, -0.35);
  mailbox.userData.baseY = mailbox.position.y;
  group.add(mailbox);

  // garden fence
  group.add(createFence([
    [-3.1, 0.6], [-2.5, 1.1], [-1.9, 1.6], [-1.3, 2.1],
  ]));

  // trees — few and well spread, one per region, lawn left to breathe
  const trees = [
    ['round', -4.3, -2.1, 1.15],   // west, behind the cottage
    ['autumn', 4.9, -4.7, 1.0],    // south-east corner
    ['pine', -3.5, 2.6, 1.05],     // north-west, above the garden
    ['round', -1.9, 4.3, 0.82],    // north lawn
  ];
  trees.forEach(([kind, x, z, s], i) => {
    const t = createTree(kind, s, i);
    place(t, x, z, 0, rng() * TAU);
    group.add(t);
  });

  // flower beds — garden strip, pond shore, and one by the dock path
  const beds = [
    [-2.6, 1.5], [-1.7, 2.3],     // inside the garden fence
    [1.9, -3.5], [5.4, -2.3],     // pond shore
    [3.0, 4.4],                   // beside the path to the dock
  ];
  beds.forEach(([x, z], i) => {
    const f = createFlowerCluster(4 + Math.floor(rng() * 3), 400 + i, 0.95 + rng() * 0.4);
    place(f, x, z, 0, rng() * TAU);
    group.add(f);
  });

  // shoreline rocks — at the rim and terrain breaks only
  const rocks = [
    [-5.2, -3.7], [5.9, 1.5], [-3.4, 5.6], [3.1, -5.3], [-6.2, -0.8],
  ];
  rocks.forEach(([x, z], i) => {
    const r = createRock(0.65 + rng() * 0.7, 700 + i);
    place(r, x, z, 0, rng() * TAU);
    group.add(r);
  });

  // path lanterns — set back from the path, never on the slabs
  const lanterns = [];
  [[1.1, 2.3], [7.0, 2.35]].forEach(([x, z], i) => {
    const l = createLantern(1);
    place(l, x, z, 0, rng() * TAU);
    group.add(l);
    lanterns.push(l);
  });

  const memoryGroup = new THREE.Group();
  group.add(memoryGroup);

  return {
    group, mailbox, boat, lanterns, dock,
    growth: { stars: memoryGroup },
  };
}
