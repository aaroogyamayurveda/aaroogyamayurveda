/* CRM1 Navigation Hardening v2: dashboard default + reliable topbar module routing after hard refresh. */
(function(){
  'use strict';
  var interacted=false, started=false;
  function q(s){return document.querySelector(s)}
  function dashboardButton(){
    var nav=q('#nav');
    if(!nav)return null;
    return Array.prototype.find.call(nav.querySelectorAll('button'),function(b){
      return /dashboard/i.test(String(b.textContent||'')) && !b.closest('#crm1TopNav');
    })||null;
  }
  function goDashboard(){
    if(interacted)return;
    var page=document.querySelector('.main .page.active');
    if(page&&page.id==='dashboard')return;
    var b=dashboardButton();
    if(b)b.dispatchEvent(new MouseEvent('click',{bubbles:true,cancelable:true,view:window}));
  }
  function markInteraction(e){
    var el=e.target;
    if(!(el instanceof Element))return;
    if(el.closest('#crm1TopNav')||el.closest('#nav')||el.closest('#crm1ViewBtn')||el.closest('#crm1SidebarToggle')){
      if(el.closest('#crm1TopNav .crm1-topnav-trigger'))return;
      if(el.closest('#crm1ViewMenu'))return;
      interacted=true;
    }
  }
  function routeTopbar(e){
    var el=e.target;
    if(!(el instanceof Element))return;
    var b=el.closest('#crm1TopNav .crm1-topnav-menu button[data-orig-id]');
    if(!b)return;
    var orig=document.getElementById(b.dataset.origId);
    if(!orig)return;
    e.preventDefault();
    e.stopImmediatePropagation();
    interacted=true;
    orig.dispatchEvent(new MouseEvent('click',{bubbles:true,cancelable:true,view:window}));
  }
  function init(){
    if(started)return;started=true;
    document.addEventListener('pointerdown',markInteraction,true);
    document.addEventListener('click',routeTopbar,true);
    [300,1000,2200,3500].forEach(function(ms){setTimeout(goDashboard,ms)});
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
