// Solo eventos documentados, del iframe actual y con origen exacto. Sin temporizadores de recarga.
globalThis.CineRecovery=(()=>{
  let active=null;const positions=new Map(),attempts=new Set();
  function key(url){const u=new URL(url);u.searchParams.delete('t');u.searchParams.delete('continueprompt');return u.href;}
  function decorate(url){const u=new URL(url);const time=positions.get(key(u));if(u.origin==='https://cinesrc.st'&&time>0){u.searchParams.set('t',Math.floor(time));u.searchParams.set('continueprompt','false');}return u;}
  function watch(frame,provider,retry,failed){active={frame,provider,retry,failed,key:key(frame.src)};}
  function handle(event){
    const a=active,d=event.data;
    if(!a||a.provider!=='cinesrc'||!a.frame.contentWindow||a.frame.isConnected===false||event.source!==a.frame.contentWindow||event.origin!=='https://cinesrc.st'||!d||typeof d!=='object')return;
    if(d.type==='cinesrc:timeupdate'&&Number.isFinite(d.currentTime)&&d.currentTime>=0&&d.currentTime<=86400){if(positions.size>=30&&!positions.has(a.key))positions.delete(positions.keys().next().value);positions.set(a.key,d.currentTime);}
    if(d.type!=='cinesrc:error'||globalThis.document?.hidden===true)return;
    if(attempts.has(a.key)){a.failed?.();return;}
    if(attempts.size>=30)attempts.delete(attempts.values().next().value);attempts.add(a.key);active=null;a.retry?.();
  }
  globalThis.addEventListener?.('message',handle);
  return {watch,decorate,handle,clear(){active=null;},reset(){attempts.clear();}};
})();
// Preferencia local compartida: no afirma controlar pistas de reproductores externos.
globalThis.CineDataSaver=(()=>{
  let enabled=false;try{enabled=globalThis.localStorage?.getItem('clb.dataSaver.v1')==='1';}catch{}
  function set(value){enabled=value===true;try{globalThis.localStorage?.setItem('clb.dataSaver.v1',enabled?'1':'0');}catch{}return enabled;}
  function poster(value){if(!enabled)return value;try{const u=new URL(value);if(u.hostname==='image.tmdb.org')u.pathname=u.pathname.replace(/\/t\/p\/(original|w\d+)\//,'/t/p/w185/');if(u.hostname==='images.metahub.space')u.pathname=u.pathname.replace('/poster/medium/','/poster/small/');return u.href;}catch{return value;}}
  function bind(){const input=globalThis.document?.getElementById('data-saver');if(!input)return;input.checked=enabled;input.addEventListener?.('change',()=>{set(input.checked);});}
  if(globalThis.document){if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',bind);else bind();}
  return {get enabled(){return enabled;},set,poster};
})();
globalThis.CineSources = (() => {
  const providers = {
    facilito:{origin:'https://facilitoplay.com',tmdb:true,sandbox:false},
    sh:{origin:'https://vidsrc.sh',tmdb:false,sandbox:false},
    to:{origin:'https://vidsrc.to',tmdb:false,sandbox:false},
    vidlink:{origin:'https://vidlink.pro',tmdb:true,sandbox:true,webEnabled:false},
    vidfast:{origin:'https://vidfast.vc',tmdb:false,sandbox:true,webEnabled:false},
    cinesrc:{origin:'https://cinesrc.st',tmdb:true,sandbox:true},
    // sandbox:true solicita protección; no certifica compatibilidad ni disponibilidad.
    vidking:{origin:'https://www.vidking.net',tmdb:true,sandbox:true,experimental:true,webOnly:true,webEnabled:false},
    vixsrc:{origin:'https://vixsrc.to',tmdb:true,sandbox:true,referrerPolicy:'origin',experimental:true,webOnly:true,webEnabled:false}
  };
  function url(provider,id,season,episode,subtitle='es',quality='auto',audio='') {
    if(globalThis.CineDataSaver.enabled&&provider==='cinesrc')quality='720';
    const config=Object.hasOwn(providers,provider) ? providers[provider] : null;
    if(!config || !/^(?:[1-9][0-9]{0,11}|tt[0-9]{7,12})$/.test(String(id)) || (config.tmdb && !/^[1-9][0-9]{0,11}$/.test(String(id)))) throw new Error('Esta fuente necesita un ID TMDB numérico válido.');
    const series=season!==undefined;
    if(series && (!Number.isInteger(season) || season<0 || season>1000 || !Number.isInteger(episode) || episode<1 || episode>10000)) throw new Error('Episodio inválido.');
    const path=provider==='cinesrc' ? (series?`/embed/tv/${id}`:`/embed/movie/${id}`)
      : provider==='facilito' ? (series?`/e/serie/${id}/${season}/${episode}`:`/e/pelicula/${id}`)
      : provider==='vidking' ? (series?`/embed/tv/${id}/${season}/${episode}`:`/embed/movie/${id}`)
      : ['sh','to'].includes(provider) ? (series?`/embed/tv/${id}/${season}/${episode}`:`/embed/movie/${id}`)
      : (series?`/tv/${id}/${season}/${episode}`:`/movie/${id}`);
    const result=new URL(path,config.origin);
    if(provider==='sh' && ['es','en'].includes(subtitle)) result.searchParams.set('ds_lang',subtitle);
    if(provider==='vidfast' && ['es','en'].includes(subtitle)) result.searchParams.set('sub',subtitle);
    if(provider==='vidlink') result.searchParams.set('autoplay','false');
    if(provider==='vidfast') result.searchParams.set('autoPlay','false');
    if(provider==='vixsrc'){result.searchParams.set('autoplay','false');if(['latino','castellano'].includes(audio))result.searchParams.set('lang','es');}
    if(provider==='vidking'){result.searchParams.set('autoPlay','false');if(series){result.searchParams.set('nextEpisode','false');result.searchParams.set('episodeSelector','false');}}
    if(provider==='cinesrc') {
      if(series){result.searchParams.set('s',season);result.searchParams.set('e',episode);}
      result.searchParams.set('autoplay','false');result.searchParams.set('autonext','false');
      if(['720','1080'].includes(quality))result.searchParams.set('quality',quality);
    }
    return result;
  }
  function animeUrl(malId,episode) {
    if(!/^[1-9]\d{0,9}$/.test(String(malId)) || !Number.isInteger(episode)||episode<1||episode>10000)throw new Error('Identificador o episodio MAL inválido.');
    return new URL(`/anime/${malId}/${episode}/sub?autoplay=false`,providers.vidlink.origin);
  }
  return {providers,url,animeUrl};
})();
