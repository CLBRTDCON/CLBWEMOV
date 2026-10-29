export function createLivePlayer({container,status,quality,document=globalThis.document,Hls=globalThis.Hls,onFailure=()=>{}}){
  let hls=null,video=null,generation=0,suspended=false,resumePlaying=false;
  const option=(value,text)=>{const o=document.createElement('option');o.value=value;o.textContent=text;return o;};
  function stop(){generation++;suspended=false;resumePlaying=false;if(hls){hls.destroy();hls=null;}if(video){video.pause();video.removeAttribute('src');video.load();video=null;}container.replaceChildren();}
  function play(channel,index=0){
    Hls=Hls||globalThis.Hls;
    stop();const token=generation,source=channel.streams[index];if(!source){status.textContent='No hay una señal compatible para este canal.';return;}
    video=document.createElement('video');video.controls=true;video.playsInline=true;video.preload='none';video.title=channel.name;container.append(video);
    const media=video;quality.replaceChildren(option('auto','Automática'));quality.disabled=true;
    status.textContent='Conectando con la emisión. Pulsa Play dentro del vídeo…';
    const failed=()=>{if(token===generation){status.textContent='Esta señal no respondió o no es compatible. Prueba otra señal; puede existir restricción regional o CORS.';onFailure();}};
    media.addEventListener('error',failed);media.addEventListener('playing',()=>{if(token===generation)status.textContent=`En directo · ${channel.name}`;});
    if(Hls?.isSupported()){
      const player=hls=new Hls({enableWorker:true,backBufferLength:globalThis.CineDataSaver?.enabled?0:30,maxBufferLength:globalThis.CineDataSaver?.enabled?10:30});
      player.on(Hls.Events.MANIFEST_PARSED,()=>{if(token!==generation)return;if(globalThis.CineDataSaver?.enabled){const levels=player.levels.map((l,i)=>({l,i})).filter(x=>x.l.height>0&&x.l.height<=720);player.autoLevelCapping=levels.length?levels.sort((a,b)=>b.l.height-a.l.height)[0].i:0;}player.levels.forEach((level,i)=>quality.append(option(i,`${level.height?level.height+'p':'Nivel '+(i+1)}${level.bitrate?' · '+(level.bitrate/1e6).toFixed(1)+' Mbps':''}`)));quality.disabled=player.levels.length<2;if(!suspended){status.textContent='Señal recibida. Pulsa Play; Automática se adapta a las variantes disponibles.';media.play().catch(()=>{});}else player.stopLoad?.();});
      player.on(Hls.Events.ERROR,(_,data)=>{if(token===generation&&data.fatal){failed();player.destroy();hls=null;}});
      player.loadSource(source.url);player.attachMedia(media);
    }else if(media.canPlayType('application/vnd.apple.mpegurl')){media.src=source.url;media.play().catch(()=>{});}
    else status.textContent='Actualiza Android System WebView: este reproductor no tiene soporte HLS disponible.';
  }
  return {play,stop,
    suspend(){if(!video||suspended)return;suspended=true;resumePlaying=!video.paused&&!video.ended;video.pause();hls?.stopLoad?.();},
    resume(){if(!video||!suspended)return;suspended=false;hls?.startLoad?.(-1);if(resumePlaying)video.play().catch(()=>{status.textContent='Pulsa Play dentro del vídeo para volver a la emisión.';});},
    setQuality(value){if(hls)hls.currentLevel=value==='auto'?-1:Number(value);}};
}
