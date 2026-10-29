import {libraryItem} from '../mobile/library.mjs';
export const sectionNames={movie:'Películas',series:'Series',anime:'Anime',kids:'Kids',documentary:'Documentales',drama:'Dramas',tv:'TV en vivo'};
const routes={movie:'/',series:'/series',anime:'/anime',kids:'/kids',documentary:'/documentales',drama:'/dramas',tv:'/tv'};
export function visibleItem(item){return !!libraryItem(item)&&item.kind!=='drama'&&!String(item.id).startsWith('reelshort:')&&!(item.section==='drama'&&item.genres?.some(g=>g.startsWith('Dramas ')));}
export function sectionRecords(records,section){return records.filter(r=>visibleItem(r.item)&&(!section||r.item.section===section));}
export function itemURL(item,episode=null){
 const clean=libraryItem(item);if(!clean||!visibleItem(clean))throw Error('Ficha no disponible.');
 if(clean.kind==='tv')return '/tv?'+new URLSearchParams({country:'all',channel:clean.id});
 const params=new URLSearchParams({clb:JSON.stringify(clean)});
 if(episode&&Number.isInteger(episode.season)&&episode.season>=0&&Number.isInteger(episode.episode)&&episode.episode>0){params.set('season',episode.season);params.set('episode',episode.episode);}
 return routes[clean.section]+'?'+params;
}
export function readRequest(search,section){
 try{const p=new URLSearchParams(search),raw=p.get('clb');if(!raw||raw.length>8000)return null;const item=libraryItem(JSON.parse(raw));if(!item||item.section!==section||!visibleItem(item))return null;
 const s=p.get('season'),e=p.get('episode');let episode=null;
 if(s!==null||e!==null){if(!/^\d{1,4}$/.test(s||'')||!/^\d{1,5}$/.test(e||'')||Number(e)<1)return null;episode={season:Number(s),episode:Number(e)};}
 return {item,episode};}catch{return null;}
}
