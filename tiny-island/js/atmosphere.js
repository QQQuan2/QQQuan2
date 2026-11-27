import * as THREE from 'three';
import { damp, readJSON, writeJSON } from './utils.js';

/* ------------------------------------------------------------------ *
 * Day / Sunset / Night — every colour & light is smoothly damped
 * towards the active preset, so switching never snaps.
 * ------------------------------------------------------------------ */

const RAW = {
  day: {
    skyTop: '#4b8fd6', skyHorizon: '#c6e6f2', skyBottom: '#eaf4ec',
    fog: '#cfe6ee',
    hemiSky: '#e2f2ff', hemiGround: '#6e7c53', hemiInt: 1.2,
    ambientInt: 0.34,
    sunColor: '#fff3d6', sunInt: 2.15, sunX: -18, sunY: 26, sunZ: 16,
    oceanDeep: '#1c6590', oceanShallow: '#4cb4c3',
    sunGlint: '#ffe9b0',
    cloudColor: '#f8fbf8',
    starOpacity: 0,
    windowEmissive: 0.16, lampEmissive: 0.18, doorLightInt: 0.0,
    oceanSparkle: 1.0,
    exposure: 1.05,
  },
  sunset: {
    skyTop: '#5a3a80', skyHorizon: '#f0a271', skyBottom: '#ffd2a4',
    fog: '#dfa487',
    hemiSky: '#ffd6ad', hemiGround: '#5d3c38', hemiInt: 0.92,
    ambientInt: 0.3,
    sunColor: '#ff9d5c', sunInt: 1.95, sunX: 22, sunY: 10, sunZ: -14,
    oceanDeep: '#37467c', oceanShallow: '#c37480',
    sunGlint: '#ffb273',
    cloudColor: '#f6d3bd',
    starOpacity: 0.1,
    windowEmissive: 0.8, lampEmissive: 0.75, doorLightInt: 0.55,
    oceanSparkle: 0.72,
    exposure: 1.02,
  },
  night: {
    skyTop: '#0d1e40', skyHorizon: '#2c4472', skyBottom: '#1a2947',
    fog: '#1d3054',
    hemiSky: '#5b7ab0', hemiGround: '#28304a', hemiInt: 0.74,
    ambientInt: 0.38,
    sunColor: '#a9c6ff', sunInt: 0.9, sunX: -14, sunY: 22, sunZ: -18,
    oceanDeep: '#0d2c52', oceanShallow: '#20507c',
    sunGlint: '#a9c8ff',
    cloudColor: '#93a7c9',
    starOpacity: 1.0,
    windowEmissive: 1.7, lampEmissive: 1.9, doorLightInt: 1.5,
    oceanSparkle: 0.26,
    exposure: 1.16,
  },
};

const COLOR_KEYS = [
  'skyTop', 'skyHorizon', 'skyBottom', 'fog',
  'hemiSky', 'hemiGround', 'sunColor',
  'oceanDeep', 'oceanShallow', 'sunGlint', 'cloudColor',
];
const NUM_KEYS = [
  'hemiInt', 'ambientInt', 'sunInt', 'sunX', 'sunY', 'sunZ',
  'starOpacity', 'windowEmissive', 'lampEmissive', 'doorLightInt',
  'oceanSparkle', 'exposure',
];

function makeState(raw) {
  const s = {};
  for (const k of COLOR_KEYS) s[k] = new THREE.Color(raw[k]);
  for (const k of NUM_KEYS) s[k] = raw[k];
  return s;
}

/* ------------------------------------------------------------------ *
 * Auto Atmosphere — real-time sky driven by the actual sun position.
 * Lightweight solar coordinates (good to ~0.5°, no external libs):
 * declination / hour angle from the low-precision NOAA formulas.
 * ------------------------------------------------------------------ */

const DEG = Math.PI / 180;

/** Solar elevation & azimuth (deg, azimuth clockwise from north) for a
 *  given Date + geolocation. Cheap enough for a 30 s refresh timer. */
function solarPosition(date, lat, lon) {
  const jd = date.getTime() / 86400000 + 2440587.5;
  const n = jd - 2451545.0;
  const meanLon = (280.460 + 0.9856474 * n) % 360;
  const meanAnom = ((357.528 + 0.9856003 * n) % 360) * DEG;
  const eclLon =
    (meanLon + 1.915 * Math.sin(meanAnom) + 0.02 * Math.sin(2 * meanAnom)) * DEG;
  const obliq = (23.439 - 0.0000004 * n) * DEG;
  const decl = Math.asin(Math.sin(obliq) * Math.sin(eclLon));
  const ra = Math.atan2(Math.cos(obliq) * Math.sin(eclLon), Math.cos(eclLon));
  const gmst = (18.697374558 + 24.06570982441908 * n) % 24;
  const lst = ((gmst * 15 + lon) % 360) * DEG;
  const ha = lst - ra;
  const phi = lat * DEG;
  const sinElev =
    Math.sin(phi) * Math.sin(decl) + Math.cos(phi) * Math.cos(decl) * Math.cos(ha);
  const elev = Math.asin(clampNum(sinElev, -1, 1));
  const cosAz =
    (Math.sin(decl) - sinElev * Math.sin(phi)) /
    Math.max(1e-6, Math.cos(elev) * Math.cos(phi));
  let az = Math.acos(clampNum(cosAz, -1, 1));
  if (Math.sin(ha) > 0) az = 2 * Math.PI - az; // afternoon → west
  return { elev: elev / DEG, az: az / DEG };
}

function clampNum(v, a, b) {
  return Math.min(b, Math.max(a, v));
}

/** Smooth 0→1 ramp between two solar elevations. */
function elevBlend(elev, lo, hi) {
  const t = clampNum((elev - lo) / (hi - lo), 0, 1);
  return t * t * (3 - 2 * t);
}

/** Rough timezone→city guess used when geolocation is unavailable. */
const TZ_TABLE = {
  'Asia/Shanghai': [34.3, 108.9], 'Asia/Taipei': [25.0, 121.5],
  'Asia/Hong_Kong': [22.3, 114.2], 'Asia/Macau': [22.2, 113.5],
  'Asia/Tokyo': [35.7, 139.7], 'Asia/Seoul': [37.5, 127.0],
  'Asia/Singapore': [1.35, 103.8], 'Asia/Bangkok': [13.75, 100.5],
  'America/New_York': [40.7, -74.0], 'America/Chicago': [41.9, -87.6],
  'America/Denver': [39.7, -105.0], 'America/Los_Angeles': [34.1, -118.2],
  'Europe/London': [51.5, -0.13], 'Europe/Paris': [48.9, 2.35],
  'Europe/Berlin': [52.5, 13.4], 'Australia/Sydney': [-33.9, 151.2],
};

function defaultLocation() {
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || '';
    if (TZ_TABLE[tz]) return { lat: TZ_TABLE[tz][0], lon: TZ_TABLE[tz][1] };
  } catch (e) { /* no Intl — fall through */ }
  // Generic fallback: median latitude + longitude guessed from UTC offset.
  const lon = (-new Date().getTimezoneOffset() / 60) * 15;
  return { lat: 35, lon: Math.round(lon * 10) / 10 };
}

function requestLocation(timeoutMs = 8000) {
  return new Promise((resolve) => {
    if (!navigator.geolocation) return resolve(null);
    let done = false;
    const finish = (v) => { if (!done) { done = true; resolve(v); } };
    navigator.geolocation.getCurrentPosition(
      (pos) => finish({ lat: pos.coords.latitude, lon: pos.coords.longitude }),
      () => finish(null),
      { timeout: timeoutMs, maximumAge: 600000 }
    );
    setTimeout(() => finish(null), timeoutMs + 1500);
  });
}

/** Permission check without prompting (used on page reload). */
function locationAlreadyGranted() {
  return navigator.permissions && navigator.permissions.query
    ? navigator.permissions
        .query({ name: 'geolocation' })
        .then((st) => st.state === 'granted')
        .catch(() => false)
    : Promise.resolve(false);
}

export function createAtmosphere(world, refs) {
  let mode = readJSON('tiny-island.atmosphere', 'day');
  if (mode !== 'auto' && !RAW[mode]) mode = 'day';

  let target = makeState(RAW[mode] || RAW.day);
  let current = makeState(RAW[mode] || RAW.day);
  const growth = { window: 0, mailbox: 0 };

  /* ---- Auto state ---- */
  const autoCoords = defaultLocation();
  let darkness = 0;
  let autoTimer = 0;
  const AUTO_REFRESH = 30; // seconds between solar recomputes

  /** Blend the three hand-tuned presets continuously by solar elevation:
   *  night (≤ -10°) → sunset (0°) → day (≥ 15°). Overriding the sun
   *  position with the real solar bearing once it clears the horizon. */
  function computeAutoState() {
    const now = new Date(); // device local time → implicit local timezone
    const { elev, az } = solarPosition(now, autoCoords.lat, autoCoords.lon);
    const s = makeState(RAW.day);

    if (elev <= -10) {
      sDeepCopy(s, RAW.night);
      darkness = 1;
    } else if (elev < 0) {
      mixState(s, RAW.night, RAW.sunset, elevBlend(elev, -10, 0));
      darkness = 1 - elevBlend(elev, -8, 2);
    } else {
      mixState(s, RAW.sunset, RAW.day, elevBlend(elev, 0, 15));
      darkness = 0;
    }

    // Real sun bearing: azimuth→scene x/z (north = -Z, east = +X).
    // Fades in as the sun clears the horizon; below it, the preset's
    // moonlight direction takes over.
    const w = elevBlend(elev, 0, 6);
    if (w > 0) {
      const r = 30, e = elev * DEG, a = az * DEG;
      const sx = Math.sin(a) * Math.cos(e) * r;
      const sz = -Math.cos(a) * Math.cos(e) * r;
      const sy = clampNum(Math.sin(e) * r, 2.5, 34);
      s.sunX = s.sunX * (1 - w) + sx * w;
      s.sunY = s.sunY * (1 - w) + sy * w;
      s.sunZ = s.sunZ * (1 - w) + sz * w;
    }
    return s;
  }

  function sDeepCopy(s, raw) {
    for (const k of COLOR_KEYS) s[k].set(raw[k]);
    for (const k of NUM_KEYS) s[k] = raw[k];
  }
  function mixState(s, a, b, t) {
    for (const k of COLOR_KEYS)
      s[k].set(a[k]).lerp(tmpColor.set(b[k]), t);
    for (const k of NUM_KEYS) s[k] = a[k] + (b[k] - a[k]) * t;
  }
  const tmpColor = new THREE.Color();

  function refreshAuto() {
    target = computeAutoState();
  }

  function setMode(next, instant = false) {
    if (!RAW[next]) return mode;
    mode = next;
    target = makeState(RAW[next]);
    if (instant) current = makeState(RAW[next]);
    writeJSON('tiny-island.atmosphere', next);
    apply();
    return mode;
  }

  /** Enter Auto: asks for geolocation when `ask` is true (user gesture);
   *  falls back to the timezone guess otherwise. Never rejects. */
  async function enableAuto(ask = true) {
    let located = false;
    if (ask) {
      const loc = await requestLocation();
      if (loc) {
        autoCoords.lat = loc.lat;
        autoCoords.lon = loc.lon;
        located = true;
      }
    }
    mode = 'auto';
    autoTimer = AUTO_REFRESH; // recompute on the next update tick
    writeJSON('tiny-island.atmosphere', 'auto');
    refreshAuto();
    apply();
    return { source: located ? 'geolocation' : 'default', coords: { ...autoCoords } };
  }

  /** On reload with Auto persisted: silently upgrade to real geolocation
   *  only if permission is already granted (no prompt, no storage). */
  function tryRestoreAuto() {
    return locationAlreadyGranted().then((granted) => {
      if (!granted) return { source: 'default', coords: { ...autoCoords } };
      return requestLocation().then((loc) => {
        if (loc) { autoCoords.lat = loc.lat; autoCoords.lon = loc.lon; refreshAuto(); }
        return { source: loc ? 'granted' : 'default', coords: { ...autoCoords } };
      });
    });
  }

  function setGrowth(g) {
    if (typeof g.window === 'number') growth.window = g.window;
    if (typeof g.mailbox === 'number') growth.mailbox = g.mailbox;
    apply();
  }

  function apply() {
    const s = current;
    world.skyUniforms.uTop.value.copy(s.skyTop);
    world.skyUniforms.uHorizon.value.copy(s.skyHorizon);
    world.skyUniforms.uBottom.value.copy(s.skyBottom);
    world.oceanUniforms.uDeep.value.copy(s.oceanDeep);
    world.oceanUniforms.uShallow.value.copy(s.oceanShallow);
    world.oceanUniforms.uSky.value.copy(s.skyHorizon);
    world.oceanUniforms.uSunColor.value.copy(s.sunGlint);
    world.oceanUniforms.uSparkle.value = s.oceanSparkle;

    world.scene.fog.color.copy(s.fog);
    world.hemi.color.copy(s.hemiSky);
    world.hemi.groundColor.copy(s.hemiGround);
    world.hemi.intensity = s.hemiInt;
    world.ambient.intensity = s.ambientInt;
    world.sun.color.copy(s.sunColor);
    world.sun.intensity = s.sunInt;
    world.sun.position.set(s.sunX, s.sunY, s.sunZ);
    world.cloudMat.color.copy(s.cloudColor);
    world.starMat.opacity = s.starOpacity;
    world.renderer.toneMappingExposure = s.exposure;

    refs.windowGlow.emissiveIntensity = s.windowEmissive + growth.window;
    refs.lampGlow.emissiveIntensity = s.lampEmissive;
    refs.doorLight.intensity = s.doorLightInt;
    for (const l of refs.lanterns) {
      l.userData.glass.emissiveIntensity = s.lampEmissive;
      l.userData.light.intensity = s.lampEmissive * 0.8;
    }
    refs.mailbox.userData.indicatorBase =
      0.45 + s.lampEmissive * 0.35 + growth.mailbox * 1.1;
  }

  function update(dt) {
    const a = 1 - Math.exp(-2.3 * dt);
    for (const k of COLOR_KEYS) current[k].lerp(target[k], a);
    for (const k of NUM_KEYS) current[k] = damp(current[k], target[k], 2.3, dt);
    if (mode === 'auto') {
      autoTimer += dt;
      if (autoTimer >= AUTO_REFRESH) { autoTimer = 0; refreshAuto(); }
    }
    apply();
  }

  if (mode === 'auto') refreshAuto();
  apply();
  return {
    setMode,
    setGrowth,
    update,
    getMode: () => mode,
    modes: Object.keys(RAW).concat('auto'),
    nightLevel: () => (mode === 'auto' ? darkness : mode === 'night' ? 1 : 0),
    enableAuto,
    tryRestoreAuto,
    autoInfo: () => ({ ...autoCoords }),
    /** Dev/demo hook: override the location Auto computes its sky from. */
    setAutoCoords: (lat, lon) => {
      autoCoords.lat = lat;
      autoCoords.lon = lon;
      refreshAuto();
      apply();
    },
  };
}
