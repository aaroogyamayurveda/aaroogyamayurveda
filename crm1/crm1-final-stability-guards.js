/* CRM1 final stability guards v2: workforce navigation + dashboard filters + report/partner visibility. */
(function(){
'use strict';
if(window.__crm1FinalStabilityGuardsV2)return;
window.__crm1FinalStabilityGuardsV2=true;
var wantedWorkforce=null;
function activatePage(id){
 var p=document.getElementById(id);if(!p)return false;
 document.querySelectorAll('.page').forEach(function(el){el.classList.remove('active');});
 p.classList.add('active');
 document.querySelectorAll('#nav button').forEach(function(b){b.classList.remove('active');});
 var b=document.getElementById('crm1W2Nav_'+id);if(b)b.classList.add('active');
 return true;
}
function monthInputs(){
 var type=document.getElementById('dashFilterType'),from=document.getElementById('dashFilterFrom'),to=document.getElementById('dashFilterTo');
 if(!type||!from||!to)return;
 var v=String(type.value||'day');
 if(v==='month'){if(from.type!=='month')from.type='month';if(to.type!=='month')to.type='month'}
 else if(v==='year'){if(from.type!=='number')from.type='number';if(to.type!=='number')to.type='number'}
 else{if(from.type!=='date')from.type='date';if(to.type!=='date')to.type='date'}
}
function wireWorkforceButton(b,id){
 if(!b)return;
 b.classList.remove('crm1-role-v6-hide');b.style.removeProperty('display');b.style.removeProperty('visibility');
 if(b.dataset.crm1HardWired==='1')return;
 b.dataset.crm1HardWired='1';
 b.onclick=function(e){if(e)e.preventDefault();wantedWorkforce=id;var fn=window.crm1WorkforceOpenPage;if(typeof fn==='function')fn(id);activatePage(id);setTimeout(function(){activatePage(id)},30);setTimeout(function(){activatePage(id)},150);setTimeout(function(){activatePage(id)},500);return false;};
}
function workforceNav(){
 var nav=document.getElementById('nav');if(!nav)return;
 ['crm1W2Manager','crm1W2Import','crm1W2Assignment','crm1W2Queue'].forEach(function(id){wireWorkforceButton(document.getElementById('crm1W2Nav_'+id),id)});
 if(wantedWorkforce&&document.getElementById(wantedWorkforce))activatePage(wantedWorkforce);
}
function reportVisibility(){
 var p=document.getElementById('advancedReports'),root=document.getElementById('crm1ARDetailedRoot');
 if(p&&p.classList.contains('active')&&root){root.style.display='block';root.style.visibility='visible';root.style.opacity='1';}
}
function partnerVisibility(){
 var pages=document.querySelectorAll('.page');
 pages.forEach(function(p){var h=p.querySelector('#crm1PartnerOrdersFinal');if(h&&p.classList.contains('active')){h.style.display='block';h.style.visibility='visible';h.style.opacity='1';}});
}
function run(){monthInputs();workforceNav();reportVisibility();partnerVisibility();}
function boot(){
 run();
 document.addEventListener('change',run,true);
 document.addEventListener('click',function(){setTimeout(run,20);setTimeout(run,200)},true);
 new MutationObserver(function(){setTimeout(run,0)}).observe(document.documentElement,{childList:true,subtree:true});
 setInterval(run,500);
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
