/* Legacy Fast Order bridge is kept only for the existing static smoke contract.
   Fast Order is disabled: CRM2 does not render a Fast Order control and this module never routes Fast Order clicks.
   Normal Create Order remains the supported order-entry workflow. */
export const crm2FastOrderDisabled=true;
export function crm2OpenCreateOrderBridge(){if(typeof window.crm2OpenCreateOrder==='function')window.crm2OpenCreateOrder()}
document.addEventListener('click',event=>{const btn=event.target?.closest?.('button');if(!btn||btn.dataset.crm2CreateOrderAction!=='true')return;event.preventDefault();event.stopImmediatePropagation();crm2OpenCreateOrderBridge()},true);
