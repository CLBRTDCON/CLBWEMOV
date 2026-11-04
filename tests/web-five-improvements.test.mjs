import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
import {recommendations} from '../public/recommendations-core.mjs';
import {exactVariant,recoverablePlayback} from '../public/audio-1080-core.mjs';
import {createLibrary} from '../mobile/library.mjs';

const film=(id,genres=['Acción'],extra={})=>({id,kind:'movie',section:'movie',name:id,year:2026,genres,...extra});
test('personal recommendations require actual progress, normalize genres and keep recent titles in their section',()=>{
 const seed=film('tt1000000'),history=[{item:seed,position:301,evidence:'file',updatedAt:10}];
 const candidates=[seed,film('tt1000001',['Action']),film('tt1000002',['Drama']),film('tt1000003',['Action'],{year:2024}),film('tt1000004',['Action'],{section:'anime'}),film('tt1000005',['Action'],{year:2027})];
 assert.deepEqual(recommendations(candidates,history,{section:'movie',year:2026}).items.map(i=>i.id),['tt1000001']);
 assert.equal(recommendations(candidates,[{...history[0],position:0}],{section:'movie',year:2026}).seed,null);
 assert.equal(recommendations(candidates,[{...history[0],evidence:null}],{section:'movie',year:2026}).items.length,0);
 assert.equal(recommendations(candidates,[{...history[0],completed:true,position:0}],{section:'movie',year:2026}).seed.name,seed.name);
});
test('exact file identity survives list reordering but rejects ambiguous or removed files',()=>{
 const options=[{index:0,key:'second'},{index:1,key:'selected'}];
 assert.equal(exactVariant(options,'selected',0).index,1);
 assert.equal(exactVariant(options,'removed',0),null);
 assert.equal(exactVariant([...options,{index:2,key:'selected'}],'selected',0),null);
 assert.equal(exactVariant([{index:0,key:'selected',unsupported:true}],'selected',0),null);
 for(const message of ['Failed to fetch','La fuente respondió HTTP 502','open stream failed, ret: -2'])assert.equal(recoverablePlayback(message),true);
 for(const message of ['HTTP 403 Forbidden','HTTP 429','Códec no disponible','El vídeo supera 1920×1080','La lista de archivos cambió'])assert.equal(recoverablePlayback(message),false);
});
test('library retains watched completion and stable variant position across indexes, without storing media URLs',()=>{
 let raw;const library=createLibrary({storage:{getItem:()=>raw,setItem:(_k,v)=>raw=v}}),item=film('tt1000000');
 library.remember(item,{provider:'latinobrid',variantKey:'selected',streamIndex:0});
 library.progress(item,{position:601,duration:1000,evidence:'file',provider:'latinobrid',variantKey:'selected',streamIndex:0});
 library.remember(item,{provider:'latinobrid',variantKey:'selected',streamIndex:3,url:'https://private/token'});
 assert.equal(library.find(item).position,601);assert.equal(library.find(item).streamIndex,3);assert.equal(library.watched().length,1);assert.equal(raw.includes('https://private'),false);
 library.remember(item,{provider:'latinobrid',variantKey:'different',streamIndex:3});assert.equal(library.find(item).position,0);
});
test('availability preserves anime movie and IMDb series types; native anime still uses anime mapping',async()=>{
 const identities=[];const ctx={AbortSignal,location:{pathname:'/anime'},fetch:async(_path,options)=>{const items=JSON.parse(options.body).items;identities.push(...items);return {ok:true,json:async()=>({results:items.map(()=>({state:'available'}))})};}};
 vm.createContext(ctx);vm.runInContext(await readFile(new URL('../public/availability-filter.js',import.meta.url),'utf8'),ctx);
 const items=[film('tt1000001',[],{section:'anime'}),{id:'tt1000002',kind:'series',section:'anime'},{id:'mal:40748',kind:'anime',section:'anime'}];
 ctx.CLBAvailability.track({isConnected:true},items,()=>{});await new Promise(setImmediate);
 assert.deepEqual(identities.map(i=>i.kind),['movie','series','anime']);assert.ok(items.every(ctx.CLBAvailability.has));
});
