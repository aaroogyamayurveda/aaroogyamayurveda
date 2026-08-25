/* CRM1 partner page lock: prevents non-partner renderers from replacing Dealer/Courier Orders. */
(function(){
'use strict';
if(window.__crm1PartnerPageLock)return;window.__crm1PartnerPageLock=true;
function role(){var p=window.currentProfile||window.profile||window.crmProfile||{};return String(p.role||window.currentRole||'').toLowerCase();}
function partner(){var r=role();return r==='dealer'||r==='courier'||r==='courier_manager';}
function active(){return document.querySelector('.page.active');}
function isPartnerOrders(p){if(!p)return false;var id=(p.id||'').toLowerCase();var h=(p.querySelector('h1,h2,h3')||{}).textContent||'';return /dealer.*order|courier.*order/.test(id+' '+h.toLowerCase());}
function authoritative(p){return !!p.querySelector('[data-crm1-partner-orders="1"]');}
var restoring=false;
var mo=new MutationObserver(function(){
 if(!partner()||restoring)return;var p=active();if(!isPartnerOrders(p))return;
 if(!authoritative(p)){restoring=true;window.__crm1PartnerOrdersLocked=true;setTimeout(function(){restoring=false;window.dispatchEvent(new CustomEvent('crm1:partner-orders-restore'));},0);}
});
function start(){mo.observe(document.documentElement,{subtree:true,childList:true});window.addEventListener('crm1:partner-orders-restore',function(){var b=document.querySelector('#nav button[data-page="dealer-orders"],#nav button[data-page="courier-orders"]');if(b)b.dispatchEvent(new Event('click'));});}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start);else start();
})();
