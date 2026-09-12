// Create Order stability guard.
// 1) Prevent the Orders-page observer from adding the same action repeatedly.
// 2) Do not let the parity call-console sync observe the attributes it changes.
const NativeMutationObserver=window.MutationObserver;
if(NativeMutationObserver&&!NativeMutationObserver.__crm2StablePatched){
  const nativeObserve=NativeMutationObserver.prototype.observe;
  NativeMutationObserver.prototype.observe=function(target,options){
    if(target?.matches?.('.crm1-parity-console')){
      options={...options,attributes:false};
    }
    return nativeObserve.call(this,target,options);
  };
  NativeMutationObserver.__crm2StablePatched=true;
  window.MutationObserver=class extends NativeMutationObserver{
    constructor(callback){
      const source=String(callback||'');
      const isCreateOrderObserver=source.includes('crm2-create-order-action')||source.includes('crm2CreateOrderAction')||source.includes('Calling Workspace')||source.includes('Customer 360');
      if(!isCreateOrderObserver){super(callback);return}
      let lastMain=null;
      super((mutations,observer)=>{
        const main=document.querySelector('#main');
        const hasAction=!!main?.querySelector('[data-crm2-create-order-action], [data-crm2CreateOrderAction]');
        const hasWorkspace=!!main?.querySelector('[data-crm2-create-order]');
        if(hasAction&&!hasWorkspace&&main===lastMain)return;
        lastMain=main;
        callback(mutations,observer);
      });
    }
  };
}
