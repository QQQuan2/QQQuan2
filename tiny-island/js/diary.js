import * as THREE from 'three';
import {
  readJSON, writeJSON, geo, mesh, emissive, glowTexture, TAU,
} from './utils.js';
import { surfaceHeight } from './island.js';

/* ------------------------------------------------------------------ *
 * "Leave a Memory" — a real journal backed by localStorage.
 * Saving it also grows the island and lights up the mailbox.
 * V2.3: mood filter, custom moods (with emoji), persistence.
 * V2.4: edit window (direct rewrite while fresh), revision history
 *       (old words are struck through, never erased) after the window.
 * V2.5: Memory Journal 2.0 — physical paper aesthetic. Editor is a clean
 *       sheet of paper, notes become paper scraps (with a three-dot menu,
 *       real timestamps and occasional washi tape), settings live behind
 *       a small gear, and revisions look like pen strokes over old ink.
 *       Purely visual: data structures are untouched.
 * ------------------------------------------------------------------ */

const KEY = 'tiny-island.memories.v1';
const MOOD_KEY = 'tiny-island.moods.v1';
const SETTINGS_KEY = 'tiny-island.diarySettings.v1';
const DEFAULT_WINDOW = 15;          // minutes a fresh note may be rewritten
const WINDOW_CHOICES = [5, 15, 30, 60];
const NAME_MAX = 16;
const SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">';
const MOOD_SVG = {
  happy: SVG + '<circle cx="12" cy="12" r="8.5"/><path d="M8.4 14.2c1 1.5 2.2 2.2 3.6 2.2s2.6-.7 3.6-2.2"/><circle cx="9.2" cy="10" r=".9" fill="currentColor" stroke="none"/><circle cx="14.8" cy="10" r=".9" fill="currentColor" stroke="none"/></svg>',
  calm: SVG + '<path d="M2.5 9.5c2-2 3.6-2 5.6 0s3.6 2 5.6 0 3.6-2 5.6 0"/><path d="M2.5 14.5c2-2 3.6-2 5.6 0s3.6 2 5.6 0 3.6-2 5.6 0"/></svg>',
  sad: SVG + '<circle cx="12" cy="12" r="8.5"/><path d="M8.4 15.8c1-1.5 2.2-2.2 3.6-2.2s2.6.7 3.6 2.2"/><circle cx="9.2" cy="10" r=".9" fill="currentColor" stroke="none"/><circle cx="14.8" cy="10" r=".9" fill="currentColor" stroke="none"/></svg>',
  hopeful: SVG + '<path d="M12 21V9"/><path d="M12 12.5C9 12.5 7 10.5 7 7.5c3 0 5 2 5 5Z"/><path d="M12 15c0-3 2-5 5-5 0 3-2 5-5 5Z"/><path d="M7 21h10"/></svg>',
  tired: SVG + '<path d="M20.2 15.4A8.2 8.2 0 0 1 8.6 3.8 8.2 8.2 0 1 0 20.2 15.4Z"/><path d="M14 7.5h4l-4 4.5h4"/></svg>',
};
const MOODS = [
  { id: 'happy', label: 'Happy' },
  { id: 'calm', label: 'Calm' },
  { id: 'sad', label: 'Sad' },
  { id: 'hopeful', label: 'Hopeful' },
  { id: 'tired', label: 'Tired' },
];
const QUICK_EMOJIS = ['😊', '🥰', '🤩', '😴', '🌙', '🍀', '🌀', '⭐', '🔥', '🌧️', '🕰️', '🫶'];

const escapeHtml = (s) => String(s).replace(/[&<>"']/g, (c) =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

function prettyDate(d) {
  return d.toLocaleDateString('en-US', {
    weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
  });
}

/* Small deterministic helpers for the paper-scrap look: every note keeps
 * the same tint / tape across renders (seeded by its id), so the page
 * never reshuffles itself. */
function hashStr(s) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h;
}

function noteTime(d) {
  if (!d || Number.isNaN(d.getTime())) return '';
  return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
}

/* On a narrow paper scrap the full "Tuesday, November 24, 2026" gets
 * clipped next to the mood label — a short stamped date reads better.
 * Data itself is untouched; legacy notes without iso keep their own date. */
function noteDateLabel(e) {
  const d = new Date(e.iso);
  if (!Number.isNaN(d.getTime())) {
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  }
  return e.date || '';
}

function loadCustomMoods() {
  const raw = readJSON(MOOD_KEY, []);
  if (!Array.isArray(raw)) return [];
  return raw.filter((m) => m && typeof m.id === 'string'
    && typeof m.name === 'string' && m.name.trim()
    && typeof m.emoji === 'string' && m.emoji.trim());
}

export function createDiary(refs) {
  const $ = (id) => document.getElementById(id);
  const overlay = $('diaryOverlay');
  const closeBtn = $('diaryClose');
  const dateEl = $('diaryDate');
  const moodRow = $('moodRow');
  const textEl = $('diaryText');
  const saveBtn = $('diarySave');
  const countEl = $('diaryCount');
  const listEl = $('diaryList');
  const filterEl = $('moodFilter');
  const statusEl = $('diaryFilterStatus');
  const moodModal = $('moodModal');
  const nameInput = $('moodNameInput');
  const emojiInput = $('moodEmojiInput');
  const nameErr = $('moodNameErr');
  const emojiErr = $('moodEmojiErr');
  const emojiQuick = $('emojiQuick');
  const customWrap = $('moodCustomWrap');
  const customList = $('moodCustomList');
  const banner = $('editBanner');
  const cancelBtn = $('diaryCancelEdit');
  const saveLabel = $('diarySaveLabel');
  const ewChips = $('ewChips');
  const ewCustom = $('ewCustom');
  const settingsBtn = $('diarySettingsBtn');
  const settingsPanel = $('diarySettingsPanel');

  let entries = readJSON(KEY, []);
  if (!Array.isArray(entries)) entries = [];
  entries = entries.filter((e) => e && typeof e.text === 'string' && typeof e.id === 'string');

  let customMoods = loadCustomMoods();
  let mood = 'calm';
  let moodFilter = 'all';
  let isOpen = false;
  let modalOpen = false;
  let confirmDelId = null;
  let editingId = null;              // entry currently loaded into the editor
  const expandedIds = new Set();     // cards with full revision history unfolded

  /* --------------------- edit window settings --------------------- */
  // Only stamps future notes; each note keeps the window it was born with.
  let settings = readJSON(SETTINGS_KEY, {});
  if (!settings || typeof settings !== 'object' || Array.isArray(settings)) settings = {};
  let editWindowMinutes = Number(settings.editWindowMinutes);
  if (!Number.isInteger(editWindowMinutes)
    || editWindowMinutes < 1 || editWindowMinutes > 1440) editWindowMinutes = DEFAULT_WINDOW;

  const starMat = emissive('#ffe2a4', 1.9);
  const spriteBase = new THREE.SpriteMaterial({
    map: glowTexture(), color: '#ffcf85', transparent: true,
    opacity: 0.7, depthWrite: false, blending: THREE.AdditiveBlending,
  });

  /* ------------------------- mood registry ------------------------ */
  const saveMoods = () => writeJSON(MOOD_KEY, customMoods);
  const allMoods = () => [
    ...MOODS,
    ...customMoods.map((m) => ({ id: m.id, label: m.name, emoji: m.emoji })),
  ];

  function moodInfo(id) {
    const def = MOODS.find((m) => m.id === id);
    if (def) return { id, label: def.label, emoji: '' };
    const cm = customMoods.find((m) => m.id === id);
    if (cm) return { id, label: cm.name, emoji: cm.emoji };
    return null;
  }

  function moodIcon(m) {
    if (m.id === 'all') return '<span class="mood-ico all-ico">✦</span>';
    return m.emoji
      ? `<span class="mood-emoji">${escapeHtml(m.emoji)}</span>`
      : `<span class="mood-ico">${MOOD_SVG[m.id] || MOOD_SVG.calm}</span>`;
  }

  /* Resolve how an entry's mood is displayed. Entries written with a
   * custom mood carry a name/emoji snapshot so deleting the mood never
   * breaks old records; entries written before V2.3 keep working by id. */
  function entryMoodView(e) {
    if (typeof e.moodName === 'string' && e.moodName) {
      return {
        label: e.moodName,
        icon: `<span class="mood-emoji">${escapeHtml(e.moodEmoji || '✦')}</span>`,
      };
    }
    const m = moodInfo(e.mood);
    if (m) return { label: m.label, icon: moodIcon(m) };
    return { label: 'Calm', icon: `<span class="mood-ico">${MOOD_SVG.calm}</span>` };
  }

  /* ----------------------- editor mood chips ---------------------- */
  function renderMoodRow() {
    moodRow.innerHTML = allMoods().map((m) =>
      `<button type="button" class="mood${m.id === mood ? ' active' : ''}" data-mood="${escapeHtml(m.id)}">
         ${moodIcon(m)}<span>${escapeHtml(m.label)}</span>
       </button>`
    ).join('')
    + '<button type="button" class="mood mood-add" data-action="add-mood">'
    + '<span class="mood-ico add-ico">＋</span><span>Add Mood</span></button>';
  }

  function selectMood(m) {
    mood = m;
    moodRow.querySelectorAll('.mood').forEach((b) =>
      b.classList.toggle('active', b.dataset.mood === m));
  }

  moodRow.addEventListener('click', (e) => {
    const b = e.target.closest('.mood');
    if (!b) return;
    if (b.dataset.action === 'add-mood') { openMoodModal(); return; }
    selectMood(b.dataset.mood);
  });

  /* ------------------------- mood modal --------------------------- */
  let pickedEmoji = '';

  function renderQuick() {
    emojiQuick.innerHTML = QUICK_EMOJIS.map((e) =>
      `<button type="button" class="emoji-pick${e === pickedEmoji ? ' active' : ''}" data-emoji="${e}">${e}</button>`
    ).join('');
  }

  function openMoodModal() {
    modalOpen = true;
    confirmDelId = null;
    pickedEmoji = '';
    nameInput.value = '';
    emojiInput.value = '';
    nameErr.hidden = true;
    emojiErr.hidden = true;
    renderQuick();
    renderCustomList();
    moodModal.classList.remove('hidden');
    setTimeout(() => { try { nameInput.focus(); } catch (e2) {} }, 120);
  }

  function closeMoodModal() {
    if (!modalOpen) return;
    modalOpen = false;
    moodModal.classList.add('hidden');
  }

  function showErr(el, msg) {
    el.textContent = msg;
    el.hidden = false;
  }

  emojiQuick.addEventListener('click', (e) => {
    const b = e.target.closest('.emoji-pick');
    if (!b) return;
    pickedEmoji = b.dataset.emoji;
    emojiInput.value = pickedEmoji;
    emojiErr.hidden = true;
    renderQuick();
  });

  emojiInput.addEventListener('input', () => {
    pickedEmoji = emojiInput.value.trim();
    emojiErr.hidden = true;
    renderQuick();
  });

  function renderCustomList() {
    if (!customMoods.length) { customWrap.hidden = true; return; }
    customWrap.hidden = false;
    customList.innerHTML = customMoods.map((m) => {
      if (m.id === confirmDelId) {
        return `<div class="mood-custom-item confirming" data-id="${escapeHtml(m.id)}">
           <span class="mood-confirm-text">Delete ${escapeHtml(m.emoji)} ${escapeHtml(m.name)}? Old memories keep it.</span>
           <button type="button" class="mc-btn mc-yes" data-action="del-yes">Delete</button>
           <button type="button" class="mc-btn mc-no" data-action="del-no">Keep</button>
         </div>`;
      }
      return `<div class="mood-custom-item" data-id="${escapeHtml(m.id)}">
         <span class="mc-emoji">${escapeHtml(m.emoji)}</span>
         <span class="mc-name">${escapeHtml(m.name)}</span>
         <button type="button" class="mc-del" data-action="del-ask" title="Delete this mood" aria-label="Delete mood">
           <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M4 7h16M9 7V5h6v2M6 7l1 13h10l1-13M10 11v6M14 11v6"/></svg>
         </button>
       </div>`;
    }).join('');
  }

  customList.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-action]');
    if (!btn) return;
    const item = btn.closest('.mood-custom-item');
    const id = item ? item.dataset.id : null;
    const act = btn.dataset.action;
    if (act === 'del-ask') {
      confirmDelId = id;
      renderCustomList();
    } else if (act === 'del-no') {
      confirmDelId = null;
      renderCustomList();
    } else if (act === 'del-yes') {
      const gone = customMoods.find((x) => x.id === id);
      customMoods = customMoods.filter((x) => x.id !== id);
      saveMoods();
      confirmDelId = null;
      if (mood === id) mood = 'calm';
      if (moodFilter === id) moodFilter = 'all';
      renderMoodRow();
      renderFilter();
      renderList();
      renderCustomList();
      refs.toast(gone ? `${gone.emoji} ${gone.name} removed — old memories keep it.` : 'Mood removed.');
    }
  });

  function addCustomMood() {
    const name = nameInput.value.trim();
    if (!name) { showErr(nameErr, 'Give the feeling a name first.'); nameInput.focus(); return; }
    if (name.length > NAME_MAX) { showErr(nameErr, `Keep the name within ${NAME_MAX} characters.`); return; }
    if (allMoods().some((m) => m.label.toLowerCase() === name.toLowerCase())) {
      showErr(nameErr, 'That mood already exists.');
      return;
    }
    const emoji = (emojiInput.value || pickedEmoji || '').trim();
    if (!emoji) { showErr(emojiErr, 'Pick or paste an emoji for it.'); emojiInput.focus(); return; }
    const cm = {
      id: 'u' + Date.now().toString(36) + Math.floor(Math.random() * 997),
      name: name.slice(0, NAME_MAX),
      emoji: [...emoji].slice(0, 3).join(''),
      createdAt: new Date().toISOString(),
    };
    customMoods.push(cm);
    if (!saveMoods()) {
      customMoods.pop();
      refs.toast('Storage is unavailable — could not save.');
      return;
    }
    renderMoodRow();
    renderFilter();
    selectMood(cm.id);
    closeMoodModal();
    refs.toast(`New feeling added: ${cm.emoji} ${cm.name}`);
  }

  $('moodAdd').addEventListener('click', addCustomMood);
  $('moodCancel').addEventListener('click', closeMoodModal);
  $('moodModalClose').addEventListener('click', closeMoodModal);
  moodModal.addEventListener('click', (e) => { if (e.target === moodModal) closeMoodModal(); });
  nameInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') addCustomMood(); });

  /* ------------------ edit window (V2.4) -------------------------- */
  // Judged from the note's real creation timestamp — never from a
  // page-lifetime timer, so refreshes and reopenings stay accurate.
  function withinWindow(e) {
    const w = Number.isFinite(e.editWindowMinutes) ? e.editWindowMinutes : DEFAULT_WINDOW;
    const created = Date.parse(e.iso);
    if (!Number.isFinite(created)) return true;
    return Date.now() - created <= w * 60000;
  }

  function saveSettings() {
    settings.editWindowMinutes = editWindowMinutes;
    return writeJSON(SETTINGS_KEY, settings);
  }

  function renderEditWindow() {
    ewChips.innerHTML = WINDOW_CHOICES.map((v) =>
      `<button type="button" class="ew-chip${editWindowMinutes === v ? ' active' : ''}" data-ew="${v}">${v} min</button>`
    ).join('');
    const isPreset = WINDOW_CHOICES.includes(editWindowMinutes);
    ewCustom.value = isPreset ? '' : String(editWindowMinutes);
  }

  ewChips.addEventListener('click', (e) => {
    const b = e.target.closest('.ew-chip');
    if (!b) return;
    editWindowMinutes = parseInt(b.dataset.ew, 10);
    if (!saveSettings()) { refs.toast('Storage is unavailable — could not save.'); return; }
    renderEditWindow();
    refs.toast(`New notes can be rewritten freely for ${editWindowMinutes} minutes.`);
  });

  ewCustom.addEventListener('change', () => {
    const v = Math.round(Number(ewCustom.value));
    if (!Number.isFinite(v) || v < 1 || v > 1440) {
      renderEditWindow();
      refs.toast('Custom window must be between 1 and 1440 minutes.');
      return;
    }
    editWindowMinutes = v;
    if (!saveSettings()) { refs.toast('Storage is unavailable — could not save.'); return; }
    renderEditWindow();
    refs.toast(`New notes can be rewritten freely for ${v} minutes.`);
  });

  /* ---------------------- history + filter ------------------------ */
  function renderFilter() {
    const counts = {};
    for (const e of entries) counts[e.mood] = (counts[e.mood] || 0) + 1;
    const chips = [
      { id: 'all', label: 'All', emoji: '', count: entries.length },
      ...allMoods().map((m) => ({ ...m, count: counts[m.id] || 0 })),
    ];
    filterEl.innerHTML = chips.map((m) =>
      `<button type="button" class="fchip${m.id === moodFilter ? ' active' : ''}" data-mood="${escapeHtml(m.id)}">
         ${moodIcon(m)}<span>${escapeHtml(m.label)}</span><i class="f-count">${m.count}</i>
       </button>`
    ).join('');
  }

  filterEl.addEventListener('click', (e) => {
    const b = e.target.closest('.fchip');
    if (!b) return;
    moodFilter = b.dataset.mood;
    renderFilter();
    renderList();
  });

  function revTime(iso) {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '';
    return d.toLocaleString('en-US', {
      month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
    });
  }

  /* Handwritten-revision look: old words struck through above the new
   * ones, each with the moment it was crossed out. Collapsed by default
   * to the latest strike; the history link unfolds everything. */
  function revisionBlock(e) {
    const revs = Array.isArray(e.revisions) ? e.revisions : [];
    if (!revs.length) return '';
    const expanded = expandedIds.has(e.id);
    const shown = expanded ? revs : revs.slice(-1);
    const strikes = shown.map((r) => {
      // A single short line gets a hand-drawn SVG pen stroke; wrapped or
      // long text falls back to a plain quiet line-through so every line
      // of the old words stays visibly crossed out.
      const oneLine = typeof r.content === 'string'
        && r.content.length <= 64 && !r.content.includes('\n');
      return `<div class="mi-old"><span class="mi-strike${oneLine ? ' hand' : ''}">${escapeHtml(r.content)}</span>`
      + `<span class="mi-rev-time">crossed out ${escapeHtml(revTime(r.revisedAt))}</span></div>`;
    }).join('');
    return strikes
      + `<button type="button" class="mi-history" data-action="history">`
      + (expanded
        ? 'Hide revision history'
        : `View revision history (${revs.length})`)
      + '</button>';
  }

  function renderList() {
    if (moodFilter !== 'all' && !moodInfo(moodFilter)) moodFilter = 'all';
    const total = entries.length;
    if (!total) {
      moodFilter = 'all';
      renderFilter();
      countEl.textContent = '0';
      statusEl.hidden = true;
      listEl.innerHTML = '<div class="diary-empty">No memories yet. Your island is waiting for the first one.</div>';
      return;
    }
    const filtered = moodFilter === 'all'
      ? entries
      : entries.filter((e) => e.mood === moodFilter);
    countEl.textContent = String(filtered.length);
    if (moodFilter === 'all') {
      statusEl.hidden = true;
    } else {
      const m = moodInfo(moodFilter);
      statusEl.textContent = `Showing ${filtered.length} of ${total} — feeling ${m ? m.label : ''}`;
      statusEl.hidden = false;
    }
    if (!filtered.length) {
      listEl.innerHTML = '<div class="diary-empty">No memories carry this feeling yet.<br>Some days are still waiting to be written.</div>';
      return;
    }
    /* Each memory is a paper scrap: tint and tape are seeded from the id
     * so they stay stable between renders; actions hide in a small
     * three-dot menu so the words stay the loudest thing on the page. */
    listEl.innerHTML = [...filtered].reverse().map((e) => {
      const mv = entryMoodView(e);
      const history = revisionBlock(e);
      const currentNote = e.revisedAt
        ? `<div class="mi-current">${escapeHtml(e.text)}<span class="mi-rev-time">latest &middot; ${escapeHtml(revTime(e.revisedAt))}</span></div>`
        : `<div class="mi-current">${escapeHtml(e.text)}</div>`;
      const h = hashStr(e.id);
      const taped = h % 4 === 1;
      const when = noteTime(new Date(e.iso));
      return `<div class="memory-item v${h % 3}${taped ? ' has-tape' : ''}" data-id="${escapeHtml(e.id)}">
         ${taped ? '<span class="mi-tape" aria-hidden="true"></span>' : ''}
         <div class="mi-top">
           <span class="mi-mood">${mv.icon}</span>
           <span class="mi-mood-tag">${escapeHtml(mv.label)}</span>
           <span class="mi-date">${escapeHtml(noteDateLabel(e))}${when ? ' &middot; ' + escapeHtml(when) : ''}</span>
           <div class="mi-menu">
             <button type="button" class="mi-dots" data-action="menu" title="More" aria-label="More actions">
               <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><circle cx="5" cy="12" r="1.7"/><circle cx="12" cy="12" r="1.7"/><circle cx="19" cy="12" r="1.7"/></svg>
             </button>
             <div class="mi-menu-pop" hidden>
               <button type="button" data-menu-action="edit">Edit</button>
               <button type="button" data-menu-action="delete">Delete</button>
             </div>
           </div>
         </div>
         <div class="mi-text">${history}${currentNote}</div>
       </div>`;
    }).join('');
  }

  listEl.addEventListener('click', (e) => {
    const openPop = listEl.querySelector('.mi-menu-pop:not([hidden])');
    const dots = e.target.closest('.mi-dots');
    if (dots) {
      const pop = dots.parentElement.querySelector('.mi-menu-pop');
      const willOpen = pop.hidden;
      if (openPop) openPop.hidden = true;
      pop.hidden = !willOpen;
      return;
    }
    const act = e.target.closest('[data-menu-action]');
    if (act) {
      if (openPop) openPop.hidden = true;
      const item = act.closest('.memory-item');
      if (!item) return;
      if (act.dataset.menuAction === 'edit') { beginEdit(item.dataset.id); return; }
      if (editingId === item.dataset.id) cancelEdit();
      entries = entries.filter((x) => x.id !== item.dataset.id);
      writeJSON(KEY, entries);
      renderList();
      applyGrowth();
      refs.toast('Memory released.');
      return;
    }
    if (openPop) openPop.hidden = true;
    const hist = e.target.closest('[data-action="history"]');
    if (hist) {
      const item = hist.closest('.memory-item');
      if (!item) return;
      const id = item.dataset.id;
      if (expandedIds.has(id)) expandedIds.delete(id);
      else expandedIds.add(id);
      renderList();
      return;
    }
  });

  /* --------------------------- growth ---------------------------- */
  function rebuildStars(n) {
    const holder = refs.growthStars;
    holder.clear();
    const show = Math.min(n, 14);
    for (let i = 0; i < show; i++) {
      const st = new THREE.Group();
      st.add(mesh(geo('d-starCore', () => new THREE.OctahedronGeometry(0.105, 0)),
        starMat, { cast: false }));
      const sp = new THREE.Sprite(spriteBase.clone());
      sp.scale.set(0.8, 0.8, 1);
      st.add(sp);
      const a = i * 2.399 + 0.7;
      const r = 1.0 + (i % 4) * 0.42;
      const x = refs.mailbox.position.x + Math.cos(a) * r;
      const z = refs.mailbox.position.z + Math.sin(a) * r;
      const y = surfaceHeight(x, z) + 1.5 + (i % 3) * 0.36;
      st.position.set(x, y, z);
      st.userData = { baseY: y, phase: i * 1.31 };
      holder.add(st);
    }
  }

  function applyGrowth() {
    const n = entries.length;
    // Lifetime (total memories ever kept) drives the stars and the
    // mailbox glow — deleting notes never dims the island. brandCount
    // keeps showing the number of notes currently kept.
    const life = refs.growth ? refs.growth.lifetime() : n;
    refs.atmosphere.setGrowth({
      window: n >= 5 ? 0.85 : n >= 1 ? 0.5 : 0,
      mailbox: n >= 1 ? 0.45 : 0,
    });
    refs.mailbox.userData.glow = Math.min(1, life / 5);
    rebuildStars(life);
    if (refs.brandCount) refs.brandCount.textContent = String(n);
  }

  /* ---------------------------- actions -------------------------- */
  function beginEdit(id) {
    const e = entries.find((x) => x.id === id);
    if (!e) return;
    editingId = id;
    textEl.value = e.text;
    selectMood(allMoods().some((m) => m.id === e.mood) ? e.mood : 'calm');
    banner.textContent = withinWindow(e)
      ? 'This note is still fresh — saving replaces the words outright.'
      : 'This memory has settled — saving will strike through the old words and keep them above the new ones.';
    banner.hidden = false;
    cancelBtn.hidden = false;
    saveLabel.textContent = 'Save Changes';
    renderList();
    textEl.focus();
    try { textEl.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); } catch (e2) {}
  }

  function cancelEdit() {
    if (!editingId) return;
    editingId = null;
    textEl.value = '';
    selectMood('calm');
    banner.hidden = true;
    cancelBtn.hidden = true;
    saveLabel.textContent = 'Save Memory';
    renderList();
  }

  function save() {
    const text = textEl.value.trim();
    if (!text) {
      refs.toast('Write a little something first.');
      textEl.focus();
      return;
    }
    if (editingId) { saveEdit(text); return; }
    const d = new Date();
    const m = moodInfo(mood);
    const entry = {
      id: 'm' + Date.now().toString(36) + Math.floor(Math.random() * 997),
      date: prettyDate(d),
      iso: d.toISOString(),
      mood,
      text: text.slice(0, 1500),
      editWindowMinutes,          // stamped at birth; setting changes later never move it
      revisions: [],
    };
    // Snapshot custom moods onto the entry so deleting the mood later
    // never erases the feeling from old records. Default moods keep
    // working by stable id, as they always have.
    if (m && m.emoji) {
      entry.moodName = m.label;
      entry.moodEmoji = m.emoji;
    }
    entries.push(entry);
    if (!writeJSON(KEY, entries)) {
      entries.pop();
      refs.toast('Storage is unavailable — could not save.');
      return;
    }
    textEl.value = '';
    moodFilter = 'all';
    renderFilter();
    renderList();
    // Only a brand-new memory counts toward island growth — edits,
    // revisions, mood changes and deletes never do. growth.js is
    // idempotent per entry id, so this is safe to call on every save.
    if (refs.growth) refs.growth.onMemoryCreated(entry.id);
    applyGrowth();
    refs.mailbox.userData.flash = 1;
    refs.toast('A memory was kept on your island.');
  }

  /* Editing an existing note. Inside the window the words are replaced
   * outright; past it the old text is archived into revisions — nothing
   * is mutated until the storage write actually succeeds. */
  function saveEdit(text) {
    const e = entries.find((x) => x.id === editingId);
    if (!e) { cancelEdit(); return; }
    const now = new Date();
    const inWindow = withinWindow(e);
    const prev = {
      text: e.text,
      mood: e.mood,
      moodName: e.moodName,
      moodEmoji: e.moodEmoji,
      updatedAt: e.updatedAt,
      revisedAt: e.revisedAt,
      revisions: Array.isArray(e.revisions) ? e.revisions.map((r) => ({ ...r })) : e.revisions,
    };
    // Metadata (mood) always updates directly — never a content revision,
    // and it never resets the edit window.
    const m = moodInfo(mood);
    e.mood = mood;
    if (m && m.emoji) {
      e.moodName = m.label;
      e.moodEmoji = m.emoji;
    } else {
      delete e.moodName;
      delete e.moodEmoji;
    }
    const textChanged = text !== e.text;
    if (textChanged) {
      e.text = text.slice(0, 1500);
      e.updatedAt = now.toISOString();
      if (!inWindow) {
        if (!Array.isArray(e.revisions)) e.revisions = [];
        e.revisions.push({ content: prev.text, revisedAt: e.updatedAt });
        e.revisedAt = e.updatedAt;
      }
    }
    if (!writeJSON(KEY, entries)) {
      e.text = prev.text;
      e.mood = prev.mood;
      if (prev.moodName === undefined) delete e.moodName; else e.moodName = prev.moodName;
      if (prev.moodEmoji === undefined) delete e.moodEmoji; else e.moodEmoji = prev.moodEmoji;
      e.updatedAt = prev.updatedAt;
      e.revisedAt = prev.revisedAt;
      e.revisions = prev.revisions;
      refs.toast('Storage is unavailable — nothing was changed.');
      return;
    }
    const keptHistory = !inWindow && textChanged;
    cancelEdit();
    refs.mailbox.userData.flash = 0.6;
    refs.toast(keptHistory
      ? 'The old words were kept — a new line was written above them.'
      : 'The memory was rewritten.');
  }

  function open() {
    if (isOpen) return;
    isOpen = true;
    dateEl.textContent = prettyDate(new Date());
    overlay.classList.remove('hidden');
    if (refs.onOpen) refs.onOpen();
    setTimeout(() => { try { textEl.focus(); } catch (e) {} }, 280);
  }

  function close() {
    if (!isOpen) return;
    isOpen = false;
    if (modalOpen) closeMoodModal();
    if (editingId) cancelEdit();
    overlay.classList.add('hidden');
    if (refs.onClose) refs.onClose();
  }

  closeBtn.addEventListener('click', close);
  settingsBtn.addEventListener('click', () => {
    settingsPanel.hidden = !settingsPanel.hidden;
  });
  saveBtn.addEventListener('click', save);
  cancelBtn.addEventListener('click', cancelEdit);
  overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });
  window.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    if (modalOpen) {
      closeMoodModal();
      // This listener registers before main.js's — stop the event so the
      // diary itself doesn't close in the same keypress.
      e.stopImmediatePropagation();
    }
    else if (isOpen) close();
  });
  textEl.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') save();
  });

  function update(t) {
    for (const st of refs.growthStars.children) {
      const u = st.userData;
      st.position.y = u.baseY + Math.sin(t * 1.1 + u.phase) * 0.16;
      st.rotation.y = t * 0.7 + u.phase;
      if (st.children[0]) st.children[0].rotation.x = t * 0.9;
    }
  }

  renderMoodRow();
  selectMood('calm');
  renderFilter();
  renderEditWindow();
  renderList();
  // Boot-time sync: fold existing notes into the lifetime count with
  // zero migration (no modal, no animation) before anything renders.
  if (refs.growth) refs.growth.sync(entries.map((e) => e.id));
  applyGrowth();

  return {
    open, close, save, update,
    isOpen: () => isOpen,
    modalOpen: () => modalOpen,
    closeModal: closeMoodModal,
    count: () => entries.length,
    moods: () => allMoods(),
    filter: () => moodFilter,
    // test hooks
    beginEdit,
    withinWindowFor: withinWindow,
    editWindow: () => editWindowMinutes,
  };
}
