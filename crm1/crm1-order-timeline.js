/* CRM1 complete Order Timeline module - takes over the existing professional Timeline page too. */
(function(){
  'use strict';
  var started=false;
  function esc(v){return String(v==null?'':v).replace(/[&<>\"']/g,function(m){return {'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',"'":'&#039;'}[m]})}
  function fmt(v){return v?new Intl.DateTimeFormat('en-IN',{timeZone:'Asia/Kolkata',dateStyle:'medium',timeStyle:'short'}).format(new Date(v)):'-'}

  async function searchInto(term,out,msg){
    term=String(term||'').trim();
    if(!term){msg.textContent='Order No ya 10 digit mobile number डालें.';out.innerHTML='';return;}
    msg.textContent='Loading...';msg.className='sub';out.innerHTML='';
    try{
      var orders=[];
      var select='id,order_no,order_status,verification_status,order_type,order_priority,total_amount,order_date,created_at,updated_at,customer_id,agent_id,dealer_id,courier_manager_id,remarks,customers(customer_name,mobile,city,state,pincode,address),profiles!orders_agent_id_fkey(full_name),dealers(dealer_name)';
      if(/^\d{10}$/.test(term)){
        var cr=await window.sb.from('customers').select('id').eq('mobile',term);
        if(cr.error)throw cr.error;
        var ids=(cr.data||[]).map(function(x){return x.id});
        if(ids.length){var qr=await window.sb.from('orders').select(select).in('customer_id',ids).order('order_date',{ascending:false}).limit(100);if(qr.error)throw qr.error;orders=qr.data||[]}
      }else{
        var orderNo=String(term).replace(/^#/,'');
        var qr2=await window.sb.from('orders').select(select).eq('order_no',orderNo).limit(1);
        if(qr2.error)throw qr2.error;orders=qr2.data||[];
      }
      if(!orders.length){msg.textContent='No order found.';msg.className='sub';return;}
      var ids2=orders.map(function(o){return o.id});
      var hr=await window.sb.from('order_status_history').select('id,order_id,old_status,new_status,remarks,changed_by,created_at').in('order_id',ids2).order('created_at',{ascending:true});
      if(hr.error)throw hr.error;
      var histories=hr.data||[];var grouped={};histories.forEach(function(h){(grouped[h.order_id]||(grouped[h.order_id]=[])).push(h)});
      out.innerHTML=orders.map(function(o){
        var events=[{at:o.created_at||o.order_date,event:'Order Created',status:o.order_status||'new',details:[o.order_type,o.order_priority,o.verification_status,o.total_amount!=null?'₹'+Number(o.total_amount).toLocaleString('en-IN'):'',o.remarks].filter(Boolean).join(' · ')}];
        (grouped[o.id]||[]).forEach(function(h){events.push({at:h.created_at,event:'Status Change',status:(h.old_status||'—')+' → '+(h.new_status||'—'),details:h.remarks||'Updated'})});
        if(o.updated_at&&o.updated_at!==o.created_at&&!(grouped[o.id]||[]).length)events.push({at:o.updated_at,event:'Order Updated',status:o.order_status||'-',details:'Order updated'});
        events.sort(function(a,b){return new Date(a.at)-new Date(b.at)});
        var customer=o.customers||{};
        return '<div class="panel"><div class="title"><div><h3 style="margin:0">Order #'+esc(o.order_no)+'</h3><div class="sub">'+esc(customer.customer_name||'-')+' · '+esc(customer.mobile||'-')+' · '+esc(o.order_status||'-')+'</div></div></div><div class="sub" style="margin-bottom:12px">Agent: '+esc(o.profiles&&o.profiles.full_name||'-')+' | Dealer: '+esc(o.dealers&&o.dealers.dealer_name||'-')+' | Amount: ₹'+Number(o.total_amount||0).toLocaleString('en-IN')+'</div><div class="tablewrap"><table><thead><tr><th>Date / Time</th><th>Event</th><th>Status</th><th>Details</th></tr></thead><tbody>'+events.map(function(e){return '<tr><td>'+esc(fmt(e.at))+'</td><td><b>'+esc(e.event)+'</b></td><td><span class="pill">'+esc(e.status)+'</span></td><td>'+esc(e.details||'-')+'</td></tr>'}).join('')+'</tbody></table></div></div>';
      }).join('');
      msg.textContent=orders.length+' order'+(orders.length===1?'':'s')+' found.';msg.className='sub';
    }catch(e){msg.textContent='Timeline error: '+(e.message||e);msg.className='msg'}
  }

  function renderIntoExistingTimeline(){
    var page=document.getElementById('timeline');
    if(!page)return false;
    var c=document.getElementById('timelineContent');
    if(!c){c=document.createElement('div');c.id='timelineContent';c.className='panel';page.appendChild(c)}
    if(c.dataset.crm1TimelineBound==='1')return true;
    c.dataset.crm1TimelineBound='1';
    c.innerHTML='<div class="crm1-toolbar"><input id="crm1OrderTimelineSearch" placeholder="Order No / Mobile Number"><button class="btn" id="crm1OrderTimelineBtn">Search</button></div><div id="crm1OrderTimelineMsg" class="sub"></div><div id="crm1OrderTimelineResult"></div>';
    var btn=document.getElementById('crm1OrderTimelineBtn'),inp=document.getElementById('crm1OrderTimelineSearch'),out=document.getElementById('crm1OrderTimelineResult'),msg=document.getElementById('crm1OrderTimelineMsg');
    btn.onclick=function(){searchInto(inp.value,out,msg)};
    inp.addEventListener('keydown',function(e){if(e.key==='Enter'){e.preventDefault();btn.click()}});
    return true;
  }

  function bindAllTimelineNav(){
    var buttons=[].slice.call(document.querySelectorAll('#nav button'));
    buttons.filter(function(x){return /Order Timeline/i.test(x.textContent||'')}).forEach(function(b){
      b.onclick=function(){
        document.querySelectorAll('.page').forEach(function(p){p.classList.remove('active')});
        var page=document.getElementById('timeline');
        if(page){page.classList.add('active');window.scrollTo(0,0);renderIntoExistingTimeline()}
      };
    });
  }

  function start(){
    if(started)return;started=true;
    var tries=0;
    var timer=setInterval(function(){
      var ok=renderIntoExistingTimeline();
      bindAllTimelineNav();
      if(ok || ++tries>40)clearInterval(timer);
    },400);
    setTimeout(function(){renderIntoExistingTimeline();bindAllTimelineNav()},1500);
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
})();
