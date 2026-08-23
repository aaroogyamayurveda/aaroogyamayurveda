/* CRM1 advanced module bootstrap: non-blocking stable loader with startup main-view staging. */
(function(){
  'use strict';
  var started=false;
  if(started)return;started=true;
  /* Hide only the main content briefly while the authoritative navigation layer
     selects Dashboard. This prevents transient Manager Reports/other page flicker,
     while leaving the sidebar/topbar visible. */
  (function stageMain(){
    var styleId='crm1StartupMainStage';
    if(document.getElementById(styleId))return;
    var st=document.createElement('style');st.id=styleId;st.textContent='.main.crm1-startup-staged{visibility:hidden!important}';
    (document.head||document.documentElement).appendChild(st);
    function apply(){var m=document.querySelector('.main');if(m)m.classList.add('crm1-startup-staged')}
    function release(force){var m=document.querySelector('.main');if(!m)return false;var dash=m.querySelector('#dashboard.active');if(dash||force){m.classList.remove('crm1-startup-staged');var s=document.getElementById(styleId);if(s)s.remove();return true}return false}
    if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',apply,{once:true});else apply();
    var tries=0,t=setInterval(function(){tries++;if(release(false)||tries>=20){clearInterval(t);release(true)}},50);
  })();
  function load(src,timeout){return new Promise(function(resolve){var done=false,s=document.createElement('script'),tm=setTimeout(function(){if(done)return;done=true;console.warn('CRM1 module timeout:',src);resolve(false)},timeout||8000);function finish(ok){if(done)return;done=true;clearTimeout(tm);resolve(ok)}s.src=src;s.async=false;s.onload=function(){finish(true)};s.onerror=function(){console.error('CRM1 module failed:',src);finish(false)};document.head.appendChild(s)})}
  var modules=[
    './advanced-business-layer.core.js',
    './crm1-followup-verification-fix.js',
    './crm1-pin-auto-assignment.js?v=1',
    './crm1-followups-queue-fix.js',
    './crm1-followup-customer-context-fix.js?v=2',
    './crm1-agent-workspace.js',
    './crm1-call-console.js?v=2',
    './crm1-call-disposition.js',
    './crm1-call-conversion-finalizer.js?v=1',
    './crm1-lead-call-bridge.js',
    './crm1-lead-workqueue.js',
    './crm1-telephony-bridge-readiness.js',
    './crm1-workforce-runtime.js?v=2',
    './crm1-workforce-ui-bridge.js?v=2',
    './crm1-followup-lead-status-sync.js?v=1',
    './crm1-order-assignment-verification-guard.js?v=1',
    './crm1-manager-reports.js?v=1',
    './crm1-order-timeline.js?v=4',
    './crm1-delivery-workflow.js?v=2',
    './crm1-agent-performance-detailed.js?v=2',
    './crm1-advanced-reports-detailed.js?v=1',
    './crm1-pin-rules-detailed.js?v=1',
    './crm1-inventory-detailed.js?v=1',
    './crm1-qa-detailed-v6.js?v=6',
    './crm1-production-suite.js?v=1',
    './crm1-production-suite-retry-v2.js?v=1',
    './crm1-render-stability.js?v=4',
    './crm1-navigation-ui-v8.js?v=2',
    './crm1-ist-ops-fix-v3.js?v=4'
  ];
  (async function(){for(var i=0;i<modules.length;i++)await load(modules[i],7000);window.crm1AdvancedReady=true})();
})();
