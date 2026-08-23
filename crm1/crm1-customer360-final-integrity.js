/* CRM1 Customer 360 complete activity timeline - DOM-independent loader. */
(function(){
'use strict';
var started=false,lastMobile='',rendering=false;
function esc(v){return String(v==null?'':v).replace(/[&<>\"']/g,function(m){return({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',"'":'&#039;'})[m]})}
function fmt(v){return v?new Intl.DateTimeFormat('en-IN',{timeZone:'Asia/Kolkata',dateStyle:'medium',timeStyle:'short'}).format(new Date(v)):'-'}
function getSearchMobile(){
  /* Customer 360 owns the 10-digit mobile search input. Never infer the mobile
     from the whole page because hidden/old page content can contain another number. */
  var inputs=document.querySelectorAll('input');
  for(var i=0;i<inputs.length;i++){
    var p=String(inputs[i].placeholder||'').toLowerCase();
    var v=String(inputs[i].value||'').replace(/\D/g,'');
    if(p.indexOf('10 digit mobile')>=0 && /^[6-9]\d{9}$/.test(v)) return v;
  }
  return '';
}
function root(){
  return document.getElementById('crm360Result')||document.querySelector('.main .page.active')||document.querySelector('.main');
}
function style(){if(document.getElementById('crm1C360TimelineStyle'))return;var s=document.createElement('style');s.id='crm1C360TimelineStyle';s.textContent='.crm1-c360-integrity{margin-top:18px;margin-bottom:18px}.crm1-c360-integrity table{width:100%;border-collapse:collapse;font-size:12px}.crm1-c360-integrity th,.crm1-c360-integrity td{text-align:left;padding:9px;border-bottom:1px solid #edf1ee;vertical-align:top}.crm1-c360-integrity th{color:#164b30;background:#f7faf7}.crm1-c360-integrity .evt{font-weight:800;color:#164b30}.crm1-c360-integrity .muted{color:#69756e;font-size:12px}.crm1-c360-error{color:#b43b35;font-size:13px}';document.head.appendChild(s)}
function place(box,host){var panels=host.querySelectorAll('.panel');if(panels.length){panels[0].parentNode.insertBefore(box,panels[0])}else{host.appendChild(box)}}
async function render(mobile){
 if(rendering||!window.sb||!mobile)return;
 var host=root();if(!host)return;
 if(lastMobile===mobile&&document.getElementById('crm1C360CompleteTimeline'))return;
 rendering=true;lastMobile=mobile;style();
 var old=document.getElementById('crm1C360CompleteTimeline');if(old)old.remove();
 var box=document.createElement('div');box.id='crm1C360CompleteTimeline';box.className='panel crm1-c360-integrity';box.innerHTML='<h3>Complete Activity Timeline</h3><div class="muted">Loading lead, calls, follow-ups, orders and order-status history…</div>';place(box,host);
 try{
  var custR=await window.sb.from('customers').select('id,customer_name').eq('mobile',mobile).maybeSingle();
  if(custR.error)throw custR.error;
  var cust=custR.data||null,cid=cust&&cust.id;
  if(!cid)throw new Error('Customer record not found for mobile '+mobile);
  var leadR=await window.sb.from('crm_leads').select('id,lead_name,lead_status,product_name,conversion_order_id,created_at,updated_at').eq('mobile',mobile).order('created_at',{ascending:false});
  if(leadR.error)throw leadR.error;
  var leads=leadR.data||[];
  var orderP=window.sb.from('orders').select('id,order_no,order_status,verification_status,order_type,order_priority,total_amount,created_at,updated_at').eq('customer_id',cid).order('created_at',{ascending:false});
  var followP=window.sb.from('followups').select('id,followup_at,status,disposition,notes,order_id,created_at').eq('customer_id',cid).order('followup_at',{ascending:false});
  var intP=window.sb.from('crm_interactions').select('id,interaction_type,direction,status,disposition,subject,details,order_id,started_at,created_at').eq('customer_id',cid).order('created_at',{ascending:false}).limit(500);
  var rs=await Promise.all([orderP,followP,intP]);rs.forEach(function(r){if(r&&r.error)throw r.error});
  var orders=rs[0].data||[],follow=rs[1].data||[],ints=rs[2].data||[],hist=[];
  if(orders.length){var ids=orders.map(function(o){return o.id});var hr=await window.sb.from('order_status_history').select('id,order_id,old_status,new_status,remarks,created_at').in('order_id',ids).order('created_at',{ascending:false});if(!hr.error)hist=hr.data||[]}
  var ev=[];
  leads.forEach(function(x){ev.push({at:x.created_at,type:'Lead',status:x.lead_status||'new',order:x.conversion_order_id?'Linked':'-',details:[x.lead_name,x.product_name].filter(Boolean).join(' · ')||'Lead created'})});
  ints.forEach(function(x){ev.push({at:x.created_at||x.started_at,type:'Call / Interaction',status:x.disposition||x.status||'-',order:x.order_id?'Linked':'-',details:[x.direction,x.subject||x.details].filter(Boolean).join(' · ')||x.interaction_type||'Interaction'})});
  follow.forEach(function(x){ev.push({at:x.followup_at||x.created_at,type:'Follow-up',status:x.status||'-',order:x.order_id?'Linked':'-',details:[x.disposition,x.notes].filter(Boolean).join(' · ')||'Follow-up'})});
  orders.forEach(function(x){ev.push({at:x.created_at,type:'Order Created',status:x.order_status||'new',order:'#'+x.order_no,details:[x.order_type,x.order_priority,x.verification_status,x.total_amount!=null?'₹'+x.total_amount:''].filter(Boolean).join(' · ')})});
  hist.forEach(function(x){var o=orders.find(function(y){return y.id===x.order_id});ev.push({at:x.created_at,type:'Order Status',status:(x.old_status||'—')+' → '+(x.new_status||'—'),order:o?'#'+o.order_no:'-',details:x.remarks||'Status changed'})});
  ev.sort(function(a,b){return new Date(b.at||0)-new Date(a.at||0)});
  box.innerHTML='<h3>Complete Activity Timeline</h3><div class="muted">All activity for this customer, shown in IST</div><div class="tablewrap" style="margin-top:10px"><table><thead><tr><th>Date / Time</th><th>Event</th><th>Status</th><th>Order</th><th>Details</th></tr></thead><tbody>'+((ev.map(function(x){return '<tr><td>'+esc(fmt(x.at))+'</td><td class="evt">'+esc(x.type)+'</td><td>'+esc(x.status)+'</td><td>'+esc(x.order)+'</td><td>'+esc(x.details)+'</td></tr>'}).join(''))||'<tr><td colspan="5">No activity found</td></tr>')+'</tbody></table></div>';
 }catch(e){box.innerHTML='<h3>Complete Activity Timeline</h3><div class="crm1-c360-error">Unable to load timeline: '+esc(e.message||e)+'</div>'}
 rendering=false;
}
function init(){
 if(started)return;started=true;
 var ticks=0,t=setInterval(function(){
   var m=getSearchMobile();
   if(m)render(m);
   if(++ticks>240)clearInterval(t);
 },500);
 var mo=new MutationObserver(function(){var m=getSearchMobile();if(m&&m!==lastMobile)render(m)});
 mo.observe(document.body,{childList:true,subtree:true,characterData:true,attributes:true,attributeFilter:['value']});
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
