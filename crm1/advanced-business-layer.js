/* CRM1 advanced module bootstrap: stage the app until every advanced module has loaded. */
(function(){
  'use strict';

  var GATE_ID='crm1AdvancedBootGate';
  var MAX_WAIT=15000;
  var resolveReady;

  if(window.crm1AdvancedReady && typeof window.crm1AdvancedReady.then==='function'){
    // Reuse an existing readiness promise when the page bootstrap created it first.
  }else{
    window.crm1AdvancedReady=new Promise(function(resolve){resolveReady=resolve;});
    window.crm1AdvancedReadyResolve=function(){if(resolveReady){resolveReady();resolveReady=null;}};
  }

  function lock(){
    if(document.getElementById(GATE_ID)) return;
    var style=document.createElement('style');
    style.id=GATE_ID;
    style.textContent='#app{visibility:hidden!important;opacity:0!important;pointer-events:none!important}.crm1-boot-loader{position:fixed;inset:0;z-index:99999;display:grid;place-items:center;background:#f4f7f4;color:#164b30;font:700 16px system-ui,-apple-system,Segoe UI,Arial,sans-serif}.crm1-boot-loader span{background:#fff;border:1px solid #dfe7e1;border-radius:14px;padding:16px 20px;box-shadow:0 12px 35px rgba(22,75,48,.10)}';
    document.head.appendChild(style);
    var loader=document.createElement('div');
    loader.id='crm1AdvancedBootLoader';
    loader.className='crm1-boot-loader';
    loader.innerHTML='<span>Loading Aaroogyam CRM…</span>';
    document.body.appendChild(loader);
  }

  function unlock(){
    document.getElementById(GATE_ID)?.remove();
    document.getElementById('crm1AdvancedBootLoader')?.remove();
    try{window.crm1AdvancedReadyResolve?.();}catch(e){}
  }

  lock();

  (async()=>{
    const load=src=>new Promise(resolve=>{
      const s=document.createElement('script');
      s.src=src;
      s.async=false;
      s.onload=()=>resolve(true);
      s.onerror=()=>{console.error('CRM1 module failed to load:',src);resolve(false)};
      document.head.appendChild(s);
    });

    try{
      await load('./advanced-business-layer.core.js');
      await load('./crm1-followup-verification-fix.js');
      await load('./crm1-pin-auto-assignment.js?v=1');
      await load('./crm1-followups-queue-fix.js');
      await load('./crm1-followup-customer-context-fix.js?v=2');
      await load('./crm1-agent-workspace.js');
      await load('./crm1-call-console.js');
      await load('./crm1-call-disposition.js');
      await load('./crm1-call-conversion-finalizer.js?v=1');
      await load('./crm1-lead-call-bridge.js');
      await load('./crm1-lead-workqueue.js');
      await load('./crm1-telephony-bridge-readiness.js');
      await load('./crm1-workforce-runtime.js?v=2');
      await load('./crm1-workforce-ui-bridge.js?v=2');
      await load('./crm1-followup-lead-status-sync.js?v=1');
      await load('./crm1-order-assignment-verification-guard.js?v=1');
      await load('./crm1-manager-reports.js?v=1');
      await load('./crm1-order-timeline.js?v=4');
      await load('./crm1-delivery-workflow.js?v=2');
      await load('./crm1-agent-performance-detailed.js?v=2');
      await load('./crm1-partner-performance-final.js?v=4');
      await load('./crm1-advanced-reports-detailed.js?v=1');
      await load('./crm1-settlements-detailed.js?v=3');
      await load('./crm1-pin-rules-detailed.js?v=1');
      await load('./crm1-inventory-detailed.js?v=1');
      await load('./crm1-qa-detailed-v6.js?v=6');
      await load('./crm1-render-stability.js?v=2');
      /* Customer 360 is normalized at source; no DOM cleanup overlay is loaded. */
    }finally{
      unlock();
    }
  })();

  setTimeout(unlock,MAX_WAIT);
})();
