/* CRM1 partner navigation authority: Dealer/Courier get Orders + Settlements + Advanced Reports + Notifications only. */
(function(){
  'use strict';
  if(window.__crm1PartnerNavAuthorityV3)return;
  window.__crm1PartnerNavAuthorityV3=true;
  var restricted=/^(?:.*\b)?order timeline(?:\b.*)?$|^(?:.*\b)?conversion workbench(?:\b.*)?$/i;
  function text(el){return String(el&&el.textContent||'').replace(/\s+/g,' ').trim();}
  function role(){
    var r=String((window.profile||window.currentProfile||window.crmProfile||{}).role||'').toLowerCase();
    if(r==='courier')r='courier_manager';
    if(r==='dealer'||r==='courier_manager')return r;
    var nav=document.getElementById('nav');
    var n=String(nav&&nav.textContent||'').toLowerCase();
    if(n.indexOf('dealer orders')>=0)return 'dealer';
    if(n.indexOf('courier orders')>=0)return 'courier_manager';
    return '';
  }
  function openPage(id){
    var target=document.getElementById(id);
    if(!target)return false;
    document.querySelectorAll('.main .page').forEach(function(p){p.classList.remove('active');});
    target.classList.add('active');
    document.querySelectorAll('#nav button').forEach(function(b){b.classList.remove('active');});
    var nav=document.getElementById('nav');
    if(nav){
      Array.prototype.forEach.call(nav.querySelectorAll('button'),function(b){
        var t=text(b);
        if((id==='advancedReports'&&/advanced reports/i.test(t))||(id==='settlements'&&/^.*settlements.*$/i.test(t)))b.classList.add('active');
      });
    }
    window.scrollTo(0,0);
    return true;
  }
  function removeRestricted(nav){
    if(!nav)return;
    Array.prototype.slice.call(nav.querySelectorAll('button,a,[role="button"]')).forEach(function(el){
      if(restricted.test(text(el)))el.remove();
    });
  }
  function bindButton(b,id,mark){
    if(!b)return;
    if(b.dataset.crm1PartnerBound===mark)return;
    b.dataset.crm1PartnerBound=mark;
    b.onclick=function(e){
      e.preventDefault();
      e.stopPropagation();
      openPage(id);
    };
  }
  function ensureSingle(nav,pattern,id,mark,label){
    if(!nav)return;
    var found=Array.prototype.filter.call(nav.querySelectorAll('button'),function(b){return pattern.test(text(b));});
    if(!found.length){
      var b=document.createElement('button');
      b.type='button';
      b.textContent=label;
      b.dataset.crm1PartnerNav='1';
      nav.appendChild(b);
      found=[b];
    }
    bindButton(found[0],id,mark);
    found.slice(1).forEach(function(b){b.remove();});
  }
  function enforce(){
    if(!role())return;
    var nav=document.getElementById('nav');
    if(!nav)return;
    removeRestricted(nav);
    ensureSingle(nav,/advanced reports/i,'advancedReports','advanced-v3','📈 Advanced Reports');
    ensureSingle(nav,/settlements/i,'settlements','settlements-v3','💰 Settlements');
  }
  function boot(){
    var nav=document.getElementById('nav');
    if(nav)new MutationObserver(function(){enforce();}).observe(nav,{childList:true,subtree:true,characterData:true});
    enforce();
    if(window.sb&&window.sb.auth)window.sb.auth.onAuthStateChange(function(){setTimeout(enforce,0);});
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
