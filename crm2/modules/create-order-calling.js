import {sb,currentProfile,normalizeMobile} from '../data.js';

const $=id=>document.getElementById(id);
const WS='[data-crm2-create-order]';
let active=null;
let tick=null;

function fmt(sec){const s=Math.max(0,Math.floor(sec||0));return `${String(Math.floor(s/60)).padStart(2,'0')}:${String(s%60).padStart(2,'0')}`}
function ctx(){return window.crm2CreateOrderContext||{}}
function mobile(){return normalizeMobile($('crm2OrderMobile')?.value||'')}
function validMobile(v){return /^[6-9]\d{9}$/.test(v)}
function setStatus(text){if($('crm2CallStatus'))$('crm2CallStatus').textContent=text}
function ensureUi(){
  if(!$( 'crm2CallMobile')||$('crm2CallStart'))return;
  const old=$('crm2CallMobile');
  const host=old.parentElement;
  const start=document.createElement('button');start.type='button';start.className='btn';start.id='crm2CallStart';start.textContent='▶ Start Call';
  const end=document.createElement('button');end.type='button';end.className='btn';end.id='crm2CallEnd';end.textContent='■ End Call';end.disabled=true;
  const timer=document.createElement('span');timer.id='crm2CallTimer';timer.className='call-timer';timer.textContent='00:00';
  host.insertBefore(start,old);host.insertBefore(end,old);host.appendChild(timer);
  const outcome=$('crm2CallOutcome');
  if(outcome){
    const wrap=outcome.closest('.field');
    if(wrap){const cb=document.createElement('div');cb.id='crm2CallbackFields';cb.hidden=true;cb.innerHTML='<label>Callback Date & Time</label><input id="crm2CallbackAt" type="datetime-local"><label>Callback Priority</label><select id="crm2CallbackPriority"><option>normal</option><option>high</option><option>urgent</option><option>express</option></select><label>Callback Notes</label><textarea id="crm2CallbackNotes" maxlength="500" placeholder="Callback reason / notes"></textarea><button type="button" class="btn alt" id="crm2SaveCallback">Save Callback</button><div class="field-error" id="crm2CallbackError"></div>';wrap.parentElement.appendChild(cb)}
    outcome.addEventListener('change',()=>{const box=$('crm2CallbackFields');if(box)box.hidden=outcome.value!=='Callback';});
  }
  start.onclick=startCall;end.onclick=endCall;$('crm2SaveCallback')?.addEventListener('click',saveCallback);
}
async function startCall(){
  if(active)return;
  const m=mobile();if(!validMobile(m)){if($('crm2OrderMobileError'))$('crm2OrderMobileError').textContent='Pehle valid mobile number enter karein.';return}
  const c=ctx(),lead=c.lead;if(!lead?.id){setStatus('Select/open a lead before starting a logged call.');return}
  const user=(await currentProfile())?.id||null;
  const started=new Date();
  const {data,error}=await sb.from('lead_calls').insert({lead_id:lead.id,customer_id:c.customer?.id||lead.customer_id||null,agent_id:user,call_source:'manual_mobile',direction:'outbound',started_at:started.toISOString(),ended_at:null,duration_seconds:0,outcome:null,notes:null}).select().single();
  if(error){setStatus('Unable to start call: '+(error.message||'database error'));return}
  active={id:data.id,startedAt:started};
  $('crm2CallStart').disabled=true;$('crm2CallEnd').disabled=false;$('crm2CallMobile').classList.add('muted');
  setStatus('Calling / In Call');
  clearInterval(tick);tick=setInterval(()=>{$('crm2CallTimer').textContent=fmt((Date.now()-started.getTime())/1000)},250);
}
async function endCall(){
  if(!active)return;
  const call=active;active=null;clearInterval(tick);tick=null;
  const ended=new Date();const duration=Math.max(0,Math.round((ended.getTime()-call.startedAt.getTime())/1000));
  const outcome=$('crm2CallOutcome')?.value||null;const notes=String($('crm2CallNotes')?.value||'').trim()||null;
  const {error}=await sb.from('lead_calls').update({ended_at:ended.toISOString(),duration_seconds:duration,outcome,notes}).eq('id',call.id);
  $('crm2CallTimer').textContent=fmt(duration);$('crm2CallStart').disabled=false;$('crm2CallEnd').disabled=true;setStatus(error?'Call ended locally; log update failed.':'Call completed');
  if(error){console.warn('CRM2 call end update failed',error);return}
  if(outcome==='Callback')await saveCallback();
}
async function saveCallback(){
  const c=ctx(),lead=c.lead;if(!lead?.id){return}
  const input=$('crm2CallbackAt'),err=$('crm2CallbackError');if(!input)return;
  if(!input.value){if(err)err.textContent='Callback date & time required hai.';return}
  const due=new Date(input.value);if(Number.isNaN(due.getTime())||due.getTime()<=Date.now()){if(err)err.textContent='Future callback date & time select karein.';return}
  const user=(await currentProfile())?.id||null;const priority=$('crm2CallbackPriority')?.value||'normal';const reason=String($('crm2CallbackNotes')?.value||$('crm2CallNotes')?.value||'').trim()||'Callback requested';
  const {error}=await sb.from('followups').insert({lead_id:lead.id,customer_id:c.customer?.id||lead.customer_id||null,order_id:null,assigned_to:lead.assigned_to||user,due_at:due.toISOString(),priority,reason,status:'pending',reminder:true});
  if(error){if(err)err.textContent=error.message||'Callback save failed.';return}
  const {error:leadError}=await sb.from('leads').update({status:'callback',next_followup:due.toISOString(),updated_at:new Date().toISOString()}).eq('id',lead.id);
  if(leadError){console.warn('Callback lead update failed',leadError)}
  if(err)err.textContent='Callback scheduled successfully.';
  if($('crm2CallOutcome'))$('crm2CallOutcome').value='Callback';
}
function abandoned(){if(!active)return;const age=Date.now()-active.startedAt.getTime();if(age<6*60*60*1000)return;clearInterval(tick);tick=null;active=null;}
function wire(){
  const workspace=document.querySelector(WS);if(!workspace)return;
  ensureUi();
  const mobileInput=$('crm2OrderMobile');if(mobileInput&&!mobileInput.dataset.callingBound){mobileInput.dataset.callingBound='1';mobileInput.addEventListener('input',()=>{if(!active)setStatus(validMobile(mobile())?'Ready to call':'Enter valid mobile')})}
}
const observer=new MutationObserver(wire);observer.observe(document.body,{subtree:true,childList:true});
window.addEventListener('beforeunload',abandoned);
setInterval(abandoned,30000);
wire();
