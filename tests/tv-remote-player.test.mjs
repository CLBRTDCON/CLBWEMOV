import test from 'node:test';
import assert from 'node:assert/strict';
import {remoteOrigin,remoteURL,createRemoteSession} from '../mobile/tv-remote-player.mjs';
function fixture(){
 const sent=[],states=[],timers=new Map();let id=0;
 const frame={isConnected:true,contentWindow:{postMessage:(data,origin)=>sent.push({data,origin})}};
 const session=createRemoteSession({frame,onState:s=>states.push(s),setTimer:(fn,delay)=>{timers.set(++id,{fn,delay});return id;},clearTimer:id=>timers.delete(id)});
 const message=data=>session.handle({origin:remoteOrigin,source:frame.contentWindow,data});
 return {frame,sent,states,timers,session,message};
}
test('TV remoto: URL solo CineSrc, conserva identidad/episodio y desactiva navegación automática',()=>{
 const u=new URL(remoteURL('https://cinesrc.st/embed/tv/1396?s=2&e=8&t=120'));
 assert.equal(u.searchParams.get('s'),'2');assert.equal(u.searchParams.get('e'),'8');assert.equal(u.searchParams.get('t'),'120');assert.equal(u.searchParams.get('controls'),'false');assert.equal(u.searchParams.get('autonext'),'false');
 assert.throws(()=>remoteURL('https://evil.example/embed/movie/1'));assert.throws(()=>remoteURL('https://cinesrc.st/docs'));
});
test('TV remoto: solo el iframe actual y origen exacto pueden actualizar estado',()=>{
 const f=fixture(),data={type:'cinesrc:play'};
 assert.equal(f.session.handle({origin:'https://evil.example',source:f.frame.contentWindow,data}),false);
 assert.equal(f.session.handle({origin:remoteOrigin,source:{},data}),false);assert.equal(f.session.state.paused,null);
 f.message({type:'cinesrc:ready'});assert.equal(f.timers.size,0);assert.equal(f.session.state.paused,null);assert.equal(f.sent.length,3);
 assert.ok(f.sent.every(m=>m.origin===remoteOrigin));
 f.message(data);assert.equal(f.session.state.paused,false);f.frame.isConnected=false;assert.equal(f.message({type:'cinesrc:pause'}),false);f.session.dispose();
});
test('TV remoto: no inventa pausa ni avance; espera confirmación y limita búsqueda',()=>{
 const f=fixture();f.message({type:'cinesrc:play'});f.message({type:'cinesrc:timeupdate',currentTime:30,duration:100});
 f.session.toggle();assert.equal(f.session.state.paused,false);assert.equal(f.sent.find(m=>m.data.command==='pause').origin,remoteOrigin);
 f.message({type:'cinesrc:loadedmetadata',duration:100});assert.match(f.session.state.message,/esperando confirmación/);
 f.message({type:'cinesrc:pause'});assert.equal(f.session.state.paused,true);assert.equal(f.timers.size,0);
 f.session.seek(1000);assert.deepEqual(f.sent.findLast(m=>m.data.command==='seek').data.args,[100]);assert.equal(f.session.state.currentTime,30);
 f.message({type:'cinesrc:timeupdate',currentTime:99,duration:100});assert.equal(f.timers.size,0);
 f.message({type:'cinesrc:timeupdate',currentTime:NaN,duration:Infinity});assert.equal(f.session.state.currentTime,99);assert.equal(f.session.state.duration,100);
 f.session.seek(-1000);assert.deepEqual(f.sent.findLast(m=>m.data.command==='seek').data.args,[0]);f.session.dispose();assert.equal(f.timers.size,0);
});
test('TV remoto: tiempo de espera y errores visibles, sin recargar ni confirmar éxito',()=>{
 const f=fixture();assert.equal([...f.timers.values()][0].delay,15000);[...f.timers.values()][0].fn();assert.match(f.session.state.message,/Sin respuesta/);
 f.session.seek(10);assert.ok(!f.sent.some(m=>m.data.command==='seek'));
 f.session.toggle();const timeout=[...f.timers.values()].find(t=>t.delay===8000);timeout.fn();assert.match(f.session.state.message,/no confirmó/);assert.equal(f.session.state.paused,null);
 f.message({type:'cinesrc:error',error:'blocked'});assert.match(f.session.state.message,/error/);f.session.dispose();assert.equal(f.timers.size,0);
 assert.equal(f.message({type:'cinesrc:play'}),false);
});
