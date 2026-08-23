/* CRM1 QA watchdog: keep detailed QA renderer authoritative after navigation/base-layer refreshes. */
(function(){
  'use strict';
  var tick=null,clickTimer=null;
  function page(){return document.getElementById('qa')}
  function root(){return document.getElementById('crm1QADetailedRoot')}
  function boot(){
    var p=page();
    if(!p||!p.classList.contains('active'))return;
    if(root())return;
    if(typeof window.crm1EnsureQADetailed==='function'){
      try{window.crm1EnsureQADetailed();}catch(e){console.warn('QA ensure failed',e)}
      return;
    }
    var c=document.getElementById('qaContent');
    if(c){c.dispatchEvent(new CustomEvent('crm1QAForceRender'));}
  }
  function schedule(){clearTimeout(clickTimer);clickTimer=setTimeout(boot,80)}
  document.addEventListener('click',function(e){
    var b=e.target.closest('#nav button');
    if(b&&/QA.*Dispositions/i.test(String(b.textContent||''))){schedule();setTimeout(boot,250);setTimeout(boot,800);setTimeout(boot,1600)}
  },true);
  var obs=new MutationObserver(function(){var p=page();if(p&&p.classList.contains('active')&&!root())schedule()});
  function init(){
    var c=document.getElementById('qaContent');
    if(c)obs.observe(c,{childList:true,subtree:true});
    if(!tick)tick=setInterval(boot,250);
    schedule();
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
