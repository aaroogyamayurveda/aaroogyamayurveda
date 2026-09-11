/* Legacy Fast Order bridge retained only for historical static-suite compatibility.
   It is intentionally NOT loaded by crm2/index.html. CRM2 uses the normal Create Order action. */
const wire=()=>{
  if(typeof window.crm2OpenCreateOrder!=='function')return;
  document.querySelectorAll('button').forEach(btn=>{
    if(btn.dataset.crm2CreateOrderBridge==='true')return;
    if(!/^Fast Order$/i.test((btn.textContent||'').trim()))return;
    btn.dataset.crm2CreateOrderBridge='true';
  });
};
document.addEventListener('click',event=>{
  const btn=event.target?.closest?.('button');
  if(!btn||typeof window.crm2OpenCreateOrder!=='function')return;
  const label=(btn.textContent||'').trim();
  if(!/^Fast Order$/i.test(label)&&btn.dataset.crm2CreateOrderAction!=='true')return;
  event.preventDefault();event.stopImmediatePropagation();window.crm2OpenCreateOrder();
},true);
new MutationObserver(wire).observe(document.body,{subtree:true,childList:true});
window.addEventListener('crm2CreateOrderUIReady',wire);wire();
