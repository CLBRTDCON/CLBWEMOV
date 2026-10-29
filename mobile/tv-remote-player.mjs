// API documentada de CineSrc. Nunca accede al DOM ni extrae medios del proveedor.
export const remoteOrigin='https://cinesrc.st';
const seconds=value=>typeof value==='number'&&Number.isFinite(value)&&value>=0&&value<=86400;
export function remoteURL(value){
 const url=new URL(value);if(url.origin!==remoteOrigin||!/^\/embed\/(movie|tv)\/[1-9]\d*$/.test(url.pathname))throw new Error('Fuente incompatible');
 url.searchParams.set('controls','false');url.searchParams.set('autonext','false');return url.href;
}
export function createRemoteSession({frame,onState=()=>{},setTimer=setTimeout,clearTimer=clearTimeout}){
 let disposed=false,pending=null,timer=null;
 const state={ready:false,paused:null,currentTime:null,duration:null,ended:false,message:'Esperando respuesta del reproductor…'};
 const emit=()=>onState({...state});
 function send(command,args=[]){if(disposed||frame.isConnected===false)return false;frame.contentWindow?.postMessage({type:'cinesrc:command',command,args},remoteOrigin);return true;}
 function query(){send('getCurrentTime');send('getDuration');send('getPaused');}
 function handle(event){
  const d=event.data;if(disposed||frame.isConnected===false||event.origin!==remoteOrigin||event.source!==frame.contentWindow||!d||typeof d!=='object')return false;
  if(!['cinesrc:ready','cinesrc:play','cinesrc:pause','cinesrc:ended','cinesrc:timeupdate','cinesrc:seeked','cinesrc:loadedmetadata','cinesrc:response','cinesrc:error'].includes(d.type))return false;
  if(d.type==='cinesrc:error'){state.message='La fuente notificó un error. Usa Reproductor original u Otro servidor.';pending=null;clearTimer(timer);emit();return true;}
  if(!state.ready&&!pending)clearTimer(timer);state.ready=true;
  if(d.type==='cinesrc:ready')query();
  if(d.type==='cinesrc:play'){state.paused=false;state.ended=false;}
  if(d.type==='cinesrc:ended')state.ended=true;
  if(['cinesrc:pause','cinesrc:ended'].includes(d.type))state.paused=true;
  if(seconds(d.currentTime))state.currentTime=d.currentTime;
  if(seconds(d.duration)&&d.duration>0)state.duration=d.duration;
  if(d.type==='cinesrc:response'){
   if(d.command==='getCurrentTime'&&seconds(d.result))state.currentTime=d.result;
   if(d.command==='getDuration'&&seconds(d.result)&&d.result>0)state.duration=d.result;
   if(d.command==='getPaused'&&typeof d.result==='boolean')state.paused=d.result;
  }
  const timeEvent=['cinesrc:timeupdate','cinesrc:seeked'].includes(d.type)||(d.type==='cinesrc:response'&&d.command==='getCurrentTime'&&seconds(d.result));
  const pauseEvent=['cinesrc:play','cinesrc:pause','cinesrc:ended'].includes(d.type)||(d.type==='cinesrc:response'&&d.command==='getPaused'&&typeof d.result==='boolean');
  const confirmed=pending&&(pending.kind==='seek'?timeEvent&&state.currentTime!==null&&Math.abs(state.currentTime-pending.target)<3:pauseEvent&&state.paused===pending.target);
  if(confirmed){pending=null;clearTimer(timer);}
  state.message=pending?'Orden enviada; esperando confirmación…':state.paused===false?'Reproduciendo':state.paused===true?'Pausado':'Fuente conectada; pulsa Reproducir';emit();return true;
 }
 function request(kind,target){
  clearTimer(timer);pending={kind,target};send(kind==='seek'?'seek':target?'pause':'play',kind==='seek'?[target]:[]);state.message='Orden enviada; esperando confirmación…';emit();
  timer=setTimer(()=>{pending=null;state.message='La fuente no confirmó la orden. Prueba Reproductor original u Otro servidor.';emit();},8000);query();
 }
 emit();timer=setTimer(()=>{state.message='Sin respuesta de la API. Puede haber un bloqueo o una carga pendiente; prueba Reproductor original u Otro servidor.';emit();},15000);
 return {handle,query,get state(){return {...state};},pause(){request('paused',true);},play(){request('paused',false);},toggle(){request('paused',state.paused===false);},seek(delta){if(!Number.isFinite(delta))return;if(state.currentTime===null||state.duration===null){state.message='Todavía no hay tiempo y duración confirmados para adelantar.';emit();return;}request('seek',Math.max(0,Math.min(state.duration,state.currentTime+delta)));},dispose(){disposed=true;clearTimer(timer);pending=null;}};
}
export function installRemotePlayer({document,window,onOriginal,onBack}){
 let session=null,panel=null,frame=null,active=false,hideTimer=null,buttons=[],label=null,time=null,progress=null;
 const format=value=>value===null?'--:--':`${Math.floor(value/60)}:${String(Math.floor(value%60)).padStart(2,'0')}`;
 function show(){if(!panel)return;window.clearTimeout(hideTimer);hideTimer=null;panel.classList.remove('tv-remote-hidden');if(session?.state.paused===false)hideTimer=window.setTimeout(()=>panel?.classList.add('tv-remote-hidden'),3500);}
 function dispose(){window.clearTimeout(hideTimer);hideTimer=null;session?.dispose();session=null;panel?.remove();panel=null;active=false;frame=null;}
 function attach(media){
  dispose();frame=media;frame.classList.add('tv-remote-frame');panel=document.createElement('div');panel.id='tv-remote-controls';panel.tabIndex=-1;
  label=document.createElement('p');label.setAttribute('role','status');time=document.createElement('span');progress=document.createElement('progress');progress.max=1;progress.value=0;progress.setAttribute('aria-label','Progreso del vídeo');
  const row=document.createElement('div');buttons=[];
  for(const [text,fn]of [['−10 s',()=>session.seek(-10)],['▶ Reproducir',()=>session.toggle()],['+10 s',()=>session.seek(10)],['Audio / subtítulos · Original',()=>onOriginal(session.state.currentTime)],['Volver',onBack]]){
   const b=document.createElement('button');b.type='button';b.textContent=text;b.addEventListener('click',()=>{fn();show();});buttons.push(b);row.append(b);
  }
  panel.append(label,time,progress,row);media.parentElement.append(panel);
  session=createRemoteSession({frame:media,setTimer:window.setTimeout.bind(window),clearTimer:window.clearTimeout.bind(window),onState:state=>{
   label.textContent=state.message;time.textContent=`${format(state.currentTime)} / ${format(state.duration)}`;progress.value=state.duration&&state.currentTime!==null?Math.min(1,state.currentTime/state.duration):0;
   buttons[1].textContent=state.paused===false?'Ⅱ Pausar':'▶ Reproducir';buttons[0].disabled=buttons[2].disabled=state.currentTime===null||state.duration===null;
   if(state.message!=='Reproduciendo')show();else if(!hideTimer)show();
  }});
 }
 window.addEventListener('message',event=>session?.handle(event));
 return {attach,dispose,get attached(){return !!session;},start(){active=true;show();buttons[1]?.focus({preventScroll:true});session?.query();},exit(){active=false;},handleKey(event){
  if(!active||!session)return false;
  if(!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Enter',' ','MediaPlayPause','MediaPlay','MediaPause'].includes(event.key))return false;
  event.preventDefault();if(event.repeat)return true;
  const hidden=panel.classList.contains('tv-remote-hidden');show();
  if(['MediaPlayPause','MediaPlay','MediaPause'].includes(event.key)){session.toggle();return true;}
  if(hidden){buttons[1].focus({preventScroll:true});return true;}
  const available=buttons.filter(b=>!b.disabled),index=available.indexOf(document.activeElement);
  if(['Enter',' '].includes(event.key)){(index<0?buttons[1]:available[index]).click();return true;}
  const step=['ArrowLeft','ArrowUp'].includes(event.key)?-1:1;available[Math.max(0,Math.min(available.length-1,index<0?1:index+step))]?.focus({preventScroll:true});return true;
 }};
}
