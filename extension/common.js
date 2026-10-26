'use strict';
globalThis.LH={
 async send(message){const reply=await browser.runtime.sendMessage(message);if(!reply?.ok)throw Error(reply?.error||'Nessuna risposta dal componente locale.');return reply.result;},
 rpc(request){return this.send({action:'rpc',request});},
 node(tag,text,cls){const el=document.createElement(tag);if(text!==undefined)el.textContent=text;if(cls)el.className=cls;return el;},
 tags(text){return [...new Set(text.split(',').map(s=>s.trim()).filter(Boolean))];},
 safeUrl(url){try{return ['http:','https:','file:'].includes(new URL(url).protocol)?url:'#';}catch{return '#';}},
 download(data,name,type='text/plain'){const u=URL.createObjectURL(new Blob([data],{type}));const a=document.createElement('a');a.href=u;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(u),10000);},
 blank(url,title){const u=new URL(url);u.hash='';return {id:crypto.randomUUID(),url:u.href,title:title||url,notes:'',marks:[],tags:[],collections:[],starred:false,reader:''};},
 error(e){const el=document.getElementById('status');el.textContent=e.message||String(e);el.className='status error';el.hidden=false;},
 status(message){const el=document.getElementById('status');el.textContent=message;el.className='status';el.hidden=!message;}
};
