/* CRM1 Settlements v8
   IST-safe dates + delivered-order pending settlement view.
   A delivered order is not silently converted into a financial settlement;
   Generate remains an explicit action, while eligible delivered orders stay visible.
*/
(function(){
  'use strict';
  var started=false,loading=false;
  var $=function(id){return document.getElementById(id)};
  var esc=function(v){return String(v==null?'':v).replace(/[&<>\"']/g,function(m){return{'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',"'":'&#039;'}[m]})};
  var money=function(v){return '₹'+Number(v||0).toLocaleString('en-IN')};
  function istDateKey(d){
    var x=d instanceof Date?d:new Date(d||Date.now());
    if(Number.isNaN(x.getTime()))return '';
    return new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Kolkata',year:'numeric',month:'2-digit',day:'2-digit'}).format(x);
  }
  function today(){return istDateKey(new Date())}
  function istUtcStart(dateKey){return new Date(String(dateKey)+'T00:00:00+05:30').toISOString()}
  function nextDay(dateKey){var p=String(dateKey).split('-').map(Number);return new Date(Date.UTC(p[0],p[1]-1,p[2]+1)).toISOString().slice(0,10)}
  function page(){return $('crm1SettStandalonePage')}
  function root(){return $('crm1SettStandaloneRoot')}
  function currentProfile(){return window.profile||null}
  function currentUser(){return window.me||null}
  async function currentDealerId(){var u=currentUser();if(!u?.id||!window.sb)return null;var r=await window.sb.from('dealers').select('id').eq('user_id',u.id).maybeSingle();return r.data?.id||null}
  function ensurePage(){
    if(page())return true;
    var main=document.querySelector('.main');if(!main)return false;
    var p=document.createElement('section');p.id='crm1SettStandalonePage';p.className='page';
    p.innerHTML='<div class="title"><div><h2>💰 Settlements</h2><div class="sub">COD, commission and partner settlement tracking</div></div></div><div id="crm1SettStandaloneRoot"></div>';
    main.appendChild(p);return true;
  }
  function buildUI(){
    if(!ensurePage())return false;
    var r=root();if(!r)return false;
    r.innerHTML='<div class="panel"><div class="crm1-toolbar" style="display:flex;gap:10px;align-items:center;flex-wrap:wrap"><label>From <input id="crm1SetFrom" type="date"></label><label>To <input id="crm1SetTo" type="date"></label><button class="btn" id="crm1SetApply">Apply</button><button class="btn alt" id="crm1SetToday">Today</button><span class="crm1-muted" id="crm1SetMsg"></span></div></div>'+\
      '<div class="cards" id="crm1SetKpis"></div>'+\
      '<div class="panel"><h3>Delivered Orders — Pending Settlement</h3><div class="crm1-muted" style="margin-bottom:10px">Delivered orders are shown here until a settlement record is generated. This does not create a settlement automatically.</div><div class="tablewrap"><table><thead><tr><th>Order</th><th>Customer</th><th>Partner</th><th>Amount</th><th>Delivered</th><th>Settlement</th></tr></thead><tbody id="crm1DeliveredBody"></tbody></table></div></div>'+\
      '<div class="panel"><div class="tablewrap"><table><thead><tr><th>Rank</th><th>Partner</th><th>Type</th><th>Delivered</th><th>RTO</th><th>COD</th><th>Commission</th><th>Forward Freight</th><th>RTO Charges</th><th>Other</th><th>Net Settlement</th><th>Status</th><th>Period</th></tr></thead><tbody id="crm1SetBody"></tbody></table></div></div>'+\
      '<div class="panel"><h3>Generate Settlement</h3><div class="crm1-toolbar" style="display:flex;gap:10px;align-items:center;flex-wrap:wrap"><input id="crm1SetGenFrom" type="date"><input id="crm1SetGenTo" type="date"><select id="crm1SetPartner"><option value="">Select Partner</option></select><input id="crm1SetCommission" type="number" min="0" step="0.01" placeholder="Dealer commission / delivered order"><input id="crm1SetForward" type="number" min="0" step="0.01" placeholder="Courier forward freight"><input id="crm1SetRto" type="number" min="0" step="0.01" placeholder="Courier RTO charges"><input id="crm1SetOther" type="number" step="0.01" placeholder="Other charges"><input id="crm1SetCod" type="number" min="0" step="0.01" placeholder="COD remitted (optional)"><input id="crm1SetAdj" type="number" step="0.01" placeholder="Adjustment (+/-)"><button class="btn" id="crm1SetGenerate">Generate</button></div><div id="crm1SetHelp" class="crm1-muted" style="margin-top:8px">Dealer: Commission = Delivered × rate. Courier: no commission; enter actual freight/RTO/other charges.</div></div>';
    var t=today();$('crm1SetFrom').value=t;$('crm1SetTo').value=t;$('crm1SetGenFrom').value=t;$('crm1SetGenTo').value=t;
    $('crm1SetApply').onclick=load;$('crm1SetToday').onclick=function(){var n=today();$('crm1SetFrom').value=n;$('crm1SetTo').value=n;$('crm1SetGenFrom').value=n;$('crm1SetGenTo').value=n;load()};
    $('crm1SetGenerate').onclick=generate;$('crm1SetPartner').onchange=updatePartnerFields;
    loadPartners().then(load);
    return true;
  }
  async function loadPartners(){
    var sel=$('crm1SetPartner');if(!sel||!window.sb)return;
    try{
      var r1=await window.sb.from('dealers').select('id,dealer_name,user_id').eq('is_active',true).order('dealer_name');
      var r2=await window.sb.from('profiles').select('id,full_name,role').eq('is_active',true).eq('role','courier_manager').order('full_name');
      if(r1.error)throw r1.error;if(r2.error)throw r2.error;
      var html='<option value="">Select Partner</option>';
      html+=(r1.data||[]).map(function(x){return '<option value="'+esc(x.id)+'" data-type="dealer">'+esc(x.dealer_name)+' (Dealer)</option>'}).join('');
      html+=(r2.data||[]).map(function(x){return '<option value="'+esc(x.id)+'" data-type="courier">'+esc(x.full_name)+' (Courier)</option>'}).join('');
      sel.innerHTML=html;
      var p=currentProfile();
      if(p?.role==='dealer'){
        var did=await currentDealerId();if(did){var opt=Array.from(sel.options).find(function(o){return o.value===did});if(opt)sel.value=did;}
      }
      updatePartnerFields();
    }catch(e){sel.innerHTML='<option value="">Unable to load partners</option>'}
  }
  function updatePartnerFields(){
    var sel=$('crm1SetPartner');if(!sel)return;var opt=sel.options[sel.selectedIndex],type=opt?.dataset?.type||'';
    $('crm1SetCommission').style.display=type==='dealer'?'inline-block':'none';
    $('crm1SetForward').style.display=type==='courier'?'inline-block':'none';
    $('crm1SetRto').style.display=type==='courier'?'inline-block':'none';
    $('crm1SetOther').style.display=type==='courier'?'inline-block':'none';
    $('crm1SetCod').style.display=type==='courier'?'inline-block':'none';
    $('crm1SetAdj').style.display='inline-block';
    $('crm1SetHelp').textContent=type==='courier'?'Courier: commission is 0. Enter actual forward freight, RTO charges and other invoice/ledger charges.':'Dealer: Commission = Delivered × rate. Courier freight/RTO fields are not used for dealers.';
  }
  function selectedPartner(){var sel=$('crm1SetPartner');return sel?.value||''}
  async function load(){
    if(loading)return;var p=page();if(!p||!p.classList.contains('active')||!window.sb)return;
    var from=$('crm1SetFrom').value||today(),to=$('crm1SetTo').value||from;if(to<from){var z=from;from=to;to=z;$('crm1SetFrom').value=from;$('crm1SetTo').value=to}
    var body=$('crm1SetBody'),delBody=$('crm1DeliveredBody'),msg=$('crm1SetMsg');if(!body||!delBody||!msg)return;
    loading=true;msg.textContent='Loading...';body.innerHTML='<tr><td colspan="13" class="empty">Loading...</td></tr>';delBody.innerHTML='<tr><td colspan="6" class="empty">Loading...</td></tr>';
    try{
      var end=nextDay(to),startUtc=istUtcStart(from),endUtc=istUtcStart(end),partner=selectedPartner();
      var s=await window.sb.from('partner_settlements').select('id,partner_id,period_from,period_to,delivered_orders,cod_amount,commission_amount,net_payable,status,partner_type,commission_rate,forward_freight,rto_orders,rto_charges,other_charges,cod_remitted,adjustment_amount,created_at,profiles:partner_id(full_name,role)').gte('period_to',from).lt('period_from',end);
      if(s.error)throw s.error;
      var rows=s.data||[];
      var q=window.sb.from('orders').select('id,order_no,order_status,total_amount,order_date,delivered_at,customer_id,agent_id,dealer_id,courier_manager_id,customers(customer_name,mobile),dealers(dealer_name),profiles!orders_agent_id_fkey(full_name)').eq('order_status','delivered').or('remarks.is.null,remarks.not.ilike.%[ENQUIRY]%').gte('order_date',startUtc).lt('order_date',endUtc).order('order_date',{ascending:false}).limit(1000);
      var cp=currentProfile(),cu=currentUser();
      if(cp?.role==='dealer'){var did=await currentDealerId();q=did?q.eq('dealer_id',did):q.eq('dealer_id','00000000-0000-0000-0000-000000000000')}
      else if(cp?.role==='courier_manager'&&cu?.id)q=q.eq('courier_manager_id',cu.id);
      var oq=await q;if(oq.error)throw oq.error;
      var delivered=(oq.data||[]).filter(function(o){var d=o.delivered_at||o.order_date;return istDateKey(d)>=from&&istDateKey(d)<=to});
      var relevant=partner?rows.filter(function(x){return x.partner_id===partner}):rows;
      var deliveredCount=delivered.length;
      var rto=relevant.reduce(function(a,x){return a+Number(x.rto_orders||0)},0),cod=relevant.reduce(function(a,x){return a+Number(x.cod_amount||0)},0),commission=relevant.reduce(function(a,x){return a+Number(x.commission_amount||0)},0),freight=relevant.reduce(function(a,x){return a+Number(x.forward_freight||0)},0),rtoCharges=relevant.reduce(function(a,x){return a+Number(x.rto_charges||0)},0),other=relevant.reduce(function(a,x){return a+Number(x.other_charges||0)},0),net=relevant.reduce(function(a,x){return a+Number(x.net_payable||0)},0);
      $('crm1SetKpis').innerHTML='<div class="stat"><span>Settlements</span><b>'+relevant.length+'</b></div><div class="stat"><span>Delivered</span><b>'+deliveredCount+'</b></div><div class="stat"><span>RTO</span><b>'+rto+'</b></div><div class="stat"><span>COD</span><b>'+money(cod)+'</b></div><div class="stat"><span>Commission</span><b>'+money(commission)+'</b></div><div class="stat"><span>Courier Charges</span><b>'+money(freight+rtoCharges+other)+'</b></div><div class="stat"><span>Net Settlement</span><b>'+money(net)+'</b></div>';
      delBody.innerHTML=delivered.map(function(o){
        var matched=relevant.some(function(x){return x.partner_id===(o.dealer_id||o.courier_manager_id)&&x.period_from<=from&&x.period_to>=to});
        var when=o.delivered_at||o.order_date;
        return '<tr><td>#'+esc(o.order_no)+'</td><td>'+esc(o.customers?.customer_name||'-')+'</td><td>'+esc(o.dealers?.dealer_name||'-')+'</td><td>'+money(o.total_amount)+'</td><td>'+esc(istDateKey(when))+'</td><td><span class="pill">'+(matched?'Generated':'Pending')+'</span></td></tr>';
      }).join('')||'<tr><td colspan="6" class="empty">No delivered orders for selected period</td></tr>';
      relevant.sort(function(a,b){return Number(b.net_payable||0)-Number(a.net_payable||0)});
      $('crm1SetBody').innerHTML=relevant.map(function(x,i){return '<tr><td><b>'+(i+1)+'</b></td><td><b>'+esc(x.profiles?.full_name||x.partner_id||'-')+'</b></td><td>'+esc(x.partner_type||'-')+'</td><td>'+Number(x.delivered_orders||0)+'</td><td>'+Number(x.rto_orders||0)+'</td><td>'+money(x.cod_amount)+'</td><td>'+money(x.commission_amount)+'</td><td>'+money(x.forward_freight)+'</td><td>'+money(x.rto_charges)+'</td><td>'+money(x.other_charges)+'</td><td><b>'+money(x.net_payable)+'</b></td><td><span class="pill">'+esc(x.status||'-')+'</span></td><td>'+esc(x.period_from)+' to '+esc(x.period_to)+'</td></tr>'}).join('')||'<tr><td colspan="13" class="empty">No settlements for selected period</td></tr>';
      msg.textContent='Report: '+from+' to '+to;
    }catch(e){msg.textContent='Report error: '+(e.message||e);body.innerHTML='';delBody.innerHTML='<tr><td colspan="6" class="danger">'+esc(e.message||e)+'</td></tr>'}
    finally{loading=false}
  }
  async function generate(){
    var partner=$('crm1SetPartner')?.value,from=$('crm1SetGenFrom')?.value,to=$('crm1SetGenTo')?.value;
    var commission=Number($('crm1SetCommission')?.value||0),forward=Number($('crm1SetForward')?.value||0),rto=Number($('crm1SetRto')?.value||0),other=Number($('crm1SetOther')?.value||0),codText=($('crm1SetCod')?.value||'').trim(),cod=codText===''?null:Number(codText),adj=Number($('crm1SetAdj')?.value||0);
    if(!partner||!from||!to)return alert('Partner, From date and To date required');
    if(to<from)return alert('To date cannot be before From date');
    var opt=$('crm1SetPartner').options[$('crm1SetPartner').selectedIndex],type=opt?.dataset?.type||'';
    if(type==='dealer'&&commission<0)return alert('Dealer commission rate cannot be negative');
    if(type==='courier'&&commission!==0){commission=0;$('crm1SetCommission').value=''}
    if(type==='dealer'&&(forward!==0||rto!==0||other!==0||cod!==null))return alert('Courier charge fields are not used for dealers');
    var r=await window.sb.rpc('generate_partner_settlement',{p_partner:partner,p_from:from,p_to:to,p_commission:commission,p_forward_freight:forward,p_rto_charges:rto,p_other_charges:other,p_cod_remitted:cod,p_adjustment:adj});
    if(r.error)return alert(r.error.message);
    alert('Settlement generated successfully');await load();
  }
  function openStandalone(){
    if(!ensurePage())return;
    document.querySelectorAll('.page').forEach(function(x){x.classList.remove('active')});
    document.querySelectorAll('#nav button').forEach(function(x){x.classList.remove('active')});
    var btn=Array.from(document.querySelectorAll('#nav button')).find(function(x){return /settlements/i.test(String(x.textContent||''))});if(btn)btn.classList.add('active');
    page().classList.add('active');window.scrollTo({top:0,left:0,behavior:'instant'});
    if(!root().children.length)buildUI();else load();
  }
  function bindNav(){document.addEventListener('click',function(e){var btn=e.target.closest&&e.target.closest('#nav button');if(!btn||!/settlements/i.test(String(btn.textContent||'')))return;e.preventDefault();e.stopImmediatePropagation();openStandalone()},true)}
  function hideLegacy(){var legacy=$('settlements');if(legacy){legacy.style.display='none';legacy.dataset.crm1LegacyDisabled='1'}}
  function init(){if(started)return;started=true;ensurePage();hideLegacy();bindNav()}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
