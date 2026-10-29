import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
const source=await readFile(new URL('../public/source-config.js',import.meta.url),'utf8');
test('ahorro: interruptor persiste, restaura modo normal y conserva preferencia de calidad',()=>{
 const disk=new Map();
 function setup(){const input={checked:false,addEventListener(_,fn){this.change=fn;}};const ctx={URL,localStorage:{getItem:k=>disk.get(k),setItem:(k,v)=>disk.set(k,v)},document:{getElementById:()=>input}};vm.createContext(ctx);vm.runInContext(source,ctx);return {ctx,input};}
 const {ctx,input}=setup();assert.equal(input.checked,false);
 input.checked=true;input.change();assert.equal(ctx.CineDataSaver.enabled,true);
 assert.equal(ctx.CineSources.url('cinesrc','550',undefined,undefined,'es','1080').searchParams.get('quality'),'720');
 assert.equal(ctx.CineDataSaver.poster('https://image.tmdb.org/t/p/w342/a.jpg'),'https://image.tmdb.org/t/p/w185/a.jpg');
 const second=setup();assert.equal(second.input.checked,true);
 second.input.checked=false;second.input.change();assert.equal(second.ctx.CineSources.url('cinesrc','550',undefined,undefined,'es','1080').searchParams.get('quality'),'1080');
 assert.equal(second.ctx.CineDataSaver.poster('https://image.tmdb.org/t/p/w342/a.jpg'),'https://image.tmdb.org/t/p/w342/a.jpg');
 assert.equal(setup().input.checked,false);
});
test('ahorro: almacenamiento bloqueado no impide usar el interruptor',()=>{
 const ctx={URL,localStorage:{getItem(){throw Error('blocked');},setItem(){throw Error('blocked');}}};vm.createContext(ctx);vm.runInContext(source,ctx);
 ctx.CineDataSaver.set(true);assert.equal(ctx.CineDataSaver.enabled,true);ctx.CineDataSaver.set(false);assert.equal(ctx.CineDataSaver.enabled,false);
});
