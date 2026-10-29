import test from 'node:test';
import assert from 'node:assert/strict';
import {createDramasApi,asianItem} from '../dramas-api.mjs';
import {createDramaTests} from '../mobile/drama-tests.mjs';
async function invoke(api,path){let status,body;await api({url:path},{writeHead(s){status=s;},end(s){body=JSON.parse(s);}});return {status,...body};}
const coreano={id:'tt1234567',type:'series',name:'Coreano',country:'South Korea',releaseInfo:'2020',genres:['Romance']};
const chino={...coreano,id:'tt1234568',name:'Chino',country:'China'};
const feed=items=>async()=>Response.json({metas:items});

test('Dramas: clasificación estricta, sin películas/anime/variedades/futuros',()=>{
 assert.equal(asianItem(coreano).genres[0],'K-dramas');assert.equal(asianItem(chino).genres[0],'Dramas chinos');
 for(const change of [{type:'movie'},{country:'USA'},{country:undefined},{genres:['Animation']},{genres:['Reality-TV']},{releaseInfo:'2099'}])assert.equal(asianItem({...coreano,...change}),null);
});
test('Dramas: inicia en K-dramas sin modificar su consulta de reproducción ni consultar episodios de otros países',async()=>{
 let checked=0;const api=createDramasApi({fetcher:feed([coreano,chino]),detail:async()=>{checked++;throw Error('No debe consultarse');}});
 const r=await invoke(api,'/api/dramas/catalog');assert.equal(r.status,200);assert.equal(r.items.length,1);assert.equal(r.items[0].id,coreano.id);assert.equal(checked,0);
});
test('Dramas: fuentes antiguas y búsqueda global no reintroducen dramas chinos por disponer de metadatos',async()=>{
 const api=createDramasApi({fetcher:feed([coreano,{...chino,videos:[{season:1,episode:1}]}])});
 for(const source of ['all','series','asian','kdrama']){const r=await invoke(api,'/api/dramas/catalog?source='+source);assert.equal(r.items.length,1);assert.equal(r.items[0].id,coreano.id);}
});
test('Dramas: paginación aplica la selección coreana antes del cursor',async()=>{
 const many=Array.from({length:25},(_,i)=>({...coreano,id:'tt'+String(1234567+i)}));
 const api=createDramasApi({fetcher:feed([{...chino,id:'tt9999998'},...many])});
 const r=await invoke(api,'/api/dramas/catalog?source=all');assert.equal(r.items.length,24);assert.equal(r.hasMore,true);assert.equal(r.nextSkip,1);
 const next=await invoke(api,'/api/dramas/catalog?source=all&skip=1');assert.equal(next.items.length,1);assert.equal(next.hasMore,false);assert.equal(next.items[0].id,many.at(-1).id);
});
test('Dramas: búsqueda conserva país y filtro anual antes de paginar',async()=>{
 const api=createDramasApi({fetcher:feed([coreano,chino]),metadata:async()=>({metas:[coreano,chino,{...coreano,id:'tt1234572',country:'USA'}]})});
 const r=await invoke(api,'/api/dramas/catalog?source=kdrama&q=historia&year=2020');assert.equal(r.items.length,1);assert.equal(r.items[0].id,coreano.id);
});
test('Dramas: ReelShort e IA retirados no generan consultas, tampoco desde enlaces antiguos',async()=>{
 let calls=0;const api=createDramasApi({fetcher:async()=>{calls++;throw Error('No debe consultar');}});
 for(const source of ['reelshort','ai'])assert.equal((await invoke(api,'/api/dramas/catalog?source='+source)).status,400);
 assert.equal((await invoke(api,'/api/dramas/detail?id=reelshort:6854d0b51cc7f0fc460aa389')).status,410);assert.equal(calls,0);
});
test('Dramas: fallos de feed se pueden reintentar y un feed disponible basta',async()=>{
 let fail=true;const api=createDramasApi({fetcher:async()=>{if(fail)throw Error('Caída');return Response.json({metas:[coreano]});}});
 assert.equal((await invoke(api,'/api/dramas/catalog')).status,502);fail=false;assert.equal((await invoke(api,'/api/dramas/catalog')).items.length,1);
});
test('Dramas: Completo sigue exigiendo confirmación del final y todos los capítulos',()=>{
 let value;const tests=createDramaTests({storage:{getItem:()=>value,setItem:(k,v)=>{value=v;}}});
 assert.throws(()=>tests.set(coreano.id,{status:'complete',count:1,finished:false},{announcedEpisodes:2}));
 assert.throws(()=>tests.set(coreano.id,{status:'complete',count:1,finished:true},{announcedEpisodes:2}));
 tests.set(coreano.id,{status:'complete',count:2,finished:true},{announcedEpisodes:2});assert.equal(tests.get(coreano.id).status,'complete');
});
