import { sb, currentProfile, normalizeMobile } from '../data.js';

const $ = id => document.getElementById(id);
const WS = '[data-crm2-create-order]';
const hide = el => { if (el) el.style.display = 'none'; };
const text = v => String(v ?? '').trim();
const validMobile = v => /^[6-9]\d{9}$/.test(normalizeMobile(v));
let appliedWorkspace = null;
let dispositionLoad = null;

function error(id, value) { const el = $(id); if (el) el.textContent = value || ''; }

function syncFields() {
  const rules = [
    ['crm2OrderMobile', 10], ['crm2OrderAlt', 10], ['crm2OrderPincode', 6], ['crm2OrderAge', 3]
  ];
  for (const [id, max] of rules) {
    const el = $(id); if (!el) continue;
    el.maxLength = max; el.inputMode = 'numeric';
    if (!el.dataset.crm2ParityInputBound) {
      el.dataset.crm2ParityInputBound = 'true';
      el.addEventListener('input', () => { el.value = el.value.replace(/\D/g, '').slice(0, max); });
    }
  }
  const qty = $('crm2OrderQty');
  if (qty) { qty.min = '1'; qty.max = '99'; qty.step = '1'; qty.inputMode = 'numeric'; }
  const name = $('crm2OrderName'); if (name) name.maxLength = 80;
}

function freezePricing() {
  const price = $('crm2OrderPrice');
  const discount = $('crm2OrderDiscount');
  if (price) { price.readOnly = true; price.setAttribute('aria-readonly','true'); price.title = 'Product master price'; }
  if (discount) { discount.value = '0'; discount.readOnly = true; discount.disabled = true; discount.setAttribute('aria-disabled','true'); discount.title = 'Discount fixed at ₹0'; }
}

function moveField(id, target) {
  const el = $(id)?.closest('.field');
  if (el && target && !target.contains(el)) target.appendChild(el);
  return el;
}

function addCallConsole(ws) {
  if (document.querySelector('[data-crm1-order-parity-console]')) return;
  const panel = document.createElement('section');
  panel.className = 'panel crm1-parity-console';
  panel.dataset.crm1OrderParityConsole = 'true';
  panel.innerHTML = '<div class="crm1-parity-panel-title"><div><h3>☎ Manual Phone Call Console</h3><div class="sub">Call customer from mobile and record call timing.</div></div></div><div class="grid3 crm1-parity-call-grid"><div id="crm1ParityMobileField"></div><div id="crm1ParityStatusField"></div><div id="crm1ParityTimerField"></div></div><div class="actions crm1-parity-actions"></div>';
  ws.parentElement.insertBefore(panel, ws);
  const mobile = $('crm2OrderMobile');
  if (mobile) {
    const clone = mobile.cloneNode(true); clone.id = 'crm1ParityMobile'; clone.dataset.crm2ParityClone = 'true';
    clone.addEventListener('input', () => { mobile.value = clone.value; mobile.dispatchEvent(new Event('input',{bubbles:true})); });
    panel.querySelector('#crm1ParityMobileField').appendChild(labelField('Customer Mobile', clone));
  }
  const status = $('crm2CallStatus');
  const statusInput = document.createElement('input'); statusInput.readOnly = true; statusInput.id = 'crm1ParityAgentStatus'; statusInput.value = status?.textContent || 'Ready to call'; panel.querySelector('#crm1ParityStatusField').appendChild(labelField('Agent Status',statusInput));
  const timer = $('crm2CallTimer');
  if (timer) { const timerInput=document.createElement('input'); timerInput.readOnly=true; timerInput.id='crm1ParityTimer'; timerInput.value=timer.textContent||'00:00'; panel.querySelector('#crm1ParityTimerField').appendChild(labelField('Call Timer',timerInput)); hide(timer); }
  const actions=panel.querySelector('.crm1-parity-actions');
  const start=$('crm2CallStart'), end=$('crm2CallEnd');
  if(start){start.textContent='Start Call';start.className='btn';actions.appendChild(start);}
  if(end){end.textContent='End Call';end.className='btn red';actions.appendChild(end);}
  const log=document.createElement('button'); log.type='button'; log.className='btn alt'; log.id='crm1ParityLogCall'; log.textContent='Log Manual Call'; log.onclick=()=>window.dispatchEvent(new CustomEvent('crm2ParityManualCall')); actions.appendChild(log);
  const sync=()=>{if($('crm1ParityAgentStatus'))$('crm1ParityAgentStatus').value=status?.textContent||'Ready to call';if($('crm1ParityTimer'))$('crm1ParityTimer').value=timer?.textContent||'00:00';if($('crm1ParityMobile')&&mobile)$('crm1ParityMobile').value=mobile.value;};
  if(status)new MutationObserver(sync).observe(status,{subtree:true,childList:true,characterData:true});
  setInterval(sync,500);
}

function labelField(label,node){const wrap=document.createElement('div');wrap.className='field';const l=document.createElement('label');l.textContent=label;wrap.append(l,node);return wrap;}

function addTelephony(ws) {
  if (document.querySelector('[data-crm1-order-parity-telephony]')) return;
  const panel=document.createElement('section');panel.className='panel crm1-parity-telephony';panel.dataset.crm1OrderParityTelephony='true';
  panel.innerHTML='<div class="crm1-parity-panel-title"><div><h3>☎ Telephony</h3><div class="sub">SIP / phone integration</div></div></div><div class="crm1-parity-tele-row"><input id="crm2ParityPhone" class="crm1-parity-phone" inputmode="numeric" maxlength="10" placeholder="10 digit mobile"><button class="btn alt" id="crm1ParitySip" type="button">Call via SIP</button><button class="btn alt" id="crm1ParityPhone" type="button">Call via Phone</button><button class="btn alt" id="crm1ParityLog" type="button">Log Call</button></div>';
  ws.parentElement.insertBefore(panel,ws);
  $('crm2ParityPhone').addEventListener('input',e=>e.target.value=e.target.value.replace(/\D/g,'').slice(0,10));
  $('crm1ParitySip').onclick=()=>window.dispatchEvent(new CustomEvent('crm2StartTelephonyCall',{detail:{mobile:normalizeMobile($('crm2ParityPhone').value),leadId:window.crm2CreateOrderContext?.lead?.id||null}}));
  $('crm1ParityPhone').onclick=()=>{const n=normalizeMobile($('crm2ParityPhone').value);if(validMobile(n))window.location.href=`tel:${encodeURIComponent(n)}`;};
  $('crm1ParityLog').onclick=()=>window.dispatchEvent(new CustomEvent('crm2ParityManualCall'));
}

async function loadDispositions() {
  const l1=$('crm1Disposition1'),l2=$('crm1Disposition2'); if(!l1||!l2)return;
  if(dispositionLoad)return dispositionLoad;
  dispositionLoad=(async()=>{
    const {data,error:err}=await sb.from('disposition_levels').select('id,name,parent_id').eq('active',true).is('parent_id',null).order('name');
    if(err){l1.innerHTML='<option value="">Unable to load</option>';return;}
    const names={'Lead':'Lead Case','Non Lead':'Non-Lead','Sales':'Sales Order','Not Connected':'Not Connected','Transfer':'Transfer','Language':'Language'};
    l1.innerHTML='<option value="">Select</option>'+(data||[]).map(x=>`<option value="${x.id}">${names[x.name]||x.name}</option>`).join('');
    l1.onchange=async()=>{
      l2.disabled=true;l2.innerHTML='<option value="">Loading…</option>';if(!l1.value){l2.innerHTML='<option value="">Select Level 1 first</option>';return;}
      const {data:children}=await sb.from('disposition_levels').select('id,name').eq('active',true).eq('parent_id',l1.value).order('name');
      l2.innerHTML='<option value="">Select</option>'+(children||[]).map(x=>`<option value="${x.id}">${escapeHtml(x.name)}</option>`).join('');l2.disabled=!(children||[]).length;
    };
  })();
  return dispositionLoad;
}
function escapeHtml(v){return String(v??'').replace(/[&<>\"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;'}[c]));}

function addDisposition(ws) {
  if(document.querySelector('[data-crm1-disposition-panel]'))return;
  const panel=document.createElement('section');panel.className='panel crm1-disposition-panel';panel.dataset.crm1DispositionPanel='true';
  panel.innerHTML='<h3>Disposition & Follow-up</h3><div class="grid2"><div class="field"><label>Disposition Level 1 *</label><select id="crm1Disposition1"><option value="">Select</option></select></div><div class="field"><label>Disposition Level 2 *</label><select id="crm1Disposition2" disabled><option value="">Select Level 1 first</option></select></div></div><div id="crm1DispositionMessage" class="field-error"></div><div class="actions"><button class="btn" id="crm1SubmitDisposition" type="button">Submit Disposition</button></div>';
  ws.parentElement.appendChild(panel); loadDispositions();
  $('crm1SubmitDisposition').onclick=async()=>{
    const l1=$('crm1Disposition1'),l2=$('crm1Disposition2');
    if(!l1.value){$('crm1DispositionMessage').textContent='Disposition Level 1 select karein.';return;}
    if(!l2.value){$('crm1DispositionMessage').textContent='Disposition Level 2 select karein.';return;}
    const create=$('crm2CreateOrder'); if(create){freezePricing();create.click();}
  };
}

function addRemarks(ws) {
  if(document.querySelector('[data-crm1-remarks-panel]'))return;
  const field=moveField('crm2OrderRemarks',null); if(!field)return;
  const panel=document.createElement('section');panel.className='panel crm1-remarks-panel';panel.dataset.crm1RemarksPanel='true';panel.innerHTML='<h3>Remarks</h3><div class="crm1-remarks-host"></div>';
  const label=field.querySelector('label');if(label)label.textContent='';const ta=field.querySelector('textarea');if(ta)ta.setAttribute('aria-label','Remarks');panel.querySelector('.crm1-remarks-host').appendChild(field);ws.insertAdjacentElement('afterend',panel);
}

function applyParity(ws) {
  if(!ws || ws.dataset.crm1ParityApplied==='true')return;
  syncFields(); freezePricing();
  const main=ws.querySelector('.order-main-column'); const sections=main?.querySelectorAll('.order-section');
  if(!main||!sections||sections.length<5)return;
  const [customer,calling,address,pricing,info]=sections;
  const head=ws.querySelector('.order-workspace-head'); if(head){head.querySelector('.eyebrow')?.remove();head.querySelector('h2').textContent='+ Create Order';head.querySelector('p').textContent='Enter customer and order details';}
  const customerPanel=document.createElement('section');customerPanel.className='panel crm1-parity-section';customerPanel.innerHTML='<h3>Customer Details</h3><div class="grid2 crm1-customer-grid"></div><div class="grid2 crm1-address-grid"></div>';
  const cg=customerPanel.querySelector('.crm1-customer-grid'),ag=customerPanel.querySelector('.crm1-address-grid');
  [...customer.querySelector('.grid2').children].forEach(n=>cg.appendChild(n));
  moveField('crm2OrderPincode',cg);
  [...address.querySelector('.grid2').children].forEach(n=>{if(!cg.contains(n))ag.appendChild(n);});
  const saved=address.querySelector('#crm2SavedAddresses');if(saved)customerPanel.insertBefore(saved,ag);
  const addrActions=address.querySelector('.address-actions');if(addrActions)customerPanel.appendChild(addrActions);
  const orderPanel=document.createElement('section');orderPanel.className='panel crm1-parity-section';orderPanel.innerHTML='<h3>Order Details</h3><div class="grid2 crm1-order-grid"></div>';
  const og=orderPanel.querySelector('.crm1-order-grid');[...pricing.querySelector('.grid2').children].forEach(n=>og.appendChild(n));
  [...info.querySelector('.grid2').children].forEach(n=>{const id=n.querySelector('input,select,textarea')?.id;if(id==='crm2OrderCampaign'||id==='crm2OrderPriority')hide(n);else if(id!=='crm2OrderRemarks')og.appendChild(n);});
  const total=labelField('Total Amount (₹) *',Object.assign(document.createElement('input'),{id:'crm1ParityTotalAmount',type:'number',readOnly:true,value:'0'}));og.insertBefore(total,og.querySelector('#crm2OrderPayment')?.closest('.field')||null);
  main.innerHTML='';main.append(customerPanel,orderPanel);
  const summary=ws.querySelector('.order-summary-card');if(summary)hide(summary);
  const create=$('crm2CreateOrder'),follow=$('crm2SaveFollowup');if(create){create.dataset.crm2HiddenSubmit='true';hide(create);}if(follow){follow.dataset.crm2HiddenSubmit='true';hide(follow);}
  addRemarks(ws); addDisposition(ws); addCallConsole(ws); addTelephony(ws);
  const syncTotal=()=>{const s=$('crm2SummaryTotal');const t=$('crm1ParityTotalAmount');if(t)t.value=(s?.textContent||'₹0').replace(/[^0-9.]/g,'')||0;freezePricing();};syncTotal();setInterval(syncTotal,300);
  ws.dataset.crm1ParityApplied='true'; appliedWorkspace=ws;
  window.dispatchEvent(new CustomEvent('crm2CreateOrderParityReady'));
}

export function applyCreateOrderParity(){const ws=document.querySelector(WS);if(ws)applyParity(ws);}
window.crm2ApplyCreateOrderParity=applyCreateOrderParity;
const observer=new MutationObserver(()=>applyCreateOrderParity());
if(document.body)observer.observe(document.body,{subtree:true,childList:true});
applyCreateOrderParity();
