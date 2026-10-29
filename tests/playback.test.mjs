import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';

const configSource=await readFile(new URL('../public/source-config.js',import.meta.url),'utf8');
const source=await readFile(new URL('../public/playback.js',import.meta.url),'utf8');
function playback() {
  const toggle={checked:true,addEventListener(_,fn){this.change=fn;}}, status={}, events=[],quality={value:'auto',options:['auto','720','1080','2160'].map(value=>({value})),addEventListener(_,fn){this.change=fn;}},qualityHint={},notice={};
  const document={getElementById(id){return id==='block-popups'?toggle:id==='quality'?quality:id==='quality-hint'?qualityHint:id==='playback-protection'?notice:status;},createElement(tag){return {tag,attributes:{},setAttribute(k,v){this.attributes[k]=v;}};},dispatchEvent(e){events.push(e.type);}};
  const context={window:{},document,URL,Event};vm.createContext(context);vm.runInContext(configSource,context);vm.runInContext(source,context);
  return {api:context.window.CinePlayback,toggle,status,events,quality,qualityHint,notice};
}
test('cada fuente conserva identificador y episodio en su interfaz documentada',()=> {
  const {api}=playback();
  const fixtures=[
    ['facilito','12609','https://facilitoplay.com/e/serie/12609/1/2'],
    ['sh','tt0088509','https://vidsrc.sh/embed/tv/tt0088509/1/2?ds_lang=es'],
    ['to','tt0088509','https://vidsrc.to/embed/tv/tt0088509/1/2'],
    ['vidlink','12609','https://vidlink.pro/tv/12609/1/2?autoplay=false'],
    ['vidfast','tt0088509','https://vidfast.vc/tv/tt0088509/1/2?sub=es&autoPlay=false']
  ];
  for(const [provider,id,expected] of fixtures) assert.equal(api.url(provider,id,1,2).href,expected);
  assert.equal(api.url('vidlink','550').href,'https://vidlink.pro/movie/550?autoplay=false');
  assert.equal(api.url('vidfast','tt0137523',undefined,undefined,'en').href,'https://vidfast.vc/movie/tt0137523?sub=en&autoPlay=false');
});
test('rechaza destinos arbitrarios, ID incompatible y episodios inválidos',()=> {
  const {api}=playback();
  for(const args of [['unknown','550'],['__proto__','550'],['vidlink','tt0137523'],['sh','https://example.com'],['sh','550',-1,1],['sh','550',1,0]]) assert.throws(()=>api.url(...args));
  assert.throws(()=>api.frame('sh',new URL('https://example.com'),'Wrong'));
  assert.throws(()=>api.frame('__proto__',new URL('https://example.com'),'Wrong'));
});
test('sandbox se aplica por proveedor; las excepciones se identifican explícitamente',()=> {
  const {api,toggle,status,events}=playback();
  for(const provider of Object.keys(api.providers)) {
    if(!api.compatible(provider)){assert.throws(()=>api.frame(provider,api.url(provider,'550'),'Test'),/retiró de la web/);continue;}
    if(['facilito','sh','to'].includes(provider)) {assert.equal(api.frame(provider,api.url(provider,'550'),'Test').attributes.sandbox,undefined);assert.equal(api.sandboxed(provider),false);continue;}
    const frame=api.frame(provider,api.url(provider,'550'),'Test');
    const tokens=frame.attributes.sandbox.split(' ');
    assert.ok(tokens.includes('allow-scripts'));assert.ok(tokens.includes('allow-same-origin'));
    assert.ok(!tokens.some(t=>t.includes('popups')||t.includes('top-navigation')));
    assert.equal(frame.allowFullscreen,true);
  }
  assert.match(status.textContent,/Protección por proveedor/);
  toggle.checked=false; toggle.change();
  assert.equal(api.frame('sh',api.url('sh','550'),'Test').attributes.sandbox,undefined);
  assert.match(status.textContent,/Modo compatible/);assert.deepEqual(events,['player-policy-change']);
});

test('calidad manual se solicita solo a CineSrc y no inventa control de 4K',()=> {
  const {api,quality,qualityHint}=playback();
  api.configureQuality('cinesrc');assert.equal(quality.disabled,false);assert.equal(quality.options.find(o=>o.value==='720').disabled,false);assert.equal(quality.options.find(o=>o.value==='2160').disabled,true);
  quality.value='720';assert.equal(api.qualityValue(),'720');
  const url=api.url('cinesrc','1396',2,3,'es',api.qualityValue());assert.equal(url.pathname,'/embed/tv/1396');assert.equal(url.searchParams.get('s'),'2');assert.equal(url.searchParams.get('e'),'3');assert.equal(url.searchParams.get('quality'),'720');
  assert.equal(api.url('cinesrc','550',undefined,undefined,'es','auto').searchParams.has('quality'),false);
  assert.equal(api.url('cinesrc','550',undefined,undefined,'es','2160').searchParams.has('quality'),false);
  api.configureQuality('vidfast');assert.equal(quality.value,'auto');assert.equal(quality.disabled,true);assert.match(qualityHint.textContent,/adaptativa/);
});
test('reproductor anime usa MAL y número absoluto con SUB, sin fallback a doblaje',()=> {
  const {api}=playback();assert.equal(api.animeUrl(223,153).href,'https://vidlink.pro/anime/223/153/sub?autoplay=false');
  assert.throws(()=>api.animeUrl('tt0280249',1));assert.throws(()=>api.animeUrl(223,0));
});

test('web: la preferencia latina mantiene FacilitoPlay y CineSrc conserva sandbox',()=>{
 const {api,toggle}=playback();assert.equal(api.preferredProvider('facilito'),'facilito');assert.equal(api.compatible('facilito'),true);
 assert.equal(api.frame('facilito',api.url('facilito','550'),'Test').attributes.sandbox,undefined);
 assert.ok(api.frame('cinesrc',api.url('cinesrc','550'),'Test').attributes.sandbox);assert.equal(toggle.checked,true);
 toggle.checked=false;assert.equal(api.sandboxed('cinesrc'),false);assert.equal(api.preferredProvider('facilito'),'facilito');
});

test('Vidking: contrato documentado, TMDB, autoPlay correcto y sin saltos automáticos de capítulo',()=>{
 const {api}=playback();const movie=api.url('vidking','27205');assert.equal(movie.origin,'https://www.vidking.net');assert.equal(movie.pathname,'/embed/movie/27205');assert.equal(movie.searchParams.get('autoPlay'),'false');assert.equal(movie.searchParams.has('autoplay'),false);
 const episode=api.url('vidking','1396',2,8);assert.equal(episode.pathname,'/embed/tv/1396/2/8');assert.equal(episode.searchParams.get('nextEpisode'),'false');assert.equal(episode.searchParams.get('episodeSelector'),'false');assert.throws(()=>api.url('vidking','tt0903747',2,8));assert.equal(api.providers.vidking.experimental,true);assert.equal(api.providers.vidking.webOnly,true);
});
test('solo los cuatro proveedores reportados funcionales pueden abrir frames web',()=>{
 const {api}=playback();assert.deepEqual(Object.keys(api.providers).filter(api.compatible),['facilito','sh','to','cinesrc']);
 for(const id of ['vidlink','vidfast','vidking','vixsrc']){assert.equal(api.compatible(id),false);assert.throws(()=>api.frame(id,api.url(id,'550'),'Prueba'),/retiró de la web/);}
 assert.ok(api.frame('cinesrc',api.url('cinesrc','550'),'Prueba').attributes.sandbox);
});
test('VixSrc: preferencia de audio va separada de subtítulos y no inventa variante latino',()=>{
 const {api}=playback();const subsOnly=api.url('vixsrc','27205',undefined,undefined,'es','auto');assert.equal(subsOnly.searchParams.has('lang'),false);
 const latino=api.url('vixsrc','27205',undefined,undefined,'en','auto','latino');assert.equal(latino.origin,'https://vixsrc.to');assert.equal(latino.pathname,'/movie/27205');assert.equal(latino.searchParams.get('lang'),'es');assert.equal(api.providers.vixsrc.referrerPolicy,'origin');assert.equal(latino.searchParams.get('autoplay'),'false');
 const castellano=api.url('vixsrc','1396',2,8,'es','auto','castellano');assert.equal(castellano.pathname,'/tv/1396/2/8');assert.equal(castellano.searchParams.get('lang'),'es');assert.equal(api.url('vixsrc','27205',undefined,undefined,'es','auto','original').searchParams.has('lang'),false);
});
