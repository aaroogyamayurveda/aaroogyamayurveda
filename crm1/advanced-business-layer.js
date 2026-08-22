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
  await load('./crm1-followups-queue-fix.js');
  /* Existing tested Telephony Admin remains the single telephony administration module. */
  await load('./crm1-agent-workspace.js');
  await load('./crm1-call-console.js');
  await load('./crm1-call-disposition.js');
  await load('./crm1-lead-call-bridge.js');
  await load('./crm1-lead-workqueue.js');
  await load('./crm1-telephony-bridge-readiness.js');
  await load('./crm1-lead-context-bridge.js?v=3');
  await load('./crm1-workforce-v2.js?v=1');
})();