export function addonContext(info,episode){if(!info||info.playbackType!=='movie'&&(!episode||episode.locked||episode.upcoming))return null;const id=episode?.imdbId||info.imdbId;if(!/^tt\d{5,12}$/.test(id||''))return null;return {id,kind:info.playbackType==='movie'?'movie':'series',...(info.playbackType==='movie'?{}:{season:episode.sourceSeason??episode.season,episode:episode.sourceEpisode??episode.episode})};}
export function addonCard(row,item,provider,episode){
 const label=(row.name||'')+' '+(row.title||'');
 const quality=/\b(?:4k|2160p)\b/i.test(label)?'4K':label.match(/\b(360|480|720|1080)p\b/i)?.[0].toLowerCase()||'Calidad sin declarar';
 // Prefer the explicit audio field; do not infer a language from country flags or DUAL alone.
 const audio=row.title?.match(/🌐\s*([^📁💾📦✨🎬🔗\n]+)/u)?.[1]?.trim();
 const audioText=audio||label;
 const languages=[[/\blatino\b|(?:^|[\s._/-])lat(?:$|[\s._/-])/i,'Latino'],[/\bcastellano\b|español de españa/i,'Castellano'],[/\bingl[eé]s\b|\benglish\b/i,'Inglés'],[/\bsueco\b/i,'Sueco'],[/\bjapon[eé]s\b/i,'Japonés']].filter(([pattern])=>pattern.test(audioText)).map(([,name])=>name);
 const language=audio||languages.join(' / ')||(/\bespa[nñ]ol\b|\bspa\b/i.test(label)?'Español':'Idioma sin especificar');
 const size=label.match(/\b\d+(?:[.,]\d+)?\s*(?:GB|MB|TB)\b/i)?.[0];
 return {quality,title:[quality,item.name||'Título',language.replace(/\s*\/\s*/g,' / ')].join(' · '),note:[provider.name||provider.id,episode?`T${episode.season} · E${episode.episode}`:null,size,'Idioma anunciado por la fuente'].filter(Boolean).join(' · ')};
}
export function installLocalAddons({item,info,episode,document=globalThis.document,fetch=globalThis.fetch}){
 const $=id=>document.getElementById(id),panel=$('local-addons');if(!panel||item.section==='kids'){if(panel)panel.hidden=true;return {refresh(){},dispose(){}};}
 const status=$('addons-status'),results=$('addons-results');let generation=0,controller;
 async function json(path,options={}){const r=await fetch(path,options),data=await r.json();if(!r.ok)throw Error(data.error||'No se pudo consultar la fuente.');return data;}
 async function refresh(){const own=++generation;controller?.abort();controller=new AbortController();const signal=controller.signal,context=addonContext(info,episode()),selected=episode();results.replaceChildren();
  if(!context){status.textContent='Sin correspondencia IMDb o sin episodio seleccionado. Puedes usar los reproductores de cada fuente.';return;}
  status.textContent='Buscando archivos disponibles…';let count=0,failed=0,locked=0;
  try{const {providers}=await json('/api/addons-local/status',{signal});if(own!==generation)return;
   await Promise.all(providers.filter(p=>p.configured).map(async provider=>{
    if(provider.locked){locked++;const link=document.createElement('a');link.className='file-link';link.href='/activar?return='+encodeURIComponent(location.pathname+location.search);link.textContent='🔒 Activar Latinobrid en este dispositivo · Acceso de 30 días';results.append(link);return;}
    try{const data=await json('/api/addons-local/links?'+new URLSearchParams({...context,provider:provider.id}),{signal});if(own!==generation)return;
     for(const row of data.sources){if(row.unsupported)continue;const card=addonCard(row,item,provider,selected);if(card.quality==='4K')continue;
      const link=document.createElement('a');link.className='file-link';const icon=document.createElement('span');icon.className='play-icon';icon.textContent='▶';const description=document.createElement('span'),title=document.createElement('strong'),note=document.createElement('small');title.textContent=card.title;note.textContent=card.note;description.append(title,note);link.append(icon,description);
      link.href='/reproductor?'+new URLSearchParams({...context,addon:provider.id,index:row.index,...(row.key?{variant:row.key}:{}),from:'ficha',clb:JSON.stringify(item),...(selected?{detailSeason:selected.season,detailEpisode:selected.episode}:{})});results.append(link);count++;
     }
    }catch(e){if(own!==generation||e.name==='AbortError')return;failed++;}
   }));
   if(own===generation)status.textContent=count?count+' archivo(s) encontrados. Selecciona uno para reproducir.'+(failed?' Alguna fuente no respondió.':''):locked?'Activa Latinobrid para ver sus archivos en este dispositivo.':failed?'No se pudieron consultar las fuentes de archivos. Puedes usar los otros reproductores.':'Sin archivos anunciados hasta 1080p para este título o episodio. Puedes usar los otros reproductores.';
  }catch(e){if(own===generation&&e.name!=='AbortError')status.textContent='No se pudieron consultar los archivos. Puedes usar los otros reproductores.';}
 }
 $('addons-save').onclick=async()=>{const input=$('addons-manifest'),button=$('addons-save'),note=$('addons-config-status');button.disabled=true;note.textContent='Comprobando manifest…';try{await json('/api/addons-local/config',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({provider:$('addons-config-provider').value,manifest:input.value})});note.textContent='Configuración local guardada.';void refresh();}catch(e){note.textContent=e.message;}finally{input.value='';button.disabled=false;}};
 return {refresh,dispose(){generation++;controller?.abort();}};
}
