/* CRM1 Follow-up / Verification reliability patch. */
(async()=>{
  'use strict';
  const URL='https://ielebadardbzmoxantsc.supabase.co';
  const KEY='sb_publishable_0pekrOT6vhYZYQ48wHr7Ag_NPcpobGj';
  const $=id=>document.getElementById(id);
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const fmt=v=>{if(!v)return '-';const d=new Date(v);return Number.isNaN(d.getTime())?String(v):new Intl.DateTimeFormat('en-IN',{timeZone:'Asia/Kolkata',day:'2-digit',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit',hour12:true}).format(d)};
  let db=window.sb||null,me=null,rendering=false;
  try{if(!db){const {createClient}=await import('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm');db=createClient(URL,KEY);window.sb=window.sb||db;}const {data:{user}}=await db.auth.getUser();me=user||null;}catch(e){console.warn('CRM1 verification patch init failed',e);return;}
  async function hasActiveFollowup(orderId){const {data,error}=await db.from('followups').select('id,status').eq('order_id',orderId).in('status',['pending','open','scheduled','followup']).limit(1);if(error){console.warn(error);return false}return !!data?.length}
  function followupModal(orderId){
    document.getElementById('crm1FollowupModal')?.remove();
    const now=new Date(Date.now()+3600000);now.setSeconds(0,0);
    const modal=document.createElement('div');modal.id='crm1FollowupModal';
    modal.style.cssText='position:fixed;inset:0;background:rgba(0,0,0,.45);z-index:99999;display:flex;align-items:center;justify-content:center;padding:16px';
    modal.innerHTML=`<div style="background:#fff;color:#1f2937;width:min(430px,100%);border-radius:14px;padding:22px;box-shadow:0 20px 50px rgba(0,0,0,.28);font-family:inherit"><div style="font-size:20px;font-weight:700;margin-bottom:5px">Schedule Follow-up</div><div style="font-size:13px;color:#6b7280;margin-bottom:18px">Select the follow-up date and time.</div><label style="display:block;font-size:13px;font-weight:600;margin-bottom:6px">Date & Time</label><input id="crm1FollowupDate" type="datetime-local" step="60" value="${now.toISOString().slice(0,16)}" style="box-sizing:border-box;width:100%;padding:11px;border:1px solid #cbd5e1;border-radius:8px;font:inherit;margin-bottom:15px"><label style="display:block;font-size:13px;font-weight:600;margin-bottom:6px">Note</label><textarea id="crm1FollowupNote" placeholder="Enter follow-up note" rows="3" style="box-sizing:border-box;width:100%;padding:11px;border:1px solid #cbd5e1;border-radius:8px;font:inherit;resize:vertical">Customer follow-up</textarea><div style="display:flex;justify-content:flex-end;gap:10px;margin-top:20px"><button id="crm1FollowupCancel" type="button" style="padding:10px 18px;border:1px solid #cbd5e1;background:#fff;border-radius:8px;cursor:pointer">Cancel</button><button id="crm1FollowupSave" type="button" style="padding:10px 18px;border:0;background:#166534;color:#fff;border-radius:8px;cursor:pointer;font-weight:600">Schedule</button></div></div>`;
    document.body.appendChild(modal);const close=()=>modal.remove();modal.querySelector('#crm1FollowupCancel').onclick=close;modal.onclick=e=>{if(e.target===modal)close();};
    modal.querySelector('#crm1FollowupSave').onclick=async()=>{const date=modal.querySelector('#crm1FollowupDate').value,note=modal.querySelector('#crm1FollowupNote').value.trim();if(!date){alert('Please select follow-up date and time.');return}const save=modal.querySelector('#crm1FollowupSave');save.disabled=true;save.textContent='Saving...';const iso=new Date(date).toISOString();const {data:order,error:oe}=await db.from('orders').select('customer_id').eq('id',orderId).maybeSingle();if(oe||!order){alert(oe?.message||'Order not found');save.disabled=false;save.textContent='Schedule';return}const {error}=await db.from('followups').insert({order_id:orderId,customer_id:order.customer_id||null,assigned_to:me?.id||null,followup_at:iso,note:note||'Customer follow-up',notes:note||'Customer follow-up',status:'pending'});if(error){alert(error.message);save.disabled=false;save.textContent='Schedule';return}await db.from('orders').update({next_followup_at:iso}).eq('id',orderId);close();await renderVerification();alert('Follow-up scheduled successfully.');};
  }
  async function renderVerification(){const c=$('verificationContent');if(!c||rendering)return;rendering=true;c.innerHTML='<div class="crm1-muted">Loading...</div>';try{const {data,error}=await db.from('orders').select('id,order_no,verification_status,total_amount,order_date,remarks,customers(customer_name,mobile)').order('order_date',{ascending:false}).limit(500);if(error)throw error;const base=(data||[]).filter(o=>!String(o.remarks||'').includes('[ENQUIRY]')&&String(o.verification_status||'pending')==='pending');const checks=await Promise.all(base.map(async o=>({o,active:await hasActiveFollowup(o.id)})));const rows=checks.filter(x=>!x.active).map(x=>x.o);c.innerHTML=`<div class="crm1-toolbar"><span class="crm1-badge warn">${rows.length} verification pending</span></div><div class="tablewrap"><table><thead><tr><th>Order</th><th>Customer</th><th>Mobile</th><th>Amount</th><th>Created</th><th>Action</th></tr></thead><tbody>${rows.map(o=>`<tr><td>#${esc(o.order_no)}</td><td>${esc(o.customers?.customer_name||'-')}</td><td>${esc(o.customers?.mobile||'-')}</td><td>₹${Number(o.total_amount||0).toLocaleString('en-IN')}</td><td>${fmt(o.order_date)}</td><td><button class="crm1-mini crm1VerifyFix" data-id="${esc(o.id)}" data-v="verified">Verify</button> <button class="crm1-mini crm1VerifyFix" data-id="${esc(o.id)}" data-v="failed">Reject</button> <button class="crm1-mini crm1FollowFromVerify" data-id="${esc(o.id)}">Follow-up</button></td></tr>`).join('')||'<tr><td colspan="6" class="empty">No pending verification</td></tr>'}</tbody></table></div>`;c.querySelectorAll('.crm1FollowFromVerify').forEach(b=>b.onclick=()=>followupModal(b.dataset.id));c.querySelectorAll('.crm1VerifyFix').forEach(b=>b.onclick=async()=>{const v=b.dataset.v;if(v==='failed'&&!confirm('Reject this order verification?'))return;b.disabled=true;const payload={verification_status:v,verified_by:me?.id||null,verified_at:new Date().toISOString()};if(v==='verified')payload.order_status='new';const {error:updateError}=await db.from('orders').update(payload).eq('id',b.dataset.id);if(updateError){alert(updateError.message);b.disabled=false;return}await db.from('order_status_history').insert({order_id:b.dataset.id,new_status:v,changed_by:me?.id||null});await renderVerification();});}catch(e){c.innerHTML=`<div class="msg">Verification Queue load failed: ${esc(e?.message||e)}</div>`;}finally{rendering=false;}}

  function activeVerification(){return $('verification')?.classList.contains('active');}

  /* IMPORTANT: Do not observe arbitrary class mutations here.
     Hover/focus/navigation UI changes can mutate class attributes and were causing
     the entire Verification Queue to re-render on mouse movement. The queue must
     only refresh on explicit actions or an explicit navigation into the page. */
  document.addEventListener('click',e=>{
    const b=e.target.closest('button');
    if(!b)return;
    if(/verification queue/i.test(b.textContent||'')){
      setTimeout(()=>{if(activeVerification())renderVerification();},80);
    }
  },true);

  function bootVerification(){
    if(activeVerification())setTimeout(renderVerification,120);
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',bootVerification,{once:true});
  else bootVerification();

  window.crm1RenderVerificationFixed=renderVerification;
})();
