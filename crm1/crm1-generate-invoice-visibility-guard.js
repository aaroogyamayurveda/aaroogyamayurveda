/* CRM1 Generate Invoice visibility guard: prevents startup navigation reconciliation from
   immediately replacing the invoice workspace after the user opens it. */
(function(){
  'use strict';
  if(window.__crm1GenerateInvoiceVisibilityGuard)return;
  window.__crm1GenerateInvoiceVisibilityGuard=true;

  var PAGE='crm1GenerateInvoicePage', NAV='crm1GenerateInvoiceNav';
  var opened=false;

  function page(){return document.getElementById(PAGE)}
  function nav(){return document.getElementById(NAV)}

  function activate(){
    var p=page();
    if(!p)return;
    document.querySelectorAll('.main .page').forEach(function(x){x.classList.remove('active')});
    p.classList.add('active');
    opened=true;
  }

  function bind(){
    var b=nav();
    if(b&&!b.dataset.crm1InvoiceGuardBound){
      b.dataset.crm1InvoiceGuardBound='1';
      b.addEventListener('click',function(){opened=true;activate()},{capture:true});
    }
  }

  function boot(){
    bind();
    var observer=new MutationObserver(function(){
      bind();
      if(!opened)return;
      var p=page();
      if(p&&!p.classList.contains('active'))activate();
    });
    observer.observe(document.body,{childList:true,subtree:true,attributes:true,attributeFilter:['class']});
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});
  else boot();
})();
