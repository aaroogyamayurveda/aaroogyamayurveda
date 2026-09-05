/* CRM1 call-console duplicate guard: keep the canonical modern call console and remove legacy duplicate controls. */
(function(){
  'use strict';
  if(window.__crm1CallConsoleDuplicateGuard) return;
  window.__crm1CallConsoleDuplicateGuard=true;

  var ids=['crm1StartCall','crm1EndCall','crm1DialNumber','crm1LogCall'];
  var running=false;

  function canonical(){return document.getElementById('crm1CallConsole');}

  function removeLegacy(el){
    if(!el || !el.parentNode) return;
    var host=el.closest('#crm1TelephonyBar');
    if(host && host.id!=='crm1CallConsole'){host.remove();return;}
    el.remove();
  }

  function dedupe(){
    if(running) return;
    var keep=canonical();
    var found=false;
    ids.forEach(function(id){
      var nodes=Array.prototype.slice.call(document.querySelectorAll('[id="'+id+'"]'));
      if(nodes.length<2) return;
      found=true;
      if(keep){
        nodes.forEach(function(node){
          if(!keep.contains(node)) removeLegacy(node);
        });
      } else {
        nodes.slice(1).forEach(removeLegacy);
      }
    });
    return found;
  }

  function run(){
    if(running) return;
    running=true;
    try{dedupe();}finally{running=false;}
  }

  function boot(){
    run();
    var target=document.documentElement;
    if(!target) return;
    new MutationObserver(function(){
      if(window.requestAnimationFrame) window.requestAnimationFrame(run); else setTimeout(run,0);
    }).observe(target,{childList:true,subtree:true});
  }

  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',boot,{once:true});
  else boot();
})();
