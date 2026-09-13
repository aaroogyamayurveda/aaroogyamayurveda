/* CRM1 Generate Invoice: additive Orders & Delivery workspace. */
(function(){
  'use strict';
  if(window.__crm1GenerateInvoiceLoaded)return;
  window.__crm1GenerateInvoiceLoaded=true;
  var PAGE='crm1GenerateInvoicePage', NAV='crm1GenerateInvoiceNav';
  var $=function(id){return document.getElementById(id)};
  var esc=function(v){return String(v==null?'':v).replace(/[&<>"']/g,function(m){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]})};
  var money=function(v){return '₹'+Number(v||0).toLocaleString('en-IN')};
  var fmt=function(v){try{return new Intl.DateTimeFormat('en-IN',{timeZone:'Asia/Kolkata',day:'2-digit',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit',hour12:true}).format(new Date(v))}catch(e){return '-'}};
  function db(){return window.sb}
  function ensurePage(){
    if($(PAGE))return;
    var main=document.querySelector('.main');if(!main)return;
    var p=document.createElement('section');p.id=PAGE;p.className='page';
    p.innerHTML='<div class="title"><div><h2>Generate Invoice</h2><div class="sub">Search by Order Number or Mobile Number and generate a printable invoice or Excel export.</div></div></div>'+
      '<div class="panel"><div class="search"><input id="crm1InvoiceSearch" placeholder="Order Number or Mobile Number" autocomplete="off"><button type="button" class="btn" id="crm1InvoiceFind">Search</button><button type="button" class="btn alt" id="crm1InvoiceClear">Clear</button></div><div id="crm1InvoiceMsg" class="sub" style="margin-top:9px"></div></div><div id="crm1InvoiceResults"></div>';
    main.appendChild(p);
    $('crm1InvoiceFind').onclick=search;
    $('crm1InvoiceClear').onclick=function(){$('crm1InvoiceSearch').value='';$('crm1InvoiceResults').innerHTML='';$('crm1InvoiceMsg').textContent=''};
    $('crm1InvoiceSearch').addEventListener('keydown',function(e){if(e.key==='Enter')search()});
  }
  function ensureNav(){
    var nav=$('nav');if(!nav||$(NAV))return;
    var b=document.createElement('button');b.id=NAV;b.type='button';b.dataset.crm1Group='orders';b.textContent='▣ Generate Invoice';
    b.onclick=function(e){e.preventDefault();e.stopPropagation();openPage()};
    nav.appendChild(b);
  }
  function openPage(){ensurePage();var pages=document.querySelectorAll('.main .page');pages.forEach(function(p){p.classList.remove('active')});var p=$(PAGE);if(p)p.classList.add('active');document.querySelectorAll('#nav button').forEach(function(b){b.classList.remove('active')});var b=$(NAV);if(b)b.classList.add('active');window.scrollTo({top:0,left:0,behavior:'instant'});var s=$('crm1InvoiceSearch');if(s)setTimeout(function(){s.focus()},0)}
  function selectString(){return 'id,order_no,order_status,total_amount,order_date,payment_mode,shipping_address,city,state,pin_code,remarks,customers(customer_name,mobile,alternate_mobile,address,city,state,pincode,area_post),order_items(quantity,qty,unit_price,products(product_name))'}
  async function search(){
    var term=($('crm1InvoiceSearch').value||'').trim(),msg=$('crm1InvoiceMsg'),out=$('crm1InvoiceResults');
    if(!term){msg.textContent='Order Number ya Mobile Number enter karein.';out.innerHTML='';return}
    if(!db()){msg.textContent='CRM database unavailable.';return}
    msg.textContent='Searching…';out.innerHTML='';
    try{
      var select=selectString(),a,b;
      if(/^\d{10}$/.test(term)){
        b=await db().from('orders').select(select).filter('customers.mobile','ilike','%'+term+'%').limit(50);
        a=await db().from('orders').select(select).ilike('order_no','%'+term+'%').limit(50);
      }else{
        a=await db().from('orders').select(select).ilike('order_no','%'+term+'%').limit(50);
        b={data:[],error:null};
      }
      if(a.error)throw a.error;if(b.error)throw b.error;
      var map={};(a.data||[]).concat(b.data||[]).forEach(function(o){map[o.id]=o});
      var rows=Object.keys(map).map(function(k){return map[k]}).sort(function(x,y){return new Date(y.order_date||0)-new Date(x.order_date||0)});
      msg.textContent=rows.length?rows.length+' order(s) found':'No matching order found';render(rows);
    }catch(e){msg.textContent='Search failed: '+(e.message||String(e))}
  }
  function render(rows){
    var out=$('crm1InvoiceResults');if(!rows.length){out.innerHTML='<div class="panel empty">No matching order found.</div>';return}
    out.innerHTML='<div class="panel"><div class="tablewrap"><table><thead><tr><th>Order</th><th>Customer</th><th>Mobile</th><th>Date</th><th>Status</th><th>Amount</th><th>Action</th></tr></thead><tbody>'+rows.map(function(o){var c=o.customers||{};return '<tr><td>#'+esc(o.order_no||o.id)+'</td><td>'+esc(c.customer_name||'-')+'</td><td>'+esc(c.mobile||'-')+'</td><td>'+esc(fmt(o.order_date))+'</td><td><span class="pill">'+esc(o.order_status||'-')+'</span></td><td>'+money(o.total_amount)+'</td><td><button type="button" class="btn crm1InvoicePrint" data-id="'+esc(o.id)+'">Generate / Print PDF</button> <button type="button" class="btn alt crm1InvoiceExcel" data-id="'+esc(o.id)+'">Excel</button></td></tr>'}).join('')+'</tbody></table></div></div>';
    out.querySelectorAll('.crm1InvoicePrint').forEach(function(b){b.onclick=function(){printInvoice(b.dataset.id)}});
    out.querySelectorAll('.crm1InvoiceExcel').forEach(function(b){b.onclick=function(){exportExcel(b.dataset.id)}});
  }
  async function getOrder(id){var r=await db().from('orders').select(selectString()).eq('id',id).single();if(r.error)throw r.error;return r.data}
  function data(o){var c=o.customers||{},items=Array.isArray(o.order_items)?o.order_items:[],addr=[c.address||o.shipping_address,c.area_post,c.city||o.city,c.state||o.state,c.pincode||o.pin_code].filter(Boolean).join(', '),lines=items.map(function(i){var p=i.products||{},q=Number(i.quantity||i.qty||0),u=Number(i.unit_price||0);return{name:p.product_name||'Product',qty:q,price:u,total:q*u}});return{o:o,c:c,addr:addr,lines:lines}}
  function invoiceHtml(d){var o=d.o,c=d.c;return '<div class="paper"><div class="head"><div><div class="brand">Aaroogyam Ayurveda</div><div class="sub">ORDER INVOICE</div></div><div class="meta"><b>Order #'+esc(o.order_no)+'</b><br>'+esc(fmt(o.order_date))+'</div></div><div class="grid"><div><b>Customer</b><br>'+esc(c.customer_name||'-')+'<br>'+esc(c.mobile||'-')+(c.alternate_mobile?'<br>'+esc(c.alternate_mobile):'')+'</div><div><b>Delivery Address</b><br>'+esc(d.addr||'-')+'</div></div><table><thead><tr><th>Product</th><th>Qty</th><th>Unit Price</th><th>Line Total</th></tr></thead><tbody>'+(d.lines.length?d.lines.map(function(x){return '<tr><td>'+esc(x.name)+'</td><td>'+x.qty+'</td><td>'+money(x.price)+'</td><td>'+money(x.total)+'</td></tr>'}).join(''):'<tr><td colspan="4">-</td></tr>')+'</tbody></table><div class="total"><b>Total</b><b>'+money(o.total_amount)+'</b></div><div class="foot">Payment: '+esc(o.payment_mode||'-')+' · Status: '+esc(o.order_status||'-')+'<br>Generated from CRM order data. No GSTIN, HSN, tax, discount, or other field is added unless stored in CRM.</div></div>'}
  function printInvoice(id){getOrder(id).then(function(o){var d=data(o),w=window.open('','_blank');if(!w){alert('Popup blocked. Please allow popups for CRM.');return}w.document.write('<!doctype html><html><head><title>Order '+esc(o.order_no)+'</title><style>*{box-sizing:border-box}body{margin:0;background:#f4f7f4;font-family:Arial,sans-serif;color:#18241d}.paper{width:760px;max-width:100%;margin:25px auto;background:#fff;padding:34px}.head{display:flex;justify-content:space-between;border-bottom:3px solid #164b30;padding-bottom:15px;margin-bottom:22px}.brand{font:700 28px Georgia,serif;color:#164b30}.meta{text-align:right}.grid{display:grid;grid-template-columns:1fr 1fr;gap:18px;margin-bottom:22px}.grid>div{border:1px solid #dfe7e1;border-radius:10px;padding:14px;line-height:1.55}table{width:100%;border-collapse:collapse;font-size:13px}th,td{text-align:left;padding:10px;border-bottom:1px solid #e7ece8}th{background:#f3f7f3}.total{display:flex;justify-content:space-between;margin-top:20px;padding-top:12px;border-top:2px solid #164b30;font-size:18px}.foot{margin-top:25px;padding-top:12px;border-top:1px dashed #b9c7bd;font-size:11px;color:#69756e}@media print{body{background:#fff}.paper{margin:0;width:auto;padding:12mm}}</style></head><body>'+invoiceHtml(d)+'</body></html>');w.document.close();w.focus();setTimeout(function(){w.print()},250)}).catch(function(e){alert('Invoice failed: '+(e.message||String(e)))})}
  function csv(v){return '"'+String(v==null?'':v).replace(/"/g,'""')+'"'}
  function exportExcel(id){getOrder(id).then(function(o){var d=data(o),lines=d.lines.length?d.lines:[{name:'',qty:'',price:'',total:''}],head=['Order No','Order Date','Status','Payment Mode','Customer Name','Mobile','Alternate Mobile','Address','City','State','PIN','Product','Quantity','Unit Price','Line Total'],text='\ufeff'+head.map(csv).join(',')+'\n'+lines.map(function(x){return [o.order_no,fmt(o.order_date),o.order_status,o.payment_mode,d.c.customer_name,d.c.mobile,d.c.alternate_mobile,d.addr,d.c.city||o.city,d.c.state||o.state,d.c.pincode||o.pin_code,x.name,x.qty,x.price,x.total].map(csv).join(',')}).join('\n'),blob=new Blob([text],{type:'text/csv;charset=utf-8;'}),a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='Order-'+String(o.order_no||o.id)+'.csv';document.body.appendChild(a);a.click();setTimeout(function(){URL.revokeObjectURL(a.href);a.remove()},500)}).catch(function(e){alert('Excel export failed: '+(e.message||String(e)))})}
  function start(){ensurePage();ensureNav();if(document.readyState==='loading')return;setTimeout(ensureNav,250);setTimeout(ensureNav,1000)}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
})();
