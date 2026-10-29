/* CLB · modo ADULT · front-end autocontenido. */

const API = '/api/adult';

const KEYS = {
  pin: 'clb.adult.pin',
  unlockDevice: 'clb.adult.unlocked',
  unlockSession: 'clb.adult.session',
  prefs: 'clb.adult.prefs',
  mylist: 'clb.adult.mylist',
  history: 'clb.adult.history',
};

const CHIPS = [
  { label: 'Todo',       q: '' },
  { label: 'Amateur',    q: 'amateur' },
  { label: 'MILF',       q: 'milf' },
  { label: 'JAV',        q: 'jav' },
  { label: 'Lesbianas',  q: 'lesbian' },
  { label: 'Anal',       q: 'anal' },
  { label: 'Tetona',     q: 'big tits' },
  { label: 'Casting',    q: 'casting' },
  { label: 'Latina',     q: 'latina' },
  { label: 'Hentai',     q: 'hentai' },
  { label: '4K',         q: '4k' },
  { label: 'Vintage',    q: 'vintage' },
];

const $  = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const on = (sel, ev, fn) => { const el = $(sel); if (el) el.addEventListener(ev, fn); };

const esc = (s) =>
  String(s ?? '').replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

/* ---------- almacenamiento tolerante ---------- */

function store(key, value) {
  try {
    if (value === undefined) {
      const raw = localStorage.getItem(key);
      return raw === null ? null : JSON.parse(raw);
    }
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, JSON.stringify(value));
  } catch { /* modo privado o cuota */ }
  return null;
}

/* ---------- hash del PIN ---------- */

async function hashPin(pin) {
  const bytes = new TextEncoder().encode('clb.adult:' + pin);
  try {
    if (globalThis.crypto && crypto.subtle) {
      const d = await crypto.subtle.digest('SHA-256', bytes);
      return [...new Uint8Array(d)].map((b) => b.toString(16).padStart(2, '0')).join('');
    }
  } catch { /* sin crypto.subtle -> fallback */ }
  let h = 5381;
  for (const b of bytes) h = (((h << 5) + h) + b) >>> 0;
  return 'djb2:' + h.toString(16);
}

/* ---------- toast ---------- */

let toastTimer;
function toast(msg) {
  const el = $('#toast');
  if (!el) return;
  el.textContent = msg;
  el.classList.add('is-on');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('is-on'), 2200);
}

/* =========================================================
   GATE
   ========================================================= */

let boxes = [];
let mode = 'unlock';        // 'setup1' | 'setup2' | 'unlock'
let firstPin = '';
let attempts = 0;

function setGateCopy(title, sub) {
  const t = $('#gateTitle'), s = $('#gateSub');
  if (t) t.textContent = title;
  if (s) s.textContent = sub;
}

function clearBoxes() {
  if (!boxes.length) return;
  boxes.forEach((b) => { b.value = ''; b.classList.remove('is-bad'); b.disabled = false; });
  boxes[0].focus();
}

function readBoxes() { return boxes.map((b) => b.value).join(''); }

function gateError(msg) {
  const err = $('#gateErr');
  if (err) err.textContent = msg;
  boxes.forEach((b) => b.classList.add('is-bad'));
  setTimeout(clearBoxes, 420);
}

function setMode(next) {
  mode = next;
  const go = $('#gateGo');
  const remember = $('#rememberWrap');
  const reset = $('#gateReset');

  if (next === 'setup1') {
    setGateCopy('Crea tu PIN', '4 dígitos. Se guarda solo en este dispositivo.');
    if (go) go.textContent = 'Guardar PIN';
    if (remember) remember.hidden = true;
    if (reset) reset.hidden = true;
  } else if (next === 'setup2') {
    setGateCopy('Confirma tu PIN', 'Repite los 4 dígitos.');
    if (go) go.textContent = 'Guardar PIN';
  } else {
    setGateCopy('Ingresa tu PIN', 'Contenido para adultos.');
    if (go) go.textContent = 'Entrar';
    if (remember) remember.hidden = false;
    if (reset) reset.hidden = false;
  }
  const err = $('#gateErr');
  if (err) err.textContent = '';
  clearBoxes();
}

function gateInit() {
  const hasPin = !!store(KEYS.pin);
  const deviceUnlocked = store(KEYS.unlockDevice) === true;
  const sessionUnlocked = sessionStorage.getItem(KEYS.unlockSession) === '1';

  if (hasPin && (deviceUnlocked || sessionUnlocked)) return unlockApp();
  setMode(hasPin ? 'unlock' : 'setup1');
}

async function submitPin(pin) {
  if (mode === 'setup1') {
    firstPin = pin;
    setMode('setup2');
    return;
  }

  if (mode === 'setup2') {
    if (pin !== firstPin) {
      firstPin = '';
      setMode('setup1');
      setGateCopy('Crea tu PIN', 'No coincidían. Inténtalo otra vez.');
      gateError('Los PIN no coinciden');
      return;
    }
    const hash = await hashPin(pin);
    store(KEYS.pin, hash);
    store(KEYS.unlockDevice, true);
    sessionStorage.removeItem(KEYS.unlockSession);
    unlockApp();
    toast('PIN guardado');
    return;
  }

  const expected = store(KEYS.pin);
  if (!expected) { setMode('setup1'); return; }

  if ((await hashPin(pin)) === expected) {
    attempts = 0;
    const remember = $('#remember');
    if (remember && remember.checked) {
      store(KEYS.unlockDevice, true);
      sessionStorage.removeItem(KEYS.unlockSession);
    } else {
      store(KEYS.unlockDevice, null);
      sessionStorage.setItem(KEYS.unlockSession, '1');
    }
    unlockApp();
  } else {
    attempts += 1;
    const left = 3 - (attempts % 3);
    gateError(left === 3 ? 'PIN incorrecto' : `PIN incorrecto · quedan ${left}`);
    if (attempts % 3 === 0) {
      boxes.forEach((b) => (b.disabled = true));
      setTimeout(clearBoxes, 900);
    }
  }
}

function unlockApp() {
  const gate = $('#gate'), app = $('#app');
  if (gate) gate.classList.add('is-hidden');
  if (app) app.hidden = false;
  document.body.dataset.locked = '0';
  boxes.forEach((b) => (b.value = ''));
  const err = $('#gateErr');
  if (err) err.textContent = '';
  bootCatalog();
}

function bindGate() {
  boxes = $$('#pinWrap .a-pin__box');

  boxes.forEach((box, i) => {
    box.addEventListener('input', () => {
      box.value = box.value.replace(/\D/g, '').slice(0, 1);
      if (box.value && i < boxes.length - 1) boxes[i + 1].focus();
      if (readBoxes().length === 4) submitPin(readBoxes());
    });

    box.addEventListener('keydown', (e) => {
      if (e.key === 'Backspace' && !box.value && i > 0) {
        boxes[i - 1].focus();
        boxes[i - 1].value = '';
        e.preventDefault();
      }
      if (e.key === 'ArrowLeft' && i > 0) boxes[i - 1].focus();
      if (e.key === 'ArrowRight' && i < boxes.length - 1) boxes[i + 1].focus();
    });

    box.addEventListener('paste', (e) => {
      const text = (e.clipboardData || window.clipboardData).getData('text') || '';
      const digits = text.replace(/\D/g, '').slice(0, 4);
      if (!digits) return;
      e.preventDefault();
      boxes.forEach((b, k) => (b.value = digits[k] || ''));
      if (digits.length === 4) submitPin(digits);
      else boxes[Math.min(digits.length, 3)].focus();
    });
  });

  on('#gateForm', 'submit', (e) => {
    e.preventDefault();
    if (readBoxes().length === 4) submitPin(readBoxes());
    else boxes[0] && boxes[0].focus();
  });

  on('#gateReset', 'click', () => {
    store(KEYS.pin, null);
    store(KEYS.unlockDevice, null);
    sessionStorage.removeItem(KEYS.unlockSession);
    firstPin = '';
    attempts = 0;
    setMode('setup1');
    toast('PIN borrado');
  });

 on('#lockBtn', 'click', () => {
  // cierra la sesión (no borra el PIN, solo el permiso de paso)
  store(KEYS.unlockDevice, null);
  sessionStorage.removeItem(KEYS.unlockSession);
  closeDetail();
  location.assign('/');          // vuelve a index.html
});
}

/* =========================================================
   CATÁLOGO
   ========================================================= */

const state = {
  page: 1, query: '', order: 'top-weekly', gay: false,
  mylistOnly: false, loading: false, hasMore: true, items: [], booted: false,
};

function mylist() { return store(KEYS.mylist) || []; }
function inList(id) { return mylist().some((v) => v.id === id); }

function toggleList(v) {
  const list = mylist();
  const i = list.findIndex((x) => x.id === v.id);
  if (i >= 0) { list.splice(i, 1); toast('Quitado de Mi lista'); }
  else { list.unshift({ id: v.id, title: v.title, thumb: v.thumb, duration: v.duration }); toast('Añadido a Mi lista'); }
  store(KEYS.mylist, list.slice(0, 500));
}

function pushHistory(v) {
  const h = (store(KEYS.history) || []).filter((x) => x.id !== v.id);
  h.unshift({ id: v.id, title: v.title, thumb: v.thumb, ts: Date.now() });
  store(KEYS.history, h.slice(0, 200));
}

function renderChips() {
  const wrap = $('#chips');
  if (!wrap) return;
  wrap.innerHTML = '';
  for (const c of CHIPS) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'a-chip';
    b.textContent = c.label;
    b.setAttribute('aria-pressed', String(c.q === state.query && !state.mylistOnly));
    b.addEventListener('click', () => {
      state.mylistOnly = false;
      state.query = c.q;
      $('#q').value = c.q;
      $('#listBtn').setAttribute('aria-pressed', 'false');
      reset();
    });
    wrap.appendChild(b);
  }
}

function card(v) {
  const el = document.createElement('article');
  el.className = 'a-card';
  el.innerHTML = `
    <button class="a-card__thumb" type="button">
      <img src="${esc(v.thumb)}" alt="" loading="lazy" referrerpolicy="no-referrer">
      ${v.duration ? `<span class="a-badge a-badge--dur">${esc(v.duration)}</span>` : ''}
      ${v.quality.length ? `<span class="a-badge a-badge--q">${esc(v.quality[v.quality.length - 1])}</span>` : ''}
    </button>
    <button class="a-card__heart ${inList(v.id) ? 'is-on' : ''}" type="button" title="Mi lista">♥</button>
    <h3 class="a-card__title">${esc(v.title)}</h3>
  `;
  el.querySelector('.a-card__thumb').addEventListener('click', () => openDetail(v));
  el.querySelector('.a-card__heart').addEventListener('click', (e) => {
    e.stopPropagation();
    toggleList(v);
    e.currentTarget.classList.toggle('is-on');
    if (state.mylistOnly) reset();
  });
  return el;
}

async function loadPage() {
  if (state.loading || !state.hasMore) return;

  const grid = $('#grid');
  if (!grid) return;

  if (state.mylistOnly) {
    grid.innerHTML = '';
    const list = mylist();
    $('#status').textContent = list.length ? `${list.length} en Mi lista` : 'Mi lista está vacía';
    state.hasMore = false;
    for (const v of list) grid.appendChild(card(v));
    return;
  }

  state.loading = true;
  $('#status').textContent = 'Cargando…';

  try {
    const params = new URLSearchParams({
      page: String(state.page),
      per_page: '24',
      order: state.order,
      gay: state.gay ? '1' : '0',
    });
    if (state.query) params.set('q', state.query);

    const res = await fetch(`${API}/search?${params}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    if (data.error) throw new Error(data.error);

    state.items.push(...data.videos);
    state.hasMore = !!data.hasMore;
    state.page += 1;

    for (const v of data.videos) grid.appendChild(card(v));
    $('#status').textContent = data.videos.length
      ? `${state.items.length} resultados`
      : 'Sin resultados';
  } catch (err) {
    $('#status').textContent = `Error: ${err.message}`;
    state.hasMore = false;
  } finally {
    state.loading = false;
  }
}

function reset() {
  state.page = 1;
  state.hasMore = true;
  state.items = [];
  $('#grid').innerHTML = '';
  $('#status').textContent = '';
  renderChips();
  loadPage();
}

function savePrefs() {
  store(KEYS.prefs, { order: state.order, gay: state.gay });
}

function bindCatalog() {
  const prefs = store(KEYS.prefs) || {};
  if (prefs.order) { state.order = prefs.order; $('#order').value = prefs.order; }
  if (prefs.gay) { state.gay = true; $('#gayBtn').setAttribute('aria-pressed', 'true'); }

  let debounce;
  on('#q', 'input', (e) => {
    clearTimeout(debounce);
    debounce = setTimeout(() => {
      state.mylistOnly = false;
      $('#listBtn').setAttribute('aria-pressed', 'false');
      state.query = e.target.value.trim();
      reset();
    }, 400);
  });

  on('#order', 'change', (e) => { state.order = e.target.value; savePrefs(); reset(); });

  on('#gayBtn', 'click', (e) => {
    state.gay = !state.gay;
    e.currentTarget.setAttribute('aria-pressed', String(state.gay));
    savePrefs();
    reset();
  });

  on('#listBtn', 'click', (e) => {
    state.mylistOnly = !state.mylistOnly;
    e.currentTarget.setAttribute('aria-pressed', String(state.mylistOnly));
    state.hasMore = true;
    reset();
  });

  const sentinel = $('#sentinel');
  if (sentinel && 'IntersectionObserver' in window) {
    new IntersectionObserver((entries) => {
      if (entries.some((en) => en.isIntersecting)) loadPage();
    }, { rootMargin: '600px' }).observe(sentinel);
  }
}

function bootCatalog() {
  if (state.booted) { if (location.hash) routeHash(); return; }
  state.booted = true;
  renderChips();
  loadPage();
  routeHash();
}

/* =========================================================
   DETALLE / REPRODUCTOR
   ========================================================= */

let current = null;

function openDetail(v) {
  current = v;
  history.replaceState(null, '', '#v=' + v.id);

  $('#dTitle').textContent = v.title;
  $('#dMeta').textContent = [v.duration, v.quality.join(' · '), v.views ? `${v.views.toLocaleString('es')} visitas` : '']
    .filter(Boolean).join('  ·  ');
  $('#dTags').innerHTML = v.tags.map((t) => `<span class="a-tag">${esc(t)}</span>`).join('');
  $('#dPage').href = v.pageUrl;
  $('#dList').textContent = inList(v.id) ? 'Quitar de Mi lista' : 'Añadir a Mi lista';

  $('#player').innerHTML =
    `<iframe src="${esc(v.embedUrl)}" allow="autoplay; fullscreen; encrypted-media; picture-in-picture"
      allowfullscreen loading="eager" title="${esc(v.title)}"></iframe>`;

  $('#detail').hidden = false;
  document.body.classList.add('has-detail');
  pushHistory(v);
}

function closeDetail() {
  const player = $('#player'), detail = $('#detail');
  if (player) player.innerHTML = '';
  if (detail) detail.hidden = true;
  document.body.classList.remove('has-detail');
  current = null;
  if (location.hash) history.replaceState(null, '', location.pathname);
}

function bindDetail() {
  on('#detailClose', 'click', closeDetail);

  on('#dList', 'click', () => {
    if (!current) return;
    toggleList(current);
    $('#dList').textContent = inList(current.id) ? 'Quitar de Mi lista' : 'Añadir a Mi lista';
  });

  on('#dCopy', 'click', async () => {
    if (!current) return;
    try {
      await navigator.clipboard.writeText(current.pageUrl);
      toast('Enlace copiado');
    } catch {
      toast(current.pageUrl);
    }
  });

  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && $('#detail') && !$('#detail').hidden) closeDetail();
  });
}

async function routeHash() {
  const m = /^#v=(.+)$/.exec(location.hash);
  if (!m) return;
  const id = decodeURIComponent(m[1]);
  const known = state.items.find((v) => v.id === id) || mylist().find((v) => v.id === id);
  if (known) return openDetail(known);
  try {
    const res = await fetch(`${API}/video?id=${encodeURIComponent(id)}`);
    const data = await res.json();
    if (data.video) openDetail(data.video);
  } catch { /* ignorar */ }
}

/* ---------- arranque (una sola vez, ya con el DOM listo) ---------- */

function boot() {
  bindGate();
  bindCatalog();
  bindDetail();
  gateInit();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot, { once: true });
} else {
  boot();
}