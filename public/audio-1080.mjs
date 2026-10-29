import {preparePlayerLanguage,localizePlayer} from './player-es.mjs';
import {installWebPlayerControls} from './web-player-controls.mjs';
import {createLibrary} from '/mobile/library.mjs';
import {detailItem,detailURL} from './ficha-core.mjs';
import {within1080,supportedDimensions,wasmResource,spanishTrack,playbackFailure} from './audio-1080-core.mjs';
const $=id=>document.getElementById(id);let player=null,generation=0,request=null,queue=Promise.resolve(),blockedPolicy=false,activeRecord=null,lastProgressSave=0,lastEngineError='';
const library=createLibrary({onError:message=>$('audio-status').textContent=message});
function persistProgress(completed=activeRecord?.completed===true){if(!player||!activeRecord||activeRecord.restoring)return;try{const position=Number(player.currentTime)/1000,duration=Number(player.getDuration())/1000;if(!Number.isFinite(position)||!Number.isFinite(duration)||position<0||duration<=0||duration>86400)return;library.progress(activeRecord.item,{position,duration,episode:activeRecord.episode,provider:'catalognet',streamIndex:activeRecord.index,evidence:'file',completed});}catch{}}
// Serialize engine creation/destruction: old async loads must never replace a newer choice.
function schedule(task){const id=++generation;request?.abort();request=new AbortController();const signal=request.signal;queue=queue.catch(()=>{}).then(async()=>{await destroy();if(id!==generation)return;try{await task(id,signal);}catch(e){if(id===generation&&e.name!=='AbortError'){$('audio-status').textContent=typeof e?.message==='string'&&e.message.startsWith('CLB:')?e.message.slice(4):blockedPolicy?'La política de seguridad bloqueó un módulo del reproductor. Recarga esta página para recibir la política actualizada.':'No se pudo abrir el archivo. '+(lastEngineError||playbackFailure(e));await destroy();}}});}
async function destroy(){persistProgress();activeRecord=null;const previous=player;player=null;if(previous)try{await previous.destroy();}catch{}$('av-screen').replaceChildren();}
async function json(path,signal){const r=await fetch(path,{signal});const data=await r.json();if(!r.ok)throw Error('CLB:'+ (data.error||'La fuente respondió HTTP '+r.status));return data;}
function identity(){const kind=$('media-kind').value,id=$('media-id').value.trim(),season=Number($('media-season').value),episode=Number($('media-episode').value);if(!/^[1-9]\d{0,11}$/.test(id)||!['movie','series'].includes(kind)||kind==='series'&&(!Number.isInteger(season)||season<0||season>1000||!Number.isInteger(episode)||episode<1||episode>10000))throw Error('CLB:Identidad o episodio inválido.');return new URLSearchParams({kind,id,...(kind==='series'?{season,episode}:{})});}
function endpoint(action,params){return '/api/catalognet/'+action+'?'+params;}
document.addEventListener('securitypolicyviolation',event=>{if(event.blockedURI?.startsWith('blob')&&/script-src|worker-src/.test(event.effectiveDirective)){blockedPolicy=true;$('audio-status').textContent='La política de seguridad bloqueó el módulo de audio. Recarga la página para recibir la corrección.';}});
async function open(source,title,id,signal,record=null){
 blockedPolicy=false;lastEngineError='';
 if(!globalThis.AVPlayer)throw Error('CLB:El motor local no pudo cargarse.');
 if(globalThis.isSecureContext===false||typeof AudioWorkletNode==='undefined')throw Error('CLB:El reproductor necesita localhost o HTTPS y un navegador con AudioWorklet. Desde una IP por HTTP, vuelve a la ficha y elige otro proveedor.');
 $('audio-title').textContent=title;$('audio-status').textContent='';$('audio-status').textContent='Abriendo archivo y comprobando pistas…';
 // WebAssembly decodes audio; MSE would hand the unsupported Dolby track back to the browser.
 preparePlayerLanguage();
 const engine=new AVPlayer({container:$('av-screen'),getWasm:wasmResource,wasmBaseUrl:'/vendor/libmedia',checkUseMSE:()=>false,enableHardware:true,enableWebCodecs:true,enableWorker:true,enableWebGPU:false,indicatorUrl:'/vendor/libmedia/indicator.svg',pauseStateUrl:'/vendor/libmedia/state.svg',errorStateUrl:'/vendor/libmedia/error.svg',fullscreenDom:$('av-screen'),ui:{hasFolder:false,hasHeader:false,hasFooter:true,folderFolded:true}});player=engine;localizePlayer(engine);
 engine.on('played',()=>{if(id===generation)$('audio-status').textContent='';});
 engine.on('paused',()=>{if(id===generation)$('audio-status').textContent='';});engine.on('ended',()=>{if(id===generation){if(activeRecord)activeRecord.completed=true;persistProgress(true);$('audio-status').textContent='';}});
 engine.on('time',()=>{if(id===generation&&Date.now()-lastProgressSave>5000){persistProgress();lastProgressSave=Date.now();}});
 engine.on('paused',()=>{if(id===generation)persistProgress();});
 engine.on('error',error=>{if(id===generation){lastEngineError=playbackFailure(error);$('audio-status').textContent='Error de AVPlayer: '+lastEngineError;}});
 void AVPlayer.audioContext?.resume()?.catch(()=>{});let timeout;try{await Promise.race([engine.load(source,{http:{referrerPolicy:'no-referrer'}}),new Promise((_,reject)=>{timeout=setTimeout(()=>reject(Error('CLB:La fuente tardó más de 35 segundos en abrir. Vuelve a seleccionar una opción.')),35000);})]);}finally{clearTimeout(timeout);}if(id!==generation||signal.aborted)return;
 const streams=engine.getStreams();if(!supportedDimensions(streams))throw Error('CLB:El vídeo supera 1920×1080 o no se pudo comprobar su resolución. No se inicia en esta prueba.');
 const spanish=spanishTrack(streams);if(spanish)await engine.selectAudio(spanish.id);
 if(record){const saved=library.find(record.item);activeRecord=record;library.remember(record.item,{episode:record.episode,provider:'catalognet',streamIndex:record.index});const duration=Number(engine.getDuration())/1000;if(saved?.provider==='catalognet'&&!saved.completed&&saved.streamIndex===record.index&&JSON.stringify(saved.episode)===JSON.stringify(record.episode)&&saved.position>0&&saved.position<duration-3){record.restoring=true;let pending=true;engine.on('played',()=>{if(!pending||id!==generation)return;pending=false;Promise.resolve().then(()=>engine.seek(BigInt(Math.floor(saved.position*1000)))).catch(()=>{if(id===generation)$('audio-status').textContent='No se pudo recuperar la posición guardada; puedes avanzar con la barra.';}).finally(()=>{if(activeRecord===record)record.restoring=false;});});}} 

 Promise.resolve(engine.play()).catch(()=>{if(id===generation)$('audio-status').textContent='Pulsa Reproducir dentro del vídeo para iniciar.';});if(id===generation){$('audio-status').textContent='';}
}
$('lookup').onsubmit=e=>{e.preventDefault();schedule(async(id,signal)=>{const params=identity();$('audio-status').textContent='Consultando opciones…';$('audio-sources').replaceChildren();const data=await json(endpoint('links',params),signal);if(id!==generation)return;const sources=(data.sources||[]).filter(s=>within1080(s.quality));for(const row of sources){const b=document.createElement('button');b.className='source';b.textContent=[row.title,row.quality,row.size].filter(Boolean).join(' · ');b.onclick=()=>schedule(async(next,abort)=>{$('audio-status').textContent='Solicitando enlace temporal…';const query=new URLSearchParams(params);query.set('index',String(row.index));const result=await json(endpoint('resolve',query),abort);if(next!==generation)return;await open(result.url,row.title||'CATALOG//NET',next,abort);});$('audio-sources').append(b);}$('audio-status').textContent=sources.length?'Selecciona una opción para abrirla con AVPlayer.':'No hay opciones con resolución declarada hasta 1080p en esta respuesta.';});};
$('demo').onclick=()=>schedule((id,signal)=>open('/vendor/libmedia/test-dolby-1080.mkv','Prueba técnica · 1080p · E-AC-3 / AC-3',id,signal));
window.addEventListener('pagehide',()=>{generation++;request?.abort();void destroy();});
const params=new URL(location.href).searchParams;for(const [key,element] of [['id','media-id'],['kind','media-kind'],['season','media-season'],['episode','media-episode']])if(params.has(key))$(element).value=params.get(key);

// A file choice in the detail page is an explicit playback request; re-check that exact variant.
if(params.get('from')==='ficha'){
 let title='CATALOG//NET',original=null;try{original=detailItem(JSON.parse(params.get('clb')||'null'));if(original){title=original.name;const back=document.querySelector('header a');back.textContent='← Volver a la ficha';back.href=detailURL(original,params.has('detailSeason')?{season:Number(params.get('detailSeason')),episode:Number(params.get('detailEpisode'))}:null);}}catch{}
 const index=Number(params.get('index'));if(params.has('index')&&Number.isInteger(index)&&index>=0&&index<12)schedule(async(id,signal)=>{const query=identity();$('audio-status').textContent='Comprobando el archivo seleccionado…';const options=await json(endpoint('links',query),signal);const row=options.sources?.find(s=>s.index===index&&within1080(s.quality));if(!row)throw Error('CLB:El archivo seleccionado ya no figura hasta1080p. Vuelve a la ficha.');query.set('index',String(index));const result=await json(endpoint('resolve',query),signal);if(id===generation)await open(result.url,title+' · '+row.quality,id,signal,original?{item:original,index,episode:params.has('detailSeason')?{season:Number(params.get('detailSeason')),episode:Number(params.get('detailEpisode'))}:null}:null);});
}

installWebPlayerControls();
