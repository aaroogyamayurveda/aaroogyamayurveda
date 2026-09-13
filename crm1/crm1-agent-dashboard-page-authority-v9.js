/* CRM1 Agent Dashboard page authority v9. */
(function(){'use strict';
if(window.__crm1AgentDashboardPageAuthorityV9)return;window.__crm1AgentDashboardPageAuthorityV9=true;
function isAgent(){return String(window.profile&&window.profile.role||'').toLowerCase()==='agent'}
function dashboard(){return document.getElementById('dashboard')}
function enforce(){if(!isAgent())return;var d=dashboard(),body=document.getElementById('dashboardOrdersBody');if(!d||!body)return;var activeNav=document.querySelector('#nav button.active');var dashboardSelected=!!(activeNav&&/dashboard/i.test(activeNav.textContent||''));if(dashboardSelected&&!d.classList.contains('active')){document.querySelectorAll('.page').forEach(function(p){p.classList.remove('active')});d.classList.add('active');window.scrollTo(0,0)}body.style.visibility='visible';body.style.display='table-row-group'}
function boot(){document.addEventListener('click',function(e){var b=e.target.closest&&e.target.closest('#nav button');if(b&&/dashboard/i.test(b.textContent||'')&&isAgent())setTimeout(enforce,0)},true);var n=document.getElementById('nav');if(n)new MutationObserver(enforce).observe(n,{childList:true,subtree:true,attributes:true,attributeFilter:['class']});var d=dashboard();if(d)new MutationObserver(enforce).observe(d,{attributes:true,attributeFilter:['class','style']});setInterval(enforce,300);enforce()}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
