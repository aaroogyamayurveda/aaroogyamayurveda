/* CRM1 Inventory detailed - syntax-safe stable renderer. */
(function(){
  'use strict';
  if(window.__crm1InventoryDetailedLoaded)return;
  window.__crm1InventoryDetailedLoaded=true;
  var started=false;
  function $(id){return document.getElementById(id)}
  function esc(v){return String(v==null?'':v).replace(/[&<>"']/g,function(m){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]})}
  function istDate(){return new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Kolkata',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date())}
  function nextDate(s){var d=new Date(s+'T00:00:00+05:30');d.setUTCDate(d.getUTCDate()+1);return new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Kolkata',year:'numeric',month:'2-digit',day:'2-digit'}).format(d)}
  function money(v){return '₹'+Number(v||0).toLocaleString('en-IN')}
  function page(){return $('inventory')}
  function content(){return $('inventoryContent')}
  async function loadProducts(){
    var a=$('crm1InvProduct'),b=$('crm1InvMoveProduct');
    if(!a||!b||!window.sb)return;
    var r=await window.sb.from('products').select('id,product_name,price,low_stock_level,active').order('product_name');
    if(r.error)throw r.error;
    var rows=r.data||[];
    a.innerHTML='<option value="">All Products</option>'+rows.map(function(x){return '<option value="'+esc(x.id)+'">'+esc(x.product_name)+'</option>'}).join('');
    b.innerHTML='<option value="">Select Product</option>'+rows.filter(function(x){return x.active!==false}).map(function(x){return '<option value="'+esc(x.id)+'">'+esc(x.product_name)+'</option>'}).join('');
  }
  async function load(){
    var msg=$('crm1InvMsg');
    if(!msg||!window.sb)return;
    var from=$('crm1InvFrom').value||istDate(),to=$('crm1InvTo').value||from;
    if(to<from){var z=from;from=to;to=z;$('crm1InvFrom').value=from;$('crm1InvTo').value=to}
    msg.textContent='Loading...';
    try{
      var p=await window.sb.from('products').select('id,product_name,price,low_stock_level,active').order('product_name');
      var m=await window.sb.from('inventory_movements').select('id,product_id,qty_in,qty_out,reference,note,created_at,products:product_id(product_name)').order('created_at',{ascending:false}).limit(1000);
      if(p.error)throw p.error;if(m.error)throw m.error;
      var products=p.data||[],moves=m.data||[],stock={};
      moves.forEach(function(x){stock[x.product_id]=(stock[x.product_id]||0)+Number(x.qty_in||0)-Number(x.qty_out||0)});
      var active=products.filter(function(x){return x.active!==false});
      var low=active.filter(function(x){return Number(stock[x.id]||0)<=Number(x.low_stock_level||10)});
      var total=active.reduce(function(s,x){return s+Number(stock[x.id]||0)},0);
      var end=nextDate(to),range=moves.filter(function(x){var d=new Date(x.created_at);var s=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Kolkata'}).format(d);return s>=from&&s<end});
      var fp=$('crm1InvProduct').value||'',ft=$('crm1InvMovement').value||'';
      if(fp)range=range.filter(function(x){return String(x.product_id)===fp});
      if(ft==='in')range=range.filter(function(x){return Number(x.qty_in||0)>0});
      if(ft==='out')range=range.filter(function(x){return Number(x.qty_out||0)>0});
      var qin=range.reduce(function(s,x){return s+Number(x.qty_in||0)},0),qout=range.reduce(function(s,x){return s+Number(x.qty_out||0)},0);
      $('crm1InvKpis').innerHTML='<div class="stat"><span>Products</span><b>'+active.length+'</b></div><div class="stat"><span>Total Stock</span><b>'+Number(total).toLocaleString('en-IN')+'</b></div><div class="stat"><span>Stock In</span><b>'+Number(qin).toLocaleString('en-IN')+'</b></div><div class="stat"><span>Stock Out</span><b>'+Number(qout).toLocaleString('en-IN')+'</b></div><div class="stat"><span>Low Stock</span><b>'+low.length+'</b></div>';
      $('crm1InvStockBody').innerHTML=active.map(function(x){var q=Number(stock[x.id]||0),lvl=Number(x.low_stock_level||10),a=q<=lvl?'<span class="pill" style="background:#fdecec;color:#a33">Low Stock</span>':'<span class="pill">OK</span>';return '<tr><td><b>'+esc(x.product_name)+'</b></td><td>'+q+'</td><td>'+lvl+'</td><td>'+a+'</td><td>'+money(x.price)+'</td></tr>'}).join('')||'<tr><td colspan="5" class="empty">No products</td></tr>';
      $('crm1InvMoveBody').innerHTML=range.map(function(x){var q=Number(x.qty_in||0)-Number(x.qty_out||0),type=Number(x.qty_in||0)>0?'Stock In':'Stock Out';return '<tr><td>'+esc(new Date(x.created_at).toLocaleString('en-IN'))+'</td><td>'+esc(x.products&&x.products.product_name||'-')+'</td><td>'+type+'</td><td>'+Math.abs(q)+'</td><td>'+esc(x.reference||'-')+'</td><td>'+esc(x.note||'-')+'</td></tr>'}).join('')||'<tr><td colspan="6" class="empty">No movements for selected period</td></tr>';
      msg.textContent='Report: '+from+' to '+to;
    }catch(e){msg.textContent='Report error: '+(e.message||e)}
  }
  function build(){
    var p=page(),c=content();if(!p||!c||!p.classList.contains('active'))return;
    c.innerHTML='<div id="crm1InventoryDetailedRoot"><div class="panel"><div class="crm1-toolbar" style="display:flex;gap:10px;align-items:center;flex-wrap:wrap"><label>From <input type="date" id="crm1InvFrom"></label><label>To <input type="date" id="crm1InvTo"></label><button class="btn" id="crm1InvApply">Apply</button><button class="btn alt" id="crm1InvToday">Today</button><select id="crm1InvProduct"><option value="">All Products</option></select><select id="crm1InvMovement"><option value="">All Movements</option><option value="in">Stock In</option><option value="out">Stock Out</option></select><button class="btn alt" id="crm1InvRefresh">Refresh</button></div><div class="crm1-muted" id="crm1InvMsg"></div></div><div class="cards" id="crm1InvKpis"></div><div class="panel"><h3>Current Stock</h3><div class="tablewrap"><table><thead><tr><th>Product</th><th>Current Stock</th><th>Low Stock Level</th><th>Alert</th><th>Price</th></tr></thead><tbody id="crm1InvStockBody"></tbody></table></div></div><div class="panel"><h3>Stock Movement</h3><div class="crm1-toolbar" style="display:flex;gap:10px;align-items:center;flex-wrap:wrap"><select id="crm1InvMoveProduct"><option value="">Select Product</option></select><input id="crm1InvMoveQty" type="number" min="0.01" step="0.01" placeholder="Qty"><select id="crm1InvMoveType"><option value="in">Stock In</option><option value="out">Stock Out</option></select><input id="crm1InvMoveRef" placeholder="Reference"><input id="crm1InvMoveNote" placeholder="Note"><button class="btn" id="crm1InvSaveMove">Save Movement</button></div></div><div class="panel"><h3>Movement History</h3><div class="tablewrap"><table><thead><tr><th>Date / Time</th><th>Product</th><th>Type</th><th>Qty</th><th>Reference</th><th>Note</th></tr></thead><tbody id="crm1InvMoveBody"></tbody></table></div></div></div>';
    var t=istDate();$('crm1InvFrom').value=t;$('crm1InvTo').value=t;
    $('crm1InvApply').onclick=load;$('crm1InvRefresh').onclick=load;$('crm1InvProduct').onchange=load;$('crm1InvMovement').onchange=load;$('crm1InvToday').onclick=function(){$('crm1InvFrom').value=istDate();$('crm1InvTo').value=istDate();load()};
    loadProducts().then(load).catch(function(e){$('crm1InvMsg').textContent='Product load error: '+(e.message||e)});
  }
  function init(){if(started)return;started=true;document.addEventListener('click',function(e){var b=e.target.closest&&e.target.closest('#nav button');if(b&&/inventory/i.test(String(b.textContent||'')))setTimeout(function(){if(page()&&page().classList.contains('active')&&!$('crm1InventoryDetailedRoot'))build()},100)},true);var t=setInterval(function(){if(page()&&page().classList.contains('active')&&!$('crm1InventoryDetailedRoot')){build();clearInterval(t)}},250);setTimeout(function(){clearInterval(t)},30000)}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();