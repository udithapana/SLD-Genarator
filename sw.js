// Minimal offline cache so Chrome treats the site as an installable app.
const CACHE='sld-generator-v2';
const SHELL=['./','./index.html','./css/style.css','./js/inverter-data.js','./js/rules.js','./js/logo.js','./js/renderer.js','./js/dxf.js','./js/app.js','./js/pwa.js','./assets/regen-logo.png','./icons/icon-192.png','./icons/icon-512.png'];
self.addEventListener('install',e=>{e.waitUntil(caches.open(CACHE).then(c=>c.addAll(SHELL)).then(()=>self.skipWaiting()));});
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(k=>Promise.all(k.filter(x=>x!==CACHE).map(x=>caches.delete(x)))).then(()=>self.clients.claim()));});
// network first (always the newest version when online), cache as fallback when offline
self.addEventListener('fetch',e=>{
  if(e.request.method!=='GET'||new URL(e.request.url).origin!==location.origin)return; // never cache / intercept other sites (GitHub API, CDN)
  e.respondWith(fetch(e.request).then(r=>{if(r&&(r.ok||r.type==='opaque')){const cp=r.clone();caches.open(CACHE).then(c=>c.put(e.request,cp));}return r;}).catch(()=>caches.match(e.request).then(m=>m||caches.match('./index.html'))));
});
