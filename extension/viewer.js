import * as pdfjs from './vendor/pdf.mjs';
pdfjs.GlobalWorkerOptions.workerSrc=browser.runtime.getURL('vendor/pdf.worker.mjs');
const $=id=>document.getElementById(id);
let pdf,bytes,sourceUrl,current,page=1,rendering=false,textLayer,surface;
function b64(bytes){let str='';for(let i=0;i<bytes.length;i+=8192)str+=String.fromCharCode(...bytes.subarray(i,i+8192));return btoa(str);}
async function refreshRecord(){
 current=await LH.rpc({op:'get',url:sourceUrl});
 if(!current){surface?.set([]);return;}
 if(surface){surface.set(current.document.marks.filter(m=>!m.anchor?.page||m.anchor.page===page));const count=current.document.marks.filter(m=>!m.anchor?.page||m.anchor.page===page).filter(m=>m.kind!=='note').length;LH.status(`Pagina ${page}. ${surface.matches.length}/${count} passaggi ritrovati in questa pagina.`);}
}
async function render(){
 if(!pdf||rendering)return;
 rendering=true;
 try{
  page=Math.max(1,Math.min(pdf.numPages,Number($('page-number').value)||1));$('page-number').value=page;
  const p=await pdf.getPage(page), scale=Number($('zoom').value), viewport=p.getViewport({scale});
  const box=$('pdf-page');box.style.width=viewport.width+'px';box.style.height=viewport.height+'px';box.style.setProperty('--scale-factor',String(scale));box.style.setProperty('--total-scale-factor',String(scale));
  const canvas=$('canvas'),ratio=devicePixelRatio||1;canvas.width=Math.floor(viewport.width*ratio);canvas.height=Math.floor(viewport.height*ratio);canvas.style.width=viewport.width+'px';canvas.style.height=viewport.height+'px';
  await p.render({canvasContext:canvas.getContext('2d'),viewport,transform:ratio!==1?[ratio,0,0,ratio,0,0]:null}).promise;
  textLayer?.cancel();$('text-layer').replaceChildren();textLayer=new pdfjs.TextLayer({textContentSource:await p.getTextContent(),container:$('text-layer'),viewport});await textLayer.render();
  $('highlight-selection').hidden=true;await refreshRecord();$('prev').disabled=page<=1;$('next').disabled=page>=pdf.numPages;
 }finally{rendering=false;}
}
async function open(data,url){
 if(pdf)await pdf.destroy();bytes=data.slice();sourceUrl=url;$('url').value=url;
 const task=pdfjs.getDocument({data:data.slice(),cMapUrl:browser.runtime.getURL('vendor/cmaps/'),cMapPacked:true,standardFontDataUrl:browser.runtime.getURL('vendor/standard_fonts/'),wasmUrl:browser.runtime.getURL('vendor/wasm/'),isEvalSupported:false});
 task.onPassword=(update,reason)=>{const password=prompt(reason===1?'Password del PDF:':'Password errata. Riprova:');if(password===null){task.destroy();return;}update(password);};
 pdf=await task.promise;page=1;$('page-number').value=1;$('page-count').textContent='/ '+pdf.numPages;$('page-number').max=pdf.numPages;
 const old=await LH.rpc({op:'get',url});
 if(!old){const doc=LH.blank(url,decodeURIComponent(new URL(url).pathname.split('/').pop()||'PDF'));current=await LH.rpc({op:'save',document:doc,revision:null});}else current=old;
 $('notes').src=browser.runtime.getURL('sidebar.html')+'?url='+encodeURIComponent(url);
 history.replaceState(null,'','?url='+encodeURIComponent(url));await render();
}
async function openUrl(url){
 const parsed=new URL(url);let data;
 if(parsed.protocol==='file:'){const reply=await LH.rpc({op:'read_pdf',url});data=Uint8Array.from(atob(reply.base64),c=>c.charCodeAt(0));}
 else if(['https:','http:'].includes(parsed.protocol)){
  const response=await fetch(url,{credentials:'include'});if(!response.ok)throw Error('Download PDF: HTTP '+response.status);
  const reader=response.body.getReader(),chunks=[];let length=0;
  while(true){const {done,value}=await reader.read();if(done)break;length+=value.length;if(length>64*1024*1024){await reader.cancel();throw Error('PDF oltre 64 MB.');}chunks.push(value);}
  data=new Uint8Array(length);let pos=0;for(const c of chunks){data.set(c,pos);pos+=c.length;}
 }else throw Error('Usa un URL http, https o file.');
 await open(data,url);
}
async function chooseFile(){
 const file=$('file').files[0];if(!file)return;if(file.size>64*1024*1024)throw Error('PDF oltre 64 MB.');
 const data=new Uint8Array(await file.arrayBuffer());
 const id=[...new Uint8Array(await crypto.subtle.digest('SHA-256',data))].map(n=>n.toString(16).padStart(2,'0')).join('');
 let result;
 for(let offset=0;offset<data.length;offset+=384000){
  result=await LH.rpc({op:'pdf_chunk',id,offset,data:b64(data.subarray(offset,offset+384000)),last:offset+384000>=data.length});
  if(result.done)break;
 }
 if(!result?.url)throw Error('PDF vuoto o incompleto.');
 await open(data,result.url);
 if(current.document.title===id+'.pdf'){current.document.title=file.name;current=await LH.rpc({op:'save',document:current.document,revision:current.revision});}
}
async function exportPDF(){
 if(!pdf||!bytes)throw Error('Apri prima un PDF.');
 const doc=await PDFLib.PDFDocument.load(bytes.slice()),saved=await LH.rpc({op:'get',url:sourceUrl});
 let count=0,unresolved=0;
 // Resolve every page so imported quotes without PDF coordinates can also be exported.
 const byPage=new Map();
 for(let n=1;n<=pdf.numPages;n++){
  const p=await pdf.getPage(n),content=await p.getTextContent(),text=content.items.map(i=>i.str).join('');
  byPage.set(n,{p,content,text});
 }
 for(const mark of saved.document.marks){
  if(mark.kind==='note'||mark.kind==='image')continue;
  let pageNo=mark.anchor?.page,rects=mark.anchor?.rects;
  if(!pageNo||!rects?.length){
   const hits=[...byPage].filter(([n,v])=>(!pageNo||n===pageNo)&&LHAnchors.findQuote(v.text,{exact:mark.anchor?.exact||mark.text}));
   if(hits.length!==1){unresolved++;continue;}
   const [n,v]=hits[0], hit=LHAnchors.findQuote(v.text,{exact:mark.anchor?.exact||mark.text});pageNo=n;
   const viewport=v.p.getViewport({scale:1});rects=[];let pos=0;
   for(const item of v.content.items){const start=pos,end=pos+item.str.length;pos=end;if(end<=hit.start||start>=hit.end)continue;
    const t=pdfjs.Util.transform(viewport.transform,item.transform),height=Math.hypot(t[2],t[3]);
    // shortcut: imported PDF quotes use whole text runs; new marks keep exact selection rectangles.
    rects.push({x:t[4]/viewport.width,y:(t[5]-height)/viewport.height,width:item.width/viewport.width,height:height/viewport.height});
   }
  }
  const target=doc.getPage(pageNo-1),{width,height}=target.getSize(),hex=mark.color||'#fdffb4';
  // Normalized viewport rectangles need the PDF.js inverse transform for rotated pages.
  const viewport=byPage.get(pageNo).p.getViewport({scale:1});
  for(const r of rects){
   const [x1,y1]=viewport.convertToPdfPoint(r.x*viewport.width,r.y*viewport.height);
   const [x2,y2]=viewport.convertToPdfPoint((r.x+r.width)*viewport.width,(r.y+r.height)*viewport.height);
   target.drawRectangle({x:Math.min(x1,x2),y:Math.min(y1,y2),width:Math.abs(x2-x1),height:Math.abs(y2-y1),color:PDFLib.rgb(parseInt(hex.slice(1,3),16)/255,parseInt(hex.slice(3,5),16)/255,parseInt(hex.slice(5,7),16)/255),opacity:0.32});
  }
  count++;
 }
 LH.download(await doc.save(),'highlights.pdf','application/pdf');LH.status(`PDF esportato: ${count} evidenziazioni visive, ${unresolved} non localizzate. Note e tag restano nel vault.`);
}
surface=new LHSurface($('text-layer'),$('overlay'),async anchor=>{
 const fresh=await LH.rpc({op:'get',url:sourceUrl});
 if(current&&fresh?.revision!==current.revision)throw Error('L’archivio è cambiato. Ricarica le note prima di evidenziare.');
 const doc=fresh?structuredClone(fresh.document):LH.blank(sourceUrl),settings=await browser.storage.local.get({color:'#fdffb4'});
 doc.marks.push({id:crypto.randomUUID(),text:anchor.exact,anchor,notes:'',tags:[],color:settings.color});
 current=await LH.rpc({op:'save',document:doc,revision:fresh?.revision||null});await refreshRecord();
},()=>({page}));
function bind(id,fn,event='onclick'){$(id)[event]=()=>Promise.resolve().then(fn).catch(LH.error);}
bind('file',chooseFile,'onchange');bind('open-url',()=>openUrl($('url').value.trim()));bind('page-number',render,'onchange');bind('zoom',render,'onchange');
bind('prev',()=>{$('page-number').value=Math.max(1,page-1);return render();});bind('next',()=>{$('page-number').value=Math.min(pdf?.numPages||1,page+1);return render();});bind('export-pdf',exportPDF);
bind('find-next',async()=>{
 if(!pdf)return;const query=$('find').value.trim();if(!query)return;
 for(let step=1;step<=pdf.numPages;step++){const n=(page-1+step)%pdf.numPages+1,content=await(await pdf.getPage(n)).getTextContent();if(content.items.map(i=>i.str).join(' ').toLocaleLowerCase().includes(query.toLocaleLowerCase())){$('page-number').value=n;await render();LH.status('Testo trovato a pagina '+n);return;}}
 LH.status('Testo non trovato.');
});
browser.runtime.onMessage.addListener(m=>{if(m.action==='changed'&&(!m.url||m.url===sourceUrl))refreshRecord().catch(LH.error);});
const initial=new URLSearchParams(location.search).get('url');if(initial)openUrl(initial).catch(LH.error);else LH.status('Scegli un PDF locale o inserisci il suo URL. I PDF scelti vengono copiati nel vault.');
