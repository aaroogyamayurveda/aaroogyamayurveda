/* CRM1 complete Order Timeline module. */
(function(){
  'use strict';
  var started=false;
  function esc(v){return String(v==null?'':v).replace(/[&<>\"']/g,function(m){return {'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',"'":'&#039;'}[m]})}
  function fmt(v){return v?new Intl.DateTimeFormat('en-IN',{timeZone:'Asia/Kolkata',dateStyle:'medium',timeStyle:'short'}).format(new Date(v)):'-'}
  function navButton(){
    var nav=document.getElementById('nav');
    if(!nav||document.getElementById('crm1NavOrderTimeline'))return;
    var b=document.createElement('button');b.id='crm1NavOrderTimeline';b.type='button';b.textContent='🕒 Order Timeline';
    b.onclick=openPage;nav.appendChild(b);
  }
  function openPage(){
    document.querySelectorAll('.page').forEach(function(p){p.classList.remove('active')});
    var p=document.getElementById('crm1OrderTimelinePage');
    if(!p){
      p=document.createElement('section');p.id='crm1OrderTimelinePage';p.className='page';
      p.innerHTML='<div class="title"><div><h2>Order Timeline</h2><div class="sub">Complete chronological history for any order</div></div></div>'+
      '<div class="panel"><div class="search"><input id="crm1OrderTimelineSearch" placeholder="Order No / 10 digit Mobile Number"><button class="btn" id="crm1OrderTimelineBtn">Search</button></div><div id="crm1OrderTimelineMsg" class="msg"></div></div><div id="crm1OrderTimelineResult"></div>';
      document.querySelector('.main').appendChild(p);
      document.getElementById('crm1OrderTimelineBtn').onclick=search;
      document.getElementById('crm1OrderTimelineSearch').addEventListener('keydown',function(e){if(e.key==='Enter'){e.preventDefault();search()}});
    }
    p.classList.add('active');document.querySelectorAll('#nav button').forEach(function(x){x.classList.remove('active')});var b=document.getElementById('crm1NavOrderTimeline');if(b)b.classList.add('active');window.scrollTo(0,0);
  }
  async function search(){
    var term=(document.getElementById('crm1OrderTimelineSearch').value||'').trim(),msg=document.getElementById('crm1OrderTimelineMsg'),out=document.getElementById('crm1OrderTimelineResult');
    if(!term){msg.textContent='Order No ya 10 digit mobile number डालें.';return}
    msg.textContent='Loading...';out.innerHTML='';
    try{
      var orders=[];
      var select='id,order_no,order_status,verification_status,order_type,order_priority,total_amount,order_date,created_at,updated_at,customer_id,agent_id,dealer_id,courier_manager_id,remarks,customers(customer_name,mobile,city,state,pincode,address),profiles!orders_agent_id_fkey(full_name),dealers(dealer_name)';
      if(/^\d{10}$/.test(term)){
        var cr=await window.sb.from('customers').select('id').eq('mobile',term);if(cr.error)throw cr.error;
        var ids=(cr.data||[]).map(function(x){return x.id});
        if(ids.length){var qr=await window.sb.from('orders').select(select).in('customer_id',ids).order('order_date',{ascending:false}).limit(100);if(qr.error)throw qr.error;orders=qr.data||[]}
      }else{
        var orderNo=String(term).replace(/^#/,'');var qr2=await window.sb.from('orders').select(select).eq('order_no',orderNo).limit(1);if(qr2.error)throw qr2.error;orders=qr2.data||[];
      }
      if(!orders.length){msg.textContent='No order found.';return}
      var ids2=orders.map(function(o){return o.id}),hr=await window.sb.from('order_status_history').select('id,order_id,old_status,new_status,remarks,changed_by,created_at').in('order_id',ids2).order('created_at',{ascending:true});if(hr.error)throw hr.error;
      var histories=hr.data||[];
      var grouped={};histories.forEach(function(h){(grouped[h.order_id]||(grouped[h.order_id]=[])).push(h)});
      out.innerHTML=orders.map(function(o){
        var events=[{at:o.created_at||o.order_date,event:'Order Created',status:o.order_status||'new',details:[o.order_type,o.order_priority,o.verification_status,o.total_amount!=null?'₹'+Number(o.total_amount).toLocaleString('en-IN'):''].filter(Boolean).join(' · ')}];
        (grouped[o.id]||[]).forEach(function(h){events.push({at:h.created_at,event:'Status Change',status:(h.old_status||'—')+' → '+(h.new_status||'—'),details:h.remarks||'Updated'})});
        if(o.updated_at&&o.updated_at!==o.created_at&&!grouped[o.id]?.length)events.push({at:o.updated_at,event:'Order Updated',status:o.order_status||'-',details:o.remarks||'Order updated'});
        events.sort(function(a,b){return new Date(a.at)-new Date(b.at)});
        var customer=o.customers||{};
        return '<div class="panel"><div class="title"><div><h3 style="margin:0">Order #'+esc(o.order_no)+'</h3><div class="sub">'+esc(customer.customer_name||'-')+' · '+esc(customer.mobile||'-')+' · '+esc(o.order_status||'-')+'</div></div></div>'+('<div class="sub" style="margin-bottom:12px">Agent: '+esc(o.profiles?.full_name||'-')+' | Dealer: '+esc(o.dealers?.dealer_name||'-')+' | Amount: ₹'+Number(o.total_amount||0).toLocaleString('en-IN')+'</div>')+'<div class="tablewrap"><table><thead><tr><th>Date / Time</th><th>Event</th><th>Status</th><th>Details</th></tr></thead><tbody>'+events.map(function(e){return '<tr><td>'+esc(fmt(e.at))+'</td><td><b>'+esc(e.event)+'</b></td><td><span class="pill">'+esc(e.status)+'</span></td><td>'+esc(e.details||'-')+'</td></tr>'}).join('')+'</tbody></table></div></div>';
      }).join('');
      msg.textContent=orders.length+' order'+(orders.length===1?'':'s')+' found.';
    }catch(e){msg.textContent='Timeline error: '+(e.message||e);msg.className='msg'}
  }
  function init(){if(started)return;started=true;navButton()}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
