import * as THREE from 'three';
import { OrbitControls } from '../vendor/OrbitControls.js';
import {
  SEA_Y, TAU, makeRng, glowTexture, blobGeometry, mesh, standard,
} from './utils.js';

/* ------------------------------------------------------------------ *
 * Renderer, camera, lighting, gradient sky, animated ocean, clouds
 * and stars. Everything procedural — no external assets.
 * ------------------------------------------------------------------ */

const SKY_VERT = `
  varying vec3 vDir;
  void main() {
    vDir = position;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;
const SKY_FRAG = `
  uniform vec3 uTop;
  uniform vec3 uHorizon;
  uniform vec3 uBottom;
  varying vec3 vDir;
  void main() {
    float h = normalize(vDir).y;
    vec3 c = mix(uHorizon, uTop, smoothstep(0.0, 0.78, h));
    c = mix(uBottom, c, smoothstep(-0.42, 0.03, h));
    c += uHorizon * exp(-pow(h * 7.0, 2.0)) * 0.22;
    gl_FragColor = vec4(c, 1.0);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

const OCEAN_VERT = `
  uniform float uTime;
  varying vec3 vWorld;
  varying float vWave;
  void main() {
    vec3 p = position;
    float w = sin(p.x * 0.17 + uTime * 0.72) * 0.26
            + sin(p.z * 0.23 - uTime * 0.55) * 0.20
            + sin((p.x + p.z) * 0.105 + uTime * 0.34) * 0.15
            + sin(p.x * 0.55 - uTime * 1.9) * 0.05;
    p.y += w;
    vWave = w;
    vec4 wp = modelMatrix * vec4(p, 1.0);
    vWorld = wp.xyz;
    gl_Position = projectionMatrix * viewMatrix * wp;
  }
`;
const OCEAN_FRAG = `
  uniform vec3 uDeep;
  uniform vec3 uShallow;
  uniform vec3 uSky;
  uniform vec3 uSunColor;
  uniform float uTime;
  uniform float uSparkle;   // atmosphere-driven highlight strength (night = calm)
  uniform float uShore;     // surf ring radius — follows the growing shoreline
  varying vec3 vWorld;
  varying float vWave;
  void main() {
    float d = length(vWorld.xz);
    float t = clamp(smoothstep(7.0, 95.0, d), 0.0, 1.0);
    vec3 col = mix(uShallow, uDeep, t);
    // brighter shallow band hugging the island
    col = mix(uShallow * 1.12, col, smoothstep(8.0, 15.0, d));

    // wave crests
    float crest = smoothstep(0.14, 0.42, vWave);
    col += vec3(0.14, 0.20, 0.22) * crest * 0.6 * uSparkle;

    // fine drifting shimmer across near water
    float shimmer = sin(vWorld.x * 1.35 + uTime * 1.9) * sin(vWorld.z * 1.15 - uTime * 1.5);
    col += vec3(0.10, 0.14, 0.16) * smoothstep(0.62, 0.95, shimmer)
         * (1.0 - smoothstep(12.0, 60.0, d)) * 0.4 * uSparkle;

    // sun / moon glitter path
    float glint = pow(max(0.0, 1.0 - abs(vWorld.x) / 38.0), 2.0)
                * (0.5 + 0.5 * sin(d * 0.42 - uTime * 1.15));
    col += uSunColor * glint * 0.10 * (0.4 + 0.6 * uSparkle);

    // soft surf ring encircling the island (uShore tracks growth.js)
    float ring = exp(-pow((d - uShore) * 0.34, 2.0));
    col += vec3(0.55, 0.62, 0.64) * ring * 0.42 * uSparkle;

    // concentric ripples
    float ripple = sin(d * 0.5 - uTime * 0.85);
    col += vec3(0.09, 0.15, 0.17) * smoothstep(0.86, 1.0, ripple)
         * (1.0 - smoothstep(28.0, 76.0, d)) * 0.32 * uSparkle;

    // distance haze into the sky
    float fog = smoothstep(78.0, 215.0, d);
    col = mix(col, uSky, fog * 0.8);

    gl_FragColor = vec4(col, 1.0);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

export function createWorld(canvas) {
  const renderer = new THREE.WebGLRenderer({
    canvas, antialias: true, powerPreference: 'high-performance',
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;

  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog('#cfe6ee', 48, 190);

  const camera = new THREE.PerspectiveCamera(
    46, window.innerWidth / window.innerHeight, 0.1, 900
  );
  // A slightly lower, wider view keeps a band of sky (clouds / stars) visible
  // while still showing the full layered keel, dock and boat.
  const CAM_POS = new THREE.Vector3(14.6, 8.4, 18.9);
  const TARGET = new THREE.Vector3(0, 0.35, 0);
  camera.position.copy(CAM_POS);

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.target.copy(TARGET);
  controls.enableDamping = true;
  controls.dampingFactor = 0.055;
  controls.enablePan = false;
  controls.minDistance = 13;
  controls.maxDistance = 46;
  controls.minPolarAngle = 0.3;
  controls.maxPolarAngle = 1.46;
  controls.rotateSpeed = 0.72;
  controls.zoomSpeed = 0.85;
  controls.autoRotate = true;
  controls.autoRotateSpeed = 0.32;
  controls.update();

  /* ---------------------- lighting ---------------------- */
  const hemi = new THREE.HemisphereLight('#dff1ff', '#6b7a52', 1.15);
  scene.add(hemi);
  const ambient = new THREE.AmbientLight('#ffffff', 0.32);
  scene.add(ambient);
  const sun = new THREE.DirectionalLight('#fff2d0', 2.1);
  sun.position.set(-18, 26, 16);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.near = 1;
  sun.shadow.camera.far = 95;
  sun.shadow.camera.left = -17;
  sun.shadow.camera.right = 17;
  sun.shadow.camera.top = 17;
  sun.shadow.camera.bottom = -17;
  sun.shadow.bias = -0.0006;
  sun.shadow.normalBias = 0.025;
  scene.add(sun, sun.target);

  /* ------------------------ sky ------------------------ */
  const skyUniforms = {
    uTop: { value: new THREE.Color('#4a8fd8') },
    uHorizon: { value: new THREE.Color('#bfe3f2') },
    uBottom: { value: new THREE.Color('#e8f3ee') },
  };
  const sky = new THREE.Mesh(
    new THREE.SphereGeometry(430, 32, 20),
    new THREE.ShaderMaterial({
      uniforms: skyUniforms,
      vertexShader: SKY_VERT,
      fragmentShader: SKY_FRAG,
      side: THREE.BackSide,
      depthWrite: false,
      fog: false,
    })
  );
  sky.renderOrder = -20;
  scene.add(sky);

  /* ----------------------- ocean ----------------------- */
  const oceanUniforms = {
    uTime: { value: 0 },
    uDeep: { value: new THREE.Color('#1e6b96') },
    uShallow: { value: new THREE.Color('#4fb6c4') },
    uSky: { value: new THREE.Color('#cfe6ee') },
    uSunColor: { value: new THREE.Color('#ffe9b0') },
    uSparkle: { value: 1 },
    uShore: { value: 11.0 },  // growth.js keeps this glued to the skirt edge
  };
  const oceanGeo = new THREE.PlaneGeometry(540, 540, 120, 120);
  oceanGeo.rotateX(-Math.PI / 2);
  const ocean = new THREE.Mesh(oceanGeo, new THREE.ShaderMaterial({
    uniforms: oceanUniforms,
    vertexShader: OCEAN_VERT,
    fragmentShader: OCEAN_FRAG,
    fog: false,
  }));
  ocean.position.y = SEA_Y;
  ocean.renderOrder = -5;
  scene.add(ocean);

  /* ----------------------- clouds ---------------------- */
  const cloudMat = standard('#f7faf7', { roughness: 1, transparent: true, opacity: 0.9 });
  const clouds = new THREE.Group();
  for (let i = 0; i < 11; i++) {
    const rng = makeRng(1000 + i * 37);
    const c = new THREE.Group();
    const n = 3 + Math.floor(rng() * 3);
    for (let j = 0; j < n; j++) {
      c.add(mesh(blobGeometry('cloud', 0.14), cloudMat, {
        pos: [(j - n / 2) * 1.05 + (rng() - 0.5) * 0.5, (rng() - 0.5) * 0.4, (rng() - 0.5) * 0.8],
        scale: [1.15 + rng() * 0.7, 0.55 + rng() * 0.32, 0.85 + rng() * 0.5],
        cast: false, receive: false,
      }));
    }
    const a = rng() * TAU;
    const r = 17 + rng() * 24;
    const y = i < 9 ? 6.5 + rng() * 10 : 4.5 + rng() * 2.2; // two low wispy clouds
    c.position.set(Math.cos(a) * r, y, Math.sin(a) * r);
    c.scale.setScalar(0.85 + rng() * 0.85);
    if (i >= 9) c.scale.y *= 0.5;
    c.userData = { a, r, y, speed: 0.01 + rng() * 0.016 };
    clouds.add(c);
  }
  scene.add(clouds);

  /* ------------------------ stars ---------------------- */
  const starPositions = [];
  {
    const rng = makeRng(55501);
    // Bias towards the low sky so stars actually fall inside the visible
    // horizon band of the default camera (which looks slightly downward).
    for (let i = 0; i < 460; i++) {
      const a = rng() * TAU;
      const h = 0.015 + Math.pow(rng(), 1.6) * 0.72;
      const rr = 150 + rng() * 150;
      const p = Math.sqrt(Math.max(0, 1 - h * h));
      starPositions.push(Math.cos(a) * p * rr, h * rr, Math.sin(a) * p * rr);
    }
  }
  const starGeo = new THREE.BufferGeometry();
  starGeo.setAttribute('position', new THREE.Float32BufferAttribute(starPositions, 3));
  const starMat = new THREE.PointsMaterial({
    size: 3.0, map: glowTexture(), color: '#fff6e2',
    transparent: true, opacity: 0, depthWrite: false,
    // Fixed pixel size: distant stars stay crisp instead of shrinking to
    // sub-pixel dots that disappear on a projector.
    sizeAttenuation: false, blending: THREE.AdditiveBlending, fog: false,
  });
  const stars = new THREE.Points(starGeo, starMat);
  stars.renderOrder = -15;
  scene.add(stars);

  /* -------------------- runtime helpers ---------------- */
  let activeScene = scene;

  /** Switch which scene the render loop draws (island <-> interior). */
  function setScene(s) { activeScene = s; }
  function getScene() { return activeScene; }

  /** Adjust orbit limits when travelling between island & interior. */
  function setLimits(minD, maxD, minP, maxP) {
    controls.minDistance = minD;
    controls.maxDistance = maxD;
    controls.minPolarAngle = minP;
    controls.maxPolarAngle = maxP;
    controls.update();
  }

  /* M1.4: optional hard AABB for the camera (used indoors). OrbitControls
     only limits the orbit *distance around the target* — with an
     off-centre target that still lets the camera pass through walls.
     Clamping in render() (which runs right after controls.update())
     guarantees the camera stays inside the shell. Lightweight on
     purpose: it restricts the view to a box, it is not a collision
     system, and it never blocks zooming altogether. */
  let camBounds = null;
  function setCamBounds(min, max) {
    camBounds = min && max ? { min, max } : null;
  }

  function render() {
    if (camBounds) camera.position.clamp(camBounds.min, camBounds.max);
    renderer.render(activeScene, camera);
  }

  function resize() {
    const w = window.innerWidth, h = window.innerHeight;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  }

  function update(t, dt) {
    oceanUniforms.uTime.value = t;
    for (const c of clouds.children) {
      const u = c.userData;
      const a = u.a + t * u.speed;
      c.position.x = Math.cos(a) * u.r;
      c.position.z = Math.sin(a) * u.r;
      c.position.y = u.y + Math.sin(t * 0.25 + u.a * 3) * 0.35;
    }
    stars.rotation.y = t * 0.004;
  }

  return {
    renderer, scene, camera, controls,
    hemi, ambient, sun,
    skyUniforms, oceanUniforms, cloudMat, starMat,
    sky, ocean, clouds, stars,
    CAM_POS, TARGET,
    setScene, getScene, setLimits, setCamBounds, render,
    resize, update,
  };
}
