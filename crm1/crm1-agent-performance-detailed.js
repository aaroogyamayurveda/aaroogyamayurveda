/* CRM1 detailed Agent Performance report. */
(function(){
  'use strict';
  var started=false;
  function esc(v){return String(v==null?'':v).replace(/[&<>\"']/g,function(m){return {'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',"'":'&#039;'}[m]})}
  function dateISO(d){var x=new Date(d.getTime()-d.getTimezoneOffset()*60000);return x.toISOString().slice(0,10)}
  function today(){return dateISO(new Date())}
  function nextDay(v){var d=new Date(v+'T00:00:00');d.setDate(d.getDate()+1);return dateISO(d)}
  function money(v){return '₹'+Number(v||0).toLocaleString('en-IN')}
  function fmtPct(a,b){return b?(a/b*100).toFixed(1)+'%':'0%'}
  async function render(){
    var page=document.getElementById('agentPerformance'),c=document.getElementById('agentPerformanceContent');
    if(!page||!c||!page.classList.contains('active')||!window.sb)return;
    var old=c.querySelector('.crm1AgentPerfRoot');if(old)return;
    var t=today();
    c.innerHTML='<div class="crm1AgentPerfRoot"><div class="crm1-toolbar"><label>From <input type="date" id="crm1APFrom" value="'+t+'"></label><label>To <input type="date" id="crm1APTo" value="'+t+'"></label><button class="btn" id="crm1APApply">Apply</button><button class="btn alt" id="crm1APToday">Today</button><span class="sub">Agent performance by order/activity date.</span></div><div id="crm1APBody" class="crm1-muted">Loading...</div></div>';
    async function load(){
      var from=document.getElementById('crm1APFrom').value||today(),to=document.getElementById('crm1APTo').value||from;
      if(to<from){var z=from;from=to;to=z;document.getElementById('crm1APFrom').value=from;document.getElementById('crm1APTo').value=to}
      var end=nextDay(to);
      var [ordersR,leadsR,intR,profilesR]=await Promise.all([
        window.sb.from('orders').select('id,agent_id,order_status,total_amount,remarks,order_date,customer_id').gte('order_date',from+'T00:00:00').lt('order_date',end+'T00:00:00'),
        window.sb.from('crm_leads').select('id,assigned_to,lead_status,created_at,conversion_order_id').gte('created_at',from+'T00:00:00').lt('created_at',end+'T00:00:00'),
        window.sb.from('crm_interactions').select('id,agent_id,status,created_at').gte('created_at',from+'T00:00:00').lt('created_at',end+'T00:00:00'),
        window.sb.from('profiles').select('id,full_name,employee_code,is_active').eq('role','agent').order('full_name')
      ]);
      var err=ordersR.error||leadsR.error||intR.error||profilesR.error;
      var body=document.getElementById('crm1APBody');if(err){body.innerHTML='<div class="msg">'+esc(err.message)+'</div>';return}

      var agents=new Map((profilesR.data||[]).map(function(p){return [p.id,{name:p.full_name||p.employee_code||p.id,code:p.employee_code||''}]}));
      var rows={};
      function bucket(id){
        if(!id || !agents.has(id))return null;
        var k=id;
        if(!rows[k])rows[k]={name:agents.get(k).name,code:agents.get(k).code,leads:0,worked:0,orders:0,delivered:0,cancelled:0,orderValue:0,revenue:0,convertedLeadIds:new Set()};
        return rows[k];
      }

      /* Leads are counted only against a real active/known agent. */
      (leadsR.data||[]).forEach(function(x){
        var b=bucket(x.assigned_to);if(!b)return;
        b.leads++;
        if(String(x.lead_status||'').toLowerCase().includes('converted'))b.convertedLeadIds.add(x.id);
      });

      /* Interactions are counted only where an agent is known. */
      (intR.data||[]).forEach(function(x){var b=bucket(x.agent_id);if(b)b.worked++});

      /* Orders belong to the order's agent. Unassigned/unknown-agent orders are
         excluded from agent ranking rather than creating duplicate Unassigned rows. */
      (ordersR.data||[]).filter(function(x){return !String(x.remarks||'').includes('[ENQUIRY]')}).forEach(function(x){
        var b=bucket(x.agent_id);if(!b)return;
        b.orders++;
        b.orderValue+=Number(x.total_amount||0);
        if(x.order_status==='delivered'){
          b.delivered++;
          b.revenue+=Number(x.total_amount||0);
        }
        if(x.order_status==='cancelled'||x.order_status==='rto')b.cancelled++;
      });

      /* Conversion % = unique converted leads / assigned leads.
         Revenue = sum of delivered order values only. Rank is driven by revenue. */
      var arr=Object.values(rows).map(function(x){x.converted=x.convertedLeadIds.size;delete x.convertedLeadIds;return x});
      arr.sort(function(a,b){return b.revenue-a.revenue||b.delivered-a.delivered||b.orders-a.orders||b.leads-a.leads});

      var totalLeads=arr.reduce(function(a,x){return a+x.leads},0),
          totalWorked=arr.reduce(function(a,x){return a+x.worked},0),
          totalOrders=arr.reduce(function(a,x){return a+x.orders},0),
          totalDelivered=arr.reduce(function(a,x){return a+x.delivered},0),
          totalRevenue=arr.reduce(function(a,x){return a+x.revenue},0),
          totalConverted=arr.reduce(function(a,x){return a+x.converted},0),
          totalOrderValue=arr.reduce(function(a,x){return a+x.orderValue},0);

      body.innerHTML='<div class="cards"><div class="stat"><span>Leads</span><b>'+totalLeads+'</b></div><div class="stat"><span>Worked / Interactions</span><b>'+totalWorked+'</b></div><div class="stat"><span>Orders</span><b>'+totalOrders+'</b></div><div class="stat"><span>Converted Leads</span><b>'+totalConverted+'</b></div><div class="stat"><span>Conversion %</span><b>'+fmtPct(totalConverted,totalLeads)+'</b></div><div class="stat"><span>Delivered</span><b>'+totalDelivered+'</b></div><div class="stat"><span>Revenue</span><b>'+money(totalRevenue)+'</b></div></div><div class="tablewrap"><table><thead><tr><th>Rank</th><th>Agent</th><th>Leads</th><th>Worked</th><th>Converted</th><th>Conversion %</th><th>Orders</th><th>Delivered</th><th>Delivery %</th><th>Cancelled/RTO</th><th>Order Value</th><th>Revenue</th></tr></thead><tbody>'+(arr.map(function(x,i){return '<tr><td><b>'+String(i+1)+'</b></td><td><b>'+esc(x.name)+'</b><div class="crm1-muted">'+esc(x.code)+'</div></td><td>'+x.leads+'</td><td>'+x.worked+'</td><td>'+x.converted+'</td><td>'+fmtPct(x.converted,x.leads)+'</td><td>'+x.orders+'</td><td>'+x.delivered+'</td><td>'+fmtPct(x.delivered,x.orders)+'</td><td>'+x.cancelled+'</td><td>'+money(x.orderValue)+'</td><td><b>'+money(x.revenue)+'</b></td></tr>'}).join('')||'<tr><td colspan="12" class="empty">No agent activity for selected period</td></tr>')+'</tbody></table></div>';
    }
    document.getElementById('crm1APApply').onclick=load;
    document.getElementById('crm1APToday').onclick=function(){var v=today();document.getElementById('crm1APFrom').value=v;document.getElementById('crm1APTo').value=v;load()};
    load();
  }
  function start(){
    if(started)return;started=true;
    var t=setInterval(function(){render().catch(function(e){console.warn('Agent performance',e)});if(document.getElementById('agentPerformance')?.classList.contains('active'))clearInterval(t)},500);
    document.addEventListener('click',function(e){if(e.target.closest('#nav button'))setTimeout(function(){if(document.getElementById('agentPerformance')?.classList.contains('active')){var c=document.getElementById('agentPerformanceContent');if(c)c.innerHTML=''}render().catch(function(){})},300)});
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
})();
