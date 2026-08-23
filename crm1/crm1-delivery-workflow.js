/* CRM1 Dealer/Courier workflow + partner performance enhancement.
   Isolated module: preserves existing CRM1 core flow and only strengthens delivery status/history/reporting.
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
  function fmt(v){
    if(!v)return '-';
    try{return new Intl.DateTimeFormat('en-IN',{timeZone:'Asia/Kolkata',day:'2-digit',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit',hour12:true}).format(new Date(v));}
    catch(e){return String(v)}
  }
  function money(v){return '₹'+Number(v||0).toLocaleString('en-IN')}
  function toast(t){if(typeof window.toast==='function')window.toast(t);else console.log(t)}
  function currentProfile(){return window.profile||null}
  function currentUser(){return window.me||null}

  async function getOrder(id){
    var r=await window.sb.from('orders').select('id,order_status,dealer_id,courier_manager_id,order_no').eq('id',id).maybeSingle();
    if(r.error)throw r.error;return r.data;
  }

  async function reconcileHistory(orderId,previousStatus,newStatus,details){
    if(!orderId||!newStatus)return;
    try{
      var q=window.sb.from('order_status_history')
        .select('id,old_status,new_status,remarks,created_at')
        .eq('order_id',orderId)
        .eq('new_status',newStatus)
        .order('created_at',{ascending:false})
        .limit(5);
      var r=await q;
      if(r.error||!r.data||!r.data.length)return;
      var target=(r.data||[]).find(function(h){return !h.old_status});
      if(!target)return;
      var patch={old_status:previousStatus||null};
      if(details)patch.remarks=details;
      await window.sb.from('order_status_history').update(patch).eq('id',target.id);
    }catch(e){console.warn('CRM history reconciliation skipped',e)}
  }

  async function captureOrderStatuses(ids){
    var map={};
    for(var i=0;i<ids.length;i++){
      try{var o=await getOrder(ids[i]);if(o)map[o.id]={status:o.order_status||null,orderNo:o.order_no}}catch(e){}
    }
    return map;
  }

  function scheduleReconcile(ids,oldMap){
    (ids||[]).forEach(function(id){
      clearTimeout(timers[id]);
      timers[id]=setTimeout(async function(){
        try{
          var now=await getOrder(id);
          if(now && oldMap[id] && oldMap[id].status!==now.order_status){
            await reconcileHistory(id,oldMap[id].status,now.order_status,null);
          }
        }catch(e){}
      },900);
    });
  }

  function hookActionHistory(){
    if(document.body.dataset.crm1DeliveryHooked==='1')return;
    document.body.dataset.crm1DeliveryHooked='1';

    document.addEventListener('click',async function(e){
      var assign=e.target.closest('.assignBtn');
      if(assign){
        var id=assign.dataset.order;
        var old=await captureOrderStatuses([id]);
        setTimeout(function(){scheduleReconcile([id],old)},80);
        return;
      }

      var bulk=e.target.closest('#bulkAssignBtn');
      if(bulk){
        var ids=[].map.call(document.querySelectorAll('#assignmentBody .assignmentCheck:checked'),function(x){return x.dataset.order}).filter(Boolean);
        var old=await captureOrderStatuses(ids);
        setTimeout(function(){scheduleReconcile(ids,old)},100);
        return;
      }

      var verify=e.target.closest('.c1Verify');
      if(verify){
        var idv=verify.dataset.id;
        var oldv=await captureOrderStatuses([idv]);
        setTimeout(function(){scheduleReconcile([idv],oldv)},120);
        return;
      }
    },true);

    document.addEventListener('change',async function(e){
      var sel=e.target.closest('.statusSel,.courierStatusSel');
      if(!sel)return;
      var id=sel.dataset.order,oldStatus=sel.dataset.old||'';
      if(!id)return;
      var oldMap={};oldMap[id]={status:oldStatus||null};
      setTimeout(function(){scheduleReconcile([id],oldMap)},120);
    },true);
  }

  function enhanceStatusSelects(root,role){
    var statuses=ROLE_STATUS[role]||ROLE_STATUS.dealer;
    (root||document).querySelectorAll('.statusSel,.courierStatusSel').forEach(function(sel){
      if(sel.dataset.crm1DeliveryEnhanced==='1')return;
      sel.dataset.crm1DeliveryEnhanced='1';
      var value=sel.value;
      sel.innerHTML=statuses.map(function(s){return '<option value="'+esc(s)+'" '+(s===value?'selected':'')+'>'+esc(s.replace(/_/g,' '))+'</option>'}).join('');
      if(value && statuses.indexOf(value)<0){
        var o=document.createElement('option');o.value=value;o.textContent=value.replace(/_/g,' ');o.selected=true;sel.appendChild(o);
      }
    });
  }

  async function enhanceDealerCourierPage(){
    var p=currentProfile();if(!p)return;
    var role=p.role;
    if(role!=='dealer'&&role!=='courier_manager')return;
    var pageId=role==='dealer'?'dealers':'courierOrders';
    var page=document.getElementById(pageId);if(!page)return;
    var existing=page.querySelector('.crm1DeliveryKpi');
    if(!existing){
      existing=document.createElement('div');existing.className='panel crm1DeliveryKpi';
      existing.innerHTML='<div class="cards"><div class="stat"><span>Assigned</span><b id="crm1DelAssigned">0</b></div><div class="stat"><span>In Progress</span><b id="crm1DelProgress">0</b></div><div class="stat"><span>Delivered</span><b id="crm1DelDelivered">0</b></div><div class="stat"><span>RTO / Cancelled</span><b id="crm1DelRto">0</b></div></div><div class="sub">Status updates are recorded in Order Timeline with the previous and new status.</div>';
      page.insertBefore(existing,page.querySelector('.panel')||page.firstChild);
    }
    enhanceStatusSelects(page,role);
    var q=window.sb.from('orders').select('id,order_status,order_date').limit(1000);
    if(role==='dealer'){
      var d=await window.sb.from('dealers').select('id').eq('user_id',currentUser().id).maybeSingle();
      if(!d.data){q=q.eq('dealer_id','00000000-0000-0000-0000-000000000000')}else q=q.eq('dealer_id',d.data.id);
    }else q=q.eq('courier_manager_id',currentUser().id);
    q=q.or('remarks.is.null,remarks.not.ilike.%[ENQUIRY]%');
    var r=await q;if(r.error)return;
    var rows=r.data||[];
    var assigned=rows.filter(function(x){return !TERMINAL.includes(x.order_status)}).length;
    var progress=rows.filter(function(x){return ['packed','dispatched','picked_up','in_transit','attempt_failed','hold'].includes(x.order_status)}).length;
    var delivered=rows.filter(function(x){return x.order_status==='delivered'}).length;
    var rto=rows.filter(function(x){return ['rto','cancelled'].includes(x.order_status)}).length;
    var a=document.getElementById('crm1DelAssigned'),b=document.getElementById('crm1DelProgress'),c=document.getElementById('crm1DelDelivered'),d2=document.getElementById('crm1DelRto');
    if(a)a.textContent=assigned;if(b)b.textContent=progress;if(c)c.textContent=delivered;if(d2)d2.textContent=rto;
  }

  async function renderPartnerPerformance(){
    var page=document.getElementById('partnerPerformance');
    var c=document.getElementById('partnerPerformanceContent');
    if(!page||!c)return;
    c.innerHTML='<div class="crm1-muted">Loading partner performance...</div>';
    var [or,dr,pr]=await Promise.all([
      window.sb.from('orders').select('id,order_status,total_amount,dealer_id,courier_manager_id,order_date,remarks'),
      window.sb.from('dealers').select('id,dealer_name,is_active'),
      window.sb.from('profiles').select('id,full_name,is_active').eq('role','courier_manager')
    ]);
    if(or.error){c.innerHTML='<div class="msg">'+esc(or.error.message)+'</div>';return}
    var dealerMap=new Map((dr.data||[]).map(function(x){return [x.id,{name:x.dealer_name||x.id,type:'Dealer'}]}));
    var courierMap=new Map((pr.data||[]).map(function(x){return [x.id,{name:x.full_name||x.id,type:'Courier'}]}));
    var map={};
    (or.data||[]).filter(function(o){return !String(o.remarks||'').includes('[ENQUIRY]')}).forEach(function(o){
      var partner=o.dealer_id?dealerMap.get(o.dealer_id):o.courier_manager_id?courierMap.get(o.courier_manager_id):null;
      if(!partner)return;
      var key=(o.dealer_id?'d:':'c:')+(o.dealer_id||o.courier_manager_id);
      if(!map[key])map[key]={name:partner.name,type:partner.type,assigned:0,delivered:0,inprogress:0,rto:0,cancelled:0,value:0};
      var x=map[key];x.assigned++;x.value+=Number(o.total_amount||0);
      if(o.order_status==='delivered')x.delivered++;
      else if(o.order_status==='rto')x.rto++;
      else if(o.order_status==='cancelled')x.cancelled++;
      else x.inprogress++;
    });
    var rows=Object.values(map).sort(function(a,b){return b.assigned-a.assigned});
    var total=rows.reduce(function(a,x){return a+x.assigned},0),td=rows.reduce(function(a,x){return a+x.delivered},0);
    c.innerHTML='<div class="cards"><div class="stat"><span>Partners</span><b>'+rows.length+'</b></div><div class="stat"><span>Assigned</span><b>'+total+'</b></div><div class="stat"><span>Delivered</span><b>'+td+'</b></div><div class="stat"><span>Overall Delivery %</span><b>'+(total?(td/total*100).toFixed(1):'0')+'%</b></div></div><div class="crm1-toolbar"><button class="btn alt" id="crm1PartnerRefresh">Refresh</button><span class="sub">Delivery performance is calculated from current order statuses.</span></div><div class="tablewrap"><table><thead><tr><th>Partner</th><th>Type</th><th>Assigned</th><th>In Progress</th><th>Delivered</th><th>RTO</th><th>Cancelled</th><th>Delivery %</th><th>Order Value</th></tr></thead><tbody>'+(rows.map(function(x){return '<tr><td>'+esc(x.name)+'</td><td>'+esc(x.type)+'</td><td>'+x.assigned+'</td><td>'+x.inprogress+'</td><td>'+x.delivered+'</td><td>'+x.rto+'</td><td>'+x.cancelled+'</td><td>'+(x.assigned?(x.delivered/x.assigned*100).toFixed(1):'0')+'%</td><td>'+money(x.value)+'</td></tr>'}).join('')||'<tr><td colspan="9" class="empty">No assigned delivery orders</td></tr>')+'</tbody></table></div>';
    var refreshBtn=document.getElementById('crm1PartnerRefresh');if(refreshBtn)refreshBtn.onclick=renderPartnerPerformance;
  }

  function refreshActivePage(){
    var p=currentProfile();if(!p)return;
    if(p.role==='dealer'||p.role==='courier_manager')enhanceDealerCourierPage();
    var page=document.getElementById('partnerPerformance');
    if(page&&page.classList.contains('active'))renderPartnerPerformance();
  }

  function watchPages(){
    ['dealers','courierOrders','partnerPerformance'].forEach(function(id){
      var el=document.getElementById(id);if(!el)return;
      var obs=new MutationObserver(function(){
        if(el.classList.contains('active')){
          if(id==='partnerPerformance')setTimeout(renderPartnerPerformance,50);else setTimeout(enhanceDealerCourierPage,80);
        }
      });
      obs.observe(el,{attributes:true,attributeFilter:['class']});
    });
    document.addEventListener('click',function(e){
      if(e.target.closest('#nav button'))setTimeout(refreshActivePage,250);
    });
  }

  function init(){
    if(started)return;started=true;
    hookActionHistory();
    watchPages();
    [500,1500,3000].forEach(function(ms){setTimeout(refreshActivePage,ms)});
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
