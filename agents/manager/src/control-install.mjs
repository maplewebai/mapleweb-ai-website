// Static install metadata only. No caching, secrets, or offline fake status.
const manifest={name:'MapleWeb AI Headquarters',short_name:'MapleWeb HQ',id:'/control',start_url:'/control',scope:'/',display:'standalone',background_color:'#071123',theme_color:'#071123',icons:[{src:'/control-icon.svg',sizes:'any',type:'image/svg+xml',purpose:'any maskable'}]};
const icon='<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><rect width="512" height="512" rx="96" fill="#071123"/><path fill="#70e7e7" d="M106 364V148h54l96 121 96-121h54v216h-57V235l-93 113-93-113v129z"/><path fill="#e8f2ff" d="M256 75l-19 36-40-3 29 28-9 40 39-21 39 21-9-40 29-28-40 3z"/></svg>';
const serviceWorker="self.addEventListener('install',()=>self.skipWaiting());self.addEventListener('activate',event=>event.waitUntil(self.clients.claim()));self.addEventListener('fetch',()=>{});";
const assets={'/control.webmanifest':[JSON.stringify(manifest),'application/manifest+json;charset=utf-8'],'/control-icon.svg':[icon,'image/svg+xml'],'/control-sw.js':[serviceWorker,'application/javascript;charset=utf-8']};
export function controlAsset(path,method){
 if(method!=='GET'||!Object.hasOwn(assets,path))return null;
 const [body,type]=assets[path];
 return new Response(body,{headers:{'content-type':type,'cache-control':'no-store','x-content-type-options':'nosniff','x-robots-tag':'noindex, nofollow','referrer-policy':'no-referrer',...(path==='/control-sw.js'?{'service-worker-allowed':'/'}:{})}});
}
