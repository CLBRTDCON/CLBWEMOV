// Extensión de escritorio: biblioteca local, sin sustituir los reproductores.
(() => {
 let library,core,tracker,searchEngine,active=null,saveButton,section,renderToken=0;
 const element=(tag,text,cls)=>{const e=document.createElement(tag);if(text!==undefined)e.textContent=text;if(cls)e.className=cls;return e;};
 const ready=Promise.all([import('/mobile/library.mjs'),import('/web-library-core.mjs'),import('/mobile/global-search.mjs'),import('/mobile/mobile-playback.mjs')]).then(([lib,c,search,playback])=>{
  core=c;library=lib.createLibrary({onError:message=>notice(message.replace('en el teléfono','en este navegador'))});
  searchEngine=search.createGlobalSearch({api:async path=>{const r=await fetch(path,{signal:AbortSignal.timeout(50000)});const d=await r.json();if(!r.ok)throw Error(d.error||'No se pudo consultar.');return d;}});
  tracker=playback.installMobilePlayback({document:{getElementById:()=>({set textContent(value){notice(value);}}),get hidden(){return document.hidden;}},window,library,recover:false,actions:{reload:()=>document.getElementById('reload-player')?.click()}});
  initHub();return library;
 }).catch(error=>{notice('La biblioteca no está disponible. '+error.message);return null;});
 function notice(text){let n=document.getElementById('web-notice');if(!n){n=element('p',undefined,'hint');n.id='web-notice';n.setAttribute('role','status');document.querySelector('main').prepend(n);}n.textContent=text;}
 function thumbnail(item){const art=element('div',undefined,'web-poster');art.append(element('span',item.name));if(item.posterUrl){const img=element('img');img.src=globalThis.CineDataSaver?.poster(item.posterUrl)||item.posterUrl;img.alt='';img.loading='lazy';img.decoding='async';img.referrerPolicy='no-referrer';img.addEventListener('error',()=>img.remove(),{once:true});art.append(img);}return art;}
 function card(record,removeType){
  const item=record.item,box=element('article',undefined,'web-entry'),link=element('a',undefined,'web-card');link.href=core.itemURL(item,record.episode||(removeType==='favorites'?library.find(item)?.episode:null));link.append(thumbnail(item),element('b',item.name));
  const parts=[core.sectionNames[item.section],record.episode?`T${record.episode.season} · E${record.episode.episode}`:item.year||''];
  link.append(element('small',parts.filter(Boolean).join(' · ')));
  if(record.position>0&&record.duration>0){const progress=element('progress');progress.max=record.duration;progress.value=record.position;progress.setAttribute('aria-label','Progreso confirmado');link.append(progress,element('small',`Continuar desde ${Math.floor(record.position/60)}:${String(Math.floor(record.position%60)).padStart(2,'0')}`));}
  else if(removeType==='history')link.append(element('small','Último título abierto · minuto no informado'));
  box.append(link);
  if(removeType){const remove=element('button',removeType==='favorites'?'Quitar de Mi lista':'Quitar de Continuar viendo','subtle web-remove');remove.type='button';remove.addEventListener('click',()=>{if(library.remove(removeType,item)){renderShelf();renderHub();updateSave();}});box.append(remove);}
  return box;
 }
 function renderShelf(){
  const shelf=document.getElementById('web-continue');if(!shelf||!library)return;
  const rows=core.sectionRecords(library.history(),section);shelf.replaceChildren();shelf.hidden=!rows.length;if(!rows.length)return;
  const heading=element('div',undefined,'section-title'),all=element('a','Ver historial');all.href='/biblioteca?view=history';heading.append(element('h2','Continuar viendo'),all);const list=element('div',undefined,'web-shelf');for(const r of rows.slice(0,12))list.append(card(r));shelf.append(heading,list);
 }
 function updateSave(){if(saveButton){saveButton.disabled=!active;saveButton.textContent=active&&library.has(active)?'✓ En Mi lista':'+ Mi lista';saveButton.setAttribute('aria-pressed',String(!!active&&library.has(active)));}}
 function initHub(){
  if(!document.getElementById('web-hub'))return;
  document.getElementById('web-search-form').addEventListener('submit',async event=>{
   event.preventDefault();const q=document.getElementById('web-search').value.trim();if(!q)return;const token=++renderToken;
   document.getElementById('web-hub-title').textContent=`Resultados de «${q}»`;document.getElementById('web-hub-results').replaceChildren();
   for(const a of document.querySelectorAll('[data-library-view]'))a.removeAttribute('aria-current');
   const sections=new Map();try{await searchEngine.search(q,state=>{if(token!==renderToken)return;let group=sections.get(state.key);if(!group){group=element('section',undefined,'web-result-group');sections.set(state.key,group);document.getElementById('web-hub-results').append(group);}group.replaceChildren(element('h2',core.sectionNames[state.key]));const rows=state.items.filter(core.visibleItem);group.append(element('p',state.status==='loading'?'Buscando…':state.error||(!rows.length?'Sin resultados.':`${rows.length} títulos`),'hint'));const grid=element('div',undefined,'web-library-grid');for(const item of rows)grid.append(card({item}));group.append(grid);if(state.warnings?.length)group.append(element('p',state.warnings.join(' · '),'hint'));if(state.hasMore){const more=element('button','Cargar más','subtle');more.addEventListener('click',async()=>{more.disabled=true;try{const result=await searchEngine.more(state);if(token===renderToken){state=result;group.replaceChildren(element('h2',core.sectionNames[state.key]));const list=element('div',undefined,'web-library-grid');for(const item of state.items.filter(core.visibleItem))list.append(card({item}));group.append(list);if(state.hasMore)group.append(more);}}catch(e){notice(e.message);}finally{more.disabled=false;}});group.append(more);}});}catch(e){notice(e.message);}
  });
  for(const b of document.querySelectorAll('[data-library-view]'))b.addEventListener('click',()=>{++renderToken;document.getElementById('web-hub').dataset.view=b.dataset.libraryView;renderHub();});
  const requestedView=new URLSearchParams(location.search).get('view');if(['favorites','history','search'].includes(requestedView))document.getElementById('web-hub').dataset.view=requestedView;
  renderHub();
 }
 function renderHub(){
  const hub=document.getElementById('web-hub');if(!hub||!library)return;const view=hub.dataset.view;
  const type=view==='history'?'history':'favorites';document.getElementById('web-hub-title').textContent=view==='search'?'Buscar en todo':type==='history'?'Continuar viendo':'Mi lista';
  for(const b of document.querySelectorAll('[data-library-view]')){if(b.dataset.libraryView===view)b.setAttribute('aria-current','page');else b.removeAttribute('aria-current');}
  const list=document.getElementById('web-hub-results');list.replaceChildren();if(view==='search'){list.append(element('p','Busca películas, series, anime, Kids, documentales, dramas y canales desde un solo lugar.','hint'));document.getElementById('web-search').focus();return;}
  const rows=core.sectionRecords(library[type]());if(!rows.length){list.append(element('p',type==='favorites'?'Guarda títulos desde su ficha con + Mi lista.':'Aquí aparecerán los títulos que abras. El minuto solo se muestra cuando la fuente lo informa.','hint'));return;}
  const grid=element('div',undefined,'web-library-grid');for(const row of rows)grid.append(card(row,type));list.append(grid);
 }
 window.CLBWeb={
  connect(config){section=config.section;ready.then(lib=>{if(!lib)return;if(config.catalog){const shelf=element('section');shelf.id='web-continue';shelf.hidden=true;document.getElementById(config.catalog)?.prepend(shelf);renderShelf();}
   if(config.actions){saveButton=element('button','+ Mi lista','subtle');saveButton.type='button';saveButton.disabled=true;saveButton.addEventListener('click',()=>{if(active){library.toggle(active);updateSave();renderHub();}});document.querySelector(config.actions)?.prepend(saveButton);}
   const requested=core.readRequest(location.search,section);if(requested)config.open(requested.item,requested.episode);
  });},
  setItem(item){active=item;ready.then(lib=>{if(lib)updateSave();});},
  track(frame,provider,item,episode=null){const snapshot=structuredClone(item),ep=episode?{season:episode.season,episode:episode.episode}:null;ready.then(lib=>{if(!lib||!frame.isConnected)return;tracker.detach();library.remember(snapshot,{episode:ep});tracker.setContext({item:snapshot,episode:ep});tracker.attach(frame,provider,{item:snapshot,episode:ep});renderShelf();});},
  decorate(url,item,episode=null){return tracker?new URL(tracker.decorate(String(url),item,episode)):url;},
  stop(){tracker?.detach();renderShelf();},
 };
 document.addEventListener('visibilitychange',()=>{if(document.hidden)tracker?.suspend();});
 window.addEventListener('pagehide',()=>tracker?.detach());
})();
