import { sb, normalizeMobile, currentProfile } from '../data.js';

const WS='[data-crm2-create-order]';
const ACTIVE_KEY='crm2ActiveCall';
let activeCall=null;
let lastCallId=null;
let timerHandle=null;
let wiredWorkspace=null;
let callStatusMessage='Ready to call';

const $=id=>document.getElementById(id);
const validMobile=v=>/^[6-9]\d{9}$/.test(normalizeMobile(v||''));
const text=v=>String(v??'').trim();
const setMessage=(value,ok=false)=>{const el=$('crm2OrderMessage')||$('crm1DispositionMessage');if(el){el.textContent=value||'';el.classList.toggle('success-msg',!!ok)}};
const setCallStatus=value=>{callStatusMessage=String(value||'');const el=$('crm2CallStatus');if(el)el.textContent=callStatusMessage};
const formatTimer=seconds=>`${String(Math.floor(Math.max(0,seconds)/60)).padStart(2,'0')}:${String(Math.floor(Math.max(0,seconds)%60)).padStart(2,'0')}`;
function mobile(){return normalizeMobile($('crm2OrderMobile')?.value||$('crm1ParityMobile')?.value||'')}
function persistActive(){try{if(activeCall)localStorage.setItem(ACTIVE_KEY,JSON.stringify(activeCall));else localStorage.removeItem(ACTIVE_KEY)}catch(e){console.warn('CRM2 active call persistence failed',e)}}
function renderCall(){
  const start=$('crm2CallStart'),end=$('crm2CallEnd'),timer=$('crm2CallTimer'),parityStart=$('crm2ParityStartCall'),parityEnd=$('crm2ParityEndCall');
  if(activeCall){
    const sec=(Date.now()-new Date(activeCall.startedAt).getTime())/1000;
    if(timer)timer.textContent=formatTimer(sec);
    if($('crm1ParityCallTimer'))$('crm1ParityCallTimer').value=formatTimer(sec);
    if(start)start.disabled=true;if(end)end.disabled=false;if(parityStart)parityStart.disabled=true;if(parityEnd)parityEnd.disabled=false;
    setCallStatus('Calling / In Call');
  }else{
    if(start)start.disabled=false;if(end)end.disabled=true;if(parityStart)parityStart.disabled=false;if(parityEnd)parityEnd.disabled=true;
    if(timer&&timer.textContent==='')timer.textContent='00:00';
    if($('crm2CallStatus'))$('crm2CallStatus').textContent=callStatusMessage||'Ready to call';
  }
  window.dispatchEvent(new CustomEvent('crm2FunctionalCallState',{detail:{active:!!activeCall,callId:activeCall?.id||lastCallId||null}}));
}
function forceRender(){renderCall();requestAnimationFrame(renderCall);setTimeout(renderCall,0);setTimeout(renderCall,100)}
function stopTimer(){if(timerHandle){clearInterval(timerHandle);timerHandle=null}}
function startTimer(){stopTimer();timerHandle=setInterval(renderCall,250);forceRender()}

async function startCall(){
  if(activeCall){forceRender();return}
  const m=mobile();if(!validMobile(m)){setCallStatus('Enter a valid 10-digit mobile first.');if($('crm2OrderMobileError'))$('crm2OrderMobileError').textContent='Valid mobile number required.';return}
  const user=(await currentProfile())?.id||null;if(!user){setCallStatus('Session expired. Please login again.');return}
  setCallStatus('Starting call…');
  const {data,error}=await sb.rpc('crm2_start_manual_call',{p_mobile:m});
  if(error){setCallStatus('Unable to start call: '+(error.message||'database error'));forceRender();return}
  const row=Array.isArray(data)?data[0]:data;if(!row?.call_id){setCallStatus('Unable to start call: no call record returned.');forceRender();return}
  activeCall={id:row.call_id,leadId:row.lead_id||null,customerId:row.customer_id||null,agentId:user,startedAt:row.started_at||new Date().toISOString()};lastCallId=activeCall.id;persistActive();
  window.crm2CreateOrderContext={...(window.crm2CreateOrderContext||{}),lead:{...(window.crm2CreateOrderContext?.lead||{}),id:activeCall.leadId}};
  callStatusMessage='Calling / In Call';forceRender();startTimer();
}

async function endCall(){
  if(!activeCall)return;
  const call=activeCall;stopTimer();setCallStatus('Saving call…');const outcome=text($('crm2CallOutcome')?.value)||null;const notes=text($('crm2CallNotes')?.value)||null;
  const {data,error}=await sb.rpc('crm2_end_manual_call',{p_call_id:call.id,p_outcome:outcome,p_notes:notes});
  if(error){setCallStatus('Unable to save call end: '+(error.message||'database error'));activeCall=call;persistActive();startTimer();return}
  lastCallId=call.id;activeCall=null;persistActive();const duration=Number((Array.isArray(data)?data[0]:data)?.duration_seconds||0);if($('crm2CallTimer'))$('crm2CallTimer').textContent=formatTimer(duration);if($('crm1ParityCallTimer'))$('crm1ParityCallTimer').value=formatTimer(duration);callStatusMessage='Call completed';forceRender();
}

async function logManualCall(){
  const m=mobile();if(!validMobile(m)){setCallStatus('Enter a valid 10-digit mobile first.');return}
  const outcome=text($('crm2CallOutcome')?.value)||'Manual Call Logged';const notes=text($('crm2CallNotes')?.value)||null;const duration=Math.max(0,Number($('crm2CallDuration')?.value)||0);setCallStatus('Logging manual call…');
  const {data,error}=await sb.rpc('crm2_log_manual_call',{p_mobile:m,p_outcome:outcome,p_notes:notes,p_duration_seconds:duration});if(error){setCallStatus('Unable to log manual call: '+(error.message||'database error'));return}const row=Array.isArray(data)?data[0]:data;lastCallId=row?.id||null;callStatusMessage='Manual call logged successfully';forceRender();
}

function callbackBox(panel){if($('crm2FunctionalCallback'))return $('crm2FunctionalCallback');const box=document.createElement('div');box.id='crm2FunctionalCallback';box.className='crm2-functional-callback';box.hidden=true;box.innerHTML='<div class="field"><label>Callback Date & Time *</label><input id="crm2FunctionalCallbackAt" type="datetime-local"></div><div class="field"><label>Callback Priority</label><select id="crm2FunctionalCallbackPriority"><option value="normal">Normal</option><option value="high">High</option><option value="urgent">Urgent</option><option value="express">Express</option></select></div>';panel.appendChild(box);return box}

async function loadDisposition(){
  const l1=$('crm1Disposition1'),l2=$('crm1Disposition2');if(!l1||!l2)return;const {data,error}=await sb.from('disposition_levels').select('id,name,parent_id,level_no').eq('active',true).order('level_no').order('name');if(error){l1.innerHTML='<option value="">Unable to load dispositions</option>';return}
  const rows=data||[],parents=rows.filter(x=>x.level_no===1||x.parent_id===null),display={Lead:'Lead Case','Non Lead':'Non-Lead',Sales:'Sales Order',Language:'Language','Not Connected':'Not Connected',Transfer:'Transfer'};l1.innerHTML='<option value="">Select</option>'+parents.map(x=>`<option value="${x.id}">${display[x.name]||x.name}</option>`).join('');
  const updateChildren=()=>{const name=l1.options[l1.selectedIndex]?.textContent?.trim()||'';let children=rows.filter(x=>x.level_no===2&&x.parent_id===l1.value);if(name==='Sales Order')children=children.filter(x=>['Express Order','Urgent Order','Fresh Order'].includes(x.name));l2.innerHTML='<option value="">Select</option>'+children.map(x=>`<option value="${x.id}">${x.name}</option>`).join('');l2.disabled=!children.length;const cb=$('crm2FunctionalCallback');if(cb)cb.hidden=l2.options[l2.selectedIndex]?.textContent?.trim()!=='Call Back'};
  l1.onchange=updateChildren;l2.onchange=()=>{const cb=$('crm2FunctionalCallback');if(cb)cb.hidden=l2.options[l2.selectedIndex]?.textContent?.trim()!=='Call Back'};callbackBox(l1.closest('.panel')||l1.parentElement?.parentElement);
}

async function setStatus(value){const {error}=await sb.rpc('crm2_set_agent_status',{p_status:value});if(error){setMessage('Unable to save agent status: '+(error.message||'database error'));return false}return true}
async function loadStatus(){const select=$('crm1ParityAgentStatus');if(!select)return;const {data}=await sb.rpc('crm2_get_agent_status');const row=Array.isArray(data)?data[0]:data;if(row?.status)select.value=row.status;if(!select.dataset.functionalStatusBound){select.dataset.functionalStatusBound='1';select.addEventListener('change',async()=>{const value=select.value;select.disabled=true;const ok=await setStatus(value);select.disabled=false;if(ok)setCallStatus(`Agent status: ${value}`)})}}

function collectPayload(){const l1=$('crm1Disposition1'),l2=$('crm1Disposition2'),product=$('crm2OrderProduct')?.selectedOptions?.[0];const quantity=Math.max(1,Number($('crm2OrderQty')?.value)||1),price=Math.max(0,Number(product?.dataset?.price||$('crm2OrderPrice')?.value||0));return {mobile:mobile(),name:text($('crm2OrderName')?.value),alternate_mobile:normalizeMobile($('crm2OrderAlt')?.value||''),age:text($('crm2OrderAge')?.value),gender:text($('crm2OrderGender')?.value),address:text($('crm2OrderAddress')?.value),post:text($('crm2OrderPost')?.value),city:text($('crm2OrderCity')?.value),state:text($('crm2OrderState')?.value),pincode:text($('crm2OrderPincode')?.value),product_id:product?.value||'',product_name:product?.dataset?.name||'',sku:product?.dataset?.sku||'',quantity,unit_price:price,payment_mode:$('crm2OrderPayment')?.value||'COD',source:$('crm2OrderSource')?.value||'Manual',campaign_id:$('crm2OrderCampaign')?.value||'',remarks:text($('crm2OrderRemarks')?.value),disposition_l1_id:l1?.value||'',disposition_l2_id:l2?.value||'',call_id:activeCall?.id||lastCallId||null,duration_seconds:activeCall?Math.round((Date.now()-new Date(activeCall.startedAt).getTime())/1000):Number($('crm2CallDuration')?.value||0),callback_at:$('crm2FunctionalCallbackAt')?.value||'',callback_priority:$('crm2FunctionalCallbackPriority')?.value||'normal'}}

async function submitDisposition(){
  const l1=$('crm1Disposition1'),l2=$('crm1Disposition2');if(!l1?.value){setMessage('Please select Disposition Level 1.');return}if(!l2?.value){setMessage('Please select Disposition Level 2.');return}const payload=collectPayload();if(!validMobile(payload.mobile)){setMessage('Valid customer mobile required.');return}const l2Name=l2.options[l2.selectedIndex]?.textContent?.trim()||'';
  if(l2Name==='Call Back'){if(!payload.callback_at){setMessage('Callback date & time required.');return}if(new Date(payload.callback_at).getTime()<=Date.now()){setMessage('Callback date & time must be in the future.');return}}
  const isSales=['Express Order','Urgent Order','Fresh Order'].includes(l2Name);if(isSales){if(!payload.name){setMessage('Customer name required.');return}if(!payload.address||payload.address.length<5||!/^\d{6}$/.test(payload.pincode)||!payload.state||!payload.city||!payload.post){setMessage('Complete delivery address including Area/Post required.');return}if(!payload.product_id){setMessage('Please select a product.');return}if(payload.unit_price<=0){setMessage('Valid product price required.');return}}
  const button=$('crm1SubmitDisposition');if(button){button.disabled=true;button.textContent='Saving…'}setMessage('Saving disposition…');const {data,error}=await sb.rpc('crm2_submit_disposition',{p_payload:payload});
  if(error){setMessage('Unable to save disposition: '+(error.message||'database error'));if(button){button.disabled=false;button.textContent='Submit Disposition'};return}
  const result=Array.isArray(data)?data[0]:data;if(result?.type==='order')setMessage(`Order ${result.order_code||'created'} successfully.`,true);else if(result?.type==='callback')setMessage('Callback scheduled successfully.',true);else setMessage(`Disposition saved: ${result?.level_2||l2Name}.`,true);activeCall=null;lastCallId=null;persistActive();stopTimer();callStatusMessage=result?.type==='order'?'Order created':result?.type==='callback'?'Callback scheduled':'Disposition saved';forceRender();if(button){button.disabled=false;button.textContent='Submit Disposition'}window.dispatchEvent(new CustomEvent('crm2DispositionSaved',{detail:result}));
}

function wireButtons(){if($('crm2CallStart'))$('crm2CallStart').onclick=startCall;if($('crm2CallEnd'))$('crm2CallEnd').onclick=endCall;if($('crm2ParityStartCall'))$('crm2ParityStartCall').onclick=startCall;if($('crm2ParityEndCall'))$('crm2ParityEndCall').onclick=endCall;if($('crm2ParityLogManual'))$('crm2ParityLogManual').onclick=logManualCall;if($('crm2ParityCallMobile'))$('crm2ParityCallMobile').onclick=e=>{e.preventDefault();startCall()};if($('crm1SubmitDisposition'))$('crm1SubmitDisposition').onclick=submitDisposition;loadStatus();loadDisposition()}
async function restore(){try{const saved=JSON.parse(localStorage.getItem(ACTIVE_KEY)||'null');if(!saved?.id||!saved?.startedAt)return;const user=(await currentProfile())?.id||null;if(!user){localStorage.removeItem(ACTIVE_KEY);return}activeCall={...saved,agentId:saved.agentId||user};lastCallId=activeCall.id;callStatusMessage='Calling / In Call';forceRender();startTimer()}catch(e){console.warn('CRM2 active call restore failed',e)}}
function wire(){const ws=document.querySelector(WS);if(!ws)return;if(wiredWorkspace!==ws){wiredWorkspace=ws;wireButtons();restore()}else{if($('crm1SubmitDisposition'))$('crm1SubmitDisposition').onclick=submitDisposition;if($('crm2CallStart'))$('crm2CallStart').onclick=startCall;if($('crm2CallEnd'))$('crm2CallEnd').onclick=endCall;if($('crm2ParityStartCall'))$('crm2ParityStartCall').onclick=startCall;if($('crm2ParityEndCall'))$('crm2ParityEndCall').onclick=endCall;if($('crm2ParityLogManual'))$('crm2ParityLogManual').onclick=logManualCall}forceRender()}
window.addEventListener('crm2CreateOrderParityReady',forceRender);window.addEventListener('crm2FunctionalStartCall',startCall);window.addEventListener('crm2FunctionalEndCall',endCall);window.addEventListener('crm2FunctionalLogManualCall',logManualCall);window.addEventListener('crm2FunctionalCallRequest',startCall);window.addEventListener('beforeunload',persistActive);const observer=new MutationObserver(()=>{const ws=document.querySelector(WS);if(ws!==wiredWorkspace)wire()});if(document.body)observer.observe(document.body,{subtree:true,childList:true});wire();
