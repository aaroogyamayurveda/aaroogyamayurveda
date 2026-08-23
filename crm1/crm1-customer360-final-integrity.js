/* CRM1 Customer 360 complete activity timeline. Uses the already-authenticated CRM Supabase client. */
(function(){
'use strict';
var started=false,lastMobile='';
function esc(v){return String(v==null?'':v).replace(/[&<>"']/g,function(m){return({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m])})}
function fmt(v){return v?new Intl.DateTimeFormat('en-IN',{timeZone:'Asia/Kolkata',dateStyle:'medium',timeStyle:'short'}).format(new Date(v)):'-'}
function mobileFromDom(){
 var el=document.getElementById('crm360Result');if(!el)return '';
 var m=(el.textContent||'').match(/\b[6-9]\d{9}\b/);return m?m[0]:'';
}
function ensureStyle(){if(document.getElementById('crm1C360TimelineStyle'))return;var s=document.createElement('style');s.id='crm1C360TimelineStyle';s.textContent='.crm1-c360-integrity{margin-top:14px}.crm1-c360-integrity table{width:100%;border-collapse:collapse;font-size:12px}.crm1-c360-integrity th,.crm1-c360-integrity td{text-align:left;padding:9px;border-bottom:1px solid #edf1ee;vertical-align:top}.crm1-c360-integrity th{color:#164b30;background:#f7faf7}.crm1-c360-integrity .evt{font-weight:800;color:#164b30}.crm1-c360-integrity .muted{color:#69756e;font-size:12px}';document.head.appendChild(s)}
async function render(mobile){
 if(!window.sb||!mobile||mobile===lastMobile&&document.getElementById('crm1C360CompleteTimeline'))return;
 var out=document.getElementById('crm360Result');if(!out)return;
 lastMobile=mobile;ensureStyle();
 var old=document.getElementById('crm1C360CompleteTimeline');if(old)old.remove();
 var box=document.createElement('div');box.id='crm1C360CompleteTimeline';box.className='panel crm1-c360-integrity';box.innerHTML='<h3>Complete Activity Timeline</h3><div class="muted">Loading lead, calls, follow-ups, orders and order-status history…</div>';out.appendChild(box);
 try{
  var custR=await window.sb.from('customers').select('id,customer_name').eq('mobile',mobile).maybeSingle();
  var cid=custR.data&&custR.data.id;
  var qLead=window.sb.from('crm_leads').select('id,lead_name,lead_status,product_name,next_followup_at,conversion_order_id,created_at,updated_at').eq('mobile',mobile).order('created_at',{ascending:false});
  var qOrders=cid?window.sb.from('orders').select('id,order_no,order_status,verification_status,order_type,order_priority,total_amount,created_at,updated_at').eq('customer_id',cid).order('created_at',{ascending:false}):window.sb.from('orders').select('id,order_no,order_status,verification_status,order_type,order_priority,total_amount,created_at,updated_at').eq('mobile',mobile).order('created_at',{ascending:false});
  var qFollow=cid?window.sb.from('followups').select('id,followup_at,status,disposition,notes,order_id,created_at').eq('customer_id',cid).order('followup_at',{ascending:false}):Promise.resolve({data:[]});
  var qInt=cid?window.sb.from('crm_interactions').select('id,interaction_type,direction,status,disposition,subject,details,order_id,started_at,created_at').eq('customer_id',cid).order('created_at',{ascending:false}).limit(500):Promise.resolve({data:[]});
  var rs=await Promise.all([qLead,qOrders,qFollow,qInt]);rs.forEach(function(x){if(x&&x.error)throw x.error});
  var leads=rs[0].data||[],orders=rs[1].data||[],follow=rs[2].data||[],ints=rs[3].data||[];
  var hist=[];
  if(orders.length){var ids=orders.map(function(o){return o.id});var hr=await window.sb.from('order_status_history').select('id,order_id,old_status,new_status,changed_by,remarks,created_at').in('order_id',ids).order('created_at',{ascending:false});if(hr.error)throw hr.error;hist=hr.data||[]}
  var events=[];
  leads.forEach(function(x){events.push({at:x.created_at,type:'Lead',status:x.lead_status||'new',order:x.conversion_order_id?'Linked to order':'-',details:[x.lead_name,x.product_name].filter(Boolean).join(' · ')||'Lead created'})});
  ints.forEach(function(x){events.push({at:x.created_at||x.started_at,type:'Call / Interaction',status:x.disposition||x.status||'-',order:x.order_id?'Linked':'-',details:[x.direction,x.subject||x.details].filter(Boolean).join(' · ')||x.interaction_type||'Interaction'})});
  follow.forEach(function(x){events.push({at:x.followup_at||x.created_at,type:'Follow-up',status:x.status||'-',order:x.order_id?'Linked':'-',details:[x.disposition,x.notes].filter(Boolean).join(' · ')||'Follow-up'})});
  orders.forEach(function(x){events.push({at:x.created_at,type:'Order Created',status:x.order_status||'new',order:'#'+x.order_no,details:[x.order_type,x.order_priority,x.verification_status,'₹'+(x.total_amount||0)].filter(Boolean).join(' · ')})});
  hist.forEach(function(x){var o=orders.find(function(y){return y.id===x.order_id});events.push({at:x.created_at,type:'Order Status',status:(x.old_status||'—')+' → '+(x.new_status||'—'),order:o?'#'+o.order_no:'-',details:x.remarks||'Status changed'})});
  events.sort(function(a,b){return new Date(b.at||0)-new Date(a.at||0)});
  box.innerHTML='<h3>Complete Activity Timeline</h3><div class="muted">All activity for this customer, shown in IST</div><div class="tablewrap" style="margin-top:10px"><table><thead><tr><th>Date / Time</th><th>Event</th><th>Status</th><th>Order</th><th>Details</th></tr></thead><tbody>'+(events.map(function(x){return '<tr><td>'+esc(fmt(x.at))+'</td><td class="evt">'+esc(x.type)+'</td><td>'+esc(x.status)+'</td><td>'+esc(x.order)+'</td><td>'+esc(x.details)+'</td></tr>'}).join('')||'<tr><td colspan="5">No activity found</td></tr>')+'</tbody></table></div>';
 }catch(e){box.innerHTML='<h3>Complete Activity Timeline</h3><div style="color:#b43b35">Unable to load timeline: '+esc(e.message||e)+'</div>'}
}
function init(){
 if(started)return;started=true;
 var n=0,t=setInterval(function(){
  var out=document.getElementById('crm360Result');
  if(out){var m=mobileFromDom();if(m)render(m);var mo=new MutationObserver(function(){var x=mobileFromDom();if(x)render(x)});mo.observe(out,{childList:true,subtree:true,characterData:true});clearInterval(t)}
  if(++n>120)clearInterval(t);
 },250);
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
