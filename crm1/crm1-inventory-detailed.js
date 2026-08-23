/* CRM1 Inventory detailed: stock summary, movement history and low-stock alerts. */
(function(){
  'use strict';
  var started=false,guardInstalled=false,guardTimer=null;
  var $=function(id){return document.getElementById(id)};
  function esc(v){return String(v==null?'':v).replace(/[&<>\"']/g,function(m){return{'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',"'":'&#039;'}[m]})}
  function iso(d){return new Date(d).toISOString().slice(0,10)}
  function today(){return iso(new Date())}
  function nextDay(v){var d=new Date(v+'T00:00:00');d.setDate(d.getDate()+1);return iso(d)}
  function money(v){return '₹'+Number(v||0).toLocaleString('en-IN')}
  function page(){return $('inventory')}
  function content(){return $('inventoryContent')}
  function build(){
    var p=page(),c=content();
    if(!p||!c||!p.classList.contains('active'))return false;
    c.innerHTML='<div id="crm1InventoryDetailedRoot">'+
      '<div class="panel"><div class="crm1-toolbar" style="display:flex;gap:10px;align-items:center;flex-wrap:wrap">'+
      '<label>From <input type="date" id="crm1InvFrom"></label>'+ 
      '<label>To <input type="date" id="crm1InvTo"></label>'+ 
      '<button class="btn" id="crm1InvApply">Apply</button><button class="btn alt" id="crm1InvToday">Today</button>'+ 
      '<select id="crm1InvProduct"><option value="">All Products</option></select>'+ 
      '<select id="crm1InvMovement"><option value="">All Movements</option><option value="in">Stock In</option><option value="out">Stock Out</option></select>'+ 
      '<button class="btn alt" id="crm1InvRefresh">Refresh</button>'+ 
      '</div><div class="crm1-muted" id="crm1InvMsg"></div></div>'+ 
      '<div class="cards" id="crm1InvKpis"></div>'+ 
      '<div class="panel"><h3>Current Stock</h3><div class="tablewrap"><table><thead><tr><th>Product</th><th>Current Stock</th><th>Low Stock Level</th><th>Alert</th><th>Price</th></tr></thead><tbody id="crm1InvStockBody"></tbody></table></div></div>'+ 
      '<div class="panel"><h3>Stock Movement</h3><div class="crm1-toolbar" style="display:flex;gap:10px;align-items:center;flex-wrap:wrap">'+
      '<select id="crm1InvMoveProduct"><option value="">Select Product</option></select>'+ 
      '<input id="crm1InvMoveQty" type="number" min="0.01" step="0.01" placeholder="Qty">'+ 
      '<select id="crm1InvMoveType"><option value="in">Stock In</option><option value="out">Stock Out</option></select>'+ 
      '<input id="crm1InvMoveRef" placeholder="Reference">'+ 
      '<input id="crm1InvMoveNote" placeholder="Note">'+ 
      '<button class="btn" id="crm1InvSaveMove">Save Movement</button>'+ 
      '</div></div>'+ 
      '<div class="panel"><h3>Movement History</h3><div class="tablewrap"><table><thead><tr><th>Date / Time</th><th>Product</th><th>Type</th><th>Qty</th><th>Reference</th><th>Note</th></tr></thead><tbody id="crm1InvMoveBody"></tbody></table></div></div>'+ 
      '</div>';
    var t=today();$('crm1InvFrom').value=t;$('crm1InvTo').value=t;
    $('crm1InvApply').onclick=load;$('crm1InvToday').onclick=function(){$('crm1InvFrom').value=today();$('crm1InvTo').value=today();load()};$('crm1InvRefresh').onclick=load;
    $('crm1InvProduct').onchange=load;$('crm1InvMovement').onchange=load;$('crm1InvSaveMove').onclick=saveMove;
    loadProducts().then(function(){return load()});
    return true;
  }
  async function loadProducts(){
    var filters=[$('crm1InvProduct'),$('crm1InvMoveProduct')];
    if(!filters[0]||!filters[1])return;
    try{
      var r=await window.sb.from('products').select('id,product_name,price,low_stock_level,active').order('product_name');
      if(r.error)throw r.error;var rows=r.data||[];
      filters[0].innerHTML='<option value="">All Products</option>'+rows.map(function(x){return '<option value="'+esc(x.id)+'">'+esc(x.product_name)+'</option>'}).join('');
      filters[1].innerHTML='<option value="">Select Product</option>'+rows.filter(function(x){return x.active!==false}).map(function(x){return '<option value="'+esc(x.id)+'">'+esc(x.product_name)+'</option>'}).join('');
    }catch(e){filters[0].innerHTML='<option value="">Product load error</option>';filters[1].innerHTML='<option value="">Product load error</option>'}
  }
  async function load(){
    var from=$('crm1InvFrom')?.value||today(),to=$('crm1InvTo')?.value||from;
    if(to<from){var z=from;from=to;to=z;$('crm1InvFrom').value=from;$('crm1InvTo').value=to}
    var msg=$('crm1InvMsg');if(!msg)return;msg.textContent='Loading...';
    try{
      var [pr,mv]=await Promise.all([
        window.sb.from('products').select('id,product_name,price,low_stock_level,active').order('product_name'),
        window.sb.from('inventory_movements').select('id,product_id,qty_in,qty_out,reference,note,created_at,products:product_id(product_name)').order('created_at',{ascending:false}).limit(1000)
      ]);
      if(pr.error)throw pr.error;if(mv.error)throw mv.error;
      var products=pr.data||[],movements=mv.data||[];
      var stock={};movements.forEach(function(m){stock[m.product_id]=(stock[m.product_id]||0)+Number(m.qty_in||0)-Number(m.qty_out||0)});
      var activeProducts=products.filter(function(p){return p.active!==false});
      var low=activeProducts.filter(function(p){return Number(stock[p.id]||0)<=Number(p.low_stock_level||10)});
      var totalStock=activeProducts.reduce(function(s,p){return s+Number(stock[p.id]||0)},0);
      var end=nextDay(to),rangeMoves=movements.filter(function(m){var d=new Date(m.created_at);var day=iso(d);return day>=from&&day<end});
      var selectedProduct=$('crm1InvProduct')?.value||'',selectedType=$('crm1InvMovement')?.value||'';
      if(selectedProduct)rangeMoves=rangeMoves.filter(function(m){return String(m.product_id)===selectedProduct});
      if(selectedType==='in')rangeMoves=rangeMoves.filter(function(m){return Number(m.qty_in||0)>0});
      if(selectedType==='out')rangeMoves=rangeMoves.filter(function(m){return Number(m.qty_out||0)>0});
      var qtyIn=rangeMoves.reduce(function(s,m){return s+Number(m.qty_in||0)},0),qtyOut=rangeMoves.reduce(function(s,m){return s+Number(m.qty_out||0)},0);
      $('crm1InvKpis').innerHTML='<div class="stat"><span>Products</span><b>'+activeProducts.length+'</b></div><div class="stat"><span>Total Stock</span><b>'+Number(totalStock).toLocaleString('en-IN')</b></div><div class="stat"><span>Stock In</span><b>'+Number(qtyIn).toLocaleString('en-IN')</b></div><div class="stat"><span>Stock Out</span><b>'+Number(qtyOut).toLocaleString('en-IN')+'</b></div><div class="stat"><span>Low Stock</span><b>'+low.length+'</b></div>';
      $('crm1InvStockBody').innerHTML=activeProducts.map(function(p){var q=Number(stock[p.id]||0),lvl=Number(p.low_stock_level||10),alert=q<=lvl?'<span class="pill" style="background:#fdecec;color:#a33">Low Stock</span>':'<span class="pill">OK</span>';return '<tr><td><b>'+esc(p.product_name)+'</b></td><td>'+q+'</td><td>'+lvl+'</td><td>'+alert+'</td><td>'+money(p.price)+'</td></tr>'}).join('')||'<tr><td colspan="5" class="empty">No products</td></tr>';
      $('crm1InvMoveBody').innerHTML=rangeMoves.map(function(m){var qty=Number(m.qty_in||0)-Number(m.qty_out||0),type=Number(m.qty_in||0)>0?'Stock In':'Stock Out';return '<tr><td>'+esc(new Date(m.created_at).toLocaleString('en-IN'))+'</td><td>'+esc(m.products?.product_name||'-')+'</td><td>'+type+'</td><td>'+Math.abs(qty)+'</td><td>'+esc(m.reference||'-')+'</td><td>'+esc(m.note||'-')+'</td></tr>'}).join('')||'<tr><td colspan="6" class="empty">No movements for selected period</td></tr>';
      msg.textContent='Report: '+from+' to '+to;
    }catch(e){msg.textContent='Report error: '+(e.message||e)}
  }
  async function saveMove(){
    var product_id=$('crm1InvMoveProduct')?.value,qty=Number($('crm1InvMoveQty')?.value||0),type=$('crm1InvMoveType')?.value||'in',ref=$('crm1InvMoveRef')?.value.trim()||null,note=$('crm1InvMoveNote')?.value.trim()||null;
    if(!product_id||qty<=0)return alert('Product and valid quantity required');
    if(type==='out'){
      var r=await window.sb.from('inventory_movements').select('qty_in,qty_out').eq('product_id',product_id);if(r.error)return alert(r.error.message);var current=(r.data||[]).reduce(function(s,m){return s+Number(m.qty_in||0)-Number(m.qty_out||0)},0);if(qty>current)return alert('Stock Out cannot exceed current stock ('+current+')');
    }
    var payload={product_id:product_id,qty_in:type==='in'?qty:0,qty_out:type==='out'?qty:0,reference:ref,note:note,created_by:null};
    try{var u=await window.sb.auth.getUser();payload.created_by=u?.data?.user?.id||null}catch(e){}
    var r2=await window.sb.from('inventory_movements').insert(payload);if(r2.error)return alert(r2.error.message);
    $('crm1InvMoveQty').value='';$('crm1InvMoveRef').value='';$('crm1InvMoveNote').value='';alert('Stock movement saved');load();
  }
  function installGuard(){var c=content();if(!c||!window.MutationObserver||guardInstalled)return;guardInstalled=true;var obs=new MutationObserver(function(){var p=page();if(!p||!p.classList.contains('active'))return;if($('crm1InventoryDetailedRoot'))return;clearTimeout(guardTimer);guardTimer=setTimeout(function(){var pp=page();if(pp&&pp.classList.contains('active')&&!$('crm1InventoryDetailedRoot'))build()},40)});obs.observe(c,{childList:true,subtree:true});c._crm1InvObserver=obs}
  function ensure(){var p=page();if(!p||!p.classList.contains('active'))return;installGuard();if(!$('crm1InventoryDetailedRoot'))build()}
  function init(){if(started)return;started=true;var tries=0,t=setInterval(function(){var p=page();if(p&&p.classList.contains('active')){ensure();clearInterval(t)}if(++tries>120)clearInterval(t)},250);document.addEventListener('click',function(e){var b=e.target.closest('#nav button');if(b&&/inventory/i.test(String(b.textContent||''))){setTimeout(ensure,0);setTimeout(ensure,100);setTimeout(ensure,500)}})}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
