/**
 * CLB · modo ADULT · proxy de catálogo contra Eporner API v2
 * Convención del proyecto: exporta adultApi(req,res).
 *
 * Rutas GET:
 *   /api/adult/search?q=&page=1&per_page=24&order=top-weekly&gay=0
 *   /api/adult/video?id=<id>
 *   /api/adult/embed?id=<id>
 *
 * Existe como proxy porque la API de Eporner no manda cabeceras CORS.
 */

const UPSTREAM = 'https://www.eporner.com/api/v2';
const CACHE_TTL = 5 * 60 * 1000;
const PER_PAGE_MAX = 60;
const TIMEOUT_MS = 12000;
const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
  '(KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';

const ORDERS = new Set([
  'top-weekly', 'top-monthly', 'top-rated', 'top-voted',
  'latest', 'longest', 'shortest', 'most-popular', 'most-viewed', 'random',
]);

const cache = new Map();

const clampInt = (raw, dflt, min, max) => {
  const n = parseInt(raw, 10);
  if (!Number.isFinite(n)) return dflt;
  return Math.min(Math.max(n, min), max);
};

const fmtDur = (sec) => {
  if (!sec) return '';
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  return h
    ? `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
    : `${m}:${String(s).padStart(2, '0')}`;
};

function cacheGet(key) {
  const hit = cache.get(key);
  if (!hit) return null;
  if (Date.now() > hit.expires) { cache.delete(key); return null; }
  return hit.value;
}
function cacheSet(key, value) {
  if (cache.size > 400) cache.clear();
  cache.set(key, { value, expires: Date.now() + CACHE_TTL });
}

function send(req, res, status, body) {
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
  });
  res.end(req.method === 'HEAD' ? undefined : JSON.stringify(body));
}

async function upstream(path, params) {
  const url = new URL(UPSTREAM + path);
  for (const [k, v] of Object.entries(params)) {
    if (v !== null && v !== undefined && v !== '') url.searchParams.set(k, String(v));
  }
  url.searchParams.set('format', 'json');

  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      signal: ac.signal,
      headers: { 'User-Agent': UA, Accept: 'application/json' },
    });
    if (!res.ok) throw new Error(`Eporner respondió ${res.status}`);
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

function bestThumb(v) {
  const list = Array.isArray(v.thumbs) ? v.thumbs.filter((t) => t && t.src) : [];
  list.sort((a, b) => (b.width || 0) - (a.width || 0));
  return (list[0] && list[0].src) || (v.default_thumb && v.default_thumb.src) || '';
}

function normalize(v) {
  const dur = (Number(v.length_min) || 0) * 60 + (Number(v.length_sec) || 0);
  const id = String(v.id || '');
  return {
    id,
    title: String(v.title || '').trim(),
    duration: fmtDur(dur),
    durationSec: dur,
    views: Number(v.views) || 0,
    rating: Number(v.rate) || 0,
    quality: Array.isArray(v.quality) ? v.quality.filter(Boolean).slice(0, 4) : [],
    thumb: bestThumb(v),
    embedUrl: `https://www.eporner.com/embed/${id}/`,
    pageUrl: v.url || `https://www.eporner.com/video-${id}/`,
    added: v.added || null,
    tags: Array.isArray(v.tags) ? v.tags.filter(Boolean).slice(0, 14) : [],
  };
}

async function search(sp) {
  const q = (sp.get('q') || '').trim();
  const page = clampInt(sp.get('page'), 1, 1, 400);
  const perPage = clampInt(sp.get('per_page'), 24, 1, PER_PAGE_MAX);
  const orderRaw = (sp.get('order') || 'top-weekly').trim();
  const order = ORDERS.has(orderRaw) ? orderRaw : 'top-weekly';
  const gay = sp.get('gay') === '1' ? '1' : '0';

  const key = ['s', q, page, perPage, order, gay].join('|');
  const hit = cacheGet(key);
  if (hit) return hit;

  const params = { per_page: perPage, page, thumbsize: 'big', order, gay };
  if (q) params.query = q;

  const data = await upstream('/video/search/', params);
  const videos = Array.isArray(data.videos) ? data.videos.map(normalize) : [];
  const total = Number(data.total_count) || 0;

  const out = {
    source: 'eporner',
    attribution: { label: 'Eporner', url: 'https://www.eporner.com/' },
    query: q, page, perPage, order, gay,
    total, count: videos.length,
    hasMore: total ? page * perPage < total : videos.length >= perPage,
    videos,
  };
  cacheSet(key, out);
  return out;
}

async function video(sp) {
  const id = (sp.get('id') || '').trim();
  if (!id) throw new Error('falta el parámetro id');
  const key = 'v|' + id;
  const hit = cacheGet(key);
  if (hit) return hit;

  const data = await upstream('/video/id/', { id });
  const raw = Array.isArray(data.videos) ? data.videos[0] : data;
  if (!raw) throw new Error('vídeo no encontrado');

  const out = { video: normalize(raw) };
  cacheSet(key, out);
  return out;
}

async function embed(sp) {
  const id = (sp.get('id') || '').trim();
  if (!id) throw new Error('falta el parámetro id');
  return {
    id,
    embedUrl: `https://www.eporner.com/embed/${id}/`,
    pageUrl: `https://www.eporner.com/video-${id}/`,
  };
}

export async function adultApi(req, res) {
  const url = new URL(req.url, 'http://app.invalid');
  const route = url.pathname.slice('/api/adult'.length).replace(/^\/+/, '');

  try {
    if (route === 'search') return send(req, res, 200, await search(url.searchParams));
    if (route === 'video') return send(req, res, 200, await video(url.searchParams));
    if (route === 'embed') return send(req, res, 200, await embed(url.searchParams));
    return send(req, res, 404, { error: 'ruta desconocida', routes: ['search', 'video', 'embed'] });
  } catch (err) {
    return send(req, res, 502, { error: String((err && err.message) || err) });
  }
}