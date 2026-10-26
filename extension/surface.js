/* Selection and overlays shared by the local reader and PDF viewer. */
globalThis.LHSurface=class {
 constructor(container,overlay,save,extra=()=>({})){
  this.container=container;this.overlay=overlay;this.save=save;this.extra=extra;this.marks=[];this.matches=[];
  this.button=document.getElementById('highlight-selection');
  document.addEventListener('selectionchange',()=>{
   const s=getSelection();if(!s?.rangeCount||s.isCollapsed||!container.contains(s.getRangeAt(0).commonAncestorContainer))return;
   this.range=s.getRangeAt(0).cloneRange();this.button.hidden=false;
  });
  this.button.onpointerdown=e=>e.preventDefault();this.button.onclick=()=>this.add().catch(LH.error);
  document.addEventListener('keydown',e=>{if(e.altKey&&e.key.toLowerCase()==='s'){e.preventDefault();this.add().catch(LH.error);}});
  window.addEventListener('resize',()=>this.paint());
 }
 async add(){
  const anchor=LHAnchors.capture(this.container,this.range);if(!anchor)throw Error('Seleziona prima il testo.');
  const extra=this.extra(), rects=[...this.range.getClientRects()].filter(r=>r.width&&r.height), box=this.container.getBoundingClientRect();
  anchor.rects=rects.map(r=>({x:(r.left-box.left)/box.width,y:(r.top-box.top)/box.height,width:r.width/box.width,height:r.height/box.height}));
  Object.assign(anchor,extra);await this.save(anchor);this.range=null;getSelection()?.removeAllRanges();this.button.hidden=true;
 }
 set(marks){this.marks=marks;this.paint();}
 paint(){
  this.overlay.replaceChildren();this.matches=[];
  const idx=LHAnchors.index(this.container),box=this.overlay.getBoundingClientRect();
  for(const mark of this.marks){
   if(mark.kind==='note')continue;
   const range=LHAnchors.restore(this.container,mark.anchor||{exact:mark.text},idx);if(!range)continue;
   this.matches.push(mark.id);
   for(const r of range.getClientRects()){
    const div=LH.node('div',undefined,'pdf-rect');div.dataset.markId=mark.id;
    div.style.cssText=`left:${r.left-box.left}px;top:${r.top-box.top}px;width:${r.width}px;height:${r.height}px;background:${/^#[a-f0-9]{6}$/i.test(mark.color)?mark.color:'#fdffb4'}`;this.overlay.append(div);
   }
  }
 }
};
