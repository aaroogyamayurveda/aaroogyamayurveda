import {sb,currentProfile,normalizeMobile} from '../data.js';

const $=id=>document.getElementById(id);
const WS='[data-crm2-create-order]';
const PARITY='[data-crm1-order-parity]';

function validMobile(v){return /^[6-9]\d{9}$/.test(normalizeMobile(v||''))}

async function logManualCall(){
  const mobile=normalizeMobile($('crm2OrderMobile')?.value||$('crm2ParityPhone')?.value||'');
  const lead=window.crm2CreateOrderContext?.lead;
  if(!validMobile(mobile)||!lead?.id)return;
  const user=(await currentProfile())?.id||null;
  if(!user)return;
  const outcome=$('crm2CallOutcome')?.value||'Connected';
  const notes=String($('crm2CallNotes')?.value||'').trim()||null;
  const {error}=await sb.from('lead_calls').insert({lead_id:lead.id,customer_id:window.crm2CreateOrderContext?.customer?.id||lead.customer_id||null,agent_id:user,call_source:'manual_mobile',direction:'outbound',started_at:null,ended_at:null,duration_seconds:0,outcome,notes});
  if(error)console.warn('CRM2 parity manual call log failed',error);
}

function field(label,node,extra=''){
  const wrap=document.createElement('div');wrap.className='field crm1-parity-field';
  const l=document.createElement('label');l.textContent=label;wrap.append(l,node);
  if(extra)wrap.insertAdjacentHTML('beforeend',extra);
  return wrap;
}

function move(node,parent){if(node&&parent)parent.appendChild(node)}

function makeConsole(workspace){
  if(document.querySelector(PARITY+'-console'))return;
  const panel=document.createElement('section');panel.className='panel crm1-parity-console';panel.setAttribute('data-crm1-order-parity-console','true');
  panel.innerHTML='<div class="crm1-parity-panel-title"><div><h3>☎ Manual Phone Call Console</h3><div class="sub">Call customers from your personal keypad phone. CRM records call timing, disposition and follow-up only.</div></div><span class="status-chip">Ready</span></div><div class="grid3 crm1-parity-call-grid"><div id="crm1ParityMobileField"></div><div id="crm1ParityStatusField"></div><div id="crm1ParityTimerField"></div></div><div class="actions crm1-parity-actions"></div>';
  const main=workspace.parentElement;
  main.insertBefore(panel,workspace);
  const mobile=$('crm2OrderMobile');
  const status=$('crm2CallStatus');
  const timer=$('crm2CallTimer');
  if(mobile){mobile.className='';mobile.placeholder='10 digit mobile';move(field('Customer Mobile',mobile),$('crm1ParityMobileField'));}
  if(status){const input=document.createElement('input');input.id='crm1ParityAgentStatus';input.readOnly=true;input.value=status.textContent||'Ready';input.className='crm1-parity-readonly';move(field('Agent Status',input),$('crm1ParityStatusField'));}
  if(timer){const input=document.createElement('input');input.id='crm1ParityTimer';input.readOnly=true;input.value=timer.textContent||'00:00';input.className='crm1-parity-readonly';move(field('Call Timer',input),$('crm1ParityTimerField'));timer.style.display='none';}
  const start=$('crm2CallStart'),end=$('crm2CallEnd');
  if(start){start.textContent='Start Manual Call';start.className='btn';move(start,panel.querySelector('.crm1-parity-actions'));}
  if(end){end.textContent='End Call';end.className='btn alt crm1-parity-end';move(end,panel.querySelector('.crm1-parity-actions'));}
  const log=document.createElement('button');log.type='button';log.className='btn alt';log.textContent='Log Manual Call';log.id='crm1ParityLogCall';log.onclick=logManualCall;panel.querySelector('.crm1-parity-actions').append(log);
  const sync=()=>{if($('crm1ParityAgentStatus'))$('crm1ParityAgentStatus').value=status?.textContent||'Ready';if($('crm1ParityTimer'))$('crm1ParityTimer').value=timer?.textContent||'00:00'};
  new MutationObserver(sync).observe(status,{childList:true,subtree:true,characterData:true});
  setInterval(sync,500);
}

function makeTelephony(workspace){
  if(document.querySelector(PARITY+'-telephony'))return;
  const panel=document.createElement('section');panel.className='panel crm1-parity-telephony';panel.setAttribute('data-crm1-order-parity-telephony','true');
  panel.innerHTML='<div class="crm1-parity-panel-title"><div><h3>☎ Telephony</h3><div class="sub">Call control inside order workspace · SIP / X / Mobile ready</div></div><span class="crm1-parity-unconfigured">Telephony not configured</span></div><div class="crm1-parity-tele-row"><input id="crm2ParityPhone" class="crm1-parity-phone" inputmode="numeric" maxlength="10" placeholder="10 digit mobile"><button class="btn alt" id="crm1ParitySip" type="button">Call via SIP</button><button class="btn alt" id="crm1ParityPhone" type="button">Phone</button><button class="btn alt" id="crm1ParityLog" type="button">Log Call</button></div><div class="sub crm1-parity-admin-note">Admin needs to configure this agent in Telephony Agents.</div>';
  const main=workspace.parentElement;const consolePanel=main.querySelector('[data-crm1-order-parity-console]');main.insertBefore(panel,workspace);
  $('crm2ParityPhone').addEventListener('input',e=>{e.target.value=e.target.value.replace(/\D/g,'').slice(0,10)});
  $('crm1ParitySip').onclick=()=>{const n=normalizeMobile($('crm2ParityPhone').value);window.dispatchEvent(new CustomEvent('crm2StartTelephonyCall',{detail:{mobile:n,leadId:window.crm2CreateOrderContext?.lead?.id||null}}));};
  $('crm1ParityPhone').onclick=()=>{const n=normalizeMobile($('crm2ParityPhone').value);if(validMobile(n))window.location.href=`tel:${encodeURIComponent(n)}`;};
  $('crm1ParityLog').onclick=logManualCall;
}

function reorganize(workspace){
  if(workspace.dataset.crm1ParityApplied==='true')return;
  const head=workspace.querySelector('.order-workspace-head');
  const mainCol=workspace.querySelector('.order-main-column');
  const customer=mainCol?.querySelectorAll('.order-section')[0];
  const calling=mainCol?.querySelectorAll('.order-section')[1];
  const address=mainCol?.querySelectorAll('.order-section')[2];
  const pricing=mainCol?.querySelectorAll('.order-section')[3];
  const info=mainCol?.querySelectorAll('.order-section')[4];
  if(!mainCol||!customer||!address||!pricing||!info)return;
  if(head){head.querySelector('.eyebrow')?.remove();const h=head.querySelector('h2');if(h)h.textContent='+ Create Order';const p=head.querySelector('p');if(p)p.textContent='Customer और Order की पूरी details एक ही page पर भरें';}
  if(calling)calling.style.display='none';
  customer.querySelector('h3').textContent='Customer Details';customer.querySelector('.order-section-title .muted')?.remove();customer.querySelector('.order-section-title .status-chip')?.remove();
  address.querySelector('h3').textContent='Delivery Address';address.querySelector('.order-section-title .muted')?.remove();address.querySelector('.order-section-title .status-chip')?.remove();
  pricing.querySelector('h3').textContent='Order Details';pricing.querySelector('.order-section-title .muted')?.remove();
  info.querySelector('h3').textContent='Order Details';info.querySelector('.order-section-title .muted')?.remove();
  const customerPanel=document.createElement('section');customerPanel.className='panel crm1-parity-section';customerPanel.innerHTML='<h3>Customer Details</h3><div class="grid2 crm1-parity-customer-grid"></div><div class="crm1-parity-address-grid"></div><div class="crm1-parity-history"></div>';
  const cg=customerPanel.querySelector('.crm1-parity-customer-grid');const ag=customerPanel.querySelector('.crm1-parity-address-grid');
  const customerGrid=customer.querySelector('.grid2');
  if(customerGrid){[...customerGrid.children].forEach(n=>cg.append(n));}
  const history=customer.querySelector('#crm2CustomerHistory');if(history)customerPanel.querySelector('.crm1-parity-history').append(history);
  const addressGrid=address.querySelector('.grid2');if(addressGrid){[...addressGrid.children].forEach(n=>ag.append(n));}
  const saved=address.querySelector('#crm2SavedAddresses');if(saved)customerPanel.insertBefore(saved,ag);
  const addressActions=address.querySelector('.address-actions');if(addressActions)customerPanel.append(addressActions);
  const orderPanel=document.createElement('section');orderPanel.className='panel crm1-parity-section';orderPanel.innerHTML='<h3>Order Details</h3><div class="grid2 crm1-parity-order-grid"></div>';
  const og=orderPanel.querySelector('.crm1-parity-order-grid');
  [pricing,info].forEach(sec=>{const grid=sec.querySelector('.grid2');if(grid)[...grid.children].forEach(n=>og.append(n));});
  mainCol.innerHTML='';mainCol.append(customerPanel,orderPanel);
  const summary=workspace.querySelector('.order-summary-card');if(summary){summary.classList.add('crm1-parity-summary');const title=summary.querySelector('.eyebrow');if(title)title.textContent='Order Summary';}
  workspace.dataset.crm1ParityApplied='true';
  makeConsole(workspace);makeTelephony(workspace);
}

function apply(){const ws=document.querySelector(WS);if(!ws)return;reorganize(ws)}

const observer=new MutationObserver(apply);observer.observe(document.body,{subtree:true,childList:true});
apply();
