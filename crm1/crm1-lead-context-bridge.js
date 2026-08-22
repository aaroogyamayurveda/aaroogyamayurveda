/* CRM1 <- CRM2 assigned-lead context bridge. */
(function(){
  'use strict';
  const storageKey='crm2_active_lead_data';
  const POSTAL_API='https://api.postalpincode.in/pincode/';
  const sleep=ms=>new Promise(r=>setTimeout(r,ms));
  function readContext(){
    try{const stored=sessionStorage.getItem(storageKey);if(stored){const x=JSON.parse(stored);if(x&&x.mobile)return x;}}catch{}
    try{const raw=new URLSearchParams(location.search).get('crm2_ctx');if(raw){const decoded=decodeURIComponent(escape(atob(raw.replace(/-/g,'+').replace(/_/g,'/'))));const x=JSON.parse(decoded);if(x&&x.mobile)return x;}}catch{}
    return null;
  }
  function findCreateOrderNav(){return [...document.querySelectorAll('button,a,[role="button"]')].find(el=>/create\s*order|new\s*order|\+\s*create/i.test((el.textContent||'').trim()));}
  async function openCreateOrder(){const page=document.getElementById('createOrderPage');if(page){document.querySelectorAll('.page').forEach(x=>x.classList.remove('active'));page.classList.add('active');page.scrollIntoView({block:'start'});return true}const nav=findCreateOrderNav();if(nav){nav.click();await sleep(400);return true}return false;}
  async function setValue(el,value){if(!el||value==null)return;el.value=String(value);el.dispatchEvent(new Event('input',{bubbles:true}));el.dispatchEvent(new Event('change',{bubbles:true}));}
  async function chooseProduct(name){if(!name)return;const sel=document.getElementById('pageProduct');if(!sel)return;for(let i=0;i<30;i++){const opt=[...sel.options].find(o=>String(o.textContent||'').trim().toLowerCase().includes(String(name).trim().toLowerCase()));if(opt){sel.value=opt.value;sel.dispatchEvent(new Event('change',{bubbles:true}));return}await sleep(200)}}
  async function resolveLocation(pin,address){
    if(!/^\d{6}$/.test(pin))return;
    const st=document.getElementById('orderState'),city=document.getElementById('orderCity'),post=document.getElementById('orderPost');if(!st||!city||!post)return;
    try{
      const res=await fetch(POSTAL_API+pin).then(r=>r.json());
      const offices=Array.isArray(res?.[0]?.PostOffice)?res[0].PostOffice:[];if(!offices.length)return;
      const state=String(offices[0].State||'').trim(),district=String(offices[0].District||'').trim();
      const norm=x=>String(x||'').trim().toLowerCase().replace(/[^a-z0-9]+/g,'-');
      const stateOpt=[...st.options].find(o=>norm(o.textContent)===norm(state)||norm(o.value)===norm(state));
      if(stateOpt){st.value=stateOpt.value;st.dispatchEvent(new Event('change',{bubbles:true}));if(typeof st.onchange==='function')await st.onchange();}
      await sleep(350);
      const cityOpt=[...city.options].find(o=>norm(o.textContent)===norm(district)||norm(o.value)===norm(district));
      if(cityOpt){city.value=cityOpt.value;city.dispatchEvent(new Event('change',{bubbles:true}));if(typeof city.onchange==='function')await city.onchange();}
      await sleep(450);
      if(offices.length===1){const name=String(offices[0].Name||'').trim();const p=[...post.options].find(o=>String(o.textContent||'').trim().toLowerCase()===name.toLowerCase());if(p)post.value=p.value}
      else{const a=String(address||'').toLowerCase();const p=[...post.options].find(o=>{const n=String(o.textContent||'').trim().toLowerCase();return n&&a.includes(n)});if(p)post.value=p.value}
    }catch(e){console.warn('CRM1 location lookup failed',e)}
  }
  async function applyContext(){
    const lead=readContext();if(!lead)return false;
    for(let i=0;i<40;i++){if(document.getElementById('createOrderPage')||findCreateOrderNav())break;await sleep(250)}
    let opened=false;for(let i=0;i<20&&!opened;i++){opened=await openCreateOrder();if(!opened)await sleep(250)}if(!opened)return false;
    for(let i=0;i<30;i++){if(document.querySelector('#createOrderPage input[name="customer_name"]')&&document.getElementById('pageMobile'))break;await sleep(200)}
    const map={customer_name:document.querySelector('#createOrderPage input[name="customer_name"]'),mobile:document.getElementById('pageMobile'),pincode:document.getElementById('orderPincode'),address:document.querySelector('#createOrderPage textarea[name="address"]')};
    await setValue(map.customer_name,lead.customer_name||'');await setValue(map.mobile,lead.mobile||'');await setValue(map.pincode,lead.pincode||'');await setValue(map.address,lead.address||'');await chooseProduct(lead.product_name||'');await resolveLocation(String(lead.pincode||'').replace(/\D/g,'').slice(0,6),lead.address||'');
    let badge=document.getElementById('crm2LeadContextBadge');if(!badge){badge=document.createElement('div');badge.id='crm2LeadContextBadge';badge.style.cssText='margin:0 0 14px;padding:12px 14px;border-radius:10px;background:#edf5ea;color:#164b30;border:1px solid #d8e7d3;font-size:13px;font-weight:700;';const form=document.getElementById('createOrderPageForm');if(form)form.insertBefore(badge,form.firstChild)}
    badge.textContent=`CRM2 Assigned Lead • ${lead.mobile||''}${lead.customer_name?` • ${lead.customer_name}`:''}${lead.product_name?` • ${lead.product_name}`:''}`;
    sessionStorage.removeItem(storageKey);sessionStorage.removeItem('crm2_active_lead');return true;
  }
  let tries=0;async function bootBridge(){if(!readContext())return;while(tries++<80){try{if(await applyContext())return}catch(e){console.error('CRM2 lead context bridge failed',e)}await sleep(250)}}
  window.addEventListener('load',()=>setTimeout(bootBridge,150));setTimeout(bootBridge,500);
})();