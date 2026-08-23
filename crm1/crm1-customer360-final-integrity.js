/* CRM1 Customer 360 final integrity layer: unified lead, customer, follow-up, order and timeline context. */
(function(){
'use strict';
const URL='https://ielebadardbzmoxantsc.supabase.co';
const KEY='sb_publishable_0pekrOT6vhYZYQ48wHr7Ag_NPcpobGj';
let db=null,started=false;
const esc=v=>String(v==null?'':v).replace(/[&<>\"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',"'":'&#39;'}[m]));
const pickMobile=args=>{const scan=v=>{if(v==null)return '';if(typeof v==='string'||typeof v==='number'){const m=String(v).replace(/\D/g,'');return /^[6-9]\d{9}$/.test(m)?m:'';}if(typeof v==='object'){for(const k of ['mobile','phone','customer_mobile','mobile_number']){if(v[k]){const m=String(v[k]).replace(/\D/g,'');if(/^[6-9]\d{9}$/.test(m))return m;}}for(const k of Object.keys(v)){const m=scan(v[k]);if(m)return m;}}return '';};for(const a of args){const m=scan(a);if(m)return m;}return '';};
const formatDate=v=>v?new Intl.DateTimeFormat('en-IN',{timeZone:'Asia/Kolkata',dateStyle:'medium',timeStyle:'short'}).format(new Date(v)):'-';
function styles(){if(document.getElementById('crm1C360IntegrityStyle'))return;const s=document.createElement('style');s.id='crm1C360IntegrityStyle';s.textContent='.crm1-c360-integrity{margin-top:14px}.crm1-c360-grid{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:10px}.crm1-c360-card{background:#fff;border:1px solid #dfe7e1;border-radius:12px;padding:12px}.crm1-c360-card small{display:block;color:#69756e;font-size:11px}.crm1-c360-card b{display:block;color:#164b30;font-size:20px;margin-top:3px}.crm1-c360-timeline{margin-top:12px}.crm1-c360-timeline table{width:100%;border-collapse:collapse;font-size:12px}.crm1-c360-timeline th,.crm1-c360-timeline td{text-align:left;padding:8px;border-bottom:1px solid #edf1ee}.crm1-c360-type{font-weight:800;color:#164b30}.crm1-c360-muted{color:#69756e}@media(max-width:900px){.crm1-c360-grid{grid-template-columns:repeat(2,1fr)}}';document.head.appendChild(s)}
function ensurePanel(){const out=document.getElementById('crm360Result');if(!out)return null;let p=document.getElementById('crm1C360Integrity');if(!p){p=document.createElement('div');p.id='crm1C360Integrity';p.className='panel crm1-c360-integrity';out.appendChild(p)}return p}
async function load(mobile){
  const p=ensurePanel();if(!p||!mobile||!db)return;
  p.innerHTML='<h3>Customer 360 Unified Context</h3><div class="sub">Loading linked CRM records…</div>';
  try{
    const custR=await db.from('customers').select('*').eq('mobile',mobile).maybeSingle();
    const cust=custR.data||null;const cid=cust?.id||null;
    const results=await Promise.all([
      db.from('crm_leads').select('id,lead_name,lead_status,assigned_to,product_name,next_followup_at,conversion_order_id,created_at,updated_at').eq('mobile',mobile).order('created_at',{ascending:false}),
      cid?db.from('orders').select('id,order_no,order_status,verification_status,order_type,order_priority,total_amount,agent_id,dealer_id,courier_id,created_at,updated_at').eq('customer_id',cid).order('created_at',{ascending:false}):db.from('orders').select('id,order_no,order_status,verification_status,order_type,order_priority,total_amount,agent_id,dealer_id,courier_id,created_at,updated_at').eq('shipping_address',mobile),
      cid?db.from('followups').select('id,followup_at,status,disposition,notes,order_id,created_at').eq('customer_id',cid).order('followup_at',{ascending:false}):db.from('followups').select('id,followup_at,status,disposition,notes,order_id,created_at').eq('id','00000000-0000-0000-0000-000000000000'),
      cid?db.from('crm_interactions').select('id,interaction_type,direction,status,disposition,subject,details,started_at,ended_at,duration_seconds,order_id,created_at').eq('customer_id',cid).order('created_at',{ascending:false}).limit(200):db.from('crm_interactions').select('id,interaction_type,direction,status,disposition,subject,details,started_at,ended_at,duration_seconds,order_id,created_at').eq('id','00000000-0000-0000-0000-000000000000'),
      cid?db.from('order_status_history').select('id,order_id,old_status,new_status,changed_by,remarks,created_at').in('order_id',[]).order('created_at',{ascending:true}):Promise.resolve({data:[],error:null})
    ]);
    const leads=results[0].data||[],orders=results[1].data||[],fus=results[2].data||[],ints=results[3].data||[];
    let histories=[];
    if(orders.length){const ids=orders.map(o=>o.id);const h=await db.from('order_status_history').select('id,order_id,old_status,new_status,changed_by,remarks,created_at').in('order_id',ids).order('created_at',{ascending:true});if(h.error)throw h.error;histories=h.data||[];}
    const activeFu=fus.filter(x=>String(x.status||'').toLowerCase()==='pending').length;
    const timeline=[];
    leads.forEach(x=>timeline.push({at:x.created_at,type:'Lead',status:x.lead_status||'new',order:x.conversion_order_id?'Order linked':'-',details:[x.product_name||'',x.lead_name||''].filter(Boolean).join(' · ')||'Lead created'}));
    fus.forEach(x=>timeline.push({at:x.followup_at||x.created_at,type:'Follow-up',status:x.status||'-',order:x.order_id?'Order linked':'-',details:[x.disposition||'',x.notes||''].filter(Boolean).join(' · ')||'Follow-up'}));
    ints.forEach(x=>timeline.push({at:x.created_at||x.started_at,type:'Call / Interaction',status:x.disposition||x.status||'-',order:x.order_id?'Order linked':'-',details:[x.direction||'',x.subject||x.details||''].filter(Boolean).join(' · ')||x.interaction_type||'Interaction'}));
    orders.forEach(o=>timeline.push({at:o.created_at,type:'Order',status:o.order_status||'new',order:'#'+o.order_no,details:[o.order_type||'order',o.order_priority||'',o.verification_status||'pending',o.total_amount!=null?'₹'+o.total_amount:''].filter(Boolean).join(' · ')}));
    histories.forEach(h=>timeline.push({at:h.created_at,type:'Order Status',status:[h.old_status||'—','→',h.new_status||'—'].join(' '),order:(orders.find(o=>o.id===h.order_id)?.order_no!=null)?'#'+orders.find(o=>o.id===h.order_id).order_no:'-',details:h.remarks||'Status changed'}));
    timeline.sort((a,b)=>new Date(b.at||0)-new Date(a.at||0));
    p.innerHTML='<h3>Customer 360 Unified Context</h3>'+ '<div class="crm1-c360-grid">'+
      '<div class="crm1-c360-card"><small>Customer</small><b>'+esc(cust?.customer_name||leads[0]?.lead_name||'-')+'</b></div>'+
      '<div class="crm1-c360-card"><small>Mobile</small><b>'+esc(mobile)+'</b></div>'+\
      '<div class="crm1-c360-card"><small>Leads</small><b>'+leads.length+'</b></div>'+\
      '<div class="crm1-c360-card"><small>Orders</small><b>'+orders.length+'</b></div>'+\
      '<div class="crm1-c360-card"><small>Active Follow-ups</small><b>'+activeFu+'</b></div>'+\
      '</div>'+
      '<div class="crm1-c360-timeline"><h4 style="color:#164b30;margin:14px 0 8px">Complete Activity Timeline</h4><div class="crm1-c360-muted" style="margin-bottom:8px">Lead, call, follow-up, order and order-status events in chronological order</div><table><thead><tr><th>Date / Time</th><th>Type</th><th>Status</th><th>Order</th><th>Details</th></tr></thead><tbody>'+
      (timeline.map(x=>'<tr><td>'+esc(formatDate(x.at))+'</td><td class="crm1-c360-type">'+esc(x.type)+'</td><td>'+esc(x.status||'-')+'</td><td>'+esc(x.order||'-')+'</td><td>'+esc(x.details||'-')+'</td></tr>').join('')||'<tr><td colspan="5">No activity found</td></tr>')+
      '</tbody></table></div>';
  }catch(e){p.innerHTML='<h3>Customer 360 Unified Context</h3><div style="color:#b43b35;font-size:13px">Unable to load unified context: '+esc(e.message||e)+'</div>'}
}
async function init(){
  if(started)return;started=true;styles();
  if(!window.supabase?.createClient)return;db=window.supabase.createClient(URL,KEY);
  const hook=()=>{const orig=window.customer360;if(typeof orig!=='function'||orig.__crm1C360Integrity)return false;const wrapped=async function(...args){const r=await orig.apply(this,args);setTimeout(()=>{const m=pickMobile(args);if(m)load(m)},100);return r};wrapped.__crm1C360Integrity=true;window.customer360=wrapped;return true;};
  if(!hook()){let n=0;const t=setInterval(()=>{if(hook()||++n>120)clearInterval(t)},250)}
  window.addEventListener('crm1Customer360Rendered',()=>{const m=pickMobile([window.currentCustomer360,window.selectedCustomer,window.currentLead]);if(m)load(m)});
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();