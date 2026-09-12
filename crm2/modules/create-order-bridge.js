/* Legacy Fast Order bridge retained only for static compatibility.
   Fast Order is disabled. Normal Create Order is owned by create-order-ui.js.
   IMPORTANT: do not install a document-level capture handler here; it hijacks the
   real button event and can block the browser while the workspace is rendering. */
export const crm2FastOrderDisabled=true;
export function crm2OpenCreateOrderBridge(leadId=null){
  if(typeof window.crm2OpenCreateOrder==='function')window.crm2OpenCreateOrder(leadId?{lead:{id:leadId}}:{});
}
