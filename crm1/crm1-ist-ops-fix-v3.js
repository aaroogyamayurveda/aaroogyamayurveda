/* CRM1 IST Operations wrapper v3. Loads the stable IST renderer once, then only normalizes the Delivery Partners Performance label. */
(function(){
  'use strict';
  if(window.__crm1IstOpsV3)return;
  window.__crm1IstOpsV3=true;
  var loaded=false;
  function labelFix(){
    var p=document.getElementById('partnerPerformance');
    if(p){
      var h=p.querySelector('.title h2');
      if(h)h.textContent='Delivery Partners Performance';
      var s=p.querySelector('.title .sub');
      if(s)s.textContent='Dealer and courier performance and SLA';
    }
    document.querySelectorAll('#nav button').forEach(function(b){
      var t=String(b.textContent||'').toLowerCase();
      if(t.indexOf('delivery partners')!==-1&&t.indexOf('performance')===-1)b.textContent='🤝 Delivery Partners Performance';
    });
  }
  function load(){
    if(loaded)return;
    loaded=true;
    var s=document.createElement('script');
    s.src='./crm1-ist-ops-fix.js?v=3';
    s.async=false;
    s.onload=function(){setTimeout(labelFix,50);setTimeout(labelFix,500)};
    s.onerror=function(){console.error('CRM1 IST operations module failed to load')};
    document.head.appendChild(s);
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',load,{once:true});else load();
  if(window.MutationObserver){
    var o=new MutationObserver(labelFix);
    o.observe(document.body,{childList:true,subtree:true,attributes:true,attributeFilter:['class']});
  }
})();
