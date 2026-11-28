import * as THREE from 'three';
import {
  standard, emissive, mesh, mat, geo, box, makeRng, damp, blobGeometry,
} from './utils.js?v=20261128b';

/* ------------------------------------------------------------------ *
 * Home Interior — a separate cozy Three.js scene the camera visits
 * when the cottage is clicked. Japandi-flavored reading room: plank
 * floor, big sea-view window with curtains, reading armchair, desk
 * with the Life Journal, bookshelf, bed, plants, warm lamps.
 *
 * M2 rework:
 *  - The front wall is ONE extruded panel with true door + window
 *    holes (same wallPanel pattern as the exterior shell) instead of
 *    six butted boxes — no more dark gaps beside the door.
 *  - Window / door frames are extruded surrounds sitting in their own
 *    z band (2.55..2.68) with a 0.02 air gap from the wall band
 *    (2.70..2.86). Glass, mullions and the door panel live inside the
 *    hole area only, so no two coplanar faces ever overlap — the
 *    flicker is gone for good.
 *  - The fake painted sea backdrop, silhouette island, sun/moon
 *    sprites and window stars are REMOVED. The window shows the real
 *    island through a render-target texture that main.js refreshes
 *    every frame (world.renderOutside).
 * ------------------------------------------------------------------ */

const FLOOR_BROWNS = ['#a97c50', '#9c7047', '#b28557', '#a1744b'];
const BOOK_COLORS = ['#c0563f', '#5b7ba0', '#d9a35c', '#6f8f5a', '#a46a9d', '#c98a4b', '#8a5f3e', '#4f7d8a'];
const WOOD_DARK = '#7b5137';
const WOOD_MID = '#8a5f3e';
const OAK = '#c9a876';

/* z bands (front wall area) — kept strictly apart, no coplanar faces */
const WALL_Z = 2.70;        // wall panel spans 2.70 .. 2.86
const FRAME_Z = 2.555;      // extruded surrounds span 2.555 .. 2.685
const GLASS_Z = 2.605;      // window glass plane
const PORTAL_Z = 2.645;     // live island-view plane (inside the hole)
const PANEL_Z = 2.585;      // door panel band 2.5625 .. 2.6075

/** Rectangular hole path in shape coordinates (y up from 0). */
function rectHole(x0, y0, x1, y1) {
  const p = new THREE.Path();
  p.moveTo(x0, y0);
  p.lineTo(x0, y1);
  p.lineTo(x1, y1);
  p.lineTo(x1, y0);
  p.closePath();
  return p;
}

/** Extruded wall panel with true openings (same pattern as house.js). */
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

export function buildInterior() {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#18100c');
  const rng = makeRng(774411);

  /* --------------------------- shell ----------------------------- */
  const wallMat = mat('i-wall', () => standard('#efe6d6'));
  const timberMat = mat('i-timber', () => standard(WOOD_DARK));
  const timberMid = mat('i-timberMid', () => standard(WOOD_MID));
  const oakMat = mat('i-oak', () => standard(OAK, { roughness: 0.68 }));
  const creamMat = mat('i-cream', () => standard('#f6ecd8'));
  const brassMat = mat('i-brass', () => standard('#caa05a', { metalness: 0.45, roughness: 0.4 }));
  const potMat = mat('i-pot', () => standard('#b0603c'));
  const leafMat = mat('i-leaf', () => standard('#5f9a4a'));
  const sageMat = mat('i-sage', () => standard('#8a9b7a', { roughness: 0.9 }));
  const terraMat = mat('i-terra', () => standard('#c96f57', { roughness: 0.9 }));

  // plank floor — a dark underlay first, so the plank gaps read as seams
  scene.add(mesh(box(6.8, 0.04, 5.6), mat('i-floorBase', () => standard('#6b4a33')), {
    pos: [0, -0.01, 0], cast: false,
  }));
  const plankMats = FLOOR_BROWNS.map((c, i) => mat(`i-plank${i}`, () => standard(c, { roughness: 0.72 })));
  for (let zi = 0; zi < 12; zi++) {
    const z = -2.62 + zi * 0.475;
    const off = (zi % 2) * 0.75 + rng() * 0.3;
    for (let x = -3.4 + off; x < 3.3; x += 1.55) {
      scene.add(mesh(box(1.5, 0.06, 0.44), plankMats[Math.floor(rng() * 4)], {
        pos: [x, 0.03, z], cast: false,
      }));
    }
  }

  // back + side walls: solid boxes, interior faces flush with the room
  scene.add(mesh(box(6.4, 2.8, 0.16), wallMat, { pos: [0, 1.4, -2.78] }));
  scene.add(mesh(box(0.16, 2.8, 5.4), wallMat, { pos: [3.28, 1.4, 0] }));
  scene.add(mesh(box(0.16, 2.8, 5.4), wallMat, { pos: [-3.28, 1.4, 0] }));

  // front wall: ONE extruded panel with the real door + window holes
  // (door x -2.9..-1.9 y 0..2.1 · window x -1.15..1.05 y 0.85..2.2)
  scene.add(mesh(
    wallPanel(6.4, 2.8, 0.16, [rectHole(-2.9, 0, -1.9, 2.1), rectHole(-1.15, 0.85, 1.05, 2.2)]),
    wallMat, { pos: [0, 0, WALL_Z] }
  ));

  // ceiling + beams (bottom 2.81 stays clear of the wall tops at 2.8)
  scene.add(mesh(box(6.4, 0.12, 5.4), mat('i-ceil', () => standard('#e6d3b2')), { pos: [0, 2.87, 0], cast: false }));
  for (const z of [-0.9, 0.9]) {
    scene.add(mesh(box(6.4, 0.14, 0.22), timberMat, { pos: [0, 2.72, z] }));
  }
  // wainscot on back + side walls only (the front wall is dressed by
  // curtains, desk and door furniture — strips there would fight the
  // frame / door z bands)
  scene.add(mesh(box(6.4, 0.42, 0.05), timberMid, { pos: [0, 0.28, -2.672], cast: false }));
  scene.add(mesh(box(0.05, 0.42, 5.4), timberMid, { pos: [3.2, 0.28, 0], cast: false }));
  scene.add(mesh(box(0.05, 0.42, 5.4), timberMid, { pos: [-3.2, 0.28, 0], cast: false }));

  /* -------------------- window (real frame) ----------------------- */
  const windowGroup = new THREE.Group();
  windowGroup.name = 'window';
  // extruded surround in its own z band — never touches the wall band
  windowGroup.add(mesh(
    wallPanel(2.52, 1.5, 0.13, [rectHole(-1.1, 0.075, 1.1, 1.425)]),
    timberMat, { pos: [-0.05, 0.775, FRAME_Z], cast: false }
  ));
  // mullions (inside the hole, in front of the glass plane)
  windowGroup.add(mesh(box(0.05, 1.35, 0.05), timberMid, { pos: [-0.05, 1.525, 2.578], cast: false }));
  windowGroup.add(mesh(box(2.2, 0.05, 0.05), timberMid, { pos: [-0.05, 1.52, 2.578], cast: false }));
  // glass
  const glassMat = new THREE.MeshStandardMaterial({
    color: '#cfe6ee', transparent: true, opacity: 0.12, roughness: 0.15,
    side: THREE.DoubleSide, depthWrite: false,
  });
  windowGroup.add(mesh(new THREE.PlaneGeometry(2.2, 1.35), glassMat, {
    pos: [-0.05, 1.525, GLASS_Z], cast: false, receive: false,
  }));
  // stone sill just below the surround
  windowGroup.add(mesh(box(2.6, 0.09, 0.16), mat('i-sill', () => standard('#9d8e79')), {
    pos: [-0.05, 0.72, 2.58], cast: false,
  }));
  windowGroup.userData.interactive = 'window';
  scene.add(windowGroup);

  /* ------------- live island view through the window -------------- */
  // main.js refreshes this texture every frame from the real island
  // scene (world.renderOutside). Flat image = simple + robust.
  // DoubleSide: the plane faces +z (outwards), the camera views it from
  // the -z room side — a single-sided material would be culled and show
  // only the dark scene.background (the "black window" bug).
  const portalMat = new THREE.MeshBasicMaterial({
    color: '#7fb2d0', side: THREE.DoubleSide,
  });
  const portalPlane = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 1.35), portalMat);
  portalPlane.position.set(-0.05, 1.525, PORTAL_Z);
  scene.add(portalPlane);

  /** Swap in the render-target texture once world.js is ready. */
  function setOutsideTexture(tex) {
    if (tex) portalMat.map = tex;
    portalMat.color.set('#ffffff');
    portalMat.needsUpdate = true;
  }

  // curtains (clear of the frame surround on both sides)
  const curtainMat = mat('i-curtain', () => standard('#d9a05e', { roughness: 0.95 }));
  scene.add(mesh(box(0.36, 1.6, 0.1), curtainMat, { pos: [-1.5, 1.5, 2.6] }));
  scene.add(mesh(box(0.36, 1.6, 0.1), curtainMat, { pos: [1.4, 1.5, 2.6] }));
  scene.add(mesh(geo('i-rod', () => new THREE.CylinderGeometry(0.025, 0.025, 3.3, 6)),
    timberMat, { pos: [-0.05, 2.38, 2.55], rot: [0, 0, Math.PI / 2] }));
  scene.add(mesh(geo('i-rodEnd', () => new THREE.SphereGeometry(0.05, 6, 5)), timberMat, { pos: [-1.72, 2.38, 2.55] }));
  scene.add(mesh(geo('i-rodEnd2', () => new THREE.SphereGeometry(0.05, 6, 5)), timberMat, { pos: [1.62, 2.38, 2.55] }));

  /* ----------------------------- door ----------------------------- */
  const doorGroup = new THREE.Group();
  doorGroup.name = 'door';
  // extruded surround around the door hole, own z band
  doorGroup.add(mesh(
    wallPanel(1.24, 2.24, 0.13, [rectHole(-0.5, 0, 0.5, 2.1)]),
    timberMat, { pos: [-2.4, 0, FRAME_Z], cast: false }
  ));
  // panel floats inside the hole with a visible hinge gap on each side
  doorGroup.add(mesh(box(0.94, 2.04, 0.045), mat('i-door', () => standard('#6d4a30')), {
    pos: [-2.4, 1.02, PANEL_Z],
  }));
  // inset panels on the door face
  for (const y of [0.6, 1.45]) {
    doorGroup.add(mesh(box(0.6, 0.62, 0.02), mat('i-doorInset', () => standard('#5d3f28')), {
      pos: [-2.4, y, 2.54],
    }));
  }
  doorGroup.add(mesh(geo('i-knob', () => new THREE.IcosahedronGeometry(0.05, 0)),
    brassMat, { pos: [-2.72, 1.0, 2.548] }));
  doorGroup.userData.interactive = 'door';
  scene.add(doorGroup);

  /* --------------------------- bed -------------------------------- */
  const bed = new THREE.Group();
  const bedMat = mat('i-bed', () => standard('#7b5137'));
  for (const [x, z] of [[-0.45, -0.85], [0.45, -0.85], [-0.45, 0.85], [0.45, 0.85]]) {
    bed.add(mesh(box(0.09, 0.3, 0.09), bedMat, { pos: [x, 0.15, z] }));
  }
  bed.add(mesh(box(1.0, 0.14, 1.9), bedMat, { pos: [0, 0.36, 0] }));
  // slatted headboard
  bed.add(mesh(box(1.0, 0.72, 0.07), bedMat, { pos: [0, 0.62, -0.93] }));
  for (const x of [-0.3, 0, 0.3]) {
    bed.add(mesh(box(0.16, 0.58, 0.02), oakMat, { pos: [x, 0.64, -0.885], cast: false }));
  }
  bed.add(mesh(box(0.94, 0.18, 1.78), creamMat, { pos: [0, 0.52, 0] }));
  bed.add(mesh(blobGeometry('i-pillow', 0.1), mat('i-pillow', () => standard('#fbf3e0')), {
    pos: [0, 0.66, -0.62], scale: [0.34, 0.14, 0.22],
  }));
  bed.add(mesh(blobGeometry('i-pillow2', 0.08), sageMat, {
    pos: [-0.2, 0.74, -0.5], scale: [0.2, 0.1, 0.14],
  }));
  bed.add(mesh(box(0.98, 0.09, 1.05), terraMat, { pos: [0, 0.6, 0.38] }));
  bed.add(mesh(box(0.98, 0.05, 0.18), mat('i-blanketFold', () => standard('#b85a44')), { pos: [0, 0.65, -0.12] }));
  bed.position.set(1.85, 0, -1.3);
  bed.rotation.y = -0.1;
  scene.add(bed);

  // floating shelf above the headboard
  const shelfTop = new THREE.Group();
  shelfTop.add(mesh(box(1.1, 0.05, 0.24), oakMat, { pos: [0, 0, 0] }));
  shelfTop.add(mesh(geo('i-shelfPot', () => new THREE.CylinderGeometry(0.06, 0.08, 0.11, 7)),
    potMat, { pos: [-0.36, 0.08, 0] }));
  shelfTop.add(mesh(blobGeometry('i-shelfPlant', 0.12), leafMat, {
    pos: [-0.36, 0.2, 0], scale: [0.1, 0.09, 0.1],
  }));
  for (let i = 0; i < 3; i++) {
    shelfTop.add(mesh(box(0.05, 0.16 + rng() * 0.05, 0.14),
      mat(`i-shelfBook${i}`, () => standard(BOOK_COLORS[i * 2])), {
      pos: [0.1 + i * 0.08, 0.11, 0.02],
    }));
  }
  shelfTop.position.set(1.85, 1.55, -2.52);
  scene.add(shelfTop);

  /* ------------------------- side table --------------------------- */
  const side = new THREE.Group();
  side.add(mesh(box(0.5, 0.05, 0.5), timberMid, { pos: [0, 0.5, 0] }));
  for (const [x, z] of [[-0.2, -0.2], [0.2, -0.2], [-0.2, 0.2], [0.2, 0.2]]) {
    side.add(mesh(box(0.05, 0.5, 0.05), timberMid, { pos: [x, 0.25, z] }));
  }
  side.add(mesh(box(0.12, 0.14, 0.12), timberMat, { pos: [0, 0.6, 0] }));
  const sideGlass = emissive('#ffcf8a', 0.6);
  side.add(mesh(geo('i-sideGlobe', () => new THREE.IcosahedronGeometry(0.09, 1)), sideGlass, {
    pos: [0, 0.74, 0], cast: false,
  }));
  side.add(mesh(geo('i-sideCap', () => new THREE.ConeGeometry(0.13, 0.12, 5)), mat('i-sideCapM', () => standard('#5d3f2a')), {
    pos: [0, 0.85, 0],
  }));
  const sideLight = new THREE.PointLight('#ffc477', 0.4, 3.2, 2);
  sideLight.position.set(0, 0.78, 0);
  side.add(sideLight);
  side.position.set(0.72, 0, -2.28);
  scene.add(side);

  /* ------------------------- bookshelf ---------------------------- */
  const shelf = new THREE.Group();
  shelf.add(mesh(box(0.06, 1.85, 0.3), timberMat, { pos: [-0.62, 0.925, 0] }));
  shelf.add(mesh(box(0.06, 1.85, 0.3), timberMat, { pos: [0.62, 0.925, 0] }));
  shelf.add(mesh(box(1.3, 1.85, 0.04), timberMid, { pos: [0, 0.925, -0.14] }));
  shelf.add(mesh(box(1.34, 0.06, 0.32), timberMat, { pos: [0, 1.88, 0] }));
  shelf.add(mesh(box(1.34, 0.06, 0.32), timberMat, { pos: [0, 0.06, 0] }));
  for (const sy of [0.52, 1.02, 1.52]) {
    shelf.add(mesh(box(1.22, 0.045, 0.28), timberMid, { pos: [0, sy, 0] }));
    let x = -0.56;
    while (x < 0.5) {
      const w = 0.09 + rng() * 0.07;
      if (rng() > 0.14) {
        const h = 0.26 + rng() * 0.16;
        const b = mesh(box(w, h, 0.2),
          mat(`i-book${Math.floor(rng() * 99)}`, () => standard(BOOK_COLORS[Math.floor(rng() * BOOK_COLORS.length)])),
          { pos: [x + w / 2, sy + 0.022 + h / 2, 0.01] });
        if (rng() > 0.88) b.rotation.z = 0.16;
        shelf.add(b);
      }
      x += w + 0.012;
    }
  }
  // plant on top + a stack of laid-down books
  shelf.add(mesh(geo('i-potTop', () => new THREE.CylinderGeometry(0.09, 0.11, 0.16, 7)),
    potMat, { pos: [-0.3, 2.0, 0] }));
  shelf.add(mesh(blobGeometry('i-plantTop', 0.18), leafMat, {
    pos: [-0.3, 2.18, 0], scale: [0.16, 0.14, 0.16],
  }));
  for (let i = 0; i < 3; i++) {
    shelf.add(mesh(box(0.24, 0.045, 0.17),
      mat(`i-layBook${i}`, () => standard(BOOK_COLORS[(i * 3) % BOOK_COLORS.length])), {
      pos: [0.34, 1.575 + i * 0.048, 0], cast: false,
    }));
  }
  shelf.position.set(3.06, 0, -0.35);
  // -90deg keeps the book spines facing INTO the room (-x); the old
  // +90deg showed the plain back panel to the camera.
  shelf.rotation.y = -Math.PI / 2;
  scene.add(shelf);

  /* ----------------------- desk + chair --------------------------- */
  const desk = new THREE.Group();
  desk.add(mesh(box(1.35, 0.06, 0.68), mat('i-deskTop', () => standard('#a2714a', { roughness: 0.7 })), { pos: [0, 0.76, 0] }));
  for (const [x, z] of [[-0.62, -0.28], [0.62, -0.28], [-0.62, 0.28], [0.62, 0.28]]) {
    desk.add(mesh(box(0.06, 0.73, 0.06), timberMid, { pos: [x, 0.365, z] }));
  }
  // open journal on the desk (interactive)
  const bookGroup = new THREE.Group();
  bookGroup.name = 'book';
  bookGroup.userData.interactive = 'book';
  bookGroup.add(mesh(box(0.56, 0.015, 0.4), mat('i-bookCover', () => standard('#a34b32')), { pos: [0, 0.0, 0] }));
  const pageMat = mat('i-page', () => standard('#f3e6cc', { roughness: 0.9 }));
  const pL = mesh(box(0.26, 0.03, 0.36), pageMat, { pos: [-0.135, 0.026, 0] });
  pL.rotation.z = 0.1;
  const pR = mesh(box(0.26, 0.03, 0.36), pageMat, { pos: [0.135, 0.026, 0] });
  pR.rotation.z = -0.1;
  bookGroup.add(pL, pR);
  const pen = mesh(geo('i-pen', () => new THREE.CylinderGeometry(0.015, 0.015, 0.2, 5)),
    mat('i-penM', () => standard('#d9a35c', { metalness: 0.3, roughness: 0.4 })), {
      pos: [0.3, 0.03, 0.16], rot: [0, 0.4, Math.PI / 2],
    });
  bookGroup.add(pen);
  bookGroup.position.set(-0.14, 0.795, 0.04);
  desk.add(bookGroup);
  // ink pot + a mug
  desk.add(mesh(geo('i-ink', () => new THREE.CylinderGeometry(0.05, 0.06, 0.09, 7)),
    mat('i-inkM', () => standard('#4a5a70')), { pos: [0.3, 0.835, -0.2] }));
  desk.add(mesh(geo('i-mug', () => new THREE.CylinderGeometry(0.05, 0.045, 0.1, 8)),
    mat('i-mugM', () => standard('#e8dcc8')), { pos: [-0.5, 0.84, -0.18] }));
  // desk lamp (interactive)
  const lampGroup = new THREE.Group();
  lampGroup.name = 'lamp';
  lampGroup.userData.interactive = 'lamp';
  lampGroup.add(mesh(geo('i-lampBase', () => new THREE.CylinderGeometry(0.085, 0.1, 0.05, 8)),
    brassMat, { pos: [0, 0.025, 0] }));
  const stem = mesh(geo('i-lampStem', () => new THREE.CylinderGeometry(0.02, 0.02, 0.44, 6)), brassMat, {
    pos: [-0.05, 0.24, 0], rot: [0, 0, -0.3],
  });
  lampGroup.add(stem);
  const shadeMat = emissive('#ffca7a', 0.95);
  const shadeM = mesh(geo('i-lampShade', () => new THREE.ConeGeometry(0.14, 0.2, 9, 1, true)), shadeMat, {
    pos: [-0.13, 0.46, 0], rot: [0, 0, 0.32],
  });
  shadeM.material.side = THREE.DoubleSide;
  lampGroup.add(shadeM);
  const lampLight = new THREE.PointLight('#ffd9a0', 1.15, 4.5, 2);
  lampLight.position.set(-0.15, 0.4, 0);
  lampGroup.add(lampLight);
  lampGroup.position.set(0.45, 0.79, -0.1);
  desk.add(lampGroup);
  desk.position.set(-0.5, 0, 2.02);
  scene.add(desk);

  const chair = new THREE.Group();
  chair.add(mesh(box(0.44, 0.05, 0.44), timberMid, { pos: [0, 0.47, 0] }));
  chair.add(mesh(box(0.44, 0.52, 0.05), timberMid, { pos: [0, 0.76, -0.2] }));
  for (const [x, z] of [[-0.18, -0.18], [0.18, -0.18], [-0.18, 0.18], [0.18, 0.18]]) {
    chair.add(mesh(box(0.05, 0.45, 0.05), timberMid, { pos: [x, 0.225, z] }));
  }
  chair.position.set(-0.5, 0, 1.28);
  chair.rotation.y = 0.08;
  scene.add(chair);

  /* -------------------- reading armchair -------------------------- */
  const chair2 = new THREE.Group();
  const c2Wood = mat('i-armWood', () => standard('#8a6a48', { roughness: 0.7 }));
  // base + legs
  chair2.add(mesh(box(0.78, 0.32, 0.72), c2Wood, { pos: [0, 0.3, 0] }));
  for (const [x, z] of [[-0.32, -0.28], [0.32, -0.28], [-0.32, 0.28], [0.32, 0.28]]) {
    chair2.add(mesh(geo('i-armLeg', () => new THREE.CylinderGeometry(0.035, 0.045, 0.16, 6)), c2Wood, {
      pos: [x, 0.08, z],
    }));
  }
  // cushions
  chair2.add(mesh(box(0.7, 0.14, 0.62), creamMat, { pos: [0, 0.53, 0.03] }));
  chair2.add(mesh(box(0.7, 0.52, 0.16), sageMat, { pos: [0, 0.86, -0.26] }));
  chair2.add(mesh(blobGeometry('i-armBack', 0.09), sageMat, {
    pos: [0, 1.16, -0.26], scale: [0.32, 0.16, 0.12],
  }));
  // armrests
  chair2.add(mesh(box(0.14, 0.1, 0.6), c2Wood, { pos: [-0.36, 0.62, 0.02] }));
  chair2.add(mesh(box(0.14, 0.1, 0.6), c2Wood, { pos: [0.36, 0.62, 0.02] }));
  // throw blanket over one arm
  chair2.add(mesh(box(0.2, 0.05, 0.58), terraMat, { pos: [0.36, 0.7, 0.02] }));
  chair2.add(mesh(box(0.22, 0.16, 0.1), terraMat, { pos: [0.36, 0.6, 0.28] }));
  chair2.position.set(1.95, 0, 1.75);
  chair2.rotation.y = -0.55;
  scene.add(chair2);

  /* ------------------------ floor lamp ---------------------------- */
  const floorLamp = new THREE.Group();
  floorLamp.add(mesh(geo('i-flBase', () => new THREE.CylinderGeometry(0.14, 0.16, 0.05, 8)),
    timberMat, { pos: [0, 0.025, 0] }));
  floorLamp.add(mesh(geo('i-flPole', () => new THREE.CylinderGeometry(0.022, 0.022, 1.35, 6)),
    brassMat, { pos: [0, 0.7, 0] }));
  const flShadeMat = emissive('#ffe3ae', 0.5);
  floorLamp.add(mesh(geo('i-flShade', () => new THREE.CylinderGeometry(0.16, 0.2, 0.26, 10, 1, true)),
    flShadeMat, { pos: [0, 1.48, 0], cast: false }));
  const flLight = new THREE.PointLight('#ffd9a0', 0.5, 4, 2);
  flLight.position.set(0, 1.44, 0);
  floorLamp.add(flLight);
  floorLamp.position.set(2.62, 0, 0.9);
  scene.add(floorLamp);

  /* ---------------------- pendant light --------------------------- */
  const pendant = new THREE.Group();
  pendant.add(mesh(geo('i-pCord', () => new THREE.CylinderGeometry(0.012, 0.012, 0.5, 5)),
    timberMat, { pos: [0, 2.56, 0], cast: false }));
  const pShadeMat = emissive('#ffdc9e', 0.7);
  pendant.add(mesh(geo('i-pShade', () => new THREE.ConeGeometry(0.2, 0.18, 10, 1, true)), pShadeMat, {
    pos: [0, 2.22, 0], cast: false,
  }));
  pendant.add(mesh(geo('i-pBulb', () => new THREE.SphereGeometry(0.045, 6, 5)), emissive('#fff0c8', 1.2), {
    pos: [0, 2.14, 0], cast: false,
  }));
  const pendantLight = new THREE.PointLight('#ffd9a4', 0.55, 5.5, 2);
  pendantLight.position.set(0, 2.1, 0);
  pendant.add(pendantLight);
  pendant.position.set(0.1, 0, 0.15);
  scene.add(pendant);

  /* ------------------------ wall pictures ------------------------- */
  const pic = new THREE.Group();
  pic.add(mesh(box(0.92, 0.68, 0.05), oakMat, { pos: [0, 0, 0], cast: false }));
  const flat = (w, h, color, x, y, z) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h),
      new THREE.MeshBasicMaterial({ color }));
    m.position.set(x, y, z);
    pic.add(m);
  };
  flat(0.78, 0.54, '#f6ecd8', 0, 0, 0.03);
  flat(0.78, 0.27, '#7fb6d0', 0, -0.12, 0.036);
  flat(0.3, 0.12, '#6ea24f', -0.08, 0.02, 0.042);
  flat(0.14, 0.14, '#f6c96b', 0.2, 0.17, 0.042);
  pic.position.set(-1.25, 1.72, -2.665);
  scene.add(pic);

  const pic2 = new THREE.Group();
  pic2.add(mesh(box(0.5, 0.64, 0.05), timberMid, { pos: [0, 0, 0], cast: false }));
  flat2(pic2, 0.4, 0.54, '#e9e2d0', 0, 0, 0.03);
  flat2(pic2, 0.12, 0.4, '#c96f57', -0.08, -0.02, 0.036);
  flat2(pic2, 0.1, 0.26, '#4f7d8a', 0.08, 0.06, 0.036);
  pic2.position.set(-2.25, 1.7, -2.665);
  scene.add(pic2);

  function flat2(parent, w, h, color, x, y, z) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h),
      new THREE.MeshBasicMaterial({ color }));
    m.position.set(x, y, z);
    parent.add(m);
  }

  /* ----------------------- potted plant --------------------------- */
  const plant = new THREE.Group();
  plant.add(mesh(geo('i-pot2', () => new THREE.CylinderGeometry(0.16, 0.19, 0.26, 8)),
    potMat, { pos: [0, 0.13, 0] }));
  plant.add(mesh(geo('i-stem', () => new THREE.CylinderGeometry(0.02, 0.03, 0.34, 5)),
    mat('i-stemM', () => standard('#5d7a44')), { pos: [0, 0.4, 0] }));
  for (const [x, y, z, s] of [[0, 0.62, 0, 0.2], [0.14, 0.48, 0.06, 0.13], [-0.13, 0.5, -0.05, 0.14], [0.05, 0.44, -0.12, 0.1]]) {
    plant.add(mesh(blobGeometry('i-plant', 0.2), leafMat, {
      pos: [x, y, z], scale: [s, s * 0.85, s],
    }));
  }
  plant.position.set(-2.68, 0, -2.15);
  scene.add(plant);

  // floor cushion by the side wall
  scene.add(mesh(blobGeometry('i-cushion', 0.16), mat('i-cushionM', () => standard('#d9a35c', { roughness: 1 })), {
    pos: [-2.55, 0.1, 0.7], scale: [0.4, 0.13, 0.4],
  }));

  /* --------------------------- rug -------------------------------- */
  const rugMats = ['#a54e3c', '#cf8a5f', '#e8b98a'].map((c, i) =>
    mat(`i-rug${i}`, () => standard(c, { roughness: 1 })));
  [[1.3, 0.028], [0.98, 0.042], [0.62, 0.056]].forEach(([r, y], i) => {
    scene.add(mesh(geo(`i-rug${i}`, () => new THREE.CylinderGeometry(r, r, 0.02, 22)), rugMats[i], {
      pos: [0.1, y, 0.15], cast: false,
    }));
  });

  /* --------------------------- lights ----------------------------- */
  const ambientLight = new THREE.AmbientLight('#ffe2c2', 0.52);
  const hemiLight = new THREE.HemisphereLight('#ffe9cf', '#5a4636', 0.4);
  scene.add(ambientLight, hemiLight);
  const mainLight = new THREE.SpotLight('#ffd9a4', 1.7, 12, 1.3, 0.55, 1.2);
  mainLight.position.set(0, 2.58, 0.3);
  mainLight.target.position.set(0, 0, 0.3);
  mainLight.castShadow = true;
  mainLight.shadow.mapSize.set(1024, 1024);
  mainLight.shadow.camera.near = 0.6;
  mainLight.shadow.camera.far = 9;
  mainLight.shadow.bias = -0.0015;
  scene.add(mainLight, mainLight.target);
  const windowDir = new THREE.DirectionalLight('#bcd6e8', 0.55);
  windowDir.position.set(0.5, 3.2, 6);
  windowDir.target.position.set(0, 1, 0);
  scene.add(windowDir, windowDir.target);

  /* ------------------------- lamp state --------------------------- */
  let lampOn = true;
  function setLamp(v) {
    lampOn = v;
    lampLight.intensity = v ? 1.15 : 0;
    shadeMat.emissiveIntensity = v ? 0.95 : 0.12;
    // V2: switching the lamp off should visibly dim the room, not brighten it
    mainLight.intensity = v ? 1.7 : 0.62;
    ambientLight.intensity = v ? 0.52 : 0.2;
    hemiLight.intensity = v ? 0.4 : 0.16;
    sideLight.intensity = v ? 0.4 : 0.14;
    sideGlass.emissiveIntensity = v ? 0.6 : 0.1;
    flLight.intensity = v ? 0.5 : 0.16;
    flShadeMat.emissiveIntensity = v ? 0.5 : 0.14;
    pendantLight.intensity = v ? 0.55 : 0.18;
    pShadeMat.emissiveIntensity = v ? 0.7 : 0.2;
    windowDir.intensity = v ? 0.55 : 0.32;
  }

  /* ------------------------- night state -------------------------- */
  let nightTarget = 0;
  let nightK = 0;

  /* -------------------------- interactives ------------------------ */
  for (const g of [bookGroup, windowGroup, lampGroup, doorGroup]) {
    g.userData.hoverK = 0;
    g.userData.hoverT = 0;
  }

  const BOOK_FOCUS = {
    pos: new THREE.Vector3(-0.5, 1.35, 0.85),
    target: new THREE.Vector3(-0.62, 0.85, 2.02),
  };
  const WINDOW_FOCUS = {
    pos: new THREE.Vector3(-0.25, 1.5, 0.85),
    target: new THREE.Vector3(-0.05, 1.45, 2.7),
  };

  function update(t, dt) {
    nightK = damp(nightK, nightTarget, 2.2, dt);
    windowDir.intensity = (lampOn ? 0.55 : 0.32) - nightK * 0.38;
    // hover feedback on interactives
    for (const g of [bookGroup, windowGroup, lampGroup, doorGroup]) {
      g.userData.hoverK = damp(g.userData.hoverK, g.userData.hoverT, 10, dt);
    }
    bookGroup.position.y = 0.795 + bookGroup.userData.hoverK * 0.045;
    shadeMat.emissiveIntensity = (lampOn ? 0.95 : 0.12)
      + lampGroup.userData.hoverK * (lampOn ? 0.3 : 0.5);
  }

  return {
    scene,
    interactives: [bookGroup, windowGroup, lampGroup, doorGroup],
    update, setLamp, setOutsideTexture,
    toggleLamp: () => { setLamp(!lampOn); return lampOn; },
    isLampOn: () => lampOn,
    setNightTarget: (v) => { nightTarget = v; },
    CAM_POS: new THREE.Vector3(-0.7, 1.72, -2.15),
    TARGET: new THREE.Vector3(0.5, 1.05, 0.9),
    // Hard interior bounds for the camera (world.setCamBounds): the
    // camera can never be pushed through a wall or the ceiling.
    CAM_BOUNDS: {
      min: new THREE.Vector3(-3.02, 0.3, -2.52),
      max: new THREE.Vector3(3.02, 2.72, 2.52),
    },
    BOOK_FOCUS, WINDOW_FOCUS,
  };
}
