import test from 'node:test';import assert from 'node:assert/strict';
import {preferAudioOnStart,selectedAudioValue,audioChoices} from '../public/audio-1080-core.mjs';
test('Spanish is chosen before the first playback even when Japanese is default; vendor video policy and later manual choices are preserved',()=>{
 const japanese={id:9,type:1,default:true},spanish={id:12,type:1},video={id:3,type:0};let calls=0;
 const engine={findBestStream(streams,type,flag){calls++;assert.equal(this,engine);assert.equal(flag,true);return streams.find(s=>s.type===type);}};const original=engine.findBestStream;
 const restore=preferAudioOnStart(engine,spanish.id);assert.equal(engine.findBestStream([video,japanese,spanish],1,true),spanish);assert.equal(engine.findBestStream([video,japanese,spanish],0,true),video);assert.equal(calls,1);
 restore();assert.equal(engine.findBestStream,original);assert.equal(engine.findBestStream([video,japanese,spanish],1,true),japanese);restore();assert.equal(engine.findBestStream,original);
});
test('menu never receives the uninitialized -1 ID and synchronizes to actual audio after a manual change',()=>{
 const choices=[{id:9,label:'Japonés'},{id:12,label:'Español'}];assert.equal(selectedAudioValue(choices,-1,12),'12');assert.equal(selectedAudioValue(choices,9,12),'9');assert.equal(selectedAudioValue(choices,undefined,12),'12');assert.equal(selectedAudioValue(choices,-1,undefined),'9');assert.equal(selectedAudioValue([],undefined,undefined),'');
});
test('transport metadata can prioritize Spanish when the engine omits track languages',()=>{const streams=[{id:9,codecparProxy:{codecType:1}},{id:12,codecparProxy:{codecType:1}}];const choices=audioChoices(streams,[{language:'jpn'},{language:'spa'}]);assert.equal(choices.find(c=>/^(?:es|spa)(?:$|[-_])/.test(c.language)).id,12);});
