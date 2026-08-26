/* CRM1 Agent Call Console - manual personal-phone calling mode; CRM records lifecycle only. */
(async()=>{'use strict';
const $=id=>document.getElementById(id);let db=window.sb,me=null,agentCfg=null,active=null,timer=null;
const digits=v=>String(v||'').replace(/\D/g,'').slice(-10);
function toast(m){const t=$('toast');if(t){t.textContent=m;t.style.display='block';setTimeout(()=>t.style.display='none',2600)}else console.log(m)}
function callVisual(active){const s=$('crm1StartCall'),e=$('crm1EndCall');if(!s||!e)return;s.classList.toggle('crm1-call-active',!!active);e.classList.toggle('crm1-end-ready',!!active)}
function bar(){
 if($('crm1CallConsole'))return;
 const host=$('createOrderPage');if(!host)return;
 if(!$('crm1CallVisualStyle')){const st=document.createElement('style');st.id='crm1CallVisualStyle';st.textContent='#crm1StartCall{background:#1f9d55!important;color:#fff!important;transition:opacity .18s ease,filter .18s ease,transform .18s ease}#crm1StartCall.crm1-call-active{opacity:.55;filter:saturate(.72);cursor:not-allowed}#crm1EndCall{transition:opacity .18s ease,background .18s ease,color .18s ease,border-color .18s ease;opacity:.52}#crm1EndCall.crm1-end-ready{background:#c83b36!important;color:#fff!important;border-color:#c83b36!important;opacity:1}#crm1EndCall:disabled{opacity:.52!important}';document.head.appendChild(st)}
 const e=document.createElement('section');e.id='crm1CallConsole';e.className='panel';e.style.marginBottom='18px';
 e.innerHTML='<div style="display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap">'+
 '<div><h3 style="margin:0">☎ Manual Phone Call Console</h3><div class="sub" id="ccProvider">Call customers from your personal keypad phone. CRM records call timing, disposition and follow-up only.</div></div>'+
 '<div id="ccStatus" class="pill">Ready</div></div>'+
 '<div class="grid3" style="margin-top:12px"><div class="field"><label>Customer Mobile</label><input id="crm1DialNumber" inputmode="numeric" maxlength="10" placeholder="10 digit mobile"></div>'+
 '<div class="field"><label>Agent Status</label><select id="ccAgentStatus"><option value="ready">Ready</option><option value="paused">Paused</option><option value="break">Break</option></select></div>'+
 '<div class="field"><label>Call Timer</label><input id="ccTimer" value="00:00" readonly></div></div>'+
 '<div class="actions" style="justify-content:flex-start"><button class="btn" id="crm1StartCall" type="button">Start Manual Call</button><button class="btn alt" id="crm1EndCall" type="button" disabled>End Call</button><button class="btn alt" id="crm1LogCall" type="button">Log Manual Call</button></div>';
 host.insertBefore(e,host.firstChild);callVisual(false);
 $('crm1DialNumber').addEventListener('input',()=>{$('crm1DialNumber').value=digits($('crm1DialNumber').value)});
 $('crm1DialNumber').addEventListener('change',()=>{const p=$('pageMobile');if(p&&digits(p.value)!==digits($('crm1DialNumber').value)){p.value=digits(p.value);p.dispatchEvent(new Event('input',{bubbles:true}))}});
 $('ccAgentStatus').onchange=()=>setAgentStatus($('ccAgentStatus').value);
 $('crm1StartCall').onclick=startCall;$('crm1EndCall').onclick=endCall;
 $('crm1LogCall').onclick=null;
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
async function startCall(){
 const mobile=digits($('crm1DialNumber').value||$('pageMobile')?.value);
 if(!/^[6-9]\d{9}$/.test(mobile)){toast('Enter valid 10 digit mobile');return}
 if(active)return;
 active={id:crypto.randomUUID(),started:Date.now(),mobile,interactionId:null};
 $('crm1DialNumber').value=mobile;$('crm1StartCall').disabled=true;$('crm1EndCall').disabled=false;callVisual(true);$('ccStatus').textContent='Calling — use personal phone';
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
 active=null;$('crm1StartCall').disabled=false;$('crm1EndCall').disabled=true;callVisual(false);$('ccStatus').textContent='Disposition required';
 window.dispatchEvent(new CustomEvent('crm1CallEnded',{detail:{call_id:finished.id,mobile:finished.mobile,duration_seconds:seconds,provider:'manual_phone',manual_phone:true}}));
}
async function boot(){
 for(let i=0;i<30&&!db;i++){await new Promise(r=>setTimeout(r,100));db=window.sb}if(!db)return;
 const {data:{user}}=await db.auth.getUser();if(!user)return;me=user;bar();loadAgent();
 document.addEventListener('crm1WorkspaceCall',e=>{const n=digits(e.detail?.number);if(n)$('crm1DialNumber').value=n});
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();