// Compartido por Películas, Series y Anime. No se inspeccionan otros orígenes.
window.CinePlayback = (() => {
  const {providers,url,animeUrl}=globalThis.CineSources;
  const names={facilito:'FacilitoPlay',sh:'VidSrc.sh',to:'VidSrc.to',vidlink:'VidLink',vidfast:'VidFast',cinesrc:'CineSrc',vidking:'Vidking · Pruebas',vixsrc:'VixSrc · Pruebas'};
  const providerName=id=>names[id]||id;
  function qualityValue(){return document.getElementById('quality')?.value||'auto';}
  function configureQuality(provider) {
    const select=document.getElementById('quality'),hint=document.getElementById('quality-hint');
    if(!select || !hint)return;
    const manual=provider==='cinesrc';
    for(const option of select.options) option.disabled=option.value==='2160'||(!manual&&option.value!=='auto');
    if(!manual)select.value='auto';select.disabled=!manual;
    hint.textContent=manual?'CineSrc recibe tu preferencia de 720p o 1080p; puede ignorarla si no existe esa versión. Automática deja decidir al reproductor. Cambiarla recarga el vídeo y puede reiniciar su posición. 4K no está verificado.'
      : provider==='vidfast'?'VidFast anuncia calidad adaptativa según la conexión. Las resoluciones manuales dependen del menú interno del reproductor y de las pistas disponibles; la app no puede fijarlas ni confirmar 4K.'
      :'Esta fuente gestiona la calidad dentro del reproductor: busca el engrane o menú Calidad. Automática, 720p, 1080p y 4K dependen de las versiones que tenga; no se fuerza una resolución desde esta app.';
  }
  function protectedMode(){return document.getElementById('block-popups').checked;}
  function compatible(provider){return Object.hasOwn(providers,provider)&&providers[provider].webEnabled!==false;}
  function preferredProvider(provider){return provider;}
  function sandboxed(provider){return compatible(provider)&&protectedMode()&&providers[provider].sandbox!==false;}
  function frame(provider,src,title) {
    if(!Object.hasOwn(providers,provider) || src.origin!==providers[provider].origin) throw new Error('Origen de reproductor no permitido.');
    if(!compatible(provider))throw new Error('Esta fuente se retiró de la web tras las pruebas. Elige FacilitoPlay, CineSrc o VidSrc.sh/to.');
    const iframe=document.createElement('iframe');
    iframe.title=title; iframe.src=globalThis.CineRecovery.decorate(src).href;
    iframe.allow='fullscreen; picture-in-picture; encrypted-media'; iframe.allowFullscreen=true;
    iframe.referrerPolicy=providers[provider].referrerPolicy||(provider==='facilito'?'origin':'no-referrer');
    // Excepciones por proveedor autorizadas por el usuario; estado visible junto al vídeo.
    if(sandboxed(provider)) iframe.setAttribute('sandbox','allow-scripts allow-same-origin allow-presentation');
    status(provider);
    globalThis.CineRecovery.watch(iframe,provider,()=>{const url=globalThis.CineRecovery.decorate(iframe.src);iframe.src=url.href;},()=>{});
    return iframe;
  }
  function status(provider) {
    document.getElementById('popup-status').textContent=protectedMode()
      ? 'Protección por proveedor: CineSrc conserva sandbox. FacilitoPlay y VidSrc.sh/to se cargan sin sandbox por incompatibilidad; pueden abrir pestañas o intentar redirigir la página.'
      : 'Modo compatible: los reproductores se cargan sin sandbox. Pueden abrir pestañas o intentar redirigir la página; CLB no puede controlar su interfaz externa.';
    const notice=document.getElementById('playback-protection');
    if(notice){notice.hidden=!provider;notice.textContent=!provider?'':sandboxed(provider)?`${providerName(provider)} · Sandbox activo; no confirma disponibilidad de vídeo.`:`${providerName(provider)} · Sin protección sandbox. Este reproductor puede abrir pestañas o intentar redirigir la página. Puedes cambiar a CineSrc para usar una fuente con sandbox.`;}
  }
  document.getElementById('block-popups').addEventListener('change',()=>{status();document.dispatchEvent(new Event('player-policy-change'));});
  document.getElementById('quality')?.addEventListener?.('change',()=>document.dispatchEvent(new Event('player-quality-change')));
  status();
  return {providers,compatible,preferredProvider,sandboxed,providerName,url,animeUrl,frame,protectedMode,qualityValue,configureQuality};
})();
