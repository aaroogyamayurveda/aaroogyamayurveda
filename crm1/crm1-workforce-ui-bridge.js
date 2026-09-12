/* CRM1 workforce UI bridge: guarantee Manager/Agent workforce navigation is present after CRM auth and after legacy nav rebuilds. */
(function(){
  'use strict';
  var managerRoles=['super_admin','management','order_manager'];
  var agentRoles=['agent','management','order_manager','super_admin'];
  var wait=function(ms){return new Promise(function(r){setTimeout(r,ms);});};
  var userId=null, navObserverStarted=false;

  function addButton(id,label){
    var nav=document.getElementById('nav');
    if(!nav || !document.getElementById(id)){
      if(!nav)return;
    }
    var b=document.getElementById(id);
    if(!b){
      b=document.createElement('button');
      b.type='button'; b.id=id; b.textContent=label;
      b.dataset.crm1WorkforceNav='1';
      nav.appendChild(b);
    }
    b.onclick=function(){
      var pageId=id.replace('crm1W2Nav_','');
      if(window.crm1WorkforceOpenPage){window.crm1WorkforceOpenPage(pageId);return;}
      setTimeout(function(){if(window.crm1WorkforceOpenPage)window.crm1WorkforceOpenPage(pageId);},150);
    };
  }

  async function profileFor(user){
    try{
      var r=await window.sb.from('profiles').select('id,full_name,email,role,is_active').eq('id',user.id).maybeSingle();
      return r.data||null;
    }catch(e){return null;}
  }

  async function ensure(){
    if(!window.sb||!window.sb.auth)return;
    var r=await window.sb.auth.getUser();
    var user=r&&r.data&&r.data.user;
    if(!user){userId=null;return;}
    if(userId!==user.id){userId=user.id;}
    var p=await profileFor(user); if(!p)return;
    if(managerRoles.indexOf(p.role)>=0){
      addButton('crm1W2Nav_crm1W2Manager','📊 Manager Control');
      addButton('crm1W2Nav_crm1W2Import','📥 Lead Import');
      addButton('crm1W2Nav_crm1W2Assignment','👥 Lead Assignment');
    }
    if(agentRoles.indexOf(p.role)>=0) addButton('crm1W2Nav_crm1W2Queue','📞 Today\'s Calling Queue');
  }

  function observe(){
    if(navObserverStarted)return; navObserverStarted=true;
    var start=function(){
      var nav=document.getElementById('nav');
      if(!nav)return;
      new MutationObserver(function(){setTimeout(ensure,50);}).observe(nav,{childList:true,subtree:true});
      ensure();
    };
    if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
  }

  function loadWorkforce(){
    if(window.__crm1WorkforceV2Injected)return Promise.resolve();
    window.__crm1WorkforceV2Injected='loading';
    return new Promise(function(resolve,reject){
      var s=document.createElement('script'); s.src='./crm1-workforce-v2.js?v=5'; s.async=false;
      s.onload=function(){window.__crm1WorkforceV2Injected='loaded';setTimeout(ensure,120);resolve();};
      s.onerror=function(){window.__crm1WorkforceV2Injected=null;reject(new Error('CRM1 workforce module failed to load'));};
      document.head.appendChild(s);
    });
  }

  async function start(){
    for(var i=0;i<80;i++){if(window.sb&&window.sb.auth)break;await wait(250);}
    if(!window.sb||!window.sb.auth)return;
    observe();
    try{var r=await window.sb.auth.getUser();if(r&&r.data&&r.data.user){await loadWorkforce();await ensure();}}catch(e){}
    window.sb.auth.onAuthStateChange(function(event,session){
      if(session&&session.user){setTimeout(async function(){try{await loadWorkforce();await ensure();}catch(e){}},50);}
      if(event==='SIGNED_OUT'){userId=null;window.__crm1WorkforceV2Injected=null;}
    });
    setTimeout(ensure,800);
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
})();