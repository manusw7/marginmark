let current,surface;
const id=new URLSearchParams(location.search).get('id');
async function load(){
 current=await LH.rpc({op:'get',id});if(!current)throw Error('Pagina non trovata.');
 document.getElementById('title').textContent=current.document.title;
 const article=document.getElementById('article');article.textContent=current.document.reader||'Nessun testo salvato. Salva di nuovo la pagina originale dal menu dell’estensione.';
 surface?.set(current.document.marks);
}
(async()=>{try{
 await load();surface=new LHSurface(document.getElementById('article'),document.getElementById('overlay'),async anchor=>{
  const settings=await browser.storage.local.get({color:'#fdffb4'});
  const doc=structuredClone(current.document);doc.marks.push({id:crypto.randomUUID(),text:anchor.exact,anchor,notes:'',tags:[],color:settings.color});
  current=await LH.rpc({op:'save',document:doc,revision:current.revision});surface.set(current.document.marks);LH.status('Evidenziazione salvata.');
 });surface.set(current.document.marks);
 document.getElementById('notes').onclick=()=>LH.send({action:'open-library',url:current.document.url}).catch(LH.error);
 browser.runtime.onMessage.addListener(m=>{if(m.action==='changed'&&m.url===current.document.url)load().catch(LH.error);});
}catch(e){LH.error(e);}})();
