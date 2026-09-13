/* CRM1 advanced module bootstrap: non-blocking ordered module injection. */
(function(){
'use strict';
var modules=['./crm1-supabase-runtime-init.js?v=1','./crm1-order-pdf-final.js?v=2','./crm1-partner-role-ui-final-guard.js?v=5','./crm1-nav-hidden-cleanup-final.js?v=1','./crm1-print-label-final.js?v=1','./crm1-call-console.js?v=4','./crm1-agent-workspace.js','./crm1-api-compat.js?v=1','./advanced-business-layer.core.js','./crm1-followup-verification-fix.js?v=3','./crm1-followups-queue-fix.js?v=3','./crm1-followup-customer-context-fix.js?v=3','./crm1-call-disposition.js','./crm1-followup-date-time-fix.js?v=1','./crm1-lead-call-bridge.js','./crm1-lead-workqueue.js','./crm1-telephony-bridge-readiness.js','./crm1-workforce-runtime.js?v=2','./crm1-workforce-ui-bridge.js?v=7','./crm1-followup-lead-status-sync.js?v=2','./crm1-order-assignment-verification-guard.js?v=1','./crm1-manager-reports.js?v=2','./crm1-order-timeline.js?v=4','./crm1-delivery-workflow.js?v=2','./crm1-agent-performance-detailed.js?v=2','./crm1-pin-rules-detailed.js?v=1','./crm1-inventory-detailed.js?v=1','./crm1-qa-detailed-v6.js?v=6','./crm1-production-suite.js?v=1','./crm1-production-suite-retry-v2.js?v=1','./crm1-render-stability.js?v=4','./crm1-navigation-ui-v8.js?v=6','./crm1-ist-ops-fix.js?v=6','./crm1-ist-ops-final-guard.js?v=4','./crm1-verification-followup-stability-final.js?v=5','./crm1-agent-dashboard-orders-scope-fix.js?v=9','./crm1-agent-order-search-customer-mobile-fix.js?v=1','./crm1-ui-preferences.js?v=2','./crm1-advanced-reports-detailed.js?v=8','./crm1-partner-settlements-final.js?v=2','./crm1-partner-nav-authority.js?v=3','./crm1-partner-role-ui-final-guard.js?v=4','./crm1-final-ui-integrity-watchdog.js?v=1'];
window.crm1AdvancedModulesLoading=true;
var index=0;
function next(){
 if(index>=modules.length){window.crm1AdvancedModulesLoading=false;return;}
 var src=modules[index++];
 if(document.querySelector('script[data-crm1-module="'+src+'"]')){next();return;}
 var s=document.createElement('script');
 s.src=src;s.async=false;s.dataset.crm1Module=src;
 s.onload=next;s.onerror=next;
 (document.head||document.documentElement).appendChild(s);
}
function boot(){next();}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
/* integration trigger: cache-bust v6 deployment after authoritative CRM1 fixes */