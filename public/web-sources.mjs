import {detailURL} from './ficha-core.mjs';
// Navigation belongs to the CLB document. No inspection or control of third-party iframe DOM.
window.CLBDetails={url:detailURL,open(item,episode){const target=detailURL(item,episode);if(!target)return false;location.assign(target);return true;}};
document.addEventListener('click',event=>{if(event.defaultPrevented||event.button!==0||event.ctrlKey||event.metaKey||event.shiftKey||event.altKey)return;const a=event.target.closest('a[href]');if(!a||a.target==='_blank')return;try{const u=new URL(a.href,location.href);if(u.origin!==location.origin||!['/','/series','/anime','/kids','/documentales','/dramas','/biblioteca'].includes(u.pathname)||!u.searchParams.has('clb'))return;const item=JSON.parse(u.searchParams.get('clb'));const episode=u.searchParams.has('season')?{season:Number(u.searchParams.get('season')),episode:Number(u.searchParams.get('episode'))}:null;const target=detailURL(item,episode);if(target){event.preventDefault();location.assign(target);}}catch{}},true);
const nav=document.querySelector('header nav, .desktop-nav, .detail-nav');
if(nav&&!nav.querySelector('a[href="/catalognet"]')){const link=document.createElement('a');link.href='/catalognet';link.textContent='CATALOG//NET';if(location.pathname==='/catalognet')link.setAttribute('aria-current','page');nav.append(link);}
const key='clb.web.view.'+location.pathname+location.search;
window.addEventListener('pagehide',()=>{try{sessionStorage.setItem(key,JSON.stringify({y:scrollY,focus:document.activeElement?.id||''}));}catch{}});
window.addEventListener('pageshow',()=>{try{const value=JSON.parse(sessionStorage.getItem(key)||'null');if(value){document.getElementById(value.focus)?.focus({preventScroll:true});window.scrollTo(0,value.y||0);}}catch{}});
