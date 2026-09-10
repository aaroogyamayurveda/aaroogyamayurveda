const wire=()=>{
  if(typeof window.crm2OpenCreateOrder!=='function')return;
  document.querySelectorAll('button').forEach(btn=>{
    if(btn.dataset.crm2CreateOrderBridge==='true')return;
    if(!/^Fast Order$/i.test((btn.textContent||'').trim()))return;
    const replacement=btn.cloneNode(true);
    replacement.textContent='Create Order';
    replacement.dataset.crm2CreateOrderBridge='true';
    replacement.onclick=()=>window.crm2OpenCreateOrder();
    btn.replaceWith(replacement);
  });
};
new MutationObserver(wire).observe(document.body,{subtree:true,childList:true});
window.addEventListener('crm2CreateOrderUIReady',wire);
wire();
