const localOrigins = new Set(['http://127.0.0.1:4173','http://localhost:4173']);
function isApp(url) {
  try { return localOrigins.has(new URL(url).origin); } catch { return false; }
}
async function enabled() {
  const settings=await chrome.storage.local.get('enabled');
  return settings.enabled !== false;
}
async function badge(on) {
  await chrome.action.setBadgeText({text:on?'ON':'OFF'});
  await chrome.action.setBadgeBackgroundColor({color:on?'#376129':'#555555'});
  await chrome.action.setTitle({title:on?'Cine local: cierre de pestañas activo. Clic para desactivar.':'Cine local: cierre de pestañas desactivado. Clic para activar.'});
}
chrome.tabs.onCreated.addListener(async tab=> {
  if(!Number.isInteger(tab.id) || !Number.isInteger(tab.openerTabId)) return;
  try {
    if(!await enabled()) return;
    // El abridor es una pestaña del navegador, aunque window.open se ejecute en un iframe.
    const opener=await chrome.tabs.get(tab.openerTabId);
    if(!isApp(opener.url)) return;
    await chrome.tabs.remove(tab.id);
  } catch(error) {
    // La pestaña pudo cerrarse antes de recibir el evento.
    console.warn('Cine local: no se pudo comprobar o cerrar la pestaña.',error.message);
  }
});
chrome.action.onClicked.addListener(async()=> {
  const on=!await enabled();
  await chrome.storage.local.set({enabled:on}); await badge(on);
});
chrome.runtime.onInstalled.addListener(async()=>{await badge(await enabled());});
chrome.runtime.onStartup.addListener(async()=>{await badge(await enabled());});
enabled().then(badge).catch(()=>{});
