/* CRM1 workforce auth bootstrap: start workforce UI after CRM login/auth is actually available. */
(function(){
  'use strict';
  var injectedFor=null;
  var wait=function(ms){return new Promise(function(resolve){setTimeout(resolve,ms);});};
  function inject(userId){
    if(!userId || injectedFor===userId || window.__crm1WorkforceV2Injected===userId)return;
    injectedFor=userId;
    window.__crm1WorkforceV2Injected=userId;
    var s=document.createElement('script');
    s.src='./crm1-workforce-v2.js?v=4';
    s.async=false;
    s.onload=function(){console.log('CRM1 workforce loaded for authenticated user');};
    s.onerror=function(){injectedFor=null;window.__crm1WorkforceV2Injected=null;console.error('CRM1 workforce failed to load');};
    document.body.appendChild(s);
  }
  async function start(){
    for(var i=0;i<80;i++){
      if(window.sb && window.sb.auth)break;
      await wait(250);
    }
    if(!window.sb || !window.sb.auth)return;
    try{
      var current=await window.sb.auth.getUser();
      if(current&&current.data&&current.data.user)inject(current.data.user.id);
    }catch(e){}
    window.sb.auth.onAuthStateChange(function(event,session){
      if(session&&session.user){
        setTimeout(function(){inject(session.user.id);},0);
      }else if(event==='SIGNED_OUT'){
        injectedFor=null;
        window.__crm1WorkforceV2Injected=null;
      }
    });
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});
  else start();
})();
