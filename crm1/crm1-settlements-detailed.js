/* CRM1 Settlements v6: isolated page owner, no legacy renderer hand-off. */
(function(){
  'use strict';
  var started=false, loading=false;
  var $=function(id){return document.getElementById(id)};
  function esc(v){return String(v==null?'':v).replace(/[&<>\"']/g,function(m){return{'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',"'":'&#039;'}[m]})}
  function money(v){return '₹'+Number(v||0).toLocaleString('en-IN')}
  function iso(d){return new Date(d).toISOString().slice(0,10)}
  function today(){return iso(new Date())}
  function nextDay(v){var d=new Date(v+'T00:00:00');d.setDate(d.getDate()+1);return iso(d)}
  function page(){return $('crm1SettStandalonePage')}
  function root(){return $('crm1SettStandaloneRoot')}

  function ensurePage(){
    if(page())return true;
    var main=document.querySelector('.main');
    if(!main)return false;
    var p=document.createElement('section');
    p.id='crm1SettStandalonePage';
    p.className='page';
    p.innerHTML='<div class="title"><div><h2>💰 Settlements</h2><div class="sub">COD, commission and partner settlement tracking</div></div></div><div id="crm1SettStandaloneRoot"></div>';
    main.appendChild(p);
    return true;
  }

  function buildUI(){
    if(!ensurePage())return false;
    var r=root();
    if(!r)return false;
    r.innerHTML='<div class="panel"><div class="crm1-toolbar" style="display:flex;gap:10px;align-items:center;flex-wrap:wrap">'+
      '<label>From <input id="crm1SetFrom" type="date"></label>'+ 
      '<label>To <input id="crm1SetTo" type="date"></label>'+ 
      '<button class="btn" id="crm1SetApply">Apply</button><button class="btn alt" id="crm1SetToday">Today</button>'+ 
      '<span class="crm1-muted" id="crm1SetMsg"></span></div></div>'+ 
      '<div class="cards" id="crm1SetKpis"></div>'+ 
      '<div class="panel"><div class="tablewrap"><table><thead><tr><th>Rank</th><th>Partner</th><th>Type</th><th>Delivered</th><th>RTO</th><th>COD</th><th>Commission</th><th>Forward Freight</th><th>RTO Charges</th><th>Other</th><th>Net Settlement</th><th>Status</th><th>Period</th></tr></thead><tbody id="crm1SetBody"></tbody></table></div></div>'+ 
      '<div class="panel"><h3>Generate Settlement</h3><div class="crm1-toolbar" style="display:flex;gap:10px;align-items:center;flex-wrap:wrap">'+
      '<input id="crm1SetGenFrom" type="date"><input id="crm1SetGenTo" type="date"><select id="crm1SetPartner"><option value="">Select Partner</option></select>'+ 
      '<input id="crm1SetCommission" type="number" min="0" step="0.01" placeholder="Dealer commission / delivered order">'+
      '<input id="crm1SetForward" type="number" min="0" step="0.01" placeholder="Courier forward freight">'+
      '<input id="crm1SetRto" type="number" min="0" step="0.01" placeholder="Courier RTO charges">'+
      '<input id="crm1SetOther" type="number" step="0.01" placeholder="Other charges">'+
      '<input id="crm1SetCod" type="number" min="0" step="0.01" placeholder="COD remitted (optional)">'+
      '<input id="crm1SetAdj" type="number" step="0.01" placeholder="Adjustment (+/-)">'+
      '<button class="btn" id="crm1SetGenerate">Generate</button></div>'+ 
      '<div id="crm1SetHelp" class="crm1-muted" style="margin-top:8px">Dealer: Commission = Delivered × rate. Courier: no commission; use actual courier invoice/ledger freight, RTO and other charges. COD remitted defaults to delivered COD.</div></div>';
    var t=today();$('crm1SetFrom').value=t;$('crm1SetTo').value=t;$('crm1SetGenFrom').value=t;$('crm1SetGenTo').value=t;
    $('crm1SetApply').onclick=load;$('crm1SetToday').onclick=function(){$('crm1SetFrom').value=today();$('crm1SetTo').value=today();load()};
    $('crm1SetGenerate').onclick=generate;$('crm1SetPartner').onchange=updatePartnerFields;
    loadPartners();load();
    return true;
  }

  async function loadPartners(){
    var sel=$('crm1SetPartner');if(!sel||!window.sb)return;
    try{
      var r1=await window.sb.from('dealers').select('id,dealer_name').eq('is_active',true).order('dealer_name');
      var r2=await window.sb.from('profiles').select('id,full_name,role').eq('is_active',true).eq('role','courier_manager').order('full_name');
      if(r1.error)throw r1.error;if(r2.error)throw r2.error;
      var html='<option value="">Select Partner</option>';
      html+=(r1.data||[]).map(function(x){return '<option value="'+esc(x.id)+'" data-type="dealer">'+esc(x.dealer_name)+' (Dealer)</option>'}).join('');
      html+=(r2.data||[]).map(function(x){return '<option value="'+esc(x.id)+'" data-type="courier">'+esc(x.full_name)+' (Courier)</option>'}).join('');
      sel.innerHTML=html;updatePartnerFields();
    }catch(e){sel.innerHTML='<option value="">Unable to load partners</option>'}
  }

  function updatePartnerFields(){
    var sel=$('crm1SetPartner');if(!sel)return;
    var opt=sel.options[sel.selectedIndex],type=opt&&opt.dataset?opt.dataset.type:'';
    $('crm1SetCommission').style.display=type==='dealer'?'inline-block':'none';
    $('crm1SetForward').style.display=type==='courier'?'inline-block':'none';
    $('crm1SetRto').style.display=type==='courier'?'inline-block':'none';
    $('crm1SetOther').style.display=type==='courier'?'inline-block':'none';
    $('crm1SetCod').style.display=type==='courier'?'inline-block':'none';
    $('crm1SetAdj').style.display='inline-block';
    $('crm1SetHelp').textContent=type==='courier'?'Courier: commission is 0. Enter actual forward freight, RTO charges and other invoice/ledger charges. COD remitted can be entered manually; otherwise delivered COD is used.':'Dealer: Commission = Delivered × rate. If delivered = 0, commission = ₹0. Courier freight/RTO fields are not used for dealers.';
  }

  async function load(){
    if(loading)return;
    var p=page();if(!p||!p.classList.contains('active')||!window.sb)return;
    var from=$('crm1SetFrom').value||today(),to=$('crm1SetTo').value||from;
    if(to<from){var z=from;from=to;to=z;$('crm1SetFrom').value=from;$('crm1SetTo').value=to}
    var body=$('crm1SetBody'),msg=$('crm1SetMsg');if(!body||!msg)return;
    loading=true;msg.textContent='Loading...';body.innerHTML='<tr><td colspan="13" class="empty">Loading...</td></tr>';
    try{
      var end=nextDay(to);
      var r=await window.sb.from('partner_settlements').select('id,partner_id,period_from,period_to,delivered_orders,cod_amount,commission_amount,net_payable,status,partner_type,commission_rate,forward_freight,rto_orders,rto_charges,other_charges,cod_remitted,adjustment_amount,created_at,profiles:partner_id(full_name,role)').gte('period_to',from).lt('period_from',end);
      if(r.error)throw r.error;
      if(!page()||!page().classList.contains('active'))return;
      var rows=r.data||[];
      var delivered=rows.reduce(function(s,x){return s+Number(x.delivered_orders||0)},0);
      var rto=rows.reduce(function(s,x){return s+Number(x.rto_orders||0)},0);
      var cod=rows.reduce(function(s,x){return s+Number(x.cod_amount||0)},0);
      var commission=rows.reduce(function(s,x){return s+Number(x.commission_amount||0)},0);
      var freight=rows.reduce(function(s,x){return s+Number(x.forward_freight||0)},0);
      var rtoCharges=rows.reduce(function(s,x){return s+Number(x.rto_charges||0)},0);
      var other=rows.reduce(function(s,x){return s+Number(x.other_charges||0)},0);
      var net=rows.reduce(function(s,x){return s+Number(x.net_payable||0)},0);
      $('crm1SetKpis').innerHTML='<div class="stat"><span>Settlements</span><b>'+rows.length+'</b></div><div class="stat"><span>Delivered</span><b>'+delivered+'</b></div><div class="stat"><span>RTO</span><b>'+rto+'</b></div><div class="stat"><span>COD</span><b>'+money(cod)+'</b></div><div class="stat"><span>Commission</span><b>'+money(commission)+'</b></div><div class="stat"><span>Courier Charges</span><b>'+money(freight+rtoCharges+other)+'</b></div><div class="stat"><span>Net Settlement</span><b>'+money(net)+'</b></div>';
      rows.sort(function(a,b){return Number(b.net_payable||0)-Number(a.net_payable||0)});
      $('crm1SetBody').innerHTML=rows.map(function(x,i){return '<tr><td><b>'+(i+1)+'</b></td><td><b>'+esc(x.profiles&&x.profiles.full_name||x.partner_id||'-')+'</b></td><td>'+esc(x.partner_type||'-')+'</td><td>'+Number(x.delivered_orders||0)+'</td><td>'+Number(x.rto_orders||0)+'</td><td>'+money(x.cod_amount)+'</td><td>'+money(x.commission_amount)+'</td><td>'+money(x.forward_freight)+'</td><td>'+money(x.rto_charges)+'</td><td>'+money(x.other_charges)+'</td><td><b>'+money(x.net_payable)+'</b></td><td><span class="pill">'+esc(x.status||'-')+'</span></td><td>'+esc(x.period_from)+' to '+esc(x.period_to)+'</td></tr>'}).join('')||'<tr><td colspan="13" class="empty">No settlements for selected period</td></tr>';
      msg.textContent='Report: '+from+' to '+to;
    }catch(e){if(page()&&page().classList.contains('active')){msg.textContent='Report error: '+(e.message||e);body.innerHTML=''}}
    finally{loading=false}
  }

  async function generate(){
    var partner=$('crm1SetPartner')&&$('crm1SetPartner').value,from=$('crm1SetGenFrom')&&$('crm1SetGenFrom').value,to=$('crm1SetGenTo')&&$('crm1SetGenTo').value;
    var commission=Number($('crm1SetCommission')&&$('crm1SetCommission').value||0),forward=Number($('crm1SetForward')&&$('crm1SetForward').value||0),rto=Number($('crm1SetRto')&&$('crm1SetRto').value||0),other=Number($('crm1SetOther')&&$('crm1SetOther').value||0),cod=((($('crm1SetCod')&&$('crm1SetCod').value)||'').trim()==='')?null:Number($('crm1SetCod').value),adj=Number($('crm1SetAdj')&&$('crm1SetAdj').value||0);
    if(!partner||!from||!to)return alert('Partner, From date and To date required');
    if(to<from)return alert('To date cannot be before From date');
    var opt=$('crm1SetPartner').options[$('crm1SetPartner').selectedIndex],type=opt&&opt.dataset?opt.dataset.type:'';
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
    var btn=[].slice.call(document.querySelectorAll('#nav button')).find(function(x){return /settlements/i.test(String(x.textContent||''))});
    if(btn)btn.classList.add('active');
    var p=page();p.classList.add('active');window.scrollTo({top:0,left:0,behavior:'instant'});
    if(!root().children.length)buildUI();else load();
  }

  function bindNav(){
    document.addEventListener('click',function(e){
      var btn=e.target.closest&&e.target.closest('#nav button');
      if(!btn||!/settlements/i.test(String(btn.textContent||'')))return;
      e.preventDefault();e.stopImmediatePropagation();
      openStandalone();
    },true);
  }

  function hideLegacy(){
    var legacy=$('settlements');if(!legacy)return;
    legacy.style.display='none';legacy.dataset.crm1LegacyDisabled='1';
  }

  function init(){
    if(started)return;started=true;ensurePage();hideLegacy();bindNav();
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();