import {normalizeMobile} from '../data.js';

const WS='[data-crm2-create-order]';
const $=id=>document.getElementById(id);
const hide=el=>{if(el)el.hidden=true};
const show=el=>{if(el)el.hidden=false};
const error=(id,msg)=>{const el=$(id);if(!el)return;el.textContent=msg||'';el.classList.add('crm2-validation-error');el.hidden=!msg};
const validMobile=v=>/^[6-9]\d{9}$/.test(normalizeMobile(v));

function installValidation(){
  const form=$('loginForm');
  if(form&&!form.dataset.crm2EnglishValidation){
    form.dataset.crm2EnglishValidation='1';form.noValidate=true;
    form.addEventListener('submit',e=>{const email=$('email'),password=$('password');let bad=false;if(!email?.value.trim()){bad=true;showLoginError('Please enter your email address.')}else if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.value.trim())){bad=true;showLoginError('Please enter a valid email address.')}else if(!password?.value){bad=true;showLoginError('Please enter your password.')}else clearLoginError();if(bad)e.preventDefault()},true);
  }
  document.querySelectorAll('.login .brand p').forEach(el=>{if(/zero[- ]cost|teleshopping business erp/i.test(el.textContent))el.remove()});
}
function showLoginError(msg){let el=$('crm2LoginValidation');if(!el){el=document.createElement('div');el.id='crm2LoginValidation';el.className='field-error crm2-validation-error';$('loginForm')?.appendChild(el)}el.textContent=msg;el.hidden=false}
function clearLoginError(){const el=$('crm2LoginValidation');if(el){el.textContent='';el.hidden=true}}
function setFieldError(id,msg){const field=$(id)?.closest('.field');if(!field)return;let el=field.querySelector('.crm2-inline-error');if(!el){el=document.createElement('div');el.className='crm2-inline-error field-error crm2-validation-error';field.appendChild(el)}el.textContent=msg;el.hidden=!msg}
function clearFieldError(id){const field=$(id)?.closest('.field');field?.querySelector('.crm2-inline-error')?.remove()}

function installOrderValidation(ws){
  if(ws.dataset.crm2EnglishValidation==='1')return;ws.dataset.crm2EnglishValidation='1';
  const validate=()=>{let ok=true;const mobile=normalizeMobile($('crm2OrderMobile')?.value),name=String($('crm2OrderName')?.value||'').trim();if(!validMobile(mobile)){ok=false;error('crm2OrderMobileError','Please enter a valid 10-digit mobile number.')}else error('crm2OrderMobileError','');if(!name||!/^[\p{L}][\p{L}\s.'-]{0,79}$/u.test(name)){ok=false;error('crm2OrderNameError','Please enter a valid customer name.')}else error('crm2OrderNameError','');const alt=normalizeMobile($('crm2OrderAlt')?.value);if(alt&&!validMobile(alt)){ok=false;error('crm2OrderAltError','Please enter a valid 10-digit alternate mobile number.')}else error('crm2OrderAltError','');const pin=String($('crm2OrderPincode')?.value||'').trim();if(!/^\d{6}$/.test(pin)){ok=false;error('crm2OrderPinError','Please enter a valid 6-digit pincode.')}else error('crm2OrderPinError','');const address=String($('crm2OrderAddress')?.value||'').trim();if(address.length<5){ok=false;error('crm2OrderAddressError','Please enter the complete delivery address.')}else error('crm2OrderAddressError','');const product=$('crm2OrderProduct')?.value;if(!product){ok=false;setFieldError('crm2OrderProduct','Please select a product.')}else clearFieldError('crm2OrderProduct');const qty=Number($('crm2OrderQty')?.value);if(!Number.isInteger(qty)||qty<1||qty>99){ok=false;setFieldError('crm2OrderQty','Please enter a quantity between 1 and 99.')}else clearFieldError('crm2OrderQty');return ok};
  ws.addEventListener('click',e=>{const target=e.target.closest('#crm2CreateOrder,#crm1SubmitDisposition');if(!target)return;if(target.id==='crm2CreateOrder'&&!validate()){e.preventDefault();e.stopImmediatePropagation()}if(target.id==='crm1SubmitDisposition'){const l1=$('crm1Disposition1'),l2=$('crm1Disposition2');let bad=false;if(!l1?.value){bad=true;setFieldError('crm1Disposition1','Please select Disposition Level 1.')}else clearFieldError('crm1Disposition1');if(!l2?.value){bad=true;setFieldError('crm1Disposition2','Please select Disposition Level 2.')}else clearFieldError('crm1Disposition2');if(!validate())bad=true;if(bad){e.preventDefault();e.stopImmediatePropagation()}}},true);
}

function hardenCallConsole(){
  const panel=document.querySelector('[data-crm1-order-parity-console]');if(!panel||panel.dataset.crm2CallHardened==='1')return;panel.dataset.crm2CallHardened='1';
  const statusHost=panel.querySelector('#crm1ParityStatusField');
  if(statusHost){statusHost.innerHTML='<div class="field"><label>Agent Status</label><select id="crm1ParityAgentStatus"><option value="ready">Ready</option><option value="pause">Pause</option><option value="aux">AUX</option><option value="washroom">Washroom</option><option value="lunch">Lunch</option></select></div>';const select=$('crm1ParityAgentStatus');const key='crm2AgentStatus';try{select.value=localStorage.getItem(key)||'ready'}catch(e){}select.addEventListener('change',()=>{try{localStorage.setItem(key,select.value)}catch(e){}const label=select.options[select.selectedIndex]?.text||'Ready';const source=$('crm2CallStatus');if(source&&!/^Calling|^Call completed|^Saving/.test(source.textContent||''))source.textContent=label})}
  const actions=panel.querySelector('.crm1-parity-actions');if(!actions)return;actions.innerHTML='';
  const start=document.createElement('button');start.type='button';start.id='crm2ParityStartCall';start.className='btn';start.textContent='Start Call';start.style.cssText='background:#16803c;color:#fff;';
  const timer=document.createElement('span');timer.id='crm2ParityCallTimer';timer.className='call-timer';timer.textContent=$('crm2CallTimer')?.textContent||'00:00';
  const end=document.createElement('button');end.type='button';end.id='crm2ParityEndCall';end.className='btn red';end.textContent='End Call';end.style.cssText='background:#c62828;color:#fff;';
  const log=document.createElement('button');log.type='button';log.id='crm2ParityLogManual';log.className='btn alt';log.textContent='Log Manual Call';actions.append(start,timer,end,log);
  const delegate=id=>$(id)?.click();start.onclick=()=>delegate('crm2CallStart');end.onclick=()=>delegate('crm2CallEnd');log.onclick=()=>window.dispatchEvent(new CustomEvent('crm2ParityManualCall'));
  const sync=()=>{const realStart=$('crm2CallStart'),realEnd=$('crm2CallEnd'),realTimer=$('crm2CallTimer');if(realStart)start.disabled=realStart.disabled;if(realEnd)end.disabled=realEnd.disabled;if(realTimer)timer.textContent=realTimer.textContent||'00:00'};
  // This observer intentionally watches only child/text mutations. The sync function
  // changes button disabled state, so observing attributes here creates a self-triggering
  // MutationObserver loop and freezes the renderer during the Create Order click.
  const observer=new MutationObserver(sync);observer.observe(panel,{subtree:true,childList:true,characterData:true});sync();
}

function hardenDisposition(){const l1=$('crm1Disposition1'),l2=$('crm1Disposition2');if(!l1||!l2)return;const salesOption=[...l1.options].find(o=>o.textContent.trim()==='Sales Order');if(!salesOption)return;if(l1.dataset.crm2SalesDisposition==='1')return;l1.dataset.crm2SalesDisposition='1';l1.addEventListener('change',async()=>{if(l1.value!==salesOption.value)return;const desired=['Express Order','Urgent Order','Fresh Order'];const existing=[...l2.options].map(o=>o.textContent.trim());if(desired.every(x=>existing.includes(x)))return;const {sb}=await import('../data.js');const {data}=await sb.from('disposition_levels').select('id,name').eq('active',true).eq('parent_id',l1.value).order('name');const rows=data||[];l2.innerHTML='<option value="">Select</option>'+rows.map(x=>`<option value="${x.id}">${x.name}</option>`).join('');const names=rows.map(x=>x.name);if(!desired.every(x=>names.includes(x))){for(const name of desired.filter(x=>!names.includes(x)))await sb.from('disposition_levels').insert({name,active:true,parent_id:l1.value,level_no:2});const {data:again}=await sb.from('disposition_levels').select('id,name').eq('active',true).eq('parent_id',l1.value).order('name');l2.innerHTML='<option value="">Select</option>'+(again||[]).map(x=>`<option value="${x.id}">${x.name}</option>`).join('')}l2.disabled=false})}
function sanitizeVisibleHindi(){const body=document.body;if(!body)return;const bad=/कृपया|चयन करें|भरें|सही|करें|पहले valid|number enter|select karein|required hai|invalid hai/i;body.querySelectorAll('.field-error,.msg,.error').forEach(el=>{if(bad.test(el.textContent||'')){el.textContent='Please check the highlighted field and enter valid information.';el.classList.add('crm2-validation-error')}})}
function run(){installValidation();const ws=document.querySelector(WS);if(ws){installOrderValidation(ws);hardenCallConsole();hardenDisposition()}sanitizeVisibleHindi()}
const observer=new MutationObserver(run);if(document.body)observer.observe(document.body,{subtree:true,childList:true});run();
