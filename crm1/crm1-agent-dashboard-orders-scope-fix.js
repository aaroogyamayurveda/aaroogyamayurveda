/* CRM1 Agent Dashboard Orders scope fix v3.
   The dashboard table has multiple legacy renderers. This module is the final authority for agent users:
   it resolves the authenticated Supabase user, always queries orders by that user id, and continuously
   corrects any later mixed/all-agent render without touching dealer/courier/manager views.
*/
(function(){
'use strict';
if(window.__crm1AgentDashboardOrdersScopeFixV3)return;
window.__crm1AgentDashboardOrdersScopeFixV3=true;
var db=null,userId=null,agentName='',isAgent=false,busy=false,lastKey='',timer=null;
function sleep(ms){return new Promise(function(r){setTimeout(r,ms)})}
function today(){return new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Kolkata',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date())}
function startUtc(k){return new Date(String(k)+'T00:00:00+05:30').toISOString()}
function nextDay(k){var p=String(k).split('-').map(Number);return new Date(Date.UTC(p[0],p[1]-1,p[2]+1)).toISOString().slice(0,10)}
function esc(s){return String(s==null?'':s).replace(/[&<>\"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',"'":'&#39;'}[c]})}
function range(){
 var type=document.getElementById('dashFilterType')?.value||'day',from=document.getElementById('dashFilterFrom')?.value||today(),to=document.getElementById('dashFilterTo')?.value||from;
 if(type==='month'){
  if(!/^\d{4}-\d{2}$/.test(from))from=today().slice(0,7);if(!/^\d{4}-\d{2}$/.test(to))to=from;if(to<from){var m=from;from=to;to=m}
  var b=to.split('-').map(Number);return {from:from+'-01',to:new Date(Date.UTC(b[0],b[1],1)).toISOString().slice(0,10),label:from===to?from:from+' to '+to};
 }
 if(type==='year'){
  var fy=Number(from)||Number(today().slice(0,4)),ty=Number(to)||fy;if(ty<fy){var y=fy;fy=ty;ty=y}
  return {from:String(fy)+'-01-01',to:String(ty+1)+'-01-01',label:fy===ty?String(fy):fy+' to '+ty};
 }
 if(to<from){var d=from;from=to;to=d}return {from:from,to:nextDay(to),label:from===to?from:from+' to '+to};
}
async function resolve(){
 db=window.sb||null;
 for(var i=0;i<80&&!db?.auth;i++){await sleep(250);db=window.sb||null}
 if(!db?.auth)return false;
 try{var u=await db.auth.getUser();userId=u?.data?.user?.id||null;if(!userId)return false;var p=await db.from('profiles').select('id,full_name,email,role').eq('id',userId).maybeSingle();if(p.error||!p.data)return false;isAgent=String(p.data.role||'').toLowerCase()==='agent';agentName=(p.data.full_name||p.data.email||'').trim();return isAgent}catch(e){return false}
}
function setStats(rows){
 var pending=rows.filter(function(o){return ['new','pending','confirmed','dealer_pending','assigned','hold'].indexOf(String(o.order_status||'').toLowerCase())>=0}).length;
 var transit=rows.filter(function(o){return String(o.order_status||'').toLowerCase()==='in_transit'}).length,delivered=rows.filter(function(o){return String(o.order_status||'').toLowerCase()==='delivered'}).length,cancelled=rows.filter(function(o){return String(o.order_status||'').toLowerCase()==='cancelled'}).length;
 [['sOrders',rows.length],['sPending',pending],['sTransit',transit],['sDelivered',delivered],['sCancelled',cancelled]].forEach(function(x){var el=document.getElementById(x[0]);if(el)el.textContent=x[1]});
}
function products(o){var items=Array.isArray(o.order_items)?o.order_items:[];return items.length?items.map(function(i){return esc(i.products?.product_name||i.products?.name||'Product')+' × '+Number(i.quantity||0)}).join('<br>'):'-'}
async function refresh(force){
 if(!isAgent||!userId||!db||busy)return;var body=document.getElementById('dashboardOrdersBody');if(!body)return;
 var r=range(),key=userId+'|'+r.from+'|'+r.to;if(!force&&key===lastKey)return;busy=true;
 try{
  var q=db.from('orders').select('id,order_no,order_status,total_amount,order_date,customers(customer_name,mobile),profiles!orders_agent_id_fkey(full_name),dealers(dealer_name),order_items(quantity,products(product_name))').eq('agent_id',userId).or('remarks.is.null,remarks.not.ilike.%[ENQUIRY]%').gte('order_date',startUtc(r.from)).lt('order_date',startUtc(r.to)).order('order_date',{ascending:false}).limit(500);
  var res=await q;if(res.error)throw res.error;var rows=res.data||[];
  body.innerHTML=rows.map(function(o){return '<tr><td>#'+esc(o.order_no)+'</td><td>'+esc(o.customers?.customer_name||'-')+'</td><td>'+esc(o.customers?.mobile||'-')+'</td><td>'+products(o)+'</td><td>'+esc(o.profiles?.full_name||agentName||'-')+'</td><td>'+esc(o.dealers?.dealer_name||'-')+'</td><td><span class="pill">'+esc(o.order_status||'-')+'</span></td><td>₹'+Number(o.total_amount||0).toLocaleString('en-IN')+'</td></tr>'}).join('')||'<tr><td colspan="8" class="empty">No orders</td></tr>';
  setStats(rows);var label=document.getElementById('sOrdersLabel');if(label)label.textContent=(r.label===today()?'आज के Orders':'Orders ('+r.label+')');lastKey=key;
 }catch(e){console.warn('CRM1 agent dashboard scoped orders:',e)}finally{busy=false}
}
function tableHasForeignAgent(){
 var body=document.getElementById('dashboardOrdersBody');if(!body||!isAgent)return false;
 var rows=Array.from(body.querySelectorAll('tr')).filter(function(r){return r.cells&&r.cells.length>=8});
 for(var i=0;i<rows.length;i++){
  var n=(rows[i].cells[4].innerText||'').trim();
  if(n && n!==agentName)return true;
 }
 return false;
}
function schedule(force){clearTimeout(timer);timer=setTimeout(function(){refresh(!!force)},0)}
function bindFilters(){
 ['dashFilterType','dashFilterFrom','dashFilterTo'].forEach(function(id){var e=document.getElementById(id);if(!e||e.dataset.crm1AgentScopeV3)return;e.dataset.crm1AgentScopeV3='1';e.addEventListener('change',function(ev){if(!isAgent)return;ev.stopImmediatePropagation();lastKey='';schedule(true)},true)});
 var t=document.getElementById('dashFilterToday');if(t&&!t.dataset.crm1AgentScopeV3){t.dataset.crm1AgentScopeV3='1';t.addEventListener('click',function(ev){if(!isAgent)return;ev.preventDefault();ev.stopImmediatePropagation();var d=today(),f=document.getElementById('dashFilterFrom'),to=document.getElementById('dashFilterTo'),ft=document.getElementById('dashFilterType');if(ft)ft.value='day';if(f)f.value=d;if(to)to.value=d;lastKey='';schedule(true)},true)}
}
function observe(){
 if(document.body.dataset.crm1AgentScopeV3Observed)return;document.body.dataset.crm1AgentScopeV3Observed='1';
 new MutationObserver(function(){
  bindFilters();
  if(isAgent&&document.getElementById('dashboardOrdersBody')&&tableHasForeignAgent())schedule(true);
 }).observe(document.body,{childList:true,subtree:true});
}
async function init(){
 if(!(await resolve()))return;
 bindFilters();observe();
 [0,100,250,500,1000,2000,3500,5000,8000].forEach(function(ms){setTimeout(function(){bindFilters();if(isAgent&&document.getElementById('dashboardOrdersBody'))schedule(ms===0||tableHasForeignAgent())},ms)});
 setInterval(function(){if(isAgent&&document.getElementById('dashboardOrdersBody')&&tableHasForeignAgent())schedule(true)},250);
 window.addEventListener('crm1DataChanged',function(){lastKey='';schedule(true)});
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
