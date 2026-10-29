// Browser fullscreen and honest screen-sharing guidance; no capture of video frames.
export function installWebPlayerControls({document=globalThis.document}={}){
 const screen=document.getElementById('av-screen'),button=document.getElementById('player-fullscreen');
 button.onclick=async()=>{try{if(document.fullscreenElement)await document.exitFullscreen();else if(screen.requestFullscreen)await screen.requestFullscreen();else throw Error('Este navegador no permite pantalla completa. Prueba el control del reproductor o un navegador actualizado.');}catch(error){document.getElementById('audio-status').textContent=error.message||'No se pudo abrir pantalla completa.';}};
 document.getElementById('player-cast').onclick=()=>document.getElementById('screen-share-help').showModal();
 document.getElementById('close-share-help').onclick=()=>document.getElementById('screen-share-help').close();
 document.addEventListener('fullscreenchange',()=>button.setAttribute('aria-pressed',String(Boolean(document.fullscreenElement))));
 screen.addEventListener('pointerup',()=>{void globalThis.AVPlayer?.audioContext?.resume()?.catch(()=>{});});
}
