/* CRM1 partner role UI final guard.
   Runs last so secondary navigation/renderers cannot restore restricted UI. */
(function(){
  'use strict';
  if(window.__crm1PartnerRoleUiFinalGuard)return;
  window.__crm1PartnerRoleUiFinalGuard=true;

  function text(x){return String(x==null?'':x).replace(/\s+/g,' ').trim().toLowerCase();}
  function esc(x){return String(x==null?'':x).replace(/[&<>"']/g,function(m){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]});}
  function roleNow(){
    var r=text(window.profile&&window.profile.role);
    if(r==='dealer'||r==='courier_manager')return r;
    var nav=document.getElementById('nav');
    var n=text(nav&&nav.textContent);
    if(n.indexOf('dealer orders')>=0)return 'dealer';
    if(n.indexOf('courier orders')>=0)return 'courier_manager';
    return '';
  }
  function isPartner(){return !!roleNow();}
  function hide(el){if(!el)return;el.classList.add('hidden');el.setAttribute('aria-hidden','true');el.style.setProperty('display','none','important');}
  function buttonLabel(el){return text((el&&el.textContent)||'');}
  function restricted(t){return t==='order timeline'||t.indexOf('order timeline')>=0||t==='conversion workbench'||t.indexOf('conversion workbench')>=0;}
  function money(v){return '₹'+Number(v||0).toLocaleString('en-IN');}
  function fmt(v){try{return new Intl.DateTimeFormat('en-IN',{timeZone:'Asia/Kolkata',day:'2-digit',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit',hour12:true}).format(new Date(v));}catch(e){return '-';}}
  function statusOptions(current){var a=['new','assigned','confirmed','dealer_pending','in_transit','delivered','rto','cancelled','hold'];current=text(current)||'new';if(a.indexOf(current)<0)a.unshift(current);return a.map(function(v){return '<option value="'+esc(v)+'"'+(v===current?' selected':'')+'>'+esc(v)+'</option>';}).join('');}

  function enforce(){
    if(!isPartner())return;
    var nav=document.getElementById('nav');
    if(nav)Array.prototype.slice.call(nav.querySelectorAll('button,a,[role="button"]')).forEach(function(el){if(restricted(buttonLabel(el)))el.remove();});
    ['timeline','conversionWorkbench'].forEach(function(id){hide(document.getElementById(id));});
    var settlements=document.getElementById('settlements');
    if(settlements){settlements.querySelectorAll('[data-crm1-settlement-generate="1"]').forEach(hide);Array.prototype.slice.call(settlements.querySelectorAll('.panel,section,div')).forEach(function(el){if(/^generate settlement\b/.test(buttonLabel(el)))hide(el);});}
  }

  async function renderPartnerOrders(page,role){
    if(!page||!window.sb)return;
    var u=await window.sb.auth.getUser();var me=u&&u.data&&u.data.user;if(!me)return;
    var q=window.sb.from('orders').select('id,order_no,order_status,total_amount,order_date,dealer_id,courier_manager_id,customers(customer_name,mobile),order_items(quantity,qty,products(product_name))').order('order_date',{ascending:false}).limit(500);
    if(role==='dealer'){
      var d=await window.sb.from('dealers').select('id').eq('user_id',me.id).maybeSingle();
      q=q.eq('dealer_id',d&&d.data?d.data.id:'00000000-0000-0000-0000-000000000000');
    }else q=q.eq('courier_manager_id',me.id);
    var r=await q;if(r.error)throw r.error;var rows=r.data||[];
    document.querySelectorAll('.page').forEach(function(p){p.classList.remove('active');});page.classList.add('active');
    page.innerHTML='<div class="title"><div><h2>'+(role==='dealer'?'Dealer Orders':'Courier Orders')+'</h2><div class="sub">Only orders assigned to your account</div></div></div><div class="panel" data-crm1-partner-orders="1"><div class="tablewrap"><table><thead><tr><th>Order</th><th>Customer</th><th>Mobile</th><th>Product</th><th>Amount</th><th>Date / Time</th><th>Status</th><th>Update</th></tr></thead><tbody>'+rows.map(function(o){var items=Array.isArray(o.order_items)?o.order_items:[];var products=items.length?items.map(function(i){return esc((i.products&&(i.products.product_name||i.products.name))||'Product')+' × '+Number(i.quantity||i.qty||0);}).join('<br>'):'-';return '<tr data-order-id="'+esc(o.id)+'"><td>#'+esc(o.order_no)+'</td><td>'+esc(o.customers&&o.customers.customer_name||'-')+'</td><td>'+esc(o.customers&&o.customers.mobile||'-')+'</td><td>'+products+'</td><td>'+money(o.total_amount)+'</td><td>'+esc(fmt(o.order_date))+'</td><td><span class="pill">'+esc(o.order_status||'new')+'</span></td><td><select class="crm1PartnerStatus" data-id="'+esc(o.id)+'">'+statusOptions(o.order_status)+'</select> <button type="button" class="crm1-mini crm1PartnerSave" data-id="'+esc(o.id)+'">Save</button></td></tr>';}).join('')+(rows.length?'':'<tr><td colspan="8" class="empty">No assigned orders</td></tr>')+'</tbody></table></div></div>';
    page.querySelectorAll('.crm1PartnerSave').forEach(function(b){b.onclick=async function(){var id=b.getAttribute('data-id'),s=page.querySelector('.crm1PartnerStatus[data-id="'+id+'"]');if(!s)return;b.disabled=true;try{var z=await window.sb.from('orders').update({order_status:s.value}).eq('id',id);if(z.error)throw z.error;var pill=b.closest('tr').querySelector('.pill');if(pill)pill.textContent=s.value;if(window.toast)window.toast('Order status updated');}catch(e){alert(e.message||String(e));}finally{b.disabled=false;}};});
  }

  function partnerPage(role){var active=document.querySelector('.page.active');if(active)return active;var want=role==='dealer'?'dealer orders':'courier orders';return Array.prototype.find.call(document.querySelectorAll('.page'),function(p){return text(p.textContent).indexOf(want)>=0;})||null;}
  function queuePartnerRender(role){var tries=0;var timer=setInterval(function(){var p=partnerPage(role);if(p){clearInterval(timer);renderPartnerOrders(p,role).catch(function(e){console.warn('CRM1 partner order render failed',e);});return;}if(++tries>20)clearInterval(timer);},50);}

  function boot(){
    enforce();
    var nav=document.getElementById('nav');
    if(nav)new MutationObserver(function(){enforce();}).observe(nav,{childList:true,subtree:true,characterData:true});
    var main=document.querySelector('main.main')||document.body;
    new MutationObserver(function(){enforce();}).observe(main,{childList:true,subtree:true});
    document.addEventListener('click',function(e){
      if(!isPartner())return;var b=e.target&&e.target.closest&&e.target.closest('button,a,[role="button"]');if(!b)return;var t=buttonLabel(b);var role=roleNow();
      if((role==='dealer'&&t.indexOf('dealer orders')>=0)||(role==='courier_manager'&&t.indexOf('courier orders')>=0)){setTimeout(function(){queuePartnerRender(role);},0);}
      setTimeout(enforce,0);
    },true);
    var tries=0;var timer=setInterval(function(){enforce();if(++tries>=120)clearInterval(timer);},250);
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
