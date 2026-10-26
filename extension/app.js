'use strict';
const $=id=>document.getElementById(id), mode=document.body.dataset.mode;
let current=null, draft=null, dirty=false, offset=0, total=0, listSequence=0;
const params=new URLSearchParams(location.search), fixedUrl=params.get('url');
function button(text,fn,cls=''){const b=LH.node('button',text,cls);b.type='button';b.onclick=()=>Promise.resolve().then(fn).catch(LH.error);return b;}
function field(label,value,onchange,type='input'){
 const wrapper=LH.node('label',undefined,'field');wrapper.append(LH.node('span',label));
 const input=LH.node(type);input.value=value??'';if(type==='textarea')input.rows=3;
 input.oninput=()=>{onchange(input.value);dirty=true;};wrapper.append(input);return {wrapper,input};
}
function formatBar(textarea){
 const bar=LH.node('div',undefined,'toolbar');
 for(const [label,open,close] of [['Grassetto','**','**'],['Corsivo','*','*'],['Elenco','\n- ','']])bar.append(button(label,()=>{
  const {selectionStart:a,selectionEnd:b,value}=textarea;
  textarea.setRangeText(open+value.slice(a,b)+close,a,b,'select');textarea.dispatchEvent(new Event('input'));textarea.focus();
 }));return bar;
}
async function list(){
 const seq=++listSequence;
 const result=await LH.rpc({op:'list',query:$('search').value,tag:$('tag-filter').value.trim(),collection:$('collection-filter').value.trim(),starred:$('star-filter').checked,offset,limit:30});
 if(seq!==listSequence)return;
 total=result.total;$('count').textContent=`${total} pagine · archivio locale`;$('pages').replaceChildren();
 for(const item of result.items){
  const b=button('',()=>loadId(item.id),'page-card'+(current?.document.id===item.id?' active':''));
  b.append(LH.node('strong',(item.starred?'★ ':'')+(item.title||item.url)),LH.node('small',`${item.count} evidenziazioni · ${new URL(item.url).hostname||'PDF locale'}`));$('pages').append(b);
 }
 $('previous').disabled=offset===0;$('next').disabled=offset+30>=total;
 if(result.errors.length)LH.error(Error(result.errors.join('\n')));
}
function canLeave(){return !dirty||confirm('Hai modifiche non salvate. Vuoi scartarle e ricaricare?');}
async function loadId(id,force=false){if(!force&&!canLeave())return;const got=await LH.rpc({op:'get',id});if(!got)throw Error('Pagina eliminata o non trovata.');setRecord(got);}
function setRecord(got){current=got;draft=structuredClone(got.document);dirty=false;render();}
async function save(){
 if(!draft)return;
 const saved=await LH.rpc({op:'save',document:draft,revision:current?.revision||null});
 setRecord(saved);LH.status('Salvato nel vault.');if(mode==='library')await list();
}
async function activeUrl(){
 if(fixedUrl)return fixedUrl;
 const [tab]=await browser.tabs.query({active:true,currentWindow:true});
 if(!tab?.url)throw Error('Nessuna pagina attiva.');
 if(tab.url.startsWith(browser.runtime.getURL('viewer.html'))){const u=new URL(tab.url).searchParams.get('url');if(u)return u;}
 return tab.url;
}
async function loadUrl(url,force=false){
 if(!force&&!canLeave())return;
 const got=await LH.rpc({op:'get',url});
 if(got){setRecord(got);return;}
 current=null;dirty=false;draft=null;$('detail').replaceChildren(LH.node('h2','Pagina non ancora salvata'),LH.node('p',url,'muted'),button('Salva questa pagina',async()=>{
  const doc=LH.blank(url);try{const [tab]=await browser.tabs.query({active:true,currentWindow:true});if(tab?.url===url){const captured=await browser.tabs.sendMessage(tab.id,{action:'capture'});doc.title=captured.title;doc.reader=captured.reader;}}catch{}
  const saved=await LH.rpc({op:'save',document:doc,revision:null});setRecord(saved);if(mode==='library')await list();
 },'primary'));
}
function exportHTML(){
 const container=LH.node('article');container.append(LH.node('h1',draft.title));
 const link=LH.node('a',draft.url);link.href=LH.safeUrl(draft.url);container.append(link,LH.node('p',draft.notes));
 for(const m of draft.marks){const block=LH.node('section');block.append(LH.node('blockquote',m.text),LH.node('p',m.notes),LH.node('small',(m.tags||[]).join(', ')));container.append(block);}
 return '<!doctype html><html lang="it"><meta charset="utf-8"><title>Marginmark</title><body>'+container.outerHTML+'</body></html>';
}
async function quiz(){
 const due=draft.marks.filter(m=>m.flashcard?.question&&(!m.flashcard.due||m.flashcard.due<=Date.now()));
 if(!due.length){LH.status('Nessuna carta da ripassare. Aggiungi una domanda sotto un’evidenziazione.');return;}
 const mark=due[0],panel=LH.node('section',undefined,'mark-card');panel.append(LH.node('h2',mark.flashcard.question));
 const answer=LH.node('blockquote',mark.text);answer.hidden=true;panel.append(answer,button('Mostra risposta',()=>answer.hidden=false));
 for(const [label,correct] of [['Da rivedere',false],['Ricordata',true]])panel.append(button(label,async()=>{
  mark.flashcard.interval=correct?Math.min(180,Math.max(1,(mark.flashcard.interval||0)*2)):0;
  mark.flashcard.due=Date.now()+(correct?mark.flashcard.interval*86400000:600000);dirty=true;await save();
 }));$('detail').prepend(panel);
}
function render(){
 const doc=draft,main=$('detail');main.replaceChildren();
 main.append(LH.node('p',`${doc.marks.length} passaggi · ${doc.collections?.join(', ')||'La tua raccolta'}`,'eyebrow'));
 const title=field('Titolo',doc.title,v=>doc.title=v);main.append(title.wrapper);
 const link=LH.node('a',doc.url,'muted');link.href=LH.safeUrl(doc.url);link.target='_blank';link.rel='noopener noreferrer';main.append(link);
 const bar=LH.node('div',undefined,'toolbar');
 bar.append(button('Salva modifiche',save,'primary'),button('Ricarica',()=>current?loadId(doc.id):loadUrl(doc.url)),button(doc.starred?'★ Preferito':'☆ Preferito',()=>{doc.starred=!doc.starred;dirty=true;render();}));
 bar.append(button('Lettura',()=>browser.tabs.create({url:browser.runtime.getURL('reader.html')+'?id='+encodeURIComponent(doc.id)})));
 bar.append(button('Apri PDF',()=>LH.send({action:'open-pdf',url:doc.url})));
 main.append(bar);
 const row=LH.node('div',undefined,'row');row.append(field('Tag della pagina, separati da virgola',(doc.tags||[]).join(', '),v=>doc.tags=LH.tags(v)).wrapper,field('Raccolte, separate da virgola',(doc.collections||[]).join(', '),v=>doc.collections=LH.tags(v)).wrapper);main.append(row);
 const notes=field('Note sulla pagina · Markdown',doc.notes,v=>doc.notes=v,'textarea');main.append(notes.wrapper,formatBar(notes.input));
 const exportDetails=LH.node('details');exportDetails.append(LH.node('summary','Esporta e gestisci'));
 const actions=LH.node('div',undefined,'toolbar');
 actions.append(button('Markdown',()=>{if(dirty)throw Error('Salva prima di esportare il Markdown.');LH.download(current.markdown,'highlights.md','text/markdown');}),button('HTML',()=>LH.download(exportHTML(),'highlights.html','text/html')),button('JSON completo',()=>LH.download(JSON.stringify(doc,null,2),'highlights.json','application/json')),button('Stampa / PDF',()=>{
  const w=window.open('print.html');
  const check=setInterval(()=>{if(!w||w.closed){clearInterval(check);return;}try{if(w.document.readyState==='complete'){clearInterval(check);const content=w.document.getElementById('content');if(content){const parsed=new DOMParser().parseFromString(exportHTML(),'text/html');for(const n of [...parsed.body.childNodes])content.append(w.document.importNode(n,true));w.focus();w.print();}}}catch{clearInterval(check);}},100);
 }),button('Elimina pagina',async()=>{
  if(!current)return;
  await LH.rpc({op:'delete',id:doc.id,revision:current.revision});current=null;draft=null;dirty=false;main.replaceChildren(LH.node('p','Pagina eliminata.'));if(mode==='library')await list();
 },'danger'));exportDetails.append(actions);main.append(exportDetails);
 const tools=LH.node('div',undefined,'toolbar');tools.append(button('Aggiungi nota',()=>{doc.marks.push({id:crypto.randomUUID(),kind:'note',text:'',notes:'',tags:[],color:'#fdffb4',anchor:{}});dirty=true;render();}),button('Ripassa le flashcard',quiz));main.append(tools);
 for(const mark of doc.marks){
  const card=LH.node('section',undefined,'mark-card');card.style.setProperty('--mark',mark.color);
  card.dataset.markId=mark.id;
  card.append(LH.node('blockquote',mark.text||'Nota libera'));
  if(mark.anchor?.page)card.append(LH.node('small','Pagina PDF '+mark.anchor.page));
  if(mark.anchor?.timestamp!==undefined){const url=new URL(doc.url);url.searchParams.set('t',Math.floor(mark.anchor.timestamp)+'s');const a=LH.node('a','Apri al minuto '+Math.floor(mark.anchor.timestamp/60));a.href=LH.safeUrl(url.href);a.target='_blank';a.rel='noopener noreferrer';card.append(a);}
  if(mark.anchor?.imageUrl){const a=LH.node('a','Apri immagine');a.href=LH.safeUrl(mark.anchor.imageUrl);a.target='_blank';a.rel='noopener noreferrer';card.append(a);}
  const note=field('Nota · Markdown',mark.notes,v=>mark.notes=v,'textarea');card.append(note.wrapper,formatBar(note.input));
  const fields=LH.node('div',undefined,'row');fields.append(field('Tag',(mark.tags||[]).join(', '),v=>mark.tags=LH.tags(v)).wrapper);
  const color=LH.node('input');color.type='color';color.value=mark.color;color.setAttribute('aria-label','Colore evidenziazione');color.oninput=()=>{mark.color=color.value;card.style.setProperty('--mark',color.value);dirty=true;};fields.append(color,button('Rimuovi',()=>{doc.marks=doc.marks.filter(m=>m.id!==mark.id);dirty=true;render();},'danger'));card.append(fields);
  const learning=LH.node('details');learning.append(LH.node('summary','Flashcard'));
  learning.append(field('Domanda. Il passaggio evidenziato è la risposta.',mark.flashcard?.question||'',v=>{mark.flashcard={...(mark.flashcard||{}),question:v};}).wrapper);card.append(learning);main.append(card);
 }
 const target=[...main.querySelectorAll('.mark-card')].find(card=>card.dataset.markId===params.get('mark'));
 if(target){target.tabIndex=-1;target.scrollIntoView({block:'center'});target.focus({preventScroll:true});}
 if(doc.reader){const details=LH.node('details');details.append(LH.node('summary','Testo della pagina salvato'),LH.node('pre',doc.reader,'reader'));main.append(details);}
}
let debounce;
for(const id of ['search','tag-filter','collection-filter'])$(id).oninput=()=>{clearTimeout(debounce);offset=0;debounce=setTimeout(()=>list().catch(LH.error),250);};
$('star-filter').onchange=()=>{offset=0;list().catch(LH.error);};
$('previous').onclick=()=>{offset=Math.max(0,offset-30);list().catch(LH.error);};
$('next').onclick=()=>{offset+=30;list().catch(LH.error);};
$('refresh').onclick=()=>list().catch(LH.error);
$('open-library').onclick=()=>LH.send({action:'open-library'}).catch(LH.error);
$('import').onclick=async()=>{
 try{const r=await LH.rpc({op:'import',name:$('import-name').value.trim()});LH.status(`Importazione: ${r.created} pagine create, ${r.skipped} già presenti, ${r.errors.length} errori.`);if(r.errors.length)LH.error(Error(JSON.stringify(r.errors)));await list();}catch(e){LH.error(e);}
};
$('import-file').onchange=async()=>{
 try{const file=$('import-file').files[0];if(!file)return;if(file.size>24*1024*1024)throw Error('Export oltre 24 MB. Usa il nome del file nel vault.');const data=JSON.parse(await file.text());const r=await LH.rpc({op:'import',data});LH.status(`Importazione: ${r.created} create, ${r.skipped} già presenti, ${r.errors.length} errori.`);if(r.errors.length)LH.error(Error(JSON.stringify(r.errors)));await list();}catch(e){LH.error(e);}
};
browser.runtime.onMessage.addListener(message=>{
 if(message.action==='changed'&&draft&&(!message.url||message.url.split('#')[0]===draft.url.split('#')[0]))LH.status('L’archivio è stato aggiornato. Premi Ricarica per vedere le nuove modifiche.');
});
window.addEventListener('beforeunload',e=>{if(dirty){e.preventDefault();e.returnValue='';}});
if(mode==='sidebar'&&!fixedUrl){browser.tabs.onActivated.addListener(()=>{if(!dirty)activeUrl().then(url=>loadUrl(url,true)).catch(LH.error);});browser.tabs.onUpdated.addListener((id,change,tab)=>{if(tab.active&&change.url&&!dirty)loadUrl(change.url,true).catch(LH.error);});}
(async()=>{try{if(mode==='library')await list();if(fixedUrl||mode==='sidebar')await loadUrl(await activeUrl(),true);}catch(e){LH.error(e);}})();
