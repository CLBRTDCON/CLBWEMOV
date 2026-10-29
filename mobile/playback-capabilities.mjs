export function playbackCapabilities(provider,type='embed'){
 if(type==='file')return {engine:'direct',commands:true,progress:true,subtitles:true,gestures:true,native:true};
 if(provider==='cinesrc')return {engine:'embed-api',commands:true,progress:true,subtitles:false,gestures:true,native:false};
 return {engine:'embed',commands:false,progress:false,subtitles:false,gestures:false,native:false};
}
export function classifyPlaybackError(code){
 if([401,403].includes(code))return {kind:'access',retry:false,message:'La fuente restringió el acceso. Prueba otro servidor.'};
 if([404,410].includes(code))return {kind:'missing',retry:false,message:'La fuente no encontró este vídeo o el enlace caducó.'};
 if(code==='codec')return {kind:'format',retry:false,message:'El formato no es compatible con este dispositivo.'};
 if(code==='unknown')return {kind:'unknown',retry:false,message:'No se pudo confirmar el estado del vídeo. Puedes recargar o probar otro servidor.'};
 return {kind:'network',retry:true,message:'La conexión con la fuente se interrumpió.'};
}
export function progressIdentity(item,episode){return `${item.kind}:${item.kind==='movie'&&item.imdbId?item.imdbId:item.id}|${episode?`${episode.season}:${episode.episode}`:'movie'}`;}
export function nativePayload(selected,item,episode,saved,index=0){
 if(selected?.playbackType!=='file'||!item)return null;
 const source=selected.streams?.[index];if(!source)return null;
 let url;try{url=new URL(source.url);}catch{return null;}
 if(url.href.length>8000||url.protocol!=='https:'||url.username||url.password||url.port||url.hash||url.hostname!=='archive.org'||!url.pathname.startsWith('/download/')||! /\.(mp4|m4v|webm|m3u8)$/i.test(url.pathname))return null;
 return {url:url.href,title:selected.name,identity:progressIdentity(item,episode),position:saved?.streamIndex===index&&!saved.completed?saved.position||0:0,streamIndex:index,imdbId:item.imdbId||'',season:episode?.season??-1,episode:episode?.episode??-1};
}
