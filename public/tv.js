const $=id=>document.getElementById(id);
const categories={auto:'Autos',animation:'Animación',business:'Negocios',classic:'Clásicos',comedy:'Comedia',cooking:'Cocina',culture:'Cultura',documentary:'Documentales',education:'Educación',entertainment:'Entretenimiento',family:'Familia',general:'General',kids:'Infantil',legislative:'Legislativo',lifestyle:'Estilo de vida',movies:'Películas',music:'Música',news:'Noticias',outdoor:'Aire libre',relax:'Relax',religious:'Religión',science:'Ciencia',series:'Series',shop:'Compras',sports:'Deportes',travel:'Viajes',weather:'Clima'};
const displayNames=new Intl.DisplayNames(['es'],{type:'region'});
let countries=new Map(),channels=[],skip=0,request=0,controller,timer,active=null,hls=null,playRequest=0;
function element(tag,text,className){const e=document.createElement(tag);if(text!==undefined)e.textContent=text;if(className)e.className=className;return e;}
function option(value,text){const e=element('option',text);e.value=value;return e;}
function countryName(code){try{return displayNames.of(code)||countries.get(code)?.name||code;}catch{return code||'País no informado';}}
async function api(path,signal){const r=await fetch(path,{signal:signal||AbortSignal.timeout(35000)});const d=await r.json();if(!r.ok)throw Error(d.error||'No se pudo consultar TV.');return d;}
function render(){
  $('channels').replaceChildren();
  if(!channels.length)$('channels').append(element('p',$('channels').getAttribute('aria-busy')==='true'?'Consultando canales…':'No hay canales con estos filtros. Prueba otro país o categoría.','muted'));
  for(const c of channels){
    const b=element('button',undefined,'channel-card');b.type='button';b.setAttribute('aria-label',`Ver ${c.name}`);
    b.append(element('span',countries.get(c.country)?.flag||'TV','channel-mark'),element('b',c.name),element('small',`${countryName(c.country)} · ${c.categories.map(id=>categories[id]||id).join(', ')||'General'}`),element('small',`${c.sourceCount} ${c.sourceCount===1?'señal':'señales'} · ${c.qualities.join(' / ')}`),element('span','VER EN DIRECTO →','watch-label'));
    b.addEventListener('click',()=>open(c));$('channels').append(b);
  }
}
async function load(append=false){
  clearTimeout(timer);const id=++request;controller?.abort();controller=new AbortController();
  $('channels').setAttribute('aria-busy','true');$('more').disabled=true;$('reload').hidden=true;
  if(!append){channels=[];skip=0;}render();
  const params=new URLSearchParams({country:$('country').value,category:$('category').value,q:$('search').value.trim(),skip:String(skip)});
  const label=$('country').value==='all'?'todos los países disponibles':countryName($('country').value);
  $('catalog-status').textContent=`Consultando ${label}…`;
  try{
    const d=await api('/api/tv/catalog?'+params,AbortSignal.any([controller.signal,AbortSignal.timeout(35000)]));if(id!==request)return;
    channels=[...new Map([...channels,...d.channels].map(c=>[c.id,c])).values()];skip=d.nextSkip;
    $('more').hidden=!d.hasMore;$('catalog-status').textContent=`${channels.length} de ${d.total} canales · ${label} · Señales por comprobar.${d.stale?' La fuente no respondió; se muestra el último catálogo en memoria.':''}`;
  }catch(error){if(id!==request)return;$('catalog-status').textContent=error.message;$('reload').hidden=false;$('more').hidden=true;}
  finally{if(id===request){$('channels').setAttribute('aria-busy','false');$('more').disabled=false;render();}}
}
async function init(){
  $('reload').hidden=true;$('catalog-status').textContent='Cargando países y canales…';
  try{
    const d=await api('/api/tv/filters');countries=new Map(d.countries.map(c=>[c.code,c]));
    $('country').replaceChildren(option('all','Todos los países disponibles'));
    for(const c of [...d.countries].sort((a,b)=>countryName(a.code).localeCompare(countryName(b.code),'es')))$('country').append(option(c.code,`${c.flag} ${countryName(c.code)} · ${c.count}`));
    $('category').replaceChildren(option('all','Todas las categorías'));for(const c of d.categories.filter(c=>c.id!=='xxx').sort((a,b)=>(categories[a.id]||a.name).localeCompare(categories[b.id]||b.name,'es')))$('category').append(option(c.id,categories[c.id]||c.name));
    const params=new URLSearchParams(window.location.search);
    const country=params.get('country'),category=params.get('category');
    $('country').value=country==='all'||countries.has(country)?country:countries.has('MX')?'MX':'all';
    if([...$('category').options].some(o=>o.value===category))$('category').value=category;
    $('coverage').textContent=`${d.total.toLocaleString('es-MX')} canales · ${d.countries.length} países y territorios`;
    await load();
    const channel=params.get('channel');
    if(channel&&channel.length<180){try{const c=await api('/api/tv/channel?id='+encodeURIComponent(channel));if($('category').value==='kids'&&!c.categories.includes('kids'))throw Error('El canal no está clasificado como infantil.');await open(c);}catch(error){$('catalog-status').textContent+=' '+error.message;}}
  }catch(error){$('catalog-status').textContent=error.message;$('reload').hidden=false;$('channels').setAttribute('aria-busy','false');}
}
function clearPlayer(){if(hls){hls.destroy();hls=null;}$('tv-video').pause();$('tv-video').removeAttribute('src');$('tv-video').load();}
function stop(){++playRequest;active=null;clearPlayer();$('watch').hidden=true;}
function failure(message){$('player-status').textContent=`${message} Prueba otra señal o el sitio del canal. Puede existir bloqueo regional, CORS, formato incompatible o una emisión caída.`;}
async function open(channel){
  const id=++playRequest;active=null;clearPlayer();$('watch').hidden=false;$('channel-name').textContent=channel.name;$('channel-meta').textContent=countryName(channel.country);
  $('signal').replaceChildren();$('retry').disabled=true;$('official').hidden=true;$('player-status').textContent='Preparando señal…';$('watch').scrollIntoView({behavior:'smooth',block:'start'});
  try{
    const d=await api('/api/tv/channel?id='+encodeURIComponent(channel.id));if(id!==playRequest)return;active=d;
    d.streams.forEach((s,i)=>$('signal').append(option(i,`${i+1}. ${s.title} · ${s.quality}${s.labels.length?' · '+s.labels.join(', '):''}`)));
    if(d.website){$('official').href=d.website;$('official').hidden=false;}
    $('retry').disabled=false;play();
  }catch(error){if(id===playRequest)$('player-status').textContent=error.message;}
}
function play(){
  if(!active)return;const source=active.streams[Number($('signal').value)];if(!source)return;
  clearPlayer();$('quality').replaceChildren(option('auto','Automática'));$('quality').disabled=true;
  $('player-status').textContent='Conectando con la emisión. Pulsa Play si el navegador lo solicita…';
  const video=$('tv-video');
  if(globalThis.Hls?.isSupported()){
    const player=hls=new Hls({enableWorker:true,backBufferLength:globalThis.CineDataSaver?.enabled?0:30,maxBufferLength:globalThis.CineDataSaver?.enabled?10:30});
    player.on(Hls.Events.MANIFEST_PARSED,()=>{
      if(hls!==player)return;
      if(globalThis.CineDataSaver?.enabled){const levels=player.levels.map((l,i)=>({l,i})).filter(x=>x.l.height>0&&x.l.height<=720);player.autoLevelCapping=levels.length?levels.sort((a,b)=>b.l.height-a.l.height)[0].i:0;}
      player.levels.forEach((level,i)=>$('quality').append(option(i,`${level.height?level.height+'p':'Nivel '+(i+1)}${level.bitrate?' · '+(level.bitrate/1e6).toFixed(1)+' Mbps':''}`)));
      $('quality').disabled=player.levels.length<2;
      $('player-status').textContent='Señal recibida. Pulsa Play. La calidad automática se adapta a las variantes disponibles.';
      video.play().catch(()=>{});
    });
    player.on(Hls.Events.ERROR,(_,data)=>{if(hls===player&&data.fatal){failure('No se pudo reproducir esta señal.');player.destroy();hls=null;}});
    player.loadSource(source.url);player.attachMedia(video);
  }else if(video.canPlayType('application/vnd.apple.mpegurl')){video.src=source.url;video.play().catch(()=>{});}
  else failure('Este navegador no admite HLS. Prueba Chrome, Edge o Safari actualizado.');
}
$('quality').addEventListener('change',()=>{if(hls)hls.currentLevel=$('quality').value==='auto'?-1:Number($('quality').value);});
$('tv-video').addEventListener('playing',()=>{if(active)$('player-status').textContent=`En reproducción · ${active.name} · ${$('quality').value==='auto'?'calidad automática':'calidad seleccionada'}`;});
$('tv-video').addEventListener('error',()=>{if(active)failure('El navegador no pudo abrir el vídeo.');});
$('signal').addEventListener('change',play);$('retry').addEventListener('click',play);$('stop').addEventListener('click',stop);
$('filters').addEventListener('submit',e=>{e.preventDefault();load();});
for(const id of ['country','category'])$(id).addEventListener('change',()=>load());
$('search').addEventListener('input',()=>{clearTimeout(timer);++request;controller?.abort();timer=setTimeout(()=>load(),400);});
$('more').addEventListener('click',()=>load(true));$('reload').addEventListener('click',()=>countries.size?load():init());
window.addEventListener('pagehide',stop);init();
