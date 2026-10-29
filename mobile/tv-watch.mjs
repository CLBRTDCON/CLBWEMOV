// Ficha TV: episodios paginados antes de cargar cualquier reproductor.
export function episodePage(entries,season,page=0,size=6){
 const rows=entries.filter(e=>e.season===season),pages=Math.max(1,Math.ceil(rows.length/size));
 page=Math.max(0,Math.min(pages-1,Number.isInteger(page)?page:0));
 return {items:rows.slice(page*size,(page+1)*size),page,pages,total:rows.length};
}
export function nextEpisode(entries,current){
 if(!current)return null;
 const rows=entries.filter(e=>e.season>0).slice().sort((a,b)=>a.season-b.season||a.episode-b.episode),index=rows.findIndex(e=>e.season===current.season&&e.episode===current.episode),next=index<0?null:rows[index+1];
 return next&&!next.upcoming&&!next.locked?next:null;
}
export function installTVWatch({document,window,actions}){
 const $=id=>document.getElementById(id),watch=$('watch'),player=$('player');
 const make=(tag,id,text)=>{const el=document.createElement(tag);if(id)el.id=id;if(text)el.textContent=text;return el;};
 const button=(text,fn)=>{const b=make('button',null,text);b.type='button';b.addEventListener('click',fn);return b;};
 const picker=make('section','tv-series-picker'),hero=make('div','tv-series-hero'),art=make('div','tv-series-art');art.className='poster';
 const summary=make('div','tv-series-summary'),seasons=make('div','tv-seasons'),grid=make('div','tv-episode-grid'),pager=make('div','tv-episode-pages');
 seasons.setAttribute('aria-label','Temporadas');grid.setAttribute('aria-label','Episodios');
 hero.append(art,summary);picker.append(hero);
 const layout=make('div','tv-watch-layout'),preview=make('div','tv-watch-preview'),side=watch.querySelector('.actions'),controls=watch.querySelector('.controls');
 const synopsis=$('synopsis');preview.append(player,$('play-status'),synopsis);
 const options=make('details','tv-watch-options'),optionsTitle=make('summary',null,'⋯ Opciones');options.append(optionsTitle,$('reload-player'),$('alternative'),$('tv-signal-label'));
 const avoid=button('Este servidor pide verificación',()=>{actions.avoidCurrent?.();refresh();}),restore=button('Restablecer servidores',()=>{actions.restoreServers?.();refresh();});avoid.id='tv-avoid-server';restore.id='tv-restore-servers';options.append(avoid,restore);
 const trial=button('Probar reproductor CLB · CineSrc',()=>{if(actions.trialRemote?.())window.CLBTVStartPlayer?.();});trial.id='tv-trial-remote';options.append(trial);
 const diagnostics=button('Diagnóstico de TV',()=>{if(window.location.origin==='https://appassets.androidplatform.net')window.location.assign('/mobile/tv-diagnostics');else $('play-status').textContent='El diagnóstico de Android/WebView está disponible dentro de la APK de TV.';});options.append(diagnostics);
 const quick=make('label','tv-quick-episode','Capítulo'),quickSelect=make('select','tv-episode-select');quick.append(quickSelect);quick.hidden=true;
 const next=button('Siguiente episodio →',()=>{const entry=nextEpisode(data.episodes,current);if(entry)showPlayer(entry,true);});next.id='tv-next-episode';next.hidden=true;
 side.append(controls,$('play'),quick,next,$('save-list'),options);layout.append(preview,side);watch.append(picker,layout);
 const backEpisodes=button('← Todos los episodios',()=>showPicker());backEpisodes.id='tv-back-episodes';side.append(backEpisodes);backEpisodes.hidden=true;
 $('play').textContent='▶ Ver ahora';$('preferences-hint').hidden=true;$('exit-fullscreen').hidden=true;
 let data=null,current=null,season=1,page=0,choosing=false,lastEpisode=null,seasonNumbers=[],seasonOffset=0;
 const focus=el=>{el?.focus({preventScroll:true});el?.scrollIntoView({block:'nearest',inline:'nearest'});};
 function showPlayer(entry,playNow=false){
  if(!actions.chooseEpisode(entry))return;
  season=entry.season;page=Math.max(0,Math.floor(data.episodes.filter(e=>e.season===season).findIndex(e=>e.episode===entry.episode)/6));seasonOffset=Math.max(0,Math.floor(seasonNumbers.indexOf(season)/5)*5);renderSeasons();
  current=entry;choosing=false;picker.hidden=true;layout.hidden=false;backEpisodes.hidden=false;preview.append(synopsis);side.insertBefore($('save-list'),options);options.open=false;
  watch.dataset.tvStage='player';watch.insertBefore($('title'),picker);quick.hidden=false;next.hidden=false;quickSelect.value=String(data.episodes.indexOf(entry));next.disabled=!nextEpisode(data.episodes,entry);
  $('watch-type').textContent=`TEMPORADA ${entry.season} · EPISODIO ${entry.episode}`;
  $('title').textContent=entry.name||data.name;document.querySelector('main').scrollTop=0;focus($('play'));
  if(playNow){actions.play();window.CLBTVStartPlayer?.();}
 }
 function renderEpisodes(){
  const result=episodePage(data.episodes,season,page);page=result.page;grid.replaceChildren();pager.replaceChildren();
  for(const entry of result.items){const b=button(`${entry.episode}. ${entry.name||'Episodio '+entry.episode}${entry.upcoming?' · Próximamente':entry.locked?' · No disponible':''}`,()=>{lastEpisode=b;showPlayer(entry);});b.disabled=!!(entry.upcoming||entry.locked);b.setAttribute('aria-current',String(current?.season===entry.season&&current?.episode===entry.episode));grid.append(b);}
  const count=make('span',null,`${result.total?result.page*6+1:0}–${Math.min((result.page+1)*6,result.total)} de ${result.total} episodios`);pager.append(count);
  if(page>0)pager.append(button('← Anteriores',()=>{page--;renderEpisodes();focus(grid.querySelector('button:not(:disabled)'));}));
  if(page+1<result.pages)pager.append(button('Más episodios →',()=>{page++;renderEpisodes();focus(grid.querySelector('button:not(:disabled)'));}));
 }
 function showPicker(){
  if(!data)return false;actions.stop();choosing=true;picker.hidden=false;layout.hidden=true;backEpisodes.hidden=true;
  watch.dataset.tvStage='picker';$('watch-type').textContent=data.kind==='anime'?'ANIME':'SERIE';$('title').textContent=data.name;summary.prepend($('title'));summary.append(synopsis,$('save-list'),seasons,grid,pager);renderEpisodes();
  document.querySelector('main').scrollTop=0;focus(lastEpisode?.isConnected?lastEpisode:grid.querySelector('[aria-current="true"]')||grid.querySelector('button:not(:disabled)')||seasons.querySelector('button'));return true;
 }
 window.CLBTVWatchReset=item=>{data=null;current=null;lastEpisode=null;choosing=false;picker.hidden=true;layout.hidden=false;backEpisodes.hidden=true;quick.hidden=true;next.hidden=true;watch.dataset.tvStage='player';watch.insertBefore($('title'),picker);preview.append(synopsis);side.insertBefore($('save-list'),options);options.open=false;
  if(item){const placeholder=make('div','tv-watch-placeholder');placeholder.className='poster';placeholder.append(make('span',null,item.name));player.append(placeholder);actions.attachPoster(placeholder,item);}
 };
 window.CLBTVEpisodes=(selected,item,entry)=>{
  data=selected;current=entry;season=entry?.season??selected.episodes[0]?.season??1;
  const entries=selected.episodes.filter(e=>e.season===season),index=entries.findIndex(e=>e.episode===entry?.episode);page=Math.max(0,Math.floor(index/6));
  art.replaceChildren(make('span',null,selected.name));actions.attachPoster(art,{...item,...selected});
  summary.replaceChildren();summary.append(synopsis);
  quickSelect.replaceChildren();selected.episodes.forEach((e,index)=>{const o=make('option',null,`T${e.season} · E${e.episode} — ${e.name||'Episodio'}${e.upcoming?' · Próximamente':e.locked?' · No disponible':''}`);o.value=String(index);o.disabled=!!(e.upcoming||e.locked);quickSelect.append(o);});
  seasonNumbers=[...new Set(selected.episodes.map(e=>e.season))].sort((a,b)=>a-b);seasonOffset=Math.max(0,Math.floor(seasonNumbers.indexOf(season)/5)*5);renderSeasons();
  showPicker();
 };
 window.CLBTVBackToEpisodes=()=>!watch.hidden&&data&&!choosing?showPicker():false;
 quickSelect.addEventListener('change',()=>{const entry=data?.episodes[Number(quickSelect.value)];if(entry&&!entry.upcoming&&!entry.locked)showPlayer(entry,true);});
 function refresh(){trial.disabled=$('play').disabled;const a=!actions.canAvoid?.(),r=!actions.hasAvoided?.();if(avoid.disabled!==a)avoid.disabled=a;if(restore.disabled!==r)restore.disabled=r;}
 function renderSeasons(){
  seasons.replaceChildren();if(seasonOffset)seasons.append(button('← Temporadas',()=>{seasonOffset-=5;renderSeasons();focus(seasons.querySelector('button'));}));
  for(const number of seasonNumbers.slice(seasonOffset,seasonOffset+5)){
   const b=button(number===0?'Especiales':'Temporada '+number,()=>{season=number;page=0;for(const peer of seasons.querySelectorAll('button'))peer.setAttribute('aria-pressed',String(peer===b));renderEpisodes();});b.setAttribute('aria-pressed',String(number===season));seasons.append(b);
  }
  if(seasonOffset+5<seasonNumbers.length)seasons.append(button('Más temporadas →',()=>{seasonOffset+=5;renderSeasons();focus(seasons.querySelector('button'));}));
 }
 window.CLBTVWatchReset();
 return {isChoosing:()=>choosing,refresh};
}

// Controles de vídeo directo de TV, independientes de los iframes de terceros.
export function bindTVVideo(video,hud,{setTimer=setTimeout,clearTimer=clearTimeout}={}){
 let timer=null;video.controls=false;
 function show(){
  clearTimer(timer);hud.hidden=false;hud.textContent=video.paused?'Pausado · OK para continuar':'OK pausa / continúa · Atrás vuelve';
  if(!video.paused)timer=setTimer(()=>{hud.hidden=true;},2500);
 }
 function fail(){clearTimer(timer);hud.hidden=false;hud.textContent='La señal no respondió · Atrás para cambiar de servidor';}
 video.addEventListener('playing',show);video.addEventListener('pause',show);video.addEventListener('error',fail);show();
 return {show,fail,dispose(){clearTimer(timer);video.removeEventListener('playing',show);video.removeEventListener('pause',show);video.removeEventListener('error',fail);hud.hidden=true;}};
}
