import {sb,currentProfile,normalizeMobile} from '../data.js';

const $=id=>document.getElementById(id);
const WS='[data-crm2-create-order]';
const ACTIVE_KEY='crm2ActiveCall';
const ACTIVE_MAX_AGE=6*60*60*1000;
let active=null;
let tick=null;
let callbackSaved=false;
let callbackSaving=false;

function fmt(sec){const s=Math.max(0,Math.floor(sec||0));return `${String(Math.floor(s/60)).padStart(2,'0')}:${String(s%60).padStart(2,'0')}`}
function ctx(){return window.crm2CreateOrderContext||{}}
function mobile(){return normalizeMobile($('crm2OrderMobile')?.value||'')}
function validMobile(v){return /^[6-9]\d{9}$/.test(v)}
function setStatus(text){if($('crm2CallStatus'))$('crm2CallStatus').textContent=text}
function clearPersistedActive(){try{localStorage.removeItem(ACTIVE_KEY)}catch(e){}}
function persistActive(){
  try{
    if(!active){clearPersistedActive();return}
    localStorage.setItem(ACTIVE_KEY,JSON.stringify({id:active.id,startedAt:active.startedAt.toISOString(),agentId:active.agentId||null}))
  }catch(e){console.warn('CRM2 active call state could not be persisted',e)}
}
function stopTimer(){clearInterval(tick);tick=null}
function startTimer(){
  stopTimer();
  if(!active)return;
  const render=()=>{if($('crm2CallTimer'))$('crm2CallTimer').textContent=fmt((Date.now()-active.startedAt.getTime())/1000)};
  render();tick=setInterval(render,250);
}
function renderActiveState(){
  const start=$('crm2CallStart'),end=$('crm2CallEnd'),mobileLink=$('crm2CallMobile');
  if(!start||!end)return;
  if(active){
    start.disabled=true;end.disabled=false;start.style.opacity='.55';end.style.opacity='1';mobileLink?.classList.add('muted');setStatus('Calling / In Call');startTimer();
  }else{
    start.disabled=false;end.disabled=true;start.style.opacity='1';end.style.opacity='.55';mobileLink?.classList.remove('muted');
  }
}
async function expireActive(reason='Abandoned'){
  const call=active;if(!call)return;
  stopTimer();
  const ended=new Date();const duration=Math.max(0,Math.round((ended.getTime()-call.startedAt.getTime())/1000));
  const {error}=await sb.from('lead_calls').update({ended_at:ended.toISOString(),duration_seconds:duration,outcome:reason,notes:'Call session expired after refresh/abandonment.'}).eq('id',call.id).is('ended_at',null);
  if(error){console.warn('CRM2 abandoned call update failed',error);return}
  active=null;clearPersistedActive();
  if($('crm2CallTimer'))$('crm2CallTimer').textContent=fmt(duration);
  renderActiveState();setStatus('Previous call session expired. Ready to call.');
}
async function restoreActive(){
  let saved=null;
  try{saved=JSON.parse(localStorage.getItem(ACTIVE_KEY)||'null')}catch(e){clearPersistedActive();return}
  if(!saved?.id||!saved?.startedAt){clearPersistedActive();return}
  const startedAt=new Date(saved.startedAt);if(Number.isNaN(startedAt.getTime())){clearPersistedActive();return}
  const user=(await currentProfile())?.id||null;if(!user)return;
  if(saved.agentId&&saved.agentId!==user){clearPersistedActive();return}
  active={id:saved.id,startedAt,agentId:user};
  if(Date.now()-startedAt.getTime()>=ACTIVE_MAX_AGE){await expireActive('Abandoned');return}
  renderActiveState();
}
function ensureUi(){
  if(!$('crm2CallMobile')||$('crm2CallStart'))return;
  const old=$('crm2CallMobile');const host=old.parentElement;
  const start=document.createElement('button');start.type='button';start.className='btn';start.id='crm2CallStart';start.textContent='▶ Start Call';start.style.background='#16803c';start.style.color='#fff';
  const end=document.createElement('button');end.type='button';end.className='btn';end.id='crm2CallEnd';end.textContent='■ End Call';end.disabled=true;end.style.background='#c62828';end.style.color='#fff';
  const timer=document.createElement('span');timer.id='crm2CallTimer';timer.className='call-timer';timer.textContent='00:00';timer.style.fontVariantNumeric='tabular-nums';timer.style.fontWeight='700';
  host.insertBefore(start,old);host.insertBefore(end,old);host.appendChild(timer);
  const durationField=$('crm2CallDuration')?.closest('.field');if(durationField)durationField.hidden=true;
  const outcome=$('crm2CallOutcome');
  if(outcome){
    const wrap=outcome.closest('.field');
    if(wrap&&!$('crm2CallbackFields')){const cb=document.createElement('div');cb.id='crm2CallbackFields';cb.hidden=true;cb.style.marginTop='12px';cb.innerHTML='<label>Callback Date & Time</label><input id="crm2CallbackAt" type="datetime-local"><label>Callback Priority</label><select id="crm2CallbackPriority"><option>normal</option><option>high</option><option>urgent</option><option>express</option></select><label>Callback Notes</label><textarea id="crm2CallbackNotes" maxlength="500" placeholder="Callback reason / notes"></textarea><button type="button" class="btn alt" id="crm2SaveCallback">Save Callback</button><div class="field-error" id="crm2CallbackError"></div>';wrap.parentElement.appendChild(cb)}
    outcome.addEventListener('change',()=>{const box=$('crm2CallbackFields');if(box)box.hidden=outcome.value!=='Callback';});
  }
  start.onclick=startCall;end.onclick=endCall;$('crm2SaveCallback')?.addEventListener('click',saveCallback);
  renderActiveState();
}
async function startCall(){
  if(active)return;
  const m=mobile();if(!validMobile(m)){if($('crm2OrderMobileError'))$('crm2OrderMobileError').textContent='Pehle valid mobile number enter karein.';return}
  const c=ctx(),lead=c.lead;if(!lead?.id){setStatus('Select/open a lead before starting a logged call.');return}
  const user=(await currentProfile())?.id||null;if(!user){setStatus('Session expired. Please login again.');return}
  const started=new Date();
  const {data,error}=await sb.from('lead_calls').insert({lead_id:lead.id,customer_id:c.customer?.id||lead.customer_id||null,agent_id:user,call_source:'manual_mobile',direction:'outbound',started_at:started.toISOString(),ended_at:null,duration_seconds:0,outcome:null,notes:null}).select().single();
  if(error){setStatus('Unable to start call: '+(error.message||'database error'));return}
  active={id:data.id,startedAt:started,agentId:user};callbackSaved=false;callbackSaving=false;persistActive();
  renderActiveState();
}
async function endCall(){
  if(!active)return;
  const call=active;stopTimer();
  const ended=new Date();const duration=Math.max(0,Math.round((ended.getTime()-call.startedAt.getTime())/1000));
  const outcome=$('crm2CallOutcome')?.value||null;const notes=String($('crm2CallNotes')?.value||'').trim()||null;
  setStatus('Saving call…');
  const {error}=await sb.from('lead_calls').update({ended_at:ended.toISOString(),duration_seconds:duration,outcome,notes}).eq('id',call.id).is('ended_at',null);
  if(error){setStatus('Call ended locally; log update failed.');active=call;persistActive();renderActiveState();console.warn('CRM2 call end update failed',error);return}
  active=null;clearPersistedActive();
  $('crm2CallTimer').textContent=fmt(duration);$('crm2CallStart').disabled=false;$('crm2CallEnd').disabled=true;$('crm2CallStart').style.opacity='1';$('crm2CallEnd').style.opacity='.55';setStatus('Call completed');
  if(outcome==='Callback')await saveCallback();
}
async function saveCallback(){
  if(callbackSaved||callbackSaving)return callbackSaved;
  const c=ctx(),lead=c.lead;if(!lead?.id)return false;
  const input=$('crm2CallbackAt'),err=$('crm2CallbackError');if(!input)return false;
  if(!input.value){if(err)err.textContent='Callback date & time required hai.';return false}
  const due=new Date(input.value);if(Number.isNaN(due.getTime())||due.getTime()<=Date.now()){if(err)err.textContent='Future callback date & time select karein.';return false}
  const user=(await currentProfile())?.id||null;if(!user){if(err)err.textContent='Session expired. Please login again.';return false}
  callbackSaving=true;
  try{
    const priority=$('crm2CallbackPriority')?.value||'normal';const reason=String($('crm2CallbackNotes')?.value||$('crm2CallNotes')?.value||'').trim()||'Callback requested';
    const {error}=await sb.from('followups').insert({lead_id:lead.id,customer_id:c.customer?.id||lead.customer_id||null,order_id:null,assigned_to:user,due_at:due.toISOString(),priority,reason,status:'pending',reminder:true});
    if(error){if(err)err.textContent=error.message||'Callback save failed.';return false}
    callbackSaved=true;
    const {error:leadError}=await sb.from('leads').update({status:'callback',next_followup:due.toISOString(),updated_at:new Date().toISOString()}).eq('id',lead.id);
    if(leadError){if(err)err.textContent='Callback saved, but lead status could not be updated.';console.warn('Callback lead update failed',leadError);return true}
    if(err)err.textContent='Callback scheduled successfully.';if($('crm2CallOutcome'))$('crm2CallOutcome').value='Callback';return true;
  }finally{callbackSaving=false}
}
function abandoned(){if(!active)return;const age=Date.now()-active.startedAt.getTime();if(age<ACTIVE_MAX_AGE)return;expireActive('Abandoned')}
function wire(){
  const workspace=document.querySelector(WS);if(!workspace)return;
  ensureUi();
  const mobileInput=$('crm2OrderMobile');if(mobileInput&&!mobileInput.dataset.callingBound){mobileInput.dataset.callingBound='1';mobileInput.addEventListener('input',()=>{if(!active)setStatus(validMobile(mobile())?'Ready to call':'Enter valid mobile')})}
  if(!wire.restored){wire.restored=true;restoreActive()}
}
wire.restored=false;
const observer=new MutationObserver(wire);observer.observe(document.body,{subtree:true,childList:true});
window.addEventListener('beforeunload',()=>{if(active)persistActive()});
setInterval(abandoned,30000);
wire();