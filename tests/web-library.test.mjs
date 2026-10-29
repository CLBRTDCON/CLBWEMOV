import test from 'node:test';
import assert from 'node:assert/strict';
import {itemURL,readRequest,sectionRecords,visibleItem} from '../public/web-library-core.mjs';
import {createLibrary} from '../mobile/library.mjs';
const anime={id:'anilist:21',kind:'anime',section:'anime',name:'One Piece'};
const series={id:'tt0903747',kind:'series',section:'series',name:'Breaking Bad'};
test('web: enlaces conservan identidad, sección y episodio sin guardar streams',()=>{
 const url=new URL(itemURL(series,{season:2,episode:8}),'https://clb.invalid');assert.equal(url.pathname,'/series');
 const request=readRequest(url.search,'series');assert.deepEqual(request.episode,{season:2,episode:8});assert.equal(request.item.id,series.id);assert.equal(readRequest(url.search,'movie'),null);
 assert.equal(new URL(itemURL(anime),'https://clb.invalid').pathname,'/anime');
 assert.equal(new URL(itemURL({...series,section:'kids'}),'https://clb.invalid').pathname,'/kids');
 assert.equal(new URL(itemURL({...series,section:'documentary'}),'https://clb.invalid').pathname,'/documentales');
});
test('web: rechaza enlaces corruptos, episodios inválidos y fuentes retiradas',()=>{
 assert.equal(readRequest('?clb={','series'),null);
 const valid=new URL(itemURL(series),'https://clb.invalid');valid.searchParams.set('season','1');valid.searchParams.set('episode','0');assert.equal(readRequest(valid.search,'series'),null);
 assert.equal(visibleItem({...series,kind:'drama',section:'drama',id:'reelshort:012345678901234567890123'}),false);
 assert.throws(()=>itemURL({...series,section:'movie'}));
});
test('web: continuar viendo filtra sección exacta y comparte biblioteca local existente',()=>{
 let data;const storage={getItem:()=>data,setItem:(k,v)=>data=v};const a=createLibrary({storage});a.remember(series,{episode:{season:1,episode:3}});a.remember(anime,{episode:{season:1,episode:7}});a.toggle(series);
 const b=createLibrary({storage});assert.equal(sectionRecords(b.history(),'movie').length,0);assert.equal(sectionRecords(b.history(),'series')[0].item.id,series.id);assert.equal(sectionRecords(b.history(),'anime')[0].episode.episode,7);assert.equal(sectionRecords(b.history()).length,2);assert.equal(b.has(series),true);
});
