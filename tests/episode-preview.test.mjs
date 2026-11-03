import test from 'node:test';import assert from 'node:assert/strict';
import {episodePreview} from '../episode-preview.mjs';import {seriesApi} from '../series-api.mjs';
test('episode stills accept trusted HTTPS metadata and discard unrelated or credentialed URLs',()=>{
 const url='https://episodes.metahub.space/tt0086817/1/1/w780.jpg';assert.equal(episodePreview({thumbnail:url}).thumbnailUrl,url);
 for(const thumbnail of ['http://episodes.metahub.space/a.jpg','https://episodes.metahub.space.evil.test/a.jpg','https://user:pass@episodes.metahub.space/a.jpg','https://episodes.metahub.space:8443/a.jpg','javascript:alert(1)'])assert.equal(episodePreview({thumbnail}).thumbnailUrl,'');
 const data=episodePreview({image:{medium:'https://static.tvmaze.com/uploads/images/medium_landscape/1/2.jpg'},summary:'<p>A real <b>episode</b> summary.</p>',runtime:42});assert.equal(data.description,'A real episode summary.');assert.equal(data.runtime,42);assert.ok(data.thumbnailUrl);assert.equal(episodePreview({runtime:99999}).runtime,null);
});
test('series detail preserves each episode photo, description and exact season/episode identity',async()=>{
 let status,body;await seriesApi({url:'/api/series/detail?id=tt0086817'},{writeHead(s){status=s;},end(v){body=JSON.parse(v);}},async()=>({meta:{type:'series',id:'tt0086817',name:'Transformers',videos:[{season:1,episode:1,name:'One',thumbnail:'https://episodes.metahub.space/tt0086817/1/1/w780.jpg',overview:'First episode',released:'1984-09-17'},{season:1,episode:2,name:'Two',released:'1984-09-18'}]}}));assert.equal(status,200);assert.equal(body.episodes[0].episode,1);assert.equal(body.episodes[0].description,'First episode');assert.match(body.episodes[0].thumbnailUrl,/\/1\/1\//);assert.equal(body.episodes[1].thumbnailUrl,'');
});
