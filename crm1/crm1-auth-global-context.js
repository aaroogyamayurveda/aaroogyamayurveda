/* CRM1 auth/context bridge: expose the authenticated user/profile to non-module CRM1 renderers. */
(function(){
  'use strict';
  if(window.__crm1AuthGlobalContext) return;
  window.__crm1AuthGlobalContext=true;

  var timer=0;
  var busy=false;

  async function sync(){
    if(busy || !window.sb?.auth) return;
    busy=true;
    try{
      var session=await window.sb.auth.getSession();
      var user=session?.data?.session?.user||null;
      window.me=user;
      window.profile=null;
      if(user){
        var p=await window.sb.from('profiles').select('*').eq('id',user.id).maybeSingle();
        window.profile=p?.data||null;
      }
    }catch(e){
      console.warn('CRM1 auth context sync:',e?.message||e);
    }finally{busy=false;}
  }

  function schedule(){
    clearTimeout(timer);
    timer=setTimeout(sync,50);
  }

  async function boot(){
    try{
      if(window.crm1SupabaseReady?.then) await window.crm1SupabaseReady;
    }catch(e){
      console.warn('CRM1 Supabase ready:',e?.message||e);
    }
    await sync();
    if(window.sb?.auth?.onAuthStateChange){
      window.sb.auth.onAuthStateChange(function(){schedule();});
    }
    [250,1000,2500,5000,10000,15000].forEach(function(ms){setTimeout(sync,ms);});
  }

  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',boot,{once:true});
  else boot();
})();
