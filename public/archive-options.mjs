export function installArchiveOptions({item,info,episode,beforePlay=()=>{},document=globalThis.document}){
 const panel=document.getElementById('archive-panel'),status=document.getElementById('archive-status'),button=document.getElementById('archive-query'),list=document.getElementById('archive-results'),video=document.getElementById('archive-video');
 let controller,version=0;
 const context=()=>{const ep=episode(),id=ep?.imdbId||info.imdbId;return /^tt\d{5,12}$/.test(id||'')&&(info.playbackType==='movie'||ep)?{kind:info.playbackType,id,...info.playbackType==='series'?{season:ep.sourceSeason??ep.season,episode:ep.sourceEpisode??ep.episode}:{}}:null;};
 function stop(){video.hidden=true;video.pause?.();video.removeAttribute?.('src');video.load?.();}
 function refresh(){version++;controller?.abort();stop();list.replaceChildren();panel.hidden=item.section==='kids';button.disabled=!context();status.textContent=button.disabled?'Sin correspondencia IMDb o sin episodio seleccionado para esta fuente.':'Consulta opcional. Las coincidencias se contrastan con Archive; pueden no tener español ni ser compatibles con tu navegador.';}
 button.onclick=async()=>{
  refresh();const c=context();if(!c)return;const own=version;controller=new AbortController();button.disabled=true;status.textContent='Consultando Archive y contrastando título, año o episodio…';
  try{const r=await fetch('/api/archive/links?'+new URLSearchParams(c),{signal:controller.signal});const data=await r.json();if(!r.ok)throw Error(data.error);if(own!==version)return;
   status.textContent=data.sources.length?data.note:'No se obtuvieron archivos MP4/WebM que superen la comprobación de identidad. No confirma que el contenido no exista en Archive.';
   for(const source of data.sources){const row=document.createElement('div'),play=document.createElement('button'),text=document.createElement('p');play.className='source-option';play.textContent=[source.title,source.format,source.quality].join(' · ');text.className='muted';text.textContent='Idioma declarado por Archive: '+source.language+' · audio latino sin confirmar';row.append(play,text);list.append(row);
    play.onclick=()=>{beforePlay();stop();video.hidden=false;video.src=source.url;video.play().catch(()=>{status.textContent='Pulsa Play. Si el navegador no admite este archivo, utiliza otra opción.';});status.textContent='Abriendo archivo de Archive. Comprueba que el título, el audio y la duración sean correctos.';};
   }
  }catch(e){if(own===version&&e.name!=='AbortError')status.textContent=e.message||'Archive no pudo responder.';}finally{if(own===version)button.disabled=false;}
 };
 video.onerror=()=>{if(!video.hidden)status.textContent='No se pudo reproducir este archivo de Archive: puede estar restringido, no disponible o usar un códec incompatible. Las otras fuentes siguen disponibles.';};
 return {refresh,stop,dispose(){version++;controller?.abort();stop();}};
}
