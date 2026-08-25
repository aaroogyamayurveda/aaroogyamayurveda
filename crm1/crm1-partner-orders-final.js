/* CRM1 authoritative Dealer/Courier order renderer. Loaded last. */
(function(){
'use strict';
if(window.__crm1PartnerOrdersFinalStarted)return;
window.__crm1PartnerOrdersFinalStarted=true;
var timer=0;
function esc(v){return String(v==null?'':v).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c];});}
function money(v){return '₹'+Number(v||0).toLocaleString('en-IN');}
function profile(){return window.currentProfile||window.profile||window.crmProfile||null;}
function role(){var p=profile();return String((p&&p.role)||window.currentRole||'').toLowerCase();}
function partnerMode(){var r=role();return r==='dealer'||r==='courier_manager'||r==='courier';}
function userId(){var p=profile();return (p&&p.id)||window.currentUserId||null;}
function findNavButton(label){return Array.prototype.filter.call(document.querySelectorAll('#nav button'),function(b){return (b.textContent||'').trim().toLowerCase().indexOf(label.toLowerCase())>=0;})[0]||null;}
function activePage(){return document.querySelector('.page.active');}
function pageIsPartnerOrders(){var p=activePage();if(!p)return false;var id=(p.id||'').toLowerCase();var text=(p.textContent||'').toLowerCase();return id.indexOf('dealer')>=0&&id.indexOf('order')>=0||id.indexOf('courier')>=0&&id.indexOf('order')>=0||/dealer orders|courier orders/.test(text);}
async function getOrders(){
 var sb=window.sb;if(!sb)return [];
 var uid=userId();var r=role();
 var q=sb.from('orders').select('id,order_no,order_status,total_amount,dealer_id,courier_manager_id,customer_id,order_date,customers(customer_name,mobile),order_items(quantity,products(product_name,name))').order('order_date',{ascending:false}).limit(1000);
 if(r==='dealer'&&uid)q=q.eq('dealer_id',uid); else if((r==='courier_manager'||r==='courier')&&uid)q=q.eq('courier_manager_id',uid);
 var res=await q;if(res.error)throw res.error;return res.data||[];
}
function productText(o){var a=o.order_items||[];return a.map(function(x){var p=x.products||{};return (p.product_name||p.name||'Product')+' × '+Number(x.quantity||1);}).join(', ')||'-';}
function statusOptions(cur){var vals=['new','assigned','packed','shipped','out_for_delivery','delivered','rto','cancelled'];return vals.map(function(v){return '<option value="'+v+'"'+(String(cur||'new').toLowerCase()===v?' selected':'')+'>'+v.replace(/_/g,' ')+'</option>';}).join('');}
async function saveStatus(id,select,button,msg){var sb=window.sb;var status=select.value;if(!sb)return;button.disabled=true;msg.textContent='Saving...';try{var r=await sb.from('orders').update({order_status:status}).eq('id',id);if(r.error)throw r.error;msg.textContent='Saved';setTimeout(function(){msg.textContent='';},1500);}catch(e){msg.textContent='Error: '+(e&&e.message||e);}finally{button.disabled=false;}}
function render(rows){var page=activePage();if(!page)return;var title=(role()==='dealer'?'Dealer Orders':'Courier Orders');var html='<div class="title" data-crm1-partner-orders="1"><div><h2>'+title+'</h2><div class="sub">Orders assigned to you</div></div></div><div class="panel" data-crm1-partner-orders="1"><div class="tablewrap"><table><thead><tr><th>Order</th><th>Customer</th><th>Mobile</th><th>Product / Qty</th><th>Status</th><th>Amount</th><th>Update</th></tr></thead><tbody>'+rows.map(function(o){var c=o.customers||{};return '<tr><td>#'+esc(o.order_no||o.id)+'</td><td>'+esc(c.customer_name||'-')+'</td><td>'+esc(c.mobile||'-')+'</td><td>'+esc(productText(o))+'</td><td><span class="pill">'+esc(o.order_status||'new')+'</span></td><td>'+money(o.total_amount)+'</td><td><select class="crm1-partner-status" data-id="'+esc(o.id)+'">'+statusOptions(o.order_status)+'</select> <button class="btn crm1-partner-save" data-id="'+esc(o.id)+'">Save</button><span class="sub crm1-partner-msg" data-msg="'+esc(o.id)+'"></span></td></tr>';}).join('')+(rows.length?'':'<tr><td colspan="7" class="empty">No assigned orders</td></tr>')+'</tbody></table></div></div>';
 page.innerHTML=html;
 Array.prototype.forEach.call(page.querySelectorAll('.crm1-partner-save'),function(b){b.onclick=function(){var id=b.getAttribute('data-id'),s=page.querySelector('.crm1-partner-status[data-id="'+CSS.escape(id)+'"]'),m=page.querySelector('.crm1-partner-msg[data-msg="'+CSS.escape(id)+'"]');saveStatus(id,s,b,m);};});
}
async function enforce(){clearTimeout(timer);timer=setTimeout(async function(){if(!partnerMode()||!pageIsPartnerOrders())return;try{render(await getOrders());}catch(e){console.error('CRM1 partner orders final renderer:',e);}},120);}
function hidePartnerExtras(){if(!partnerMode())return;Array.prototype.forEach.call(document.querySelectorAll('#nav button'),function(b){var t=(b.textContent||'').trim().toLowerCase();if(t==='order timeline'||t==='conversion workbench')b.remove();});}
function hookNav(){var labels=['Dealer Orders','Courier Orders'];labels.forEach(function(label){var b=findNavButton(label);if(b&&!b.__crm1PartnerHook){b.__crm1PartnerHook=true;b.addEventListener('click',function(){setTimeout(enforce,0);setTimeout(enforce,500);setTimeout(enforce,1200);});}});}
var observer=new MutationObserver(function(){hidePartnerExtras();hookNav();enforce();});
function start(){hidePartnerExtras();hookNav();observer.observe(document.documentElement,{childList:true,subtree:true});setInterval(function(){hidePartnerExtras();hookNav();if(pageIsPartnerOrders())enforce();},1000);}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start);else start();
})();
