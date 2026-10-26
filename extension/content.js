/* Runs only on ordinary top-level pages, isolated from page JavaScript. */
(function(){
 if(window.top!==window)return;
 let root,shadow,layer,tool,annotation,status,savedRange,record,ranges=[],refreshTimer,layoutTimer,lastUrl=location.href,enabled=true,colorSignature='',pointerStart,editor;
 const painted=new Set(),A=globalThis.LHAnchors;
 async function call(message){const r=await browser.runtime.sendMessage(message);if(!r.ok)throw Error(r.error);return r.result;}
 function ui(){
  if(root)return;
  root=document.createElement('div');root.dataset.lhRoot='true';root.style.cssText='all:initial;position:absolute;top:0;left:0;width:0;height:0;z-index:2147483646';
  shadow=root.attachShadow({mode:'closed'});
  const style=document.createElement('style');style.textContent=`:host{all:initial;color-scheme:light} .rect{position:absolute;pointer-events:none;border-radius:2px} .tool,.annotation,.status{box-sizing:border-box;position:fixed;background:#203b34;color:#fffaf0;font:14px/1.5 system-ui;padding:10px 12px;border:1px solid #62776e;border-radius:10px;box-shadow:0 4px 20px #0005;z-index:2147483647;max-width:calc(100vw - 16px);opacity:1;mix-blend-mode:normal} .tool{display:flex;gap:8px;align-items:center}.annotation{width:320px;max-height:calc(100vh - 24px);overflow:auto}.annotation p{margin:0 0 12px;white-space:pre-wrap;overflow-wrap:anywhere}.annotation .actions{display:flex;gap:8px;flex-wrap:wrap}.delete-mark{background:#fff1ed;color:#7b241b;border-color:#f8b6a8}.status{bottom:20px;right:20px;white-space:pre-wrap;max-width:min(380px,calc(100vw - 40px))}button{font:inherit;cursor:pointer;border:1px solid #cbd5cd;border-radius:6px;padding:6px 10px;background:#f6f1e6;color:#203b34;opacity:1}button:focus-visible{outline:3px solid #77c3ff;outline-offset:2px}.swatch{width:30px;height:30px;padding:0;border:2px solid #fff;flex-shrink:0} .annotation{width:480px;padding:0;border:0;background:transparent;color:#303832;box-shadow:none;overflow:visible}.annotation .actions{position:fixed;display:flex;flex-wrap:nowrap;gap:2px;padding:4px;border:1px solid #d8ddd5;border-radius:7px;background:#fffefa;box-shadow:0 3px 14px #0003;max-width:calc(100vw - 16px)}.annotation .icon-button{display:grid;place-items:center;width:32px;height:32px;padding:5px;border:0;background:transparent;color:#374039}.annotation .icon-button:hover{background:#edf0e9}.annotation .icon-button svg{width:22px;height:22px;fill:none;stroke:currentColor;stroke-width:1.7;stroke-linecap:round;stroke-linejoin:round}.annotation .delete-mark{color:#8b3931}.color-chip{width:21px;height:23px;border:1px solid #bdc5b8;border-radius:5px}.editor-card{box-sizing:border-box;background:#fffefa;border:1px solid #d8ddd5;border-radius:8px;padding:9px;box-shadow:0 4px 20px #0003;max-height:calc(100vh - 80px);overflow:auto}.tag-row{display:flex;gap:8px;align-items:center;padding:0 6px 7px;color:#7d857c}.note-tags,.card-question{box-sizing:border-box;min-width:0;width:100%;font:14px/1.5 system-ui;border:0;background:transparent;color:#303832;outline-offset:2px;padding:3px}.note-box{border:1px solid #d8dcd4;border-radius:6px;background:#f7f7f3;overflow:hidden}.note-editor{box-sizing:border-box;display:block;width:100%;min-height:75px;max-height:35vh;resize:vertical;font:15px/1.5 system-ui;padding:10px 11px;border:0;outline-offset:-3px;background:transparent;color:#303832}.note-editor::placeholder,.note-tags::placeholder{color:#899087}.format-bar{display:flex;gap:2px;flex-wrap:wrap;padding:4px 6px;border-top:1px solid #e6e8e1}.format-bar button{min-width:28px;padding:2px 5px;background:transparent;border:0;color:#7b837a;font-size:13px}.format-bar button:hover{background:#e8ece3;color:#203b34}.format-bold{font-weight:750}.format-italic{font-style:italic}.editor-footer{display:flex;align-items:center;gap:8px;padding:7px 3px 0;font:11px/1.4 system-ui;color:#7c847b}.save-state{flex:1}.save-state.error{color:#9b302a}.annotation .save-note{padding:2px 7px;font-size:12px;background:transparent;border:0;color:#42694b}.color-options{display:flex;align-items:center;gap:8px;padding:5px 4px 10px}.color-options .swatch{border-color:#b6beb1;border-radius:5px}.custom-color{width:30px;height:30px;padding:0;border:0;background:transparent}.card-question{border-top:1px solid #e0e5dc;margin:5px 0;padding:6px}.annotation button:disabled{opacity:.5;cursor:wait} [hidden]{display:none!important}`;
  layer=document.createElement('div');tool=document.createElement('div');tool.className='tool';tool.hidden=true;tool.setAttribute('role','toolbar');tool.setAttribute('aria-label','Evidenzia selezione');
  for(const [color,name] of [['#fdffb4','Giallo'],['#c3effc','Azzurro'],['#f8b6a8','Corallo'],['#a7e8c8','Verde']]){const b=document.createElement('button');b.className='swatch';b.style.background=color;b.title=name;b.setAttribute('aria-label','Evidenzia in '+name.toLowerCase());b.onpointerdown=e=>e.preventDefault();b.onclick=()=>add(color);tool.append(b);}
  const close=document.createElement('button');close.textContent='×';close.title='Chiudi palette';close.setAttribute('aria-label',close.title);close.onclick=()=>tool.hidden=true;tool.append(close);
  annotation=document.createElement('div');annotation.className='annotation';annotation.hidden=true;annotation.setAttribute('role','dialog');annotation.setAttribute('aria-label','Evidenziazione salvata');
  status=document.createElement('div');status.className='status';status.hidden=true;status.setAttribute('role','status');shadow.append(style,layer,tool,annotation,status);document.documentElement.append(root);
 }
 function place(element,rect){
  element.hidden=false;
  const box=element.getBoundingClientRect();
  element.style.left=Math.max(8,Math.min(innerWidth-box.width-8,rect.left))+'px';
  const top=rect.bottom+8+box.height<=innerHeight-8?rect.bottom+8:rect.top-box.height-8;
  element.style.top=Math.max(8,Math.min(innerHeight-box.height-8,top))+'px';
 }
 let messageTimer;
 function tell(message,error=false){ui();status.textContent=message;status.hidden=false;status.style.background=error?'#8a302a':'#203b34';clearTimeout(messageTimer);messageTimer=setTimeout(()=>status.hidden=true,error?12000:3500);}
 function clearPaint(){for(const name of painted)CSS.highlights?.delete(name);painted.clear();layer?.replaceChildren();}
 async function draw(){
  if(!layer)return;
  clearPaint();
  const groups=new Map();
  for(const {range,mark} of ranges){
   if(!range.startContainer.isConnected)continue;
   const color=/^#[a-f0-9]{6}$/i.test(mark.color)?mark.color.toLowerCase():'#fdffb4';
   if(!groups.has(color))groups.set(color,[]);groups.get(color).push(range);
  }
  if(CSS.highlights&&typeof Highlight==='function'){
   const colors=[...groups.keys()].sort(),signature=colors.join(',');
   if(signature!==colorSignature){await call({action:'page:colors',colors});colorSignature=signature;}
   for(const [color,items] of groups){const name='lh-'+color.slice(1);CSS.highlights.set(name,new Highlight(...items));painted.add(name);}
  }else{
   // shortcut: older Firefox uses translucent overlays; upgrade for native CSS Custom Highlight.
   for(const [color,items] of groups)for(const range of items)for(const rect of range.getClientRects()){
    if(!rect.width||!rect.height)continue;
    const div=document.createElement('div');div.className='rect';div.style.cssText=`left:${rect.left+scrollX}px;top:${rect.top+scrollY}px;width:${rect.width}px;height:${rect.height}px;background:${color};opacity:.3`;layer.append(div);
   }
  }
 }
 async function refresh(){
  if(!enabled)return;
  try{
   const next=await call({action:'page:get'});
   record=next;ui();ranges=[];
   if(next){const idx=A.index(document.body);for(const mark of next.document.marks){if(mark.kind==='note'||mark.kind==='image')continue;const range=A.restore(document.body,mark.anchor||{exact:mark.text},idx);if(range)ranges.push({range,mark});}}
   await draw();
  }catch(e){if(record)tell(e.message,true);}
 }
 async function settings(){const s=await browser.storage.local.get({popup:true,disabledSites:[]});enabled=!s.disabledSites.includes(location.hostname);return s;}
 async function selection(){
  const s=await settings();if(!enabled||!s.popup){if(tool)tool.hidden=true;return;}
  const sel=getSelection();if(!sel?.rangeCount||sel.isCollapsed||sel.anchorNode?.parentElement?.closest('[contenteditable="true"],input,textarea')){if(tool)tool.hidden=true;return;}
  const range=sel.getRangeAt(0);if(!range.toString().trim())return;
  savedRange=range.cloneRange();ui();if(!await closeAnnotation())return;place(tool,range.getBoundingClientRect());
 }
 async function add(color){
  try{
   const selection=getSelection();const range=savedRange||(selection?.rangeCount?selection.getRangeAt(0).cloneRange():null);
   const anchor=A.capture(document.body,range);if(!anchor)throw Error('Seleziona un passaggio di testo della pagina.');
   const video=document.querySelector('video');if(location.hostname.endsWith('youtube.com')&&video)anchor.timestamp=video.currentTime;
   if(color)await browser.storage.local.set({color});
   await call({action:'page:add',anchor,title:document.title});savedRange=null;if(tool)tool.hidden=true;selection?.removeAllRanges();await refresh();tell('Evidenziazione salvata nel vault.');
  }catch(e){tell(e.message,true);}
 }
 async function closeAnnotation(){
  try{await editor?.flush();if(annotation)annotation.hidden=true;return true;}
  catch{return false;}
 }
 async function showAnnotation(hit,rect){
  if(!await closeAnnotation())return;
  ui();tool.hidden=true;annotation.replaceChildren();
  let revision=record?.revision,version=0,persisted=0,pending,timer;
  const actions=document.createElement('div');actions.className='actions';actions.setAttribute('role','toolbar');actions.setAttribute('aria-label','Azioni evidenziazione');
  const card=document.createElement('div');card.className='editor-card';
  const colors=document.createElement('div');colors.className='color-options';colors.hidden=true;
  const tags=document.createElement('input');tags.className='note-tags';tags.placeholder='Tags';tags.setAttribute('aria-label','Tag separati da virgola');tags.value=(hit.mark.tags||[]).join(', ');
  const tagRow=document.createElement('label');tagRow.className='tag-row';const tagIcon=document.createElement('span');tagIcon.textContent='♢';tagIcon.setAttribute('aria-hidden','true');tagRow.append(tagIcon,tags);
  const note=document.createElement('textarea');note.className='note-editor';note.placeholder='Scrivi una nota…';note.setAttribute('aria-label','Nota dell’evidenziazione');note.value=hit.mark.notes||'';
  const question=document.createElement('input');question.className='card-question';question.placeholder='Domanda della flashcard';question.setAttribute('aria-label','Domanda della flashcard');question.value=hit.mark.flashcard?.question||'';question.hidden=!question.value;
  const box=document.createElement('div');box.className='note-box';box.append(note);
  const footer=document.createElement('div');footer.className='editor-footer';
  const feedback=document.createElement('span');feedback.className='save-state';feedback.setAttribute('role','status');feedback.textContent='Salvato';
  const markdown=document.createElement('span');markdown.textContent='Markdown';
  const save=document.createElement('button');save.className='save-note';save.textContent='Salva';footer.append(feedback,markdown,save);
  let color=hit.mark.color;
  function snapshot(){return {notes:note.value,tags:[...new Set(tags.value.split(',').map(t=>t.trim()).filter(Boolean))],color,question:question.value};}
  async function flush(){
   clearTimeout(timer);
   if(pending){await pending;if(version>persisted)return flush();return;}
   if(version===persisted)return;
   const changed=version,patch=snapshot();feedback.textContent='Salvataggio…';feedback.className='save-state';
   pending=(async()=>{const saved=await call({action:'page:update',markId:hit.mark.id,revision,patch});revision=saved.revision;persisted=changed;Object.assign(hit.mark,{notes:patch.notes,tags:patch.tags,color:patch.color});feedback.textContent=version===persisted?'Salvato':'Modifiche da salvare';await refresh();})();
   try{await pending;}
   catch(e){feedback.textContent=e.message+' La bozza resta qui.';feedback.className='save-state error';throw e;}
   finally{pending=null;}
   if(version>persisted)return flush();
  }
  function changed(){version++;feedback.textContent='Modifiche da salvare';feedback.className='save-state';clearTimeout(timer);timer=setTimeout(()=>flush().catch(()=>{}),600);}
  editor={flush,dirty:()=>version>persisted||!!pending};
  for(const field of [note,tags,question]){field.oninput=changed;field.onkeydown=e=>{e.stopPropagation();if((e.ctrlKey||e.metaKey)&&e.key==='s'){e.preventDefault();flush().catch(()=>{});}};}
  save.onclick=()=>flush().catch(()=>{});
  function action(cls,label,path,fn){
   const button=document.createElement('button');button.className='icon-button '+cls;button.title=label;button.setAttribute('aria-label',label);
   const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');svg.setAttribute('viewBox','0 0 24 24');svg.setAttribute('aria-hidden','true');const shape=document.createElementNS(svg.namespaceURI,'path');shape.setAttribute('d',path);svg.append(shape);button.append(svg);
   button.onclick=()=>Promise.resolve().then(fn).catch(e=>tell(e.message,true));actions.append(button);return button;
  }
  action('open-note','Apri nella libreria','M4 3h16v18H4z M9 3v18 M5 8l2 3-2 3',async()=>{await flush();await call({action:'open-library',markId:hit.mark.id});});
  const colorButton=action('choose-color','Colore evidenziazione','',()=>{colors.hidden=!colors.hidden;place(annotation,rect);positionToolbar();});
  colorButton.replaceChildren();const chip=document.createElement('span');chip.className='color-chip';chip.style.background=color;colorButton.append(chip);
  function setColor(value){color=value;chip.style.background=value;changed();flush().catch(()=>{});}
  for(const value of ['#fdffb4','#c3effc','#f8b6a8','#a7e8c8']){const b=document.createElement('button');b.className='swatch';b.style.background=value;b.title=value;b.setAttribute('aria-label','Usa il colore '+value);b.onclick=()=>setColor(value);colors.append(b);}
  const custom=document.createElement('input');custom.type='color';custom.className='custom-color';custom.value=color;custom.title='Colore personalizzato';custom.setAttribute('aria-label',custom.title);custom.onchange=()=>setColor(custom.value);colors.append(custom);
  action('copy-text','Copia testo','M9 3h11v13H9z M5 8H3v13h12v-2',async()=>{await flush();await call({action:'page:copy',markId:hit.mark.id,format:'text'});feedback.textContent='Testo copiato';});
  action('copy-quote','Copia citazione Markdown','M4 6h6v6H4z M4 12v5l6-5 M14 6h6v6h-6z M14 12v5l6-5',async()=>{await flush();await call({action:'page:copy',markId:hit.mark.id,format:'markdown'});feedback.textContent='Citazione copiata';});
  action('flashcard','Flashcard','M3 5h18v14H3z M9 10a3 3 0 0 1 6 0c0 2-3 1-3 4 M12 16h.01',()=>{question.hidden=!question.hidden;if(!question.hidden)question.focus();place(annotation,rect);positionToolbar();});
  action('delete-mark','Elimina evidenziazione','M3 6h18 M9 6V3h6v3 M6 6l1 15h10l1-15 M10 10v7 M14 10v7',async()=>{
   await flush();
   await call({action:'page:remove',markId:hit.mark.id,revision});annotation.hidden=true;editor=null;await refresh();tell('Evidenziazione eliminata.');
  });
  action('close-note','Chiudi','M6 6l12 12 M18 6L6 18',closeAnnotation);
  const formats=document.createElement('div');formats.className='format-bar';formats.setAttribute('role','toolbar');formats.setAttribute('aria-label','Formattazione nota Markdown');
  for(const [cls,label,title,open,close] of [['bold','B','Grassetto','**','**'],['italic','I','Corsivo','*','*'],['list','≡','Elenco puntato','\n- ',''],['ordered','1.','Elenco numerato','\n1. ',''],['code','<>','Codice','`','`'],['h1','H1','Titolo 1','\n# ',''],['h2','H2','Titolo 2','\n## ','']]){
   const b=document.createElement('button');b.className='format-'+cls;b.textContent=label;b.title=title;b.setAttribute('aria-label',title);b.onpointerdown=e=>e.preventDefault();b.onclick=()=>{const a=note.selectionStart,z=note.selectionEnd;note.setRangeText(open+note.value.slice(a,z)+close,a,z,'select');note.setSelectionRange(a+open.length,z+open.length);changed();note.focus();};formats.append(b);
  }
  function positionToolbar(){const b=actions.getBoundingClientRect();actions.style.left=Math.max(8,Math.min(innerWidth-b.width-8,rect.left))+'px';let top=Math.max(8,rect.top-b.height-8);const body=annotation.getBoundingClientRect();if(top<body.bottom&&top+b.height>body.top)top=body.top-b.height-8>=8?body.top-b.height-8:body.bottom+8;actions.style.top=Math.min(innerHeight-b.height-8,top)+'px';}
  box.append(formats);card.append(colors,tagRow,box,question,footer);annotation.append(actions,card);place(annotation,rect);positionToolbar();
 }
 document.addEventListener('mouseup',e=>{if(!e.composedPath().includes(root))setTimeout(selection,10);});
 document.addEventListener('keydown',e=>{if(e.altKey&&e.key.toLowerCase()==='s'){e.preventDefault();add();}});
 document.addEventListener('keyup',e=>{if(e.key==='Escape'){if(tool)tool.hidden=true;closeAnnotation();savedRange=null;}else if(e.key==='Shift')selection();});
 document.addEventListener('pointerdown',e=>pointerStart={x:e.clientX,y:e.clientY});
 document.addEventListener('click',async e=>{
  if(e.composedPath().includes(root))return;
  if(!enabled||e.button!==0||e.ctrlKey||e.metaKey||e.shiftKey||!getSelection()?.isCollapsed)return;
  if(pointerStart&&Math.hypot(e.clientX-pointerStart.x,e.clientY-pointerStart.y)>5)return;
  const hit=[...ranges].reverse().find(({range})=>[...range.getClientRects()].some(r=>e.clientX>=r.left&&e.clientX<=r.right&&e.clientY>=r.top&&e.clientY<=r.bottom));
  if(!hit){if(editor?.dirty()){e.preventDefault();e.stopPropagation();}await closeAnnotation();return;}
  e.preventDefault();e.stopPropagation();
  if(e.altKey)call({action:'open-library',markId:hit.mark.id}).catch(err=>tell(err.message,true));
  else showAnnotation(hit,[...hit.range.getClientRects()].find(r=>e.clientX>=r.left&&e.clientX<=r.right&&e.clientY>=r.top&&e.clientY<=r.bottom)||hit.range.getBoundingClientRect());
 },true);
 window.addEventListener('resize',()=>{clearTimeout(layoutTimer);layoutTimer=setTimeout(()=>draw().catch(e=>tell(e.message,true)),150);});
 window.addEventListener('scroll',()=>{if(tool)tool.hidden=true;closeAnnotation();clearTimeout(layoutTimer);layoutTimer=setTimeout(()=>draw().catch(e=>tell(e.message,true)),80);},{passive:true});
 const observer=new MutationObserver(events=>{
  if(events.every(e=>e.target===root||root?.contains(e.target)))return;
  clearTimeout(refreshTimer);refreshTimer=setTimeout(refresh,1200);
 });
 observer.observe(document.body,{subtree:true,childList:true,characterData:true});
 browser.runtime.onMessage.addListener(async message=>{
  if(message.action==='highlight'){await add();return {ok:true};}
  if(message.action==='refresh'){await refresh();return {ok:true};}
  if(message.action==='capture')return {title:document.title,reader:document.body.innerText.slice(0,1999999)};
  if(message.action==='bookmark'){
   try{await call({action:'page:bookmark',title:document.title,reader:document.body.innerText.slice(0,1999999)});tell('Pagina salvata nel vault.');return {ok:true};}catch(e){tell(e.message,true);return {error:e.message};}
  }
  if(message.action==='image'){
   try{await call({action:'page:add',title:document.title,anchor:{exact:'Immagine: '+message.imageUrl,imageUrl:message.imageUrl}});tell('Riferimento all’immagine salvato.');return {ok:true};}catch(e){return {error:e.message};}
  }
 });
 setInterval(async()=>{
  if(document.hidden)return;
  if(location.href!==lastUrl){lastUrl=location.href;record=null;ranges=[];savedRange=null;if(annotation&&!editor?.dirty())annotation.hidden=true;}
  await settings();if(enabled)await refresh();else{clearPaint();if(tool)tool.hidden=true;if(annotation&&!editor?.dirty())annotation.hidden=true;}
 },10000);
 window.addEventListener('beforeunload',e=>{if(editor?.dirty()){e.preventDefault();e.returnValue='';}});
 settings().then(()=>{if(enabled)refresh();});
})();
