import {sb,esc,money,currentProfile} from '../data.js';

const $=id=>document.getElementById(id);
const main=()=>document.querySelector('#main');
const canManage=role=>['super_admin','admin','manager','assistant_manager','dealer_manager'].includes(role);
const fail=e=>e?.message||'Operation failed.';

function dialog(title,body){
  document.querySelector('#crm2DealerModal')?.remove();
  const el=document.createElement('div');el.id='crm2DealerModal';
  el.innerHTML=`<div class="panel" style="position:fixed;inset:8%;z-index:9999;overflow:auto;box-shadow:0 8px 40px rgba(0,0,0,.25)"><div class="title"><h2>${esc(title)}</h2><button class="btn alt" id="dealerClose">Close</button></div>${body}</div>`;
  document.body.appendChild(el);$('dealerClose').onclick=()=>el.remove();return el;
}
const input=(id,label,value='')=>`<div class="field"><label>${esc(label)}</label><input id="${id}" value="${esc(value)}"></div>`;

async function dealerForm(existing=null){
  const d=dialog(existing?'Edit Dealer':'New Dealer',`<form id="dealerForm" class="grid2">
    ${input('dealerCode','Code',existing?.code||'')}${input('dealerName','Name',existing?.name||'')}
    <div class="field"><label>Type</label><select id="dealerType"><option value="dealer">Dealer</option><option value="distributor">Distributor</option></select></div>
    ${input('dealerMobile','Mobile',existing?.mobile||'')}${input('dealerTerritory','Territory',existing?.territory||'')}${input('dealerState','State',existing?.state||'')}${input('dealerCity','City',existing?.city||'')}${input('dealerTerms','Payment Terms',existing?.payment_terms||'')}
    <div class="field"><label>Commission %</label><input id="dealerCommission" type="number" min="0" step="0.01" value="${Number(existing?.commission_pct||0)}"></div>
    <div class="field"><label>Status</label><select id="dealerStatus"><option value="active">Active</option><option value="inactive">Inactive</option></select></div>
    <div class="field full"><label>Address</label><textarea id="dealerAddress">${esc(existing?.address||'')}</textarea></div>
    <button class="btn">Save Dealer</button><div id="dealerMsg" class="msg"></div></form>`);
  $('dealerType').value=existing?.type||'dealer';$('dealerStatus').value=existing?.status||'active';
  $('dealerForm').onsubmit=async e=>{e.preventDefault();try{
    const record={code:$('dealerCode').value.trim(),name:$('dealerName').value.trim(),type:$('dealerType').value,mobile:$('dealerMobile').value.trim()||null,territory:$('dealerTerritory').value.trim()||null,state:$('dealerState').value.trim()||null,city:$('dealerCity').value.trim()||null,payment_terms:$('dealerTerms').value.trim()||null,commission_pct:Math.max(0,Number($('dealerCommission').value)||0),status:$('dealerStatus').value,address:$('dealerAddress').value.trim()||null};
    if(!record.code||!record.name)throw new Error('Dealer code and name are required.');
    const q=existing?sb.from('dealers').update(record).eq('id',existing.id):sb.from('dealers').insert(record);
    const {error}=await q;if(error)throw error;d.remove();await renderDealers();
  }catch(error){$('dealerMsg').textContent=fail(error)}};
}

async function deactivateDealer(id){
  const {count,error:countError}=await sb.from('orders').select('id',{count:'exact',head:true}).eq('dealer_id',id);
  if(countError)throw countError;
  const message=count?'This dealer has orders and will be marked inactive, not deleted.':'Mark this dealer inactive?';
  if(!confirm(message))return;
  const {error}=await sb.from('dealers').update({status:'inactive'}).eq('id',id);
  if(error)throw error;
  await renderDealers();
}

export async function renderDealers(){
  const m=main();if(!m)return;
  const profile=await currentProfile();const manage=canManage(profile?.role);
  const [dealerResult,orderResult,settlementResult]=await Promise.all([
    sb.from('dealers').select('*').order('name').limit(200),
    sb.from('orders').select('dealer_id,total,status').not('dealer_id','is',null).limit(1000),
    sb.from('settlements').select('party_id,amount,status').eq('party_type','dealer').limit(1000)
  ]);
  if(dealerResult.error){m.innerHTML=`<section class="panel error">${esc(fail(dealerResult.error))}</section>`;return;}
  const performance=new Map();
  for(const order of orderResult.data||[]){const v=performance.get(order.dealer_id)||{orders:0,revenue:0,delivered:0,settled:0};v.orders++;v.revenue+=Number(order.total||0);if(order.status==='delivered')v.delivered++;performance.set(order.dealer_id,v);}
  for(const settlement of settlementResult.data||[]){const v=performance.get(settlement.party_id)||{orders:0,revenue:0,delivered:0,settled:0};v.settled+=Number(settlement.amount||0);performance.set(settlement.party_id,v);}
  const rows=(dealerResult.data||[]).map(x=>{const p=performance.get(x.id)||{orders:0,revenue:0,delivered:0,settled:0};return `<tr><td>${esc(x.code)}</td><td>${esc(x.name)}</td><td>${esc(x.type)}</td><td>${esc(x.territory||'—')}</td><td>${p.orders}</td><td>${money(p.revenue)}</td><td>${p.delivered}</td><td>${money(p.settled)}</td><td>${esc(x.status)}</td><td>${manage?`<button class="btn alt" data-dealer-edit="${x.id}">Edit</button> <button class="btn alt" data-dealer-remove="${x.id}">Deactivate</button>`:''}</td></tr>`;}).join('');
  m.innerHTML=`<div class="title"><h2>Dealer / Distributor</h2>${manage?'<button class="btn" id="newDealer">New Dealer</button>':''}</div><section class="panel"><h3>Dealer Performance</h3><p class="muted">Order volume, revenue, delivered orders and recorded dealer settlements.</p><div class="tablewrap"><table><thead><tr><th>Code</th><th>Name</th><th>Type</th><th>Territory</th><th>Orders</th><th>Revenue</th><th>Delivered</th><th>Settled</th><th>Status</th><th>Action</th></tr></thead><tbody>${rows||'<tr><td colspan="10" class="muted">No dealers.</td></tr>'}</tbody></table></div></section>`;
  $('newDealer')?.addEventListener('click',()=>dealerForm());
  m.querySelectorAll('[data-dealer-edit]').forEach(button=>button.addEventListener('click',()=>dealerForm((dealerResult.data||[]).find(x=>x.id===button.dataset.dealerEdit))));
  m.querySelectorAll('[data-dealer-remove]').forEach(button=>button.addEventListener('click',()=>deactivateDealer(button.dataset.dealerRemove).catch(error=>alert(fail(error)))));
}

document.addEventListener('click',event=>{
  const button=event.target.closest('[data-page]');
  if(button?.dataset.page==='dealers')setTimeout(renderDealers,0);
},true);
