/* ------------------------------------------------------------------ *
 * Tiny Island — Local Profile System 1.0
 *
 * Each profile owns an independent slice of localStorage. The legacy
 * keys (memories / decorations / growth / atmosphere / ...) stay the
 * LIVE workspace of the ACTIVE profile — diary.js, decorations.js,
 * growth.js and atmosphere.js are not touched at all.
 *
 * profile.js keeps a byte-exact snapshot of those keys per profile
 * (raw strings, so revisions, moods, growth unlocks survive verbatim)
 * and swaps snapshots on switch, followed by a full page reload —
 * the scene is rebuilt from scratch, so nothing from the previous
 * island can leak into the new one.
 *
 * Storage layout
 *   tiny-island.profiles.v1        index { version, activeId, profiles:[{id,name,createdAt,lastUsedAt}] }
 *   tiny-island.p.<id>.v1          per-profile snapshot { "<legacy key>": "<raw json string>" }
 *   tiny-island.profile.switch.v1  crash-safety marker for an in-flight switch
 *   tiny-island.migration.backup.v1  pre-migration backup (never deleted)
 * ------------------------------------------------------------------ */

const INDEX_KEY = 'tiny-island.profiles.v1';
const DATA_PREFIX = 'tiny-island.p.';
const SWITCH_KEY = 'tiny-island.profile.switch.v1';
const BACKUP_KEY = 'tiny-island.migration.backup.v1';

/* Every user-data key the island owns. 'atmosphere' predates the
 * versioned naming, so it is special-cased. Static code / vendor
 * files are shared by definition — nothing to save per profile. */
const DATA_KEYS = [
  'memories.v1',      // notes + revision history + mood snapshots (mailbox)
  'moods.v1',         // custom moods
  'diarySettings.v1', // edit window preference
  'decorations.v1',   // island build layout
  'welcomed.v1',      // first-visit onboarding progress
  'growth.v1',        // lifetime count / milestones / unlocks
  'journal.v1',       // Life Journal (indoor notebook — plans/goals/pages)
  'atmosphere',       // day / sunset / night / auto
];

const fullKey = (k) =>
  k === 'atmosphere' ? 'tiny-island.atmosphere' : 'tiny-island.' + k;
const dataKey = (id) => DATA_PREFIX + id + '.v1';

/* ---- raw localStorage helpers (never throw) ----------------------- */
function readRaw(k) {
  try { return localStorage.getItem(k); } catch (e) { return null; }
}
function writeRaw(k, v) {
  try { localStorage.setItem(k, v); return true; } catch (e) { return false; }
}
function removeRaw(k) {
  try { localStorage.removeItem(k); } catch (e) { /* ignore */ }
}

/* A snapshot = { legacyKeySuffix: rawString } for every key present.
 * Raw strings keep byte-exact fidelity with what the modules wrote. */
function snapshot() {
  const s = {};
  for (const k of DATA_KEYS) {
    const v = readRaw(fullKey(k));
    if (v !== null) s[k] = v;
  }
  return s;
}
function restore(snap) {
  for (const k of DATA_KEYS) {
    if (snap && snap[k] !== undefined) writeRaw(fullKey(k), snap[k]);
    else removeRaw(fullKey(k));
  }
}
const sameSnap = (a, b) => JSON.stringify(a || {}) === JSON.stringify(b || {});
/* Order-insensitive comparison used to verify a swap actually landed. */
function equalSnap(a, b) {
  for (const k of DATA_KEYS) {
    const x = a[k], y = b[k];
    if (x === undefined || y === undefined) {
      if (x !== y) return false;
    } else if (x !== y) return false;
  }
  return true;
}

function makeId() {
  try {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
      return 'p_' + crypto.randomUUID();
    }
  } catch (e) { /* fall through */ }
  return 'p_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
}

function readIndex() {
  try {
    const v = JSON.parse(readRaw(INDEX_KEY));
    if (v && Array.isArray(v.profiles) && v.profiles.length) return v;
  } catch (e) { /* fall through */ }
  return null;
}
function writeIndex(ix) { writeRaw(INDEX_KEY, JSON.stringify(ix)); }

function touch(ix, id) {
  const p = ix.profiles.find((x) => x.id === id);
  if (p) p.lastUsedAt = Date.now();
}

function readPendingSwitch() {
  try {
    const v = JSON.parse(readRaw(SWITCH_KEY));
    if (v && typeof v.to === 'string') return v;
  } catch (e) { /* fall through */ }
  return null;
}

/* ------------------------------------------------------------------ *
 * Migration — runs once, guarded by the index key.
 * Order is crash-safe: backup → write blob → verify → publish index.
 * The legacy keys are never cleared or overwritten; the default
 * profile simply adopts them as its live workspace.
 * ------------------------------------------------------------------ */
function migrate() {
  const legacy = snapshot();
  const hasLegacy = Object.keys(legacy).length > 0;

  // Safety backup BEFORE anything else. Kept permanently — this file
  // is the last-resort copy of the pre-profile island. If the backup
  // write fails we stop: never publish an index we cannot recover.
  if (hasLegacy) {
    const backupOk = writeRaw(BACKUP_KEY, JSON.stringify({ at: new Date().toISOString(), data: legacy }));
    if (readRaw(BACKUP_KEY) === null || !backupOk) {
      return { error: 'migrate-backup-failed' };
    }
  }

  const id = makeId();
  const now = Date.now();
  const blob = JSON.stringify(legacy);

  writeRaw(dataKey(id), blob);
  // Verify the write actually landed byte-exact before publishing.
  if (readRaw(dataKey(id)) !== blob) {
    return { error: 'migrate-verify-failed' };
  }

  const ix = {
    version: 1,
    activeId: id,
    profiles: [{ id, name: 'My Island', createdAt: now, lastUsedAt: now }],
  };
  writeIndex(ix);
  return { index: ix };
}

/* Finish an interrupted switch. During a switch the target blob is
 * never modified, so restoring it is always the correct outcome. */
function resolvePendingSwitch(ix, pending) {
  const to = ix.profiles.find((p) => p.id === pending.to);
  if (to) {
    const raw = readRaw(dataKey(to.id));
    if (raw !== null) {
      try { restore(JSON.parse(raw)); } catch (e) { /* keep legacy */ }
    }
    ix.activeId = to.id;
    touch(ix, to.id);
    writeIndex(ix);
  }
  removeRaw(SWITCH_KEY);
  return ix;
}

/* ------------------------------------------------------------------ *
 * Boot. MUST run before any other module reads localStorage
 * (main.js calls it as the very first line of boot()).
 * ------------------------------------------------------------------ */
export function initProfiles() {
  const pending = readPendingSwitch();
  let ix = readIndex();

  if (!ix) {
    const res = migrate();
    if (res.error) return { error: res.error };
    ix = res.index;
  } else if (pending) {
    resolvePendingSwitch(ix, pending);
  } else {
    // Normal boot: the legacy keys are the live (newest) workspace of
    // the active profile — persist them back into the profile blob.
    const active = ix.profiles.find((p) => p.id === ix.activeId) || ix.profiles[0];
    ix.activeId = active.id;
    const ok = writeRaw(dataKey(active.id), JSON.stringify(snapshot()));
    touch(ix, active.id);
    writeIndex(ix);
    if (!ok) return { index: ix, warning: 'flush-failed' };
  }
  return { index: ix };
}

/* ------------------------------------------------------------------ *
 * Profile Manager — pure storage operations, no UI. main.js guards
 * the diary-open case before calling these.
 * ------------------------------------------------------------------ */

export function listProfiles() {
  const ix = readIndex();
  if (!ix) return { activeId: null, profiles: [] };
  return {
    activeId: ix.activeId,
    profiles: ix.profiles.slice().sort((a, b) => a.createdAt - b.createdAt),
  };
}

export function activeProfile() {
  const l = listProfiles();
  return l.profiles.find((p) => p.id === l.activeId) || null;
}

/** Persist the live workspace into the active profile blob. */
export function flushActive() {
  const a = activeProfile();
  if (a) writeRaw(dataKey(a.id), JSON.stringify(snapshot()));
}

export function createProfile(name) {
  const ix = readIndex();
  if (!ix) return { error: 'not-initialized' };
  const id = makeId();
  const now = Date.now();
  // Empty snapshot = a truly fresh world: zero memories, Lv.1 island,
  // default atmosphere, welcome banner. Nothing inherited.
  if (!writeRaw(dataKey(id), JSON.stringify({}))) {
    return { error: 'save-failed' };
  }
  ix.profiles.push({
    id,
    name: (name || '').trim().slice(0, 24) || 'My Island',
    createdAt: now,
    lastUsedAt: now,
  });
  writeIndex(ix);
  const check = readIndex();
  if (!check || !check.profiles.some((p) => p.id === id)) {
    removeRaw(dataKey(id)); // roll back the orphan blob
    return { error: 'save-failed' };
  }
  return { ok: true, id };
}

/**
 * Swap snapshots and reload. Crash-safe two-phase:
 *   1. flush live data into the old blob
 *   2. write marker
 *   3. write target blob into the live keys
 *   4. publish index (activeId = target)
 *   5. clear marker → reload
 * initProfiles() resolves the marker after a crash mid-sequence.
 */
export function switchProfile(id) {
  const ix = readIndex();
  if (!ix) return { error: 'not-initialized' };
  const to = ix.profiles.find((p) => p.id === id);
  if (!to) return { error: 'unknown-profile' };
  if (to.id === ix.activeId) return { ok: true, reloaded: false };

  const raw = readRaw(dataKey(to.id));
  if (raw === null) return { error: 'profile-data-missing' };
  const oldSnap = snapshot();
  let targetSnap;
  try { targetSnap = JSON.parse(raw); } catch (e) { return { error: 'profile-data-corrupt' }; }

  // 1. live workspace → current profile blob (verify before touching anything)
  if (!writeRaw(dataKey(ix.activeId), JSON.stringify(oldSnap))) {
    return { error: 'save-failed' };
  }
  // 2. marker first — after a crash, boot knows which blob to restore
  if (!writeRaw(SWITCH_KEY, JSON.stringify({ to: to.id, at: Date.now() }))) {
    return { error: 'save-failed' };
  }
  // 3. swap, then verify byte-exact; on failure roll the live keys back
  restore(targetSnap);
  if (!equalSnap(snapshot(), targetSnap)) {
    restore(oldSnap);
    removeRaw(SWITCH_KEY);
    return { error: 'swap-verify-failed' };
  }
  // 4. publish the index, then verify it landed
  const prevActive = ix.activeId;
  ix.activeId = to.id;
  touch(ix, to.id);
  writeIndex(ix);
  const check = readIndex();
  if (!check || check.activeId !== to.id) {
    ix.activeId = prevActive;
    writeIndex(ix);
    restore(oldSnap);
    removeRaw(SWITCH_KEY);
    return { error: 'save-failed' };
  }
  removeRaw(SWITCH_KEY);
  // 5. full reload — scene, systems and UI rebuild from the swapped data
  location.reload();
  return { ok: true, reloaded: true };
}

export function deleteProfile(id) {
  const ix = readIndex();
  if (!ix) return { error: 'not-initialized' };
  if (ix.profiles.length <= 1) return { error: 'last-profile' };
  if (id === ix.activeId) return { error: 'active-profile' };
  const victim = ix.profiles.find((p) => p.id === id);
  if (!victim) return { error: 'unknown-profile' };

  const blobRaw = readRaw(dataKey(id));
  removeRaw(dataKey(id));
  if (readRaw(dataKey(id)) !== null) return { error: 'save-failed' };
  ix.profiles = ix.profiles.filter((p) => p.id !== id);
  writeIndex(ix);
  const check = readIndex();
  if (!check || check.profiles.some((p) => p.id === id)) {
    // index write failed — restore the blob so no data is lost
    if (blobRaw !== null) writeRaw(dataKey(id), blobRaw);
    return { error: 'save-failed' };
  }
  return { ok: true, name: victim.name };
}
