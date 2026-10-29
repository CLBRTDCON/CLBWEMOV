const $ = id => document.getElementById(id);
let releases={name:'Últimos lanzamientos',items:[],message:'Consultando estrenos…'};
const animePage = window.location.pathname === '/anime';
const names = {all:'Todas las plataformas',internet:'Explorar todas · Internet',anilist:'Todo el anime · AniList',kitsu:'Más anime · Kitsu',nfx:'Netflix',hbm:'HBO Max',dnp:'Disney+',amp:'Prime Video',atp:'Apple TV+',pmp:'Paramount+',hlu:'Hulu',pcp:'Peacock',stz:'Starz',bbc:'BBC iPlayer',vik:'Rakuten Viki',shd:'Shudder',mp9:'Movistar+',dpe:'Discovery+',cts:'Curiosity Stream',bbo:'BritBox',act:'Acorn TV',iqi:'iQIYI',cru:'Crunchyroll'};
const genreLabels = {'Slice of Life':'Vida cotidiana',Sports:'Deportes',Supernatural:'Sobrenatural',Psychological:'Psicológico',Mecha:'Mechas','Mahou Shoujo':'Chicas mágicas',Action:'Acción','Action & Adventure':'Acción y aventura',Adventure:'Aventura',Animation:'Animación',Biography:'Biografía',Comedy:'Comedia',Crime:'Crimen',Documentary:'Documental',Drama:'Drama',Family:'Familiar',Fantasy:'Fantasía',History:'Historia',Horror:'Terror',Music:'Música',Musical:'Musical','Game-Show':'Concursos',Kids:'Infantil',Reality:'Reality','Reality-TV':'Reality',Short:'Cortos','Sci-Fi & Fantasy':'Ciencia ficción y fantasía',Mystery:'Misterio',Romance:'Romance','Sci-Fi':'Ciencia ficción',Sport:'Deportes',Thriller:'Suspenso',War:'Guerra',Western:'Western'};
let platform = animePage ? 'anilist' : 'internet', shows = [], nextSkip = 0, requestId = 0, controller, searchTimer, selected = null, detailRequest = 0, currentEpisode = null;
if (animePage) {
  document.body.classList.add('anime-page');
  $('series-genre-label').hidden=true;$('platform-picker').open=true;document.querySelector('.brand-section').textContent='anime'; document.title='CLB · Anime';
  $('series-catalog-title').textContent='Explora todo el anime';
  $('series-search').placeholder='Nombre de un anime…';
  $('series-provider').value='sh';$('series-language').value='original';
  $('anime-format-label').hidden=false;
  $('playback-hint').textContent='Se solicita versión original con subtítulos en español cuando la fuente lo permite. Los servidores se habilitan según los identificadores disponibles. El idioma y la reproducción no están verificados; las entregas pueden tener fichas separadas.';
  document.querySelector('label.search-label').firstChild.textContent='Buscar anime en este catálogo';
  for (const link of document.querySelectorAll('header nav a')) { link.removeAttribute('aria-current'); if(link.getAttribute('href')==='/anime')link.setAttribute('aria-current','page'); }
}
function element(tag,className,text) { const el = document.createElement(tag); if (className) el.className = className; if (text !== undefined) el.textContent = text; return el; }
$('series-grid').classList.remove('movie-grid');$('series-grid').classList.add('genre-shelves');
const year = Number(new Intl.DateTimeFormat('en',{year:'numeric',timeZone:'America/Mexico_City'}).format(new Date()));
for (let y=year; y>=1920; y--) { const option = element('option','',String(y)); option.value = y; $('series-year').append(option); }
function platformButtons(counts = []) {
  $('active-platform').textContent=names[platform];
  const map = new Map(counts.map(p=>[p.id,p.count]));
  $('platforms').replaceChildren();
  for (const [id,name] of Object.entries(names)) {
    if (animePage ? !['anilist','kitsu','cru'].includes(id) : ['anilist','kitsu','cru'].includes(id)) continue;
    const button = element('button','platform'); button.type='button'; button.dataset.platform=id;
    button.setAttribute('aria-pressed',String(id===platform));
    button.append(element('b','',name),element('small','',id==='all' ? 'Selección por plataforma' : ['internet','anilist','kitsu'].includes(id) ? 'Búsqueda amplia · cargar más' : map.has(id) ? map.get(id) === null ? 'Sin respuesta' : `${map.get(id)} en el catálogo` : 'Consultar catálogo'));
    button.addEventListener('click',()=>{if(animePage&&platform!==id){$('series-genre').value='all';$('anime-format').value='all';}platform=id;reload();}); $('platforms').append(button);
  }
}
function render() {
  $('series-grid').replaceChildren();
  if (!shows.length) $('series-grid').append(element('p','muted',$('series-grid').getAttribute('aria-busy')==='true' ? 'Cargando catálogo…' : animePage ? 'Sin resultados en esta página. Cambia los filtros, prueba el otro catálogo o pulsa Cargar más si está disponible.' : 'No hay resultados con esos filtros. Prueba «Todas» o cambia el año o el género.'));
  const createCard=show=>{
    const card = element('button','movie-card'); card.type='button'; card.dataset.seriesId=show.id; card.setAttribute('aria-label',`Ver episodios de ${show.name}`);
    const art = element('div','poster'); art.append(element('span','poster-fallback',show.name));
    if (show.posterUrl) { const img=element('img'); img.src=globalThis.CineDataSaver.poster(show.posterUrl); img.alt=''; img.loading='lazy'; img.decoding='async'; img.referrerPolicy='no-referrer'; img.addEventListener('error',()=>img.remove()); art.append(img); }
    art.append(element('span','card-play','▶'));
    const badges=element('div','platform-badges');
    for (const id of show.platforms) badges.append(element('span','',names[id]));
    if (!show.platforms.length) badges.append(element('span','',show.catalog||'Catálogo Internet'));
    card.append(art,element('b','',show.name),element('small','',`${show.year || 'Año no informado'}${show.format ? ` · ${show.format}` : ''} · ${genreLabels[show.genres[0]] || show.genres[0] || 'Serie'}`),badges);
    card.addEventListener('click',()=>{if(!window.CLBDetails?.open({...show,kind:animePage?'anime':'series',section:animePage?'anime':'series'}))openShow(show);});return card;
  };
  CLBShelves.render($('series-grid'),shows,createCard,{labels:genreLabels,search:!!$('series-search').value.trim(),leading:$('series-search').value.trim()?null:releases,emptyText:'No hay series con estos filtros. Prueba otro año o plataforma.'});
}
async function load(append=false) {
  const id=++requestId; controller?.abort(); controller=new AbortController();
  $('series-grid').setAttribute('aria-busy','true');$('series-more').disabled=true;
  $('anime-format').disabled=platform!=='anilist';if(platform!=='anilist')$('anime-format').value='all';
  let releasesTask=Promise.resolve();
  if(!append&&!$('series-search').value.trim()){
    releases={name:animePage?'Últimos lanzamientos · Anime':'Últimos lanzamientos',items:[],message:'Consultando estrenos…'};
    releasesTask=fetch('/api/releases?'+new URLSearchParams({kind:animePage?'anime':'series',platform,year:$('series-year').value,format:$('anime-format').value}),{signal:AbortSignal.any([controller.signal,AbortSignal.timeout(45000)])}).then(async r=>{const d=await r.json();if(!r.ok)throw Error(d.error);if(id!==requestId)return;releases={name:animePage?'Últimos lanzamientos · '+d.source:'Últimos lanzamientos',items:d.items,note:d.note,message:'No hay estrenos con fecha confirmada para esta selección.'};render();}).catch(error=>{if(id===requestId){releases={name:'Últimos lanzamientos',items:[],message:error.message};render();}});
  }
  if(!append){shows=[];nextSkip=0;render();}
  $('series-status').textContent='Consultando el catálogo en Internet…';
  try {
    const pages=!append&&!$('series-search').value.trim()?(platform==='internet'?3:['anilist','kitsu'].includes(platform)?2:1):1;
    for(let page=0;page<(globalThis.CineDataSaver.enabled?1:pages);page++) {
      const params=new URLSearchParams({platform,q:$('series-search').value.trim(),year:$('series-year').value,genre:$('series-genre').value,sort:$('series-sort').value,skip:String(nextSkip)});
      const broadAnime=['anilist','kitsu'].includes(platform);
      if(broadAnime){params.set('source',platform);params.set('format',$('anime-format').value);}
      const response=await fetch(`${broadAnime?'/api/anime/catalog':'/api/series/catalog'}?${params}`,{signal:AbortSignal.any([controller.signal,AbortSignal.timeout(25000)])});
      const data=await response.json();if(id!==requestId)return;
      if(!response.ok)throw new Error(data.error||'Catálogo no disponible.');
      const previousCount=shows.length;
      shows=[...new Map([...shows,...data.series].map(s=>[s.id,s])).values()];nextSkip=data.nextSkip;
      $('series-more').hidden=!data.hasMore||(data.series.length>0&&shows.length===previousCount);$('series-more').textContent=animePage?'Cargar más anime':'Cargar más series';
      const genre=$('series-genre').value;
      $('series-genre').replaceChildren();const all=element('option','','Todos los géneros');all.value='all';$('series-genre').append(all);
      for(const value of new Set([...data.genres,...(genre==='all'?[]:[genre])])){const o=element('option','',genreLabels[value]||value);o.value=value;$('series-genre').append(o);}
      $('series-genre').value=genre;platformButtons(data.platforms);
      const note=platform==='internet'?' Más recientes sin año consulta el año actual; los filtros secundarios y la ordenación se aplican por página.':platform==='kitsu'?' El año se filtra por página; «En emisión» usa la selección de Kitsu. El filtro de formato está disponible en AniList.':'';
      $('series-status').textContent=`${shows.length}${data.total===null?'':` de ${data.total}`} ${animePage?'títulos cargados':'series cargadas'} · ${names[platform]} · Región no verificada.${note}${data.warnings.length?` ${data.warnings.join(' ')}`:''}`;
      render();if($('series-more').hidden)break;
    }
  }catch(error){if(id!==requestId)return;$('series-status').textContent=error.message;$('series-more').hidden=false;$('series-more').textContent='Reintentar';}
  finally{await releasesTask;if(id===requestId){$('series-grid').setAttribute('aria-busy','false');$('series-more').disabled=false;render();}}
}
function reload(){clearTimeout(searchTimer);load();}
for(const id of ['series-year','series-genre','series-sort','anime-format']) $(id).addEventListener('change',reload);
$('series-search').addEventListener('input',()=>{clearTimeout(searchTimer);++requestId;controller?.abort();$('series-status').textContent='Preparando búsqueda…';$('series-more').disabled=true;searchTimer=setTimeout(()=>load(),450);});
$('series-search').addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();reload();}});
$('series-more').addEventListener('click',()=>load(nextSkip>0));
$('series-reset').addEventListener('click',()=>{platform=animePage?'anilist':'internet';$('anime-format').value='all';$('series-search').value='';$('series-year').value='all';$('series-genre').value='all';$('series-sort').value='popular';reload();});
function stop(){ window.CLBWeb?.stop(); $('series-player').replaceChildren(element('p','player-placeholder','Selecciona un episodio y pulsa Reproducir.'));$('series-player-status').textContent='Reproducción detenida.'; }
let webShow=null;
async function openShow(show,resume=null){
  const id=++detailRequest; selected=null;currentEpisode=null;stop();
  $('series-catalog').hidden=true;$('series-detail').hidden=false;$('series-detail').setAttribute('aria-busy','true');$('series-name').textContent=show.name;$('series-description').textContent='';$('episode-status').textContent='Cargando temporadas y episodios…';
  $('episode-title').textContent='Selecciona un episodio';$('series-player-status').textContent='Sin reproducción activa.';
  $('episode-grid').replaceChildren();$('season').replaceChildren();$('episode').replaceChildren();
  for(const key of ['season','episode','episode-play','episode-next']) $(key).disabled=true;
  $('series-detail').scrollIntoView({behavior:'smooth',block:'start'});
  try{
    const response=await fetch(`${/^(kitsu|mal|anilist):/.test(show.id)?'/api/anime/detail':'/api/series/detail'}?id=${encodeURIComponent(show.id)}`,{signal:AbortSignal.timeout(50000)});const data=await response.json();if(id!==detailRequest)return;
    if(!response.ok)throw new Error(data.error || 'No se pudo abrir la ficha.');selected=data;webShow={...show,...data,id:show.id,kind:animePage?'anime':'series',section:animePage?'anime':'series'};window.CLBWeb?.setItem(webShow);
    $('series-name').textContent=data.name;$('series-description').textContent=data.description;configureSources();
    $('season').parentElement.hidden=data.playbackType==='movie';$('episode').parentElement.hidden=data.playbackType==='movie';
    const seasons=[...new Set(data.episodes.map(e=>e.season))];
    for(const season of seasons){const option=element('option','',season===0?'Especiales':`Temporada ${season}`);option.value=season;$('season').append(option);}
    if(!seasons.length){$('episode-status').textContent='La fuente no proporciona episodios para esta serie.';return;}
    const available=data.episodes.find(e=>e.season>0 && !e.upcoming&&!e.locked) || data.episodes.find(e=>!e.upcoming&&!e.locked) || data.episodes[0];
    $('season').value=available.season;$('season').disabled=false;
    $('episode-status').textContent=data.playbackType==='movie'?`Película anime · Fuente: ${data.episodeSource}. Vídeo e idiomas por comprobar.`:`${seasons.length} temporadas (incluidos especiales si existen) · ${data.episodes.length} episodios · Fuente: ${data.episodeSource || 'Cinemeta'}. Vídeo e idiomas por comprobar.${data.episodeWarning ? ` ${data.episodeWarning}` : ''}`;
    renderEpisodes();
    if(resume){const saved=data.episodes.find(e=>e.season===resume.season&&e.episode===resume.episode&&!e.upcoming&&!e.locked);
     if(!saved){$('episode').value='';updateEpisodeControls();$('episode-status').textContent='El capítulo guardado no está disponible. Selecciona otro episodio.';return;}
     $('season').value=saved.season;renderEpisodes();$('episode').value=saved.episode;updateEpisodeControls();play();
    }
  }catch(error){if(id===detailRequest)$('episode-status').textContent=error.message;}
  finally{if(id===detailRequest)$('series-detail').setAttribute('aria-busy','false');}
}
function configureSources(preferLanguage=false){
  const hasImdb=/^tt\d{7,12}$/.test(selected?.imdbId||selected?.id||'');
  const hasTmdb=/^[1-9]\d{0,11}$/.test(String(selected?.tmdbId||''));
  for(const option of $('series-provider').options){const config=CinePlayback.providers[option.value];option.disabled=!config||!CinePlayback.compatible(option.value)||(config.tmdb?!hasTmdb:!hasImdb);}
  const spanish=['latino','castellano'].includes($('series-language').value);
  if(preferLanguage||!$('series-provider').value||$('series-provider').selectedOptions[0]?.disabled){
    const order=spanish?['facilito','sh','cinesrc','to']:['sh','cinesrc','to','facilito'];
    $('series-provider').value=order.find(id=>[...$('series-provider').options].some(option=>option.value===id&&!option.disabled))||'';
  }
  CinePlayback.configureQuality($('series-provider').value);
  if(!$('series-provider').value)$('series-player-status').textContent='Esta ficha no tiene una correspondencia IMDb o TMDB compatible con los servidores disponibles. Prueba la ficha equivalente en el otro catálogo; no se cargará un episodio distinto.';
}
function chosen(){return selected?.episodes.find(e=>e.season===Number($('season').value)&&e.episode===Number($('episode').value));}
function renderEpisodes(){
  if(!selected)return;
  const entries=selected.episodes.filter(e=>e.season===Number($('season').value));$('episode').replaceChildren();
  for(const entry of entries){const o=element('option','',`${entry.episode}. ${entry.name}${entry.upcoming?' · Próximo':entry.locked?' · No disponible':''}`);o.value=entry.episode;o.disabled=entry.upcoming||entry.locked;$('episode').append(o);}
  const available=entries.find(e=>!e.upcoming&&!e.locked);if(available)$('episode').value=available.episode;else $('episode').value='';$('episode').disabled=!available;
  if(!$('episode-grid').children.length){
    for(const season of new Set(selected.episodes.map(e=>e.season))){
      const group=element('details','season-group');group.dataset.season=season;
      const episodes=selected.episodes.filter(e=>e.season===season);
      group.append(element('summary','',`${season===0?'Especiales':`Temporada ${season}`} · ${episodes.length} capítulos`));
      const list=element('div','episode-grid');
      for(const entry of episodes){const button=element('button','',`${entry.episode}. ${entry.name}`);button.type='button';button.disabled=entry.upcoming||entry.locked;button.dataset.season=season;button.dataset.episode=entry.episode;
        button.append(element('small','',entry.upcoming?'Próximamente':entry.locked?'No disponible':entry.released?new Date(entry.released).toLocaleDateString('es-MX',{timeZone:'UTC'}):'Fecha no informada'));
        button.addEventListener('click',()=>{$('season').value=season;renderEpisodes();$('episode').value=entry.episode;updateEpisodeControls();play();$('series-player').scrollIntoView({behavior:'smooth',block:'center'});});list.append(button);
      }
      group.append(list);$('episode-grid').append(group);
    }
  }
  for(const group of $('episode-grid').children)group.open=Number(group.dataset.season)===Number($('season').value);
  updateEpisodeControls();
}
function updateEpisodeControls(){
  const entry=chosen();$('episode-play').disabled=!entry||entry.upcoming||entry.locked||!$('series-provider').value||$('series-provider').selectedOptions[0]?.disabled;
  const index=selected?.episodes.indexOf(entry)??-1;
  $('episode-next').disabled=index<0||!selected.episodes.slice(index+1).some(e=>!e.upcoming&&!e.locked);
  for(const button of $('episode-grid').querySelectorAll('button'))button.setAttribute('aria-current',String(Number(button.dataset.season)===entry?.season&&Number(button.dataset.episode)===entry?.episode));
  if(!currentEpisode)$('episode-title').textContent=entry?`${selected.name} · T${entry.season} E${entry.episode} · ${entry.name}`:'Selecciona un episodio';
}
function play(){
  const entry=chosen();if(!selected || !entry || entry.upcoming || entry.locked)return;
  const provider=CinePlayback.preferredProvider($('series-provider').value);
  $('series-provider').value=provider;CinePlayback.configureQuality(provider);
  const config=CinePlayback.providers[provider];
  if(!config||!CinePlayback.compatible(provider)||$('series-provider').selectedOptions[0]?.disabled){$('series-player-status').textContent='No hay identificador compatible con las fuentes para este anime. Prueba la ficha equivalente en el otro catálogo.';return;}
  const native=selected.kind==='anime'&&provider==='vidlink'&&selected.malId;
  const imdb=entry.imdbId||selected.imdbId||selected.id;
  if(!native&&config.tmdb&&entry.imdbId&&selected.imdbId&&entry.imdbId!==selected.imdbId){$('series-player-status').textContent='Este capítulo tiene otra correspondencia IMDb. Usa VidSrc para conservar la correspondencia IMDb del episodio.';return;}
  if(!native&&config.tmdb&&!selected.tmdbId){$('series-player-status').textContent='Falta ID TMDB para esta fuente. Prueba VidSrc si hay una correspondencia IMDb.';return;}
  stop();currentEpisode=entry;
  $('episode-title').textContent=`${selected.name} · ${selected.playbackType==='movie'?'Película':`T${entry.season} E${entry.episode}`} · ${entry.name}`;
  let frame;
  try {
    const season=selected.playbackType==='movie'?undefined:entry.sourceSeason??entry.season;
    const episode=selected.playbackType==='movie'?undefined:entry.sourceEpisode??entry.episode;
    const url=native?CinePlayback.animeUrl(selected.malId,entry.malEpisode||entry.episode):CinePlayback.url(provider,config.tmdb?selected.tmdbId:imdb,season,episode,'es',CinePlayback.qualityValue(),$('series-language').value);
    frame=CinePlayback.frame(provider,window.CLBWeb?.decorate(url,webShow,selected.playbackType==='movie'?null:entry)||url,`${selected.name} · Episodio ${entry.episode}`);
  }catch(error){$('series-player-status').textContent=error.message;return;}
  $('series-player').replaceChildren(frame);window.CLBWeb?.track(frame,provider,webShow,selected.playbackType==='movie'?null:entry);
  $('series-player-status').textContent=`${CinePlayback.providerName(provider)} · `+(native?'Versión SUB solicitada por MAL. Elige subtítulos españoles dentro del reproductor si los ofrece; español latino y calidad dependen de las pistas disponibles.':animePage && ['sh','vidfast'].includes(provider) ? 'Subtítulos ES solicitados. Pulsa Play y selecciona audio original y subtítulos españoles si están disponibles en el menú del reproductor. Español latino no está garantizado.' : 'Pulsa Play dentro del vídeo. Elige Latino o Castellano en su menú si existe esa pista; la preferencia no cambia automáticamente el audio.');
}
$('series-language').addEventListener('change',()=>{if(!selected)return;configureSources(true);updateEpisodeControls();if(currentEpisode)play();});
$('season').addEventListener('change',renderEpisodes);$('episode').addEventListener('change',updateEpisodeControls);$('episode-play').addEventListener('click',play);$('series-provider').addEventListener('change',()=>{CinePlayback.configureQuality($('series-provider').value);if(currentEpisode)play();});
$('episode-next').addEventListener('click',()=>{const entry=chosen();const index=selected?.episodes.indexOf(entry)??-1;const next=selected?.episodes.slice(index+1).find(e=>!e.upcoming&&!e.locked);if(!next)return;$('season').value=next.season;renderEpisodes();$('episode').value=next.episode;updateEpisodeControls();play();});
$('reload-player').addEventListener('click',()=>{if(!currentEpisode)return;globalThis.CineRecovery.reset();play();});
$('episode-stop').addEventListener('click',()=>{stop();currentEpisode=null;});$('series-close').addEventListener('click',()=>{++detailRequest;stop();selected=null;currentEpisode=null;$('series-detail').hidden=true;$('series-catalog').hidden=false;$('series-catalog').scrollIntoView({behavior:'smooth'});});
document.addEventListener('player-policy-change',()=>{if(currentEpisode)play();});
document.addEventListener('player-quality-change',()=>{if(currentEpisode)play();});
CinePlayback.configureQuality($('series-provider').value);
platformButtons();load();

window.CLBWeb?.connect({section:animePage?'anime':'series',catalog:'series-catalog',actions:'.episode-actions',open:openShow});
