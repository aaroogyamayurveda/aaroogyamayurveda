/* CRM1 Agent Dashboard scope fix.
   Keeps Dashboard > Your Orders restricted to the authenticated agent even when
   legacy dashboard renderers run before/after the shared profile state settles. */
(function(){
  'use strict';
  var running=false, refreshTimer=null, lastSignature='';
  function wait(ms){return new Promise(function(r){setTimeout(r,ms)})}
  function db(){return window.sb&&window.sb.from?window.sb:null}
  function utcStart(key){return new Date(String(key)+'T00:00:00+05:30').toISOString()}
  function nextDate(key){var p=String(key).split('-').map(Number);return new Date(Date.UTC(p[0],p[1]-1,p[2]+1)).toISOString().slice(0,10)}
  function range(){
    var type=document.getElementById('dashFilterType')?.value||'day';
    var from=document.getElementById('dashFilterFrom')?.value||new Date().toISOString().slice(0,10);
    var to=document.getElementById('dashFilterTo')?.value||from;
    if(type==='month'){
      if(!/^\d{4}-\d{2}$/.test(from))from=new Date().toISOString().slice(0,7);
      if(!/^\d{4}-\d{2}$/.test(to))to=from;
      if(to<from){var m=from;from=to;to=m}
      var a=from.split('-').map(Number),b=to.split('-').map(Number);
      return {from:a[0]+'-'+String(a[1]).padStart(2,'0')+'-01',to:new Date(Date.UTC(b[0],b[1],1)).toISOString().slice(0,10),label:from===to?from:from+' to '+to};
    }
    if(to<from){var d=from;from=to;to=d}
    return {from:from,to:nextDate(to),label:from===to?from:from+' to '+to};
  }
  async function agent(){
    if(!window.sb?.auth)return null;
    try{
      var u=(await window.sb.auth.getUser())?.data?.user;
      if(!u?.id)return null;
      var p=(await window.sb.from('profiles').select('id,role,full_name').eq('id',u.id).maybeSingle())?.data;
      if(p?.role==='agent')return {id:u.id,name:p.full_name||((document.getElementById('userInfo')?.innerText)||'').split('•')[0].trim()};
      if(window.profile?.role==='agent')return {id:u.id,name:p?.full_name||((document.getElementById('userInfo')?.innerText)||'').split('•')[0].trim()};
    }catch(e){}
    return null;
  }
  function render(rows, r, a){
    var body=document.getElementById('dashboardOrdersBody');
    if(body){
      body.innerHTML=rows.map(function(o){
        var items=Array.isArray(o.order_items)?o.order_items:[];
        var product=items.length?items.map(function(i){return String(i.products?.product_name||i.products?.name||'Product')+' × '+Number(i.quantity||0)}).join('<br>'):'-';
        return '<tr><td>#'+String(o.order_no||'').replace(/[&<>\"']/g,function(x){return {'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',"'":'&#39;'}[x]})+'</td><td>'+String(o.customers?.customer_name||'-')+'</td><td>'+String(o.customers?.mobile||'-')+'</td><td>'+product+'</td><td>'+String(o.profiles?.full_name||a.name||'-')+'</td><td>'+String(o.dealers?.dealer_name||'-')+'</td><td><span class="pill">'+String(o.order_status||'-')+'</span></td><td>₹'+Number(o.total_amount||0).toLocaleString('en-IN')+'</td></tr>';
      }).join('')||'<tr><td colspan="8" class="empty">No orders</td></tr>';
    }
    var lower=function(o){return String(o.order_status||'').toLowerCase()};
    var vals={
      sOrders:rows.length,
      sPending:rows.filter(function(o){return ['new','pending','confirmed','dealer_pending','assigned','hold'].indexOf(lower(o))>=0}).length,
      sTransit:rows.filter(function(o){return lower(o)==='in_transit'}).length,
      sDelivered:rows.filter(function(o){return lower(o)==='delivered'}).length,
      sCancelled:rows.filter(function(o){return lower(o)==='cancelled'}).length
    };
    Object.keys(vals).forEach(function(id){var el=document.getElementById(id);if(el)el.textContent=vals[id]});
    var label=document.getElementById('sOrdersLabel');if(label)label.textContent='Orders ('+r.label+')';
  }
  async function refresh(force){
    if(running)return;
    var main=document.querySelector('#dashboard.active, #dashboard');
    var body=document.getElementById('dashboardOrdersBody');
    if(!main||!body)return;
    var a=await agent();if(!a)return;
    var r=range();
    var sig=a.id+'|'+r.label+'|'+(body.innerText||'').slice(0,400);
    if(!force&&sig===lastSignature)return;
    running=true;
    try{
      var q=db().from('orders').select('id,order_no,order_status,total_amount,order_date,customer_id,agent_id,dealer_id,courier_manager_id,customers(customer_name,mobile),profiles!orders_agent_id_fkey(full_name),dealers(dealer_name),order_items(quantity,unit_price,products(product_name))').or('remarks.is.null,remarks.not.ilike.%[ENQUIRY]%').eq('agent_id',a.id).gte('order_date',utcStart(r.from)).lt('order_date',utcStart(r.to)).order('order_date',{ascending:false}).limit(500);
      var res=await q;if(res.error)throw res.error;
      render(res.data||[],r,a);
      lastSignature=a.id+'|'+r.label;
    }catch(e){console.warn('CRM1 agent dashboard scope fix:',e)}
    finally{running=false}
  }
  function bind(){
    ['dashFilterType','dashFilterFrom','dashFilterTo'].forEach(function(id){var el=document.getElementById(id);if(el&&!el.dataset.crmAgentScope){el.dataset.crmAgentScope='1';el.addEventListener('change',function(){lastSignature='';clearTimeout(refreshTimer);refreshTimer=setTimeout(function(){refresh(true)},50)})}});
    var b=document.querySelector('#nav button')&&Array.from(document.querySelectorAll('#nav button')).find(function(x){return /Dashboard/i.test(x.textContent||'')});
    if(b&&!b.dataset.crmAgentScope){b.dataset.crmAgentScope='1';b.addEventListener('click',function(){lastSignature='';setTimeout(function(){refresh(true)},100)})}
  }
  async function start(){
    for(var i=0;i<80;i++){if(window.sb?.from&&window.sb.auth)break;await wait(250)}
    if(!window.sb?.from||!window.sb.auth)return;
    bind();
    await refresh(true);
    setInterval(function(){bind();refresh(false)},700);
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
})();
