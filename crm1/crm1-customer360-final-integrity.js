/* CRM1 Customer 360 complete activity timeline + Order Timeline. */
(function(){
'use strict';
var started=false,lastMobile='',rendering=false;
function esc(v){return String(v==null?'':v).replace(/[&<>\"']/g,function(m){return({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',"'":'&#039;'})[m]})}
function fmt(v){return v?new Intl.DateTimeFormat('en-IN',{timeZone:'Asia/Kolkata',dateStyle:'medium',timeStyle:'short'}).format(new Date(v)):'-'}
function getSearchMobile(){
  var inputs=document.querySelectorAll('input');
  for(var i=0;i<inputs.length;i++){
    var p=String(inputs[i].placeholder||'').toLowerCase();
    var v=String(inputs[i].value||'').replace(/\D/g,'');
    if(p.indexOf('10 digit mobile')>=0 && /^[6-9]\d{9}$/.test(v)) return v;
  }
  return '';
}
function root(){return document.getElementById('crm360Result')||document.querySelector('.main .page.active')||document.querySelector('.main')}
function style(){if(document.getElementById('crm1C360TimelineStyle'))return;var s=document.createElement('style');s.id='crm1C360TimelineStyle';s.textContent='.crm1-c360-integrity{margin-top:18px;margin-bottom:18px}.crm1-c360-integrity table{width:100%;border-collapse:collapse;font-size:12px}.crm1-c360-integrity th,.crm1-c360-integrity td{text-align:left;padding:9px;border-bottom:1px solid #edf1ee;vertical-align:top}.crm1-c360-integrity th{color:#164b30;background:#f7faf7}.crm1-c360-integrity .evt{font-weight:800;color:#164b30}.crm1-c360-integrity .muted{color:#69756e;font-size:12px}.crm1-c360-error{color:#b43b35;font-size:13px}';document.head.appendChild(s)}
function place(box,host){var panels=host.querySelectorAll('.panel');if(panels.length){panels[0].parentNode.insertBefore(box,panels[0])}else host.appendChild(box)}
function normalizeHistory(histories,orders){
  var byOrder={};
  histories.forEach(function(h){(byOrder[h.order_id]||(byOrder[h.order_id]=[])).push(h)});
  var normalized=[];
  orders.forEach(function(o){
    var list=(byOrder[o.id]||[]).slice().sort(function(a,b){
      var t=new Date(a.created_at||0)-new Date(b.created_at||0);if(t!==0)return t;
      var aReal=a.old_status?1:0,bReal=b.old_status?1:0;return bReal-aReal;
    });
    var previous='new';
    var seenAt={};
    list.forEach(function(h){
      var next=h.new_status;if(!next)return;
      var stamp=String(h.created_at||'');
      var key=stamp+'|'+next;
      if(seenAt[key])return;
      seenAt[key]=true;
      var old=h.old_status||previous;
      if(old===next)return;
      normalized.push({id:h.id,order_id:h.order_id,old_status:old,new_status:next,remarks:h.remarks,created_at:h.created_at});
      previous=next;
    });
  });
  return normalized;
}
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
  var cust=custR.data||null,cid=cust&&cust.id;if(!cid)throw new Error('Customer record not found for mobile '+mobile);
  var leadR=await window.sb.from('crm_leads').select('id,lead_name,lead_status,product_name,conversion_order_id,created_at,updated_at').eq('mobile',mobile).order('created_at',{ascending:false});
  if(leadR.error)throw leadR.error;
  var leads=leadR.data||[];
  var orderP=window.sb.from('orders').select('id,order_no,order_status,verification_status,order_type,order_priority,total_amount,created_at,updated_at').eq('customer_id',cid).order('created_at',{ascending:false});
  var followP=window.sb.from('followups').select('id,followup_at,status,disposition,notes,order_id,created_at').eq('customer_id',cid).order('followup_at',{ascending:false});
  var intP=window.sb.from('crm_interactions').select('id,interaction_type,direction,status,disposition,subject,details,order_id,started_at,created_at').eq('customer_id',cid).order('created_at',{ascending:false}).limit(500);
  var rs=await Promise.all([orderP,followP,intP]);rs.forEach(function(r){if(r&&r.error)throw r.error});
  var orders=rs[0].data||[],follow=rs[1].data||[],ints=rs[2].data||[],hist=[];
  if(orders.length){var ids=orders.map(function(o){return o.id});var hr=await window.sb.from('order_status_history').select('id,order_id,old_status,new_status,remarks,created_at').in('order_id',ids).order('created_at',{ascending:true});if(!hr.error)hist=hr.data||[]}
  var normalizedHistory=normalizeHistory(hist,orders),ev=[];
  leads.forEach(function(x){ev.push({at:x.created_at,type:'Lead',status:x.lead_status||'new',order:x.conversion_order_id?'Linked':'-',details:[x.lead_name,x.product_name].filter(Boolean).join(' · ')||'Lead created',orderType:'-'})});
  ints.forEach(function(x){ev.push({at:x.created_at||x.started_at,type:'Call / Interaction',status:x.disposition||x.status||'-',order:x.order_id?'Linked':'-',details:[x.direction,x.subject||x.details].filter(Boolean).join(' · ')||x.interaction_type||'Interaction',orderType:'-'})});
  follow.forEach(function(x){ev.push({at:x.followup_at||x.created_at,type:'Follow-up',status:x.status||'-',order:x.order_id?'Linked':'-',details:[x.disposition,x.notes].filter(Boolean).join(' · ')||'Follow-up',orderType:'-'})});
  orders.forEach(function(x){ev.push({at:x.created_at,type:'Order Created',status:'new',order:'#'+x.order_no,details:[x.order_type,x.order_priority,x.verification_status,x.total_amount!=null?'₹'+Number(x.total_amount).toLocaleString('en-IN'):'' ].filter(Boolean).join(' · '),orderType:x.order_type||x.order_priority||'-'})});
  normalizedHistory.forEach(function(x){var o=orders.find(function(y){return y.id===x.order_id});ev.push({at:x.created_at,type:'Order Status',status:x.old_status+' → '+x.new_status,order:o?'#'+o.order_no:'-',details:x.remarks||'Status changed',orderType:o?(o.order_type||o.order_priority||'-'):'-'})});
  ev.sort(function(a,b){return new Date(b.at||0)-new Date(a.at||0)});
  box.innerHTML='<h3>Complete Activity Timeline</h3><div class="muted">All activity for this customer, shown in IST</div><div class="tablewrap" style="margin-top:10px"><table><thead><tr><th>Date / Time</th><th>Event</th><th>Status</th><th>Order</th><th>Details</th><th>Order Type</th></tr></thead><tbody>'+((ev.map(function(x){return '<tr><td>'+esc(fmt(x.at))+'</td><td class="evt">'+esc(x.type)+'</td><td>'+esc(x.status)+'</td><td>'+esc(x.order)+'</td><td>'+esc(x.details)+'</td><td>'+esc(x.orderType||'-')+'</td></tr>'}).join(''))||'<tr><td colspan="6">No activity found</td></tr>')+'</tbody></table></div>';
 }catch(e){box.innerHTML='<h3>Complete Activity Timeline</h3><div class="crm1-c360-error">Unable to load timeline: '+esc(e.message||e)+'</div>'}
 rendering=false;
}
function init(){
 if(started)return;started=true;
 var ticks=0,t=setInterval(function(){var m=getSearchMobile();if(m)render(m);if(++ticks>240)clearInterval(t)},500);
 var mo=new MutationObserver(function(){var m=getSearchMobile();if(m&&m!==lastMobile)render(m)});
 mo.observe(document.body,{childList:true,subtree:true,characterData:true,attributes:true,attributeFilter:['value']});
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();

/* CRM1 complete Order Timeline: independent page layered on the final base. */
(function(){
'use strict';
var started=false;
function esc(v){return String(v==null?'':v).replace(/[&<>\"']/g,function(m){return({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',"'":'&#039;'})[m]})}
function fmt(v){return v?new Intl.DateTimeFormat('en-IN',{timeZone:'Asia/Kolkata',dateStyle:'medium',timeStyle:'short'}).format(new Date(v)):'-'}
function addNav(){var nav=document.getElementById('nav');if(!nav||document.getElementById('crm1NavOrderTimeline'))return;var b=document.createElement('button');b.id='crm1NavOrderTimeline';b.type='button';b.textContent='🕒 Order Timeline';b.onclick=openPage;nav.appendChild(b)}
function openPage(){document.querySelectorAll('.page').forEach(function(p){p.classList.remove('active')});var p=document.getElementById('crm1OrderTimelinePage');if(!p){p=document.createElement('section');p.id='crm1OrderTimelinePage';p.className='page';p.innerHTML='<div class="title"><div><h2>Order Timeline</h2><div class="sub">Complete chronological history for any order</div></div></div><div class="panel"><div class="search"><input id="crm1OrderTimelineSearch" placeholder="Order No / 10 digit Mobile Number"><button class="btn" id="crm1OrderTimelineBtn">Search</button></div><div id="crm1OrderTimelineMsg" class="msg"></div></div><div id="crm1OrderTimelineResult"></div>';document.querySelector('.main').appendChild(p);document.getElementById('crm1OrderTimelineBtn').onclick=search;document.getElementById('crm1OrderTimelineSearch').addEventListener('keydown',function(e){if(e.key==='Enter'){e.preventDefault();search()}})}p.classList.add('active');document.querySelectorAll('#nav button').forEach(function(x){x.classList.remove('active')});var b=document.getElementById('crm1NavOrderTimeline');if(b)b.classList.add('active');window.scrollTo(0,0)}
async function search(){var term=(document.getElementById('crm1OrderTimelineSearch').value||'').trim(),msg=document.getElementById('crm1OrderTimelineMsg'),out=document.getElementById('crm1OrderTimelineResult');if(!term){msg.textContent='Order No ya 10 digit mobile number डालें.';return}msg.textContent='Loading...';out.innerHTML='';try{var select='id,order_no,order_status,verification_status,order_type,order_priority,total_amount,order_date,created_at,updated_at,customer_id,agent_id,dealer_id,courier_manager_id,remarks,customers(customer_name,mobile,city,state,pincode,address),profiles!orders_agent_id_fkey(full_name),dealers(dealer_name)';var orders=[];if(/^\d{10}$/.test(term)){var cr=await window.sb.from('customers').select('id').eq('mobile',term);if(cr.error)throw cr.error;var ids=(cr.data||[]).map(function(x){return x.id});if(ids.length){var qr=await window.sb.from('orders').select(select).in('customer_id',ids).order('order_date',{ascending:false}).limit(100);if(qr.error)throw qr.error;orders=qr.data||[]}}else{var orderNo=String(term).replace(/^#/,'');var qr2=await window.sb.from('orders').select(select).eq('order_no',orderNo).limit(1);if(qr2.error)throw qr2.error;orders=qr2.data||[]}if(!orders.length){msg.textContent='No order found.';return}var ids2=orders.map(function(o){return o.id}),hr=await window.sb.from('order_status_history').select('id,order_id,old_status,new_status,remarks,changed_by,created_at').in('order_id',ids2).order('created_at',{ascending:true});if(hr.error)throw hr.error;var histories=hr.data||[],grouped={};histories.forEach(function(h){(grouped[h.order_id]||(grouped[h.order_id]=[])).push(h)});out.innerHTML=orders.map(function(o){var events=[{at:o.created_at||o.order_date,event:'Order Created',status:'new',details:[o.order_type,o.order_priority,o.verification_status,o.total_amount!=null?'₹'+Number(o.total_amount).toLocaleString('en-IN'):''].filter(Boolean).join(' · ')}];var prev='new',seen={};(grouped[o.id]||[]).slice().sort(function(a,b){var t=new Date(a.created_at||0)-new Date(b.created_at||0);if(t!==0)return t;return (a.old_status?0:1)-(b.old_status?0:1)}).forEach(function(h){if(!h.new_status)return;var k=String(h.created_at||'')+'|'+h.new_status;if(seen[k])return;seen[k]=1;var old=h.old_status||prev;if(old===h.new_status)return;events.push({at:h.created_at,event:h.new_status==='verified'?'Verification':h.new_status==='assigned'?'Assignment':'Status Change',status:old+' → '+h.new_status,details:h.new_status==='assigned'?'Dealer: '+(o.dealer_id?'Assigned':'-'):(h.remarks||'Status changed')});prev=h.new_status});events.sort(function(a,b){return new Date(a.at)-new Date(b.at)});var customer=o.customers||{};return '<div class="panel"><div class="title"><div><h3 style="margin:0">Order #'+esc(o.order_no)+'</h3><div class="sub">'+esc(customer.customer_name||'-')+' · '+esc(customer.mobile||'-')+' · '+esc(o.order_status||'-')+'</div></div></div><div class="sub" style="margin-bottom:12px">Agent: '+esc(o.profiles&&o.profiles.full_name||'-')+' | Dealer: '+esc(o.dealers&&o.dealers.dealer_name||'-')+' | Amount: ₹'+Number(o.total_amount||0).toLocaleString('en-IN')+'</div><div class="tablewrap"><table><thead><tr><th>Date / Time</th><th>Event</th><th>Status</th><th>Details</th></tr></thead><tbody>'+events.map(function(e){return '<tr><td>'+esc(fmt(e.at))+'</td><td><b>'+esc(e.event)+'</b></td><td><span class="pill">'+esc(e.status)+'</span></td><td>'+esc(e.details||'-')+'</td></tr>'}).join('')+'</tbody></table></div></div>'}).join('');msg.textContent=orders.length+' order'+(orders.length===1?'':'s')+' found.'}catch(e){msg.textContent='Timeline error: '+(e.message||e)}}
function init(){if(started)return;started=true;var ticks=0,t=setInterval(function(){addNav();if(document.getElementById('nav'))clearInterval(t);if(++ticks>120)clearInterval(t)},500)}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();