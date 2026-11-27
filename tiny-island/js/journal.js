import { readJSON, writeJSON } from './utils.js?v=20261127a';

/* ------------------------------------------------------------------ *
 * Life Journal — the indoor notebook on the desk. A personal life
 * planner (plans / goals / free pages / reflections), completely
 * separate from the outdoor Mailbox memory system:
 *   - Mailbox  → diary.js  → tiny-island.memories.v1 (collected moments)
 *   - Notebook → journal.js → tiny-island.journal.v1 (organized life)
 * Different data, different model, different UI component. Neither
 * reads or writes the other's keys.
 *
 * Design notes:
 * - One storage object with four arrays (plans/goals/pages/reflections).
 *   A single key keeps profile snapshots trivial and writes atomic.
 * - Autosave: debounced (400ms) + flush on section switch / close /
 *   beforeunload. A monotonically increasing save token coalesces
 *   overlapping saves so a stale write can never overwrite newer data.
 * - Nothing is auto-created. Empty sections just show gentle paper.
 * - Delete = inline two-step confirm (tap Delete → Confirm), no popups.
 * ------------------------------------------------------------------ */

const KEY = 'tiny-island.journal.v1';

const SECTIONS = [
  { id: 'plans', tab: 'Planner', zh: '计划' },
  { id: 'goals', tab: 'Goals & Dreams', zh: '目标与愿望' },
  { id: 'pages', tab: 'My Pages', zh: '自由页' },
  { id: 'reflections', tab: 'Reflection', zh: '回顾' },
];

const GOAL_STATUS = [
  { id: 'wish', label: 'Wish', zh: '愿望' },
  { id: 'on', label: 'In progress', zh: '进行中' },
  { id: 'done', label: 'Fulfilled', zh: '已实现' },
];

const escapeHtml = (s) => String(s).replace(/[&<>"']/g, (c) =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

function makeId() {
  return 'j' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

function shortDate(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function fullDate(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
}

function todayISO() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/* Fresh empty state — nothing pre-filled. */
function emptyState() {
  return { version: 1, updatedAt: null, plans: [], goals: [], pages: [], reflections: [] };
}

function normalize(raw) {
  const s = emptyState();
  if (!raw || typeof raw !== 'object') return s;
  for (const k of ['plans', 'goals', 'pages', 'reflections']) {
    if (Array.isArray(raw[k])) s[k] = raw[k].filter((x) => x && typeof x.id === 'string');
  }
  return s;
}

export function createJournal(refs) {
  const $ = (id) => document.getElementById(id);
  const toast = refs.toast || (() => {});

  const overlay = $('journalOverlay');
  const closeBtn = $('journalClose');
  const tabsEl = $('journalTabs');
  const pageL = $('journalPageL');
  const pageR = $('journalPageR');

  let state = normalize(readJSON(KEY, null));
  let section = 'plans';        // active section id
  let selectedId = null;        // active entry id within the section
  let isOpen = false;
  let confirmDelId = null;      // entry id pending delete confirmation

  /* ------------------------- persistence -------------------------- */
  let saveTimer = null;
  let saveToken = 0;

  function persistNow() {
    if (saveTimer) { clearTimeout(saveTimer); saveTimer = null; }
    saveToken++;
    state.updatedAt = new Date().toISOString();
    // Synchronous write: localStorage has no async races to deduplicate,
    // and a deferred write could leak the outgoing profile's state back
    // into the freshly-swapped keys during a profile-switch reload.
    if (!writeJSON(KEY, state)) {
      toast('Could not save your journal — check browser storage.');
    }
  }

  // Suspend writes while the page is reloading for a profile switch:
  // otherwise `beforeunload` would flush the OLD profile's in-memory
  // journal into the target profile's live keys after the snapshot swap.
  let suspended = false;
  function suspend() { suspended = true; }
  function resume() { suspended = false; }

  function scheduleSave() {
    if (saveTimer) clearTimeout(saveTimer);
    saveTimer = setTimeout(persistNow, 400);
  }

  function flush() { persistNow(); }

  /* -------------------------- helpers ----------------------------- */
  function listOf(sec) {
    if (sec === 'plans') return state.plans;
    if (sec === 'goals') return state.goals;
    if (sec === 'pages') return state.pages;
    if (sec === 'reflections') return state.reflections;
    return [];
  }

  function ensureSelection() {
    const list = listOf(section);
    if (!list.some((x) => x.id === selectedId)) selectedId = list.length ? list[0].id : null;
  }

  function touch(item) { item.updatedAt = new Date().toISOString(); }

  function sortedPlans() {
    // dated plans first (earliest on top), undated after, done at the end
    const done = state.plans.filter((p) => p.done);
    const open = state.plans.filter((p) => !p.done);
    open.sort((a, b) => (a.date || '9999').localeCompare(b.date || '9999')
      || a.createdAt.localeCompare(b.createdAt));
    return open.concat(done);
  }

  /* ----------------------- section rendering ---------------------- */
  function tabLabel(sec) {
    const t = SECTIONS.find((s) => s.id === sec);
    return t ? t.tab : '';
  }

  function renderTabs() {
    tabsEl.innerHTML = SECTIONS.map((s) =>
      `<button class="jn-tab${s.id === section ? ' on' : ''}" data-jn-tab="${s.id}" type="button"` +
      ` title="${s.zh}"><i></i><span>${s.tab}</span></button>`).join('');
    tabsEl.querySelectorAll('[data-jn-tab]').forEach((b) => {
      b.addEventListener('click', () => {
        if (b.dataset.jnTab === section) return;
        flush();                 // save before switching — nothing is lost
        section = b.dataset.jnTab;
        confirmDelId = null;
        ensureSelection();
        flipTo(renderPage);
      });
    });
  }

  /* small page-turn animation when switching sections */
  function flipTo(fn) {
    const book = $('journalBook');
    book.classList.remove('flip');
    void book.offsetWidth;       // restart animation
    book.classList.add('flip');
    fn();
    setTimeout(() => book.classList.remove('flip'), 460);
  }

  function renderPage() {
    ensureSelection();
    // NOTE: do NOT reset confirmDelId here — the delete flow sets it and
    // re-renders to show the "Tear out?" confirm step.
    if (section === 'plans') renderPlans();
    else if (section === 'goals') renderGoals();
    else if (section === 'pages') renderPages();
    else renderReflections();
    // the editor footer also carries delete controls (see jn-foot)
    bindDelControls(pageR);
  }

  /* ------------------------- left page (list) --------------------- */
  function emptyCopy(sec) {
    if (sec === 'plans') return ['No plans yet.', 'Something small — a walk, a letter, a tidy desk.'];
    if (sec === 'goals') return ['No wishes written down yet.', 'Dreams grow when you give them ink.'];
    if (sec === 'pages') return ['Blank pages, waiting.', 'Write whatever you like — it is your book.'];
    return ['No reflections yet.', 'Whenever a week or month feels worth folding up.'];
  }

  function emptyListHTML() {
    const [t, sub] = emptyCopy(section);
    return `<div class="jn-empty"><b>${t}</b><span>${sub}</span></div>`;
  }

  function delControls(id) {
    if (confirmDelId === id) {
      return `<button class="jn-mini ghost" data-jn-delcancel="${id}" type="button">Keep</button>` +
        `<button class="jn-mini danger" data-jn-delconfirm="${id}" type="button">Tear out?</button>`;
    }
    return `<button class="jn-mini" data-jn-del="${id}" type="button" title="Delete">✕</button>`;
  }

  function bindListEvents() {
    pageL.querySelectorAll('[data-jn-sel]').forEach((b) => {
      b.addEventListener('click', (e) => {
        if (e.target.closest('[data-jn-del],[data-jn-delconfirm],[data-jn-delcancel]')) return;
        flush();
        selectedId = b.dataset.jnSel;
        confirmDelId = null;
        renderPage();
      });
    });
  }

  function bindDelControls(root) {
    root.querySelectorAll('[data-jn-del]').forEach((b) => {
      b.addEventListener('click', () => { confirmDelId = b.dataset.jnDel; renderPage(); });
    });
    root.querySelectorAll('[data-jn-delcancel]').forEach((b) => {
      b.addEventListener('click', () => { confirmDelId = null; renderPage(); });
    });
    root.querySelectorAll('[data-jn-delconfirm]').forEach((b) => {
      b.addEventListener('click', () => {
        const id = b.dataset.jnDelconfirm;
        const sec = section;
        if (sec === 'plans') state.plans = state.plans.filter((x) => x.id !== id);
        else if (sec === 'goals') state.goals = state.goals.filter((x) => x.id !== id);
        else if (sec === 'pages') state.pages = state.pages.filter((x) => x.id !== id);
        else state.reflections = state.reflections.filter((x) => x.id !== id);
        if (selectedId === id) selectedId = null;
        confirmDelId = null;
        scheduleSave();
        renderPage();
        toast('Torn out of the journal.');
      });
    });
  }

  function bindListEvents() {
    pageL.querySelectorAll('[data-jn-sel]').forEach((b) => {
      b.addEventListener('click', (e) => {
        if (e.target.closest('[data-jn-del],[data-jn-delconfirm],[data-jn-delcancel]')) return;
        flush();
        selectedId = b.dataset.jnSel;
        confirmDelId = null;
        renderPage();
      });
    });
    bindDelControls(pageL);
    pageL.querySelectorAll('[data-jn-check]').forEach((b) => {
      b.addEventListener('click', () => {
        const p = state.plans.find((x) => x.id === b.dataset.jnCheck);
        if (p) { p.done = !p.done; touch(p); scheduleSave(); renderPage(); }
      });
    });
    pageL.querySelectorAll('[data-jn-move]').forEach((b) => {
      b.addEventListener('click', () => {
        const id = b.dataset.jnMove;
        const dir = Number(b.dataset.jnDir);
        const arr = state.pages;
        const i = arr.findIndex((x) => x.id === id);
        const j = i + dir;
        if (i < 0 || j < 0 || j >= arr.length) return;
        const [it] = arr.splice(i, 1);
        arr.splice(j, 0, it);
        scheduleSave();
        renderPage();
      });
    });
    const newBtn = pageL.querySelector('[data-jn-new]');
    if (newBtn) newBtn.addEventListener('click', newEntry);
  }

  /* ------------------------- new entries -------------------------- */
  function newEntry() {
    flush();
    const now = new Date().toISOString();
    let item;
    if (section === 'plans') {
      item = { id: makeId(), title: '', date: '', todos: [], done: false, createdAt: now, updatedAt: now };
      state.plans.push(item);
    } else if (section === 'goals') {
      item = { id: makeId(), title: '', desc: '', date: '', status: 'wish', createdAt: now, updatedAt: now };
      state.goals.push(item);
    } else if (section === 'pages') {
      item = { id: makeId(), title: '', body: '', createdAt: now, updatedAt: now };
      state.pages.push(item);
    } else {
      item = { id: makeId(), type: 'week', label: '', happened: '', gains: '', next: '', createdAt: now, updatedAt: now };
      state.reflections.push(item);
    }
    selectedId = item.id;
    confirmDelId = null;
    scheduleSave();
    renderPage();
    const firstInput = pageR.querySelector('input, textarea');
    if (firstInput) firstInput.focus();
  }

  /* ============================ PLANNER =========================== */
  function renderPlans() {
    const list = sortedPlans();
    const rows = list.map((p) => {
      const todoN = p.todos ? p.todos.length : 0;
      const todoDone = p.todos ? p.todos.filter((t) => t.done).length : 0;
      const sel = p.id === selectedId;
      return `<div class="jn-item${sel ? ' sel' : ''}${p.done ? ' done' : ''}" data-jn-sel="${p.id}">` +
        `<button class="jn-check${p.done ? ' on' : ''}" data-jn-check="${p.id}" type="button" title="Mark done"><i></i></button>` +
        `<div class="jn-item-main"><b>${escapeHtml(p.title) || 'Untitled plan'}</b>` +
        (p.date ? `<i>${shortDate(p.date)}</i>` : '<i>no date</i>') +
        (todoN ? `<u>${todoDone}/${todoN} todos</u>` : '') +
        `</div>${delControls(p.id)}</div>`;
    }).join('');

    pageL.innerHTML =
      `<div class="jn-page-head"><b>Planner</b><span>near-term life plans</span></div>` +
      `<div class="jn-list">${rows || emptyListHTML()}</div>` +
      `<button class="jn-add" data-jn-new type="button">+ New plan</button>` +
      `<div class="jn-corner">plan little things</div>`;

    const cur = state.plans.find((x) => x.id === selectedId);
    if (!cur) {
      pageR.innerHTML =
        `<div class="jn-page-head right"><b>Today's page</b><span>${fullDate(todayISO())}</span></div>` +
        `<div class="jn-blank">Pick a plan on the left page,<br>or start a new one below it.</div>` +
        `<div class="jn-corner">the desk lamp is warm</div>`;
      bindListEvents();
      return;
    }

    const todos = (cur.todos || []).map((t) =>
      `<div class="jn-todo${t.done ? ' done' : ''}">` +
      `<button class="jn-check${t.done ? ' on' : ''}" data-jn-todo="${t.id}" type="button"><i></i></button>` +
      `<span>${escapeHtml(t.text)}</span>` +
      `<button class="jn-mini" data-jn-todo-del="${t.id}" type="button" title="Remove todo">✕</button></div>`).join('');

    pageR.innerHTML =
      `<div class="jn-page-head right"><b>Plan</b><span>${escapeHtml(cur.createdAt ? shortDate(cur.createdAt) : '')}</span></div>` +
      `<label class="jn-field"><span>What is it?</span>` +
      `<input id="jnTitle" type="text" maxlength="60" value="${escapeHtml(cur.title)}" placeholder="e.g. Repot the fern"></label>` +
      `<label class="jn-field"><span>Date</span>` +
      `<input id="jnDate" type="date" value="${escapeHtml(cur.date || '')}"></label>` +
      `<div class="jn-field"><span>To-dos</span><div class="jn-todos">${todos || '<div class="jn-hint">Small steps live here.</div>'}</div>` +
      `<div class="jn-todo-add"><input id="jnPTodo" type="text" maxlength="80" placeholder="Add a step…">` +
      `<button id="jnPTodoAdd" type="button">Add</button></div></div>` +
      `<div class="jn-foot">${delControls(cur.id)}<i>autosaves as you write</i></div>` +
      `<div class="jn-corner">one thing at a time</div>`;

    bindField(pageR, () => cur, (it) => it, ['title', 'date']);
    const todoInput = pageR.querySelector('#jnPTodo');
    const addTodo = () => {
      const v = todoInput.value.trim();
      if (!v) return;
      cur.todos = cur.todos || [];
      cur.todos.push({ id: makeId(), text: v, done: false });
      todoInput.value = '';
      touch(cur);
      scheduleSave();
      renderPage();
    };
    pageR.querySelector('#jnPTodoAdd').addEventListener('click', addTodo);
    todoInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') addTodo(); });
    pageR.querySelectorAll('[data-jn-todo]').forEach((b) => {
      b.addEventListener('click', () => {
        const t = cur.todos.find((x) => x.id === b.dataset.jnTodo);
        if (t) { t.done = !t.done; touch(cur); scheduleSave(); renderPage(); }
      });
    });
    pageR.querySelectorAll('[data-jn-todo-del]').forEach((b) => {
      b.addEventListener('click', () => {
        cur.todos = cur.todos.filter((x) => x.id !== b.dataset.jnTodoDel);
        touch(cur); scheduleSave(); renderPage();
      });
    });
    bindListEvents();
  }

  /* ======================= GOALS & DREAMS ========================= */
  function renderGoals() {
    const rows = state.goals.map((g) => {
      const st = GOAL_STATUS.find((s) => s.id === g.status) || GOAL_STATUS[0];
      const sel = g.id === selectedId;
      return `<div class="jn-item${sel ? ' sel' : ''}" data-jn-sel="${g.id}">` +
        `<span class="jn-status s-${g.status}">${st.label}</span>` +
        `<div class="jn-item-main"><b>${escapeHtml(g.title) || 'Untitled wish'}</b>` +
        (g.date ? `<i>by ${shortDate(g.date)}</i>` : '<i>no deadline</i>') +
        `</div>${delControls(g.id)}</div>`;
    }).join('');

    pageL.innerHTML =
      `<div class="jn-page-head"><b>Goals &amp; Dreams</b><span>things worth becoming</span></div>` +
      `<div class="jn-list">${rows || emptyListHTML()}</div>` +
      `<button class="jn-add" data-jn-new type="button">+ New wish</button>` +
      `<div class="jn-corner">dream slowly</div>`;

    const cur = state.goals.find((x) => x.id === selectedId);
    if (!cur) {
      pageR.innerHTML =
        `<div class="jn-page-head right"><b>Wish page</b><span>no deadlines required</span></div>` +
        `<div class="jn-blank">Choose a wish on the left —<br>or plant a new one.</div>` +
        `<div class="jn-corner">stars take their time</div>`;
      bindListEvents();
      return;
    }

    const chips = GOAL_STATUS.map((s) =>
      `<button class="jn-chip${cur.status === s.id ? ' on' : ''}" data-jn-status="${s.id}" type="button">${s.zh} · ${s.label}</button>`).join('');

    pageR.innerHTML =
      `<div class="jn-page-head right"><b>Wish</b><span>${escapeHtml(cur.createdAt ? fullDate(cur.createdAt) : '')}</span></div>` +
      `<label class="jn-field"><span>The wish</span>` +
      `<input id="jnTitle" type="text" maxlength="60" value="${escapeHtml(cur.title)}" placeholder="e.g. See the northern lights"></label>` +
      `<label class="jn-field"><span>More about it</span>` +
      `<textarea id="jnDesc" rows="5" placeholder="Why it matters, first steps, anything…">${escapeHtml(cur.desc || '')}</textarea></label>` +
      `<label class="jn-field"><span>Target date <i>(optional)</i></span>` +
      `<input id="jnDate" type="date" value="${escapeHtml(cur.date || '')}"></label>` +
      `<div class="jn-field"><span>Where it stands</span><div class="jn-chips">${chips}</div></div>` +
      `<div class="jn-foot">${delControls(cur.id)}<i>autosaves as you write</i></div>` +
      `<div class="jn-corner">one star at a time</div>`;

    bindField(pageR, () => cur, (it) => it, ['title', 'desc', 'date']);
    pageR.querySelectorAll('[data-jn-status]').forEach((b) => {
      b.addEventListener('click', () => {
        cur.status = b.dataset.jnStatus;
        touch(cur);
        scheduleSave();
        renderPage();
      });
    });
    bindListEvents();
  }

  /* =========================== MY PAGES =========================== */
  function renderPages() {
    const rows = state.pages.map((p, i) => {
      const sel = p.id === selectedId;
      const preview = (p.body || '').replace(/\s+/g, ' ').slice(0, 42);
      return `<div class="jn-item${sel ? ' sel' : ''}" data-jn-sel="${p.id}">` +
        `<div class="jn-item-main"><b>${escapeHtml(p.title) || 'Untitled page'}</b>` +
        `<i>${preview ? escapeHtml(preview) + '…' : 'empty page'}</i></div>` +
        `<span class="jn-move"><button class="jn-mini" data-jn-move="${p.id}" data-jn-dir="-1" type="button" title="Move up">↑</button>` +
        `<button class="jn-mini" data-jn-move="${p.id}" data-jn-dir="1" type="button" title="Move down">↓</button></span>` +
        `${delControls(p.id)}</div>`;
    }).join('');

    pageL.innerHTML =
      `<div class="jn-page-head"><b>My Pages</b><span>a free place to write</span></div>` +
      `<div class="jn-list">${rows || emptyListHTML()}</div>` +
      `<button class="jn-add" data-jn-new type="button">+ New blank page</button>` +
      `<div class="jn-corner">no rules here</div>`;

    const cur = state.pages.find((x) => x.id === selectedId);
    if (!cur) {
      pageR.innerHTML =
        `<div class="jn-page-head right"><b>Free page</b><span>yours to shape</span></div>` +
        `<div class="jn-blank">Turn to any page on the left,<br>or start a blank one.</div>` +
        `<div class="jn-corner">ink waits patiently</div>`;
      bindListEvents();
      return;
    }

    pageR.innerHTML =
      `<div class="jn-page-head right"><b>Page</b><span>${escapeHtml(cur.createdAt ? fullDate(cur.createdAt) : '')}</span></div>` +
      `<label class="jn-field"><span>Title</span>` +
      `<input id="jnTitle" type="text" maxlength="60" value="${escapeHtml(cur.title)}" placeholder="A page about…"></label>` +
      `<label class="jn-field grow"><span>Write freely</span>` +
      `<textarea id="jnBody" rows="10" placeholder="Lists, letters, half-thoughts, whole days…">${escapeHtml(cur.body || '')}</textarea></label>` +
      `<div class="jn-foot">${delControls(cur.id)}<i>autosaves as you write</i></div>` +
      `<div class="jn-corner">written by you</div>`;

    bindField(pageR, () => cur, (it) => it, ['title', 'body']);
    bindListEvents();
  }

  /* ========================== REFLECTION ========================== */
  function renderReflections() {
    const rows = state.reflections.map((r) => {
      const sel = r.id === selectedId;
      const kind = r.type === 'month' ? 'Month' : 'Week';
      return `<div class="jn-item${sel ? ' sel' : ''}" data-jn-sel="${r.id}">` +
        `<span class="jn-kind">${kind}</span>` +
        `<div class="jn-item-main"><b>${escapeHtml(r.label) || `${kind} reflection`}</b>` +
        `<i>${escapeHtml(r.createdAt ? shortDate(r.createdAt) : '')}</i></div>` +
        `${delControls(r.id)}</div>`;
    }).join('');

    pageL.innerHTML =
      `<div class="jn-page-head"><b>Reflection</b><span>looking back, gently</span></div>` +
      `<div class="jn-list">${rows || emptyListHTML()}</div>` +
      `<button class="jn-add" data-jn-new type="button">+ New reflection</button>` +
      `<div class="jn-corner">no streaks, no score</div>`;

    const cur = state.reflections.find((x) => x.id === selectedId);
    if (!cur) {
      pageR.innerHTML =
        `<div class="jn-page-head right"><b>Look back</b><span>whenever it feels right</span></div>` +
        `<div class="jn-blank">A week, a month, a season —<br>fold it up here when you're ready.</div>` +
        `<div class="jn-corner">the sea keeps count for you</div>`;
      bindListEvents();
      return;
    }

    pageR.innerHTML =
      `<div class="jn-page-head right"><b>Reflection</b><span>${escapeHtml(cur.createdAt ? fullDate(cur.createdAt) : '')}</span></div>` +
      `<div class="jn-field"><span>This was</span><div class="jn-chips">` +
      `<button class="jn-chip${cur.type !== 'month' ? ' on' : ''}" data-jn-kind="week" type="button">A week</button>` +
      `<button class="jn-chip${cur.type === 'month' ? ' on' : ''}" data-jn-kind="month" type="button">A month</button></div></div>` +
      `<label class="jn-field"><span>Name it <i>(optional)</i></span>` +
      `<input id="jnLabel" type="text" maxlength="60" value="${escapeHtml(cur.label || '')}" placeholder="e.g. The week of small rains"></label>` +
      `<label class="jn-field"><span>What happened</span>` +
      `<textarea id="jnHappened" rows="3" placeholder="Moments worth remembering…">${escapeHtml(cur.happened || '')}</textarea></label>` +
      `<label class="jn-field"><span>Harvests &amp; misses</span>` +
      `<textarea id="jnGains" rows="3" placeholder="What felt good, what didn't…">${escapeHtml(cur.gains || '')}</textarea></label>` +
      `<label class="jn-field"><span>Next, maybe</span>` +
      `<textarea id="jnNext" rows="2" placeholder="Things to carry forward…">${escapeHtml(cur.next || '')}</textarea></label>` +
      `<div class="jn-foot">${delControls(cur.id)}<i>autosaves as you write</i></div>` +
      `<div class="jn-corner">softly, without judgment</div>`;

    bindField(pageR, () => cur, (it) => it, ['label', 'happened', 'gains', 'next']);
    pageR.querySelectorAll('[data-jn-kind]').forEach((b) => {
      b.addEventListener('click', () => {
        cur.type = b.dataset.jnKind;
        touch(cur);
        scheduleSave();
        renderPage();
      });
    });
    bindListEvents();
  }

  /* -------------------- shared field binding ---------------------- */
  // Two-way binding with autosave. Reads the live DOM value on input,
  // writes into the model, schedules a debounced save. `pick` resolves
  // the current model item at event time so stale closures can't write
  // into a deleted entry.
  function bindField(root, resolve, map, fields) {
    for (const f of fields) {
      const el = root.querySelector(`#jn${f.charAt(0).toUpperCase()}${f.slice(1)}`);
      if (!el) continue;
      el.addEventListener('input', () => {
        const item = resolve();
        if (!item) return;
        item[f] = el.value;
        touch(item);
        scheduleSave();
      });
    }
    void map;
  }

  /* --------------------------- open/close ------------------------- */
  function render() {
    renderTabs();
    renderPage();
  }

  function open() {
    if (isOpen) return;
    isOpen = true;
    selectedId = null;
    confirmDelId = null;
    render();
    overlay.hidden = false;
    requestAnimationFrame(() => overlay.classList.add('show'));
    if (refs.onOpen) refs.onOpen();
  }

  function close() {
    if (!isOpen) return false;
    isOpen = false;
    flush();
    overlay.classList.remove('show');
    setTimeout(() => { overlay.hidden = true; }, 260);
    if (refs.onClose) refs.onClose();
    return true;
  }

  closeBtn.addEventListener('click', close);
  overlay.addEventListener('mousedown', (e) => {
    if (e.target === overlay) close();
  });
  window.addEventListener('beforeunload', () => { if (!suspended) flush(); });

  return {
    open, close, isOpen: () => isOpen, flush, suspend, resume,
    debugReset: () => { state = emptyState(); persistNow(); renderPage(); },
  };
}
