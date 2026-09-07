/* CRM1 Agent Call Console - manual personal-phone calling mode; CRM records lifecycle only. */
(async()=>{'use strict';
const $=id=>document.getElementById(id);let db=window.sb,me=null,agentCfg=null,active=null,timer=null;
const digits=v=>String(v||'').replace(/\D/g,'').slice(-10);
function toast(m){const t=$('toast');if(t){t.textContent=m;t.style.display='block';setTimeout(()=>t.style.display='none',2600)}else console.log(m)}
function bar(){
 if($('crm1CallConsole'))return;
 const host=$('createOrderPage');if(!host)return;
 const e=document.createElement('section');e.id='crm1CallConsole';e.className='panel';e.style.marginBottom='18px';
 e.innerHTML='<div style="display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap">'+
 '<div><h3 style="margin:0">☎ Manual Phone Call Console</h3><div class="sub" id="ccProvider">Call customers from your personal keypad phone. CRM records call timing, disposition and follow-up only.</div></div>'+ 
 '<div id="ccStatus" class="pill">Ready</div></div>'+ 
 '<div class="grid3" style="margin-top:12px"><div class="field"><label>Customer Mobile</label><input id="crm1DialNumber" inputmode="numeric" maxlength="10" placeholder="10 digit mobile"></div>'+ 
 '<div class="field"><label>Agent Status</label><select id="ccAgentStatus"><option value="ready">Ready</option><option value="paused">Paused</option><option value="break">Break</option></select></div>'+ 
 '<div class="field"><label>Call Timer</label><input id="ccTimer" value="00:00" readonly></div></div>'+ 
 '<div class="actions" style="justify-content:flex-start"><button class="btn" id="crm1StartCall" type="button" style="transition:opacity .15s,filter .15s">Start Manual Call</button><button class="btn alt" id="crm1EndCall" type="button" disabled style="transition:opacity .15s,filter .15s">End Call</button><button class="btn alt" id="crm1LogCall" type="button">Log Manual Call</button></div>';
 host.insertBefore(e,host.firstChild);
 $('crm1DialNumber').addEventListener('input',()=>{const n=digits($('crm1DialNumber').value);$('crm1DialNumber').value=n;syncManualNumberToOrder(n)});
 $('crm1DialNumber').addEventListener('change',()=>{const n=digits($('crm1DialNumber').value);$('crm1DialNumber').value=n;syncManualNumberToOrder(n)});
 $('ccAgentStatus').onchange=()=>setAgentStatus($('ccAgentStatus').value);
 $('crm1StartCall').onclick=startCall;$('crm1EndCall').onclick=endCall;
 $('crm1LogCall').onclick=null;
 setCallButtonState(false);
}
function syncManualNumberToOrder(number){
 const p=$('pageMobile');if(!p)return;
 const n=digits(number);
 if(p.value!==n){p.value=n;p.dispatchEvent(new Event('input',{bubbles:true}))}
}
function syncMobileFromOrder(){
 const d=$('crm1DialNumber'),p=$('pageMobile');
 if(!d||!p)return;
 const n=digits(p.value);
 if(n)d.value=n;
}
async function loadExistingCustomer(mobile){
 if(!db||!mobile)return null;
 const q=await db.from('customers').select('id,customer_name,mobile,alternate_mobile,age,gender,pincode,city,state,address,area_post').eq('mobile',mobile).limit(1).maybeSingle();
 if(q.error)return null;
 const data=q.data;if(!data)return null;
 const f=$('createOrderPageForm');if(f){
   const map=['customer_name','mobile','alternate_mobile','age','gender','pincode','address'];
   map.forEach(k=>{if(f.elements[k]&&data[k]!=null)f.elements[k].value=String(data[k])});
 }
 const notice=$('pageExistingCustomer');if(notice)notice.textContent='Existing customer found — saved details loaded.';
 const st=$('orderState'),city=$('orderCity'),post=$('orderPost');
 const savedState=String(data.state||'').trim(),savedCity=String(data.city||'').trim(),savedPost=String(data.area_post||'').trim();
 function pick(sel,val){if(!sel||!val)return false;const opt=[...sel.options].find(o=>o.value===val||o.text.trim().toLowerCase()===val.toLowerCase());if(!opt)return false;sel.value=opt.value;return true}
 if(st&&savedState){pick(st,savedState);st.dispatchEvent(new Event('change',{bubbles:true}))}
 const applyLocation=()=>{
   if(city&&savedCity){if(pick(city,savedCity)){city.dispatchEvent(new Event('change',{bubbles:true}))}}
   if(post&&savedPost)pick(post,savedPost);
 };
 applyLocation();
 let tries=0;const retry=()=>{applyLocation();tries++;if(tries<12)setTimeout(retry,180)};setTimeout(retry,180);
 syncManualNumberToOrder(mobile);
 return data;
}
async function event(type,payload={}){
 if(!db||!me)return null;
 const mobile=digits($('crm1DialNumber')?.value||$('pageMobile')?.value);
 const {data,error}=await db.from('crm_call_events').insert({call_id:active?.id||crypto.randomUUID(),user_id:me.id,lead_id:window.crm1CallContext?.lead_id||null,customer_id:window.crm1CallContext?.customer_id||null,mobile:mobile||null,event_type:type,event_at:new Date().toISOString(),payload}).select('id,call_id').single();
 if(error)console.warn('CRM call event:',error.message);return data;
}
async function loadAgent(){
 const q=await db.from('crm_telephony_agents').select('*').eq('agent_id',me.id).maybeSingle();
 if(q.error)return;agentCfg=q.data||null;
 $('ccAgentStatus').value=agentCfg?.status==='paused'?'paused':'ready';
}
async function setAgentStatus(status){
 if(!agentCfg)return;
 const {error}=await db.from('crm_telephony_agents').update({status,last_seen_at:new Date().toISOString(),updated_at:new Date().toISOString()}).eq('id',agentCfg.id);
 if(error){toast(error.message);return}agentCfg.status=status;await event('agent_status',{status});$('ccStatus').textContent=status[0].toUpperCase()+status.slice(1);
}
function tick(){if(!active)return;const s=Math.floor((Date.now()-active.started)/1000);$('ccTimer').value=String(Math.floor(s/60)).padStart(2,'0')+':'+String(s%60).padStart(2,'0')}
function setCallButtonState(inCall){
 const start=$('crm1StartCall'),end=$('crm1EndCall');if(!start||!end)return;
 if(inCall){
   start.className='btn alt';start.disabled=true;start.style.opacity='.55';start.style.filter='grayscale(.2)';start.style.pointerEvents='none';start.style.background='#fff';start.style.color='var(--g)';
   end.className='btn red';end.disabled=false;end.style.opacity='1';end.style.filter='none';end.style.pointerEvents='auto';end.style.background='var(--red)';end.style.color='#fff';
 }else{
   start.className='btn';start.disabled=false;start.style.opacity='1';start.style.filter='none';start.style.pointerEvents='auto';start.style.background='var(--g)';start.style.color='#fff';
   end.className='btn alt';end.disabled=true;end.style.opacity='1';end.style.filter='none';end.style.pointerEvents='auto';end.style.background='#fff';end.style.color='var(--g)';
 }
}
async function startCall(){
 const mobile=digits($('crm1DialNumber').value||$('pageMobile')?.value);
 if(!/^[6-9]\d{9}$/.test(mobile)){toast('Enter valid 10 digit mobile');return}
 if(active)return;
 syncManualNumberToOrder(mobile);
 const customer=await loadExistingCustomer(mobile);
 if(customer){
   window.crm1SetCallContext?.({lead_id:null,customer_id:customer.id});
 }else if(window.crm1SetCallContext){
   window.crm1SetCallContext({lead_id:null,customer_id:null});
   const notice=$('pageExistingCustomer');if(notice)notice.textContent='No saved customer found — enter new customer details.';
 }
 active={id:crypto.randomUUID(),started:Date.now(),mobile,interactionId:null};
 setCallButtonState(true);$('crm1DialNumber').value=mobile;$('ccStatus').textContent='Calling — use personal phone';
 const ctx=window.crm1CallContext||{};
 const {data:interaction,error:ie}=await db.from('crm_interactions').insert({lead_id:ctx.lead_id||null,customer_id:ctx.customer_id||null,interaction_type:'call',direction:'outbound',provider:'manual_phone',agent_id:me.id,created_by:me.id,status:'in_progress',started_at:new Date().toISOString(),provider_payload:{call_id:active.id,dial_number:mobile,manual_phone:true}}).select('id').single();
 if(!ie)active.interactionId=interaction.id;
 await event('call_started',{provider:'manual_phone',manual_phone:true});timer=setInterval(tick,1000);tick();
 window.dispatchEvent(new CustomEvent('crm1CallStarted',{detail:{call_id:active.id,mobile,provider:'manual_phone',manual_phone:true}}));
}
async function endCall(){
 if(!active)return;clearInterval(timer);timer=null;
 const seconds=Math.floor((Date.now()-active.started)/1000);const finished=active;
 await event('call_ended',{duration_seconds:seconds,provider:'manual_phone',manual_phone:true});
 if(finished.interactionId)await db.from('crm_interactions').update({status:'completed',ended_at:new Date().toISOString(),duration_seconds:seconds,details:'Manual keypad phone call · '+seconds+' sec'}).eq('id',finished.interactionId);
 active=null;setCallButtonState(false);$('ccStatus').textContent='Disposition required';
 window.dispatchEvent(new CustomEvent('crm1CallEnded',{detail:{call_id:finished.id,mobile:finished.mobile,duration_seconds:seconds,provider:'manual_phone',manual_phone:true}}));
}
async function boot(){
 for(let i=0;i<30&&!db;i++){await new Promise(r=>setTimeout(r,100));db=window.sb}if(!db)return;
 const {data:{user}}=await db.auth.getUser();if(!user)return;me=user;bar();loadAgent();
 const sync=()=>syncMobileFromOrder();
 document.addEventListener('crm1WorkspaceCall',e=>{const n=digits(e.detail?.number);if(n)syncManualNumberToOrder(n)});
 document.addEventListener('crm1LeadCallReady',e=>{const n=digits(e.detail?.mobile);if(!n)return;syncManualNumberToOrder(n);const d=$('crm1DialNumber');if(d)d.value=n});
 document.addEventListener('crm1CallStarted',sync);
 const pageMobile=$('pageMobile');
 if(pageMobile){pageMobile.addEventListener('input',sync);pageMobile.addEventListener('change',sync)}
 sync();
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
