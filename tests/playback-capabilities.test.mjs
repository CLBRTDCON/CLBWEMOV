import test from 'node:test';
import assert from 'node:assert/strict';
import {playbackCapabilities,classifyPlaybackError,nativePayload,progressIdentity} from '../mobile/playback-capabilities.mjs';
import {createLibrary} from '../mobile/library.mjs';
import {installAndroidTransport} from '../mobile/api.mjs';
const item={id:'tt0903747',kind:'series',section:'series',name:'Breaking Bad',imdbId:'tt0903747'};
test('capacidades: un embed convencional no ofrece progreso, subtítulos o control ficticios',()=>{
 assert.equal(playbackCapabilities('facilito').commands,false);assert.equal(playbackCapabilities('vidlink').subtitles,false);assert.equal(playbackCapabilities('cinesrc').commands,true);assert.equal(playbackCapabilities('cinesrc').subtitles,false);assert.equal(playbackCapabilities('archive','file').native,true);
});
test('recuperación: acceso, ausente y codec no se reintentan como fallos de red',()=>{
 for(const code of [401,403,404,410,'codec','unknown'])assert.equal(classifyPlaybackError(code).retry,false);
 assert.equal(classifyPlaybackError(503).retry,true);
});
test('nativo: solo archivo directo Archive, nunca iframe o título distinto',()=>{
 assert.equal(nativePayload({playbackType:'movie'},item,null,null),null);
 assert.equal(nativePayload({playbackType:'file',streams:[{url:'https://evil.example/movie.mp4'}]},item,null,null),null);
 const p=nativePayload({playbackType:'file',name:'Documental',streams:[{url:'https://archive.org/download/public/example.mp4'}]},item,{season:1,episode:3},{position:90,streamIndex:0});
 assert.equal(p.position,90);assert.equal(p.identity,'series:tt0903747|1:3');assert.equal(progressIdentity(item,{season:1,episode:4}),'series:tt0903747|1:4');
});
test('biblioteca: guarda progreso confirmado CineSrc por episodio, migra sin borrar favoritos y rechaza estados obsoletos',()=>{
 let saved=null;const storage={getItem:()=>saved,setItem:(k,s)=>{saved=s;}};let lib=createLibrary({storage});lib.toggle(item);lib.remember(item,{episode:{season:1,episode:3}});
 assert.equal(lib.progress(item,{position:50,duration:1800,episode:{season:1,episode:3}}),false);
 assert.equal(lib.progress(item,{position:50,duration:1800,episode:{season:1,episode:3},evidence:'cinesrc',provider:'cinesrc'}),true);
 lib=createLibrary({storage});assert.equal(lib.find(item).position,50);assert.equal(lib.favorites().length,1);lib.remember(item,{episode:{season:1,episode:3}});assert.equal(lib.find(item).evidence,'cinesrc');
 lib.remember(item,{episode:{season:1,episode:4}});assert.equal(lib.find(item).position,0);assert.equal(lib.progress(item,{position:900,duration:1800,episode:{season:1,episode:3},evidence:'cinesrc'}),false);
 assert.equal(lib.progress(item,{position:NaN,duration:1800,evidence:'native'}),false);assert.equal(lib.progress(item,{position:4,duration:Infinity,evidence:'native'}),false);
});
test('Android: puente local no se envía al proxy de metadatos ni abre hosts nuevos',async()=>{
 const oldLocation=globalThis.location,oldFetch=globalThis.fetch,requests=[];globalThis.location={origin:'https://appassets.androidplatform.net'};
 try{installAndroidTransport(async(url,options)=>{requests.push(url);return {ok:true};});await fetch('https://appassets.androidplatform.net/mobile/native-prepare?payload=x');await fetch('https://api.tvmaze.com/shows');assert.match(requests[0],/\/mobile\/native-prepare/);assert.match(requests[1],/\/network\?target=/);}finally{globalThis.location=oldLocation;globalThis.fetch=oldFetch;}
});
