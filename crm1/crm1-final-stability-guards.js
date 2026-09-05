/* CRM1 final late-render stability guards. */
(function(){
  'use strict';
  if(window.__crm1FinalStabilityGuards)return;
  window.__crm1FinalStabilityGuards=true;

  function dedupeCallControls(){
    var ids=['crm1StartCall','crm1EndCall','crm1DialNumber','crm1LogCall'];
    var canonical=document.getElementById('crm1CallConsole');
    ids.forEach(function(id){
      var nodes=Array.prototype.slice.call(document.querySelectorAll('[id="'+id+'"]'));
      if(nodes.length<2)return;
      var keep=canonical?nodes.find(function(n){return canonical.contains(n)}):null;
      keep=keep||nodes[0];
      nodes.forEach(function(n){if(n!==keep&&n.parentNode)n.parentNode.removeChild(n);});
    });
  }

  function partnerOrderPage(role){
    var want=role==='dealer'?'dealer orders':'courier orders';
    return Array.prototype.find.call(document.querySelectorAll('.page'),function(p){
      return String(p.textContent||'').replace(/\s+/g,' ').trim().toLowerCase().indexOf(want)>=0;
    })||null;
  }

  async function renderPartner(role){
    if(!window.sb)return;
    var user=(await window.sb.auth.getUser()).data&& (await window.sb.auth.getUser()).data.user;
    if(!user)return;
    var page=partnerOrderPage(role);if(!page)return;
    if(page.querySelector('[data-crm1-partner-orders="1"]'))return;
    var q=window.sb.from('orders').select('id,order_no,order_status,total_amount,order_date,dealer_id,courier_manager_id,customers(customer_name,mobile),order_items(quantity,qty,products(product_name))').order('order_date',{ascending:false}).limit(500);
    if(role==='dealer'){
      var d=await window.sb.from('dealers').select('id').eq('user_id',user.id).maybeSingle();
      q=q.eq('dealer_id',d&&d.data?d.data.id:'00000000-0000-0000-0000-000000000000');
    }else q=q.eq('courier_manager_id',user.id);
    var r=await q;if(r.error)return;
    var rows=r.data||[];
    page.innerHTML='<div class="title"><div><h2>'+(role==='dealer'?'Dealer Orders':'Courier Orders')+'</h2><div class="sub">Only orders assigned to your account</div></div></div><div class="panel" data-crm1-partner-orders="1"><div class="tablewrap"><table><thead><tr><th>Order</th><th>Customer</th><th>Mobile</th><th>Product</th><th>Amount</th><th>Date / Time</th><th>Status</th><th>Update</th></tr></thead><tbody>'+rows.map(function(o){var items=Array.isArray(o.order_items)?o.order_items:[];var products=items.length?items.map(function(i){return String((i.products&&i.products.product_name)||'Product')+' × '+Number(i.quantity||i.qty||0)}).join('<br>'):'-';return '<tr><td>#'+String(o.order_no||'')+'</td><td>'+String(o.customers&&o.customers.customer_name||'-')+'</td><td>'+String(o.customers&&o.customers.mobile||'-')+'</td><td>'+products+'</td><td>₹'+Number(o.total_amount||0).toLocaleString('en-IN')+'</td><td>'+new Date(o.order_date).toLocaleString('en-IN',{timeZone:'Asia/Kolkata'})+'</td><td><span class="pill">'+String(o.order_status||'new')+'</span></td><td><select class="crm1PartnerStatus" data-id="'+String(o.id)+'"><option value="new">new</option><option value="assigned">assigned</option><option value="confirmed">confirmed</option><option value="dealer_pending">dealer_pending</option><option value="in_transit">in_transit</option><option value="delivered">delivered</option><option value="rto">rto</option><option value="cancelled">cancelled</option><option value="hold">hold</option></select> <button type="button" class="crm1-mini crm1PartnerSave" data-id="'+String(o.id)+'">Save</button></td></tr>';}).join('')+(rows.length?'':'<tr><td colspan="8" class="empty">No assigned orders</td></tr>')+'</tbody></table></div></div>';
  }

  function boot(){
    dedupeCallControls();
    [50,150,300,750,1500,3000,6000,10000].forEach(function(ms){setTimeout(dedupeCallControls,ms)});
    var root=document.documentElement;
    if(root)new MutationObserver(function(){dedupeCallControls()}).observe(root,{childList:true,subtree:true});
    document.addEventListener('click',function(e){
      var b=e.target&&e.target.closest&&e.target.closest('#nav button');
      if(!b)return;
      var t=String(b.textContent||'').replace(/\s+/g,' ').trim().toLowerCase();
      if(t.indexOf('dealer orders')>=0)setTimeout(function(){renderPartner('dealer')},100);
      if(t.indexOf('courier orders')>=0)setTimeout(function(){renderPartner('courier_manager')},100);
    },true);
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
