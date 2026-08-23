/* CRM1 Dealer/Courier workflow + partner performance enhancement.
   Isolated module: preserves existing CRM1 core flow and strengthens delivery status/history/reporting.
   Also normalizes CRM1 order date filtering to India Standard Time (Asia/Kolkata).
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
  function istBoundary(v){
    if(!/^\d{4}-\d{2}-\d{2}$/.test(String(v||'')))return v;
    return new Date(v+'T00:00:00+05:30').toISOString();
  }
  function patchIstDateFiltering(){
    if(window.__crm1IstDatePatch)return;
    var old=window.applyDateRange;
    if(typeof old!=='function')return;
    window.__crm1IstDatePatch=true;
    window.applyDateRange=function(q,section){
      var r=typeof window.getFilterRange==='function'?window.getFilterRange(section):null;
      if(!r)return old(q,section);
      return q.gte('order_date',istBoundary(r.from)).lt('order_date',istBoundary(r.to));
    };
  }
  async function getOrder(id){var r=await window.sb.from('orders').select('id,order_status,dealer_id,courier_manager_id,order_no').eq('id',id).maybeSingle();if(r.error)throw r.error;return r.data}
  async function reconcileHistory(orderId,previousStatus,newStatus,details){
    if(!orderId||!newStatus)return;
    try{var r=await window.sb.from('order_status_history').select('id,old_status,new_status,remarks,created_at').eq('order_id',orderId).eq('new_status',newStatus).order('created_at',{ascending:false}).limit(5);if(r.error||!r.data||!r.data.length)return;var target=(r.data||[]).find(function(h){return !h.old_status});if(!target)return;var patch={old_status:previousStatus||null};if(details)patch.remarks=details;await window.sb.from('order_status_history').update(patch).eq('id',target.id)}catch(e){console.warn('CRM history reconciliation skipped',e)}}
  async function ensureCurrentStatus(orderId,expectedStatus,previousStatus){
    if(!orderId||!expectedStatus||!window.sb)return;
    try{
      var now=await getOrder(orderId);
      if(!now)return;
      if(String(now.order_status||'')!==String(expectedStatus)){
        var u=await window.sb.from('orders').update({order_status:expectedStatus}).eq('id',orderId);
        if(u.error){console.warn('CRM status sync failed',u.error);return}
      }
      await reconcileHistory(orderId,previousStatus||now.order_status,expectedStatus,'Status synchronized');
      window.dispatchEvent(new CustomEvent('crm1DataChanged',{detail:{type:'order_status_updated',order_id:orderId,status:expectedStatus}}));
    }catch(e){console.warn('CRM status synchronization skipped',e)}
  }
  async function captureOrderStatuses(ids){var map={};for(var i=0;i<ids.length;i++){try{var o=await getOrder(ids[i]);if(o)map[o.id]={status:o.order_status||null,orderNo:o.order_no}}catch(e){}}return map}
  function scheduleReconcile(ids,oldMap){(ids||[]).forEach(function(id){clearTimeout(timers[id]);timers[id]=setTimeout(async function(){try{var now=await getOrder(id);if(now&&oldMap[id]&&oldMap[id].status!==now.order_status)await reconcileHistory(id,oldMap[id].status,now.order_status,null)}catch(e){}},900)})}
  function hookActionHistory(){
    if(document.body.dataset.crm1DeliveryHooked==='1')return;document.body.dataset.crm1DeliveryHooked='1';
    document.addEventListener('click',async function(e){
      var assign=e.target.closest('.assignBtn');if(assign){var id=assign.dataset.order;var old=await captureOrderStatuses([id]);setTimeout(function(){scheduleReconcile([id],old)},80);return}
      var bulk=e.target.closest('#bulkAssignBtn');if(bulk){var ids=[].map.call(document.querySelectorAll('#assignmentBody .assignmentCheck:checked'),function(x){return x.dataset.order}).filter(Boolean);var old=await captureOrderStatuses(ids);setTimeout(function(){scheduleReconcile(ids,old)},100);return}
      var verify=e.target.closest('.c1Verify');if(verify){var idv=verify.dataset.id;var oldv=await captureOrderStatuses([idv]);setTimeout(function(){scheduleReconcile([idv],oldv)},120);return}
    },true);
    document.addEventListener('change',async function(e){
      var sel=e.target.closest('.statusSel,.courierStatusSel');if(!sel)return;
      var id=sel.dataset.order,oldStatus=sel.dataset.old||'',expectedStatus=sel.value;
      if(!id||!expectedStatus||expectedStatus===oldStatus)return;
      var oldMap={};oldMap[id]={status:oldStatus||null};
      setTimeout(function(){scheduleReconcile([id],oldMap)},120);
      /* Core handler asks for confirmation and should update orders first. If another
         history/verification layer records the event but leaves orders stale, repair
         the source-of-truth row only after the confirmation handler has completed. */
      setTimeout(async function(){
        if(sel.value!==expectedStatus)return;
        try{var now=await getOrder(id);if(!now)return;if(String(now.order_status||'')!==String(expectedStatus))await ensureCurrentStatus(id,expectedStatus,oldStatus)}catch(err){}
      },750);
    },true)
  }
  function enhanceStatusSelects(root,role){var statuses=ROLE_STATUS[role]||ROLE_STATUS.dealer;(root||document).querySelectorAll('.statusSel,.courierStatusSel').forEach(function(sel){if(sel.dataset.crm1DeliveryEnhanced==='1')return;sel.dataset.crm1DeliveryEnhanced='1';var value=sel.value||sel.dataset.old||'';sel.innerHTML=statuses.map(function(s){return '<option value="'+esc(s)+'" '+(s===value?'selected':'')+'>'+esc(s.replace(/_/g,' '))+'</option>'}).join('');if(value&&statuses.indexOf(value)<0){var o=document.createElement('option');o.value=value;o.textContent=value.replace(/_/g,' ');o.selected=true;sel.appendChild(o)}})}
  async function enhanceDealerCourierPage(){
    var p=currentProfile();if(!p)return;var role=p.role;if(role!=='dealer'&&role!=='courier_manager')return;var pageId=role==='dealer'?'dealers':'courierOrders';var page=document.getElementById(pageId);if(!page)return;
    var existing=page.querySelector('.crm1DeliveryKpi');if(!existing){existing=document.createElement('div');existing.className='panel crm1DeliveryKpi';existing.innerHTML='<div class="cards"><div class="stat"><span>Assigned</span><b id="crm1DelAssigned">0</b></div><div class="stat"><span>In Progress</span><b id="crm1DelProgress">0</b></div><div class="stat"><span>Delivered</span><b id="crm1DelDelivered">0</b></div><div class="stat"><span>RTO / Cancelled</span><b id="crm1DelRto">0</b></div></div><div class="sub">Status updates are recorded in Order Timeline with the previous and new status.</div>';page.insertBefore(existing,page.querySelector('.panel')||page.firstChild)}
    enhanceStatusSelects(page,role);
    var q=window.sb.from('orders').select('id,order_status,order_date').limit(1000);if(role==='dealer'){var d=await window.sb.from('dealers').select('id').eq('user_id',currentUser().id).maybeSingle();if(!d.data)q=q.eq('dealer_id','00000000-0000-0000-0000-000000000000');else q=q.eq('dealer_id',d.data.id)}else q=q.eq('courier_manager_id',currentUser().id);q=q.or('remarks.is.null,remarks.not.ilike.%[ENQUIRY]%');var r=await q;if(r.error)return;var rows=r.data||[];var assigned=rows.filter(function(x){return !TERMINAL.includes(x.order_status)}).length;var progress=rows.filter(function(x){return ['packed','dispatched','picked_up','in_transit','attempt_failed','hold'].includes(x.order_status)}).length;var delivered=rows.filter(function(x){return x.order_status==='delivered'}).length;var rto=rows.filter(function(x){return ['rto','cancelled'].includes(x.order_status)}).length;var a=document.getElementById('crm1DelAssigned'),b=document.getElementById('crm1DelProgress'),c=document.getElementById('crm1DelDelivered'),d2=document.getElementById('crm1DelRto');if(a)a.textContent=assigned;if(b)b.textContent=progress;if(c)c.textContent=delivered;if(d2)d2.textContent=rto;
  }
  function refreshActivePage(){var p=currentProfile();if(!p)return;if(p.role==='dealer'||p.role==='courier_manager')enhanceDealerCourierPage()}
  function watchPages(){['dealers','courierOrders'].forEach(function(id){var el=document.getElementById(id);if(!el)return;var obs=new MutationObserver(function(){if(el.classList.contains('active'))setTimeout(enhanceDealerCourierPage,80)});obs.observe(el,{attributes:true,attributeFilter:['class']})});document.addEventListener('click',function(e){if(e.target.closest('#nav button'))setTimeout(refreshActivePage,250)})}
  function init(){if(started)return;started=true;hookActionHistory();watchPages();[200,500,1500,3000].forEach(function(ms){setTimeout(patchIstDateFiltering,ms);setTimeout(refreshActivePage,ms)})}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
