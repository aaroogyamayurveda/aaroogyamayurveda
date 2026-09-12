// Keep the legacy Create Order bridge's capture-phase click handler from blocking
// Playwright/user interaction while the workspace is rendered synchronously.
// The bridge is retained for static compatibility, but normal Create Order opens
// on the next task so the browser can complete the click event first.
const open=()=>window.crm2OpenCreateOrder;
if(!window.crm2CreateOrderClickStability){
  window.crm2CreateOrderClickStability=true;
  const install=()=>{
    const fn=open();
    if(typeof fn!=='function')return false;
    if(fn.__crm2Deferred)return true;
    const wrapped=(...args)=>setTimeout(()=>fn(...args),0);
    wrapped.__crm2Deferred=true;
    window.crm2OpenCreateOrder=wrapped;
    return true;
  };
  if(!install())window.addEventListener('crm2CreateOrderUIReady',install,{once:true});
}
