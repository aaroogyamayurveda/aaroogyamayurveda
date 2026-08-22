/* CRM1 <- CRM2 assigned-lead context bridge. Reads same-origin sessionStorage; no CRM2 auth required. */
(function(){
  'use strict';
  const key='crm2_active_lead_data';
  const parse=()=>{try{return JSON.parse(sessionStorage.getItem(key)||'null')}catch{return null}};
  const sleep=ms=>new Promise(r=>setTimeout(r,ms));
  async function setValue(el,value){if(!el||value==null||value==='')return;el.value=String(value);el.dispatchEvent(new Event('input',{bubbles:true}));el.dispatchEvent(new Event('change',{bubbles:true}));}
  function findCreateOrderNav(){
    const els=[...document.querySelectorAll('button,a,[role="button"]')];
    return els.find(el=>/create\s*order|new\s*order|\+\s*create/i.test((el.textContent||'').trim()));
  }
  async function openCreateOrder(){
    const nav=findCreateOrderNav();
    if(nav){nav.click();await sleep(250);return;}
    const page=document.getElementById('createOrderPage');
    if(page){document.querySelectorAll('.page').forEach(x=>x.classList.remove('active'));page.classList.add('active');page.scrollIntoView({block:'start'});}
  }
  async function chooseProduct(name){
    if(!name)return;
    const sel=document.getElementById('pageProduct');
    if(!sel)return;
    for(let i=0;i<12;i++){
      const opt=[...sel.options].find(o=>String(o.textContent||'').toLowerCase().includes(String(name).toLowerCase()));
      if(opt){sel.value=opt.value;sel.dispatchEvent(new Event('change',{bubbles:true}));return;}
      await sleep(250);
    }
  }
  async function applyContext(){
    const lead=parse();
    if(!lead)return;
    for(let i=0;i<20;i++){
      if(document.getElementById('createOrderPage')||findCreateOrderNav())break;
      await sleep(250);
    }
    await openCreateOrder();
    await sleep(250);
    const map={
      customer_name:document.querySelector('#createOrderPage input[name="customer_name"]'),
      mobile:document.querySelector('#pageMobile'),
      pincode:document.querySelector('#orderPincode'),
      address:document.querySelector('#createOrderPage textarea[name="address"]')
    };
    await setValue(map.customer_name,lead.customer_name);
    await setValue(map.mobile,lead.mobile);
    await setValue(map.pincode,lead.pincode);
    await setValue(map.address,lead.address);
    await chooseProduct(lead.product_name);
    let badge=document.getElementById('crm2LeadContextBadge');
    if(!badge){
      badge=document.createElement('div');badge.id='crm2LeadContextBadge';
      badge.style.cssText='margin:0 0 14px;padding:12px 14px;border-radius:10px;background:#edf5ea;color:#164b30;border:1px solid #d8e7d3;font-size:13px;font-weight:700;';
      const form=document.getElementById('createOrderPageForm');if(form)form.insertBefore(badge,form.firstChild);
    }
    badge.textContent=`CRM2 Assigned Lead • ${lead.mobile||''}${lead.product_name?` • ${lead.product_name}`:''}`;
    sessionStorage.removeItem(key);
    sessionStorage.removeItem('crm2_active_lead');
  }
  window.addEventListener('load',()=>setTimeout(()=>applyContext().catch(e=>console.error('CRM2 lead context bridge failed',e)),300));
  setTimeout(()=>applyContext().catch(()=>{}),1200);
})();