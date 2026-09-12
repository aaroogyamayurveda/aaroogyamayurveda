// Prevent the Create Order action observer from recursively re-triggering itself.
// The UI observer adds a button, which is itself a childList mutation; without
// a guard, each observer pass added another button until the main thread froze.
const NativeMutationObserver=window.MutationObserver;
if(NativeMutationObserver){
  window.MutationObserver=class extends NativeMutationObserver{
    constructor(callback){
      const source=String(callback||'');
      const isCreateOrderObserver=source.includes('crm2-create-order-action')||source.includes('crm2CreateOrderAction')||source.includes('Calling Workspace')||source.includes('Customer 360');
      if(!isCreateOrderObserver){super(callback);return}
      let lastMain=null;
      super((mutations,observer)=>{
        const main=document.querySelector('#main');
        const hasAction=!!main?.querySelector('[data-crm2CreateOrderAction]');
        const hasWorkspace=!!main?.querySelector('[data-crm2-create-order]');
        if(hasAction&&!hasWorkspace&&main===lastMain)return;
        lastMain=main;
        callback(mutations,observer);
      });
    }
  };
}
