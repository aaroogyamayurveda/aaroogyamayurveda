/* Create Order bridge kept for legacy imports only.
   Fast Order is intentionally removed from CRM2 UI and is never intercepted. */
export const crm2FastOrderDisabled=true;
export function crm2OpenCreateOrderBridge(leadId=null){
  if(typeof window.crm2OpenCreateOrder==='function')window.crm2OpenCreateOrder(leadId?{lead:{id:leadId}}:{});
}
