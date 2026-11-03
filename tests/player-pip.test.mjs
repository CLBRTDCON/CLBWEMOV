import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
const source=await readFile(new URL('../public/vendor/libmedia/avplayer.js',import.meta.url),'utf8');
function fixture({reject=false,deferred=false,width=1920,height=1080,sar={num:1,den:1}}={}){
 const timers=new Map(),events=new Map(),windowEvents=new Map(),sizes=[],requested=[],windowSizes=[];let sequence=0,resolve;
 const parent={children:[],insertBefore(node,next){node.parentNode?.removeChild?.(node);this.children.splice(next?this.children.indexOf(next):this.children.length,0,node);node.parentNode=this;node.parentElement=this;},removeChild(node){this.children.splice(this.children.indexOf(node),1);}};
 const sibling={parentNode:parent},node={parentNode:parent,parentElement:parent,nextSibling:sibling,offsetWidth:960,offsetHeight:540};parent.children=[node,sibling];
 const body={children:[],append(node){node.parentNode?.removeChild?.(node);this.children.push(node);node.parentNode=this;node.parentElement=this;},removeChild(node){this.children.splice(this.children.indexOf(node),1);}};
 const classes=new Set(),status={textContent:''};
 const element=()=>({children:[],setAttribute(){},addEventListener(k,fn){this[k]=fn;},append(node){this.children.push(node);node.parentNode=this;},remove(){this.parentNode?.removeChild?.(this);}});
 const pipWindow={innerWidth:480,innerHeight:270,outerWidth:496,outerHeight:306,navigator:{userActivation:{isActive:false}},screen:{availWidth:1920,availHeight:1080},resizeTo(width,height){windowSizes.push([width,height]);this.outerWidth=width;this.outerHeight=height;this.innerWidth=width-16;this.innerHeight=height-36;},closed:false,document:{body,head:{appendChild(){}},documentElement:{classList:{add:v=>classes.add(v)}},createElement:element},addEventListener:(k,v)=>windowEvents.set(k,v),removeEventListener:(k,v)=>{if(windowEvents.get(k)===v)windowEvents.delete(k);},close(){this.closed=true;windowEvents.get('pagehide')?.();}};
 const pip={addEventListener:(k,v)=>events.set(k,v),removeEventListener:k=>events.delete(k),async requestWindow(options){requested.push(options);pipWindow.innerWidth=options.width;pipWindow.innerHeight=options.height;pipWindow.outerWidth=options.width+16;pipWindow.outerHeight=options.height+36;if(reject)throw Error('denied');if(deferred)await new Promise(r=>{resolve=r;});events.get('enter')?.({window:pipWindow});return pipWindow;}};
 const player={getSelectedVideoStreamId:()=>1,getStreams:()=>[{id:1,codecparProxy:{codecType:0,width,height,sampleAspectRatio:sar}}],isMSE:()=>false,getOptions:()=>({container:node}),resize:(...args)=>sizes.push(args),off(){}};
 const context={document:{styleSheets:[],getElementById:()=>status},documentPictureInPicture:pip,setTimeout:fn=>{timers.set(++sequence,fn);return sequence;},clearTimeout:id=>timers.delete(id)};
 const start=source.indexOf('85291:(e,t,i)=>{'),end=source.indexOf('},85459:',start);
 assert.ok(start>=0&&end>start);const factory=vm.runInNewContext('('+source.slice(start+6,end)+'})',context),exports={};
 const require=()=>'';require.d=(target,defs)=>{for(const[k,get]of Object.entries(defs))Object.defineProperty(target,k,{get});};require.n=v=>()=>v;factory({},exports,require);
 const component=exports.A,state={player},ui={get:k=>state[k],set:(k,v)=>state[k]=v};for(const[k,fn]of Object.entries(component.methods))ui[k]=fn.bind(ui);component.afterMount.call(ui);
 return {ui,component,requested,windowSizes,parent,sibling,node,pipWindow,sizes,timers,events,windowEvents,classes,status,state,release:()=>resolve?.(),flush(){const jobs=[...timers.values()];timers.clear();jobs.forEach(fn=>fn());}};
}
test('floating player moves only its container and restores its exact place on close',async()=>{
 const f=fixture();await f.ui.pipClick();assert.deepEqual(f.parent.children,[f.sibling]);assert.equal(f.pipWindow.document.body.children[0],f.node);assert.equal(f.pipWindow.document.body.children.length,2);assert.ok(f.classes.has('clb-player-pip'));assert.deepEqual(f.sizes,[[480,270]]);
 f.pipWindow.close();assert.deepEqual(f.parent.children,[f.node,f.sibling]);assert.equal(f.state.pip,false);assert.equal(f.windowEvents.size,0);assert.deepEqual(f.sizes.at(-1),[960,540]);
});
test('resize storms collapse to the last size; unchanged and zero sizes never reset renderer',async()=>{
 const f=fixture();await f.ui.pipClick();for(let i=0;i<40;i++){f.pipWindow.innerWidth=500+i;f.windowEvents.get('resize')();}assert.equal(f.timers.size,1);assert.equal(f.sizes.length,1);f.flush();assert.deepEqual(f.sizes.at(-1),[539,270]);
 f.windowEvents.get('resize')();f.flush();assert.equal(f.sizes.length,2);f.pipWindow.innerWidth=0;f.windowEvents.get('resize')();f.flush();assert.equal(f.sizes.length,2);
 f.pipWindow.innerWidth=640;f.windowEvents.get('resize')();f.component.beforeDestroy.call(f.ui);assert.equal(f.timers.size,0);assert.equal(f.pipWindow.closed,true);assert.equal(f.windowEvents.size,0);assert.equal(f.events.size,0);assert.deepEqual(f.parent.children,[f.node,f.sibling]);
});
test('denied or interrupted opening restores the player without leaving a floating orphan',async()=>{
 const denied=fixture({reject:true});await denied.ui.pipClick();assert.equal(denied.ui.pipOpening,false);assert.deepEqual(denied.parent.children,[denied.node,denied.sibling]);assert.ok(denied.status.textContent.length>0);
 const pending=fixture({deferred:true});const opened=pending.ui.pipClick();pending.component.beforeDestroy.call(pending.ui);pending.release();await opened;assert.equal(pending.pipWindow.closed,true);assert.deepEqual(pending.parent.children,[pending.node,pending.sibling]);assert.equal(pending.state.pip,false);
});

test('floating window opens with the selected video display aspect, including non-square pixels',async()=>{
 const wide=fixture({width:1920,height:800});await wide.ui.pipClick();assert.equal(wide.requested[0].width,480);assert.equal(wide.requested[0].height,200);assert.equal(wide.requested[0].preferInitialWindowPlacement,true);
 const television=fixture({width:720,height:576,sar:{num:16,den:15}});await television.ui.pipClick();assert.equal(television.requested[0].height,360);
 const portrait=fixture({width:1080,height:1920});await portrait.ui.pipClick();assert.equal(portrait.requested[0].height,540);assert.ok(Math.abs(portrait.requested[0].width/540-1080/1920)<.002);
});
test('floating size controls keep video ratio and include browser frame without changing the decoder',async()=>{
 const f=fixture({width:1920,height:800});await f.ui.pipClick();const tools=f.pipWindow.document.body.children[1];tools.children[1].click();assert.deepEqual(f.windowSizes.at(-1),[616,286]);assert.equal(f.pipWindow.innerWidth,600);assert.equal(f.pipWindow.innerHeight,250);
 f.pipWindow.innerHeight=500;f.pipWindow.outerHeight=536;f.windowEvents.get('resize')();f.flush();assert.equal(f.windowSizes.length,1,'OS resize without activation must not force a new window size');
 tools.children[2].click();assert.deepEqual(f.windowSizes.at(-1),[616,286]);assert.equal(f.pipWindow.innerHeight,250);
});
test('browser denial of window fitting leaves playback and safe resize handling intact',async()=>{
 const f=fixture();await f.ui.pipClick();f.pipWindow.innerHeight=500;f.pipWindow.resizeTo=()=>{throw Error('NotAllowedError');};assert.equal(f.ui.fitPip(),false);f.pipWindow.navigator.userActivation.isActive=true;assert.doesNotThrow(()=>{f.windowEvents.get('resize')();f.flush();});assert.deepEqual(f.sizes.at(-1),[480,500]);
});
