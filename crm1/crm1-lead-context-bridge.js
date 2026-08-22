/* CRM1 <- CRM2 assigned-lead context bridge. */
(function(){
  'use strict';
  const storageKey='crm2_active_lead_data';
  const sleep=ms=>new Promise(r=>setTimeout(r,ms));
  function readContext(){
    try{
      const stored=sessionStorage.getItem(storageKey);
      if(stored){const x=JSON.parse(stored);if(x&&x.mobile)return x;}
    }catch{}
    try{
      const raw=new URLSearchParams(location.search).get('crm2_ctx');
      if(raw){
        const decoded=decodeURIComponent(escape(atob(raw.replace(/-/g,'+').replace(/_/g,'/'))));
        const x=JSON.parse(decoded);if(x&&x.mobile)return x;
      }
    }catch{}
    return null;
  }
  function findCreateOrderNav(){
    const els=[...document.querySelectorAll('button,a,[role="button"]')];
    return els.find(el=>/create\s*order|new\s*order|\+\s*create/i.test((el.textContent||'').trim()));
  }
  async function openCreateOrder(){
    const page=document.getElementById('createOrderPage');
    if(page){
      document.querySelectorAll('.page').forEach(x=>x.classList.remove('active'));
      page.classList.add('active');
      page.scrollIntoView({block:'start'});
      return true;
    }
    const nav=findCreateOrderNav();
    if(nav){nav.click();await sleep(400);return true;}
    return false;
  }
  async function setValue(el,value){
    if(!el||value==null)return;
    el.value=String(value);
    el.dispatchEvent(new Event('input',{bubbles:true}));
    el.dispatchEvent(new Event('change',{bubbles:true}));
  }
  async function chooseProduct(name){
    if(!name)return;
    const sel=document.getElementById('pageProduct');
    if(!sel)return;
    for(let i=0;i<30;i++){
      const opt=[...sel.options].find(o=>String(o.textContent||'').trim().toLowerCase().includes(String(name).trim().toLowerCase()));
      if(opt){sel.value=opt.value;sel.dispatchEvent(new Event('change',{bubbles:true}));return;}
      await sleep(200);
    }
  }
  async function applyContext(){
    const lead=readContext();
    if(!lead)return false;
    for(let i=0;i<40;i++){
      if(document.getElementById('createOrderPage')||findCreateOrderNav())break;
      await sleep(250);
    }
    let opened=false;
    for(let i=0;i<20&&!opened;i++){opened=await openCreateOrder();if(!opened)await sleep(250);}
    if(!opened)return false;
    for(let i=0;i<30;i++){
      if(document.querySelector('#createOrderPage input[name="customer_name"]')&&document.getElementById('pageMobile'))break;
      await sleep(200);
    }
    const map={
      customer_name:document.querySelector('#createOrderPage input[name="customer_name"]'),
      mobile:document.getElementById('pageMobile'),
      pincode:document.getElementById('orderPincode'),
      address:document.querySelector('#createOrderPage textarea[name="address"]')
    };
    await setValue(map.customer_name,lead.customer_name||'');
    await setValue(map.mobile,lead.mobile||'');
    await setValue(map.pincode,lead.pincode||'');
    await setValue(map.address,lead.address||'');
    await chooseProduct(lead.product_name||'');
    let badge=document.getElementById('crm2LeadContextBadge');
    if(!badge){
      badge=document.createElement('div');
      badge.id='crm2LeadContextBadge';
      badge.style.cssText='margin:0 0 14px;padding:12px 14px;border-radius:10px;background:#edf5ea;color:#164b30;border:1px solid #d8e7d3;font-size:13px;font-weight:700;';
      const form=document.getElementById('createOrderPageForm');if(form)form.insertBefore(badge,form.firstChild);
    }
    badge.textContent=`CRM2 Assigned Lead • ${lead.mobile||''}${lead.customer_name?` • ${lead.customer_name}`:''}${lead.product_name?` • ${lead.product_name}`:''}`;
    sessionStorage.removeItem(storageKey);
    sessionStorage.removeItem('crm2_active_lead');
    return true;
  }
  let tries=0;
  async function bootBridge(){
    const lead=readContext();
    if(!lead)return;
    while(tries++<80){
      try{if(await applyContext())return;}catch(e){console.error('CRM2 lead context bridge failed',e);}
      await sleep(250);
    }
  }
  window.addEventListener('load',()=>setTimeout(bootBridge,150));
  setTimeout(bootBridge,500);
})();