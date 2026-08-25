/* CRM1 Agent Dashboard Orders scope fix: keep Your Orders limited to the logged-in agent on initial load and date/month changes. */
(function(){
'use strict';
if(window.__crm1AgentDashboardOrdersScopeFix)return;
window.__crm1AgentDashboardOrdersScopeFix=true;
var URL='https://ielebadardbzmoxantsc.supabase.co';
var KEY='sb_publishable_0pekrOT6vhYZYQ48wHr7Ag_NPcpobGj';
var db=null,refreshTimer=null,lastAgentId=null;
function profile(){return window.profile||null}
function isAgent(){return String(profile()?.role||'').toLowerCase()==='agent'}
async function user(){
  var u=window.me||null;
  if(u?.id)return u;
  try{if(window.sb?.auth){var r=await window.sb.auth.getUser();if(r.data?.user)return r.data.user}}catch(e){}
  try{if(db?.auth){var r2=await db.auth.getUser();if(r2.data?.user)return r2.data.user}}catch(e){}
  return null;
}
function startUtc(k){return new Date(String(k)+'T00:00:00+05:30').toISOString()}
function nextDay(k){var p=String(k).split('-').map(Number);return new Date(Date.UTC(p[0],p[1]-1,p[2]+1)).toISOString().slice(0,10)}
function istToday(){return new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Kolkata',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date())}
function range(){
  var type=document.getElementById('dashFilterType')?.value||'day';
  var from=document.getElementById('dashFilterFrom')?.value||istToday();
  var to=document.getElementById('dashFilterTo')?.value||from;
  if(type==='month'){
    if(!/^\d{4}-\d{2}$/.test(from))from=istToday().slice(0,7);
    if(!/^\d{4}-\d{2}$/.test(to))to=from;
    if(to<from){var m=from;from=to;to=m}
    var a=from.split('-').map(Number),b=to.split('-').map(Number);
    return {from:a[0]+'-'+String(a[1]).padStart(2,'0')+'-01',to:new Date(Date.UTC(b[0],b[1],1)).toISOString().slice(0,10),label:from===to?from:from+' to '+to};
  }
  if(to<from){var d=from;from=to;to=d}
  return {from:from,to:nextDay(to),label:from===to?from:from+' to '+to};
}
function esc(s){return String(s==null?'':s).replace(/[&<>\"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',"'":'&#39;'}[c]})}
function productText(o){var items=Array.isArray(o.order_items)?o.order_items:[];return items.length?items.map(function(i){return esc(i.products?.product_name||i.products?.name||'Product')+' × '+Number(i.quantity||0)}).join('<br>'):'-'}
async function fetchRows(agentId){
  var r=range();
  var q=db.from('orders').select('id,order_no,order_status,total_amount,order_date,customers(customer_name,mobile),profiles!orders_agent_id_fkey(full_name),dealers(dealer_name),order_items(quantity,products(product_name))').or('remarks.is.null,remarks.not.ilike.%[ENQUIRY]%').eq('agent_id',agentId).gte('order_date',startUtc(r.from)).lt('order_date',startUtc(r.to)).order('order_date',{ascending:false}).limit(500);
  var res=await q;if(res.error)throw res.error;return {rows:res.data||[],range:r};
}
function render(x){
  var rows=x.rows,r=x.range;
  var body=document.getElementById('dashboardOrdersBody');
  if(body)body.innerHTML=rows.map(function(o){return '<tr><td>#'+esc(o.order_no)+'</td><td>'+esc(o.customers?.customer_name||'-')+'</td><td>'+esc(o.customers?.mobile||'-')+'</td><td>'+productText(o)+'</td><td>'+esc(o.profiles?.full_name||'-')+'</td><td>'+esc(o.dealers?.dealer_name||'-')+'</td><td><span class="pill">'+esc(o.order_status||'-')+'</span></td><td>₹'+Number(o.total_amount||0).toLocaleString('en-IN')+'</td></tr>'}).join('')||'<tr><td colspan="8" class="empty">No orders</td></tr>';
  var stats={sOrders:rows.length,sPending:rows.filter(function(o){return /new|pending|confirmed|dealer_pending|assigned|hold/i.test(String(o.order_status||''))}).length,sTransit:rows.filter(function(o){return String(o.order_status||'').toLowerCase()==='in_transit'}).length,sDelivered:rows.filter(function(o){return String(o.order_status||'').toLowerCase()==='delivered'}).length,sCancelled:rows.filter(function(o){return String(o.order_status||'').toLowerCase()==='cancelled'}).length};
  Object.keys(stats).forEach(function(k){var el=document.getElementById(k);if(el)el.textContent=stats[k]});
  var label=document.getElementById('sOrdersLabel');if(label)label.textContent=(r.label===istToday()?'आज के Orders':'Orders ('+r.label+')');
}
async function refresh(){
  if(!isAgent()||!document.getElementById('dashboardOrdersBody'))return;
  var u=await user();if(!u?.id)return;
  if(!db)db=window.sb||window.supabase?.createClient?.(URL,KEY);if(!db)return;
  lastAgentId=u.id;
  try{render(await fetchRows(u.id))}catch(e){console.warn('CRM1 agent dashboard scope fix:',e)}
}
function schedule(){clearTimeout(refreshTimer);refreshTimer=setTimeout(refresh,0)}
function guardEvents(){
  document.addEventListener('change',function(e){if(!isAgent())return;var id=e.target?.id||'';if(id==='dashFilterType'||id==='dashFilterFrom'||id==='dashFilterTo'){e.stopImmediatePropagation();schedule()}},true);
  document.addEventListener('click',function(e){if(!isAgent())return;var id=e.target?.id||e.target?.closest?.('#dashFilterToday')?.id||'';if(id==='dashFilterToday'){e.preventDefault();e.stopImmediatePropagation();var t=istToday(),f=document.getElementById('dashFilterFrom'),to=document.getElementById('dashFilterTo'),ft=document.getElementById('dashFilterType');if(ft)ft.value='day';if(f)f.value=t;if(to)to.value=t;schedule()}},true);
}
function wrapRefresh(){
  var fn=window.crm1RefreshDashboardIST;
  if(typeof fn!=='function'||fn.__agentScopeWrapped)return;
  var wrapped=function(){if(isAgent())return refresh();return fn.apply(this,arguments)};
  wrapped.__agentScopeWrapped=true;window.crm1RefreshDashboardIST=wrapped;
}
function observe(){
  if(!document.body||document.body.dataset.crm1AgentDashScopeObserved)return;
  document.body.dataset.crm1AgentDashScopeObserved='1';
  new MutationObserver(function(){wrapRefresh();if(isAgent()&&document.getElementById('dashboardOrdersBody'))schedule()}).observe(document.body,{childList:true,subtree:true});
}
function init(){
  guardEvents();observe();
  var tries=0,t=setInterval(function(){tries++;wrapRefresh();if(isAgent()&&document.getElementById('dashboardOrdersBody'))refresh();if(tries>=80)clearInterval(t)},250);
  schedule();
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
