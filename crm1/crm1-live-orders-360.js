/* CRM1 Live Orders + Customer 360
   Finalized dashboard/date renderer.
   Important: this module is the single owner for Dashboard date actions so the
   legacy lexical loadStats/loadDashboardOrders handlers cannot overwrite IST data.
*/
(function(){
  'use strict';
  var URL='https://ielebadardbzmoxantsc.supabase.co';
  var KEY='sb_publishable_0pekrOT6vhYZYQ48wHr7Ag_NPcpobGj';
  var db=null;
  var dashboardBound=false;
  var refreshTimer=null;
  var enhanceQueued=false;
  var esc=function(s){return String(s==null?'':s).replace(/[&<>\"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',"'":'&#39;'}[c]})};
  var pretty=function(p){return ({normal:'Fresh Order',high:'Urgent Order',express:'Express Urgent Order'}[p]||p||'-')};
  function currentProfile(){return window.profile||null}
  function currentUser(){return window.me||null}
  function istDateKey(d){
    var x=d instanceof Date?d:new Date(d||Date.now());
    if(Number.isNaN(x.getTime()))return '';
    return new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Kolkata',year:'numeric',month:'2-digit',day:'2-digit'}).format(x);
  }
  function istToday(){return istDateKey(new Date())}
  function istStartUtc(dateKey){return new Date(String(dateKey)+'T00:00:00+05:30').toISOString()}
  function nextIstDate(dateKey){
    var p=String(dateKey||istToday()).split('-').map(Number);
    return new Date(Date.UTC(p[0],p[1]-1,p[2]+1)).toISOString().slice(0,10);
  }
  function getRange(section){
    var type=document.getElementById(section+'FilterType')?.value||'day';
    var from=document.getElementById(section+'FilterFrom')?.value||istToday();
    var to=document.getElementById(section+'FilterTo')?.value||from;
    if(type==='month'){
      if(!/^\d{4}-\d{2}$/.test(from))from=istToday().slice(0,7);
      if(!/^\d{4}-\d{2}$/.test(to))to=from;
      if(to<from){var m=from;from=to;to=m}
      var a=from.split('-').map(Number),b=to.split('-').map(Number);
      var end=new Date(Date.UTC(b[0],b[1],1)).toISOString().slice(0,10);
      return {from:a[0]+'-'+String(a[1]).padStart(2,'0')+'-01',to:end,label:from===to?from:from+' to '+to};
    }
    if(type==='year'){
      var fy=Number(from)||Number(istToday().slice(0,4)),ty=Number(to)||fy;
      if(ty<fy){var y=fy;fy=ty;ty=y}
      return {from:String(fy)+'-01-01',to:String(ty+1)+'-01-01',label:fy===ty?String(fy):fy+' to '+ty};
    }
    if(to<from){var d=from;from=to;to=d}
    return {from:from,to:nextIstDate(to),label:from===to?from:from+' to '+to};
  }
  function roleQuery(q){
    var p=currentProfile(),u=currentUser();
    if(p?.role==='agent'&&u?.id)q=q.eq('agent_id',u.id);
    if(p?.role==='courier_manager'&&u?.id)q=q.eq('courier_manager_id',u.id);
    return q;
  }
  async function dealerIdForCurrentUser(){
    var u=currentUser();
    if(!u?.id)return null;
    var r=await db.from('dealers').select('id').eq('user_id',u.id).maybeSingle();
    return r.data?.id||null;
  }
  async function fetchDashboardOrders(){
    var range=getRange('dash');
    var q=db.from('orders').select('id,order_no,order_status,total_amount,order_date,customer_id,agent_id,dealer_id,courier_manager_id,customers(customer_name,mobile),profiles!orders_agent_id_fkey(full_name),dealers(dealer_name),order_items(quantity,unit_price,products(product_name))')
      .or('remarks.is.null,remarks.not.ilike.%[ENQUIRY]%')
      .gte('order_date',istStartUtc(range.from)).lt('order_date',istStartUtc(range.to))
      .order('order_date',{ascending:false}).limit(500);
    var p=currentProfile();
    q=roleQuery(q);
    if(p?.role==='dealer'){
      var did=await dealerIdForCurrentUser();
      q=did?q.eq('dealer_id',did):q.eq('dealer_id','00000000-0000-0000-0000-000000000000');
    }
    var r=await q;
    if(r.error)throw r.error;
    return {rows:r.data||[],range:range};
  }
  function productText(o){
    var items=Array.isArray(o.order_items)?o.order_items:[];
    if(!items.length)return '-';
    return items.map(function(i){return esc(i.products?.product_name||i.products?.name||'Product')+' × '+Number(i.quantity||0)}).join('<br>');
  }
  function renderDashboard(result){
    var rows=result.rows,range=result.range;
    var count=function(){var ss=[].slice.call(arguments);return rows.filter(function(o){return ss.indexOf(String(o.order_status||'').toLowerCase())>=0}).length};
    var stats={sOrders:rows.length,sPending:count('new','pending','confirmed','dealer_pending','assigned','hold'),sTransit:count('in_transit'),sDelivered:count('delivered'),sCancelled:count('cancelled')};
    Object.keys(stats).forEach(function(id){var el=document.getElementById(id);if(el)el.textContent=stats[id]});
    var label=document.getElementById('sOrdersLabel');
    if(label)label.textContent=(range.label===istToday()?'आज के Orders':'Orders ('+range.label+')');
    var body=document.getElementById('dashboardOrdersBody');
    if(body){
      body.innerHTML=rows.map(function(o){return '<tr><td>#'+esc(o.order_no)+'</td><td>'+esc(o.customers?.customer_name||'-')+'</td><td>'+esc(o.customers?.mobile||'-')+'</td><td>'+productText(o)+'</td><td>'+esc(o.profiles?.full_name||'-')+'</td><td>'+esc(o.dealers?.dealer_name||'-')+'</td><td><span class="pill">'+esc(o.order_status||'-')+'</span></td><td>₹'+Number(o.total_amount||0).toLocaleString('en-IN')+'</td></tr>'}).join('')||'<tr><td colspan="8" class="empty">No orders</td></tr>';
    }
    if(typeof window.crmRefreshEnhancements==='function')setTimeout(window.crmRefreshEnhancements,0);
  }
  async function refreshDashboardIST(){
    if(!db)return;
    try{renderDashboard(await fetchDashboardOrders())}catch(e){console.warn('CRM1 dashboard IST refresh:',e)}
  }
  window.crm1RefreshDashboardIST=refreshDashboardIST;
  function preventLegacyHandler(e){
    e.preventDefault();
    e.stopImmediatePropagation();
    var type=e.currentTarget?.id?.includes('FilterToday')?'today':e.currentTarget?.id||'';
    if(type==='today'){
      var t=istToday();
      var from=document.getElementById('dashFilterFrom'),to=document.getElementById('dashFilterTo'),ft=document.getElementById('dashFilterType');
      if(ft)ft.value='day';if(from)from.value=t;if(to)to.value=t;
    }
    clearTimeout(refreshTimer);
    refreshTimer=setTimeout(refreshDashboardIST,0);
  }
  function bindDashboardCapture(){
    var type=document.getElementById('dashFilterType'),from=document.getElementById('dashFilterFrom'),to=document.getElementById('dashFilterTo'),today=document.getElementById('dashFilterToday');
    if(type&&!type.dataset.crm360IstCapture){type.dataset.crm360IstCapture='1';type.addEventListener('change',preventLegacyHandler,true)}
    if(from&&!from.dataset.crm360IstCapture){from.dataset.crm360IstCapture='1';from.addEventListener('change',preventLegacyHandler,true)}
    if(to&&!to.dataset.crm360IstCapture){to.dataset.crm360IstCapture='1';to.addEventListener('change',preventLegacyHandler,true)}
    if(today&&!today.dataset.crm360IstCapture){today.dataset.crm360IstCapture='1';today.addEventListener('click',preventLegacyHandler,true)}
    var t=istToday();
    if(from&&to&&type){if(!from.value)from.value=t;if(!to.value)to.value=from.value;}
  }
  function scheduleDashboard(){
    bindDashboardCapture();
    [100,500,1200,2500].forEach(function(ms){setTimeout(function(){bindDashboardCapture();refreshDashboardIST()},ms)});
  }
  function initDashboardObserver(){
    if(document.body.dataset.crm360DashObserver)return;
    document.body.dataset.crm360DashObserver='1';
    var obs=new MutationObserver(function(){bindDashboardCapture()});
    obs.observe(document.body,{childList:true,subtree:true});
  }

  /* Customer 360 enhancement */
  async function init(){
    for(var i=0;i<60&&!window.supabase?.createClient;i++)await new Promise(function(r){setTimeout(r,200)});
    if(!window.supabase?.createClient)return;
    db=window.supabase.createClient(URL,KEY);
    bindDashboardCapture();
    initDashboardObserver();
    scheduleDashboard();
    window.addEventListener('crm1DataChanged',function(e){if(e.detail?.type==='order_created'||e.detail?.type==='order_status_updated')refreshDashboardIST()});
    window.addEventListener('crm1PriorityOrderCreated',refreshDashboardIST);

    var hook=function(){
      var orig=window.customer360;
      if(typeof orig!=='function'||orig.__crmLive360Wrapped)return false;
      var wrapped=async function(){var args=arguments,result=await orig.apply(this,args);scheduleEnhance();return result};
      wrapped.__crmLive360Wrapped=true;window.customer360=wrapped;return true;
    };
    if(!hook()){
      var tries=0,tm=setInterval(function(){tries++;if(hook()||tries>=120)clearInterval(tm)},250);
    }
    var watch=function(){
      var out=document.getElementById('crm360Result');
      if(!out)return false;
      if(!out.__crm360Obs){var observer=new MutationObserver(function(){scheduleEnhance()});observer.observe(out,{childList:true,subtree:true});out.__crm360Obs=observer}
      scheduleEnhance();return true;
    };
    if(!watch()){
      var t=0,x=setInterval(function(){t++;if(watch()||t>=120)clearInterval(x)},250);
    }
  }
  function scheduleEnhance(){
    if(enhanceQueued)return;enhanceQueued=true;
    setTimeout(async function(){enhanceQueued=false;try{await enhance360()}catch(e){console.warn('CRM1 Customer360 enhancement:',e)}},80);
  }
  function headers(table){return Array.from(table.querySelectorAll('thead th')).map(function(x){return String(x.dataset.crm360Title||x.textContent||'').trim().toLowerCase()})}
  function dataRows(table){return Array.from(table.querySelectorAll('tbody tr')).filter(function(r){return r.cells.length>1})}
  async function enhanceOrderType(table){
    if(!table)return false;var h=headers(table);if(!h.includes('order')||h.includes('order type'))return true;
    var th=document.createElement('th');th.textContent='Order Type';table.querySelector('thead tr').appendChild(th);
    var rows=dataRows(table);
    await Promise.all(rows.map(async function(tr){
      var no=(tr.cells[0]?.textContent||'').replace(/\D/g,'');var td=document.createElement('td');
      if(no&&db){try{var r=await db.from('orders').select('order_priority,order_type').eq('order_no',Number(no)).maybeSingle();var o=r.data||{};td.innerHTML='<span class="pill">'+esc(pretty(o.order_priority)||pretty(o.order_type))+'</span>'}catch(e){td.textContent='-'}}else td.textContent='-';
      tr.appendChild(td);
    }));
    return true;
  }
  function setupTableControls(table){
    if(!table||table.dataset.crm360Controls)return false;var rows=dataRows(table),ths=Array.from(table.querySelectorAll('thead th'));if(!rows.length||!ths.length)return false;table.dataset.crm360Controls='1';
    var panel=table.closest('.panel')||table.parentElement, page=1,sortIndex=-1,sortDir=1,filters=Array(ths.length).fill('');
    var wrap=document.createElement('div');wrap.className='crm-table-toolbar';wrap.innerHTML='<label>Show <select><option value="10">10</option><option value="25">25</option><option value="50">50</option></select> per page</label><span class="crm-table-summary"></span><button type="button" class="crm-clear-filters">Clear Filters</button><div class="crm-pages"></div>';panel.insertBefore(wrap,table.parentElement);
    var sel=wrap.querySelector('select'),sum=wrap.querySelector('.crm-table-summary'),clear=wrap.querySelector('.crm-clear-filters'),pages=wrap.querySelector('.crm-pages');
    ths.forEach(function(th,i){var title=(th.dataset.crm360Title||th.textContent||'').replace(/[↕↑↓]\s*$/,'').trim();th.dataset.crm360Title=title;th.style.cursor='pointer';var label=document.createElement('span');label.className='crm-sort-label';label.textContent=title+' ↕';th.textContent='';th.appendChild(label);var input=document.createElement('input');input.type='text';input.className='crm-col-filter';input.placeholder='Filter';input.autocomplete='off';input.addEventListener('click',function(e){e.stopPropagation()});input.addEventListener('input',function(){filters[i]=input.value.toLowerCase().trim();page=1;render()});th.appendChild(input);label.addEventListener('click',function(){if(sortIndex===i)sortDir*=-1;else{sortIndex=i;sortDir=1}ths.forEach(function(x,j){var l=x.querySelector('.crm-sort-label');if(l)l.textContent=(x.dataset.crm360Title||'')+(j===sortIndex?(sortDir===1?' ↑':' ↓'):' ↕')});render()})});
    function filtered(){var out=rows.filter(function(r){return filters.every(function(v,i){return !v||String(r.cells[i]?.textContent||'').toLowerCase().includes(v)})});if(sortIndex>=0)out.sort(function(a,b){var av=(a.cells[sortIndex]?.textContent||'').trim(),bv=(b.cells[sortIndex]?.textContent||'').trim();return av.localeCompare(bv,undefined,{numeric:true,sensitivity:'base'})*sortDir});return out}
    function render(){var out=filtered(),n=Number(sel.value),total=Math.max(1,Math.ceil(out.length/n));if(page>total)page=total;rows.forEach(function(r){r.style.display='none'});out.slice((page-1)*n,page*n).forEach(function(r){r.style.display=''});sum.textContent=out.length?('Showing '+((page-1)*n+1)+'–'+Math.min(page*n,out.length)+' of '+out.length+' records'):'0 records';pages.innerHTML='';function add(t,p,d,a){var b=document.createElement('button');b.type='button';b.textContent=t;b.disabled=d;b.className=a?'active':'';b.onclick=function(){page=p;render()};pages.appendChild(b)}add('‹',Math.max(1,page-1),page===1,false);for(var i=1;i<=total;i++)add(String(i),i,false,i===page);add('›',Math.min(total,page+1),page===total,false)}
    sel.addEventListener('change',function(){page=1;render()});clear.addEventListener('click',function(){filters.fill('');sortIndex=-1;sortDir=1;page=1;ths.forEach(function(th){var input=th.querySelector('.crm-col-filter');if(input)input.value='';var l=th.querySelector('.crm-sort-label');if(l)l.textContent=(th.dataset.crm360Title||'')+' ↕'});render()});render();return true;
  }
  async function enhance360(){var out=document.getElementById('crm360Result');if(!out)return;var tables=Array.from(out.querySelectorAll('table'));if(!tables.length)return;var order=tables.find(function(t){return headers(t).includes('order')});var interaction=tables.find(function(t){var h=headers(t);return !h.includes('order')&&h.some(function(x){return /interaction|direction|status|type/i.test(x)})});if(order){await enhanceOrderType(order);setupTableControls(order)}if(interaction)setupTableControls(interaction)}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
