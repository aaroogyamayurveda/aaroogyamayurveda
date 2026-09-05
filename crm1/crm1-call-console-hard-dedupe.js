/* CRM1 hard call-console dedupe: continuously enforce unique call-control IDs after late renderers finish. */
(function(){
  'use strict';
  if(window.__crm1CallConsoleHardDedupe) return;
  window.__crm1CallConsoleHardDedupe=true;

  var ids=['crm1StartCall','crm1EndCall','crm1DialNumber','crm1LogCall'];
  var busy=false;

  function removeNode(node){
    if(!node || !node.parentNode) return;
    var host=node.closest && node.closest('#crm1TelephonyBar');
    if(host && host.id!=='crm1CallConsole') host.remove();
    else node.remove();
  }

  function enforce(){
    if(busy || !document.querySelectorAll) return;
    busy=true;
    try{
      var canonical=document.getElementById('crm1CallConsole');
      ids.forEach(function(id){
        var nodes=Array.prototype.slice.call(document.querySelectorAll('[id="'+id+'"]'));
        if(nodes.length<2) return;
        var keep=canonical ? nodes.find(function(n){return canonical.contains(n);}) : nodes[0];
        keep=keep||nodes[0];
        nodes.forEach(function(n){if(n!==keep) removeNode(n);});
      });
    }finally{busy=false;}
  }

  function boot(){
    enforce();
    var observer=new MutationObserver(function(){enforce();});
    observer.observe(document.documentElement,{childList:true,subtree:true});
    setInterval(enforce,1000);
  }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',boot,{once:true});
  else boot();
})();
