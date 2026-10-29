// Seguimiento pasivo: el reproductor original conserva todos sus controles.
import {progressIdentity,classifyPlaybackError} from './playback-capabilities.mjs';
const origin='https://cinesrc.st';
const seconds=value=>typeof value==='number'&&Number.isFinite(value)&&value>=0&&value<=86400;
export function installMobilePlayback({document,window,library,actions,recover=true}){
 const status=document.getElementById('play-status');
 let context=null,frame=null,snapshot=null,position=null,duration=null,lastSave=-1,retryTimer=null,ended=false;
 const retries=new Map();
 function save(completed=false,force=false){
  if(!snapshot||!(position>0)||!(duration>0)||(!force&&!completed&&Math.abs(position-lastSave)<5))return;
  lastSave=position;
  library.progress(snapshot.item,{position,duration,episode:snapshot.episode,evidence:'cinesrc',provider:'cinesrc',completed});
 }
 function detach(){window.clearTimeout(retryTimer);retryTimer=null;save(ended,true);frame=null;snapshot=null;position=duration=null;lastSave=-1;ended=false;}
 function attach(media,provider,ctx){
  detach();if(provider!=='cinesrc')return;
  frame=media;snapshot={item:structuredClone(ctx.item),episode:ctx.episode?{...ctx.episode}:null};
 }
 window.addEventListener('message',event=>{
  const data=event.data;
  if(!frame||frame.isConnected===false||event.origin!==origin||event.source!==frame.contentWindow||!data||typeof data!=='object')return;
  if(!['cinesrc:play','cinesrc:pause','cinesrc:ended','cinesrc:timeupdate','cinesrc:seeked','cinesrc:loadedmetadata','cinesrc:error'].includes(data.type))return;
  if(data.type==='cinesrc:error'){
   const code=typeof data.error==='object'?data.error?.code:null;
   status.textContent=classifyPlaybackError(code||'unknown').message.replace(/Prueba otro servidor\./,'Puedes recargar el servidor.').replace(/o probar otro servidor/,'el servidor');
   const identity=progressIdentity(snapshot.item,snapshot.episode),failedFrame=frame;
   if(recover&&Number.isInteger(code)&&code>=500&&code<=504&&!document.hidden&&(retries.get(identity)||0)<1){
    retries.set(identity,1);if(retries.size>30)retries.delete(retries.keys().next().value);
    retryTimer=window.setTimeout(()=>{retryTimer=null;if(frame===failedFrame&&frame.isConnected!==false&&!document.hidden&&context?.item&&identity===progressIdentity(context.item,context.episode))actions.reload();},1500);
   }
   return;
  }
  if(data.type==='cinesrc:ended')ended=true;
  if(data.type==='cinesrc:play')ended=false;
  if(seconds(data.currentTime))position=data.currentTime;
  if(seconds(data.duration)&&data.duration>0)duration=data.duration;
  save(ended,['cinesrc:pause','cinesrc:ended'].includes(data.type));
 });
 return {
  setContext(ctx){context=ctx;},attach,detach,
  suspend(){save(ended,true);},resume(){},
  decorate(value,item,episode){
   const url=new URL(value),saved=library.find(item);
   if(url.origin!==origin)return value;
   // Nunca ocultar los controles originales, aunque llegue una URL del modo anterior.
   url.searchParams.delete('controls');
   if(saved?.provider==='cinesrc'&&!saved.completed&&saved.position>0&&saved.episode?.season===episode?.season&&saved.episode?.episode===episode?.episode){
    url.searchParams.set('t',String(Math.floor(saved.position)));url.searchParams.set('continueprompt','false');
   }
   return url.href;
  }
 };
}
