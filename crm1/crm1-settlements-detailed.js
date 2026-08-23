/* CRM1 Settlements detailed reporting layer: date range, partner payout, commission and status. */
(function(){
  'use strict';
  var started=false,guardInstalled=false,guardTimer=null;
  var $=function(id){return document.getElementById(id)};
  function esc(v){return String(v==null?'':v).replace(/[&<>\"']/g,function(m){return{'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',"'":'&#039;'}[m]})}
  function money(v){return '₹'+Number(v||0).toLocaleString('en-IN')}
  function iso(d){return new Date(d).toISOString().slice(0,10)}
  function today(){return iso(new Date())}
  function nextDay(v){var d=new Date(v+'T00:00:00');d.setDate(d.getDate()+1);return iso(d)}
  function page(){return $('settlements')}
  function content(){return $('settlementsContent')}
  function build(){
    var p=page(),c=content();
    if(!p||!c||!p.classList.contains('active'))return false;
    c.innerHTML='<div id="crm1SettDetailedRoot">'+
      '<div class="panel"><div class="crm1-toolbar" style="display:flex;gap:10px;align-items:center;flex-wrap:wrap">'+
      '<label>From <input type="date" id="crm1SetDFrom"></label>'+ 
      '<label>To <input type="date" id="crm1SetDTo"></label>'+ 
      '<button class="btn" id="crm1SetDApply">Apply</button><button class="btn alt" id="crm1SetDToday">Today</button>'+ 
      '<span class="crm1-muted" id="crm1SetDMsg"></span></div></div>'+
      '<div class="cards" id="crm1SetDKpis"></div>'+
      '<div class="panel"><div class="tablewrap"><table><thead><tr><th>Rank</th><th>Partner</th><th>Type</th><th>Delivered</th><th>COD</th><th>Commission</th><th>Net Payable</th><th>Status</th><th>Period</th></tr></thead><tbody id="crm1SetDBody"></tbody></table></div></div>'+
      '<div class="panel"><h3>Generate Settlement</h3><div class="crm1-toolbar" style="display:flex;gap:10px;align-items:center;flex-wrap:wrap">'+
      '<input id="crm1SetDGenFrom" type="date"><input id="crm1SetDGenTo" type="date"><select id="crm1SetDPartner"><option value="">Select Partner</option></select><input id="crm1SetDCommission" type="number" min="0" step="0.01" placeholder="Commission"><button class="btn" id="crm1SetDGenerate">Generate</button></div></div>'+
      '</div>';
    var t=today();$('crm1SetDFrom').value=t;$('crm1SetDTo').value=t;$('crm1SetDGenFrom').value=t;$('crm1SetDGenTo').value=t;
    $('crm1SetDApply').onclick=load;$('crm1SetDToday').onclick=function(){$('crm1SetDFrom').value=today();$('crm1SetDTo').value=today();load()};
    $('crm1SetDGenerate').onclick=generate;
    load();loadPartners();return true;
  }
  async function loadPartners(){
    var sel=$('crm1SetDPartner');if(!sel)return;
    try{
      var r1=await window.sb.from('dealers').select('id,dealer_name').eq('is_active',true).order('dealer_name');
      var r2=await window.sb.from('profiles').select('id,full_name,role').eq('is_active',true).eq('role','courier_manager').order('full_name');
      if(r1.error)throw r1.error;if(r2.error)throw r2.error;
      var html='<option value="">Select Partner</option>';
      html+=(r1.data||[]).map(function(x){return '<option value="'+esc(x.id)+'">'+esc(x.dealer_name)+' (Dealer)</option>'}).join('');
      html+=(r2.data||[]).map(function(x){return '<option value="'+esc(x.id)+'">'+esc(x.full_name)+' (Courier)</option>'}).join('');
      sel.innerHTML=html;
    }catch(e){sel.innerHTML='<option value="">Unable to load partners</option>'}
  }
  async function load(){
    var from=$('crm1SetDFrom')?.value||today(),to=$('crm1SetDTo')?.value||from;
    if(to<from){var z=from;from=to;to=z;$('crm1SetDFrom').value=from;$('crm1SetDTo').value=to}
    var msg=$('crm1SetDMsg');if(!msg)return;msg.textContent='Loading...';
    try{
      var end=nextDay(to);
      var r=await window.sb.from('partner_settlements').select('id,partner_id,period_from,period_to,delivered_orders,cod_amount,commission_amount,net_payable,status,created_at,profiles:partner_id(full_name,role)').gte('period_to',from).lt('period_from',end);
      if(r.error)throw r.error;
      var rows=r.data||[];
      var delivered=rows.reduce(function(s,x){return s+Number(x.delivered_orders||0)},0);
      var cod=rows.reduce(function(s,x){return s+Number(x.cod_amount||0)},0);
      var commission=rows.reduce(function(s,x){return s+Number(x.commission_amount||0)},0);
      var payable=rows.reduce(function(s,x){return s+Number(x.net_payable||0)},0);
      $('crm1SetDKpis').innerHTML='<div class="stat"><span>Settlements</span><b>'+rows.length+'</b></div><div class="stat"><span>Delivered</span><b>'+delivered+'</b></div><div class="stat"><span>COD</span><b>'+money(cod)+'</b></div><div class="stat"><span>Commission</span><b>'+money(commission)+'</b></div><div class="stat"><span>Net Payable</span><b>'+money(payable)+'</b></div>';
      rows.sort(function(a,b){return Number(b.net_payable||0)-Number(a.net_payable||0)});
      $('crm1SetDBody').innerHTML=rows.map(function(x,i){return '<tr><td><b>'+(i+1)+'</b></td><td><b>'+esc(x.profiles?.full_name||x.partner_id||'-')+'</b></td><td>'+esc(x.profiles?.role||'-')+'</td><td>'+Number(x.delivered_orders||0)+'</td><td>'+money(x.cod_amount)+'</td><td>'+money(x.commission_amount)+'</td><td><b>'+money(x.net_payable)+'</b></td><td><span class="pill">'+esc(x.status||'-')+'</span></td><td>'+esc(x.period_from)+' to '+esc(x.period_to)+'</td></tr>'}).join('')||'<tr><td colspan="9" class="empty">No settlements for selected period</td></tr>';
      msg.textContent='Report: '+from+' to '+to;
    }catch(e){msg.textContent='Report error: '+(e.message||e);$('crm1SetDBody').innerHTML=''}
  }
  async function generate(){
    var partner=$('crm1SetDPartner')?.value,from=$('crm1SetDGenFrom')?.value,to=$('crm1SetDGenTo')?.value,commission=Number($('crm1SetDCommission')?.value||0);
    if(!partner||!from||!to)return alert('Partner, From date and To date required');
    if(to<from)return alert('To date cannot be before From date');
    var r=await window.sb.rpc('generate_partner_settlement',{p_partner:partner,p_from:from,p_to:to,p_commission:commission});
    if(r.error)return alert(r.error.message);
    alert('Settlement generated successfully');load();
  }
  function installGuard(){
    var c=content();if(!c||!window.MutationObserver||guardInstalled)return;
    guardInstalled=true;
    var obs=new MutationObserver(function(){var p=page();if(!p||!p.classList.contains('active'))return;if($('crm1SettDetailedRoot'))return;clearTimeout(guardTimer);guardTimer=setTimeout(function(){var pp=page();if(pp&&pp.classList.contains('active')&&!$('crm1SettDetailedRoot'))build()},40)});
    obs.observe(c,{childList:true,subtree:true});c._crm1SettObserver=obs;
  }
  function ensure(){var p=page();if(!p||!p.classList.contains('active'))return;installGuard();if(!$('crm1SettDetailedRoot'))build()}
  function init(){if(started)return;started=true;var tries=0,t=setInterval(function(){var p=page();if(p&&p.classList.contains('active')){ensure();clearInterval(t)}if(++tries>120)clearInterval(t)},250);document.addEventListener('click',function(e){var b=e.target.closest('#nav button');if(b&&/settlements/i.test(String(b.textContent||''))){setTimeout(ensure,0);setTimeout(ensure,100);setTimeout(ensure,500)}})}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
