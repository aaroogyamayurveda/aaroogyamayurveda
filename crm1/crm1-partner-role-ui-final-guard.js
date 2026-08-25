/* CRM1 partner role UI final guard.
   Runs last so secondary navigation/renderers cannot restore restricted UI. */
(function(){
  'use strict';
  if(window.__crm1PartnerRoleUiFinalGuard)return;
  window.__crm1PartnerRoleUiFinalGuard=true;

  function text(x){return String(x==null?'':x).replace(/\s+/g,' ').trim().toLowerCase();}
  function roleNow(){
    var r=text(window.profile&&window.profile.role);
    if(r==='dealer'||r==='courier_manager')return r;
    var nav=document.getElementById('nav');
    var n=text(nav&&nav.textContent);
    if(n.indexOf('dealer orders')>=0)return 'dealer';
    if(n.indexOf('courier orders')>=0)return 'courier_manager';
    return '';
  }
  function isPartner(){return !!roleNow();}
  function hide(el){if(!el)return;el.classList.add('hidden');el.setAttribute('aria-hidden','true');el.style.setProperty('display','none','important');}
  function buttonLabel(el){return text((el&&el.textContent)||'');}
  function restricted(t){return t==='order timeline'||t.indexOf('order timeline')>=0||t==='conversion workbench'||t.indexOf('conversion workbench')>=0;}

  function enforce(){
    if(!isPartner())return;
    var nav=document.getElementById('nav');
    if(nav){
      Array.prototype.slice.call(nav.querySelectorAll('button,a,[role="button"]')).forEach(function(el){
        if(restricted(buttonLabel(el)))el.remove();
      });
    }
    ['timeline','conversionWorkbench'].forEach(function(id){hide(document.getElementById(id));});
    var settlements=document.getElementById('settlements');
    if(settlements){
      settlements.querySelectorAll('[data-crm1-settlement-generate="1"]').forEach(hide);
      Array.prototype.slice.call(settlements.querySelectorAll('.panel,section,div')).forEach(function(el){
        if(/^generate settlement\b/.test(buttonLabel(el)))hide(el);
      });
    }
  }

  function boot(){
    enforce();
    var nav=document.getElementById('nav');
    if(nav){
      new MutationObserver(function(){enforce();}).observe(nav,{childList:true,subtree:true,characterData:true});
    }
    var main=document.querySelector('main.main')||document.body;
    new MutationObserver(function(){enforce();}).observe(main,{childList:true,subtree:true});
    var tries=0;
    var timer=setInterval(function(){enforce();if(++tries>=120)clearInterval(timer);},250);
    document.addEventListener('click',function(){setTimeout(enforce,0);},true);
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
