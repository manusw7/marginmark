/* Shared text-quote anchors. Never guess when several passages match. */
(function (root) {
 'use strict';
 function normalize(text) {
  let out='', map=[], whitespace=false;
  for(let i=0;i<text.length;i++) {
   if(/\s/u.test(text[i])) { if(!whitespace){out+=' ';map.push(i);} whitespace=true; }
   else {out+=text[i];map.push(i);whitespace=false;}
  }
  map.push(text.length); return {text:out,map};
 }
 function findQuote(text,anchor) {
  const n=normalize(text), exact=normalize(anchor.exact||'').text.trim();
  if(!exact) return null;
  const hits=[]; let at=n.text.indexOf(exact);
  while(at!==-1) {
   const prefix=normalize(anchor.prefix||'').text, suffix=normalize(anchor.suffix||'').text;
   if((!prefix||n.text.slice(0,at).endsWith(prefix))&&(!suffix||n.text.slice(at+exact.length).startsWith(suffix))) hits.push({start:n.map[at],end:n.map[at+exact.length]});
   at=n.text.indexOf(exact,at+1);
  }
  if(hits.length===1) return hits[0];
  return hits.find(h=>h.start===anchor.start&&h.end===anchor.end)||null;
 }
 function index(container) {
  const nodes=[], walker=document.createTreeWalker(container,NodeFilter.SHOW_TEXT,{
   acceptNode(node) {
    const p=node.parentElement;
    return !p||p.closest('script,style,noscript,textarea,input,select,button,[contenteditable="true"],[data-lh-root],[hidden],[aria-hidden="true"]') ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT;
   }
  });
  let text='', node;
  while((node=walker.nextNode())) {nodes.push({node,start:text.length,end:text.length+node.length});text+=node.data;}
  return {text,nodes};
 }
 function rangeAt(idx,start,end) {
  const a=idx.nodes.find(n=>n.end>start), b=[...idx.nodes].reverse().find(n=>n.start<end);
  if(!a||!b) return null;
  const r=document.createRange();r.setStart(a.node,start-a.start);r.setEnd(b.node,end-b.start);return r;
 }
 function capture(container,range) {
  if(!range||range.collapsed||!container.contains(range.commonAncestorContainer)) return null;
  const idx=index(container);
  let a=idx.nodes.find(n=>n.node===range.startContainer), b=idx.nodes.find(n=>n.node===range.endContainer);
  // Element boundaries can occur when selecting entire paragraphs.
  if(!a||!b) {
   const found=findQuote(idx.text,{exact:range.toString()});
   if(!found) return null;
   a={start:found.start};b={start:found.end};
   return {exact:idx.text.slice(found.start,found.end),start:found.start,end:found.end,prefix:idx.text.slice(Math.max(0,found.start-48),found.start),suffix:idx.text.slice(found.end,found.end+48)};
  }
  const start=a.start+range.startOffset,end=b.start+range.endOffset;
  return {exact:idx.text.slice(start,end),start,end,prefix:idx.text.slice(Math.max(0,start-48),start),suffix:idx.text.slice(end,end+48)};
 }
 function legacyRange(container,anchor) {
  const meta=anchor.legacy;
  if(!meta?.startMeta||!meta?.endMeta) return null;
  function point(m) {
   const parent=container.getElementsByTagName(m.parentTagName)[m.parentIndex];
   if(!parent) return null;
   const idx=index(parent),n=idx.nodes.find(n=>n.end>=m.textOffset);
   return n?{node:n.node,offset:m.textOffset-n.start}:null;
  }
  const a=point(meta.startMeta), b=point(meta.endMeta);
  if(!a||!b) return null;
  try {const r=document.createRange();r.setStart(a.node,a.offset);r.setEnd(b.node,b.offset);return normalize(r.toString()).text.trim()===normalize(anchor.exact).text.trim()?r:null;}catch{return null;}
 }
 function restore(container,anchor,idx=index(container)) {
  const legacy=legacyRange(container,anchor); if(legacy) return legacy;
  let hit=findQuote(idx.text,anchor);
  // Context may change; a unique quote still identifies the saved passage.
  if(!hit) hit=findQuote(idx.text,{exact:anchor.exact});
  return hit?rangeAt(idx,hit.start,hit.end):null;
 }
 const api={normalize,findQuote,index,rangeAt,capture,restore};root.LHAnchors=api;
 if(typeof module!=='undefined') module.exports=api;
})(globalThis);
