'use strict';
let nativePort, sequence=0;
const pending=new Map(),pageStyles=new Map();
function native(request) {
 if(!nativePort) {
  nativePort=browser.runtime.connectNative('marginmark');
  nativePort.onMessage.addListener(message=>{
   const job=pending.get(message.id); if(!job) return;
   job.chunks.push(Uint8Array.from(atob(message.chunk),c=>c.charCodeAt(0)));
   if(message.last) {
    pending.delete(message.id);clearTimeout(job.timer);
    try {
     const size=job.chunks.reduce((sum,b)=>sum+b.length,0), bytes=new Uint8Array(size);let off=0;
     for(const b of job.chunks){bytes.set(b,off);off+=b.length;}
     const reply=JSON.parse(new TextDecoder().decode(bytes));
     if(reply.ok) job.resolve(reply.result);else job.reject(new Error(reply.error));
    }catch(e){job.reject(e);}
   }
  });
  nativePort.onDisconnect.addListener(()=>{
   const error=nativePort?.error?.message||'Collegamento locale interrotto. Esegui python3 scripts/install.py.';
   nativePort=null;
   for(const job of pending.values()){clearTimeout(job.timer);job.reject(new Error(error));}pending.clear();
  });
 }
 return new Promise((resolve,reject)=>{
  const requestId=++sequence;
  const timer=setTimeout(()=>{pending.delete(requestId);reject(new Error('Il componente locale non risponde. Riprova.'));},90000);
  pending.set(requestId,{resolve,reject,chunks:[],timer});
  try{nativePort.postMessage({...request,requestId});}catch(e){pending.delete(requestId);clearTimeout(timer);reject(e);}
 });
}
function cleanUrl(url) {const u=new URL(url);if(!['http:','https:','file:'].includes(u.protocol))throw Error('Questa pagina non può essere salvata.');u.hash='';u.username='';u.password='';return u.href;}
function blank(url,title='') {return {id:crypto.randomUUID(),url:cleanUrl(url),title:title||url,marks:[],notes:'',tags:[],collections:[],starred:false,reader:''};}
async function notify(url) {
 const tabs=await browser.tabs.query({});
 await Promise.allSettled(tabs.filter(t=>t.url&&t.url.split('#')[0]===url.split('#')[0]).map(t=>browser.tabs.sendMessage(t.id,{action:'refresh'})));
 browser.runtime.sendMessage({action:'changed',url}).catch(()=>{});
}
let mutations=Promise.resolve();
function serialize(fn){const job=mutations.then(fn);mutations=job.catch(()=>{});return job;}
async function handle(message,sender) {
 const trusted=sender.url?.startsWith(browser.runtime.getURL(''));
 if(message.action==='rpc') {
  if(!trusted)throw Error('Operazione riservata alle pagine dell’estensione.');
  if(!['get','list','save','delete','import','status','read_pdf','pdf_chunk'].includes(message.request?.op))throw Error('Operazione non valida.');
  const removed=message.request.op==='delete'?await native({op:'get',id:message.request.id}):null;
  const result=await native(message.request);
  if(['save','delete','import'].includes(message.request.op))await notify(message.request.document?.url||removed?.document.url||'');
  return result;
 }
 if(message.action==='page:colors'){
  if(!sender.tab||sender.frameId!==0)throw Error('Pagina non autorizzata.');
  cleanUrl(sender.url);
  if(!Array.isArray(message.colors)||message.colors.length>1000||message.colors.some(c=>typeof c!=='string'||!/^#[a-f0-9]{6}$/.test(c)))throw Error('Colori non validi.');
  const code=message.colors.map(color=>{
   const rgb=[1,3,5].map(i=>parseInt(color.slice(i,i+2),16)/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4);
   const luminance=rgb[0]*.2126+rgb[1]*.7152+rgb[2]*.0722;
   const foreground=luminance>.179?'#000000':'#ffffff';
   return `::highlight(lh-${color.slice(1)}){background-color:${color}!important;color:${foreground}!important;text-shadow:none!important}`;
  }).join('\n');
  const previous=pageStyles.get(sender.tab.id);
  if(previous)await browser.tabs.removeCSS(sender.tab.id,{code:previous,cssOrigin:'user'});
  if(code)await browser.tabs.insertCSS(sender.tab.id,{code,cssOrigin:'user'});
  pageStyles.set(sender.tab.id,code);return;
 }
 if(['page:get','page:add','page:bookmark','page:remove','page:update','page:copy'].includes(message.action)) {
  // Content scripts can operate only on their own top-level page.
  if(!sender.tab||sender.frameId!==0)throw Error('Pagina non autorizzata.');
  const url=cleanUrl(sender.url);
  if(message.action==='page:get')return native({op:'get',url});
  return serialize(async()=>{
   const old=await native({op:'get',url});const doc=old?.document||blank(url,String(message.title||sender.tab.title||url).slice(0,4000));
   if(message.action==='page:copy'){
    const mark=doc.marks.find(m=>m.id===message.markId);if(!mark)throw Error('Evidenziazione non trovata.');
    const text=message.format==='markdown'?'> '+mark.text.replace(/\n/g,'\n> ')+'\n\n'+(mark.notes?mark.notes+'\n\n':'')+doc.url:mark.text;
    await navigator.clipboard.writeText(text);return;
   }
   if(message.action==='page:update'){
    if(!old||old.revision!==message.revision)throw Error('Il file è cambiato. Copia la bozza e ricarica la pagina prima di salvare.');
    const mark=doc.marks.find(m=>m.id===message.markId),p=message.patch;
    if(!mark)throw Error('Evidenziazione non trovata.');
    if(!p||typeof p.notes!=='string'||p.notes.length>1000000||typeof p.question!=='string'||p.question.length>4000||!/^#[a-f0-9]{6}$/i.test(p.color)||!Array.isArray(p.tags)||p.tags.length>200||p.tags.some(t=>typeof t!=='string'||t.length>500))throw Error('Nota, tag o colore non validi.');
    mark.notes=p.notes;mark.tags=p.tags;mark.color=p.color;
    if(p.question||mark.flashcard)mark.flashcard={...(mark.flashcard||{}),question:p.question};
   }
   if(message.action==='page:remove'){
    if(!old||old.revision!==message.revision)throw Error('Il file è cambiato. Ricarica la pagina prima di eliminare.');
    const index=doc.marks.findIndex(mark=>mark.id===message.markId);
    if(index<0)throw Error('Evidenziazione non trovata. Ricarica la pagina.');
    doc.marks.splice(index,1);
   }
   if(message.action==='page:add') {
    const anchor=message.anchor;
    if(!anchor||typeof anchor.exact!=='string'||!anchor.exact.trim()||anchor.exact.length>100000)throw Error('Selezione non valida.');
    const settings=await browser.storage.local.get({color:'#fdffb4'});
    if(!doc.marks.some(m=>m.anchor?.exact===anchor.exact&&m.anchor?.start===anchor.start&&m.anchor?.end===anchor.end))doc.marks.push({id:crypto.randomUUID(),text:anchor.exact,notes:'',tags:[],color:settings.color,anchor,createdAt:Date.now()});
   }
   if(typeof message.reader==='string'&&message.reader.length<2000000)doc.reader=message.reader;
   const saved=await native({op:'save',document:doc,revision:old?.revision||null});await notify(url);return saved;
  });
 }
 if(message.action==='open-library') {
  const url=trusted?message.url:sender.url;
  const params=new URLSearchParams();if(url)params.set('url',url);
  if(typeof message.markId==='string'&&/^[A-Za-z0-9_-]{1,128}$/.test(message.markId))params.set('mark',message.markId);
  return browser.tabs.create({url:browser.runtime.getURL('library.html')+(params.size?'?'+params.toString():'')});
 }
 if(message.action==='open-pdf'&&trusted) return browser.tabs.create({url:browser.runtime.getURL('viewer.html')+(message.url?'?url='+encodeURIComponent(cleanUrl(message.url)):'')});
 if(message.action==='changed')return;
 throw Error('Messaggio sconosciuto.');
}
browser.runtime.onMessage.addListener((message,sender)=>handle(message,sender).then(result=>({ok:true,result}),e=>({ok:false,error:e.message})));
browser.contextMenus.create({id:'highlight',title:'Evidenzia con Marginmark',contexts:['selection']});
browser.contextMenus.create({id:'bookmark',title:'Salva in Marginmark',contexts:['page']});
browser.contextMenus.create({id:'image',title:'Salva immagine in Marginmark',contexts:['image']});
browser.contextMenus.create({id:'pdf',title:'Apri con il lettore PDF locale',contexts:['page','link']});
browser.contextMenus.onClicked.addListener(async(info,tab)=>{
 try {
  if(info.menuItemId==='pdf'){await browser.tabs.create({url:browser.runtime.getURL('viewer.html')+'?url='+encodeURIComponent(info.linkUrl||tab.url)});return;}
  const response=await browser.tabs.sendMessage(tab.id,{action:info.menuItemId==='highlight'?'highlight':info.menuItemId==='image'?'image':'bookmark',imageUrl:info.srcUrl});
  if(response?.error)throw Error(response.error);
 }catch(e){await browser.tabs.create({url:browser.runtime.getURL('popup.html')+'?error='+encodeURIComponent(e.message)});}
});
browser.commands.onCommand.addListener(async command=>{
 if(command==='highlight') {
  const [tab]=await browser.tabs.query({active:true,currentWindow:true});
  try{await browser.tabs.sendMessage(tab.id,{action:'highlight'});}catch{await browser.tabs.create({url:browser.runtime.getURL('viewer.html')+'?url='+encodeURIComponent(tab.url)});}
 }
});

browser.tabs.onRemoved.addListener(id=>pageStyles.delete(id));
