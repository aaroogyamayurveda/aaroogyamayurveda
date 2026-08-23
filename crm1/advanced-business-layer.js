/* CRM1 compatibility bootstrap: shared Supabase client, tested core first, then isolated incremental modules. */
(async()=>{
  'use strict';
  try{
    const {createClient}=await import('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm');
    const URL='https://ielebadardbzmoxantsc.supabase.co';
    const KEY='sb_publishable_0pekrOT6vhYZYQ48wHr7Ag_NPcpobGj';
    if(!window.sb) window.sb=createClient(URL,KEY);
    window.supabase=window.supabase||{};
    if(!window.supabase.createClient) window.supabase.createClient=createClient;
    window.dispatchEvent(new CustomEvent('crm1SupabaseReady',{detail:{sb:window.sb}}));
  }catch(e){ console.error('CRM Supabase compatibility bootstrap failed:',e); }
  const load=src=>new Promise(resolve=>{const s=document.createElement('script');s.src=src;s.async=false;s.onload=resolve;s.onerror=()=>resolve();document.head.appendChild(s)});
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
  /* Customer 360 is now normalized at source; the DOM cleanup module is intentionally not loaded. */
})();
