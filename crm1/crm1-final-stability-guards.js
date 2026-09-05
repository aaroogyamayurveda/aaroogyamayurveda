/* CRM1 final stability guards: month dashboard inputs + workforce queue navigation + partner/report visibility. */
(function(){
'use strict';
if(window.__crm1FinalStabilityGuards)return;
window.__crm1FinalStabilityGuards=true;
function monthInputs(){
 var type=document.getElementById('dashFilterType');
 var from=document.getElementById('dashFilterFrom'),to=document.getElementById('dashFilterTo');
 if(!type||!from||!to)return;
 var v=String(type.value||'day');
 if(v==='month'){if(from.type!=='month')from.type='month';if(to.type!=='month')to.type='month'}
 else if(v==='year'){if(from.type!=='number')from.type='number';if(to.type!=='number')to.type='number'}
 else{if(from.type!=='date')from.type='date';if(to.type!=='date')to.type='date'}
}
function activateQueue(p){if(!p)return;document.querySelectorAll('.page').forEach(function(el){el.classList.remove('active')});p.classList.add('active');document.querySelectorAll('#nav button').forEach(function(b){b.classList.remove('active')})}
function queueNav(){
 var nav=document.getElementById('nav');if(!nav)return;
 var p=document.getElementById('crm1W2Queue');
 var buttons=Array.from(nav.querySelectorAll('button'));
 var q=buttons.find(function(b){return /today.?s calling queue/i.test(String(b.textContent||''))});
 if(q){
  q.classList.remove('crm1-role-v6-hide');q.style.removeProperty('display');q.style.removeProperty('visibility');
  if(p)q.onclick=function(){activateQueue(p);if(window.crm1WorkforceOpenPage)window.crm1WorkforceOpenPage('crm1W2Queue')};
  return;
 }
 if(!p)return;
 var auth=window.sb&&window.sb.auth;if(!auth)return;
 auth.getUser().then(function(r){
  var u=r&&r.data&&r.data.user;if(!u)return;
  return window.sb.from('profiles').select('role').eq('id',u.id).maybeSingle().then(function(x){
   var role=String(x&&x.data&&x.data.role||'').toLowerCase();
   if(['agent','management','order_manager','super_admin'].indexOf(role)<0)return;
   if(nav.querySelector('[data-crm1-final-queue-nav]'))return;
   var b=document.createElement('button');b.type='button';b.textContent="📞 Today's Calling Queue";b.dataset.crm1FinalQueueNav='1';
   b.onclick=function(){activateQueue(p);if(window.crm1WorkforceOpenPage)window.crm1WorkforceOpenPage('crm1W2Queue')};nav.appendChild(b);
  });
 }).catch(function(){});
}
function reportVisibility(){var p=document.getElementById('advancedReports'),root=document.getElementById('crm1ARDetailedRoot');if(p&&p.classList.contains('active')&&root){root.style.display='block';root.style.visibility='visible';root.style.opacity='1'}}
function run(){monthInputs();queueNav();reportVisibility()}
function boot(){run();document.addEventListener('change',run,true);document.addEventListener('click',function(){setTimeout(run,30)},true);new MutationObserver(function(){run()}).observe(document.documentElement,{childList:true,subtree:true});setInterval(run,1000)}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
