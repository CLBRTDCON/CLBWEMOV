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

test('failed availability checks can retry without resubmitting confirmed empty titles',async()=>{
 let calls=0;const ctx={Map,Set,URL,JSON,AbortSignal,location:{pathname:'/'},fetch:async()=>({ok:true,json:async()=>({results:[{state:++calls===1?'unknown':'available'}]})})};ctx.globalThis=ctx;vm.createContext(ctx);vm.runInContext(await readFile(new URL('../public/availability-filter.js',import.meta.url),'utf8'),ctx);
 const rows=[{id:'tt9335498',kind:'series',section:'anime'}],container={isConnected:true};let updates=0;ctx.CLBAvailability.track(container,rows,()=>updates++);await new Promise(setImmediate);assert.equal(ctx.CLBAvailability.failed(rows),true);
 ctx.CLBAvailability.retry(rows);assert.equal(ctx.CLBAvailability.pending(rows),true);await new Promise(setImmediate);assert.equal(ctx.CLBAvailability.has(rows[0]),true);assert.equal(calls,2);assert.ok(updates>=3);
 ctx.CLBAvailability.retry(rows);await new Promise(setImmediate);assert.equal(calls,2);
});

test('streaming availability delivers a ready title before a slower title finishes',async()=>{
 let finishSlow;const slow=new Promise(resolve=>finishSlow=resolve);const api=createAvailabilityApi({inspect:async item=>item.id==='tt7654321'?slow:{state:'available'}});const chunks=[];let status;
 const req=Object.assign(Readable.from([JSON.stringify({items:[{kind:'series',id:'tt1234567'},{kind:'series',id:'tt7654321'}]})]),{url:'/api/availability/check?stream=1',method:'POST',headers:{host:'127.0.0.1:4173',origin:'http://127.0.0.1:4173','content-type':'application/json'}});
 const task=api(req,{writeHead(code){status=code;},write(text){chunks.push(JSON.parse(text));},end(){}});await new Promise(setImmediate);assert.equal(status,200);assert.deepEqual(chunks.map(({index,state})=>({index,state})),[{index:0,state:'available'}]);finishSlow({state:'empty'});await task;assert.deepEqual(chunks.map(({index,state})=>({index,state})),[{index:0,state:'available'},{index:1,state:'empty'}]);
});
test('browser applies each streamed availability result before response completion',async()=>{
 let controller;const updates=[];const ctx={Map,Set,URL,JSON,AbortSignal,TextDecoder,location:{pathname:'/series'},fetch:async()=>({ok:true,headers:{get:()=> 'application/x-ndjson'},body:new ReadableStream({start(c){controller=c;}})})};ctx.globalThis=ctx;vm.createContext(ctx);vm.runInContext(await readFile(new URL('../public/availability-filter.js',import.meta.url),'utf8'),ctx);
 const items=[{kind:'series',id:'tt1234567'},{kind:'series',id:'tt7654321'}];ctx.CLBAvailability.track({isConnected:true},items,()=>updates.push(items.map(i=>ctx.CLBAvailability.has(i))));await new Promise(setImmediate);
 const encoder=new TextEncoder();controller.enqueue(encoder.encode('{"index":0,"state":"available"}\n'));await new Promise(setImmediate);assert.equal(ctx.CLBAvailability.has(items[0]),true);assert.equal(ctx.CLBAvailability.pending(items),true);assert.deepEqual(updates[0],[true,false]);
 controller.enqueue(encoder.encode('{"index":1,"state":"empty"}\n'));controller.close();await new Promise(setImmediate);assert.equal(ctx.CLBAvailability.pending(items),false);assert.equal(ctx.CLBAvailability.has(items[1]),false);
});

test('browser retries an unknown result after its short TTL rather than hiding it forever',async()=>{
 let clock=1000,calls=0;const ctx={Map,Set,URL,JSON,AbortSignal,Date:{now:()=>clock},location:{pathname:'/series'},fetch:async()=>({ok:true,json:async()=>({results:[{state:++calls===1?'unknown':'available'}]})})};ctx.globalThis=ctx;vm.createContext(ctx);vm.runInContext(await readFile(new URL('../public/availability-filter.js',import.meta.url),'utf8'),ctx);const item={kind:'series',id:'tt0086817'},container={isConnected:true};ctx.CLBAvailability.track(container,[item],()=>{});await new Promise(setImmediate);assert.equal(ctx.CLBAvailability.failed([item]),true);clock+=30001;ctx.CLBAvailability.track(container,[item],()=>{});await new Promise(setImmediate);assert.equal(ctx.CLBAvailability.has(item),true);assert.equal(calls,2);
});
