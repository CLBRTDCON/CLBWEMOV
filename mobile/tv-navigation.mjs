// Navegación espacial del documento CLB. No inspecciona iframes de terceros.
import {installRemotePlayer,remoteURL} from './tv-remote-player.mjs';
import {installTVWatch,bindTVVideo} from './tv-watch.mjs';
export function nextFocus(current,items,direction){
 const c=current.rect,cx=(c.left+c.right)/2,cy=(c.top+c.bottom)/2;
 const horizontal=direction==='left'||direction==='right',positive=direction==='right'||direction==='down';
 return items.filter(i=>i!==current).map(i=>{
  const r=i.rect,x=(r.left+r.right)/2,y=(r.top+r.bottom)/2;
  const primary=horizontal?x-cx:y-cy,secondary=horizontal?Math.abs(y-cy):Math.abs(x-cx);
  const overlap=horizontal?r.bottom>c.top&&r.top<c.bottom:r.right>c.left&&r.left<c.right;
  return {item:i,valid:positive?primary>2:primary< -2,score:Math.abs(primary)+secondary*2+(overlap?0:1000)};
 }).filter(i=>i.valid).sort((a,b)=>a.score-b.score)[0]?.item;
}
// El borde del contenido vuelve a la sección activa, no al botón lateral más cercano.
export function contentNeighbor(current,items,direction,activeMenu){
 return nextFocus(current,items,direction)?.element||(direction==='left'?activeMenu:undefined);
}
export function installTVNavigation({document=globalThis.document,window=globalThis.window,actions}={}){
 if(new URLSearchParams(window.location.search).get('tv')!=='1')return;
 document.body.classList.add('tv-mode');document.title='Cinema LB TV';
 const $=id=>document.getElementById(id);let lastCard='',watchWasVisible=false,providerMode=false,lastMain=null;
 const main=document.querySelector('main'),sidebar=$('section-menu'),player=$('player');
 const remote=installRemotePlayer({document,window,onBack:()=>{window.CLBTVExitPlayer(true);if(window.location.origin==='https://appassets.androidplatform.net')window.location.assign('/mobile/fullscreen');},onOriginal:time=>{actions.originalRemote(time);window.CLBTVStartPlayer();}});
 window.CLBTVRemoteURL=remoteURL;window.CLBTVRemoteAttach=media=>{remote.attach(media);if(providerMode)remote.start();};window.CLBTVRemoteDispose=()=>remote.dispose();
 const watchUI=installTVWatch({document,window,actions});
 sidebar.querySelector('[data-kind="drama"]')?.remove();
 const hud=document.createElement('div');hud.id='tv-video-hud';hud.hidden=true;$('watch').append(hud);let directVideo=null,directControls=null;
 window.CLBTVVideoFailure=()=>directControls?.fail();
 let activeMenu=sidebar.querySelector('[aria-current="page"]');
 const globalButton=$('open-global');sidebar.prepend(globalButton);globalButton.innerHTML='<span>⌕</span>Buscar en todo';
 const brand=document.querySelector('.brand');brand.removeAttribute('href');brand.setAttribute('role','img');brand.tabIndex=-1;brand.inert=true;
 $('quality').closest('label').hidden=true;
 function top(){main.scrollTo({top:0,behavior:'auto'});focus(targets().find(e=>e.id==='global-query')||targets().find(e=>e.id==='search-tool')||activeMenu);}
 for(const el of sidebar.querySelectorAll('button[data-kind],button[data-library],#open-list,#open-history,#open-global'))el.addEventListener('click',()=>{
  activeMenu=el;for(const b of sidebar.querySelectorAll('button')){b.removeAttribute('aria-current');if(b===el)b.setAttribute('aria-current','page');}
  lastCard='';lastMain=null;top();
 });
 const visible=el=>!!el&&!el.disabled&&el.getClientRects().length>0&&window.getComputedStyle(el).visibility!=='hidden';
 function targets(){return [...document.querySelectorAll('button,input,select,a[href],summary,iframe,video')].filter(el=>visible(el)&&!el.closest('[inert]'));}
 function focus(el){if(!el)return;el.focus({preventScroll:true});el.scrollIntoView({block:'nearest',inline:'nearest',behavior:'auto'});}
 function lockPlayer(locked){
  if(player.inert!==locked)player.inert=locked;
  for(const media of player.querySelectorAll('iframe,video'))if(media.tabIndex!==(locked?-1:0))media.tabIndex=locked?-1:0;
 }
 window.CLBTVExitPlayer=(force=false)=>{const el=document.activeElement;if(force||providerMode||el?.tagName==='IFRAME'||el?.tagName==='VIDEO'){
  providerMode=false;remote.exit();window.MobileAppFullscreen(false);sidebar.inert=false;document.querySelector('header').inert=false;document.body.classList.remove('tv-provider-mode');lockPlayer(true);focus($('play'));return true;
 }return false;};
 window.CLBTVMenu=()=>{if(!window.CLBTVExitPlayer())focus(activeMenu||globalButton);};
 const button=document.createElement('button');button.id='tv-focus-player';button.type='button';button.className='primary';button.textContent='Pantalla completa ⛶';button.hidden=true;
 window.CLBTVStartPlayer=()=>{
  const media=player.querySelector('iframe,video');if(!media)return;providerMode=true;sidebar.inert=true;document.querySelector('header').inert=true;document.body.classList.add('tv-provider-mode');lockPlayer(false);window.MobileAppFullscreen(true);if(remote.attached)remote.start();else focus(media);
  if(media.tagName==='VIDEO'){if(media!==directVideo)bindDirect(media);media.play().catch(()=>{});directControls?.show();}
  if(window.location.origin==='https://appassets.androidplatform.net')window.location.assign(remote.attached?'/mobile/tv-clb-player':'/mobile/tv-player');
 };button.addEventListener('click',window.CLBTVStartPlayer);$('watch').querySelector('.actions').append(button);
 $('exit-fullscreen').addEventListener('click',event=>{if(window.location.origin!=='https://appassets.androidplatform.net'){event.preventDefault();window.CLBTVExitPlayer(true);}});
 const hint=document.createElement('p');hint.className='tv-help';hint.textContent='Flechas y OK para elegir · ← vuelve a tu sección · Ver ahora abre pantalla completa; Atrás vuelve a CLB.';$('catalog').prepend(hint);
 const cast=document.querySelector('.tv-connect[href$="/cast"]');if(cast)cast.hidden=true;
 document.addEventListener('focusin',e=>{
  if(main.contains(e.target)&&!player.contains(e.target))lastMain=e.target;
  if(e.target.classList.contains('card'))lastCard=e.target.getAttribute('aria-label');
  if(!providerMode&&player.contains(e.target))focus(button);
 });
 document.addEventListener('keydown',event=>{
  const el=document.activeElement,key=event.key;
  if(providerMode&&key==='Escape'){event.preventDefault();window.CLBTVExitPlayer(true);return;}
  if(remote.handleKey(event))return;
  if(el?.tagName==='IFRAME')return;
  if(el?.tagName==='VIDEO'){
   directControls?.show();
   if(['Enter',' ','MediaPlayPause'].includes(key)){event.preventDefault();if(!event.repeat){if(el.paused)el.play().catch(()=>{});else el.pause();}}
   if(['ArrowLeft','ArrowRight'].includes(key)&&Number.isFinite(el.duration)){event.preventDefault();el.currentTime=Math.max(0,Math.min(el.duration,el.currentTime+(key==='ArrowRight'?10:-10)));}return;
  }
  if(el?.tagName==='INPUT'&&el.type!=='checkbox')return;
  if(el?.tagName==='SELECT'&&['ArrowUp','ArrowDown','Enter',' '].includes(key))return;
  if(['Enter',' '].includes(key)&&el&&['BUTTON','A','SUMMARY','INPUT'].includes(el.tagName)){event.preventDefault();if(!event.repeat)el.click();return;}
  const direction={ArrowLeft:'left',ArrowRight:'right',ArrowUp:'up',ArrowDown:'down'}[key];if(!direction)return;
  event.preventDefault();const list=targets();if(!list.includes(el)){focus(activeMenu||globalButton);return;}
  if(document.querySelector('header').contains(el)){focus(direction==='left'?activeMenu:list.find(e=>main.contains(e)));return;}
  if(sidebar.contains(el)){
   const menuItems=list.filter(e=>sidebar.contains(e)),index=menuItems.indexOf(el);
   if(direction==='right')focus(visible(lastMain)&&!lastMain.closest('[inert]')?lastMain:list.find(e=>main.contains(e)));
   else if(direction==='up'||direction==='down')focus(menuItems[index+(direction==='down'?1:-1)]);
   return;
  }
  const row=el.closest('.genre-row');if(row&&(direction==='left'||direction==='right')){
   const cards=[...row.querySelectorAll('button')].filter(visible),index=cards.indexOf(el),next=cards[index+(direction==='right'?1:-1)];
   if(next){focus(next);return;}if(direction==='left'){focus(activeMenu||globalButton);return;}
  }
  const items=list.filter(e=>main.contains(e)).map(element=>({element,rect:element.getBoundingClientRect()})),current=items.find(i=>i.element===el);
  if(current)focus(contentNeighbor(current,items,direction,activeMenu||globalButton));
 });
 function repair(){
  watchUI.refresh();
  const media=player.querySelector('video');if(media!==directVideo)bindDirect(media);
  lockPlayer(!providerMode);const noVideo=!player.querySelector('iframe,video');if(button.disabled!==noVideo)button.disabled=noVideo;
  const watchVisible=!$('watch').hidden;if(providerMode)return;
  if(!watchVisible){
   if(!$('global-view').hidden)activeMenu=globalButton;
   else if(!$('library-view').hidden)activeMenu=$('open-list');
   else activeMenu=sidebar.querySelector('[data-kind][aria-current="page"]')||activeMenu;
  }
  if(watchVisible!==watchWasVisible){watchWasVisible=watchVisible;main.scrollTo({top:0,behavior:'auto'});if(watchVisible)focus(watchUI.isChoosing()?$('tv-episode-grid').querySelector('button:not(:disabled)'):!$('play').disabled?$('play'):$('back'));else focus(targets().find(e=>e.getAttribute('aria-label')===lastCard)||targets().find(e=>e.id==='global-query')||$('search-tool'));return;}
  if(!document.activeElement||document.activeElement===document.body||!visible(document.activeElement))focus(activeMenu||globalButton);
 }
 function bindDirect(media){directControls?.dispose();directVideo=media;directControls=media?bindTVVideo(media,hud):null;}
 let pending=false;const observer=new window.MutationObserver(records=>{
  if(records.every(r=>r.target.closest?.('.poster,#tv-video-hud,#tv-remote-controls')))return;
  if(pending)return;pending=true;window.requestAnimationFrame(()=>{pending=false;repair();});
 });observer.observe(document.body,{subtree:true,childList:true,attributes:true,attributeFilter:['hidden','disabled']});repair();
}
