import test from 'node:test';
import assert from 'node:assert/strict';
import {installMobilePlayback} from '../mobile/mobile-playback.mjs';
import {createLibrary} from '../mobile/library.mjs';
class Element {
 constructor(tag='div'){this.tagName=tag.toUpperCase();this.children=[];this.dataset={};this.listeners={};this.isConnected=true;const classes=new Set();this.classList={add:c=>classes.add(c),remove:c=>classes.delete(c),contains:c=>classes.has(c)};}
 append(...children){for(const c of children){c.parentElement=this;this.children.push(c);}}
 after(c){this.parentElement.append(c);}
 setAttribute(){}
 addEventListener(name,fn){this.listeners[name]=fn;}
 querySelectorAll(selector){return this.children.flatMap(c=>[...(c.tagName===selector.toUpperCase()?[c]:[]),...c.querySelectorAll(selector)]);}
 querySelector(selector){return this.querySelectorAll(selector)[0]||null;}
 remove(){if(this.parentElement)this.parentElement.children=this.parentElement.children.filter(c=>c!==this);this.isConnected=false;}
 click(){this.listeners.click?.();}
}
function fixture(recover=true){
 const ids=new Map(['watch','player','play-status'].map(id=>[id,new Element()])),actions=new Element(),body=new Element(),timers=new Map(),listeners={};let sequence=0,saved;
 ids.get('watch').append(actions);ids.get('watch').querySelector=s=>s==='.actions'?actions:null;
 const document={getElementById:id=>ids.get(id),createElement:tag=>new Element(tag),body,hidden:false};
 const window={location:{origin:'https://test.invalid'},setTimeout:(fn,delay)=>{timers.set(++sequence,{fn,delay});return sequence;},clearTimeout:id=>timers.delete(id),addEventListener:(name,fn)=>listeners[name]=fn};
 const library=createLibrary({storage:{getItem:()=>saved,setItem:(k,v)=>saved=v}}),item={kind:'series',section:'series',id:'tt0903747',name:'Breaking Bad'},episode={season:1,episode:3,name:'Nombre del capítulo'};
 library.remember(item,{episode});const controller=installMobilePlayback({document,window,library,recover,actions:{controlled:()=>false,stop(){},original(){},reload(){}}});
 const context={item,episode,selected:{playbackType:'series'},canControlled:true};controller.setContext(context);
 const frame=new Element('iframe'),commands=[];frame.contentWindow={postMessage:(data,origin)=>commands.push({data,origin})};ids.get('player').append(frame);controller.attach(frame,'cinesrc',{item,episode});
 const emit=(data,overrides={})=>listeners.message({origin:'https://cinesrc.st',source:frame.contentWindow,data,...overrides});
 const button=name=>ids.get('player').querySelectorAll('button').find(b=>b.textContent===name);
 return {controller,library,item,episode,context,frame,emit,button,body,timers,commands,player:ids.get('player')};
}
test('móvil: controles originales sin panel, consultas ni órdenes de CLB',()=>{
 const f=fixture();assert.equal(f.player.children.length,1);assert.equal(f.player.querySelectorAll('button').length,0);
 f.emit({type:'cinesrc:play'});f.emit({type:'cinesrc:ready'});f.controller.suspend();f.controller.resume();
 assert.deepEqual(f.commands,[]);assert.equal(f.frame.inert,undefined);assert.equal(f.timers.size,0);
});
test('móvil: progreso confirmado conserva episodio y restaura controles originales',()=>{
 const f=fixture();f.emit({type:'cinesrc:timeupdate',currentTime:30,duration:1800});assert.equal(f.library.find(f.item).position,30);
 const resumed=new URL(f.controller.decorate('https://cinesrc.st/embed/tv/1396?s=1&e=3&controls=false',f.item,f.episode));
 assert.equal(resumed.searchParams.get('t'),'30');assert.equal(resumed.searchParams.get('e'),'3');assert.equal(resumed.searchParams.has('controls'),false);
 const other=new URL(f.controller.decorate('https://cinesrc.st/embed/tv/1396?s=1&e=4',f.item,{season:1,episode:4}));assert.equal(other.searchParams.has('t'),false);
 f.library.remember(f.item,{episode:{season:1,episode:4}});f.emit({type:'cinesrc:timeupdate',currentTime:100,duration:1800});assert.equal(f.library.find(f.item).position,0);
 f.controller.detach();assert.equal(f.timers.size,0);
});
test('móvil: ignora mensajes falsos, valores inválidos y frames retirados',()=>{
 const f=fixture(),time={type:'cinesrc:timeupdate',currentTime:90,duration:1800};
 f.emit(time,{origin:'https://fake.invalid'});f.emit(time,{source:{}});f.emit({...time,currentTime:NaN});assert.equal(f.library.find(f.item).position,0);
 f.frame.isConnected=false;f.emit(time);assert.equal(f.library.find(f.item).position,0);
 f.controller.detach();f.emit(time);assert.equal(f.library.find(f.item).position,0);
});
test('móvil: reintento limitado solo ante error explícito y cancelado al salir',()=>{
 const f=fixture();f.emit({type:'cinesrc:error',error:{code:403}});assert.equal(f.timers.size,0);
 f.emit({type:'cinesrc:error',error:{code:503}});assert.equal(f.timers.size,1);
 f.emit({type:'cinesrc:error',error:{code:503}});assert.equal(f.timers.size,1);
 f.controller.detach();assert.equal(f.timers.size,0);
});
test('móvil: un episodio terminado no se reanuda ni vuelve a incompleto al salir',()=>{
 const f=fixture();f.emit({type:'cinesrc:ended',currentTime:1800,duration:1800});f.controller.suspend();f.controller.detach();
 assert.equal(f.library.find(f.item).completed,true);
 assert.equal(new URL(f.controller.decorate('https://cinesrc.st/embed/tv/1396?s=1&e=3',f.item,f.episode)).searchParams.has('t'),false);
});
test('web: seguimiento pasivo no duplica la recuperación existente del reproductor',()=>{
 const f=fixture(false);f.emit({type:'cinesrc:error',error:{code:503}});assert.equal(f.timers.size,0);assert.equal(f.commands.length,0);
});
