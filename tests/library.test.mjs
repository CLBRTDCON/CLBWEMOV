import test from 'node:test';
import assert from 'node:assert/strict';
import {createLibrary,libraryItem} from '../mobile/library.mjs';
const movie={id:'550',imdbId:'tt0137523',kind:'movie',section:'movie',name:'Fight Club'};
const show={id:'tt0903747',kind:'series',section:'series',name:'Breaking Bad'};
const file={id:'archive:FilmOpen',kind:'archive',section:'documentary',name:'Open film'};
function disk(){const values=new Map();return {getItem:k=>values.get(k),setItem:(k,v)=>values.set(k,v)};}
test('biblioteca: guardar/quitar, identidad IMDb y persistencia al reiniciar',()=>{
 const storage=disk(),a=createLibrary({storage});assert.equal(a.toggle(movie),true);assert.equal(a.has({...movie,id:'tt0137523'}),true);const b=createLibrary({storage});assert.equal(b.favorites()[0].item.name,'Fight Club');b.toggle({...movie,id:'tt0137523'});assert.equal(b.favorites().length,0);
});
test('biblioteca: episodio exacto, no confunde temporadas y limita historial',()=>{
 const a=createLibrary({storage:disk()});a.remember(show,{episode:{season:1,episode:1},language:'latino'});a.remember(show,{episode:{season:2,episode:1},language:'original'});assert.equal(a.history().length,1);assert.deepEqual(a.history()[0].episode,{season:2,episode:1});assert.equal(a.history()[0].language,'original');
 for(let i=0;i<110;i++)a.remember({...movie,id:String(i+1),imdbId:null});assert.equal(a.history().length,100);
});
test('biblioteca: avance de archivos, cambio de archivo reinicia posición y finalizado sale de continuar',()=>{
 const a=createLibrary({storage:disk()});a.remember(file);a.progress(file,{position:90,duration:600});a.remember(file);assert.equal(a.find(file).position,90);a.remember(file,{streamIndex:1});assert.equal(a.find(file).position,0);a.progress(file,{position:600,duration:600,streamIndex:1,completed:true});assert.equal(a.history().length,0);a.remember(file,{streamIndex:1});assert.equal(a.find(file).position,0);
});
test('biblioteca: datos corruptos y cuota agotada se notifican sin declarar guardado exitoso',()=>{
 const errors=[],a=createLibrary({storage:{getItem:()=>'{bad',setItem(){throw Error('Quota');}},onError:e=>errors.push(e)});assert.equal(errors.length,1);assert.equal(a.toggle(movie),false);assert.equal(a.favorites().length,0);assert.equal(errors.length,2);
});
test('biblioteca: solo metadatos, sin streams/episodios completos; copias no mutan el estado',()=>{
 const a=createLibrary({storage:disk()});a.toggle({...movie,streams:[{url:'secret'}],episodes:[1,2,3]});const saved=a.favorites();assert.equal(saved[0].item.streams,undefined);assert.equal(saved[0].item.episodes,undefined);saved[0].item.name='Changed';assert.equal(a.favorites()[0].item.name,'Fight Club');assert.equal(libraryItem({...file,section:'kids'}),null);assert.equal(libraryItem({...movie,id:'javascript:alert(1)'}),null);
});
test('biblioteca: quitar historial no quita favorito; TV solo se guarda en Mi lista',()=>{
 const a=createLibrary({storage:disk()});a.toggle(movie);a.remember(movie);a.remove('history',movie);assert.equal(a.favorites().length,1);assert.equal(a.history().length,0);const tv={id:'One.mx',kind:'tv',section:'tv',name:'Canal'};assert.equal(a.remember(tv),false);assert.equal(a.toggle(tv),true);
});
