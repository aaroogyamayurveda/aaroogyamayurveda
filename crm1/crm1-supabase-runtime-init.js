/* CRM1 Supabase runtime initializer.
   Provides the shared window.sb client expected by CRM1 modules before any
   renderer/action guard starts. No page rendering is performed here. */
(()=>{
  'use strict';
  const URL='https://ielebadardbzmoxantsc.supabase.co';
  const KEY='sb_publishable_0pekrOT6vhYZYQ48wHr7Ag_NPcpobGj';
  if(window.sb?.from && window.crm1SupabaseReady?.then){return;}

  let resolveReady;
  let rejectReady;
  window.crm1SupabaseReady=new Promise((resolve,reject)=>{resolveReady=resolve;rejectReady=reject});
  window.crm1SupabaseReady.catch(()=>{});

  (async()=>{
    try{
      if(!window.sb?.from){
        const mod=await import('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm');
        if(!mod?.createClient) throw new Error('Supabase client library unavailable');
        window.sb=mod.createClient(URL,KEY);
        globalThis.sb=window.sb;
      }else{
        globalThis.sb=window.sb;
      }
      resolveReady(window.sb);
    }catch(e){
      console.error('CRM1 Supabase runtime initialization failed:',e);
      rejectReady(e);
    }
  })();
})();
