/* CRM1 universal render-stability guard.
   Legacy shell pages remain in the DOM for compatibility, while newer JS modules
   replace their content after activation. Never expose the legacy placeholder
   during that hand-off: stage professional pages until their module root exists.
*/
(function(){
  'use strict';

  var ROOTS={
    timeline:['timelineContent','crm1OrderTimelineResult'],
    agentPerformance:['agentPerformanceContent','crm1AgentPerfRoot'],
    partnerPerformance:['partnerPerformanceContent','crm1PPFinalRoot'],
    advancedReports:['advancedReportsContent','crm1ARDetailedRoot'],
    settlements:['settlementsContent','crm1SettDetailedRoot'],
    inventory:['inventoryContent','crm1InventoryDetailedRoot'],
    pinRules:['pinRulesContent','crm1PinDetailedRoot'],
    crm1QAV6Page:['crm1QAV6Root'],
    qa:['crm1QAV6Root','crm1QADetailedRoot']
  };

  var pending=new WeakMap();

  function pageRoot(id){return document.getElementById(id);}
  function hasRoot(page){
    var ids=ROOTS[page.id]||[];
    return ids.some(function(id){return document.getElementById(id)});
  }
  function message(page){
    var m=page.querySelector(':scope > .crm1-stability-loading');
    if(m)return m;
    m=document.createElement('div');
    m.className='crm1-stability-loading';
    m.innerHTML='<div class="panel"><div style="text-align:center;color:#69756e;padding:18px">Loading…</div></div>';
    page.appendChild(m);
    return m;
  }
  function hideLegacy(page){
    if(page.dataset.crm1StabilityHidden==='1')return;
    page.dataset.crm1StabilityHidden='1';
    Array.prototype.forEach.call(page.children,function(ch){
      if(!ch.classList.contains('crm1-stability-loading'))ch.dataset.crm1PrevDisplay=ch.style.display||'';
      if(!ch.classList.contains('crm1-stability-loading'))ch.style.visibility='hidden';
    });
    message(page).style.visibility='visible';
  }
  function reveal(page){
    if(page.dataset.crm1StabilityHidden!=='1')return;
    Array.prototype.forEach.call(page.children,function(ch){
      if(ch.classList.contains('crm1-stability-loading'))ch.remove();
      else ch.style.visibility='';
    });
    delete page.dataset.crm1StabilityHidden;
  }
  function stage(page){
    if(!page||!page.classList.contains('active'))return;
    if(!ROOTS[page.id])return;
    if(hasRoot(page))reveal(page);
    else hideLegacy(page);
  }
  function scan(){
    Object.keys(ROOTS).forEach(function(id){
      var p=pageRoot(id);if(p)stage(p);
    });
  }

  function start(){
    var main=document.querySelector('.main');
    if(!main)return;
    var observer=new MutationObserver(function(mutations){
      var needs=false;
      mutations.forEach(function(m){
        if(m.type==='attributes'&&m.attributeName==='class')needs=true;
        if(m.type==='childList')needs=true;
      });
      if(!needs)return;
      scan();
    });
    observer.observe(main,{subtree:true,childList:true,attributes:true,attributeFilter:['class']});
    scan();
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});
  else start();
})();
