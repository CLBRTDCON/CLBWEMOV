import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
const source=await readFile(new URL('../public/source-config.js',import.meta.url),'utf8');
function setup(){const ctx={URL,document:{hidden:false,getElementById(){return null;}}};vm.createContext(ctx);vm.runInContext(source,ctx);const frame={src:'https://cinesrc.st/embed/tv/123?s=1&e=2',contentWindow:{},isConnected:true};return {ctx,api:ctx.CineRecovery,frame};}
test('recuperación: solo error documentado del iframe actual, un reintento y posición real',()=>{
 const {api,frame}=setup();let retries=0,failures=0;
 const retry=()=>{retries++;frame.src=api.decorate(frame.src).href;api.watch(frame,'cinesrc',retry,()=>failures++);};
 api.watch(frame,'cinesrc',retry,()=>failures++);
 const event=data=>({origin:'https://cinesrc.st',source:frame.contentWindow,data});
 api.handle({...event({type:'cinesrc:error'}),origin:'https://evil.example'});
 api.handle({...event({type:'cinesrc:error'}),source:{}});assert.equal(retries,0);
 api.handle(event({type:'cinesrc:ready'}));assert.equal(retries,0);
 api.handle(event({type:'cinesrc:timeupdate',currentTime:2772,duration:7200}));
 api.handle(event({type:'cinesrc:error',error:'network'}));assert.equal(retries,1);
 assert.equal(new URL(frame.src).searchParams.get('t'),'2772');
 api.handle(event({type:'cinesrc:error'}));assert.equal(retries,1);assert.equal(failures,1);
 api.reset();api.handle(event({type:'cinesrc:error'}));assert.equal(retries,2);
});
test('recuperación: no reacciona a iframe retirado, app oculta o mensajes de proveedor latino',()=>{
 const {ctx,api,frame}=setup();let count=0;const retry=()=>count++;
 api.watch(frame,'cinesrc',retry);const event={origin:'https://cinesrc.st',source:frame.contentWindow,data:{type:'cinesrc:error'}};
 ctx.document.hidden=true;api.handle(event);ctx.document.hidden=false;
 frame.isConnected=false;api.handle(event);frame.isConnected=true;
 api.watch(frame,'facilito',retry);api.handle(event);
 api.clear();api.handle(event);assert.equal(count,0);
});
