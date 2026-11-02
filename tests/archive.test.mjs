import test from 'node:test';
import assert from 'node:assert/strict';
import {archiveFile,matchingArchive,createArchiveApi} from '../archive-api.mjs';
const file=archiveFile('https://archive.org/download/metropolis/Metropolis.mp4');
const identity={kind:'movie',id:'tt0017136'};
test('Archive accepts only fixed-origin video download paths without traversal, credentials or other formats',()=>{
 assert.equal(file.identifier,'metropolis');
 for(const value of ['https://evil.example/download/id/a.mp4','https://archive.org/download/id/a.mkv','https://user:pass@archive.org/download/id/a.mp4','https://archive.org/download/id/%2e%2e%2fa.mp4','https://archive.org/metadata/id','https://archive.org/download/id/a.mp4?redirect=x'])assert.throws(()=>archiveFile(value));
});
test('Archive independently checks movie identity/year and rejects restricted items and trailers',()=>{
 assert.equal(matchingArchive({title:'Metropolis English Titles',year:'1927'},{name:'Metropolis',year:1927},identity,file),true);
 assert.equal(matchingArchive({title:'Metropolis',year:'2001'},{name:'Metropolis',year:1927},identity,file),false);
 assert.equal(matchingArchive({title:'Wrong movie',year:'1927'},{name:'Metropolis',year:1927},identity,file),false);
 assert.equal(matchingArchive({title:'Metropolis',year:'1927',is_dark:true},{name:'Metropolis',year:1927},identity,file),false);
 assert.equal(matchingArchive({title:'Metropolis',year:'1927'},{name:'Metropolis',year:1927},identity,{filename:'Metropolis trailer.mp4'}),false);
});
test('Archive series requires exact episode and explicit IMDb evidence, never fuzzy chapter replacement',()=>{
 const series={kind:'series',id:'tt0903747',season:1,episode:2},metadata={'external-identifier':'urn:imdb:tt0903747'};
 assert.equal(matchingArchive(metadata,{name:'Breaking Bad'},series,{filename:'Breaking.Bad.S01E02.mp4'}),true);
 assert.equal(matchingArchive(metadata,{name:'Breaking Bad'},series,{filename:'Breaking.Bad.S01E03.mp4'}),false);
 assert.equal(matchingArchive({title:'Breaking Bad'},{name:'Breaking Bad'},series,{filename:'Breaking.Bad.S01E02.mp4'}),false);
});
function response(){return {writeHead(s){this.status=s;},end(v){this.body=JSON.parse(v);}};}
test('Archive API filters wrong matches and caches exact identity without following redirects',async()=>{
 let calls=0;const api=createArchiveApi({metadataLookup:async()=>({meta:{id:'tt0017136',name:'Metropolis',year:1927}}),fetcher:async(url,options)=>{calls++;assert.equal(options.redirect,'error');return new Response(JSON.stringify(url.includes('onrender.com')?{streams:[{url:file.url},{url:'https://archive.org/download/wrong/Wrong.mp4'},{url:file.url}]}:{metadata:{title:url.endsWith('/wrong')?'Wrong':'Metropolis',year:'1927'},files:[{name:url.endsWith('/wrong')?'Wrong.mp4':'Metropolis.mp4',height:'720',size:'123'}]}));}});
 for(let i=0;i<2;i++){const r=response();await api({url:'/api/archive/links?kind=movie&id=tt0017136'},r);assert.equal(r.status,200);assert.equal(r.body.sources.length,1);assert.equal(r.body.sources[0].quality,'720p declarados');}assert.equal(calls,3);
});
test('Archive invalid input and upstream failures do not become no-content results',async()=>{
 let calls=0;const api=createArchiveApi({metadataLookup:async()=>({meta:{name:'Movie'}}),fetcher:async()=>{calls++;throw Error('private details');}});
 let r=response();await api({url:'/api/archive/links?kind=movie&id=550'},r);assert.equal(r.status,400);assert.equal(calls,0);
 r=response();await api({url:'/api/archive/links?kind=movie&id=tt0017136'},r);assert.equal(r.status,503);assert.equal(r.body.sources,undefined);assert.doesNotMatch(r.body.error,/private details/);
});
