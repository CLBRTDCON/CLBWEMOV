import test from 'node:test';import assert from 'node:assert/strict';import {Readable} from 'node:stream';
import {createAddonsLocalApi} from '../addons-local-api.mjs';import {sealLatadd,openLatadd,lataddHost} from '../latadd-media.mjs';
const manifest='https://example.com/private-latadd/manifest.json',video='https://node1.lat-add.com/movie.mkv?token=private';
const response=(data,statusCode=200,headers={})=>Object.assign(Readable.from([Buffer.isBuffer(data)?data:Buffer.from(JSON.stringify(data))]),{statusCode,headers});
async function call(api,path,{cookie,method='GET',range}={}){let status,body,headers;await api({url:'/api/addons-local/'+path,method,headers:{host:'clbwemov.vercel.app',...(cookie?{cookie}:{}),...(range?{range}:{})},socket:{}},{writeHead(s,h){status=s;headers=h},end(b){try{body=JSON.parse(b);}catch{body=b;}},destroy(){throw Error('Unexpected destroy')}});return{status,body,headers};}
test('relay tickets are encrypted, device-bound and expire',()=>{const token=sealLatadd(video,manifest,'device-a',1000);assert.equal(openLatadd(token,manifest,'device-a',1001),video);assert.ok(!Buffer.from(token,'base64url').toString().includes('private'));assert.throws(()=>openLatadd(token,manifest,'device-b',1001));assert.throws(()=>openLatadd(token,manifest,'device-a',1000+3*3600000));assert.equal(lataddHost('https://node1.lat-add.com.evil.test/movie'),false);assert.equal(lataddHost('http://node1.lat-add.com/movie'),false);});
test('existing account session unlocks both providers, no new code and revoked session cannot read media',async()=>{
 let valid=true,network=0;const viewer={id:'existing-session',accountId:'existing-account'};
 const access={session:async req=>valid&&req.headers.cookie==='existing-valid'?viewer:null,authorize:async(req,res)=>{if(valid&&req.headers.cookie==='existing-valid')return req.clbAccess=viewer;res.writeHead(401,{'Cache-Control':'no-store'});res.end(JSON.stringify({activationRequired:true}));return null;}};
 const api=createAddonsLocalApi({access,deployed:true,load:async()=>({latadd:manifest,latinobrid:'https://example.com/private-latin/manifest.json'}),request:async(url,opts)=>{network++;if(String(url).includes('/stream/'))return{response:response({streams:[{name:'1080p Latino',url:String(url).includes('private-latadd')?video:'https://nexus.tb-cdn.st/movie.mkv'}]})};return{url:new URL(url),response:response(Buffer.from([0x1a,0x45,0xdf,0xa3]),206,{'content-type':'video/x-matroska','content-range':'bytes 0-3/1000','content-length':'4'})};}});
 const locked=await call(api,'status');assert.ok(locked.body.providers.every(p=>p.locked));
 for(const provider of ['latinobrid','latadd']){const denied=await call(api,'links?provider='+provider+'&kind=movie&id=tt1375666');assert.equal(denied.status,401);}
 assert.equal(network,0);
 for(const provider of ['latinobrid','latadd']){const allowed=await call(api,'links?provider='+provider+'&kind=movie&id=tt1375666',{cookie:'existing-valid'});assert.equal(allowed.status,200);assert.equal(allowed.body.sources.length,1);assert.ok(!JSON.stringify(allowed.body).includes('private-'));}
 const native=await call(api,'resolve?provider=latadd&kind=movie&id=tt1375666&index=0&native=1',{cookie:'existing-valid'});assert.equal(native.body.url,video);
 const web=await call(api,'resolve?provider=latadd&kind=movie&id=tt1375666&index=0',{cookie:'existing-valid'});assert.equal(web.status,200);assert.ok(web.body.url.startsWith('/api/addons-local/latadd-media?token='));assert.ok(!web.body.url.includes('private'));
 const path=web.body.url.split('/api/addons-local/')[1];const media=await call(api,path,{cookie:'existing-valid',range:'bytes=0-3'});assert.equal(media.status,206);assert.equal(media.body.length,4);
 assert.equal((await call(api,path,{cookie:'existing-valid',range:'bytes=0-9999999'})).status,416);
 valid=false;assert.equal((await call(api,path,{cookie:'existing-valid',range:'bytes=0-3'})).status,401);
});
