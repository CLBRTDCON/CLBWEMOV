import {installMobilePlayback} from './mobile-playback.mjs';
import {installTVNavigation} from './tv-navigation.mjs';
import {createDramaTests,dramaStatuses} from './drama-tests.mjs';
import {createLibrary,libraryItem} from './library.mjs';
import {createGlobalSearch,searchSections} from './global-search.mjs';
import {api,installAndroidTransport,platformNames} from './api.mjs';
import {candidates,canChooseQuality} from './player-policy.mjs';
import {createLivePlayer} from './live-player.mjs';
import {createPosterLoader} from './posters.mjs';
if(location.origin==='https://appassets.androidplatform.net')installAndroidTransport();
const $=id=>document.getElementById(id);
const tvEdition=new URLSearchParams(location.search||'').get('tv')==='1';
if(tvEdition)globalThis.CineDataSaver?.set(false);
const library=createLibrary({onError:message=>{$('library-notice').hidden=false;$('library-notice').textContent=message;}});
const globalSearch=createGlobalSearch({api,sections:tvEdition?searchSections.filter(s=>s.key!=='drama'):searchSections});
const dramaTests=createDramaTests({onError:message=>{$('drama-test-status').textContent=message;}});
let view='catalog',libraryType='favorites',searchToken=0,searchGroups=new Map(),watchItem=null,watchSection='movie',resumeRecord=null;
const labels={movie:'Películas',series:'Series',anime:'Anime',kids:'Kids',tv:'TV en vivo',documentary:'Documentales',archive:'Archivo abierto',drama:'Dramas'};
const genreLabels={Action:'Acción',Adventure:'Aventura',Animation:'Animación',Comedy:'Comedia',Crime:'Crimen',Documentary:'Documental',Drama:'Drama',Family:'Familiar',Fantasy:'Fantasía',History:'Historia',Horror:'Terror',Mystery:'Misterio',Romance:'Romance','Sci-Fi':'Ciencia ficción',Sport:'Deportes',Sports:'Deportes',Thriller:'Suspenso',War:'Guerra',Western:'Western','Slice of Life':'Vida cotidiana',Supernatural:'Sobrenatural',Psychological:'Psicológico'};
const currentYear=new Date().getFullYear();
let kind='movie',items=[],skip=0,hasMore=false,requestId=0,detailId=0,selected=null,optionIndex=0,timer,activeEpisode=null,episodeButtons=[],suspendedPlayback=null;
const tvAvoidedProviders=new Set();let tvActiveProvider=null,tvRemoteTrial=false,tvResumeAt=null;
const languages={movie:'latino',series:'latino',anime:'original',kids:'latino',documentary:'latino',drama:'original'};
let releases={name:'Últimos lanzamientos',items:[],message:'Consultando estrenos…'},tvFilters=null;
let kidCursors=new Map();
const covers=createPosterLoader(tvEdition?{concurrency:3}:{});
const live=createLivePlayer({container:$('player'),status:$('play-status'),quality:$('quality'),onFailure:()=>{if(tvEdition)window.CLBTVVideoFailure?.();}});
const mobilePlayback=tvEdition?null:installMobilePlayback({document,window,library,actions:{reload:()=>play()}});
if(!tvEdition)$('alternative').hidden=true;
function element(tag,text,className){const e=document.createElement(tag);if(text!==undefined)e.textContent=text;if(className)e.className=className;return e;}
function option(value,text){const e=element('option',text);e.value=value;return e;}
function activeItem(item){return !(tvEdition&&item?.section==='drama')&&item?.kind!=='drama'&&!String(item?.id||'').startsWith('reelshort:')&&!(item?.section==='drama'&&item.genres?.some(g=>g.startsWith('Dramas ')));}
function catalogName(){return $('source').selectedOptions[0]?.textContent||'Internet';}
function sourceLabel(){return ['series','anime'].includes(kind)?'Plataforma':kind==='tv'?'País':kind==='drama'?'Colección':'Catálogo';}
function platformText(item){
  const section=item.section||kind;
  if(item.kind==='tv')return 'IPTV-org · TV en vivo';
  const names=(item.platforms||[]).map(id=>platformNames[id]).filter(Boolean);
  if(names.length)return names.join(' · ');
  if(item.catalog)return `Catálogo: ${item.catalog}`;
  return section==='movie'?'Catálogo: Cinemeta':section==='series'?'':'Catálogo Internet · plataforma no informada';
}
for(let y=currentYear;y>=1920;y--)$('year').append(option(y,String(y)));
function sources(){
 $('source-caption').textContent=sourceLabel();$('source-tool-caption').textContent=sourceLabel();$('source-tool').setAttribute('aria-label',sourceLabel());
 $('source').replaceChildren();$('source-tool').hidden=['movie','drama'].includes(kind);
 const names=kind==='drama'?{kdrama:'K-dramas'}:kind==='documentary'?{all:'Todos los documentales',movie:'Películas · Cinemeta',series:'Docuseries · Cinemeta',tvmaze:'Más docuseries · TVmaze',archive:'Archivo abierto · Internet Archive'}:kind==='tv'?{all:'Todos los países'}:kind==='kids'?{all:'Todo Kids',movie:'Películas familiares',series:'Series infantiles',anime:'Anime infantil',tv:'TV infantil'}:kind==='anime'?{anilist:'Todo el anime · AniList',kitsu:'Más anime · Kitsu',cru:'Crunchyroll'}:kind==='series'?{internet:'Explorar todas',all:'Todas las plataformas',...Object.fromEntries(Object.entries(platformNames).filter(([id])=>id!=='cru'))}:{cinemeta:'Internet'};
 for(const [id,name]of Object.entries(names))$('source').append(option(id,name));
 $('format-tool').hidden=!['anime','drama'].includes(kind);
 $('format-tool-caption').textContent=kind==='drama'?'Estado':'Formato';$('format-caption').textContent=kind==='drama'?'Estado de tu prueba':'Formato';
 $('format').replaceChildren(...Object.entries(kind==='drama'?{all:'Todos los estados',pending:'Sin validar',partial:'Inconcluso',complete:'Completo · validado por ti',failed:'No reproduce'}:{all:'Todos',TV:'Serie TV',TV_SHORT:'Serie corta',MOVIE:'Película',OVA:'OVA',ONA:'ONA',SPECIAL:'Especial',TV_SPECIAL:'Especial TV'}).map(([id,name])=>option(id,name)));
 $('drama-note').hidden=kind!=='drama';$('year-tool').hidden=kind==='tv';$('sort-tool').hidden=['tv','kids','drama'].includes(kind);$('genre-tool').hidden=kind!=='tv';$('family-note').hidden=kind!=='kids';$('manual-tools').hidden=kind!=='movie';$('manual-tools').open=false;
}
function stop(){mobilePlayback?.detach();window.CLBTVRemoteDispose?.();globalThis.CineRecovery?.clear();suspendedPlayback=null;for(const v of $('player').querySelectorAll?.('video')||[]){v.persistProgress?.();v.pause();v.removeAttribute('src');v.load();}live.stop();$('player').replaceChildren();}
function filterPanel(name){
 const targets={search:'search-form',source:'source-label',year:'year-label',sort:'sort-label',genre:'genre-label',format:'format-label'};
 const opening=name&&$(targets[name]).hidden;
 for(const [key,id] of Object.entries(targets)){$(id).hidden=!(opening&&key===name);$(key+'-tool').setAttribute('aria-expanded',String(!!opening&&key===name));}
 if(opening&&name==='search')$('search').focus();
}
function menu(open){if(open)filterPanel(null);$('section-menu').hidden=!open;$('menu-backdrop').hidden=!open;$('menu-toggle').setAttribute('aria-expanded',String(open));}
function filterIndicators(){
 for(const name of ['search','source','year','sort','genre','format']){
  const input=$(name),button=$(name+'-tool');
  button.dataset.active=String(name==='search'?!!input.value.trim():!['all','popular','internet','anilist','cinemeta'].includes(input.value));
  button.setAttribute('aria-label',`${{search:'Buscar',source:sourceLabel(),year:'Año',sort:'Orden',genre:'Categoría',format:kind==='drama'?'Estado':'Formato'}[name]}: ${input.selectedOptions?.[0]?.textContent||input.value||'Sin filtro'}`);
 }
}
function chooseKind(value){
 if(tvEdition&&value==='drama')value='series';
 view='catalog';searchToken++;$('library-view').hidden=true;$('global-view').hidden=true;
 menu(false);filterPanel(null);
 ++detailId;selected=null;stop();kind=value;document.body.dataset.section=kind;
 $('watch').hidden=true;$('catalog').hidden=false;$('back').hidden=true;$('heading').textContent=labels[kind];$('brand-section').textContent={movie:'cinema',series:'series',anime:'anime',kids:'kids',tv:'live',documentary:'docs',drama:'dramas'}[kind];
 $('search').placeholder=kind==='tv'?'Buscar un canal…':kind==='kids'?'Buscar una historia infantil…':kind==='movie'?'Buscar una película…':kind==='series'?'Buscar una serie…':kind==='documentary'?'Buscar un documental…':kind==='drama'?'Buscar un drama…':'Buscar un anime…';
 $('search').value='';$('year').value='all';$('genre').replaceChildren(option('all','Todos'));$('sort').value='popular';$('format').value='all';tvFilters=null;
 for(const b of document.querySelectorAll('[data-kind]')){b.removeAttribute('aria-current');if(b.dataset.kind===kind)b.setAttribute('aria-current','page');}
 sources();window.scrollTo(0,0);load();
}
function createCard(item,onOpen=()=>open(item)){
 const card=element('button',undefined,'card');card.type='button';card.setAttribute('aria-label',`Ver ${item.name}`);
 const art=element('div',undefined,'poster');art.append(element('span',item.kind==='tv'?'◉ '+item.name:item.name));
 covers.attach(art,item);
 card.append(art,element('b',item.name),element('small',item.kind==='tv'?`${item.country} · En directo`:`${item.year||'Sin año'}${item.format?' · '+item.format:''} · ${labels[item.kind]||genreLabels[item.genres?.[0]]||item.genres?.[0]||labels[kind]}`));
 const platform=kind==='kids'?labels[item.kind]:platformText(item);if(platform)card.append(element('small',platform,'platform-label'));if(kind==='drama'||item.section==='drama'){
  card.append(element('small',dramaStatuses[dramaTests.get(String(item.id),item).status]+' · Prueba','drama-badge'));
  if(item.publicEpisodes!==undefined)card.append(element('small',`${item.publicEpisodes}/${item.announcedEpisodes} capítulos públicos`,'drama-access'));
  else if(item.restricted)card.append(element('small','Incluye capítulos restringidos','drama-access'));
 }card.addEventListener('click',onOpen);return card;
}
function render(){
 if(tvEdition&&!$('watch').hidden)return;
 const positions=new Map([...($('grid').querySelectorAll?.('.genre-row')||[])].map(row=>[row.getAttribute('aria-label'),row.scrollLeft]));covers.reset();
 const tv=kind==='tv'||kind==='kids'&&$('source').value==='tv',q=$('search').value.trim();
 if(tv){$('grid').className='grid';$('grid').replaceChildren();for(const item of items)$('grid').append(createCard(item));if(!items.length)$('grid').append(element('p','Sin canales con estos filtros. Prueba otro país o categoría.','hint'));}
 else{$('grid').className='genre-shelves';CLBShelves.render($('grid'),items.filter(i=>i.kind!=='tv'&&(kind!=='drama'||$('format').value==='all'||dramaTests.get(String(i.id),i).status===$('format').value)),createCard,{controls:false,notes:false,labels:{...genreLabels,Kids:'Infantil',Short:'Historias cortas'},search:!!q,leading:q||kind==='drama'?null:kind==='documentary'?{name:'Últimos documentales cargados',items:items.filter(i=>i.released&&Date.parse(i.released)<=Date.now()).slice().sort((a,b)=>Date.parse(b.released)-Date.parse(a.released)).slice(0,18)}:releases,emptyText:kind==='drama'?'No hay títulos con este estado en las páginas cargadas. Cambia el estado, la colección o carga más.':'Sin resultados. Prueba otra búsqueda o carga más.'});
 const channels=items.filter(i=>i.kind==='tv');if(channels.length){const shelf=element('section',undefined,'genre-shelf');shelf.append(element('h3','TV infantil'));const row=element('div',undefined,'genre-row');for(const i of channels)row.append(createCard(i));shelf.append(row);$('grid').append(shelf);}}
 for(const row of $('grid').querySelectorAll?.('.genre-row')||[])row.scrollLeft=positions.get(row.getAttribute('aria-label'))||0;
 renderContinue();
}
async function load(append=false){
 clearTimeout(timer);const id=++requestId,q=$('search').value.trim();
 if(!append){items=[];skip=0;kidCursors=new Map();releases={name:'Últimos lanzamientos',items:[],message:'Consultando estrenos…'};render();}
 $('grid').setAttribute('aria-busy','true');$('more').disabled=true;$('catalog-status').textContent='Consultando Internet…';
 $('format').disabled=kind!=='drama'&&(kind!=='anime'||$('source').value!=='anilist');if($('format').disabled)$('format').value='all';
 if(kind==='drama'){$('sort-tool').hidden=true;$('year-tool').hidden=false;}
 if(!append&&!q&&!['tv','documentary','drama'].includes(kind)&&!(kind==='kids'&&$('source').value==='tv')){
  const params=new URLSearchParams({kind,platform:$('source').value,selection:kind==='kids'?$('source').value:'all',year:$('year').value,format:$('format').value});
  api('/api/releases?'+params).then(d=>{if(id!==requestId)return;releases={name:kind==='kids'?'Últimos lanzamientos Kids':'Últimos lanzamientos',items:d.items,note:d.note,message:'No hay estrenos con fecha informada en esta selección.'};render();}).catch(e=>{if(id===requestId){releases={name:'Últimos lanzamientos',items:[],message:e.message};render();}});
 }
 try{
  if(kind==='tv'&&!tvFilters){const filters=await api('/api/tv/filters');if(id!==requestId)return;tvFilters=filters;
   $('source').replaceChildren(option('all','Todos los países'));const names=new Intl.DisplayNames(['es'],{type:'region'});
   for(const c of [...filters.countries].sort((a,b)=>names.of(a.code).localeCompare(names.of(b.code),'es')))$('source').append(option(c.code,`${c.flag} ${names.of(c.code)} · ${c.count}`));
   $('source').value=filters.countries.some(c=>c.code==='MX')?'MX':'all';for(const c of filters.categories.filter(c=>c.id!=='xxx'))$('genre').append(option(c.id,{kids:'Infantil',news:'Noticias',movies:'Películas',music:'Música',sports:'Deportes',general:'General'}[c.id]||c.name));
  }
  const source=$('source').value,params=new URLSearchParams({q,year:$('year').value,genre:'all',sort:$('sort').value,skip:String(skip)});let path;
  $('active-catalog').textContent=`Buscando en: ${kind==='movie'?'Cinemeta · películas':catalogName()}`;
  filterIndicators();
  if(kind==='movie'){params.set('kind',q?'search':$('sort').value==='rating'?'featured':$('sort').value==='recent'?'recent':'popular');if($('sort').value==='recent'&&params.get('year')==='all')params.set('year',currentYear);path='/api/catalog';}
  else if(kind==='drama'){params.set('source',source);path='/api/dramas/catalog';}
  else if(kind==='documentary'){params.set('source',source);path='/api/documentaries/catalog';}
  else if(kind==='kids'){params.set('kind',source);path='/api/kids/catalog';}
  else if(kind==='tv'){params.set('country',source);params.set('category',$('genre').value);path='/api/tv/catalog';}
  else if(kind==='anime'&&source!=='cru'){params.set('source',source);params.set('format',$('format').value);path='/api/anime/catalog';}
  else{params.set('platform',source);path='/api/series/catalog';}
  const budget=globalThis.CineDataSaver?.enabled||tvEdition?1:q||['tv','drama'].includes(kind)?1:append?2:4;
  let warnings=false;
  for(let page=0;page<budget;page++){
   if(kind==='kids'&&source==='all'&&(append||page>0)){
    const cursor=[...kidCursors.entries()].filter(([,c])=>c.hasMore).sort((a,b)=>a[1].pages-b[1].pages)[0];
    if(!cursor)break;params.set('kind',cursor[0]);params.set('skip',cursor[1].skip);
   }else params.set('skip',String(skip));
   const data=await api(path+'?'+params);if(id!==requestId)return;
   const incoming=data.items||data.movies||data.series||data.channels?.map(c=>({...c,kind:'tv',genres:[],posterUrl:''}))||data.sections?.flatMap(s=>s.items)||[];
   const oldSkip=skip;items=[...new Map([...items,...incoming].map(m=>[(m.kind||'')+':'+m.id,m])).values()];
   if(kind==='kids'&&source==='all'){
    for(const section of data.sections||[]){const old=kidCursors.get(section.kind);kidCursors.set(section.kind,{skip:section.nextSkip,hasMore:section.hasMore&&section.nextSkip>(old?.skip??-1),pages:(old?.pages||0)+1});}
    hasMore=[...kidCursors.values()].some(c=>c.hasMore);skip=items.length;
   }else{skip=data.nextSkip??data.sections?.[0]?.nextSkip??0;hasMore=!!(data.hasMore??data.sections?.[0]?.hasMore)&&skip>oldSkip;}
   warnings||=!!data.warnings?.length;
   $('catalog-status').textContent=`${items.length} ${kind==='tv'?'canales':'títulos'} cargados.${warnings?' Algunas fuentes no respondieron.':''}${kind==='drama'&&data.warnings?.length?' '+data.warnings.join(' '):''}${data.stale?' Se muestra el último catálogo en memoria.':''}`;
   $('more').hidden=!hasMore;$('more').textContent='Cargar más títulos';render();
   if(!hasMore)break;
  }
 }catch(error){if(id!==requestId)return;$('catalog-status').textContent=items.length?`${items.length} títulos disponibles. No se pudo ampliar: ${error.message}`:error.message;$('more').hidden=false;$('more').textContent='Reintentar';}
 finally{if(id===requestId){$('grid').setAttribute('aria-busy','false');$('more').disabled=false;}}
}
async function open(item,resume=null){
 if(globalThis.CLBDetails?.open({...item,section:item.section||kind},resume?.episode||resume))return;
 if(tvEdition){tvAvoidedProviders.clear();tvActiveProvider=null;tvRemoteTrial=false;tvResumeAt=null;}
 if(!activeItem(item)){$('catalog-status').textContent='Esta fuente se retiró porque no ofrece las historias completas.';return;}
 const section=item.section||kind;watchSection=section;watchItem=libraryItem({...item,section,kind:item.kind||(section==='documentary'?'movie':section)});resumeRecord=resume||watchItem&&library.find(watchItem);updateListButton();
 $('library-view').hidden=true;$('global-view').hidden=true;
  const id=++detailId;selected=null;activeEpisode=null;episodeButtons=[];filterPanel(null);stop();
  if(tvEdition)window.CLBTVWatchReset?.(item);
  $('catalog').hidden=true;$('watch').hidden=false;$('back').hidden=false;$('manual-tools').hidden=true;
  $('title').textContent=item.name;$('watch-type').textContent=kind==='movie'?'PELÍCULA':kind==='series'?'SERIE':'ANIME';
  $('watch-platform').textContent=platformText(item);
  $('watch-platform').hidden=!$('watch-platform').textContent;
  $('drama-validation').hidden=section!=='drama';$('drama-test-status').textContent='';
  $('description').textContent='';$('synopsis').hidden=true;$('episodes').replaceChildren();$('current-episode').hidden=true;
  $('play-status').textContent='Preparando reproducción…';$('play').disabled=true;$('alternative').disabled=true;window.scrollTo(0,0);
  try{
    let data;
    if(section==='tv'||item.kind==='tv'){await openTV(item,id);return;}
    if(item.kind==='archive'){data=await api('/api/documentaries/detail?id='+encodeURIComponent(item.id));}
    else if(section==='kids'){data=await api('/api/kids/detail?'+new URLSearchParams({kind:item.kind,id:item.id}));data={...data,kind:item.kind,playbackType:data.playbackType||(item.kind==='movie'?'movie':'series')};}
    else if(section==='movie'||section==='documentary'&&item.kind==='movie'){
      let tmdbId=/^[1-9]\d{0,11}$/.test(item.id)?String(item.id):null;
      const imdbId=item.imdbId||item.id;
      if(!tmdbId){try{tmdbId=(await api(`/api/movie?imdb=${encodeURIComponent(imdbId)}`)).id;}catch{}}
      data={...item,kind:'movie',playbackType:'movie',imdbId,tmdbId,episodes:[]};
    }else data=await api(`${/^(kitsu|mal|anilist):/.test(item.id)?'/api/anime/detail':'/api/series/detail'}?id=${encodeURIComponent(item.id)}`);
    if(id!==detailId)return;selected={...data,kind:data.kind||watchItem?.kind};optionIndex=resumeRecord?.streamIndex||0;
    if(watchItem){watchItem=libraryItem({...watchItem,name:data.name||watchItem.name,posterUrl:data.posterUrl||watchItem.posterUrl});updateListButton();}
    $('watch-type').textContent=section==='drama'?'DRAMA ASIÁTICO':section==='documentary'?'DOCUMENTAL':data.playbackType==='movie'?'PELÍCULA':data.kind==='anime'?'ANIME':'SERIE';
    $('quality').replaceChildren(option('auto','Automática'),option('720','720p'),option('1080','1080p'),option('2160','4K · según la fuente'));
    $('quality').value='auto';$('quality').disabled=false;
    $('title').textContent=data.name;$('description').textContent=data.description||'';$('synopsis').hidden=!data.description;
    $('language-label').hidden=data.playbackType==='file';$('tv-signal-label').hidden=true;
    $('language').value=resumeRecord?.language||(selected.kind==='anime'?'original':languages[section]);$('quality').value=tvEdition?'auto':resumeRecord?.quality||'auto';
    const movie=['movie','file'].includes(data.playbackType);$('episodes').hidden=movie;
    if(!movie){
      if(section==='drama')setupDramaValidation();
      const first=data.episodes.find(e=>e.season>0&&!e.upcoming&&!e.locked)||data.episodes.find(e=>!e.upcoming&&!e.locked);if(!first){episodes();$('play-status').textContent='No hay capítulos públicos compatibles para esta prueba.';return;}
      activeEpisode=resumeRecord?.episode?data.episodes.find(e=>e.season===resumeRecord.episode.season&&e.episode===resumeRecord.episode.episode&&!e.upcoming&&!e.locked):first;episodes();if(!activeEpisode){updateButtons();$('play-status').textContent='El capítulo guardado ya no aparece en esta ficha. Elige otro capítulo de las temporadas.';return;}
    }
    updateQuality();updateButtons();if(!globalThis.CineDataSaver?.enabled&&!tvEdition)play();else $('play-status').textContent=(tvEdition?'Ver ahora carga el vídeo y abre pantalla completa.':'Ahorro de datos · Pulsa Reproducir para cargar el vídeo.');
  }catch(error){if(id===detailId)$('play-status').textContent=error.message;}
}
function chosen(){return activeEpisode;}
function episodes(){
 if(tvEdition&&window.CLBTVEpisodes){window.CLBTVEpisodes(selected,watchItem,activeEpisode);return;}
 episodeButtons=[];$('episodes').replaceChildren();
 const seasons=[...new Set(selected.episodes.map(e=>e.season))].sort((a,b)=>a-b);
 for(const season of seasons){
  const entries=selected.episodes.filter(e=>e.season===season),group=element('details',undefined,'season-group');
  const summary=element('summary',`${season===0?'Especiales':'Temporada '+season} · ${entries.length} capítulos`);group.append(summary);if(resumeRecord?.episode?.season===season)group.open=true;
  const list=element('div',undefined,'season-episodes');
  for(const entry of entries){const button=element('button',`${entry.episode}. ${entry.name}${entry.locked?' · Bloqueado por la fuente':entry.upcoming?' · Próximamente':''}`);button.type='button';button.disabled=entry.upcoming||entry.locked;button.dataset.season=season;button.dataset.episode=entry.episode;
   button.addEventListener('click',()=>{activeEpisode=entry;optionIndex=0;updateQuality();updateButtons();play();});episodeButtons.push(button);list.append(button);
  }
  group.append(list);$('episodes').append(group);
 }
 updateButtons();
}
function syncMobilePlayback(){if(!tvEdition)mobilePlayback?.setContext({item:watchItem,episode:chosen()});}
function updateButtons(){
 syncMobilePlayback();
 if(selected?.playbackType==='live'){$('play').disabled=false;$('alternative').disabled=selected.streams.length<2;return;}
 const movie=['movie','file'].includes(selected?.playbackType),entry=chosen();
 $('play').disabled=!selected||(!movie&&(!entry||entry.upcoming||entry.locked));
 for(const button of episodeButtons)button.setAttribute('aria-current',String(Number(button.dataset.season)===entry?.season&&Number(button.dataset.episode)===entry?.episode));
 $('current-episode').hidden=movie||!entry;if(entry&&!movie)$('current-episode').textContent=`T${entry.season} · E${entry.episode} — ${entry.name}`;
}
function updateQuality(){
  if(tvEdition){$('quality').value='auto';$('preferences-hint').textContent='Calidad automática según la fuente. Entra en Pantalla completa para usar los controles de audio y subtítulos del vídeo.';return;}
  if(selected?.playbackType==='live')return;
  if(selected?.playbackType==='file'){$('quality').replaceChildren(option('auto','Archivo original'));$('quality').disabled=true;$('preferences-hint').textContent='Internet Archive · Idioma: '+selected.language+'. Sin pistas de subtítulos verificadas.';return;}
  const allowed=canChooseQuality(selected,chosen(),$('language').value);
  for(const o of $('quality').options)o.disabled=o.value==='2160'||(!allowed&&o.value!=='auto');
  if(!allowed)$('quality').value='auto';
  $('preferences-hint').textContent=allowed?'Idioma y calidad son preferencias según las pistas disponibles. Cambiar calidad puede reiniciar el vídeo.':'Elige audio, subtítulos y calidad dentro del vídeo si están disponibles. La calidad automática depende de la fuente.';
  if(selected?.kind==='anime')$('preferences-hint').textContent+=' Busca Latino primero y Castellano si no está disponible. Este selector expresa una preferencia: no confirma el doblaje ni cambia automáticamente las pistas del servidor.';
}
function remember(){if(watchItem)library.remember(watchItem,{episode:chosen(),language:$('language').value,quality:$('quality').value,streamIndex:selected?.playbackType==='file'?optionIndex:0});}
function playbackOptions(){const pc=/^http:\/\/(?:localhost|127\.0\.0\.1):4173$/.test(location.origin);return candidates(selected,chosen(),$('language').value,$('quality').value).filter(o=>(!pc||!['facilito','sh','to','vidfast','vidlink'].includes(o.provider))&&(!tvEdition||!tvAvoidedProviders.has(o.provider)));}
function play(){
  if($('play').disabled)return;
  if(tvEdition)$('quality').value='auto';
  if(selected?.playbackType==='file'){stop();const video=element('video');video.controls=true;video.playsInline=true;video.preload='metadata';optionIndex%=selected.streams.length;syncMobilePlayback();video.src=selected.streams[optionIndex].url;
    const saved=watchItem&&library.find(watchItem),snapshot=watchItem&&{...watchItem},streamIndex=optionIndex;let lastSave=-1,tracking=true,finished=false;
    video.addEventListener('loadedmetadata',()=>{if(tracking&&saved&&!saved.completed&&saved.streamIndex===streamIndex&&saved.position>0&&Number.isFinite(video.duration))video.currentTime=Math.min(saved.position,Math.max(0,video.duration-1));});
    const save=force=>{if(!tracking||finished||video.ended||!snapshot||!Number.isFinite(video.currentTime)||(!force&&Math.abs(video.currentTime-lastSave)<5))return;lastSave=video.currentTime;library.progress(snapshot,{position:video.currentTime,duration:video.duration,streamIndex});};
    video.persistProgress=()=>{save(true);tracking=false;};
    video.saveProgress=()=>save(true);
    video.addEventListener('timeupdate',()=>save(false));video.addEventListener('pause',()=>save(true));video.addEventListener('seeked',()=>save(true));video.addEventListener('ended',()=>{if(!tracking)return;finished=true;if(snapshot)library.progress(snapshot,{position:video.currentTime,duration:video.duration,streamIndex,completed:true});});remember();
    video.addEventListener('error',()=>{$('play-status').textContent='No se pudo reproducir este archivo. La fuente puede estar caída o el formato ser incompatible.';});$('player').append(video);$('alternative').disabled=selected.streams.length<2;$('play-status').textContent=`Archivo ${optionIndex+1} de ${selected.streams.length} · Internet Archive. Pulsa Play dentro del vídeo.`;return;}
  if(selected?.playbackType==='live'){live.play(selected,Number($('tv-signal').value)||0);return;}
  const options=playbackOptions();
  stop();$('alternative').disabled=options.length<2;
  if(!options.length){tvActiveProvider=null;$('play-status').textContent=tvEdition&&tvAvoidedProviders.size?'No quedan servidores para esta selección. En Opciones puedes restablecer los servidores.':'Esta ficha no tiene un identificador compatible para reproducir. Prueba el otro catálogo.';return;}
  optionIndex%=options.length;syncMobilePlayback();const active=options[optionIndex];
  if(tvEdition)tvActiveProvider=active.provider;
  const iframe=element('iframe');iframe.src=globalThis.CineRecovery?.decorate(active.url).href||active.url;iframe.title=selected.name;iframe.allow=active.provider==='cinesrc'?'autoplay; fullscreen; picture-in-picture; encrypted-media':'fullscreen; picture-in-picture; encrypted-media';iframe.allowFullscreen=true;iframe.referrerPolicy=active.provider==='facilito'?'origin':'no-referrer';
  if(location.origin!=='https://appassets.androidplatform.net')iframe.setAttribute('sandbox','allow-scripts allow-same-origin allow-presentation');
  // Las ventanas y la navegación superior las controla Android, sin sandbox del iframe.
  if(tvEdition&&active.provider==='cinesrc'&&tvResumeAt!==null){const resumed=new URL(iframe.src);resumed.searchParams.set('t',String(Math.floor(tvResumeAt)));resumed.searchParams.set('continueprompt','false');iframe.src=resumed.href;}tvResumeAt=null;
  if(tvEdition&&tvRemoteTrial&&active.provider==='cinesrc')iframe.src=window.CLBTVRemoteURL(iframe.src);
  if(!tvEdition&&active.provider==='cinesrc')iframe.src=mobilePlayback.decorate(iframe.src,watchItem,chosen());
  $('player').append(iframe);remember();if(!tvEdition)mobilePlayback.attach(iframe,active.provider,{item:watchItem,episode:chosen()});if(tvEdition&&tvRemoteTrial&&active.provider==='cinesrc')window.CLBTVRemoteAttach(iframe);remember();if(tvEdition)globalThis.CineRecovery?.watch(iframe,active.provider,()=>{if(!$('watch').hidden&&!suspendedPlayback){play();$('play-status').textContent='El servidor notificó un error. Se recargó una vez; pulsa Play si lo solicita.';}},()=>{$('play-status').textContent='El servidor sigue notificando errores. Usa Recargar servidor u Otro servidor.';});
  const quality=$('quality').value;
  const serverNames={facilito:'FacilitoPlay',sh:'VidSrc.sh',to:'VidSrc.to',vidlink:'VidLink',vidfast:'VidFast',cinesrc:'CineSrc'};
  $('play-status').textContent=`${serverNames[active.provider]||active.provider} · Servidor ${optionIndex+1} de ${options.length}. ${tvEdition?'Abre Pantalla completa para controlar el vídeo.':'Pulsa Play dentro del vídeo.'}${quality!=='auto'?(active.provider==='cinesrc'?` Calidad ${quality}p solicitada, si está disponible.`:' Esta opción gestiona la calidad dentro del vídeo.'):''} Comprueba audio y subtítulos en su menú.`;
}
function back(){
  if(tvEdition&&window.CLBTVBackToEpisodes?.())return true;
  if(['search-form','source-label','year-label','sort-label','genre-label','format-label'].some(id=>!$(id).hidden)){filterPanel(null);return true;}
  if(!$('section-menu').hidden){menu(false);$('menu-toggle').focus();return true;}
  if(!$('watch').hidden){++detailId;selected=null;stop();$('watch').hidden=true;restoreView();window.scrollTo(0,0);return true;}
  if(view!=='catalog'){chooseKind('movie');return true;}
  if(kind!=='movie'){chooseKind('movie');return true;}return false;
}
window.MobileAppBack=back;
window.MobileAppSuspend=()=>{
 mobilePlayback?.suspend?.();
 if($('watch').hidden||!selected||suspendedPlayback)return;
 const video=($('player').querySelectorAll?.('video')||[])[0];
 suspendedPlayback={detailId,selected,video,wasPlaying:!!video&&!video.paused&&!video.ended,status:$('play-status').textContent};
 if(selected.playbackType==='live')live.suspend();else if(video){video.saveProgress?.();video.pause();}
 // Conservar el iframe: WebView gestiona su suspensión nativa. No es accesible desde este origen.
 $('play-status').textContent='Reproductor conservado mientras la app está en segundo plano.';
};
window.MobileAppResume=()=>{
 mobilePlayback?.resume?.();
 const saved=suspendedPlayback;suspendedPlayback=null;
 if(!saved||saved.detailId!==detailId||saved.selected!==selected||$('watch').hidden)return;
 $('play-status').textContent=saved.status;
 if(selected.playbackType==='live'){live.resume();return;}
 if(saved.video){if(saved.wasPlaying)saved.video.play().catch(()=>{$('play-status').textContent='Pulsa Play dentro del vídeo para continuar desde la posición conservada.';});return;}
 $('play-status').textContent='Reproductor conservado. Si está en pausa, pulsa Play dentro del vídeo. Reproducir vuelve a cargar el servidor.';
};
$('back').addEventListener('click',back);
$('menu-toggle').addEventListener('click',()=>menu($('section-menu').hidden));
$('menu-backdrop').addEventListener('click',()=>menu(false));
document.addEventListener('keydown',event=>{if(event.key==='Escape'){filterPanel(null);menu(false);$('menu-toggle').focus();}});
document.querySelector('.brand').addEventListener('click',event=>{event.preventDefault();chooseKind('movie');});
for(const b of document.querySelectorAll('[data-kind]'))b.addEventListener('click',()=>chooseKind(b.dataset.kind));
$('search-form').addEventListener('submit',event=>{event.preventDefault();$('search').blur();filterPanel(null);load();});
$('search').addEventListener('input',()=>{clearTimeout(timer);++requestId;timer=setTimeout(()=>load(),500);});
for(const name of ['search','source','year','genre','sort','format'])$(name+'-tool').addEventListener('click',()=>filterPanel(name));
for(const id of ['year','genre','sort','format'])$(id).addEventListener('change',()=>{filterPanel(null);if(id==='format'&&kind==='drama'){filterIndicators();render();}else load();});
$('source').addEventListener('change',()=>{filterPanel(null);$('genre').value='all';$('format').value='all';load();});
$('more').addEventListener('click',()=>load(skip>0));
$('reset').addEventListener('click',()=>chooseKind(kind));
$('language').addEventListener('change',()=>{languages[watchSection]=$('language').value;optionIndex=0;updateQuality();if(tvEdition&&!$('player').querySelector('iframe,video'))return;if(!globalThis.CineDataSaver?.enabled||$('player').children.length)play();});
$('quality').addEventListener('change',()=>{if(selected?.playbackType==='live'){live.setQuality($('quality').value);return;}optionIndex=0;if(!globalThis.CineDataSaver?.enabled||$('player').children.length)play();});
$('play').addEventListener('click',()=>{if(!tvEdition||!$('player').querySelector('iframe,video'))play();if(tvEdition)window.CLBTVStartPlayer?.();});
$('reload-player').addEventListener('click',()=>{if(!selected||$('watch').hidden||$('play').disabled)return;globalThis.CineRecovery?.reset();play();$('play-status').textContent+=' · Servidor recargado. El minuto se conserva solo si la fuente lo permite.';});
$('app-fullscreen').hidden=location.origin!=='https://appassets.androidplatform.net';
window.MobileAppFullscreen=enabled=>{document.body.classList[enabled?'add':'remove']('clb-fullscreen');$('exit-fullscreen').hidden=true;};
$('alternative').addEventListener('click',()=>{if(selected?.playbackType==='live'){$('tv-signal').value=(Number($('tv-signal').value)+1)%selected.streams.length;play();return;}optionIndex++;play();});
async function openTV(item,id){
 const d=await api('/api/tv/channel?id='+encodeURIComponent(item.id));if(id!==detailId)return;
 if(watchSection==='kids'&&!d.categories.includes('kids'))throw Error('Canal sin clasificación infantil.');
 selected={...d,kind:'tv',playbackType:'live',episodes:[]};$('title').textContent=d.name;$('watch-type').textContent='TV EN VIVO';$('watch-platform').textContent=d.country+' · IPTV-org';
 $('watch-platform').hidden=false;
 for(const label of ['language-label'])$(label).hidden=true;$('episodes').hidden=true;$('tv-signal-label').hidden=false;$('tv-signal').replaceChildren();
 d.streams.forEach((source,i)=>$('tv-signal').append(option(i,`${i+1}. ${source.title} · ${source.quality}`)));
 $('preferences-hint').textContent='Calidad automática o variantes que ofrezca la emisión. Las señales pueden estar caídas o restringidas por región.';updateButtons();if(!globalThis.CineDataSaver?.enabled&&!tvEdition)play();else $('play-status').textContent=(tvEdition?'Ver ahora abre la emisión en pantalla completa.':'Ahorro de datos · Pulsa Reproducir para cargar la señal.');
}
$('tv-signal').addEventListener('change',play);
$('manual-form').addEventListener('submit',event=>{event.preventDefault();const id=$('manual-id').value.trim();if(kind!=='movie'||!/^(?:tt\d{7,12}|[1-9]\d{0,11})$/.test(id))return;open({id,name:$('manual-title').value.trim()||'Película manual',genres:[]});});

function updateListButton(){
 $('save-list').disabled=!watchItem;$('save-list').setAttribute('aria-pressed',String(!!watchItem&&library.has(watchItem)));$('save-list').textContent=watchItem&&library.has(watchItem)?'✓ En mi lista':'＋ Mi lista';
}
function resumeCard(record){
 const card=createCard(record.item,()=>open(record.item,record));
 const position=record.position>0?Math.floor(record.position/60)+' min':null;
 card.append(element('small',record.episode?`T${record.episode.season} · E${record.episode.episode}`:position?'Retomar · '+position:'Volver a abrir','resume-label'));
 if(record.duration>0){const bar=element('progress');bar.max=record.duration;bar.value=Math.min(record.position,record.duration);bar.setAttribute('aria-label','Progreso del vídeo');card.append(bar);}
 return card;
}
function renderContinue(){
 const records=library.history().filter(r=>r.item.section===kind&&activeItem(r.item));
 $('continue-shelf').hidden=!!$('search').value.trim()||kind==='tv'||!records.length;
 CLBShelves.render($('continue-shelf'),[],item=>resumeCard(item.record),{controls:false,notes:false,leading:{name:'Continuar viendo',items:records.slice(0,20).map(record=>({record}))}});
}
function restoreView(){
 $('catalog').hidden=view!=='catalog';$('library-view').hidden=view!=='library';$('global-view').hidden=view!=='global';$('back').hidden=view==='catalog';$('manual-tools').hidden=view!=='catalog'||kind!=='movie';$('family-note').hidden=view!=='catalog'||kind!=='kids';$('drama-note').hidden=view!=='catalog'||kind!=='drama';
 if(view==='library')renderLibrary();else if(view==='global')renderGlobal();else render();
}
function openLibrary(type){
 menu(false);filterPanel(null);++requestId;++detailId;++searchToken;selected=null;stop();view='library';libraryType=type;$('watch').hidden=true;restoreView();window.scrollTo(0,0);
}
function renderLibrary(){
 covers.reset();const records=(libraryType==='favorites'?library.favorites():library.history()).filter(r=>activeItem(r.item));$('library-heading').textContent=libraryType==='favorites'?'Mi lista':'Continuar viendo';$('library-grid').replaceChildren();
 $('library-status').textContent=records.length?`${records.length} títulos guardados en este teléfono.`:libraryType==='favorites'?'Tu lista está vacía. Abre un título y toca ＋ Mi lista.':'Aquí aparecerán los títulos y capítulos que abras. En vídeos externos se recuerda el capítulo, sin minuto exacto.';
 for(const record of records){const entry=element('div',undefined,'library-entry');entry.append(libraryType==='history'?resumeCard(record):createCard(record.item,()=>open(record.item)));const remove=element('button','Quitar', 'library-remove');remove.type='button';remove.setAttribute('aria-label','Quitar '+record.item.name);remove.addEventListener('click',()=>{if(library.remove(libraryType,record.item))renderLibrary();});entry.append(remove);$('library-grid').append(entry);}
 for(const [id,type]of [['list-tab','favorites'],['history-tab','history']])$(id).setAttribute('aria-pressed',String(libraryType===type));
}
function openGlobal(){
 menu(false);filterPanel(null);++requestId;++detailId;selected=null;stop();view='global';$('watch').hidden=true;restoreView();$('global-query').focus();window.scrollTo(0,0);
}
async function searchEverywhere(){
 const q=$('global-query').value.trim(),token=++searchToken;searchGroups=new Map();renderGlobal();
 if(!q){$('global-status').textContent='Escribe un título para buscar.';return;}
 $('global-query').blur();$('global-status').textContent='Buscando en todas las secciones…';
 try{await globalSearch.search(q,result=>{if(token!==searchToken)return;searchGroups.set(result.key,result);renderGlobal();});if(token===searchToken)$('global-status').textContent='Resultados por sección. La disponibilidad de vídeo depende de la fuente.';}catch(e){if(token===searchToken)$('global-status').textContent=e.message;}
}
async function moreGlobal(key){
 const state=searchGroups.get(key),token=searchToken;searchGroups.set(key,{...state,status:'loading'});renderGlobal();
 try{const next=await(state.items.length?globalSearch.more(state):globalSearch.retry(state));if(token===searchToken){searchGroups.set(key,next);renderGlobal();}}catch(e){if(token===searchToken){searchGroups.set(key,{...state,status:'error',error:e.message});renderGlobal();}}
}
function renderGlobal(){
 covers.reset();const positions=new Map([...($('global-results').querySelectorAll?.('.genre-row')||[])].map(row=>[row.getAttribute('aria-label'),row.scrollLeft]));$('global-results').replaceChildren();
 for(const spec of searchSections){const state=searchGroups.get(spec.key);if(!state)continue;const shelf=element('section',undefined,'genre-shelf'),head=element('div',undefined,'genre-heading');head.append(element('h3',spec.label),element('span',`${state.items.length} títulos`,'shelf-count'));shelf.append(head);
 if(state.status==='loading')shelf.append(element('p','Consultando…','hint'));if(state.status==='error')shelf.append(element('p',state.error,'hint'));
 const row=element('div',undefined,'genre-row');row.setAttribute('aria-label',spec.label);for(const item of state.items)row.append(createCard(item));if(!state.items.length&&state.status==='ready')row.append(element('p','Sin coincidencias en esta sección.','hint'));shelf.append(row);row.scrollLeft=positions.get(spec.label)||0;
 if(state.hasMore||state.status==='error'){const button=element('button',state.status==='error'?'Reintentar':'Más resultados','subtle');button.disabled=state.status==='loading';button.type='button';button.addEventListener('click',()=>moreGlobal(spec.key));shelf.append(button);}if(state.warnings?.length)shelf.append(element('p','Algunas fuentes no respondieron.','hint'));$('global-results').append(shelf);
 }
}
$('save-list').addEventListener('click',()=>{if(watchItem&&library.toggle(watchItem))updateListButton();});
$('open-list').addEventListener('click',()=>openLibrary('favorites'));
$('open-history').addEventListener('click',()=>openLibrary('history'));
$('list-tab').addEventListener('click',()=>{libraryType='favorites';renderLibrary();});
$('history-tab').addEventListener('click',()=>{libraryType='history';renderLibrary();});
$('open-global').addEventListener('click',openGlobal);
$('global-form').addEventListener('submit',event=>{event.preventDefault();searchEverywhere();});
function setupDramaValidation(){
 const record=dramaTests.get(String(watchItem.id),selected);$('drama-result').value=record.status;$('drama-count').value=record.count;$('drama-finished').checked=!!record.finished;
 $('drama-test-status').textContent=(selected.availabilityNote||'Comprueba los capítulos y el final. El resultado se guarda como prueba manual.')+(record.changed?' La ficha cambió: vuelve a validarla.':'');
}
$('drama-test-form').addEventListener('submit',event=>{event.preventDefault();if(watchSection!=='drama'||!selected||!watchItem)return;try{if(dramaTests.set(String(watchItem.id),{status:$('drama-result').value,count:Number($('drama-count').value),finished:$('drama-finished').checked},selected))$('drama-test-status').textContent='Prueba manual guardada: '+dramaStatuses[$('drama-result').value]+'.';}catch(e){$('drama-test-status').textContent=e.message;}});
const initialSection=location.pathname==='/dramas'?'drama':location.pathname==='/documentales'?'documentary':new URLSearchParams(location.search||'').get('section');
chooseKind(Object.hasOwn(labels,initialSection)&&initialSection!=='archive'?initialSection:'movie');



if(tvEdition)installTVNavigation({actions:{play,stop,trialRemote:()=>{const options=playbackOptions(),index=options.findIndex(o=>o.provider==='cinesrc');if(index<0){$('play-status').textContent='Esta ficha o capítulo no tiene una correspondencia CineSrc disponible. No se cambiará a otro título.';return false;}tvRemoteTrial=true;optionIndex=index;play();return true;},originalRemote:time=>{tvRemoteTrial=false;tvResumeAt=Number.isFinite(time)&&time>=0?time:null;play();},getDetail:()=>({selected,item:watchItem,episode:activeEpisode}),canAvoid:()=>!!tvActiveProvider&&!!$('player').querySelector('iframe'),hasAvoided:()=>tvAvoidedProviders.size>0,avoidCurrent:()=>{if(!tvActiveProvider||!$('player').querySelector('iframe'))return;tvAvoidedProviders.add(tvActiveProvider);optionIndex=0;play();},restoreServers:()=>{tvAvoidedProviders.clear();optionIndex=0;play();},attachPoster:(art,item)=>covers.attach(art,item),chooseEpisode:entry=>{const match=selected?.episodes?.find(e=>e.season===entry.season&&e.episode===entry.episode&&!e.upcoming&&!e.locked);if(!match)return false;activeEpisode=match;optionIndex=0;stop();updateQuality();updateButtons();return true;}}});

// Solo las rutas web de documentales/dramas aceptan enlaces de la biblioteca de escritorio.
if(['/documentales','/dramas'].includes(location.pathname)&&new URLSearchParams(location.search).has('clb'))import('/web-library-core.mjs').then(({readRequest})=>{const request=readRequest(location.search,initialSection);if(request)open(request.item,request.episode?{episode:request.episode}:null);}).catch(()=>{$('play-status').textContent='No se pudo abrir la ficha guardada.';});
