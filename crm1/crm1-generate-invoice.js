/* CRM1 Generate Invoice: isolated invoice search/print/export workspace. */
(function(){
  'use strict';

  var PAGE_ID='crm1GenerateInvoicePage';
  var NAV_ID='crm1GenerateInvoiceNav';
  var SEARCH_ID='crm1InvoiceSearch';
  var FIND_ID='crm1InvoiceFind';
  var CLEAR_ID='crm1InvoiceClear';
  var PRINT_ID='crm1InvoicePrint';
  var EXCEL_ID='crm1InvoiceExcel';
  var RESULTS_ID='crm1InvoiceResults';
  var started=false;
  var results=[];

  function $(id){return document.getElementById(id)}
  function esc(v){return String(v==null?'':v).replace(/[&<>\"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',"'":'&#39;'}[c]})}
  function money(v){var n=Number(v);return Number.isFinite(n)?'₹'+n.toLocaleString('en-IN',{minimumFractionDigits:2,maximumFractionDigits:2}):'-'}
  function date(v){if(!v)return '-';var d=new Date(v);return Number.isNaN(d.getTime())?esc(v):d.toLocaleDateString('en-IN',{timeZone:'Asia/Kolkata'})}
  function csv(v){var s=String(v==null?'':v);return '"'+s.replace(/"/g,'""')+'"'}

  function styles(){
    if($('crm1GenerateInvoiceStyle'))return;
    var s=document.createElement('style');s.id='crm1GenerateInvoiceStyle';
    s.textContent=''
      +'.crm1-invoice-card{background:#fff;border:1px solid var(--border);border-radius:14px;padding:18px;box-shadow:0 8px 22px #0000000d}'
      +'.crm1-invoice-search{display:flex;gap:10px;align-items:center;flex-wrap:wrap}'
      +'.crm1-invoice-search input{flex:1;min-width:260px;padding:11px 13px;border:1px solid var(--border);border-radius:9px}'
      +'.crm1-invoice-btn{border:0;border-radius:9px;padding:10px 14px;font-weight:800;cursor:pointer}'
      +'.crm1-invoice-btn.primary{background:var(--g);color:#fff}.crm1-invoice-btn.secondary{background:#eef3ef;color:var(--text)}'
      +'.crm1-invoice-results{margin-top:16px;display:grid;gap:12px}'
      +'.crm1-invoice-result{border:1px solid var(--border);border-radius:12px;padding:14px}'
      +'.crm1-invoice-meta{display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:8px;margin:10px 0;color:var(--text)}'
      +'.crm1-invoice-empty{padding:22px;text-align:center;color:#667}'
      +'.crm1-invoice-tools{display:flex;gap:8px;flex-wrap:wrap;margin-top:12px}'
      +'@media(max-width:700px){.crm1-invoice-search input{min-width:100%}}';
    document.head.appendChild(s)
  }

  function page(){
    var p=$(PAGE_ID);if(p)return p;
    p=document.createElement('section');p.id=PAGE_ID;p.className='page';
    p.innerHTML='<div class="title"><div><h2>Generate Invoice</h2><div class="muted">Search an order and print/save its invoice.</div></div></div>'
      +'<div class="crm1-invoice-card">'
      +'<div class="crm1-invoice-search">'
      +'<input id="'+SEARCH_ID+'" type="search" autocomplete="off" placeholder="Search by Order Number or Mobile Number">'
      +'<button id="'+FIND_ID+'" type="button" class="crm1-invoice-btn primary">Search Invoice</button>'
      +'<button id="'+CLEAR_ID+'" type="button" class="crm1-invoice-btn secondary">Clear</button>'
      +'</div>'
      +'<div class="crm1-invoice-tools"><button id="'+PRINT_ID+'" type="button" class="crm1-invoice-btn secondary" disabled>Print / PDF</button><button id="'+EXCEL_ID+'" type="button" class="crm1-invoice-btn secondary" disabled>Export to Excel</button></div>'
      +'<div id="'+RESULTS_ID+'" class="crm1-invoice-results"><div class="crm1-invoice-empty">Enter an order number or mobile number to search.</div></div>'
      +'</div>';
    (document.querySelector('.main')||document.body).appendChild(p);
    $(FIND_ID).addEventListener('click',search);
    $(SEARCH_ID).addEventListener('keydown',function(e){if(e.key==='Enter')search()});
    $(CLEAR_ID).addEventListener('click',clear);
    $(PRINT_ID).addEventListener('click',function(){if(results.length)printInvoice(results[0])});
    $(EXCEL_ID).addEventListener('click',exportExcel);
    return p
  }

  function show(){
    var p=page();document.querySelectorAll('.main .page').forEach(function(x){x.classList.remove('active')});p.classList.add('active');
    if($('crm1InvoiceSearch'))$('crm1InvoiceSearch').focus()
  }

  function nav(){
    var n=$('nav');if(!n)return;
    var b=$(NAV_ID);if(!b){
      b=document.createElement('button');b.id=NAV_ID;b.type='button';b.textContent='▣ Generate Invoice';
      b.addEventListener('click',function(e){e.preventDefault();e.stopPropagation();show()});
      n.appendChild(b)
    }
  }

  async function search(){
    var input=$(SEARCH_ID), box=$(RESULTS_ID);if(!input||!box)return;
    var term=input.value.trim();if(!term){box.innerHTML='<div class="crm1-invoice-empty">Enter an order number or mobile number.</div>';return}
    if(!window.sb){box.innerHTML='<div class="crm1-invoice-empty">CRM database is not ready. Please try again.</div>';return}
    box.innerHTML='<div class="crm1-invoice-empty">Searching…</div>';
    try{
      var orderRows=[];
      var orderQuery=window.sb.from('orders').select('id,order_no,order_status,total_amount,order_date,customer_id,payment_mode,shipping_address,city,state,pin_code,remarks,customers(customer_name,mobile,address,state,city,pincode,area_post),order_items(quantity,qty,unit_price,product_id,products(product_name))');
      var byOrder=await orderQuery.ilike('order_no','%'+term.replace(/[%_]/g,'')+'%').order('order_date',{ascending:false}).limit(50);
      if(byOrder.error)throw byOrder.error;orderRows=(byOrder.data||[]).slice();
      if(/^\d{10}$/.test(term)){
        var cr=await window.sb.from('customers').select('id').eq('mobile',term).limit(20);
        if(cr.error)throw cr.error;
        var ids=(cr.data||[]).map(function(x){return x.id}).filter(Boolean);
        if(ids.length){
          var byMobile=await window.sb.from('orders').select('id,order_no,order_status,total_amount,order_date,customer_id,payment_mode,shipping_address,city,state,pin_code,remarks,customers(customer_name,mobile,address,state,city,pincode,area_post),order_items(quantity,qty,unit_price,product_id,products(product_name))').in('customer_id',ids).order('order_date',{ascending:false}).limit(50);
          if(byMobile.error)throw byMobile.error;orderRows=orderRows.concat(byMobile.data||[])
        }
      }
      var seen={};results=orderRows.filter(function(x){if(!x||seen[x.id])return false;seen[x.id]=1;return true}).slice(0,50);
      renderResults();
    }catch(e){results=[];box.innerHTML='<div class="crm1-invoice-empty">Invoice search failed: '+esc(e&&e.message||e)+'</div>';setTools()}
  }

  function renderResults(){
    var box=$(RESULTS_ID);if(!box)return;
    if(!results.length){box.innerHTML='<div class="crm1-invoice-empty">No matching order found.</div>';setTools();return}
    box.innerHTML=results.map(function(o){
      var c=o.customers||{};var addr=o.shipping_address||c.address||'';var location=[o.city||c.city,o.state||c.state,o.pin_code||c.pincode].filter(Boolean).join(', ');
      var items=o.order_items||[];
      return '<article class="crm1-invoice-result"><strong>Order #'+esc(o.order_no||'-')+'</strong>'
        +'<div class="crm1-invoice-meta"><div>Customer: '+esc(c.customer_name||'-')+'</div><div>Mobile: '+esc(c.mobile||'-')+'</div><div>Date: '+date(o.order_date)+'</div><div>Status: '+esc(o.order_status||'-')+'</div><div>Payment: '+esc(o.payment_mode||'-')+'</div><div>Total: '+money(o.total_amount)+'</div></div>'
        +'<div>Address: '+esc(addr||'-')+(location?' · '+esc(location):'')+'</div>'
        +'<div class="crm1-invoice-tools"><button type="button" class="crm1-invoice-btn primary" data-invoice-id="'+esc(o.id)+'">Print / PDF</button></div>'
        +'<details><summary>Invoice items</summary><div>'+((items.length)?items.map(function(i){var p=i.products||{};var q=Number(i.quantity!=null?i.quantity:i.qty||0);var u=Number(i.unit_price||0);return '<div>'+esc(p.product_name||'Product')+' · Qty '+esc(q)+' · '+money(u)+' = '+money(q*u)+'</div>'}).join(''):'No item details stored.')+'</div></details>'
        +'</article>'
    }).join('');
    box.querySelectorAll('[data-invoice-id]').forEach(function(b){b.addEventListener('click',function(){var o=results.find(function(x){return String(x.id)===String(b.dataset.invoiceId)});if(o)printInvoice(o)})});
    setTools()
  }

  function setTools(){var disabled=!results.length;if($(PRINT_ID))$(PRINT_ID).disabled=disabled;if($(EXCEL_ID))$(EXCEL_ID).disabled=disabled}
  function clear(){results=[];if($(SEARCH_ID))$(SEARCH_ID).value='';if($(RESULTS_ID))$(RESULTS_ID).innerHTML='<div class="crm1-invoice-empty">Enter an order number or mobile number to search.</div>';setTools()}

  function invoiceHtml(o){
    var c=o.customers||{};var items=o.order_items||[];var addr=o.shipping_address||c.address||'-';var location=[o.city||c.city,o.state||c.state,o.pin_code||c.pincode].filter(Boolean).join(', ');
    var rows=items.map(function(i){var p=i.products||{};var q=Number(i.quantity!=null?i.quantity:i.qty||0);var u=Number(i.unit_price||0);return '<tr><td>'+esc(p.product_name||'Product')+'</td><td>'+esc(q)+'</td><td>'+money(u)+'</td><td>'+money(q*u)+'</td></tr>'}).join('');
    return '<!doctype html><html><head><meta charset="utf-8"><title>Invoice '+esc(o.order_no||'')+'</title><style>body{font-family:Arial,sans-serif;margin:32px;color:#222}h1{margin:0 0 4px}table{width:100%;border-collapse:collapse;margin-top:20px}th,td{border:1px solid #ccc;padding:8px;text-align:left}th:nth-child(n+2),td:nth-child(n+2){text-align:right}.meta{margin-top:20px;line-height:1.7}.total{margin-top:16px;text-align:right;font-size:18px;font-weight:bold}@media print{button{display:none}}</style></head><body><h1>Aaroogyam Ayurveda</h1><div>Invoice / Order No: <b>'+esc(o.order_no||'-')+'</b></div><div>Date: '+date(o.order_date)+'</div><div class="meta"><b>Customer:</b> '+esc(c.customer_name||'-')+'<br><b>Mobile:</b> '+esc(c.mobile||'-')+'<br><b>Address:</b> '+esc(addr)+(location?' · '+esc(location):'')+'<br><b>Status:</b> '+esc(o.order_status||'-')+'<br><b>Payment:</b> '+esc(o.payment_mode||'-')+'</div><table><thead><tr><th>Product</th><th>Qty</th><th>Unit Price</th><th>Line Total</th></tr></thead><tbody>'+rows+'</tbody></table><div class="total">Order Total: '+money(o.total_amount)+'</div><p>Only CRM-stored order information is shown on this invoice.</p><button onclick="window.print()">Print / Save as PDF</button></body></html>'
  }
  function printInvoice(o){var w=window.open('','_blank','noopener,noreferrer');if(!w){alert('Please allow pop-ups to print the invoice.');return}w.document.write(invoiceHtml(o));w.document.close()}
  function exportExcel(){if(!results.length)return;var rows=[['Order Number','Order Date','Status','Customer','Mobile','Address','City','State','PIN','Payment Mode','Product','Quantity','Unit Price','Line Total','Order Total']];results.forEach(function(o){var c=o.customers||{};var items=o.order_items||[];if(!items.length)items=[{}];items.forEach(function(i){var p=i.products||{};var q=Number(i.quantity!=null?i.quantity:i.qty||0);var u=Number(i.unit_price||0);rows.push([o.order_no,date(o.order_date),o.order_status,c.customer_name,c.mobile,o.shipping_address||c.address,o.city||c.city,o.state||c.state,o.pin_code||c.pincode,o.payment_mode,p.product_name||'',q,u,q*u,o.total_amount])})});var csvText='\uFEFF'+rows.map(function(r){return r.map(csv).join(',')}).join('\r\n');var a=document.createElement('a');a.href=URL.createObjectURL(new Blob([csvText],{type:'text/csv;charset=utf-8'}));a.download='Generate-Invoice-Export.csv';document.body.appendChild(a);a.click();a.remove();setTimeout(function(){URL.revokeObjectURL(a.href)},1000)}

  function start(){if(started)return;started=true;styles();page();nav();
    var obs=new MutationObserver(function(){if(!$('nav')||!$('crm1GenerateInvoiceNav'))nav()});obs.observe(document.body,{childList:true,subtree:true});
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
})();
