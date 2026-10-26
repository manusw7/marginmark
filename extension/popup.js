(async()=>{
 const $=id=>document.getElementById(id);
 const [tab]=await browser.tabs.query({active:true,currentWindow:true});
 const settings=await browser.storage.local.get({popup:true,color:'#fdffb4',disabledSites:[]});
 let hostname='';try{hostname=new URL(tab.url).hostname;}catch{}
 $('popup').checked=settings.popup;$('color').value=settings.color;$('disabled').checked=settings.disabledSites.includes(hostname);
 $('popup').onchange=()=>browser.storage.local.set({popup:$('popup').checked});
 $('color').onchange=()=>browser.storage.local.set({color:$('color').value});
 $('disabled').onchange=async()=>{settings.disabledSites=settings.disabledSites.filter(h=>h!==hostname);if($('disabled').checked)settings.disabledSites.push(hostname);await browser.storage.local.set({disabledSites:settings.disabledSites});LH.status('Impostazione salvata. Ricarica la pagina per applicarla subito.');};
 $('library').onclick=()=>LH.send({action:'open-library'}).then(()=>window.close()).catch(LH.error);
 $('sidebar').onclick=()=>browser.sidebarAction.open().then(()=>window.close()).catch(LH.error);
 $('pdf').onclick=()=>LH.send({action:'open-pdf',url:/\.pdf(?:$|[?#])/i.test(tab.url)?tab.url:undefined}).then(()=>window.close()).catch(LH.error);
 $('bookmark').onclick=async()=>{try{const r=await browser.tabs.sendMessage(tab.id,{action:'bookmark'});if(r.error)throw Error(r.error);LH.status('Pagina salvata.');}catch(e){LH.error(Error('Pagina non accessibile. Per un PDF usa “Lettore PDF”. '+e.message));}};
 const error=new URLSearchParams(location.search).get('error');if(error)LH.error(Error(error));
 try{const s=await LH.rpc({op:'status'});if(!error)LH.status('Archivio locale collegato.');}catch(e){LH.error(e);}
})();
