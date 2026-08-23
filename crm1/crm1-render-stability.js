/* CRM1 universal render-stability guard v4.
   Advanced pages owned by isolated renderers are not managed by this guard.
*/
(function(){
  'use strict';
  var ROOTS={
    timeline:['timelineContent','crm1OrderTimelineResult'],
    agentPerformance:['agentPerformanceContent','crm1AgentPerfRoot'],
    partnerPerformance:['partnerPerformanceContent','crm1PPFinalRoot'],
    advancedReports:['advancedReportsContent','crm1ARDetailedRoot'],
    inventory:['inventoryContent','crm1InventoryDetailedRoot'],
    pinRules:['pinRulesContent','crm1PinDetailedRoot'],
    crm1QAV6Page:['crm1QAV6Root'],
    qa:['crm1QAV6Root','crm1QADetailedRoot']
  };
  var LABEL_TO_PAGE={
    'order timeline':'timeline','agent performance':'agentPerformance',
    'delivery partners':'partnerPerformance','delivery partners performance':'partnerPerformance',
    'advanced reports':'advancedReports','inventory':'inventory','pin auto assignment':'pinRules',
    'qa & dispositions':'crm1QAV6Page','qa dispositions':'crm1QAV6Page'
  };
  function pageRoot(id){return document.getElementById(id)}
  function hasRoot(page){var ids=ROOTS[page.id]||[];for(var i=0;i<ids.length;i++)if(document.getElementById(ids[i]))return true;return false}
  function message(page){var m=page.querySelector(':scope > .crm1-stability-loading');if(m)return m;m=document.createElement('div');m.className='crm1-stability-loading';m.innerHTML='<div class="panel"><div style="text-align:center;color:#69756e;padding:18px">Loading…</div></div>';page.appendChild(m);return m}
  function hideLegacy(page){if(!page)return;page.dataset.crm1StabilityHidden='1';Array.prototype.forEach.call(page.children,function(ch){if(!ch.classList.contains('crm1-stability-loading')){if(ch.dataset.crm1PrevDisplay==null)ch.dataset.crm1PrevDisplay=ch.style.display||'';ch.style.visibility='hidden'}});message(page).style.visibility='visible'}
  function reveal(page){if(!page)return;Array.prototype.forEach.call(page.children,function(ch){if(ch.classList.contains('crm1-stability-loading'))ch.remove();else ch.style.visibility=''});delete page.dataset.crm1StabilityHidden}
  function stage(page){if(!page||!page.classList.contains('active')||!ROOTS[page.id])return;if(hasRoot(page))reveal(page);else hideLegacy(page)}
  function scan(){Object.keys(ROOTS).forEach(function(id){var p=pageRoot(id);if(p)stage(p)})}
  function normalizeLabel(v){return String(v||'').replace(/[\s📊📈📦🤝🤖🎧📍🛵]/g,' ').replace(/\s+/g,' ').trim().toLowerCase()}
  function preStageFromButton(btn){if(!btn)return;var label=normalizeLabel(btn.textContent),pageId=null;Object.keys(LABEL_TO_PAGE).some(function(key){if(label.indexOf(key)!==-1){pageId=LABEL_TO_PAGE[key];return true}return false});if(pageId){var page=pageRoot(pageId);if(page)hideLegacy(page)}}
  function bindNavigationPreStage(){if(document.documentElement.dataset.crm1StabilityNavBound==='4')return;document.documentElement.dataset.crm1StabilityNavBound='4';document.addEventListener('click',function(e){var btn=e.target.closest&&e.target.closest('#nav button');if(btn)preStageFromButton(btn)},true)}
  function start(){var main=document.querySelector('.main');if(!main)return;bindNavigationPreStage();var observer=new MutationObserver(function(){scan()});observer.observe(main,{subtree:true,childList:true,attributes:true,attributeFilter:['class']});scan();window.crm1RenderStabilityReady=true}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
})();