const $ = id => document.getElementById(id);
const providers = Object.fromEntries(Object.entries(CinePlayback.providers).map(([id,p])=>[id,p.origin]));
const storageKey = 'cine-local-tests-v1';
let active = null;
let webMovie=null;
let results = [];
let movies = [];
let catalogView = 'popular';
let catalogSkip = 0;
let catalogRequest = 0;
let catalogController = null;
let searchTimer = null;
let previousQuery = '';
let playRequest = 0;
let releases={name:'Últimos lanzamientos',items:[],message:'Consultando estrenos…'};
const genreLabels = {Action:'Acción',Adventure:'Aventura',Animation:'Animación',Biography:'Biografía',Comedy:'Comedia',Crime:'Crimen',Documentary:'Documental',Drama:'Drama',Family:'Familiar',Fantasy:'Fantasía',History:'Historia',Horror:'Terror',Music:'Música',Musical:'Musical',Mystery:'Misterio',Romance:'Romance','Sci-Fi':'Ciencia ficción',Sport:'Deportes',Thriller:'Suspenso',War:'Guerra',Western:'Western'};
const currentYear = Number(new Intl.DateTimeFormat('en',{year:'numeric',timeZone:'America/Mexico_City'}).format(new Date()));
const allYears = document.createElement('option'); allYears.value = 'all'; allYears.textContent = 'Todos los años'; $('release-year').append(allYears);
for (let year = currentYear; year >= 1920; year--) { const option = document.createElement('option'); option.value = year; option.textContent = year; $('release-year').append(option); }
function updateViewButtons() {
  for (const item of document.querySelectorAll('[data-view]')) item.setAttribute('aria-pressed',String(!searchText() && item.dataset.view === catalogView));
}
function searchText() { return $('search').value.trim(); }
async function loadCatalog(append = false) {
  const request = ++catalogRequest;
  catalogController?.abort(); catalogController = new AbortController();
  const query = searchText();
  const year = $('release-year').value;
  const kind = query ? 'search' : year === 'all' ? catalogView : 'recent';
  if (!query) catalogView = kind;
  updateViewButtons();
  $('load-more').disabled = true;
  let releasesTask=Promise.resolve();
  if(!append&&!query){
    releases={name:'Últimos lanzamientos',items:[],message:'Consultando estrenos…'};
    releasesTask=fetch('/api/releases?'+new URLSearchParams({kind:'movie',year}),{signal:AbortSignal.any([catalogController.signal,AbortSignal.timeout(45000)])}).then(async r=>{
      const d=await r.json();if(!r.ok)throw Error(d.error);if(request!==catalogRequest)return;
      releases={name:'Últimos lanzamientos',items:d.items.map(m=>({...m,genres:m.genres.map(g=>genreLabels[g]||g),genre:genreLabels[m.genres[0]]||m.genres[0]||'Película'})),note:d.note,message:'No hay estrenos con fecha confirmada para esta selección.'};renderMovies();
    }).catch(error=>{if(request===catalogRequest){releases={name:'Últimos lanzamientos',items:[],message:error.message};renderMovies();}});
  }
  if (!append) { catalogSkip = 0; movies = []; renderMovies(); }
  $('catalog-source').textContent = query ? `Buscando «${query}» en el catálogo de Internet…` : 'Consultando catálogo en Internet…';
  try {
    // Precarga tres páginas de catálogo. Las búsquedas consultan una página por solicitud.
    for (let page = 0; page < (globalThis.CineDataSaver.enabled || append || query ? 1 : 3); page++) {
    const params = new URLSearchParams({kind, year, q:query, skip:String(catalogSkip)});
    const response = await fetch(`/api/catalog?${params}`, {signal:AbortSignal.any([catalogController.signal,AbortSignal.timeout(20000)])});
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'No se pudo consultar el catálogo.');
    if (request !== catalogRequest) return;
    const incoming = data.movies.map(m => ({...m, genres:m.genres.map(g => genreLabels[g] || g), genre:genreLabels[m.genres[0]] || m.genres[0] || 'Película'}));
    const previousCount = movies.length;
    movies = [...new Map([...movies, ...incoming].map(m => [m.id,m])).values()];
    if (kind === 'recent') movies.sort((a,b) => (Date.parse(b.released)||0) - (Date.parse(a.released)||0));
    catalogSkip = data.nextSkip;
    $('load-more').hidden = !data.hasMore || (incoming.length > 0 && movies.length === previousCount);
    $('load-more').textContent = 'Cargar más películas';
    $('catalog-source').textContent = `Cinemeta · ${query ? `Resultados de «${query}»${year === 'all' ? ' · todos los años' : ` · ${year}`}` : kind === 'recent' ? `Películas de ${year}, por fecha más reciente` : kind==='featured' ? 'Mejor valoradas' : 'Catálogo popular'} · ${movies.length} títulos cargados. Audio y vídeo no verificados.`;
    renderMovies();
    if ($('load-more').hidden) break;
    }
  } catch (error) {
    if (request !== catalogRequest) return;
    $('catalog-source').textContent = `No se pudo actualizar: ${error.message}. Vuelve a intentarlo o usa las opciones avanzadas.`;
    $('load-more').hidden = false; $('load-more').textContent = 'Reintentar carga';
  } finally { await releasesTask; if (request === catalogRequest) $('load-more').disabled = false; }
}
for (const button of document.querySelectorAll('[data-view]')) button.addEventListener('click', () => {
  clearTimeout(searchTimer);
  catalogView = button.dataset.view; catalogSkip = 0; $('search').value = '';
  previousQuery = '';
  $('release-year').value = catalogView === 'recent' ? String(currentYear) : 'all';
  $('load-more').textContent = 'Cargar más películas';
  loadCatalog();
});
$('release-year').addEventListener('change', () => {
  clearTimeout(searchTimer); catalogSkip = 0;
  if (!searchText()) catalogView = $('release-year').value === 'all' ? 'popular' : 'recent';
  loadCatalog();
});
$('load-more').addEventListener('click', () => loadCatalog(catalogSkip > 0));
function renderMovies() {
  const visible = movies;
  $('catalog-count').textContent = movies.length+' películas cargadas · Explora por género';
  CLBShelves.render($('movie-grid'),visible,movie=>{

    const card = document.createElement('button'); card.type = 'button'; card.className = 'movie-card'; card.setAttribute('aria-label', `Ver ficha de ${movie.name}`);
    const art = document.createElement('div'); art.className = 'poster';
    const fallback = document.createElement('span'); fallback.className = 'poster-fallback'; fallback.textContent = movie.name;
    const img = document.createElement('img'); img.src = globalThis.CineDataSaver.poster(movie.posterUrl || `https://image.tmdb.org/t/p/w342/${movie.poster}`); img.alt = ''; img.loading = 'lazy'; img.decoding = 'async'; img.referrerPolicy = 'no-referrer'; img.addEventListener('error', () => img.remove());
    const play = document.createElement('span'); play.className = 'card-play'; play.textContent = '▶';
    art.append(fallback, img, play);
    const title = document.createElement('b'); title.textContent = movie.name;
    const meta = document.createElement('small'); meta.textContent = `${movie.year} · ${movie.genre}${movie.released ? ` · ${new Date(movie.released).toLocaleDateString('es-MX',{timeZone:'UTC'})}` : ''}`;
    card.append(art, title, meta);
    card.addEventListener('click', () => {
      if(window.CLBDetails?.open({...movie,kind:'movie',section:'movie'}))return;
      webMovie={...movie,kind:'movie',section:'movie'};window.CLBWeb?.setItem(webMovie);
      $('movie-id').value = movie.id; $('movie-name').value = movie.name;
      if(!globalThis.CineDataSaver.enabled)$('player-form').requestSubmit();else {$('watch').hidden=false;$('now-playing').textContent=movie.name;$('player').replaceChildren();active=null;$('save').disabled=true;$('retry-provider').disabled=true;$('status').textContent='Ahorro de datos · Pulsa Reproducir película para cargar el vídeo.';} $('watch').scrollIntoView({behavior:'smooth',block:'start'});
    });
    return card;
  },{search:!!searchText(),leading:searchText()?null:releases,emptyText:'No hay coincidencias. Prueba otro título o año; también puedes usar las opciones avanzadas.'});
}

$('search').addEventListener('input', () => {
  clearTimeout(searchTimer); catalogController?.abort(); ++catalogRequest;
  if (!previousQuery && searchText()) $('release-year').value = 'all';
  previousQuery = searchText(); catalogSkip = 0;
  $('load-more').disabled = true;
  $('catalog-source').textContent = searchText() ? 'Preparando búsqueda en Internet…' : 'Actualizando catálogo…';
  searchTimer = setTimeout(() => loadCatalog(),450);
});
$('search').addEventListener('keydown', event => { if (event.key === 'Enter') { event.preventDefault(); clearTimeout(searchTimer); loadCatalog(); } });
renderMovies();
try { const parsed = JSON.parse(localStorage.getItem(storageKey) || '[]'); if (Array.isArray(parsed)) results = parsed.filter(r => r && typeof r === 'object' && typeof r.id === 'string'); } catch { $('save-status').textContent = 'No se pudo leer el registro anterior.'; }
function renderHistory() {
  $('history').replaceChildren();
  if (!results.length) { $('history').textContent = 'Aún no hay pruebas guardadas.'; return; }
  for (const r of results.slice().reverse()) {
    const row = document.createElement('article'); row.className = 'record';
    const content = document.createElement('div');
    const title = document.createElement('b'); title.textContent = `${r.name || r.id} · ${r.provider}`;
    const summary = document.createElement('p'); summary.textContent = `${r.verdict} · ${r.embedMode === 'protegido' ? 'Bloqueo de pestañas activo' : r.embedMode === 'compatible-sin-sandbox' ? 'Sin sandbox' : 'Demo inicial con sandbox'} · Audio: ${r.audio} · Subtítulos: ${r.subs} · Completa: ${r.complete ? 'sí' : 'no comprobada'}`;
    const note = document.createElement('p'); note.textContent = r.notes || '';
    const time = document.createElement('small'); time.textContent = new Date(r.at).toLocaleString('es-MX');
    content.append(title, summary, note, time); row.append(content); $('history').append(row);
  }
}
function stop() {
  window.CLBWeb?.stop();
  ++playRequest;
  $('player').replaceChildren(); active = null; $('save').disabled = true; $('retry-provider').disabled = true;$('latino-player').disabled=true;
  $('watch').hidden = true;
  $('status').textContent = 'Reproducción detenida.';
  $('now-playing').textContent = 'Reproductor';
}
$('stop').addEventListener('click', () => {stop();$('catalog').scrollIntoView({behavior:'smooth',block:'start'});});
$('audio-preference').addEventListener('change', () => {
  $('provider').value = CinePlayback.preferredProvider(['latino','castellano'].includes($('audio-preference').value) ? 'facilito' : 'sh');
  $('provider').dispatchEvent(new Event('change'));
  if (active) {
    $('movie-id').value = active.id; $('movie-name').value = active.name;
    $('player-form').requestSubmit();
  }
});
$('provider').addEventListener('change', () => {
  $('provider').value=CinePlayback.preferredProvider($('provider').value);
  CinePlayback.configureQuality($('provider').value);
  $('provider-note').textContent = $('provider').value === 'vixsrc' ? 'VixSrc · Pruebas. Su parámetro lang solicita audio español, sin distinguir latino de España ni confirmar que exista esa pista. Subtítulos y calidad se eligen en su reproductor.' : $('provider').value === 'vidking' ? 'Vidking · Pruebas. Usa TMDB; las pistas de audio, resolución y compatibilidad con sandbox requieren comprobarse por título. Subtítulos en español no confirman audio latino.' : $('provider').value === 'facilito' ? 'Fuente experimental que anuncia latino/castellano. Elige Latino o Castellano dentro del reproductor si aparece; la preferencia no cambia automáticamente su pista de audio. Requiere ID numérico de TMDB; el doblaje no está garantizado.' : $('provider').value === 'sh' ? 'Audio original según la fuente; se solicita el subtítulo preferido. Subtítulos en español no cambian el audio a latino.' : 'Audio original según la fuente. Elige español en los subtítulos del reproductor si está disponible; no cambia el doblaje.';
});
$('player-form').addEventListener('submit', async event => {
  event.preventDefault();
  let id = $('movie-id').value.trim();
  const provider = CinePlayback.preferredProvider($('provider').value);
  $('provider').value=provider;CinePlayback.configureQuality(provider);
  if (!/^(?:[1-9][0-9]{0,11}|tt[0-9]{7,12})$/.test(id) || !Object.hasOwn(providers, provider)) return;
  stop(); $('watch').hidden = false; $('result-form').reset(); $('save-status').textContent = '';
  $('now-playing').textContent = $('movie-name').value.trim() || 'Cargando película…';
  $('watch').scrollIntoView({behavior:'smooth',block:'start'});
  const request = playRequest;
  const movieName = $('movie-name').value.trim();
  const libraryMovie=webMovie&&(webMovie.id===id||webMovie.tmdbId===id)?{...webMovie}:{id,name:movieName||`Película ${id}`,kind:'movie',section:'movie'};
  window.CLBWeb?.setItem(libraryMovie);
  if (CinePlayback.providers[provider].tmdb && id.startsWith('tt')) {
    $('status').textContent = 'Preparando película…';
    try {
      const response = await fetch(`/api/movie?imdb=${encodeURIComponent(id)}`,{signal:AbortSignal.timeout(20000)});
      const data = await response.json();
      if (request !== playRequest) return;
      if (!response.ok) throw new Error(data.error || 'No se encontró identificador TMDB.');
      id = data.id; $('movie-id').value = id;
    } catch (error) { if (request === playRequest) $('status').textContent = error.message; return; }
  }
  webMovie={...libraryMovie,tmdbId:CinePlayback.providers[provider].tmdb?id:libraryMovie.tmdbId};
  const url = window.CLBWeb?.decorate(CinePlayback.url(provider,id,undefined,undefined,$('subtitle').value,CinePlayback.qualityValue(),$('audio-preference').value),libraryMovie)||CinePlayback.url(provider,id,undefined,undefined,$('subtitle').value,CinePlayback.qualityValue(),$('audio-preference').value);
  active = {id, provider, name: movieName, url: url.href, embedMode:CinePlayback.sandboxed(provider)?'protegido':'compatible-sin-sandbox',requestedAudio:$('audio-preference').value};
  $('now-playing').textContent = active.name || `Película ${id}`;
  $('retry-provider').disabled = false;$('latino-player').disabled=false;
  let frame;
  try {frame=CinePlayback.frame(provider,url,`Reproductor externo: ${active.name || id}`);}
  catch(error){$('status').textContent=error.message;return;}
  $('player').append(frame);window.CLBWeb?.track(frame,provider,libraryMovie); $('save').disabled = false;
  $('status').textContent = `${CinePlayback.providerName(provider)} · Pulsa Play dentro del vídeo. Elige Latino o Castellano en su menú si existe la pista; la preferencia no garantiza el doblaje. Los subtítulos también dependen de la fuente.`;
});
$('reload-player').addEventListener('click',()=>{if(!active)return;globalThis.CineRecovery.reset();$('movie-id').value=active.id;$('movie-name').value=active.name;$('player-form').requestSubmit();});
$('retry-provider').addEventListener('click', () => {
  if (!active) return;
  const previous = {...active};
  $('movie-id').value = previous.id; $('movie-name').value = previous.name;
  const order=['facilito','cinesrc','sh','to'].filter(id=>CinePlayback.compatible(id)&&!CinePlayback.providers[id].experimental);
  $('provider').value=order[(order.indexOf(previous.provider)+1)%order.length];
  $('provider').dispatchEvent(new Event('change'));
  $('player-form').requestSubmit();
});
$('subtitle').addEventListener('change',()=>{if(active){$('movie-id').value=active.id;$('movie-name').value=active.name;$('player-form').requestSubmit();}});
for (const button of document.querySelectorAll('[data-id]')) button.addEventListener('click', () => {
  $('movie-id').value = button.dataset.id; $('movie-name').value = button.dataset.name;
  $('advanced-tools').open = true; $('movie-id').focus();
});
$('result-form').addEventListener('submit', event => {
  event.preventDefault(); if (!active) return;
  results.push({...active, at: new Date().toISOString(), verdict: $('verdict').value, audio: $('audio').value, subs: $('subs').value, complete: $('complete').checked, notes: $('notes').value.trim()});
  try { localStorage.setItem(storageKey, JSON.stringify(results)); $('save-status').textContent = 'Resultado guardado en este navegador.'; }
  catch { $('save-status').textContent = 'No se pudo guardar en el navegador. Exporta JSON antes de cerrar.'; }
  renderHistory();
});
$('export').addEventListener('click', () => {
  const url = URL.createObjectURL(new Blob([JSON.stringify({version: 1, exportedAt: new Date().toISOString(), results}, null, 2)], {type: 'application/json'}));
  const link = document.createElement('a'); link.href = url; link.download = 'cine-local-pruebas.json'; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
});
document.addEventListener('player-policy-change',()=>{if(active){$('movie-id').value=active.id;$('movie-name').value=active.name;$('player-form').requestSubmit();}});
document.addEventListener('player-quality-change',()=>{if(active){$('movie-id').value=active.id;$('movie-name').value=active.name;$('player-form').requestSubmit();}});
renderHistory();
$('provider').value = 'facilito';
$('provider').dispatchEvent(new Event('change'));
loadCatalog();

window.CLBWeb?.connect({section:'movie',catalog:'catalog',actions:'.player-actions',open:item=>{webMovie=item;window.CLBWeb.setItem(item);$('movie-id').value=item.id;$('movie-name').value=item.name;$('player-form').requestSubmit();}});

$('latino-player').addEventListener('click',()=>{if(!active)return;$('movie-id').value=active.id;$('movie-name').value=active.name;$('audio-preference').value='latino';$('provider').value='facilito';$('provider').dispatchEvent(new Event('change'));$('player-form').requestSubmit();});
