/* CRM1 IST Operations Fix v1
 * Owns only Dashboard-adjacent Settlement + Delivery Partner Performance date handling.
 * Uses Asia/Kolkata boundaries for date filters and does not alter orders or financial data.
 */
(function(){
  'use strict';
  var started=false;
  var TZ='Asia/Kolkata';
  var $=function(id){return document.getElementById(id)};
  var esc=function(v){return String(v==null?'':v).replace(/[&<>\"']/g,function(m){return {'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',"'":'&#039;'}[m]})};
  var money=function(v){return '₹'+Number(v||0).toLocaleString('en-IN')};
  function istDate(){return new Intl.DateTimeFormat('en-CA',{timeZone:TZ,year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date())}
  function nextDate(s){var d=new Date(s+'T00:00:00+05:30');d.setUTCDate(d.getUTCDate()+1);return new Intl.DateTimeFormat('en-CA',{timeZone:TZ,year:'numeric',month:'2-digit',day:'2-digit'}).format(d)}
  function istRange(from,to){var f=from||istDate(),t=to||f;if(t<f){var z=f;f=t;t=z}return {from:new Date(f+'T00:00:00+05:30').toISOString(),to:new Date(nextDate(t)+'T00:00:00+05:30').toISOString(),fromDate:f,toDate:t}}
  function active(id){var p=$(id);return p&&p.classList.contains('active')}
  function partnerMaps(){return Promise.all([window.sb.from('dealers').select('id,dealer_name,is_active'),window.sb.from('profiles').select('id,full_name,is_active').eq('role','courier_manager')])}

  async function renderPartnerPerformance(){
    var p=$('partnerPerformance'),c=$('partnerPerformanceContent');if(!p||!c||!p.classList.contains('active')||!window.sb)return;
    c.innerHTML='<div class="panel"><div class="crm1-toolbar" style="display:flex;gap:10px;align-items:center;flex-wrap:wrap"><label>From <input type="date" id="crm1ISTPPFrom"></label><label>To <input type="date" id="crm1ISTPPTo"></label><button class="btn" id="crm1ISTPPApply">Apply</button><button class="btn alt" id="crm1ISTPPToday">Today</button></div><div id="crm1ISTPPMsg" class="sub"></div></div><div id="crm1ISTPPStats" class="cards"></div><div class="panel"><div class="tablewrap"><table><thead><tr><th>Rank</th><th>Delivery Partner</th><th>Type</th><th>Assigned</th><th>In Progress</th><th>Delivered</th><th>RTO</th><th>Cancelled</th><th>Delivery %</th><th>Order Value</th><th>Revenue</th></tr></thead><tbody id="crm1ISTPPBody"></tbody></table></div></div>';
    var t=istDate();$('crm1ISTPPFrom').value=t;$('crm1ISTPPTo').value=t;
    $('crm1ISTPPApply').onclick=loadPartner;$('crm1ISTPPToday').onclick=function(){$('crm1ISTPPFrom').value=istDate();$('crm1ISTPPTo').value=istDate();loadPartner()};
    await loadPartner();
    async function loadPartner(){
      var from=$('crm1ISTPPFrom').value||istDate(),to=$('crm1ISTPPTo').value||from,rng=istRange(from,to),msg=$('crm1ISTPPMsg');if(!msg)return;msg.textContent='Loading…';
      try{
        var rs=await Promise.all([
          window.sb.from('orders').select('id,order_no,order_status,total_amount,dealer_id,courier_manager_id,order_date,remarks').gte('order_date',rng.from).lt('order_date',rng.to),
          window.sb.from('dealers').select('id,dealer_name,is_active'),
          window.sb.from('profiles').select('id,full_name,is_active').eq('role','courier_manager')
        ]);rs.forEach(function(r){if(r.error)throw r.error});
        var orders=rs[0].data||[],dealers=rs[1].data||[],couriers=rs[2].data||[],dm=new Map(dealers.map(function(x){return[x.id,x.dealer_name||x.id]})),cm=new Map(couriers.map(function(x){return[x.id,x.full_name||x.id]})),map={};
        orders.filter(function(o){return !String(o.remarks||'').includes('[ENQUIRY]')}).forEach(function(o){var type=o.dealer_id?'Dealer':'Courier',id=o.dealer_id||o.courier_manager_id;if(!id)return;var key=type+':'+id;if(!map[key])map[key]={name:type==='Dealer'?dm.get(id):cm.get(id)||id,type:type,assigned:0,inprogress:0,delivered:0,rto:0,cancelled:0,orderValue:0,revenue:0};var x=map[key];x.assigned++;x.orderValue+=Number(o.total_amount||0);if(o.order_status==='delivered'){x.delivered++;x.revenue+=Number(o.total_amount||0)}else if(o.order_status==='rto')x.rto++;else if(o.order_status==='cancelled')x.cancelled++;else x.inprogress++});
        var arr=Object.values(map).sort(function(a,b){return b.revenue-a.revenue||b.delivered-a.delivered||b.assigned-a.assigned});
        $('crm1ISTPPStats').innerHTML='<div class="stat"><span>Partners</span><b>'+arr.length+'</b></div><div class="stat"><span>Assigned</span><b>'+arr.reduce(function(a,x){return a+x.assigned},0)+'</b></div><div class="stat"><span>Delivered</span><b>'+arr.reduce(function(a,x){return a+x.delivered},0)+'</b></div><div class="stat"><span>Revenue</span><b>'+money(arr.reduce(function(a,x){return a+x.revenue},0))+'</b></div>';
        $('crm1ISTPPBody').innerHTML=arr.map(function(x,i){return '<tr><td><b>'+(i+1)+'</b></td><td><b>'+esc(x.name)+'</b></td><td>'+esc(x.type)+'</td><td>'+x.assigned+'</td><td>'+x.inprogress+'</td><td>'+x.delivered+'</td><td>'+x.rto+'</td><td>'+x.cancelled+'</td><td>'+(x.assigned?(x.delivered/x.assigned*100).toFixed(1):'0.0')+'%</td><td>'+money(x.orderValue)+'</td><td><b>'+money(x.revenue)+'</b></td></tr>'}).join('')||'<tr><td colspan="11" class="empty">No delivery orders for selected period</td></tr>';
        msg.textContent='Report: '+rng.fromDate+' to '+rng.toDate;
      }catch(e){msg.textContent='Report error: '+(e.message||e);$('crm1ISTPPBody').innerHTML=''}
    }
  }

  async function renderSettlements(){
    var p=$('settlements'),c=$('settlementsContent');if(!p||!c||!p.classList.contains('active')||!window.sb)return;
    c.innerHTML='<div class="panel"><div class="crm1-toolbar" style="display:flex;gap:10px;align-items:center;flex-wrap:wrap"><label>From <input type="date" id="crm1ISTSetFrom"></label><label>To <input type="date" id="crm1ISTSetTo"></label><button class="btn" id="crm1ISTSetApply">Apply</button><button class="btn alt" id="crm1ISTSetToday">Today</button><span id="crm1ISTSetMsg" class="sub"></span></div></div><div id="crm1ISTSetKpis" class="cards"></div><div class="panel"><h3>Existing Settlements</h3><div class="tablewrap"><table><thead><tr><th>Partner</th><th>Period</th><th>Delivered</th><th>COD</th><th>Commission</th><th>Net Payable</th><th>Status</th></tr></thead><tbody id="crm1ISTSetBody"></tbody></table></div></div><div class="panel"><h3>Delivered Orders — Pending Settlement</h3><div class="sub" style="margin-bottom:10px">Delivered orders for the selected IST date range that do not yet have a generated partner settlement record.</div><div class="tablewrap"><table><thead><tr><th>Order</th><th>Date / Time</th><th>Partner</th><th>Type</th><th>Customer</th><th>COD</th><th>Status</th></tr></thead><tbody id="crm1ISTPendingBody"></tbody></table></div></div>';
    var t=istDate();$('crm1ISTSetFrom').value=t;$('crm1ISTSetTo').value=t;$('crm1ISTSetApply').onclick=loadSettlement;$('crm1ISTSetToday').onclick=function(){$('crm1ISTSetFrom').value=istDate();$('crm1ISTSetTo').value=istDate();loadSettlement()};await loadSettlement();
    async function loadSettlement(){
      var from=$('crm1ISTSetFrom').value||istDate(),to=$('crm1ISTSetTo').value||from,rng=istRange(from,to),msg=$('crm1ISTSetMsg');msg.textContent='Loading…';
      try{
        var maps=await partnerMaps(),dealers=maps[0].data||[],couriers=maps[1].data||[];if(maps[0].error)throw maps[0].error;if(maps[1].error)throw maps[1].error;var dm=new Map(dealers.map(function(x){return[x.id,x.dealer_name]})),cm=new Map(couriers.map(function(x){return[x.id,x.full_name]}));
        var s=await window.sb.from('partner_settlements').select('id,partner_id,period_from,period_to,delivered_orders,cod_amount,commission_amount,net_payable,status,partner_type,created_at').gte('period_from',rng.fromDate).lte('period_to',rng.toDate).order('period_from',{ascending:false});if(s.error)throw s.error;var rows=s.data||[];
        $('crm1ISTSetBody').innerHTML=rows.map(function(x){var name=x.partner_type==='dealer'?dm.get(x.partner_id):cm.get(x.partner_id);return '<tr><td>'+esc(name||x.partner_id||'-')+'</td><td>'+esc(x.period_from)+' to '+esc(x.period_to)+'</td><td>'+Number(x.delivered_orders||0)+'</td><td>'+money(x.cod_amount)+'</td><td>'+money(x.commission_amount)+'</td><td>'+money(x.net_payable)+'</td><td>'+esc(x.status||'-')+'</td></tr>'}).join('')||'<tr><td colspan="7" class="empty">No settlements for selected period</td></tr>';
        var o=await window.sb.from('orders').select('id,order_no,order_status,total_amount,order_date,dealer_id,courier_manager_id,customer_id,customers(customer_name),remarks').eq('order_status','delivered').gte('order_date',rng.from).lt('order_date',rng.to).or('remarks.is.null,remarks.not.ilike.%[ENQUIRY]%');if(o.error)throw o.error;var orders=o.data||[];var existing=new Set();rows.forEach(function(x){existing.add(String(x.partner_id)+'|'+x.period_from+'|'+x.period_to)});
        var pending=orders.filter(function(x){var pid=x.dealer_id||x.courier_manager_id;var type=x.dealer_id?'dealer':'courier';return !existing.has(String(pid)+'|'+rng.fromDate+'|'+rng.toDate)});
        $('crm1ISTPendingBody').innerHTML=pending.map(function(x){var name=x.dealer_id?dm.get(x.dealer_id):cm.get(x.courier_manager_id);return '<tr><td>#'+esc(x.order_no)+'</td><td>'+esc(new Intl.DateTimeFormat('en-IN',{timeZone:TZ,day:'2-digit',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit',hour12:true}).format(new Date(x.order_date)))+'</td><td>'+esc(name||'-')+'</td><td>'+esc(x.dealer_id?'Dealer':'Courier')+'</td><td>'+esc(x.customers&&x.customers.customer_name||'-')+'</td><td>'+money(x.total_amount)+'</td><td><span class="pill">delivered</span></td></tr>'}).join('')||'<tr><td colspan="7" class="empty">No delivered orders pending settlement</td></tr>';
        var delivered=orders.length,cod=orders.reduce(function(a,x){return a+Number(x.total_amount||0)},0),commission=rows.reduce(function(a,x){return a+Number(x.commission_amount||0)},0),net=rows.reduce(function(a,x){return a+Number(x.net_payable||0)},0);$('crm1ISTSetKpis').innerHTML='<div class="stat"><span>Settlements</span><b>'+rows.length+'</b></div><div class="stat"><span>Delivered</span><b>'+delivered+'</b></div><div class="stat"><span>Pending Settlement Orders</span><b>'+pending.length+'</b></div><div class="stat"><span>Delivered COD</span><b>'+money(cod)+'</b></div><div class="stat"><span>Commission</span><b>'+money(commission)+'</b></div><div class="stat"><span>Net Settlement</span><b>'+money(net)+'</b></div>';
        msg.textContent='Report: '+rng.fromDate+' to '+rng.toDate;
      }catch(e){msg.textContent='Report error: '+(e.message||e)}
    }
  }

  function mountWatcher(){
    var nav=document.getElementById('nav');if(!nav)return;
    function run(){setTimeout(function(){if(active('partnerPerformance'))renderPartnerPerformance();if(active('settlements'))renderSettlements()},60)}
    nav.addEventListener('click',run,true);run();
  }
  function init(){if(started)return;started=true;mountWatcher();var obs=new MutationObserver(function(){if(active('partnerPerformance')){var x=$('crm1ISTPPFrom');if(!x)renderPartnerPerformance()}if(active('settlements')){var y=$('crm1ISTSetFrom');if(!y)renderSettlements()}});obs.observe(document.body,{childList:true,subtree:true});}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
