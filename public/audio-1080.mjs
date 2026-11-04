import {preparePlayerLanguage,localizePlayer} from './player-es.mjs';
import {installWebPlayerControls} from './web-player-controls.mjs';
import {createLibrary} from '/mobile/library.mjs';
import {detailItem,detailURL} from './ficha-core.mjs';
import {exactVariant,recoverablePlayback,within1080,supportedDimensions,wasmResource,spanishTrack,playbackFailure,audioChoices} from './audio-1080-core.mjs';
const $=id=>document.getElementById(id);let player=null,generation=0,request=null,queue=Promise.resolve(),blockedPolicy=false,activeRecord=null,lastProgressSave=0,lastEngineError='';
let recoverAction=null,recoveries=0,recoveryTimer=null,paused=false;
function requestRecovery(error){if(!recoverAction||paused||recoveries>=1||blockedPolicy||!recoverablePlayback(error))return false;recoveries++;clearTimeout(recoveryTimer);$('audio-status').textContent='Renovando el enlace y recuperando la posición…';recoveryTimer=setTimeout(()=>{recoveryTimer=null;recoverAction(true);},1500);return true;}
const library=createLibrary({onError:message=>$('audio-status').textContent=message});
function persistProgress(completed=activeRecord?.completed===true){if(!player||!activeRecord||activeRecord.restoring)return;try{const position=Number(player.currentTime)/1000,duration=Number(player.getDuration())/1000;if(!Number.isFinite(position)||!Number.isFinite(duration)||position<0||duration<=0||duration>86400)return;library.progress(activeRecord.item,{position,duration,episode:activeRecord.episode,provider:activeRecord.provider||'catalognet',variantKey:activeRecord.variantKey||'',streamIndex:activeRecord.index,evidence:'file',completed});}catch{}}
// Serialize engine creation/destruction: old async loads must never replace a newer choice.
function schedule(task){const id=++generation;request?.abort();request=new AbortController();const signal=request.signal;queue=queue.catch(()=>{}).then(async()=>{await destroy();if(id!==generation)return;try{await task(id,signal);}catch(e){if(id===generation&&e.name!=='AbortError'){$('audio-status').textContent=typeof e?.message==='string'&&e.message.startsWith('CLB:')?e.message.slice(4):blockedPolicy?'La política de seguridad bloqueó un módulo del reproductor. Recarga esta página para recibir la política actualizada.':'No se pudo abrir el archivo. '+(lastEngineError||playbackFailure(e));await destroy();if(!requestRecovery(e)&&recoverAction)$('player-recover').hidden=false;}}});}
async function destroy(){if($('player-audio-label'))$('player-audio-label').hidden=true;persistProgress();activeRecord=null;const previous=player;player=null;if(previous)try{await previous.destroy();}catch{}$('av-screen').replaceChildren();}
async function json(path,signal){const r=await fetch(path,{signal});const data=await r.json();if(!r.ok)throw Error('CLB:'+ (data.error||'La fuente respondió HTTP '+r.status));return data;}
function identity(){const addon=new URL(location.href).searchParams.get('addon');const kind=$('media-kind').value,id=$('media-id').value.trim(),season=Number($('media-season').value),episode=Number($('media-episode').value);if(!(addon?/^tt\d{5,12}$/:/^[1-9]\d{0,11}$/).test(id)||!['movie','series'].includes(kind)||kind==='series'&&(!Number.isInteger(season)||season<0||season>1000||!Number.isInteger(episode)||episode<1||episode>10000))throw Error('CLB:Identidad o episodio inválido.');return new URLSearchParams({kind,id,...(kind==='series'?{season,episode}:{})});}
function endpoint(action,params){const addon=new URL(location.href).searchParams.get('addon');const query=new URLSearchParams(params);if(addon)query.set('provider',addon);return (addon?'/api/addons-local/':'/api/catalognet/')+action+'?'+query;}
document.addEventListener('securitypolicyviolation',event=>{if(event.blockedURI?.startsWith('blob')&&/script-src|worker-src/.test(event.effectiveDirective)){blockedPolicy=true;$('audio-status').textContent='La política de seguridad bloqueó el módulo de audio. Recarga la página para recibir la corrección.';}});
async function open(source,title,id,signal,record=null,format,transportTracks=[]){
 const mediaURL=new URL(source,location.href);let ext=['mkv','mp4','ts','webm','m3u8'].includes(format)?format:undefined;
 if(mediaURL.origin===new URL(location.href).origin&&mediaURL.pathname==='/api/addons-local/media'){
  const head=await fetch(mediaURL.href,{method:'HEAD',signal});
  if(!head.ok)throw Error('CLB:La fuente de vídeo respondió HTTP '+head.status+'. Vuelve a la ficha y elige otra opción.');
  const type=head.headers?.get('content-type')||'';
  ext=/mp2t/i.test(type)?'ts':/mpegurl/i.test(type)?'m3u8':/matroska/i.test(type)?'mkv':/webm/i.test(type)?'webm':/mp4/i.test(type)?'mp4':undefined;
  // Some Debrid URLs have no extension and return generic binary MIME types.
  // Read only the beginning through the existing private relay, then cancel.
  if(!ext&&/octet-stream|binary/i.test(type)){
   const probe=await fetch(mediaURL.href,{headers:{Range:'bytes=0-1023'},signal});
   if(!probe.ok)throw Error('CLB:No se pudo comprobar el formato del archivo. Vuelve a la ficha.');
   const reader=probe.body.getReader();let bytes=new Uint8Array(0);
   try{while(bytes.length<12){const chunk=await reader.read();if(chunk.done)break;const next=new Uint8Array(Math.min(16,bytes.length+chunk.value.length));next.set(bytes);next.set(chunk.value.subarray(0,next.length-bytes.length),bytes.length);bytes=next;}}finally{await reader.cancel();}
   if(bytes[0]===0x1a&&bytes[1]===0x45&&bytes[2]===0xdf&&bytes[3]===0xa3)ext='mkv';
   else if(bytes[4]===0x66&&bytes[5]===0x74&&bytes[6]===0x79&&bytes[7]===0x70)ext='mp4';
   else if(bytes[0]===0x47)ext='ts';
  }
 }
 blockedPolicy=false;lastEngineError='';
 if(!globalThis.AVPlayer)throw Error('CLB:El motor local no pudo cargarse.');
 if(globalThis.isSecureContext===false||typeof AudioWorkletNode==='undefined')throw Error('CLB:El reproductor necesita localhost o HTTPS y un navegador con AudioWorklet. Desde una IP por HTTP, vuelve a la ficha y elige otro proveedor.');
 $('audio-title').textContent=title;$('audio-status').textContent='';$('audio-status').textContent='Abriendo archivo y comprobando pistas…';
 // WebAssembly decodes audio; MSE would hand the unsupported Dolby track back to the browser.
 preparePlayerLanguage();
 const engine=new AVPlayer({container:$('av-screen'),getWasm:wasmResource,wasmBaseUrl:'/vendor/libmedia',checkUseMSE:()=>false,enableHardware:true,enableWebCodecs:true,enableWorker:true,enableWebGPU:false,indicatorUrl:'/vendor/libmedia/indicator.svg',pauseStateUrl:'/vendor/libmedia/state.svg',errorStateUrl:'/vendor/libmedia/error.svg',fullscreenDom:$('av-screen'),ui:{hasFolder:false,hasHeader:false,hasFooter:true,folderFolded:true}});player=engine;localizePlayer(engine);
 engine.on('played',()=>{if(id===generation){paused=false;$('player-recover').hidden=true;$('audio-status').textContent='';}});
 engine.on('paused',()=>{if(id===generation){paused=true;$('audio-status').textContent='';}});engine.on('ended',()=>{if(id===generation){if(activeRecord)activeRecord.completed=true;persistProgress(true);$('audio-status').textContent='';}});
 engine.on('time',()=>{if(id===generation&&Date.now()-lastProgressSave>5000){persistProgress();lastProgressSave=Date.now();}});
 engine.on('paused',()=>{if(id===generation)persistProgress();});
 engine.on('error',error=>{if(id===generation){lastEngineError=playbackFailure(error);$('audio-status').textContent='Error de AVPlayer: '+lastEngineError;if(!requestRecovery(lastEngineError)&&recoverAction)$('player-recover').hidden=false;}});
 void AVPlayer.audioContext?.resume()?.catch(()=>{});let timeout;try{await Promise.race([engine.load(mediaURL.href,{ext,http:{referrerPolicy:'no-referrer'}}),new Promise((_,reject)=>{timeout=setTimeout(()=>reject(Error('CLB:La fuente tardó más de 35 segundos en abrir. Vuelve a seleccionar una opción.')),35000);})]);}finally{clearTimeout(timeout);}if(id!==generation||signal.aborted)return;
 const streams=engine.getStreams();if(!supportedDimensions(streams))throw Error('CLB:El vídeo supera 1920×1080 o no se pudo comprobar su resolución. No se inicia en esta prueba.');
 const choices=audioChoices(streams,transportTracks),spanish=choices.find(t=>/^(es|spa)(?:$|[-_])/.test(t.language))||spanishTrack(streams);
 if(spanish)await engine.selectAudio(spanish.id);
 const audioSelect=$('player-audio'),audioLabel=$('player-audio-label');
 if(audioLabel)audioLabel.hidden=choices.length<2;
 if(audioSelect&&audioLabel&&choices.length>1){audioSelect.disabled=false;audioSelect.replaceChildren();for(const choice of choices){const option=document.createElement('option');option.value=String(choice.id);option.textContent=choice.label;audioSelect.append(option);}audioSelect.value=String(engine.getSelectedAudioStreamId());audioLabel.hidden=choices.length<2;
 audioSelect.onchange=async()=>{const selected=choices.find(c=>String(c.id)===audioSelect.value);if(!selected||id!==generation)return;audioSelect.disabled=true;try{await engine.selectAudio(selected.id);}catch{if(id===generation)$('audio-status').textContent='No se pudo cambiar la pista de audio.';}finally{if(id===generation){audioSelect.value=String(engine.getSelectedAudioStreamId());audioSelect.disabled=false;}}};}

 if(record){const saved=library.find(record.item);activeRecord=record;library.remember(record.item,{episode:record.episode,provider:record.provider||'catalognet',variantKey:record.variantKey||'',streamIndex:record.index});const duration=Number(engine.getDuration())/1000;if(saved?.provider===(record.provider||'catalognet')&&!saved.completed&&(record.variantKey?saved.variantKey===record.variantKey:saved.streamIndex===record.index)&&JSON.stringify(saved.episode)===JSON.stringify(record.episode)&&saved.position>0&&saved.position<duration-3){record.restoring=true;let pending=true;engine.on('played',()=>{if(!pending||id!==generation)return;pending=false;Promise.resolve().then(()=>engine.seek(BigInt(Math.floor(saved.position*1000)))).catch(()=>{if(id===generation)$('audio-status').textContent='No se pudo recuperar la posición guardada; puedes avanzar con la barra.';}).finally(()=>{if(activeRecord===record)record.restoring=false;});});}}

 Promise.resolve(engine.play()).catch(()=>{if(id===generation)$('audio-status').textContent='Pulsa Reproducir dentro del vídeo para iniciar.';});if(id===generation){$('audio-status').textContent='';}
}
$('lookup').onsubmit=e=>{e.preventDefault();schedule(async(id,signal)=>{const params=identity();$('audio-status').textContent='Consultando opciones…';$('audio-sources').replaceChildren();const data=await json(endpoint('links',params),signal);if(id!==generation)return;const sources=(data.sources||[]).filter(s=>within1080(s.quality));for(const row of sources){const b=document.createElement('button');b.className='source';b.textContent=[row.title,row.quality,row.size].filter(Boolean).join(' · ');b.onclick=()=>schedule(async(next,abort)=>{$('audio-status').textContent='Solicitando enlace temporal…';const query=new URLSearchParams(params);query.set('index',String(row.index));const result=await json(endpoint('resolve',query),abort);if(next!==generation)return;await open(result.url,row.title||'CATALOG//NET',next,abort);});$('audio-sources').append(b);}$('audio-status').textContent=sources.length?'Selecciona una opción para abrirla con AVPlayer.':'No hay opciones con resolución declarada hasta 1080p en esta respuesta.';});};
$('demo').onclick=()=>schedule((id,signal)=>open('/vendor/libmedia/test-dolby-1080.mkv','Prueba técnica · 1080p · E-AC-3 / AC-3',id,signal));
window.addEventListener('pagehide',()=>{generation++;clearTimeout(recoveryTimer);request?.abort();void destroy();});
const params=new URL(location.href).searchParams;for(const [key,element] of [['id','media-id'],['kind','media-kind'],['season','media-season'],['episode','media-episode']])if(params.has(key))$(element).value=params.get(key);

// A file choice in the detail page is an explicit playback request; re-check that exact variant.
if(params.get('from')==='ficha'){
 let title='CATALOG//NET',original=null;try{original=detailItem(JSON.parse(params.get('clb')||'null'));if(original){title=original.name;const back=document.querySelector('#player-return a');back.textContent='← Volver a la ficha';back.href=detailURL(original,params.has('detailSeason')?{season:Number(params.get('detailSeason')),episode:Number(params.get('detailEpisode'))}:null);}}catch{}
 const addon=params.get('addon');if(addon){document.querySelector('.player-advanced-tools').hidden=true;}
 const index=Number(params.get('index'));let variant=params.get('variant')||null;
 if(params.has('index')&&Number.isInteger(index)&&index>=0&&index<(addon?20:12)){
  const playSelected=(renew=false)=>schedule(async(id,signal)=>{
   $('player-recover').hidden=true;const query=identity();if(renew&&addon)query.set('renew','1');
   $('audio-status').textContent=renew?'Renovando el enlace del mismo archivo…':'Comprobando el archivo seleccionado…';
   const options=await json(endpoint('links',query),signal);const row=exactVariant(options.sources,variant,index);
   if(!row||(!addon&&!within1080(row.quality)))throw Error('CLB:El archivo seleccionado ya no figura o cambió. Vuelve a la ficha.');
   if(addon){variant=row.key||variant;if(variant)query.set('variant',variant);}query.delete('renew');query.set('index',String(row.index));
   const result=await json(endpoint('resolve',query),signal);
   if(id===generation)await open(result.url,title+' · '+(row.quality||row.name||'Archivo'),id,signal,original?{item:original,index:row.index,provider:addon||'catalognet',variantKey:variant||'',episode:params.has('detailSeason')?{season:Number(params.get('detailSeason')),episode:Number(params.get('detailEpisode'))}:null}:null,result.ext,result.audioTracks);
  });
  recoverAction=addon?playSelected:null;playSelected();
 }

}

$('player-recover').onclick=()=>{if(recoverAction){recoveries=0;paused=false;clearTimeout(recoveryTimer);recoverAction(true);}};
installWebPlayerControls();
