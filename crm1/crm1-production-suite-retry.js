/* CRM1 Production Suite late-mount helper.
 * Re-runs the idempotent production suite after login/workforce pages are created.
 */
(function(){'use strict';
var busy=false;
function needsMount(){return !!document.getElementById('crm1W2Queue')&&!document.getElementById('crm1ManualPhoneQueueRoot') || !!document.getElementById('crm1W2Manager')&&!document.getElementById('crm1ProductionCommandRoot') || !!document.getElementById('timeline')&&!document.getElementById('crm1DeliveryOpsRoot') || !!document.getElementById('crm1SettStandalonePage')&&!document.getElementById('crm1SettlementControlRoot') || !!document.getElementById('inventory')&&!document.getElementById('crm1InventoryHardeningRoot') || !!document.getElementById('crmLeadManager')&&!document.getElementById('crm1LeadToOrderRoot')}
function load(){if(busy||!needsMount())return;busy=true;var s=document.createElement('script');s.src='./crm1-production-suite.js?v=1.1';s.async=false;s.onload=s.onerror=function(){setTimeout(function(){busy=false},250)};document.head.appendChild(s)}
function start(){[300,900,1800,3200,5000].forEach(function(ms){setTimeout(load,ms)});if(window.sb?.auth){window.sb.auth.onAuthStateChange(function(event,session){if(event==='SIGNED_IN'&&session)[200,700,1600,3000].forEach(function(ms){setTimeout(load,ms)});});}}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
})();