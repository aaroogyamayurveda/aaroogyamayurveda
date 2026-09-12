/* Legacy Fast Order bridge retained only for static compatibility.
   Fast Order is not rendered by CRM2. Normal Create Order is owned by create-order-ui.js.
   The compatibility handler below is intentionally scoped to an explicitly rendered
   legacy Fast Order button; it never intercepts the real Create Order action. */
export const crm2FastOrderDisabled=true;
export function crm2OpenCreateOrderBridge(leadId=null){
  if(typeof window.crm2OpenCreateOrder==='function')window.crm2OpenCreateOrder(leadId?{lead:{id:leadId}}:{});
}
document.addEventListener('click',event=>{
  const btn=event.target?.closest?.('button');
  const legacyLabel=(btn?.textContent||'').trim().toLowerCase();
  if(!btn||legacyLabel!=='fast order')return;
  event.preventDefault();
  event.stopImmediatePropagation();
  crm2OpenCreateOrderBridge(btn.dataset.leadId||null);
},true);
