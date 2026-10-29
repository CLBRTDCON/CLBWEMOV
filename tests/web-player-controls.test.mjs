import test from 'node:test';
import assert from 'node:assert/strict';
import {installWebPlayerControls} from '../public/web-player-controls.mjs';
test('web fullscreen requests actual browser fullscreen and reports rejection',async()=>{
 let entered=0,exited=0;const nodes=new Map(),events=new Map();
 const node=id=>{if(!nodes.has(id))nodes.set(id,{setAttribute(){},addEventListener(){},requestFullscreen:async()=>{entered++;},showModal(){this.open=true;},close(){this.open=false;}});return nodes.get(id);};
 const document={getElementById:node,addEventListener:(n,f)=>events.set(n,f),exitFullscreen:async()=>{exited++;}};
 installWebPlayerControls({document});await node('player-fullscreen').onclick();assert.equal(entered,1);
 document.fullscreenElement=node('av-screen');await node('player-fullscreen').onclick();assert.equal(exited,1);
 document.fullscreenElement=null;node('av-screen').requestFullscreen=async()=>{throw Error('Denegado');};await node('player-fullscreen').onclick();assert.equal(node('audio-status').textContent,'Denegado');
 node('player-cast').onclick();assert.equal(node('screen-share-help').open,true);node('close-share-help').onclick();assert.equal(node('screen-share-help').open,false);
});
