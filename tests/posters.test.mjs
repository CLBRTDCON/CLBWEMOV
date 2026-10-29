import test from 'node:test';
import assert from 'node:assert/strict';
import {posterCandidates,createPosterLoader} from '../mobile/posters.mjs';
const tick=()=>new Promise(setImmediate);
const art=()=>({dataset:{},children:[],append(img){this.children.push(img);},setAttribute(k,v){this[k]=v;}});
const document={createElement(){return {addEventListener(){}};}};
test('portadas: tamaño móvil, respaldo solo por IMDb y rechazo de hosts ajenos',()=>{
  assert.deepEqual(posterCandidates({id:'550',imdbId:'tt0137523',posterUrl:'https://image.tmdb.org/t/p/original/a.jpg'}),['https://image.tmdb.org/t/p/w342/a.jpg','https://images.metahub.space/poster/medium/tt0137523/img']);
  assert.deepEqual(posterCandidates({id:'mal:223',posterUrl:'https://evil.example/poster.jpg'}),[]);
  assert.deepEqual(posterCandidates({id:'550'}),[]);
});
test('portadas: falla primaria, respaldo correcto y caché sin repetir peticiones',async()=>{
  const requested=[];
  class Image {removeAttribute(){}set src(url){requested.push(url);queueMicrotask(()=>url.includes('amazon')?this.onerror?.():this.onload?.());}}
  const loader=createPosterLoader({document,ImageClass:Image,Observer:null,timeout:100});
  const first=art(),second=art(),item={id:'tt0137523',name:'Fight Club',posterUrl:'https://m.media-amazon.com/poster.jpg'};
  loader.attach(first,item);await tick();loader.attach(second,item);await tick();
  assert.equal(first.dataset.cover,'ready');assert.equal(second.dataset.cover,'ready');assert.equal(requested.length,2);
  assert.match(first.children[0].src,/tt0137523/);
});
test('portadas: fuente bloqueada termina en tarjeta sin imagen y libera la cola',async()=>{
  let requested=0;
  class Image {removeAttribute(){this.cancelled=true;}set src(url){requested++;}}
  const loader=createPosterLoader({document,ImageClass:Image,Observer:null,timeout:5,concurrency:1});
  const first=art(),second=art();loader.attach(first,{id:'mal:1',name:'Uno',posterUrl:'https://s4.anilist.co/one.jpg'});loader.attach(second,{id:'mal:2',name:'Dos',posterUrl:'https://s4.anilist.co/two.jpg'});
  await new Promise(r=>setTimeout(r,35));assert.equal(requested,2);assert.equal(first.dataset.cover,'missing');assert.equal(second.dataset.cover,'missing');
  assert.match(first['aria-label'],/Uno/);
});
test('portadas: no descarga fuera de pantalla hasta que se aproxima el usuario',async()=>{
  let callback,watched,requested=0,disconnected=false;
  class Observer {constructor(cb){callback=cb;}observe(target){watched=target;}unobserve(){}disconnect(){disconnected=true;}}
  class Image {removeAttribute(){}set src(url){requested++;queueMicrotask(()=>this.onload?.());}}
  const loader=createPosterLoader({document,ImageClass:Image,Observer,timeout:100});
  const target=art();loader.attach(target,{id:'tt0137523',name:'Fight Club'});assert.equal(requested,0);
  callback([{target:watched,isIntersecting:true}]);await tick();assert.equal(requested,1);assert.equal(target.dataset.cover,'ready');
  loader.reset();assert.equal(disconnected,true);
});
