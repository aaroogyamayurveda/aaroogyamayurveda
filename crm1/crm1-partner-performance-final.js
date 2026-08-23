/* CRM1 Partner Performance final reporting layer: date-range, revenue ranking, delivered value. */
(function(){
'use strict';
var started=false,guardInstalled=false,guardTimer=null;
function esc(v){return String(v==null?'':v).replace(/[&<>\"']/g,function(m){return{'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',"'":'&#039;'}[m]})}
function money(v){return '₹'+Number(v||0).toLocaleString('en-IN')}
function fmtPct(a,b){return b?(a/b*100).toFixed(1)+'%':'0.0%'}
function iso(d){var x=new Date(d);return x.toISOString().slice(0,10)}
function today(){return iso(new Date())}
function nextDay(v){var d=new Date(v+'T00:00:00');d.setDate(d.getDate()+1);return iso(d)}
function page(){return document.getElementById('partnerPerformance')}
function content(){return document.getElementById('partnerPerformanceContent')}
function normalizeNav(){
 document.querySelectorAll('#nav button').forEach(function(b){
  var t=String(b.textContent||'').trim().toLowerCase();
  if(t.indexOf('delivery partner')!==-1 && t.indexOf('performance')===-1){b.textContent='🤝 Delivery Partners Performance'}
 });
}
function normalizeHeader(){var p=page();if(!p)return;var h=p.querySelector('.title h2');if(h)h.textContent='Delivery Partners Performance';var s=p.querySelector('.title .sub');if(s)s.textContent='Dealer and courier performance and SLA';}
function build(){
 var p=page(),c=content();if(!p||!c||!p.classList.contains('active'))return false;
 normalizeNav();normalizeHeader();
 c.innerHTML='<div id="crm1PPFinalRoot"><div class="panel"><div class="crm1-toolbar" style="display:flex;gap:10px;align-items:center;flex-wrap:wrap"><label>From <input type="date" id="crm1PPFrom"></label><label>To <input type="date" id="crm1PPTo"></label><button class="btn" id="crm1PPApply">Apply</button><button class="btn alt" id="crm1PPToday">Today</button></div><div id="crm1PPMsg" class="sub"></div></div><div id="crm1PPStats" class="cards"></div><div class="panel"><div class="tablewrap"><table><thead><tr><th>Rank</th><th>Delivery Partner</th><th>Type</th><th>Assigned</th><th>In Progress</th><th>Delivered</th><th>RTO</th><th>Cancelled</th><th>Delivery %</th><th>Order Value</th><th>Revenue</th></tr></thead><tbody id="crm1PPBody"></tbody></table></div></div></div>';
 var t=today();document.getElementById('crm1PPFrom').value=t;document.getElementById('crm1PPTo').value=t;
 document.getElementById('crm1PPApply').onclick=load;
 document.getElementById('crm1PPToday').onclick=function(){document.getElementById('crm1PPFrom').value=today();document.getElementById('crm1PPTo').value=today();load()};
 load();return true;
}
async function load(){
 var from=document.getElementById('crm1PPFrom').value||today(),to=document.getElementById('crm1PPTo').value||from;
 if(to<from){var z=from;from=to;to=z;document.getElementById('crm1PPFrom').value=from;document.getElementById('crm1PPTo').value=to}
 var msg=document.getElementById('crm1PPMsg');if(!msg)return;msg.textContent='Loading...';
 var end=nextDay(to);
 try{
  var rs=await Promise.all([
   window.sb.from('orders').select('id,order_status,total_amount,dealer_id,courier_manager_id,order_date,remarks').gte('order_date',from+'T00:00:00').lt('order_date',end+'T00:00:00'),
   window.sb.from('dealers').select('id,dealer_name,is_active'),
   window.sb.from('profiles').select('id,full_name,is_active').eq('role','courier_manager')
  ]);
  rs.forEach(function(r){if(r.error)throw r.error});
  var orders=rs[0].data||[],dealers=rs[1].data||[],couriers=rs[2].data||[];
  var dm=new Map(dealers.map(function(x){return[x.id,x.dealer_name||x.id]})),cm=new Map(couriers.map(function(x){return[x.id,x.full_name||x.id]})),map={};
  orders.filter(function(o){return !String(o.remarks||'').includes('[ENQUIRY]')}).forEach(function(o){
   var type=o.dealer_id?'Dealer':'Courier',id=o.dealer_id||o.courier_manager_id;if(!id)return;
   var key=type+':'+id;
   if(!map[key])map[key]={name:type==='Dealer'?dm.get(id):cm.get(id)||id,type:type,assigned:0,inprogress:0,delivered:0,rto:0,cancelled:0,orderValue:0,revenue:0};
   var x=map[key];x.assigned++;x.orderValue+=Number(o.total_amount||0);
   if(o.order_status==='delivered'){x.delivered++;x.revenue+=Number(o.total_amount||0)}
   else if(o.order_status==='rto')x.rto++;
   else if(o.order_status==='cancelled')x.cancelled++;
   else x.inprogress++;
  });
  var arr=Object.values(map).sort(function(a,b){return b.revenue-a.revenue||b.delivered-a.delivered||b.assigned-a.assigned});
  var assigned=arr.reduce(function(a,x){return a+x.assigned},0),delivered=arr.reduce(function(a,x){return a+x.delivered},0),revenue=arr.reduce(function(a,x){return a+x.revenue},0);
  document.getElementById('crm1PPStats').innerHTML='<div class="stat"><span>Partners</span><b>'+arr.length+'</b></div><div class="stat"><span>Assigned</span><b>'+assigned+'</b></div><div class="stat"><span>Delivered</span><b>'+delivered+'</b></div><div class="stat"><span>Revenue</span><b>'+money(revenue)+'</b></div>';
  document.getElementById('crm1PPBody').innerHTML=arr.map(function(x,i){return '<tr><td><b>'+(i+1)+'</b></td><td><b>'+esc(x.name)+'</b></td><td>'+esc(x.type)+'</td><td>'+x.assigned+'</td><td>'+x.inprogress+'</td><td>'+x.delivered+'</td><td>'+x.rto+'</td><td>'+x.cancelled+'</td><td>'+fmtPct(x.delivered,x.assigned)+'</td><td>'+money(x.orderValue)+'</td><td><b>'+money(x.revenue)+'</b></td></tr>'}).join('')||'<tr><td colspan="11" class="empty">No delivery orders for selected period</td></tr>';
  msg.textContent='Report: '+from+' to '+to;
 }catch(e){msg.textContent='Report error: '+(e.message||e);document.getElementById('crm1PPBody').innerHTML=''}
}
function installGuard(){
 var c=content();
 if(!c||!window.MutationObserver||guardInstalled)return;
 guardInstalled=true;c.dataset.crm1PartnerPerformanceGuard='1';
 var observer=new MutationObserver(function(){
  var p=page();if(!p||!p.classList.contains('active'))return;
  if(document.getElementById('crm1PPFinalRoot'))return;
  clearTimeout(guardTimer);
  guardTimer=setTimeout(function(){
   var pp=page();if(pp&&pp.classList.contains('active')&&!document.getElementById('crm1PPFinalRoot'))build();
  },40);
 });
 observer.observe(c,{childList:true,subtree:true});
 c._crm1PartnerPerformanceObserver=observer;
}
function ensureActive(){
 var p=page();if(!p||!p.classList.contains('active'))return;
 installGuard();
 if(!document.getElementById('crm1PPFinalRoot'))build();
}
function init(){
 if(started)return;started=true;
 normalizeNav();
 var tries=0,t=setInterval(function(){
  normalizeNav();
  var p=page();
  if(p&&p.classList.contains('active')){ensureActive();clearInterval(t)}
  if(++tries>120)clearInterval(t);
 },250);
 document.addEventListener('click',function(e){
  var b=e.target.closest('#nav button');
  if(b&&/delivery partner/i.test(String(b.textContent||''))){
   normalizeNav();
   setTimeout(ensureActive,0);
   setTimeout(ensureActive,100);
   setTimeout(ensureActive,500);
  }
 });
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
