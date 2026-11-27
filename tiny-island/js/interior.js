import * as THREE from 'three';
import {
  standard, emissive, mesh, mat, geo, box, makeRng, damp, glowTexture, blobGeometry,
} from './utils.js';

/* ------------------------------------------------------------------ *
 * Home Interior — a separate cozy Three.js scene the camera visits
 * when the cottage is clicked. Wood floor, big sea-view window, bed,
 * diary desk, bookshelf, lamps. Everything procedural, no assets.
 * Interactives: book (journal), window (sea view), lamp (light), door.
 * ------------------------------------------------------------------ */

const FLOOR_BROWNS = ['#a97c50', '#9c7047', '#b28557', '#a1744b'];
const BOOK_COLORS = ['#c0563f', '#5b7ba0', '#d9a35c', '#6f8f5a', '#a46a9d', '#c98a4b', '#8a5f3e', '#4f7d8a'];
const WOOD_DARK = '#7b5137';
const WOOD_MID = '#8a5f3e';

const BACKDROP_VERT = `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;
const BACKDROP_FRAG = `
  uniform vec3 uTop;
  uniform vec3 uHorizon;
  uniform vec3 uSea;
  uniform float uTime;
  uniform float uNight;
  varying vec2 vUv;
  void main() {
    vec3 top = mix(uTop, vec3(0.045, 0.10, 0.21), uNight);
    vec3 hor = mix(uHorizon, vec3(0.17, 0.25, 0.40), uNight);
    vec3 sea = mix(uSea, vec3(0.05, 0.14, 0.25), uNight);
    float y = vUv.y;
    // tighter gradient so the window view reaches saturated sky + sea
    vec3 sky = mix(hor, top, smoothstep(0.50, 0.70, y));
    vec3 water = mix(hor, sea, smoothstep(0.50, 0.30, y));
    vec3 c = mix(water, sky, smoothstep(0.494, 0.506, y));
    // crisp sunlit horizon line
    c += hor * exp(-pow((y - 0.5) * 42.0, 2.0)) * 0.30;
    // slow wave glints on the water
    float w = sin(y * 90.0 + uTime * 1.1) * sin(y * 27.0 - uTime * 0.7);
    c += vec3(0.10, 0.14, 0.15) * smoothstep(0.55, 0.95, w) * (0.5 - y) * 2.0 * step(y, 0.5);
    gl_FragColor = vec4(c, 1.0);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

export function buildInterior() {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#18100c');
  const rng = makeRng(774411);

  /* --------------------------- shell ----------------------------- */
  const wallMat = mat('i-wall', () => standard('#f2e3cb'));
  const timberMat = mat('i-timber', () => standard(WOOD_DARK));
  const timberMid = mat('i-timberMid', () => standard(WOOD_MID));
  const creamMat = mat('i-cream', () => standard('#f6ecd8'));
  const brassMat = mat('i-brass', () => standard('#caa05a', { metalness: 0.45, roughness: 0.4 }));
  const potMat = mat('i-pot', () => standard('#b0603c'));
  const leafMat = mat('i-leaf', () => standard('#5f9a4a'));

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

  // walls (M1.2: the front wall now carries both the door and the
  // window, matching the cottage's front facade; the left wall used to
  // have a door cut-out that left a ~0.97-wide hole — it is solid again)
  scene.add(mesh(box(6.4, 2.8, 0.16), wallMat, { pos: [0, 1.4, -2.78] }));
  scene.add(mesh(box(0.16, 2.8, 5.4), wallMat, { pos: [3.28, 1.4, 0] }));
  scene.add(mesh(box(0.16, 2.8, 5.4), wallMat, { pos: [-3.28, 1.4, 0] }));
  // front wall around the door opening (x -2.9..-1.9, h 2.1)…
  scene.add(mesh(box(0.3, 2.8, 0.16), wallMat, { pos: [-3.05, 1.4, 2.78] }));
  scene.add(mesh(box(1.0, 0.7, 0.16), wallMat, { pos: [-2.4, 2.45, 2.78] }));
  scene.add(mesh(box(0.75, 2.8, 0.16), wallMat, { pos: [-1.525, 1.4, 2.78] }));
  // …and the window opening (x -1.15..1.05, y 0.85..2.2)
  scene.add(mesh(box(2.15, 2.8, 0.16), wallMat, { pos: [2.125, 1.4, 2.78] }));
  scene.add(mesh(box(2.2, 0.85, 0.16), wallMat, { pos: [-0.05, 0.425, 2.78] }));
  scene.add(mesh(box(2.2, 0.6, 0.16), wallMat, { pos: [-0.05, 2.5, 2.78] }));
  // ceiling + beams (M1.5: nudged 0.01 up so the ceiling bottom no
  // longer sits exactly coplanar with the wall tops at y=2.8 — that
  // seam was a Z-fighting flicker candidate)
  scene.add(mesh(box(6.4, 0.12, 5.4), mat('i-ceil', () => standard('#e6d3b2')), { pos: [0, 2.87, 0], cast: false }));
  for (const z of [-0.9, 0.9]) {
    scene.add(mesh(box(6.4, 0.14, 0.22), timberMat, { pos: [0, 2.72, z] }));
  }
  // wainscot strips (follow the new wall segmentation)
  scene.add(mesh(box(6.4, 0.42, 0.05), timberMid, { pos: [0, 0.28, -2.67], cast: false }));
  scene.add(mesh(box(0.05, 0.42, 5.4), timberMid, { pos: [3.2, 0.28, 0], cast: false }));
  scene.add(mesh(box(0.05, 0.42, 5.4), timberMid, { pos: [-3.2, 0.28, 0], cast: false }));
  scene.add(mesh(box(0.22, 0.42, 0.05), timberMid, { pos: [-3.03, 0.28, 2.67], cast: false }));
  scene.add(mesh(box(0.7, 0.42, 0.05), timberMid, { pos: [-1.55, 0.28, 2.67], cast: false }));
  scene.add(mesh(box(2.1, 0.42, 0.05), timberMid, { pos: [2.12, 0.28, 2.67], cast: false }));

  /* ---------------------- window + sea view ----------------------- */
  const windowGroup = new THREE.Group();
  windowGroup.name = 'window';
  const glassMat = new THREE.MeshStandardMaterial({
    color: '#cfe6ee', transparent: true, opacity: 0.13, roughness: 0.15,
    side: THREE.DoubleSide, depthWrite: false,
  });
  windowGroup.add(mesh(new THREE.PlaneGeometry(2.2, 1.35), glassMat, {
    pos: [-0.05, 1.525, 2.74], cast: false, receive: false,
  }));
  const frame = (w, h, d, x, y, z) => windowGroup.add(mesh(box(w, h, d), timberMat, { pos: [x, y, z] }));
  frame(2.5, 0.1, 0.3, -0.05, 0.82, 2.72);
  frame(2.44, 0.12, 0.2, -0.05, 2.26, 2.72);
  frame(0.12, 1.42, 0.2, -1.21, 1.53, 2.72);
  frame(0.12, 1.42, 0.2, 1.11, 1.53, 2.72);
  frame(0.06, 1.35, 0.06, -0.05, 1.525, 2.70);
  frame(2.2, 0.06, 0.06, -0.05, 1.52, 2.70);
  windowGroup.userData.interactive = 'window';
  scene.add(windowGroup);

  // curtains (left panel nudged onto the wall strip beside the window,
  // clear of the new door opening at x -2.9..-1.9)
  const curtainMat = mat('i-curtain', () => standard('#d9a05e'));
  scene.add(mesh(box(0.34, 1.55, 0.12), curtainMat, { pos: [-1.36, 1.42, 2.6] }));
  scene.add(mesh(box(0.34, 1.55, 0.12), curtainMat, { pos: [1.35, 1.42, 2.6] }));
  scene.add(mesh(box(3.1, 0.16, 0.14), curtainMat, { pos: [-0.15, 2.36, 2.62] }));

  // sea backdrop outside the window
  const backdropUniforms = {
    uTop: { value: new THREE.Color('#4a93cf') },
    uHorizon: { value: new THREE.Color('#cfe8ee') },
    uSea: { value: new THREE.Color('#2b86a3') },
    uTime: { value: 0 },
    uNight: { value: 0 },
  };
  const backdrop = new THREE.Mesh(
    new THREE.PlaneGeometry(14, 8),
    new THREE.ShaderMaterial({
      uniforms: backdropUniforms, vertexShader: BACKDROP_VERT,
      fragmentShader: BACKDROP_FRAG, fog: false,
      side: THREE.DoubleSide, // camera views the plane from its back (-z side)
    })
  );
  backdrop.position.set(0, 1.75, 5.4);
  scene.add(backdrop);

  // distant floating island silhouette
  const sil = new THREE.Group();
  const silPairs = [
    ['#6ea24f', '#2a3a4c'], ['#5d4a3a', '#1c2430'],
    ['#e8dcc8', '#3a4a5c'], ['#c26234', '#2c3850'],
  ].map(([d, n]) => ({ day: new THREE.Color(d), night: new THREE.Color(n) }));
  const silMat = (i) => new THREE.MeshBasicMaterial({ color: silPairs[i].day.clone() });
  sil.add(mesh(blobGeometry('silGrass', 0.14), silMat(0), { pos: [0, 0.42, 0], scale: [1.15, 0.4, 0.95], cast: false, receive: false }));
  sil.add(mesh(geo('silCone', () => new THREE.ConeGeometry(0.72, 1.05, 8)), silMat(1), {
    pos: [0, -0.28, 0], rot: [Math.PI, 0, 0], cast: false, receive: false,
  }));
  sil.add(mesh(box(0.3, 0.2, 0.24), silMat(2), { pos: [0.05, 0.62, 0], cast: false, receive: false }));
  sil.add(mesh(geo('silRoof', () => new THREE.ConeGeometry(0.26, 0.2, 4)), silMat(3), {
    pos: [0.05, 0.8, 0], rot: [0, Math.PI / 4, 0], cast: false, receive: false,
  }));
  sil.position.set(1.7, 1.42, 5.0);
  sil.scale.setScalar(0.5);
  scene.add(sil);

  // sun & moon beyond the window
  const sunSpr = new THREE.Sprite(new THREE.SpriteMaterial({
    map: glowTexture(), color: '#fff2c8', transparent: true,
    opacity: 0.75, depthWrite: false, blending: THREE.AdditiveBlending, fog: false,
  }));
  sunSpr.position.set(2.4, 3.3, 5.0);
  sunSpr.scale.set(1.9, 1.9, 1);
  scene.add(sunSpr);
  const moonSpr = new THREE.Sprite(new THREE.SpriteMaterial({
    map: glowTexture(), color: '#dfe8ff', transparent: true,
    opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, fog: false,
  }));
  moonSpr.position.set(-2.6, 3.6, 5.0);
  moonSpr.scale.set(1.5, 1.5, 1);
  scene.add(moonSpr);

  // stars visible through the window at night
  const starPos = [];
  for (let i = 0; i < 70; i++) {
    starPos.push((rng() * 2 - 1) * 5, 2.2 + rng() * 3.2, 5.15);
  }
  const starGeo = new THREE.BufferGeometry();
  starGeo.setAttribute('position', new THREE.Float32BufferAttribute(starPos, 3));
  const winStarMat = new THREE.PointsMaterial({
    size: 2.4, map: glowTexture(), color: '#e8eeff', transparent: true,
    opacity: 0, depthWrite: false, sizeAttenuation: false,
    blending: THREE.AdditiveBlending, fog: false,
  });
  scene.add(new THREE.Points(starGeo, winStarMat));

  /* ----------------------------- bed ------------------------------ */
  const bed = new THREE.Group();
  const bedMat = mat('i-bed', () => standard('#7b5137'));
  for (const [x, z] of [[-0.45, -0.85], [0.45, -0.85], [-0.45, 0.85], [0.45, 0.85]]) {
    bed.add(mesh(box(0.09, 0.3, 0.09), bedMat, { pos: [x, 0.15, z] }));
  }
  bed.add(mesh(box(1.0, 0.14, 1.9), bedMat, { pos: [0, 0.36, 0] }));
  bed.add(mesh(box(1.0, 0.72, 0.1), bedMat, { pos: [0, 0.62, -0.95] }));
  bed.add(mesh(box(0.94, 0.18, 1.78), creamMat, { pos: [0, 0.52, 0] }));
  bed.add(mesh(blobGeometry('i-pillow', 0.1), mat('i-pillow', () => standard('#fbf3e0')), {
    pos: [0, 0.66, -0.62], scale: [0.34, 0.14, 0.22],
  }));
  bed.add(mesh(box(0.98, 0.09, 1.05), mat('i-blanket', () => standard('#c96f57')), { pos: [0, 0.6, 0.38] }));
  bed.add(mesh(box(0.98, 0.05, 0.18), mat('i-blanketFold', () => standard('#b85a44')), { pos: [0, 0.65, -0.12] }));
  bed.position.set(1.85, 0, -1.3);
  bed.rotation.y = -0.1;
  scene.add(bed);

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

  /* --------------------------- bookshelf -------------------------- */
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
  // plant on top
  shelf.add(mesh(geo('i-potTop', () => new THREE.CylinderGeometry(0.09, 0.11, 0.16, 7)),
    potMat, { pos: [-0.3, 2.0, 0] }));
  shelf.add(mesh(blobGeometry('i-plantTop', 0.18), leafMat, {
    pos: [-0.3, 2.18, 0], scale: [0.16, 0.14, 0.16],
  }));
  shelf.position.set(3.06, 0, -0.35);
  shelf.rotation.y = Math.PI / 2;
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
  // ink pot
  desk.add(mesh(geo('i-ink', () => new THREE.CylinderGeometry(0.05, 0.06, 0.09, 7)),
    mat('i-inkM', () => standard('#4a5a70')), { pos: [0.3, 0.835, -0.2] }));
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

  /* --------------------------- door ------------------------------- */
  // M1.2: the door moved from the left wall (where it was rotated
  // -0.55 rad against its own opening) to the front wall opening at
  // x -2.9..-1.9, flush with the wall like the cottage's front door.
  // Local frame: opening 1.0 wide along x, panel faces the room (-z).
  const doorGroup = new THREE.Group();
  doorGroup.name = 'door';
  doorGroup.add(mesh(box(0.1, 2.15, 0.1), timberMat, { pos: [-0.45, 1.075, 0] }));
  doorGroup.add(mesh(box(0.1, 2.15, 0.1), timberMat, { pos: [0.45, 1.075, 0] }));
  doorGroup.add(mesh(box(1.1, 0.1, 0.1), timberMat, { pos: [0, 2.12, 0] }));
  const panel = mesh(box(0.95, 2.0, 0.07), mat('i-door', () => standard('#6d4a30')), {
    pos: [0, 1.0, 0],
  });
  doorGroup.add(panel);
  doorGroup.add(mesh(geo('i-knob', () => new THREE.IcosahedronGeometry(0.05, 0)),
    brassMat, { pos: [-0.35, 1.0, -0.06] }));
  doorGroup.position.set(-2.4, 0, 2.78);
  doorGroup.userData.interactive = 'door';
  scene.add(doorGroup);

  /* ------------------------ wall picture -------------------------- */
  const pic = new THREE.Group();
  pic.add(mesh(box(0.92, 0.68, 0.06), timberMat, { pos: [0, 0, 0], cast: false }));
  const flat = (w, h, color, x, y, z) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h),
      new THREE.MeshBasicMaterial({ color }));
    m.position.set(x, y, z);
    pic.add(m);
  };
  flat(0.78, 0.54, '#f6ecd8', 0, 0, 0.035);
  flat(0.78, 0.27, '#7fb6d0', 0, -0.12, 0.04);
  flat(0.3, 0.12, '#6ea24f', -0.08, 0.02, 0.045);
  flat(0.14, 0.14, '#f6c96b', 0.2, 0.17, 0.045);
  pic.position.set(-1.25, 1.72, -2.68);
  scene.add(pic);

  /* ----------------------- potted plant --------------------------- */
  const plant = new THREE.Group();
  plant.add(mesh(geo('i-pot2', () => new THREE.CylinderGeometry(0.16, 0.19, 0.26, 8)),
    potMat, { pos: [0, 0.13, 0] }));
  for (const [x, y, z, s] of [[0, 0.44, 0, 0.2], [0.12, 0.34, 0.06, 0.13], [-0.11, 0.36, -0.05, 0.14]]) {
    plant.add(mesh(blobGeometry('i-plant', 0.2), leafMat, {
      pos: [x, y, z], scale: [s, s * 0.85, s],
    }));
  }
  plant.position.set(1.55, 0, 2.3);
  scene.add(plant);

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
    backdropUniforms.uTime.value = t;
    backdropUniforms.uNight.value = nightK;
    winStarMat.opacity = nightK;
    sunSpr.material.opacity = (1 - nightK) * 0.75;
    moonSpr.material.opacity = nightK * 0.95;
    windowDir.intensity = (lampOn ? 0.55 : 0.32) - nightK * 0.38;
    // distant island bobs on the sea and dims at night
    sil.position.y = 1.42 + Math.sin(t * 0.8) * 0.035;
    sil.children.forEach((m, i) => {
      m.material.color.copy(silPairs[i].day).lerp(silPairs[i].night, nightK);
    });
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
    update, setLamp,
    toggleLamp: () => { setLamp(!lampOn); return lampOn; },
    isLampOn: () => lampOn,
    setNightTarget: (v) => { nightTarget = v; },
    CAM_POS: new THREE.Vector3(0.55, 1.55, -1.05),
    TARGET: new THREE.Vector3(-0.35, 1.02, 0.85),
    // M1.4: hard interior bounds for the camera (world.setCamBounds).
    // 0.18 margin inside the shell so normal orbiting can never push
    // the camera through a wall or the ceiling (the old maxDistance
    // alone allowed exactly that, blacking out the screen).
    CAM_BOUNDS: {
      min: new THREE.Vector3(-3.02, 0.3, -2.52),
      max: new THREE.Vector3(3.02, 2.72, 2.52),
    },
    BOOK_FOCUS, WINDOW_FOCUS,
  };
}
