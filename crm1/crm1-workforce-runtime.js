/* CRM1 workforce runtime loader: load workforce modules only after auth is available. */
(function(){
  'use strict';
  var started=false;
  function load(){
    if(started)return;
    var sb=window.sb;
    if(!sb)return;
    sb.auth.getUser().then(function(r){
      if(!r||!r.data||!r.data.user||started)return;
      started=true;
      var s=document.createElement('script');
      s.src='./crm1-workforce-v2.js?v=4';
      s.async=false;
      s.onload=function(){window.dispatchEvent(new CustomEvent('crm1WorkforceReady'));};
      s.onerror=function(){console.error('CRM1 workforce module failed to load');started=false;};
      document.head.appendChild(s);
    }).catch(function(){});
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',load,{once:true});else load();
  window.addEventListener('crm1SupabaseReady',load);
  if(window.sb&&window.sb.auth){
    window.sb.auth.onAuthStateChange(function(event,session){
      if(event==='SIGNED_IN'&&session) setTimeout(load,50);
    });
  }
  setTimeout(load,500);
})();
