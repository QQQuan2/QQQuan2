import * as THREE from 'three';
import {
  standard, emissive, mesh, mat, geo, box, shade, TriBuilder,
  rockGeometry, blobGeometry, makeRng,
} from './utils.js';
import { HOUSE } from './house-config.js';

/* ------------------------------------------------------------------ *
 * The cottage — the visual anchor of the island.
 * Curved tiled roof, half-timbered walls, arched glowing windows,
 * dormer, stone chimney with drifting smoke, porch and flower boxes.
 * ------------------------------------------------------------------ */

const WALL = '#f1e0bf';
const TIMBER = '#5b3a28';
const TIMBER_L = '#7b5137';
const ROOF_SOLID = '#d2662c';
const STONE = '#9d8e79';

function archShape(w, h, cx = 0, cy = 0) {
  const hw = w / 2;
  const s = new THREE.Shape();
  s.moveTo(cx - hw, cy);
  s.lineTo(cx - hw, cy + h - hw);
  s.absarc(cx, cy + h - hw, hw, Math.PI, 0, true);
  s.lineTo(cx + hw, cy);
  s.closePath();
  return s;
}

/**
 * Extruded wall panel with true openings (M1.2). The shape lives in the
 * local XY plane (y = 0 at the wall base) and is extruded along +z by
 * `t`. Callers rotate/position it onto the four facades.
 */
function wallPanel(w, h, t, holes = []) {
  const s = new THREE.Shape();
  s.moveTo(-w / 2, 0);
  s.lineTo(-w / 2, h);
  s.lineTo(w / 2, h);
  s.lineTo(w / 2, 0);
  s.closePath();
  for (const hn of holes) s.holes.push(hn);
  return new THREE.ExtrudeGeometry(s, { depth: t, bevelEnabled: false, curveSegments: 16 });
}

function buildRoofGeometry(halfW, halfD, gableHalfD, H, ridgeH, rng) {
  const tb = new TriBuilder();
  const NX = 10, NZ = 14;
  const A = new THREE.Color('#d9692c');
  const B = new THREE.Color('#c65826');
  const wallC = new THREE.Color(WALL);
  const yAt = (u) => H + ridgeH * (1 - Math.pow(u, 1.7)) + 0.2 * Math.pow(u, 8);

  for (const side of [1, -1]) {
    for (let j = 0; j < NZ; j++) {
      const z0 = -halfD + (2 * halfD * j) / NZ;
      const z1 = -halfD + (2 * halfD * (j + 1)) / NZ;
      for (let i = 0; i < NX; i++) {
        const u0 = i / NX, u1 = (i + 1) / NX;
        const x0 = side * halfW * u0, x1 = side * halfW * u1;
        const y0 = yAt(u0), y1 = yAt(u1);
        const p00 = [x0, y0, z0], p10 = [x1, y1, z0];
        const p01 = [x0, y0, z1], p11 = [x1, y1, z1];
        const c = shade(j % 2 === 0 ? A : B, 0.9 + rng() * 0.18);
        if (side === 1) tb.quad(p00, p01, p11, p10, c);
        else tb.quad(p10, p11, p01, p00, c);
      }
    }
  }
  // gable ends, filled with warm plaster — flush with the wall planes
  // (M1.3: they used to float at ±halfD, 0.36 in front of the walls)
  for (const z of [-gableHalfD, gableHalfD]) {
    for (let i = 0; i < NX * 2; i++) {
      const xa = -halfW + (2 * halfW * i) / (NX * 2);
      const xb = -halfW + (2 * halfW * (i + 1)) / (NX * 2);
      const ya = yAt(Math.abs(xa) / halfW), yb = yAt(Math.abs(xb) / halfW);
      const p00 = [xa, H, z], p10 = [xb, H, z];
      const p01 = [xa, ya, z], p11 = [xb, yb, z];
      const c = shade(wallC, 0.9 + rng() * 0.12);
      if (z > 0) tb.quad(p00, p10, p11, p01, c);
      else tb.quad(p10, p00, p01, p11, c);
    }
  }
  return tb.build();
}

export function buildHouse() {
  const rng = makeRng(4519);
  const g = new THREE.Group();
  g.name = 'house';

  const W = HOUSE.exterior.W, D = HOUSE.exterior.D, H = HOUSE.exterior.H;
  const T = HOUSE.exterior.wallT;
  const halfW = (W + 0.72) / 2;
  const halfD = (D + 0.72) / 2;
  const ridgeH = HOUSE.exterior.ridgeH;

  const wallMat = mat('h-wall', () => standard(WALL));
  const timberMat = mat('h-timber', () => standard(TIMBER));
  const timberLMat = mat('h-timberL', () => standard(TIMBER_L));
  const stoneMat = mat('h-stone', () => standard(STONE));
  const roofSolid = mat('h-roof', () => standard(ROOF_SOLID));
  const roofDark = mat('h-roofDark', () => standard('#a8481f'));
  const glassMat = mat('h-glass', () => emissive('#ffd58a', 0.18));
  const lampMat = mat('h-lamp', () => emissive('#ffc477', 0.35));

  /* stone plinth */
  g.add(mesh(box(W + 0.34, 0.38, D + 0.34), stoneMat, { pos: [0, -0.17, 0] }));
  g.add(mesh(box(W + 0.14, 0.12, D + 0.14), timberLMat, { pos: [0, 0.05, 0] }));

  /* main walls — a real shell with true door / window openings (M1.2).
     Each wall is an extruded panel whose openings are shape holes, so
     doors and windows sit in genuine recesses instead of decals on a
     solid box. Hole outlines exactly match the frame shapes below. */
  const baseY = HOUSE.exterior.baseY;
  const doorHole = archShape(1.22, 2.0, -0.55, 0.002);    // = doorFrame outline
  const frontWinHole = archShape(1.08, 1.37, 1.15, 0.96); // = front window frame
  const sideWinHoleR = archShape(0.94, 1.21, 0.15, 0.99); // right wall (shape x = world z)
  const sideWinHoleL = archShape(0.94, 1.21, 0.2, 0.99);  // left wall  (shape x = -world z)

  g.add(mesh(wallPanel(W, H, T, [doorHole, frontWinHole]), wallMat,
    { pos: [0, baseY, D / 2 - T] }));                                             // front
  g.add(mesh(wallPanel(W, H, T), wallMat,
    { pos: [0, baseY, -D / 2], rot: [0, Math.PI, 0] }));                          // back
  g.add(mesh(wallPanel(D, H, T, [sideWinHoleL]), wallMat,
    { pos: [-W / 2, baseY, 0], rot: [0, Math.PI / 2, 0] }));                      // left
  g.add(mesh(wallPanel(D, H, T, [sideWinHoleR]), wallMat,
    { pos: [W / 2, baseY, 0], rot: [0, -Math.PI / 2, 0] }));                      // right

  /* half-timber framing */
  const frontZ = D / 2 + 0.055;
  const beam = (w, h, d, x, y, z, rz = 0, m = timberMat) => {
    const b = mesh(box(w, h, d), m, { pos: [x, y, z] });
    b.rotation.z = rz;
    g.add(b);
    return b;
  };
  beam(W + 0.06, 0.17, 0.13, 0, H - 0.04, frontZ);
  beam(W + 0.06, 0.15, 0.13, 0, 0.2, frontZ);
  // M1.2: the y=1.42 rail used to run straight through the door and the
  // arched window — it is now split into segments beside the openings
  // (door x -1.16..0.06, window x 0.61..1.69)
  beam(0.97, 0.11, 0.12, -1.645, 1.42, frontZ);
  beam(0.55, 0.11, 0.12, 0.335, 1.42, frontZ);
  beam(0.44, 0.11, 0.12, 1.915, 1.42, frontZ);
  beam(0.16, H, 0.14, -W / 2 + 0.02, H / 2 + 0.06, frontZ);
  beam(0.16, H, 0.14, W / 2 - 0.02, H / 2 + 0.06, frontZ);
  // M1.2: corner braces shortened and pushed out to x ±1.9 so they no
  // longer press on the front window frame (which reaches x ±1.69)
  beam(0.12, 0.6, 0.12, -1.9, 0.75, frontZ + 0.02, 0.5);
  beam(0.12, 0.6, 0.12, 1.9, 0.75, frontZ + 0.02, -0.5);
  beam(0.12, 0.6, 0.12, -1.9, 1.95, frontZ + 0.02, -0.5);
  beam(0.12, 0.6, 0.12, 1.9, 1.95, frontZ + 0.02, 0.5);

  // side framing — the y=1.42 rail is split around each side window
  for (const sx of [-1, 1]) {
    const x = sx * (W / 2 + 0.055);
    const b1 = mesh(box(0.13, 0.16, D + 0.06), timberMat, { pos: [x, H - 0.04, 0] });
    const b2 = mesh(box(0.13, 0.14, D + 0.06), timberMat, { pos: [x, 0.2, 0] });
    g.add(b1, b2);
    const gap = sx === 1 ? [-0.32, 0.62] : [-0.67, 0.27]; // side window z range
    const rails = [
      [-D / 2 - 0.03, gap[0]],
      [gap[1], D / 2 + 0.03],
    ];
    for (const [z0, z1] of rails) {
      if (z1 - z0 > 0.05) {
        g.add(mesh(box(0.12, 0.11, z1 - z0), timberMat, { pos: [x, 1.42, (z0 + z1) / 2] }));
      }
    }
    const c1 = mesh(box(0.14, H, 0.16), timberMat, { pos: [x, H / 2 + 0.06, -D / 2 + 0.02] });
    const c2 = mesh(box(0.14, H, 0.16), timberMat, { pos: [x, H / 2 + 0.06, D / 2 - 0.02] });
    g.add(c1, c2);
  }

  /* curved tiled roof — everything roof-related lives in one group so
     the future Dollhouse view can hide / ghost the roof as a unit
     without touching walls, windows or furniture (M1.6) */
  const roofGroup = new THREE.Group();
  roofGroup.name = 'roof';
  const roof = mesh(
    buildRoofGeometry(halfW, halfD, D / 2, H + 0.06, ridgeH, rng),
    standard('#ffffff', { vertexColors: true, roughness: 0.82, side: THREE.DoubleSide })
  );
  roofGroup.add(roof);
  // eaves + ridge caps
  for (const s of [-1, 1]) {
    roofGroup.add(mesh(box(0.18, 0.15, 2 * halfD + 0.06), roofDark, {
      pos: [s * halfW, H + 0.06 + 0.2, 0],
    }));
  }
  roofGroup.add(mesh(box(0.24, 0.18, 2 * halfD + 0.16), roofDark, {
    pos: [0, H + 0.06 + ridgeH + 0.02, 0],
  }));
  // little ridge finials
  for (const s of [-1, 1]) {
    roofGroup.add(mesh(geo('finial', () => new THREE.ConeGeometry(0.14, 0.34, 5)), timberLMat, {
      pos: [0, H + ridgeH + 0.24, s * (halfD + 0.02)],
    }));
  }
  g.add(roofGroup);

  /* arched window helper */
  function windowUnit(w, h, withBox = false) {
    const u = new THREE.Group();
    const frame = new THREE.Mesh(new THREE.ShapeGeometry(archShape(w + 0.16, h + 0.13), 14), timberMat);
    frame.position.z = 0;
    u.add(frame);
    const glow = new THREE.Mesh(new THREE.ShapeGeometry(archShape(w, h), 14), glassMat);
    glow.position.z = 0.014;
    u.add(glow);
    // mullions
    const bar = mesh(box(0.055, h - w / 2, 0.05), timberMat, { pos: [0, (h - w / 2) / 2, 0.03] });
    const cros = mesh(box(w, 0.055, 0.05), timberMat, { pos: [0, h * 0.52, 0.03] });
    u.add(bar, cros);
    // sill
    u.add(mesh(box(w + 0.3, 0.09, 0.18), stoneMat, { pos: [0, -0.045, 0.09] }));
    if (withBox) {
      const fb = mesh(box(w + 0.22, 0.2, 0.22), timberLMat, { pos: [0, -0.19, 0.14] });
      u.add(fb);
      const flowerMats = ['#f2a7b6', '#f7e3a1', '#e9b7d8'].map((c, i) =>
        mat(`h-fb${i}`, () => standard(c))
      );
      for (let i = 0; i < 3; i++) {
        u.add(mesh(blobGeometry('fb', 0.16), flowerMats[i], {
          pos: [-w / 2 + 0.12 + i * (w / 2), -0.08, 0.2],
          scale: [0.11, 0.09, 0.11],
        }));
      }
    }
    return u;
  }

  /* front door + big window — recessed into the wall opening (M1.2) */
  const doorZ = D / 2 - 0.08;
  const doorFrame = new THREE.Mesh(new THREE.ShapeGeometry(archShape(1.22, 2.0), 16), timberMat);
  doorFrame.position.set(-0.55, 0.06, doorZ);
  g.add(doorFrame);
  const door = new THREE.Mesh(new THREE.ShapeGeometry(archShape(1.04, 1.86), 16), timberLMat);
  door.position.set(-0.55, 0.13, doorZ + 0.012);
  g.add(door);
  for (let i = -1; i <= 1; i++) {
    g.add(mesh(box(0.035, 1.28, 0.03), timberMat, {
      pos: [-0.55 + i * 0.26, 0.79, doorZ + 0.03],
    }));
  }
  g.add(mesh(geo('knob', () => new THREE.IcosahedronGeometry(0.065, 0)),
    mat('h-brass', () => standard('#e8b95b', { metalness: 0.45, roughness: 0.4 })),
    { pos: [-0.16, 0.95, doorZ + 0.05] }));
  // steps
  g.add(mesh(box(1.5, 0.16, 0.55), stoneMat, { pos: [-0.55, 0.02, D / 2 + 0.32] }));
  g.add(mesh(box(1.8, 0.13, 0.42), stoneMat, { pos: [-0.55, -0.09, D / 2 + 0.62] }));

  const frontWin = windowUnit(0.92, 1.24, true);
  frontWin.position.set(1.15, 1.02, D / 2 - 0.08); // sits inside the wall reveal
  g.add(frontWin);

  /* porch canopy above the door */
  const canopy = new THREE.Group();
  for (const s of [-1, 1]) {
    const plank = mesh(box(0.95, 0.07, 1.15), roofSolid, { pos: [s * 0.38, 0.14, 0] });
    plank.rotation.z = -s * 0.5;
    canopy.add(plank);
  }
  canopy.position.set(-0.55, 2.12, D / 2 + 0.42);
  g.add(canopy);
  for (const s of [-1, 1]) {
    g.add(mesh(box(0.09, 1.0, 0.09), timberMat, {
      pos: [-0.55 + s * 0.82, 1.62, D / 2 + 0.82],
    }));
  }

  /* round window in the front gable — part of the roof group (M1.6),
     flush against the gable wall plane at z = D/2 (M1.3) */
  const gableZ = D / 2 + 0.012;
  const ringGeo = geo('gableRing', () => new THREE.TorusGeometry(0.34, 0.075, 6, 18));
  roofGroup.add(mesh(ringGeo, timberMat, { pos: [0, H + 0.95, gableZ] }));
  roofGroup.add(mesh(geo('gableGlass', () => new THREE.CircleGeometry(0.31, 20)), glassMat, {
    pos: [0, H + 0.95, gableZ + 0.01], cast: false,
  }));
  roofGroup.add(mesh(box(0.05, 0.6, 0.05), timberMat, { pos: [0, H + 0.95, gableZ + 0.03] }));
  roofGroup.add(mesh(box(0.6, 0.05, 0.05), timberMat, { pos: [0, H + 0.95, gableZ + 0.03] }));

  /* side windows — recessed into the side wall reveals (M1.2) */
  for (const sx of [-1, 1]) {
    const w = windowUnit(0.78, 1.08, sx === 1);
    w.position.set(sx * (W / 2 - 0.08), 1.05, sx === 1 ? 0.15 : -0.2);
    w.rotation.y = sx * Math.PI / 2;
    g.add(w);
  }

  /* dormer on the front roof slope */
  const dormer = new THREE.Group();
  dormer.add(mesh(box(0.9, 0.72, 0.62), wallMat, { pos: [0, 0.36, 0] }));
  for (const s of [-1, 1]) {
    const slab = mesh(box(0.68, 0.07, 0.86), roofSolid, { pos: [s * 0.26, 0.78, 0] });
    slab.rotation.z = -s * 0.62;
    dormer.add(slab);
  }
  dormer.add(mesh(box(0.12, 0.06, 0.9), roofDark, { pos: [0, 1.0, 0] }));
  const dw = new THREE.Mesh(new THREE.ShapeGeometry(archShape(0.48, 0.6), 12), glassMat);
  dw.position.set(0, 0.28, 0.32);
  dormer.add(dw);
  const dwf = new THREE.Mesh(new THREE.ShapeGeometry(archShape(0.6, 0.7), 12), timberMat);
  dwf.position.set(0, 0.25, 0.315);
  dormer.add(dwf);
  dormer.position.set(1.28, H + 0.55, halfD * 0.42);
  roofGroup.add(dormer); // roof structure → hides with the roof (M1.6)

  /* stone chimney + smoke */
  const chim = new THREE.Group();
  chim.add(mesh(box(0.66, 1.9, 0.66), stoneMat, { pos: [0, 0.95, 0] }));
  chim.add(mesh(box(0.84, 0.16, 0.84), timberLMat, { pos: [0, 1.94, 0] }));
  chim.add(mesh(box(0.46, 0.1, 0.46), mat('h-soot', () => standard('#3a2b24')), { pos: [0, 2.04, 0] }));
  chim.position.set(-1.25, H + 0.7, -0.75);
  g.add(chim);

  const smokeMat = new THREE.MeshBasicMaterial({
    color: '#fff4e4', transparent: true, opacity: 0.34, depthWrite: false,
  });
  const smoke = [];
  for (let i = 0; i < 5; i++) {
    const puff = mesh(blobGeometry('smoke', 0.2), smokeMat.clone(), {
      pos: [0, 0, 0], cast: false, receive: false,
      scale: [0.26, 0.2, 0.26],
    });
    puff.material.opacity = 0.3;
    chim.add(puff);
    smoke.push({ mesh: puff, phase: i / 5, speed: 0.16 + rng() * 0.05, drift: rng() * 6 });
  }

  /* door lantern */
  const lantern = new THREE.Group();
  lantern.add(mesh(box(0.16, 0.24, 0.16), timberMat, { pos: [0, 0, 0] }));
  lantern.add(mesh(geo('lampGlobe', () => new THREE.IcosahedronGeometry(0.11, 1)), lampMat, {
    pos: [0, -0.17, 0], cast: false,
  }));
  lantern.add(mesh(geo('lampCap', () => new THREE.ConeGeometry(0.17, 0.14, 5)), roofDark, {
    pos: [0, 0.15, 0],
  }));
  lantern.position.set(0.38, 2.16, D / 2 + 0.2);
  g.add(lantern);

  /* warm bounce light near the door */
  const doorLight = new THREE.PointLight('#ffb45e', 0.0, 9, 2);
  doorLight.position.set(0, 1.5, D / 2 + 1.0);
  g.add(doorLight);

  /* smoke animation hook */
  g.userData.update = (t) => {
    for (const s of smoke) {
      const p = (t * s.speed + s.phase) % 1;
      s.mesh.position.set(
        Math.sin(p * 5 + s.drift) * 0.32 * p,
        2.15 + p * 3.1,
        Math.cos(p * 4 + s.drift) * 0.22 * p
      );
      const k = 0.26 + p * 0.85;
      s.mesh.scale.setScalar(k);
      s.mesh.material.opacity = 0.34 * (1 - p) * (0.6 + 0.4 * Math.sin(p * 9));
    }
  };

  g.userData.interactive = 'home';

  return {
    group: g,
    roofGroup,
    windowGlow: glassMat,
    lampGlow: lampMat,
    doorLight,
    front: new THREE.Vector3(0, 0, D / 2),
  };
}
