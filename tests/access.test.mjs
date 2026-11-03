import test from 'node:test';
import assert from 'node:assert/strict';
import {Readable} from 'node:stream';
import {mkdtemp,rm,readFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {pathToFileURL} from 'node:url';
import {join} from 'node:path';
import {createAccessApi} from '../access-api.mjs';
import {fileAccessStore,redisAccessStore} from '../access-store.mjs';
import {createAddonsLocalApi} from '../addons-local-api.mjs';
async function call(access,action,{data,token='',origin='http://127.0.0.1:4173'}={}){const req=Readable.from(data===undefined?[]:[Buffer.from(JSON.stringify(data))]);Object.assign(req,{url:'/api/access/'+action,method:data===undefined?'GET':'POST',headers:{host:'127.0.0.1:4173',origin,cookie:token,'content-type':'application/json'},socket:{remoteAddress:'127.0.0.1'}});let status,body;const headers={};await access.api(req,{setHeader(k,v){headers[k]=v;},writeHead(code){status=code;},end(text){body=JSON.parse(text);}});return {status,body,token:headers['Set-Cookie']?.split(';')[0],headers};}
test('one-use codes grant exactly 30 days, survive restart and support revocation',async t=>{
 const dir=await mkdtemp(join(tmpdir(),'clb-access-'));t.after(()=>rm(dir,{recursive:true,force:true}));const file=pathToFileURL(join(dir,'state.json'));let time=1000000;const build=()=>createAccessApi({env:{},store:fileAccessStore(file),now:()=>time});let access=build();
 assert.equal((await call(access,'status')).body.setupRequired,true);
 assert.equal((await call(access,'setup',{data:{password:'a valid test password'},origin:'https://evil.example'})).status,403);
 const admin=await call(access,'setup',{data:{password:'a valid test password'}});assert.equal(admin.status,200);assert.match(admin.headers['Set-Cookie'],/HttpOnly; SameSite=Strict/);
 assert.equal((await call(access,'create',{data:{label:'TV'}})).status,401);
 const code=await call(access,'create',{data:{label:'TV'},token:admin.token});assert.equal(code.status,200);assert.equal(code.body.expires,time+600000);
 const redeemed=await Promise.all([call(access,'redeem',{data:{label:'TV',code:code.body.code}}),call(access,'redeem',{data:{label:'Laptop',code:code.body.code}})]);assert.deepEqual(redeemed.map(r=>r.status).sort(),[200,400]);const viewer=redeemed.find(r=>r.status===200);assert.equal(viewer.body.expires,time+30*86400000);
 const disk=await readFile(file,'utf8');assert.equal(disk.includes(code.body.code.replace('-','')),false);assert.equal(disk.includes('a valid test password'),false);assert.equal(disk.includes(viewer.token.split('=')[1]),false);
 access=build();assert.equal((await call(access,'status',{token:viewer.token})).body.authorized,true);
 const list=await call(access,'list',{data:{},token:admin.token});assert.equal(list.body.devices.length,1);
 await call(access,'revoke',{data:{id:list.body.devices[0].id},token:admin.token});assert.equal((await call(access,'status',{token:viewer.token})).body.authorized,false);
 const next=await call(access,'create',{data:{label:'Phone'},token:admin.token});const activated=await call(access,'redeem',{data:{code:next.body.code,label:'Phone'}});time+=30*86400000;assert.equal((await call(access,'status',{token:activated.token})).body.authorized,false);
});
test('expired activation and excessive attempts are rejected; Vercel fails closed without persistent storage',async()=>{
 let data={codes:{},sessions:{},attempts:{}},time=0;const store={async update(fn){return fn(data);}};const a=createAccessApi({env:{},store,now:()=>time});const admin=await call(a,'setup',{data:{password:'another test password'}});const code=await call(a,'create',{data:{label:'TV'},token:admin.token});time+=600001;assert.equal((await call(a,'redeem',{data:{code:code.body.code,label:'TV'}})).status,400);
 for(let i=0;i<30;i++)await call(a,'redeem',{data:{code:'invalid',label:'TV'}});assert.equal((await call(a,'redeem',{data:{code:'invalid',label:'TV'}})).status,429);
 assert.equal((await call(createAccessApi({env:{VERCEL:'1'}}),'status')).status,503);
});
test('Latinobrid listing, resolution and config cannot bypass authorization',async()=>{
 let requests=0;const access={session:async()=>null,authorize:async(req,res)=>{res.writeHead(401);res.end(JSON.stringify({error:'locked'}));return null;}};
 const api=createAddonsLocalApi({access,load:async()=>({latinobrid:'https://example.com/secret/manifest.json'}),request:async()=>{requests++;throw Error('must not request');}});
 for(const action of ['links','resolve']){let status;const req={url:'/api/addons-local/'+action+'?provider=latinobrid&kind=movie&id=tt1375666&index=0',headers:{},socket:{remoteAddress:'127.0.0.1'}};await api(req,{writeHead(c){status=c;},end(){}});assert.equal(status,401);}assert.equal(requests,0);
});
test('Redis CAS retries conflicts instead of losing updates',async()=>{
 let value=null,conflict=true;const store=redisAccessStore({url:'https://example.com',token:'test',fetcher:async(_url,opts)=>{const args=JSON.parse(opts.body);if(args[0]==='GET')return {ok:true,json:async()=>({result:value})};if(conflict){conflict=false;value=JSON.stringify({codes:{},sessions:{},attempts:{},other:true});return {ok:true,json:async()=>({result:0})};}value=args[5];return {ok:true,json:async()=>({result:1})};}});
 await store.update(d=>{d.saved=true;});assert.equal(JSON.parse(value).other,true);assert.equal(JSON.parse(value).saved,true);
});
