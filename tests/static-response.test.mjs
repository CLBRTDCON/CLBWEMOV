import test from 'node:test';
import assert from 'node:assert/strict';
import {gunzipSync} from 'node:zlib';
import {writeStatic} from '../static-response.mjs';
const content=Buffer.from('const example="prueba de compresión";\n'.repeat(200));
async function response(headers={},method='GET',body=content,file='app.js'){
 const out={writeHead(status,h){this.status=status;this.headers=h;},end(data){this.body=data;}};
 await writeStatic({method,headers},out,body,{'Content-Type':'text/javascript','Cache-Control':'no-store','Content-Security-Policy':"default-src 'self'"},file);return out;
}
test('estáticos: gzip conserva bytes y CSP, negocia q=0 y usa ETags por representación',async()=>{
 const compressed=await response({'accept-encoding':'gzip'});assert.deepEqual(gunzipSync(compressed.body),content);assert.ok(compressed.body.length<content.length);assert.equal(compressed.headers.Vary,'Accept-Encoding');assert.equal(compressed.headers['Content-Security-Policy'],"default-src 'self'");assert.equal(compressed.headers['Cache-Control'],'no-cache');
 const raw=await response({'accept-encoding':'gzip;q=0, *;q=1'});assert.equal(raw.headers['Content-Encoding'],undefined);assert.deepEqual(raw.body,content);assert.notEqual(raw.headers.ETag,compressed.headers.ETag);
});
test('estáticos: revalidación 304, cambios invalidan caché y HEAD no transmite cuerpo',async()=>{
 const first=await response();const cached=await response({'if-none-match':first.headers.ETag});assert.equal(cached.status,304);assert.equal(cached.body,undefined);
 const changed=await response({'if-none-match':first.headers.ETag},'GET',Buffer.from('changed'));assert.equal(changed.status,200);assert.notEqual(changed.headers.ETag,first.headers.ETag);
 const head=await response({'accept-encoding':'gzip'},'HEAD');assert.equal(head.body,undefined);assert.ok(head.headers['Content-Length']>0);
 const html=await response({},'GET',content,'index.html');assert.equal(html.headers.ETag,undefined);assert.equal(html.headers['Cache-Control'],'no-store');
});
