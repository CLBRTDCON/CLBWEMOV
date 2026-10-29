import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import {serveAccess} from '../web-access.mjs';
import handler from '../api/index.mjs';
const auth=(u,p)=>'Basic '+Buffer.from(u+':'+p).toString('base64');
function response(){return {headers:{},setHeader(k,v){this.headers[k.toLowerCase()]=v;},writeHead(s,h={}){this.status=s;for(const[k,v]of Object.entries(h))this.setHeader(k,v);},end(v){this.body=v;}};}
const env={VERCEL:'1',VERCEL_URL:'clb-test.vercel.app',CLB_ACCESS_USER:'viewer',CLB_ACCESS_PASSWORD:'test-password-not-a-secret'};
test('Vercel requires credentials, validates exact host and never trusts arbitrary forwarded hosts',()=>{
 let r=response();assert.equal(serveAccess({headers:{host:env.VERCEL_URL}},r,env),false);assert.equal(r.status,401);
 r=response();assert.equal(serveAccess({headers:{host:'evil.example','x-forwarded-host':env.VERCEL_URL,authorization:auth('viewer',env.CLB_ACCESS_PASSWORD)}},r,env),false);assert.equal(r.status,403);
 r=response();assert.equal(serveAccess({headers:{host:env.VERCEL_URL,authorization:auth('viewer','wrong')}},r,env),false);assert.equal(r.status,401);
 r=response();assert.equal(serveAccess({headers:{host:env.VERCEL_URL}},r,{...env,CLB_ACCESS_PASSWORD:''}),false);assert.equal(r.status,503);
});
test('Vercel accepts configured domain and auth; private responses override public cache headers',()=>{
 const r=response();assert.equal(serveAccess({headers:{host:'clb.example',authorization:auth('viewer',env.CLB_ACCESS_PASSWORD)}},r,{...env,CLB_ALLOWED_HOSTS:'clb.example'}),true);
 r.writeHead(200,{'Cache-Control':'public, max-age=86400'});assert.equal(r.headers['cache-control'],'private, no-store');
});
test('deployed handler protects HTML, API and vendor resources; serves wasm MIME and AVPlayer isolation',async()=>{
 const saved={...process.env};Object.assign(process.env,{...env,CLB_ALLOWED_HOSTS:'127.0.0.1:4199'});
 const server=http.createServer(handler);await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const base='http://127.0.0.1:'+server.address().port;process.env.CLB_ALLOWED_HOSTS='127.0.0.1:'+server.address().port;
 const request=path=>fetch(base+path,{headers:{Host:env.VERCEL_URL,Authorization:auth('viewer',env.CLB_ACCESS_PASSWORD)}});
 try{
  for(const path of ['/','/api/catalog?q=test','/vendor/libmedia/decode/ac3.wasm']){
   const r=await fetch(base+path,{headers:{Host:env.VERCEL_URL}});assert.equal(r.status,401);
  }
  const page=await request('/reproductor');assert.equal(page.status,200);assert.equal(page.headers.get('cross-origin-embedder-policy'),'require-corp');assert.equal(page.headers.get('cross-origin-opener-policy'),'same-origin');assert.match(await page.text(),/av-screen/);
  const wasm=await request('/vendor/libmedia/decode/ac3.wasm');assert.equal(wasm.status,200);assert.match(wasm.headers.get('content-type'),/^application\/wasm/);assert.equal(wasm.headers.get('cache-control'),'private, no-store');await wasm.arrayBuffer();
  const post=await fetch(base+'/',{method:'POST',headers:{Host:env.VERCEL_URL,Authorization:auth('viewer',env.CLB_ACCESS_PASSWORD)}});assert.equal(post.status,405);
  const key=await request('/.env');assert.equal(key.status,404);
 }finally{server.closeAllConnections();await new Promise(resolve=>server.close(resolve));for(const k of Object.keys(process.env))if(!(k in saved))delete process.env[k];Object.assign(process.env,saved);}
});
