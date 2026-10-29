import {candidates,canChooseQuality} from '/player-policy.mjs';
const $=id=>document.getElementById(id),labels={all:'Todo Kids',movie:'Películas',series:'Series',anime:'Anime',tv:'TV infantil'};
let releases={name:'Últimos lanzamientos Kids',items:[],message:'Consultando estrenos…'};
let kind='all',sections=[],request=0,controller,timer,nextSkip=0,detailRequest=0,selected=null,optionIndex=0;
function element(tag,text,className){const e=document.createElement(tag);if(text!==undefined)e.textContent=text;if(className)e.className=className;return e;}
function option(value,text){const e=element('option',text);e.value=value;return e;}
async function api(path,signal){const r=await fetch(path,{signal:signal||AbortSignal.timeout(50000)});const d=await r.json();if(!r.ok)throw Error(d.error||'No se pudo consultar esta historia.');return d;}
function changeKind(value){kind=value;for(const b of document.querySelectorAll('[data-kids-kind]'))b.setAttribute('aria-pressed',String(b.dataset.kidsKind===kind));
  $('theme').disabled=kind==='tv';$('kids-year').disabled=kind==='tv';if(kind==='tv'){$('theme').value='all';$('kids-year').value='all';}load();}
function createCard(item){
  const card=element('button',undefined,'kids-card movie-card');card.type='button';card.setAttribute('aria-label',`Ver ${item.name}`);
  const art=element('div',undefined,'kids-poster poster');art.append(element('span',item.kind==='tv'?'● TV '+item.name:item.name));
  if(item.posterUrl){const img=element('img');img.src=globalThis.CineDataSaver.poster(item.posterUrl);img.alt='';img.loading='lazy';img.referrerPolicy='no-referrer';img.addEventListener('error',()=>img.remove());art.append(img);}
  card.append(art,element('b',item.name),element('small',item.kind==='tv'?item.country+' · En directo':String(item.year||'Año no informado')),element('small',labels[item.kind],'kind-tag'));
  card.addEventListener('click',()=>open(item));return card;
}
function render(){
  const searching=!!$('kids-search').value.trim(),items=sections.flatMap(s=>s.items.filter(i=>i.kind!=='tv'));
  const leading=searching||kind==='tv'?null:{...releases,items:releases.items.filter(i=>kind==='all'||i.kind===kind)};
  CLBShelves.render($('kids-results'),items,createCard,{labels:{Family:'En familia',Kids:'Infantil',Animation:'Animación',Comedy:'Comedia',Adventure:'Aventuras',Fantasy:'Fantasía',Action:'Acción',Drama:'Drama',Music:'Música',Short:'Historias cortas',SciFi:'Ciencia ficción'},search:searching,leading,emptyText:'Sin historias con estos filtros. Prueba otra búsqueda o carga más.'});
  const tv=sections.find(s=>s.kind==='tv');
  if(tv){const shelf=element('section',undefined,'kids-shelf'),heading=element('div',undefined,'shelf-heading');heading.append(element('h3',tv.title));if(kind==='all'){const more=element('button','Ver más canales →','subtle');more.type='button';more.addEventListener('click',()=>changeKind('tv'));heading.append(more);}const grid=element('div',undefined,'kids-grid');for(const item of kind==='all'?tv.items.slice(0,12):tv.items)grid.append(createCard(item));shelf.append(heading,grid);$('kids-results').append(shelf);}
  $('surprise').disabled=!(items.length||leading?.items.length);
}
async function load(append=false){
  clearTimeout(timer);const id=++request;controller?.abort();controller=new AbortController();
  let releasesTask=Promise.resolve();
  if(!append&&!$('kids-search').value.trim()&&kind!=='tv'){
    releases={name:'Últimos lanzamientos Kids',items:[],message:'Consultando estrenos…'};
    releasesTask=api('/api/releases?'+new URLSearchParams({kind:'kids',selection:kind,year:$('kids-year').value,theme:$('theme').value})).then(d=>{if(id!==request)return;releases={name:'Últimos lanzamientos Kids',items:d.items,note:d.note,message:'No hay estrenos con fecha confirmada para esta selección infantil.'};render();}).catch(error=>{if(id===request){releases={name:'Últimos lanzamientos Kids',items:[],message:error.message};render();}});
  }
  if(!append){sections=[];nextSkip=0;render();}$('kids-results').setAttribute('aria-busy','true');$('kids-more').disabled=true;$('kids-retry').hidden=true;$('kids-status').textContent='Buscando historias para compartir…';
  try{
    const p=new URLSearchParams({kind,q:$('kids-search').value.trim(),theme:$('theme').value,year:$('kids-year').value,skip:String(nextSkip)});
    const d=await api('/api/kids/catalog?'+p,AbortSignal.any([controller.signal,AbortSignal.timeout(50000)]));if(id!==request)return;
    for(const incoming of d.sections){const old=append?sections.find(s=>s.kind===incoming.kind):null;if(old){old.items=[...new Map([...old.items,...incoming.items].map(i=>[i.id,i])).values()];Object.assign(old,{hasMore:incoming.hasMore,nextSkip:incoming.nextSkip,total:incoming.total});}else sections.push(incoming);}
    nextSkip=sections[0]?.nextSkip||0;$('kids-more').hidden=kind==='all'||!sections[0]?.hasMore;
    const count=sections.reduce((n,s)=>n+(kind==='all'?Math.min(12,s.items.length):s.items.length),0);
    $('kids-status').textContent=`${count} historias y canales para explorar · ${labels[kind]}.${$('kids-year').value!=='all'||$('theme').value!=='all'?' Los filtros se aplican a cada página.':''}${d.warnings.length?' Algunas secciones no respondieron: '+d.warnings.map(w=>labels[w.kind]).join(', ')+'.':''}${sections.some(s=>s.stale)?' TV muestra su último catálogo en memoria.':''}`;
    $('kids-retry').hidden=!d.warnings.length;render();
  }catch(error){if(id!==request)return;$('kids-status').textContent=error.message;$('kids-retry').hidden=false;$('kids-more').hidden=true;}
  finally{await releasesTask;if(id===request){$('kids-results').setAttribute('aria-busy','false');$('kids-more').disabled=false;}}
}
let webStory=null;
function stop(){window.CLBWeb?.stop();$('kids-catalog').hidden=false;++detailRequest;selected=null;$('kids-player').replaceChildren();$('kids-watch').hidden=true;}
async function open(item,resume=null){
  if(window.CLBDetails?.open({...item,section:'kids'},resume))return;
  if(item.kind==='tv'){window.location.assign('/tv?'+new URLSearchParams({category:'kids',country:'all',channel:item.id}));return;}
  stop();const id=detailRequest;$('kids-catalog').hidden=true;$('kids-watch').hidden=false;$('kids-title').textContent=item.name;$('kids-description').textContent='';$('kids-player-status').textContent='Preparando la historia…';
  for(const key of ['kids-play','kids-next','kids-alternative'])$(key).disabled=true;
  $('kids-season').replaceChildren();$('kids-episode').replaceChildren();$('kids-watch').scrollIntoView({behavior:'smooth',block:'start'});
  try{
    const d=await api('/api/kids/detail?'+new URLSearchParams({kind:item.kind,id:item.id}));if(id!==detailRequest)return;
    webStory={...item,...d,id:item.id,kind:item.kind,section:'kids'};window.CLBWeb?.setItem(webStory);
    selected={...d,kind:item.kind,playbackType:d.playbackType||(item.kind==='movie'?'movie':'series')};optionIndex=0;$('quality').value='auto';
    $('kids-title').textContent=d.name;$('kids-description').textContent=d.description||'';$('kids-language').value=item.kind==='anime'?'original':'latino';
    const movie=selected.playbackType==='movie';$('kids-season-label').hidden=movie;$('kids-episode-label').hidden=movie;
    if(!movie){
      for(const season of new Set(d.episodes.map(e=>e.season)))$('kids-season').append(option(season,season===0?'Especiales':`Temporada ${season}`));
      const first=d.episodes.find(e=>e.season>0&&!e.upcoming)||d.episodes.find(e=>!e.upcoming);
      if(!first){$('kids-player-status').textContent='No hay episodios publicados en esta ficha.';return;}$('kids-season').value=first.season;episodes();
    }
    if(resume&&!movie){const saved=d.episodes.find(e=>e.season===resume.season&&e.episode===resume.episode&&!e.upcoming&&!e.locked);if(!saved){$('kids-episode').value='';update();$('kids-player-status').textContent='El capítulo guardado no está disponible. Selecciona otro episodio.';return;}$('kids-season').value=saved.season;episodes();$('kids-episode').value=saved.episode;}
    update();if(!globalThis.CineDataSaver.enabled)play();else $('kids-player-status').textContent='Ahorro de datos · Pulsa Reproducir para cargar el vídeo.';
  }catch(error){if(id===detailRequest)$('kids-player-status').textContent=error.message;}
}
function chosen(){return selected?.episodes?.find(e=>e.season===Number($('kids-season').value)&&e.episode===Number($('kids-episode').value));}
function episodes(){
  $('kids-episode').replaceChildren();const list=selected.episodes.filter(e=>e.season===Number($('kids-season').value));
  for(const e of list){const o=option(e.episode,`${e.episode}. ${e.name}${e.upcoming?' · Próximo':''}`);o.disabled=e.upcoming;$('kids-episode').append(o);}const first=list.find(e=>!e.upcoming);if(first)$('kids-episode').value=first.episode;
}
function update(){
  const entry=chosen(),movie=selected?.playbackType==='movie',index=selected?.episodes?.indexOf(entry)??-1;
  $('kids-play').disabled=!selected||!movie&&(!entry||entry.upcoming);$('kids-next').disabled=movie||index<0||!selected.episodes.slice(index+1).some(e=>!e.upcoming);
  const manual=canChooseQuality(selected,entry,$('kids-language').value);for(const o of $('quality').options)o.disabled=o.value==='2160'||!manual&&o.value!=='auto';
  $('quality').disabled=!manual;if(!manual)$('quality').value='auto';
}
function play(){
  if($('kids-play').disabled)return;
  // Excluir proveedores que rechazan sandbox sin quitar la protección de Kids.
  const options=candidates(selected,chosen(),$('kids-language').value,$('quality').value).filter(s=>CinePlayback.sandboxed(s.provider));
  window.CLBWeb?.stop();$('kids-player').replaceChildren();$('kids-alternative').disabled=options.length<2;
  if(!options.length){$('kids-player-status').textContent='Esta ficha no tiene una señal compatible. Prueba otra historia.';return;}
  optionIndex%=options.length;const active=options[optionIndex],wanted=$('quality').value;
  CinePlayback.configureQuality(active.provider);if(active.provider==='cinesrc')$('quality').value=wanted;update();
  if(canChooseQuality(selected,chosen(),$('kids-language').value))$('quality-hint').textContent='Automática deja elegir a la fuente. Solicitar 720p/1080p prioriza una alternativa compatible y puede reiniciar el vídeo; depende de las versiones disponibles.';
  try{const frame=CinePlayback.frame(active.provider,window.CLBWeb?.decorate(new URL(active.url),webStory,selected.playbackType==='movie'?null:chosen())||new URL(active.url),selected.name);$('kids-player').append(frame);window.CLBWeb?.track(frame,active.provider,webStory,selected.playbackType==='movie'?null:chosen());$('kids-player-status').textContent=`${CinePlayback.providerName(active.provider)} · Servidor ${optionIndex+1} de ${options.length}. Elige audio latino o castellano y subtítulos en el menú del vídeo si están disponibles.`;}
  catch(error){$('kids-player-status').textContent=error.message;}
}
for(let year=new Date().getFullYear();year>=1920;year--)$('kids-year').append(option(year,year));
for(const b of document.querySelectorAll('[data-kids-kind]'))b.addEventListener('click',()=>changeKind(b.dataset.kidsKind));
$('search-form').addEventListener('submit',e=>{e.preventDefault();load();});$('kids-search').addEventListener('input',()=>{clearTimeout(timer);++request;controller?.abort();timer=setTimeout(()=>load(),450);});
for(const id of ['theme','kids-year'])$(id).addEventListener('change',()=>load());
$('reset').addEventListener('click',()=>{$('kids-search').value='';$('theme').value='all';$('kids-year').value='all';changeKind('all');});
$('kids-more').addEventListener('click',()=>load(true));$('kids-retry').addEventListener('click',()=>load());
$('surprise').addEventListener('click',()=>{const items=sections.flatMap(s=>s.items.filter(i=>i.kind!=='tv'));if(items.length)open(items[Math.floor(Math.random()*items.length)]);});
$('kids-close').addEventListener('click',()=>{stop();$('kids-catalog').scrollIntoView({behavior:'smooth'});});
$('kids-play').addEventListener('click',play);$('kids-alternative').addEventListener('click',()=>{optionIndex++;play();});
$('kids-season').addEventListener('change',()=>{episodes();optionIndex=0;update();play();});$('kids-episode').addEventListener('change',()=>{optionIndex=0;update();play();});
$('kids-language').addEventListener('change',()=>{optionIndex=0;update();play();});$('quality').addEventListener('change',()=>{optionIndex=0;play();});
$('kids-next').addEventListener('click',()=>{const entry=chosen(),index=selected?.episodes?.indexOf(entry)??-1,next=selected?.episodes?.slice(index+1).find(e=>!e.upcoming);if(!next)return;$('kids-season').value=next.season;episodes();$('kids-episode').value=next.episode;optionIndex=0;update();play();});
window.addEventListener('pagehide',stop);load();

$('reload-player').addEventListener('click',()=>{if(!selected)return;globalThis.CineRecovery.reset();play();});

window.CLBWeb?.connect({section:'kids',catalog:'kids-catalog',actions:'.watch-actions',open});
