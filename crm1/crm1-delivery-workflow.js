/* CRM1 Dealer/Courier workflow + partner performance enhancement.
   Isolated module: preserves existing CRM1 core flow and strengthens delivery status/history/reporting.
   CRM1-wide IST date correction for dashboard/report/settlement UI is also applied here.
*/
(function(){
  'use strict';
  var started=false;
  var timers={};
  var ROLE_STATUS={
    dealer:['assigned','packed','dispatched','in_transit','delivered','hold','cancelled','rto'],
    courier_manager:['assigned','picked_up','in_transit','delivered','attempt_failed','hold','cancelled','rto']
  };
  var TERMINAL=['delivered','cancelled','rto'];
  function esc(v){return String(v==null?'':v).replace(/[&<>\"']/g,function(m){return {'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',"'":'&#039;'}[m]})}
  function currentProfile(){return window.profile||null}
  function currentUser(){return window.me||null}
  function istToday(){return new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Kolkata',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date())}
  function istBoundary(dateKey){return new Date(String(dateKey)+'T00:00:00+05:30').toISOString()}
  function istNextDay(dateKey){
    var p=String(dateKey||istToday()).split('-').map(Number);
    return new Date(Date.UTC(p[0],p[1]-1,p[2]+1)).toISOString().slice(0,10);
  }
  function normalizeDateFilters(){
    ['dash','reports'].forEach(function(section){
      var type=document.getElementById(section+'FilterType'),from=document.getElementById(section+'FilterFrom'),to=document.getElementById(section+'FilterTo');
      if(!type||!from||!to)return;
      if(type.value==='day'){
        var t=istToday();
        if(!/^\d{4}-\d{2}-\d{2}$/.test(from.value))from.value=t;
        if(!/^\d{4}-\d{2}-\d{2}$/.test(to.value))to.value=from.value||t;
      }
    });
  }
  async function getCorrectFilterRange(section){
    var type=document.getElementById(section+'FilterType')?.value||'day';
    var from=document.getElementById(section+'FilterFrom')?.value||istToday();
    var to=document.getElementById(section+'FilterTo')?.value||from;
    if(type==='month'){
      if(!/^\d{4}-\d{2}$/.test(from))from=istToday().slice(0,7);
      if(!/^\d{4}-\d{2}$/.test(to))to=from;
      if(to<from){var m=from;from=to;to=m}
      var p=to.split('-').map(Number);
      var endMonth=new Date(Date.UTC(p[0],p[1],1)).toISOString().slice(0,10);
      return {from:from+'-01',to:endMonth,label:from===to?from:from+' to '+to};
    }
    if(type==='year'){
      var fy=Number(from)||Number(istToday().slice(0,4)),ty=Number(to)||fy;if(ty<fy){var y=fy;fy=ty;ty=y}
      return {from:fy+'-01-01',to:String(ty+1)+'-01-01',label:fy===ty?String(fy):fy+' to '+ty};
    }
    if(to<from){var d=from;from=to;to=d}
    return {from:from,to:istNextDay(to),label:from===to?from:from+' to '+to};
  }
  async function queryRoleOrders(section){
    var range=await getCorrectFilterRange(section),p=currentProfile(),u=currentUser();
    var q=window.sb.from('orders').select('id,order_no,order_status,total_amount,order_date,customer_id,agent_id,dealer_id,courier_manager_id,customers(customer_name,mobile),profiles!orders_agent_id_fkey(full_name),dealers(dealer_name),order_items(quantity,unit_price,products(product_name))').or('remarks.is.null,remarks.not.ilike.%[ENQUIRY]%').gte('order_date',istBoundary(range.from)).lt('order_date',istBoundary(range.to)).order('order_date',{ascending:false}).limit(500);
    if(p?.role==='agent')q=q.eq('agent_id',u.id);
    if(p?.role==='courier_manager')q=q.eq('courier_manager_id',u.id);
    if(p?.role==='dealer'){
      var d=await window.sb.from('dealers').select('id').eq('user_id',u.id).maybeSingle();
      q=d.data?q.eq('dealer_id',d.data.id):q.eq('dealer_id','00000000-0000-0000-0000-000000000000');
    }
    var r=await q;if(r.error)throw r.error;return {rows:r.data||[],range:range};
  }
  function productText(o){
    var items=Array.isArray(o.order_items)?o.order_items:[];
    if(!items.length)return '-';
    return items.map(function(i){var p=i.products||{};return esc(p.product_name||p.name||'Product')+' × '+Number(i.quantity||0)}).join('<br>');
  }
  function renderDashboardOverride(result){
    var rows=result.rows,range=result.range;
    var count=function(){var ss=[].slice.call(arguments);return rows.filter(function(o){return ss.indexOf(String(o.order_status||'').toLowerCase())>=0}).length};
    var map={sOrders:rows.length,sPending:count('new','pending','confirmed','dealer_pending','assigned','hold'),sTransit:count('in_transit'),sDelivered:count('delivered'),sCancelled:count('cancelled')};
    Object.keys(map).forEach(function(id){var el=document.getElementById(id);if(el)el.textContent=map[id]});
    var label=document.getElementById('sOrdersLabel');if(label)label.textContent=range.label===istToday()?'आज के Orders':'Orders ('+range.label+')';
    var body=document.getElementById('dashboardOrdersBody');if(!body)return;
    body.innerHTML=rows.map(function(o){
      var partner=o.dealers?.dealer_name||'-';
      return '<tr><td>#'+esc(o.order_no)+'</td><td>'+esc(o.customers?.customer_name||'-')+'</td><td>'+esc(o.customers?.mobile||'-')+'</td><td>'+productText(o)+'</td><td>'+esc(o.profiles?.full_name||'-')+'</td><td>'+esc(partner)+'</td><td><span class="pill">'+esc(o.order_status||'-')+'</span></td><td>₹'+Number(o.total_amount||0).toLocaleString('en-IN')+'</td></tr>';
    }).join('')||'<tr><td colspan="8" class="empty">No orders</td></tr>';
    if(typeof window.crmRefreshEnhancements==='function')setTimeout(window.crmRefreshEnhancements,0);
  }
  async function refreshDashboardIST(){
    try{
      normalizeDateFilters();
      var r=await queryRoleOrders('dash');
      renderDashboardOverride(r);
    }catch(e){console.warn('CRM1 IST dashboard refresh skipped',e)}
  }
  async function refreshReportsIST(){
    try{
      normalizeDateFilters();
      var r=await queryRoleOrders('reports'),rows=r.rows,counts={};
      rows.forEach(function(o){var s=String(o.order_status||'-');counts[s]=(counts[s]||0)+1});
      var body=document.getElementById('reportBody');if(!body)return;
      body.innerHTML=Object.keys(counts).map(function(k){return '<div class="stat"><span>'+esc(k)+'</span><b>'+counts[k]+'</b></div>'}).join('')||'<div class="empty">No orders for selected period</div>';
    }catch(e){console.warn('CRM1 IST reports refresh skipped',e)}
  }
  function bindIstDateFilters(){
    ['dash','reports'].forEach(function(section){
      var type=document.getElementById(section+'FilterType'),from=document.getElementById(section+'FilterFrom'),to=document.getElementById(section+'FilterTo'),today=document.getElementById(section+'FilterToday');
      if(type&&!type.dataset.crm1IstBound){type.dataset.crm1IstBound='1';type.addEventListener('change',function(){setTimeout(section==='dash'?refreshDashboardIST:refreshReportsIST,0)})}
      if(from&&!from.dataset.crm1IstBound){from.dataset.crm1IstBound='1';from.addEventListener('change',function(){setTimeout(section==='dash'?refreshDashboardIST:refreshReportsIST,0)})}
      if(to&&!to.dataset.crm1IstBound){to.dataset.crm1IstBound='1';to.addEventListener('change',function(){setTimeout(section==='dash'?refreshDashboardIST:refreshReportsIST,0)})}
      if(today&&!today.dataset.crm1IstBound){today.dataset.crm1IstBound='1';today.addEventListener('click',function(){setTimeout(function(){var t=istToday();if(from)from.value=t;if(to)to.value=t;(section==='dash'?refreshDashboardIST:refreshReportsIST)()},0)})}
    });
  }
  function patchSettlementToday(){
    var p=document.getElementById('crm1SettStandalonePage');if(!p)return false;
    var from=document.getElementById('crm1SetFrom'),to=document.getElementById('crm1SetTo'),genFrom=document.getElementById('crm1SetGenFrom'),genTo=document.getElementById('crm1SetGenTo'),todayBtn=document.getElementById('crm1SetToday');
    if(!from||!to)return false;
    var t=istToday();
    if(!from.dataset.crm1IstPatched){
      from.dataset.crm1IstPatched='1';to.dataset.crm1IstPatched='1';
      from.value=t;to.value=t;if(genFrom)genFrom.value=t;if(genTo)genTo.value=t;
      if(todayBtn){todayBtn.onclick=function(){var n=istToday();from.value=n;to.value=n;if(genFrom)genFrom.value=n;if(genTo)genTo.value=n;var apply=document.getElementById('crm1SetApply');if(apply)apply.click()};}
      var apply=document.getElementById('crm1SetApply');if(apply)apply.click();
    }else if(todayBtn){todayBtn.onclick=function(){var n=istToday();from.value=n;to.value=n;if(genFrom)genFrom.value=n;if(genTo)genTo.value=n;var apply=document.getElementById('crm1SetApply');if(apply)apply.click()};}
    return true;
  }
  function watchDateUIs(){
    bindIstDateFilters();
    patchSettlementToday();
    if(!document.body.dataset.crm1DateWatcher){
      document.body.dataset.crm1DateWatcher='1';
      var obs=new MutationObserver(function(){bindIstDateFilters();patchSettlementToday()});
      obs.observe(document.body,{childList:true,subtree:true});
    }
    setTimeout(refreshDashboardIST,300);
  }
  async function getOrder(id){var r=await window.sb.from('orders').select('id,order_status,dealer_id,courier_manager_id,order_no').eq('id',id).maybeSingle();if(r.error)throw r.error;return r.data}
  async function reconcileHistory(orderId,previousStatus,newStatus,details){if(!orderId||!newStatus)return;try{var r=await window.sb.from('order_status_history').select('id,old_status,new_status,remarks,created_at').eq('order_id',orderId).eq('new_status',newStatus).order('created_at',{ascending:false}).limit(5);if(r.error||!r.data||!r.data.length)return;var target=(r.data||[]).find(function(h){return !h.old_status});if(!target)return;var patch={old_status:previousStatus||null};if(details)patch.remarks=details;await window.sb.from('order_status_history').update(patch).eq('id',target.id)}catch(e){console.warn('CRM history reconciliation skipped',e)}}
  async function ensureCurrentStatus(orderId,expectedStatus,previousStatus){if(!orderId||!expectedStatus||!window.sb)return;try{var now=await getOrder(orderId);if(!now)return;if(String(now.order_status||'')!==String(expectedStatus)){var u=await window.sb.from('orders').update({order_status:expectedStatus}).eq('id',orderId);if(u.error){console.warn('CRM status sync failed',u.error);return}}await reconcileHistory(orderId,previousStatus||now.order_status,expectedStatus,'Status synchronized');window.dispatchEvent(new CustomEvent('crm1DataChanged',{detail:{type:'order_status_updated',order_id:orderId,status:expectedStatus}}))}catch(e){console.warn('CRM status synchronization skipped',e)}}
  async function captureOrderStatuses(ids){var map={};for(var i=0;i<ids.length;i++){try{var o=await getOrder(ids[i]);if(o)map[o.id]={status:o.order_status||null,orderNo:o.order_no}}catch(e){}}return map}
  function scheduleReconcile(ids,oldMap){(ids||[]).forEach(function(id){clearTimeout(timers[id]);timers[id]=setTimeout(async function(){try{var now=await getOrder(id);if(now&&oldMap[id]&&oldMap[id].status!==now.order_status)await reconcileHistory(id,oldMap[id].status,now.order_status,null)}catch(e){}},900)})}
  function hookActionHistory(){if(document.body.dataset.crm1DeliveryHooked==='1')return;document.body.dataset.crm1DeliveryHooked='1';document.addEventListener('click',async function(e){var assign=e.target.closest('.assignBtn');if(assign){var id=assign.dataset.order;var old=await captureOrderStatuses([id]);setTimeout(function(){scheduleReconcile([id],old)},80);return}var bulk=e.target.closest('#bulkAssignBtn');if(bulk){var ids=[].map.call(document.querySelectorAll('#assignmentBody .assignmentCheck:checked'),function(x){return x.dataset.order}).filter(Boolean);var old=await captureOrderStatuses(ids);setTimeout(function(){scheduleReconcile(ids,old)},100);return}var verify=e.target.closest('.c1Verify');if(verify){var idv=verify.dataset.id;var oldv=await captureOrderStatuses([idv]);setTimeout(function(){scheduleReconcile([idv],oldv)},120);return}},true);document.addEventListener('change',async function(e){var sel=e.target.closest('.statusSel,.courierStatusSel');if(!sel)return;var id=sel.dataset.order,oldStatus=sel.dataset.old||'',expectedStatus=sel.value;if(!id||!expectedStatus||expectedStatus===oldStatus)return;var oldMap={};oldMap[id]={status:oldStatus||null};setTimeout(function(){scheduleReconcile([id],oldMap)},120);setTimeout(async function(){if(sel.value!==expectedStatus)return;try{var now=await getOrder(id);if(!now)return;if(String(now.order_status||'')!==String(expectedStatus))await ensureCurrentStatus(id,expectedStatus,oldStatus)}catch(err){}},750)},true)}
  function enhanceStatusSelects(root,role){var statuses=ROLE_STATUS[role]||ROLE_STATUS.dealer;(root||document).querySelectorAll('.statusSel,.courierStatusSel').forEach(function(sel){if(sel.dataset.crm1DeliveryEnhanced==='1')return;sel.dataset.crm1DeliveryEnhanced='1';var value=sel.value||sel.dataset.old||'';sel.innerHTML=statuses.map(function(s){return '<option value="'+esc(s)+'" '+(s===value?'selected':'')+'>'+esc(s.replace(/_/g,' '))+'</option>'}).join('');if(value&&statuses.indexOf(value)<0){var o=document.createElement('option');o.value=value;o.textContent=value.replace(/_/g,' ');o.selected=true;sel.appendChild(o)}})}
  async function enhanceDealerCourierPage(){var p=currentProfile();if(!p)return;var role=p.role;if(role!=='dealer'&&role!=='courier_manager')return;var pageId=role==='dealer'?'dealers':'courierOrders';var page=document.getElementById(pageId);if(!page)return;var existing=page.querySelector('.crm1DeliveryKpi');if(!existing){existing=document.createElement('div');existing.className='panel crm1DeliveryKpi';existing.innerHTML='<div class="cards"><div class="stat"><span>Assigned</span><b id="crm1DelAssigned">0</b></div><div class="stat"><span>In Progress</span><b id="crm1DelProgress">0</b></div><div class="stat"><span>Delivered</span><b id="crm1DelDelivered">0</b></div><div class="stat"><span>RTO / Cancelled</span><b id="crm1DelRto">0</b></div></div><div class="sub">Status updates are recorded in Order Timeline with the previous and new status.</div>';page.insertBefore(existing,page.querySelector('.panel')||page.firstChild)}enhanceStatusSelects(page,role);var q=window.sb.from('orders').select('id,order_status,order_date').limit(1000);if(role==='dealer'){var d=await window.sb.from('dealers').select('id').eq('user_id',currentUser().id).maybeSingle();if(!d.data)q=q.eq('dealer_id','00000000-0000-0000-0000-000000000000');else q=q.eq('dealer_id',d.data.id)}else q=q.eq('courier_manager_id',currentUser().id);q=q.or('remarks.is.null,remarks.not.ilike.%[ENQUIRY]%');var r=await q;if(r.error)return;var rows=r.data||[];var assigned=rows.filter(function(x){return !TERMINAL.includes(x.order_status)}).length;var progress=rows.filter(function(x){return ['packed','dispatched','picked_up','in_transit','attempt_failed','hold'].includes(x.order_status)}).length;var delivered=rows.filter(function(x){return x.order_status==='delivered'}).length;var rto=rows.filter(function(x){return ['rto','cancelled'].includes(x.order_status)}).length;var a=document.getElementById('crm1DelAssigned'),b=document.getElementById('crm1DelProgress'),c=document.getElementById('crm1DelDelivered'),d2=document.getElementById('crm1DelRto');if(a)a.textContent=assigned;if(b)b.textContent=progress;if(c)c.textContent=delivered;if(d2)d2.textContent=rto}
  function refreshActivePage(){var p=currentProfile();if(!p)return;if(p.role==='dealer'||p.role==='courier_manager')enhanceDealerCourierPage()}
  function watchPages(){['dealers','courierOrders'].forEach(function(id){var el=document.getElementById(id);if(!el)return;var obs=new MutationObserver(function(){if(el.classList.contains('active'))setTimeout(enhanceDealerCourierPage,80)});obs.observe(el,{attributes:true,attributeFilter:['class']})});document.addEventListener('click',function(e){if(e.target.closest('#nav button'))setTimeout(refreshActivePage,250)})}
  function init(){if(started)return;started=true;hookActionHistory();watchPages();[200,500,1200,2000,3000].forEach(function(ms){setTimeout(refreshActivePage,ms);setTimeout(watchDateUIs,ms)})}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
