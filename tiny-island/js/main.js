import * as THREE from 'three';
import { createWorld } from './world.js?v=20261128b';
import { buildIsland, surfaceHeight } from './island.js?v=20261128b';
import { buildHouse } from './house.js?v=20261128b';
import { HOUSE } from './house-config.js?v=20261128b';
import { buildStructures } from './structures.js?v=20261128b';
import { createGroundDetails, createEdgeDetails } from './nature.js?v=20261128b';
import { createAtmosphere } from './atmosphere.js?v=20261128b';
import { createDecorationSystem } from './decorations.js?v=20261128b';
import { createGrowthSystem } from './growth.js?v=20261128b';
import { createDiary } from './diary.js?v=20261128b';
import { buildInterior } from './interior.js?v=20261128b';
import {
  initProfiles, listProfiles, switchProfile, createProfile, deleteProfile,
} from './profile.js?v=20261128b';
import { createJournal } from './journal.js?v=20261128b';

/* ------------------------------------------------------------------ *
 * Tiny Island — application entry point.
 * Assembles the world, wires interaction and runs the render loop.
 * V2: the cottage is a real place you can enter; the dock sets sail;
 * Home / Mailbox / Dock are the three discovery points.
 * ------------------------------------------------------------------ */

const $ = (id) => document.getElementById(id);
const TOOL_LABEL = { tree: 'Tree', flower: 'Flowers', rock: 'Rock', lantern: 'Lantern', erase: 'Remove' };

const ISLAND_LIMITS = { min: 13, max: 46, minP: 0.3, maxP: 1.46 };
// M1.4: max tightened 3.6 → 3.2; on top of this, world.setCamBounds
// clamps the camera inside the interior shell so it can never exit
// through a wall (that used to black out the whole screen).
const INTERIOR_LIMITS = { min: 0.85, max: 3.2, minP: 0.5, maxP: 1.52 };
const SAIL_LIMITS = { min: 2, max: 60, minP: 0.1, maxP: 1.52 };

const POSTCARDS = [
  'A school of silver fish circled the boat twice, then vanished all at once.',
  'Somewhere beyond the fog, another island was singing — very faintly.',
  'A single paper boat drifted past, folded from a page of someone\'s letter.',
  'The sea turned glassy for a minute. In the reflection, the sky had two moons.',
  'A whale surfaced far off, tipped its fin like a hat, and slid back under.',
  'You found a bottle with a tiny map inside. The X marks this very island.',
  'The clouds were low enough today that the mast combed through one.',
  'A starfish climbed aboard, considered staying, and politely declined.',
];

const WELCOME_KEY = 'tiny-island.welcomed.v1';

function boot() {
  /* ------------------------- profile system ------------------------ */
  // MUST run before anything reads localStorage: it migrates legacy
  // data into a default profile on first run, then makes sure the
  // live keys belong to the active profile. On any migration failure
  // we stop instead of risking the user's island.
  const profiles = initProfiles();
  if (profiles.error) {
    const el = $('loading');
    if (el) {
      el.innerHTML = '<div class="load-error"><strong>Profile data could not be migrated safely.</strong>' +
        '<span>Startup paused to protect your island. Your original data was not changed.</span></div>';
      el.classList.remove('hidden');
    }
    return;
  }
  const profileWarning = profiles.warning || null;

  const canvas = $('scene');
  const world = createWorld(canvas);

  /* ------------------------- scene content ------------------------ */
  const island = buildIsland();
  world.scene.add(island.group);

  const house = buildHouse();
  house.group.position.set(0, surfaceHeight(0, -1.4), -1.4);
  house.group.rotation.y = HOUSE.placement.rotY;   // M1.1: from house-config
  house.group.scale.setScalar(HOUSE.placement.scale); // slightly smaller cottage
  world.scene.add(house.group);

  const structures = buildStructures();
  world.scene.add(structures.group);
  world.scene.add(createGroundDetails(140));
  world.scene.add(createEdgeDetails());

  const interior = buildInterior();

  // M2 portal: aim the outside camera out of the cottage's front
  // window (facade +z, yawed by placement.rotY). The cottage itself is
  // hidden during the RT pass so the shell never blocks the view.
  if (typeof world.setOutsideView === 'function') {
    const fwd = new THREE.Vector3(0, 0, 1).applyAxisAngle(
      new THREE.Vector3(0, 1, 0), HOUSE.placement.rotY);
    const base = house.group.position;
    world.setOutsideView(
      base.clone().addScaledVector(fwd, 3.0).add(new THREE.Vector3(0, 1.5, 0)),
      base.clone().addScaledVector(fwd, 60).add(new THREE.Vector3(0, -2.6, 0))
    );
    if (interior.setOutsideTexture) interior.setOutsideTexture(world.outsideTexture());
  }
  function renderPortal() {
    if (mode !== 'interior' || typeof world.renderOutside !== 'function') return;
    // Hide the cottage shell AND the mailbox (it stands right in front
    // of the facade) so the window shows an open sea view.
    const mbox = structures.mailbox;
    const mboxWas = mbox.visible;
    const lanterns = structures.lanterns || [];
    const lanternWas = lanterns.map((l) => l.visible);
    house.group.visible = false;
    mbox.visible = false;
    lanterns.forEach((l) => { l.visible = false; });
    try {
      world.renderOutside();
    } finally {
      house.group.visible = true;
      mbox.visible = mboxWas;
      lanterns.forEach((l, i) => { l.visible = lanternWas[i]; });
    }
  }

  /* --------------------------- systems ---------------------------- */
  const atmosphere = createAtmosphere(world, {
    windowGlow: house.windowGlow,
    lampGlow: house.lampGlow,
    doorLight: house.doorLight,
    mailbox: structures.mailbox,
    lanterns: structures.lanterns,
  });

  const decorations = createDecorationSystem(world, { ground: island.grassTop });

  let toastTimer = null;
  function toast(msg) {
    const t = $('toast');
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.remove('show'), 2500);
  }

  /* ---------------- island growth (Growth 1.1, Milestone A) -------- */
  // The lifetime memory count drives a five-level island expansion.
  // New land is a parameterized skirt around the untouched core
  // island; landscapes are unlocked (not auto-placed) at milestones.
  const growth = createGrowthSystem({
    parent: island.group,
    mailbox: structures.mailbox,     // spark burst origin
    onMilestone: showGrowthMilestone,
  });

  /* ------------------------ camera tweening ----------------------- */
  let viewTween = null;
  let savedView = null;      // island view kept while indoors / sailing

  function tweenView(toPos, toTarget, dur = 0.9) {
    viewTween = {
      fromPos: world.camera.position.clone(),
      fromTarget: world.controls.target.clone(),
      toPos: toPos.clone(),
      toTarget: toTarget.clone(),
      t: 0, dur,
    };
    world.controls.autoRotate = false;
  }
  function updateViewTween(dt) {
    if (!viewTween) return;
    viewTween.t = Math.min(1, viewTween.t + dt / viewTween.dur);
    const k = 1 - Math.pow(1 - viewTween.t, 3);
    world.camera.position.lerpVectors(viewTween.fromPos, viewTween.toPos, k);
    world.controls.target.lerpVectors(viewTween.fromTarget, viewTween.toTarget, k);
    if (viewTween.t >= 1) viewTween = null;
  }
  function focusMailbox() {
    savedView = {
      pos: world.camera.position.clone(),
      target: world.controls.target.clone(),
    };
    const mt = new THREE.Vector3(
      structures.mailbox.position.x,
      structures.mailbox.position.y + 1.1,
      structures.mailbox.position.z
    );
    const toTarget = world.controls.target.clone().lerp(mt, 0.5);
    const dist = world.camera.position.distanceTo(world.controls.target) * 0.84;
    const dir = world.camera.position.clone().sub(world.controls.target).normalize();
    tweenView(toTarget.clone().add(dir.multiplyScalar(dist)), toTarget, 0.85);
  }
  function unfocus() {
    if (savedView && mode === 'island' && !sail.active) tweenView(savedView.pos, savedView.target, 0.9);
    savedView = null;
  }

  /* --------------------------- scene mode -------------------------- */
  let mode = 'island';        // 'island' | 'interior'
  let busy = false;           // blocks clicks during travel

  const fadeEl = $('fade');
  function travel(switchFn, after) {
    if (busy) return;
    busy = true;
    hideTooltip();
    clearHover();
    fadeEl.classList.add('show');
    setTimeout(() => {
      try {
        switchFn();
      } catch (err) {
        // M1 hotfix: never leave the user trapped behind the fade overlay.
        // A stale / mixed ES module graph can make a scene switch throw; the
        // original code then skipped the timer that removes .show, so the
        // screen stayed a solid beige gradient forever with busy === true.
        console.error('[travel] scene switch failed:', err);
        try {
          world.setScene(world.scene);
          world.setLimits(ISLAND_LIMITS.min, ISLAND_LIMITS.max, ISLAND_LIMITS.minP, ISLAND_LIMITS.maxP);
          if (typeof world.setCamBounds === 'function') world.setCamBounds(null);
          mode = 'island';
          document.body.dataset.mode = 'island';
          updateHint();
          if (savedView) {
            world.controls.target.copy(savedView.target);
            world.camera.position.copy(savedView.pos);
            savedView = null;
          }
          toast('Could not switch scenes - back to the island. Please refresh.');
        } catch (rollbackErr) {
          console.error('[travel] rollback failed:', rollbackErr);
        }
      } finally {
        // Always release the overlay and the click lock, even on failure.
        setTimeout(() => {
          fadeEl.classList.remove('show');
          setTimeout(() => { busy = false; }, 220);
        }, 60);
      }
    }, 470);
    if (after) setTimeout(after, 560);
  }

  function enterHome() {
    if (mode !== 'island') return;
    savedView = {
      pos: world.camera.position.clone(),
      target: world.controls.target.clone(),
    };
    travel(() => {
      world.setScene(interior.scene);
      world.setLimits(INTERIOR_LIMITS.min, INTERIOR_LIMITS.max, INTERIOR_LIMITS.minP, INTERIOR_LIMITS.maxP);
      // M1 hotfix: guard against a stale / mixed module graph (old interior.js
      // has no CAM_BOUNDS, old world.js has no setCamBounds). Skipping the
      // clamp is harmless; throwing here used to lock the fade overlay on.
      if (typeof world.setCamBounds === 'function' && interior.CAM_BOUNDS) {
        world.setCamBounds(interior.CAM_BOUNDS.min, interior.CAM_BOUNDS.max);
      }
      world.controls.target.copy(interior.TARGET);
      world.camera.position.copy(interior.CAM_POS).add(new THREE.Vector3(0.25, 0.25, -0.9));
      interior.setNightTarget(atmosphere.nightLevel());
      mode = 'interior';
      document.body.dataset.mode = 'interior';
      updateHint();
      tweenView(interior.CAM_POS, interior.TARGET, 1.1);
    });
  }

  function exitHome() {
    if (mode !== 'interior') return;
    travel(() => {
      world.setScene(world.scene);
      world.setLimits(ISLAND_LIMITS.min, ISLAND_LIMITS.max, ISLAND_LIMITS.minP, ISLAND_LIMITS.maxP);
      if (typeof world.setCamBounds === 'function') world.setCamBounds(null);
      mode = 'island';
      document.body.dataset.mode = 'island';
      updateHint();
      if (savedView) {
        world.controls.target.copy(savedView.target);
        world.camera.position.copy(savedView.pos).add(new THREE.Vector3(0.4, 0.6, 0.4));
        tweenView(savedView.pos, savedView.target, 1.1);
        savedView = null;
      }
    });
  }

  /* ----------------------------- sailing --------------------------- */
  const boat = structures.boat;
  const boatBase = boat.position.clone();
  const boatYaw = boat.userData.baseRot;
  const sail = { active: false, k: 0, dir: new THREE.Vector3(), phase: 'out', timer: 0 };
  let sailView = null;

  function setSail() {
    if (sail.active || mode !== 'island') return;
    sail.active = true;
    sail.k = 0;
    sail.phase = 'out';
    sail.timer = 0;
    sail.dir.set(boatBase.x, 0, boatBase.z).normalize();
    sailView = {
      pos: world.camera.position.clone(),
      target: world.controls.target.clone(),
    };
    world.setLimits(SAIL_LIMITS.min, SAIL_LIMITS.max, SAIL_LIMITS.minP, SAIL_LIMITS.maxP);
    hideTooltip();
    clearHover();
    const mid = boatBase.clone().addScaledVector(sail.dir, 2.6);
    const camPos = boatBase.clone().addScaledVector(sail.dir, -2.2).add(new THREE.Vector3(0, 2.7, 0));
    tweenView(camPos, mid, 1.4);
    setTimeout(() => {
      $('pcText').textContent = POSTCARDS[Math.floor(Math.random() * POSTCARDS.length)];
      $('postcard').classList.remove('hidden');
    }, 2500);
  }

  function endSail() {
    $('postcard').classList.add('hidden');
    sail.phase = 'back';
    sail.timer = 0;
    if (sailView) tweenView(sailView.pos, sailView.target, 1.3);
    setTimeout(() => {
      world.setLimits(ISLAND_LIMITS.min, ISLAND_LIMITS.max, ISLAND_LIMITS.minP, ISLAND_LIMITS.maxP);
      sail.active = false;
      savedView = null;
    }, 1400);
  }

  function updateSail(dt) {
    if (!sail.active) return;
    sail.timer += dt;
    if (sail.phase === 'out') {
      sail.k = Math.min(1, sail.k + dt / 2.4);
    } else {
      sail.k = Math.max(0, sail.k - dt / 2.0);
    }
    const e = sail.k < 0.5
      ? 2 * sail.k * sail.k
      : 1 - Math.pow(-2 * sail.k + 2, 2) / 2;
    boat.position.x = boatBase.x + sail.dir.x * e * 8.5;
    boat.position.z = boatBase.z + sail.dir.z * e * 8.5;
    boat.rotation.y = boatYaw + e * 0.5;
    if (sail.phase === 'back' && sail.k <= 0) {
      boat.position.x = boatBase.x;
      boat.position.z = boatBase.z;
    }
  }

  $('pcClose').addEventListener('click', endSail);

  /* ------------------------------ diary --------------------------- */
  const diary = createDiary({
    mailbox: structures.mailbox,
    growth,
    growthStars: structures.growth.stars,
    atmosphere,
    toast,
    brandCount: $('brandCount'),
    onOpen: () => {
      hideTooltip();
      if (mode === 'interior') {
        tweenView(interior.BOOK_FOCUS.pos, interior.BOOK_FOCUS.target, 0.8);
      } else {
        setHoverId('mailbox', false);
        focusMailbox();
      }
    },
    onClose: () => {
      hideTooltip();
      if (mode === 'interior') tweenView(interior.CAM_POS, interior.TARGET, 0.9);
      else unfocus();
    },
  });

  /* --------------------- Life Journal (indoor) --------------------- */
  // The desk notebook inside the cottage. Completely separate from the
  // outdoor mailbox / memory diary: own module, own storage key
  // (tiny-island.journal.v1), own overlay DOM.
  const journal = createJournal({
    toast,
    onOpen: () => {
      hideTooltip();
      if (mode === 'interior') {
        tweenView(interior.BOOK_FOCUS.pos, interior.BOOK_FOCUS.target, 0.8);
      }
    },
    onClose: () => {
      hideTooltip();
      if (mode === 'interior') tweenView(interior.CAM_POS, interior.TARGET, 0.9);
    },
  });

  /* ---------------------- growth UI + milestone -------------------- */
  // The milestone card has no fullscreen backdrop: the terrain
  // expansion plays behind it and stays visible the whole time.
  // Milestones fire once — growth.js persists "shown" at trigger time,
  // so a refresh never replays them.
  function showGrowthMilestone(m) {
    // A milestone is reached *while saving inside the journal*. Gently
    // close it first so its fullscreen blur can't hide the island
    // expanding behind the card (the tween also eases back to the
    // full-island view). Only happens at the 4 milestone moments.
    if (diary.isOpen()) diary.close();
    if (journal.isOpen()) journal.close();
    const info = growth.milestoneInfo(m);
    $('msLevel').textContent = 'Lv.' + info.level + ' · ' + info.levelName;
    $('msText').textContent = info.text;
    $('msUnlock').textContent = info.unlockText;
    $('growthMilestone').classList.remove('hidden');
  }
  $('msContinue').addEventListener('click', () => {
    $('growthMilestone').classList.add('hidden');
  });
  $('msSkip').addEventListener('click', () => {
    growth.skipExpansion();
    $('growthMilestone').classList.add('hidden');
  });

  function updateGrowthUI() {
    const life = growth.lifetime();
    const info = growth.levelInfo();
    $('gbLevel').textContent = 'Lv.' + info.level;
    $('gbName').textContent = info.zh;
    $('gbCount').textContent = life + (life === 1 ? ' memory' : ' memories');
    $('gpLifetime').textContent = String(life);
    const prog = growth.progress();
    if (prog) {
      $('gpBar').style.width = prog.pct + '%';
      $('gpNext').textContent = `Next: ${prog.nextAt} memories → Lv.${prog.nextLevel} ${prog.nextZh}`;
    } else {
      $('gpBar').style.width = '100%';
      $('gpNext').textContent = '永恒之岛 — the island keeps every memory.';
    }
    $('gpUnlocks').innerHTML = growth.unlockList().map((u) =>
      `<div class="gp-unlock${u.unlocked ? ' on' : ''}">` +
      `<span class="gp-emoji">${u.emoji}</span>` +
      `<span class="gp-name"><b>${u.zh}</b> <i>${u.en}</i></span>` +
      `<span class="gp-state">${u.unlocked ? 'Unlocked' : u.at + ' memories'}</span>` +
      `</div>`
    ).join('');
  }

  $('growthBadge').addEventListener('click', () => {
    const p = $('growthPanel');
    p.hidden = !p.hidden;
    $('growthBadge').classList.toggle('open', !p.hidden);
    if (!p.hidden) updateGrowthUI();
  });
  growth.subscribe(updateGrowthUI);
  updateGrowthUI();

  /* ------------------------- profiles UI --------------------------- */
  // Local Profile System 1.0. Switching swaps localStorage snapshots
  // and reloads the page, so the whole scene is rebuilt from the
  // target profile's data — nothing from the previous island lingers.
  let pfDeletingId = null; // row currently showing the delete confirmation

  const pfEsc = (s) => String(s).replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
  function pfRel(t) {
    const d = Date.now() - t;
    if (d < 60000) return 'just now';
    if (d < 3600000) return Math.floor(d / 60000) + 'm ago';
    if (d < 86400000) return Math.floor(d / 3600000) + 'h ago';
    return Math.floor(d / 86400000) + 'd ago';
  }
  function pfGuardDiary() {
    if (journal.isOpen()) { toast('Close your Life Journal first.'); return true; }
    if (!diary.isOpen()) return false;
    toast('Save or close your journal first.');
    return true;
  }
  function enterProfile(id) {
    // Flush the journal BEFORE the snapshot swap (synchronous write), then
    // suspend its beforeunload flush so the outgoing profile's in-memory
    // state cannot leak into the target profile's live keys during reload.
    journal.flush();
    journal.suspend();
    const r = switchProfile(id);
    if (r.error) { journal.resume(); pfActionError(r.error); }
    return r;
  }
  function pfActionError(err) {
    const msg = {
      'last-profile': 'Keep at least one profile on the island.',
      'active-profile': 'Switch to another profile before deleting this one.',
      'unknown-profile': 'That profile no longer exists.',
      'profile-data-missing': 'That profile\'s data could not be found.',
      'profile-data-corrupt': 'That profile\'s data is unreadable.',
      'save-failed': 'Could not save to this browser. Your island was left unchanged.',
      'swap-verify-failed': 'Profile switch failed — your island was left unchanged.',
      'not-initialized': 'Profiles are not ready yet.',
    }[err] || 'Something went wrong.';
    toast(msg);
  }

  function renderProfiles() {
    const l = listProfiles();
    const cur = l.profiles.find((p) => p.id === l.activeId) || null;
    $('pfName').textContent = cur ? cur.name : 'Tiny Island';
    $('pfSub').textContent = l.profiles.length + (l.profiles.length === 1 ? ' profile' : ' profiles');

    $('profileList').innerHTML = l.profiles.map((p) => {
      const isCur = p.id === l.activeId;
      const confirming = p.id === pfDeletingId;
      let actions;
      if (confirming) {
        actions =
          `<button class="pf-btn ghost" data-pf-cancel="${p.id}" type="button">Cancel</button>` +
          `<button class="pf-btn confirm" data-pf-confirm="${p.id}" type="button">Delete?</button>`;
      } else {
        actions =
          (isCur
            ? `<button class="pf-btn" disabled type="button">Current</button>`
            : `<button class="pf-btn" data-pf-enter="${p.id}" type="button">Enter</button>`) +
          (l.profiles.length > 1 && !isCur
            ? `<button class="pf-btn danger" data-pf-del="${p.id}" type="button" title="Delete profile">Delete</button>`
            : '');
      }
      return (
        `<div class="pf-row${isCur ? ' current' : ''}">` +
        `<div class="pf-info">` +
        `<b>${pfEsc(p.name)}</b>` +
        (isCur ? `<i class="pf-now">playing now</i>` : `<i>played ${pfRel(p.lastUsedAt)}</i>`) +
        `</div>${actions}</div>`
      );
    }).join('');

    $('profileList').querySelectorAll('[data-pf-enter]').forEach((b) => {
      b.addEventListener('click', () => {
        if (pfGuardDiary()) return;
        enterProfile(b.dataset.pfEnter);
        // success → page reloads
      });
    });
    $('profileList').querySelectorAll('[data-pf-del]').forEach((b) => {
      b.addEventListener('click', () => {
        pfDeletingId = b.dataset.pfDel; // first tap: show the confirmation
        renderProfiles();
      });
    });
    $('profileList').querySelectorAll('[data-pf-cancel]').forEach((b) => {
      b.addEventListener('click', () => {
        pfDeletingId = null;
        renderProfiles();
      });
    });
    $('profileList').querySelectorAll('[data-pf-confirm]').forEach((b) => {
      b.addEventListener('click', () => {
        const r = deleteProfile(b.dataset.pfConfirm);
        if (r.error) { pfActionError(r.error); }
        else { pfDeletingId = null; toast(`The world "${r.name}" drifted away.`); }
        renderProfiles();
      });
    });
  }

  $('profileBadge').addEventListener('click', () => {
    const p = $('profilePanel');
    p.hidden = !p.hidden;
    $('profileBadge').classList.toggle('open', !p.hidden);
    if (!p.hidden) { pfDeletingId = null; renderProfiles(); }
  });
  $('pfCreate').addEventListener('click', () => {
    if (pfGuardDiary()) return;
    const r = createProfile($('pfNewName').value);
    if (r.error) { pfActionError(r.error); return; }
    $('pfNewName').value = '';
    enterProfile(r.id); // enter the new world immediately
  });
  $('pfNewName').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') $('pfCreate').click();
  });
  renderProfiles(); // badge label must be right even before the panel opens
  if (profileWarning) {
    toast('Could not save profile data to this browser. Check your storage settings.');
  }


  /* ------------------------------- UI ----------------------------- */
  const hint = $('hint');
  function updateHint() {
    if (mode === 'interior') {
      hint.innerHTML = 'Click the <b>journal</b> to write <i>·</i> Click the <b>door</b> to step outside';
      return;
    }
    const tool = decorations.getTool();
    if (tool === 'erase') {
      hint.innerHTML = '<b>Remove</b> <i>·</i> Click one of your decorations to take it away';
    } else if (tool) {
      hint.innerHTML = `<b>${TOOL_LABEL[tool]}</b> <i>·</i> Click the grass to place <i>·</i> Click the tool again to exit`;
    } else {
      hint.innerHTML = 'Drag to explore <i>·</i> Scroll to zoom <i>·</i> Click the <b>house</b>, <b>mailbox</b> or <b>boat</b>';
    }
  }

  function applyModeUI(m) {
    atmoBtns.forEach((x) => x.classList.toggle('active', x.dataset.atmo === m));
    document.body.dataset.atmo = m;
    interior.setNightTarget(atmosphere.nightLevel());
  }

  // Only real buttons — <body data-atmo> also matches the bare attribute
  // selector and would swallow every page click as "switch to Day".
  const atmoBtns = [...document.querySelectorAll('button[data-atmo]')];
  atmoBtns.forEach((b) => {
    b.addEventListener('click', async () => {
      hideTooltip();
      if (b.dataset.atmo === 'auto') {
        b.classList.add('busy');
        const info = await atmosphere.enableAuto(true);
        b.classList.remove('busy');
        if (atmosphere.getMode() !== 'auto') return; // user clicked away meanwhile
        applyModeUI('auto');
        if (info.source === 'geolocation') {
          toast('Auto atmosphere — following your local time.');
        } else {
          toast('Auto atmosphere — using a default location (geolocation unavailable).');
        }
      } else {
        const m = atmosphere.setMode(b.dataset.atmo);
        applyModeUI(m);
        document.body.classList.remove('auto-dark');
      }
    });
  });
  document.body.dataset.atmo = atmosphere.getMode();
  atmoBtns.forEach((x) => x.classList.toggle('active', x.dataset.atmo === atmosphere.getMode()));
  if (atmosphere.getMode() === 'auto') {
    interior.setNightTarget(atmosphere.nightLevel());
    atmosphere.tryRestoreAuto().then((info) => {
      applyModeUI('auto');
      if (info.source !== 'granted') {
        toast('Auto atmosphere — using a default location (geolocation unavailable).');
      }
    });
  }

  const toolBtns = [...document.querySelectorAll('[data-tool]')];
  toolBtns.forEach((b) => {
    b.addEventListener('click', () => {
      const t = decorations.setTool(b.dataset.tool);
      toolBtns.forEach((x) => x.classList.toggle('active', x.dataset.tool === t));
      updateHint();
      hideTooltip();
      clearHover();
      if (t === 'erase') toast('Click one of your own decorations to remove it.');
    });
  });

  $('resetDeco').addEventListener('click', () => {
    decorations.reset();
    hideTooltip();
    toast('Your decorations were cleared.');
  });
  $('resetView').addEventListener('click', () => {
    hideTooltip();
    tweenView(world.CAM_POS.clone(), world.TARGET.clone(), 1.1);
  });
  $('openJournal').addEventListener('click', () => diary.open());
  $('exitHome').addEventListener('click', exitHome);
  updateHint();

  /* first-visit welcome */
  setTimeout(() => {
    try {
      if (localStorage.getItem(WELCOME_KEY)) return;
      localStorage.setItem(WELCOME_KEY, '1');
    } catch (e) { /* private mode: just show it */ }
    const w = $('welcome');
    w.classList.add('show');
    setTimeout(() => w.classList.remove('show'), 5200);
  }, 900);

  /* -------------------------- interaction ------------------------- */
  const raycaster = new THREE.Raycaster();
  const ndc = new THREE.Vector2();
  const tooltip = $('tooltip');
  let down = null;

  const setNDC = (e) => {
    ndc.x = (e.clientX / window.innerWidth) * 2 - 1;
    ndc.y = -(e.clientY / window.innerHeight) * 2 + 1;
  };

  /* -------- island discovery points (hover glow + tooltip) -------- */
  const hoverables = [];
  function addHoverable(obj, id, label, scaleK = 0.045) {
    obj.userData.hoverId = id;
    obj.userData.hoverK = 0;
    obj.userData.hoverT = 0;
    obj.userData.baseScale = obj.scale.x;
    obj.userData.scaleK = scaleK; // dock origin sits at island center: no scale, tooltip only
    hoverables.push(obj);
  }
  addHoverable(house.group, 'home', 'Step inside');
  addHoverable(boat, 'dock', 'Set sail');
  addHoverable(structures.dock.group, 'dock', 'Set sail', 0);
  // mailbox keeps its own fine-grained bob; reuse setHover
  structures.mailbox.userData.hoverId = 'mailbox';

  let hoverId = null;
  const HOVER_LABEL = { home: 'Step inside', mailbox: 'Leave a memory', dock: 'Set sail' };
  function setHoverId(id, v) {
    if (id === 'mailbox') {
      structures.mailbox.userData.setHover(v);
      return;
    }
    for (const o of hoverables) {
      if (o.userData.hoverId === id) o.userData.hoverT = v ? 1 : 0;
    }
  }
  function clearHover() {
    if (hoverId) setHoverId(hoverId, false);
    hoverId = null;
    for (const o of hoverables) {
      if (o.userData.hoverId !== 'mailbox') o.userData.hoverT = 0;
    }
    structures.mailbox.userData.setHover(false);
    interior.interactives.forEach((g) => { g.userData.hoverT = 0; });
    canvas.style.cursor = 'grab';
  }

  function updateHoverables(dt) {
    for (const o of hoverables) {
      const u = o.userData;
      u.hoverK += (u.hoverT - u.hoverK) * Math.min(1, dt * 9);
      const s = u.baseScale * (1 + u.hoverK * u.scaleK);
      o.scale.setScalar(s);
    }
  }

  function showTooltip(text, x, y) {
    tooltip.textContent = text;
    tooltip.style.left = (x + 15) + 'px';
    tooltip.style.top = (y + 15) + 'px';
    tooltip.classList.add('show');
  }
  const hideTooltip = () => tooltip.classList.remove('show');

  const INTERIOR_LABEL = { book: 'Open Life Journal', window: 'Look outside', lamp: 'Toggle the lamp', door: 'Leave home' };

  canvas.addEventListener('pointerdown', (e) => {
    down = { x: e.clientX, y: e.clientY, t: performance.now() };
    world.controls.autoRotate = false;
  });

  canvas.addEventListener('pointerup', (e) => {
    if (!down) return;
    const dist = Math.hypot(e.clientX - down.x, e.clientY - down.y);
    const quick = performance.now() - down.t < 600;
    down = null;
    if (dist > 6 || !quick || e.target !== canvas || diary.isOpen()) return;
    setNDC(e);
    handleClick();
  });

  canvas.addEventListener('pointermove', (e) => {
    setNDC(e);
    if (diary.isOpen() || busy) { hideTooltip(); return; }
    decorations.updatePointer(ndc, world.camera);

    if (mode === 'interior') {
      raycaster.setFromCamera(ndc, world.camera);
      const hits = raycaster.intersectObjects(interior.interactives, true);
      canvas.style.cursor = hits.length ? 'pointer' : 'grab';
      interior.interactives.forEach((g) => { g.userData.hoverT = 0; });
      if (hits.length) {
        let g = hits[0].object;
        while (g && !g.userData.interactive) g = g.parent;
        if (g) {
          g.userData.hoverT = 1;
          showTooltip(INTERIOR_LABEL[g.userData.interactive] || 'Interact', e.clientX, e.clientY);
        } else hideTooltip();
      } else hideTooltip();
      return;
    }

    const tool = decorations.getTool();
    if (tool) {
      canvas.style.cursor = 'crosshair';
      clearHover();
      if (tool === 'erase') {
        if (decorations.getHoverId()) showTooltip('Click to remove', e.clientX, e.clientY);
        else hideTooltip();
      } else {
        showTooltip('Click to place', e.clientX, e.clientY);
      }
      return;
    }

    // island: discovery points + mailbox
    raycaster.setFromCamera(ndc, world.camera);
    const ids = ['home', 'mailbox', 'dock'];
    let found = null;
    if (!sail.active) {
      if (raycaster.intersectObject(structures.mailbox, true).length) found = 'mailbox';
      else if (raycaster.intersectObject(house.group, true).length) found = 'home';
      else if (raycaster.intersectObject(boat, true).length
            || raycaster.intersectObject(structures.dock.group, true).length) found = 'dock';
    }
    canvas.style.cursor = found ? 'pointer' : 'grab';
    ids.forEach((id) => setHoverId(id, id === found && id !== 'mailbox'));
    if (found) {
      hoverId = found;
      showTooltip(HOVER_LABEL[found], e.clientX, e.clientY);
    } else {
      hoverId = null;
      hideTooltip();
    }
  });

  canvas.addEventListener('pointerleave', () => {
    hideTooltip();
    clearHover();
  });

  function handleClick() {
    if (busy || sail.active) return;

    if (mode === 'interior') {
      raycaster.setFromCamera(ndc, world.camera);
      const hits = raycaster.intersectObjects(interior.interactives, true);
      if (!hits.length) return;
      let g = hits[0].object;
      while (g && !g.userData.interactive) g = g.parent;
      if (!g) return;
      const id = g.userData.interactive;
      if (id === 'book') journal.open();
      else if (id === 'lamp') {
        const on = interior.toggleLamp();
        toast(on ? 'The lamp warms the room.' : 'The room rests in twilight.');
      } else if (id === 'window') {
        tweenView(interior.WINDOW_FOCUS.pos, interior.WINDOW_FOCUS.target, 1.0);
        toast('The sea looks calm today.');
      } else if (id === 'door') exitHome();
      return;
    }

    const res = decorations.handleClick(ndc, world.camera);
    if (res !== null) {
      if (res === 'placed') toast('Placed on your island.');
      else if (res === 'invalid') toast('Not here — try open grass, away from the house.');
      else if (res === 'removed') toast('Decoration removed.');
      else if (res === 'erase-empty') toast('Click one of your own decorations.');
      return;
    }
    raycaster.setFromCamera(ndc, world.camera);
    if (raycaster.intersectObject(structures.mailbox, true).length) { diary.open(); return; }
    if (raycaster.intersectObject(house.group, true).length) { enterHome(); return; }
    if (raycaster.intersectObject(boat, true).length
     || raycaster.intersectObject(structures.dock.group, true).length) setSail();
  }

  window.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    if (journal.isOpen()) journal.close();
    else if (diary.isOpen()) diary.close();
    else if (mode === 'interior') exitHome();
  });

  window.addEventListener('resize', () => world.resize());

  /* ---------------------------- loop ------------------------------ */
  let last = performance.now();
  function loop(now) {
    requestAnimationFrame(loop);
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    const t = now / 1000;

    world.update(t, dt);
    atmosphere.update(dt);
    // Auto mode: keep interior night level & brand contrast in sync.
    if (atmosphere.getMode() === 'auto') {
      const nl = atmosphere.nightLevel();
      interior.setNightTarget(nl);
      document.body.classList.toggle('auto-dark', nl > 0.5);
    }
    house.group.userData.update(t);
    structures.mailbox.userData.update(t, dt);
    boat.userData.update(t);
    updateSail(dt);
    updateHoverables(dt);
    interior.update(t, dt);
    diary.update(t);
    growth.update(dt, t);
    growth.setNightLevel(atmosphere.nightLevel());
    // keep the ocean surf ring glued to the growing shoreline
    world.oceanUniforms.uShore.value = growth.shoreRadius();
    updateViewTween(dt);
    world.controls.update();
    renderPortal();
    world.render();
  }
  requestAnimationFrame(loop);

  setTimeout(() => $('loading').classList.add('hidden'), 420);
  window.__tinyIsland = { world, island, house, structures, interior, atmosphere, decorations, diary, growth, journal,
    profiles: { list: listProfiles } };
}

try {
  boot();
} catch (err) {
  console.error('[Tiny Island] startup failed:', err);
  const el = $('loading');
  if (el) {
    el.innerHTML = '<div class="load-error"><strong>The island could not be built.</strong>' +
      '<span>Your browser may not support WebGL. Try Chrome or Edge.</span></div>';
    el.classList.remove('hidden');
  }
}
