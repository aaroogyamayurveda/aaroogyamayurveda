/* CRM1 Production Suite late-mount helper v2. Settlement page is owned by the IST operations renderer and must not trigger a second production-suite mount. */
(function(){'use strict';
var busy=false;
var ROOTS=['crm1ManualPhoneQueueRoot','crm1ProductionCommandRoot','crm1DeliveryOpsRoot','crm1InventoryHardeningRoot','crm1LeadToOrderRoot'];
function needsMount(){
  return (!!document.getElementById('crm1W2Queue')&&!document.getElementById('crm1ManualPhoneQueueRoot')) ||
         (!!document.getElementById('crm1W2Manager')&&!document.getElementById('crm1ProductionCommandRoot')) ||
         (!!document.getElementById('timeline')&&!document.getElementById('crm1DeliveryOpsRoot')) ||
         (!!document.getElementById('inventory')&&!document.getElementById('crm1InventoryHardeningRoot')) ||
         (!!document.getElementById('crmLeadManager')&&!document.getElementById('crm1LeadToOrderRoot'));
}
function resetRoots(){ROOTS.forEach(function(id){var e=document.getElementById(id);if(e)e.remove()});var m=document.getElementById('crm1ProdModal');if(m)m.remove();busy=false}
function load(){if(busy||!needsMount())return;busy=true;var s=document.createElement('script');s.src='./crm1-production-suite.js?v=1.1';s.async=false;s.onload=s.onerror=function(){setTimeout(function(){busy=false},250)};document.head.appendChild(s)}
function start(){[300,900,1800,3200,5000].forEach(function(ms){setTimeout(load,ms)});if(window.sb?.auth){window.sb.auth.onAuthStateChange(function(event,session){if(event==='SIGNED_OUT'){resetRoots();return}if(event==='SIGNED_IN'&&session)[150,500,1200,2200,4000].forEach(function(ms){setTimeout(load,ms)});});}}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
})();
