import test from 'node:test';import assert from 'node:assert/strict';import vm from 'node:vm';import {readFile} from 'node:fs/promises';import {Readable} from 'node:stream';import {createAvailabilityApi} from '../availability-api.mjs';
async function call(api,items){let body,status;await api(Object.assign(Readable.from([JSON.stringify({items})]),{method:'POST',headers:{host:'127.0.0.1:4173',origin:'http://127.0.0.1:4173','content-type':'application/json'}}),{writeHead(c){status=c;},end(text){body=JSON.parse(text);}});return {status,body};}
test('availability caches checks, deduplicates and maps anime to exact source numbering',async()=>{
 const checked=[];const api=createAvailabilityApi({inspect:async i=>{checked.push(i);return {state:i.id==='tt1234567'?'available':'empty'};},animeDetail:async()=>({imdbId:'tt1234567',playbackType:'series',episodes:[{season:1,episode:1,sourceSeason:2,sourceEpisode:4}]})});
 const item={kind:'movie',id:'tt1234567'};const [a,b]=await Promise.all([call(api,[item]),call(api,[item])]);assert.equal(a.body.results[0].state,'available');assert.deepEqual(a,b);assert.equal(checked.length,1);
 await call(api,[{kind:'anime',id:'mal:40748'}]);assert.equal(checked[1].season,2);assert.equal(checked[1].episode,4);
 assert.equal((await call(api,[{kind:'movie',id:'https://evil.example'}])).status,400);
});
test('upstream errors remain unknown rather than being cached as no-content',async()=>{const api=createAvailabilityApi({inspect:async()=>{throw Error('upstream');}});assert.equal((await call(api,[{kind:'movie',id:'tt1234567'}])).body.results[0].state,'unknown');});
test('catalog cards stay hidden until confirmed and asynchronous updates preserve candidates',async()=>{
 class E{constructor(tag){this.tag=tag;this.children=[];this.isConnected=true;this.id='';}append(...values){this.children.push(...values);}replaceChildren(...values){this.children=values;}setAttribute(){}addEventListener(){}}
 const root=new E('div');root.id='movie-grid';const ctx={Map,Set,URL,JSON,AbortSignal,location:{pathname:'/'},document:{createElement:t=>new E(t)},fetch:async()=>({ok:true,json:async()=>({results:[{state:'available'},{state:'empty'}]})})};ctx.globalThis=ctx;vm.createContext(ctx);
 for(const name of ['public/availability-filter.js','public/genre-shelves.js'])vm.runInContext(await readFile(new URL('../'+name,import.meta.url),'utf8'),ctx);
 const items=[{id:'tt1234567',name:'Has file',genres:['Action']},{id:'tt7654321',name:'No file',genres:['Action']}];let created=[];ctx.CLBShelves.render(root,items,i=>{created.push(i.id);return new E('button');});assert.equal(created.length,0);await new Promise(setImmediate);assert.deepEqual(created,['tt1234567']);assert.equal(root.children[0].className,'genre-shelf');
});
