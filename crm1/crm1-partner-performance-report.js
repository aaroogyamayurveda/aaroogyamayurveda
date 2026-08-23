/* CRM1 Delivery Partner Performance: date-range reporting layer. */
(function(){
  'use strict';
  var started=false;
  function esc(v){return String(v==null?'':v).replace(/[&<>\"']/g,function(m){return {'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',"'":'&#039;'}[m]})}
  function dateISO(d){var x=new Date(d.getTime()-d.getTimezoneOffset()*60000);return x.toISOString().slice(0,10)}
  function today(){return dateISO(new Date())}
  function nextDay(v){var d=new Date(v+'T00:00:00');d.setDate(d.getDate()+1);return dateISO(d)}
  function money(v){return '₹'+Number(v||0).toLocaleString('en-IN')}
  function pct(a,b){return b?(a/b*100).toFixed(1)+'%':'0%'}
  async function render(){
    var page=document.getElementById('partnerPerformance'),root=document.getElementById('partnerPerformanceContent');
    if(!page||!root||!page.classList.contains('active')||!window.sb)return;
    if(!root.querySelector('#crm1PPRoot')) root.innerHTML='<div id="crm1PPRoot"><div class="crm1-toolbar"><label>From <input type="date" id="crm1PPFrom"></label><label>To <input type="date" id="crm1PPTo"></label><button class="btn" id="crm1PPApply">Apply</button><button class="btn alt" id="crm1PPToday">Today</button><span class="sub">Delivery partner performance by order date.</span></div><div id="crm1PPBody" class="crm1-muted">Loading...</div></div>';
    var t=today();if(!$('crm1PPFrom').value){$('crm1PPFrom').value=t;$('crm1PPTo').value=t}
    async function load(){
      var from=$('crm1PPFrom').value||today(),to=$('crm1PPTo').value||from;
      if(to<from){var z=from;from=to;to=z;$('crm1PPFrom').value=from;$('crm1PPTo').value=to}
      var start=new Date(from+'T00:00:00').toISOString(),end=new Date(nextDay(to)+'T00:00:00').toISOString();
      $('crm1PPBody').innerHTML='<div class="crm1-muted">Loading...</div>';
      var [or,dr,pr]=await Promise.all([
        window.sb.from('orders').select('id,order_status,total_amount,dealer_id,courier_manager_id,order_date,remarks').gte('order_date',start).lt('order_date',end),
        window.sb.from('dealers').select('id,dealer_name,is_active'),
        window.sb.from('profiles').select('id,full_name,is_active').eq('role','courier_manager')
      ]);
      var er=or.error||dr.error||pr.error;if(er){$('crm1PPBody').innerHTML='<div class="msg">'+esc(er.message)+'</div>';return}
      var dealers=new Map((dr.data||[]).map(function(x){return [x.id,{name:x.dealer_name||x.id,type:'Dealer'}]}));
      var couriers=new Map((pr.data||[]).map(function(x){return [x.id,{name:x.full_name||x.id,type:'Courier'}]}));
      var map={};
      (or.data||[]).filter(function(o){return !String(o.remarks||'').includes('[ENQUIRY]')}).forEach(function(o){
        var p=o.dealer_id?dealers.get(o.dealer_id):o.courier_manager_id?couriers.get(o.courier_manager_id):null;if(!p)return;
        var key=(o.dealer_id?'d:':'c:')+(o.dealer_id||o.courier_manager_id);
        if(!map[key])map[key]={name:p.name,type:p.type,assigned:0,delivered:0,inprogress:0,rto:0,cancelled:0,value:0,revenue:0};
        var x=map[key];x.assigned++;x.value+=Number(o.total_amount||0);
        if(o.order_status==='delivered'){x.delivered++;x.revenue+=Number(o.total_amount||0)}
        else if(o.order_status==='rto')x.rto++;
        else if(o.order_status==='cancelled')x.cancelled++;
        else x.inprogress++;
      });
      var rows=Object.values(map).sort(function(a,b){return b.revenue-a.revenue||b.delivered-a.delivered||b.assigned-a.assigned});
      var ta=rows.reduce(function(a,x){return a+x.assigned},0),td=rows.reduce(function(a,x){return a+x.delivered},0),tr=rows.reduce(function(a,x){return a+x.revenue},0);
      $('crm1PPBody').innerHTML='<div class="cards"><div class="stat"><span>Partners</span><b>'+rows.length+'</b></div><div class="stat"><span>Assigned</span><b>'+ta+'</b></div><div class="stat"><span>Delivered</span><b>'+td+'</b></div><div class="stat"><span>Revenue</span><b>'+money(tr)+'</b></div></div><div class="tablewrap"><table><thead><tr><th>Rank</th><th>Partner</th><th>Type</th><th>Assigned</th><th>In Progress</th><th>Delivered</th><th>Delivery %</th><th>RTO</th><th>Cancelled</th><th>Order Value</th><th>Revenue</th></tr></thead><tbody>'+(rows.map(function(x,i){return '<tr><td><b>'+(i+1)+'</b></td><td><b>'+esc(x.name)+'</b></td><td>'+esc(x.type)+'</td><td>'+x.assigned+'</td><td>'+x.inprogress+'</td><td>'+x.delivered+'</td><td>'+pct(x.delivered,x.assigned)+'</td><td>'+x.rto+'</td><td>'+x.cancelled+'</td><td>'+money(x.value)+'</td><td><b>'+money(x.revenue)+'</b></td></tr>'}).join('')||'<tr><td colspan="11" class="empty">No delivery partner orders for selected period</td></tr>')+'</tbody></table></div>';
    }
    $('crm1PPApply').onclick=load;$('crm1PPToday').onclick=function(){var v=today();$('crm1PPFrom').value=v;$('crm1PPTo').value=v;load()};load();
  }
  function $(id){return document.getElementById(id)}
  function start(){
    if(started)return;started=true;
    var t=setInterval(function(){if(render().catch(function(){}),$('partnerPerformance')?.classList.contains('active'))clearInterval(t)},500);
    document.addEventListener('click',function(e){if(e.target.closest('#nav button'))setTimeout(function(){if($('partnerPerformance')?.classList.contains('active')){var c=$('partnerPerformanceContent');if(c)c.innerHTML=''}render().catch(function(){})},300)});
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
})();
