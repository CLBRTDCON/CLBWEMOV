import test from 'node:test';
import assert from 'node:assert/strict';
import {episodePage,nextEpisode,bindTVVideo} from '../mobile/tv-watch.mjs';
import {createGlobalSearch,searchSections} from '../mobile/global-search.mjs';
test('TV: siguiente respeta orden, temporadas y no salta capítulos futuros o bloqueados',()=>{
 const one={season:1,episode:1},two={season:1,episode:2},three={season:2,episode:1},special={season:0,episode:1};
 assert.equal(nextEpisode([three,two,special,one],one),two);assert.equal(nextEpisode([three,two,one],two),three);assert.equal(nextEpisode([one,two,three],three),null);
 assert.equal(nextEpisode([one,{...two,locked:true},three],one),null);assert.equal(nextEpisode([one,{...two,upcoming:true}],one),null);assert.equal(nextEpisode([one],{season:9,episode:1}),null);
});
test('TV: episodios limitados a seis sin perder temporadas ni capítulos bloqueados',()=>{
 const entries=[...Array.from({length:200},(_,i)=>({season:1,episode:i+1,locked:i===7})),{season:2,episode:1}];
 assert.deepEqual(episodePage(entries,1,0).items.map(e=>e.episode),[1,2,3,4,5,6]);
 const next=episodePage(entries,1,1);assert.equal(next.items.length,6);assert.equal(next.items[1].locked,true);assert.equal(next.total,200);
 assert.deepEqual(episodePage(entries,1,999).items.map(e=>e.episode),[199,200]);
 assert.equal(episodePage(entries,2).items.length,1);assert.equal(episodePage(entries,9).items.length,0);
});
test('TV: vídeo directo oculta controles nativos e indicador durante reproducción; limpia temporizadores',()=>{
 const handlers=new Map(),timers=new Map();let id=0;
 const video={controls:true,paused:false,addEventListener:(k,v)=>handlers.set(k,v),removeEventListener:(k,v)=>{if(handlers.get(k)===v)handlers.delete(k);}};
 const hud={hidden:true},api=bindTVVideo(video,hud,{setTimer:(fn,ms)=>{assert.equal(ms,2500);timers.set(++id,fn);return id;},clearTimer:timer=>timers.delete(timer)});
 assert.equal(video.controls,false);assert.equal(hud.hidden,false);timers.get(id)();assert.equal(hud.hidden,true);
 video.paused=true;handlers.get('pause')();assert.equal(hud.hidden,false);assert.match(hud.textContent,/Pausado/);assert.equal(timers.size,0);
 video.paused=false;handlers.get('playing')();assert.equal(timers.size,1);api.fail();assert.equal(timers.size,0);assert.match(hud.textContent,/no respondió/);assert.equal(hud.hidden,false);api.dispose();assert.equal(timers.size,0);assert.equal(handlers.size,0);assert.equal(hud.hidden,true);
});
test('TV: búsqueda global excluye Dramas en las consultas, además del menú',async()=>{
 const paths=[],search=createGlobalSearch({api:async path=>{paths.push(path);return {items:[]};},sections:searchSections.filter(s=>s.key!=='drama')});
 const results=await search.search('Prueba');assert.equal(results.length,6);assert.equal(paths.length,6);assert.ok(paths.every(p=>!p.startsWith('/api/dramas')));assert.ok(results.every(s=>s.key!=='drama'));
});
