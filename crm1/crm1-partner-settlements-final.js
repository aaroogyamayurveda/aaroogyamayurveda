/* CRM1 authoritative Dealer/Courier settlements renderer. */
(function(){
  'use strict';
  if(window.__crm1PartnerSettlementsFinalV1)return;
  window.__crm1PartnerSettlementsFinalV1=true;

  var esc=function(x){return String(x==null?'':x).replace(/[&<>"']/g,function(m){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m];});};
  var money=function(x){return '₹'+Number(x||0).toLocaleString('en-IN');};
  var role=function(){var p=window.profile||window.currentProfile||window.crmProfile;return p&&p.role?String(p.role).toLowerCase():'';};
  var isPartner=function(){var r=role();return r==='dealer'||r==='courier'||r==='courier_manager';};
  var uid=async function(){if(window.me&&window.me.id)return window.me.id;var r=await window.sb.auth.getUser();return r&&r.data&&r.data.user?r.data.user.id:null;};
  var partner=async function(){var r=role(),id=await uid();if(r==='dealer'){var d=await window.sb.from('dealers').select('id,dealer_name').eq('user_id',id).maybeSingle();return d.data?{id:d.data.id,type:'dealer',name:d.data.dealer_name||'Dealer'}:null;}var p=await window.sb.from('profiles').select('id,full_name').eq('id',id).maybeSingle();return {id:id,type:'courier',name:p.data&&p.data.full_name||'Courier'};};
  var active=function(){var p=document.getElementById('settlements');return !!(p&&p.classList.contains('active'));};

  async function render(){
    if(!isPartner()||!window.sb||!active())return;
    var root=document.getElementById('settlementsContent');
    if(!root)return;
    root.innerHTML='<div data-crm1-partner-settlements="1"><div class="title"><div><h2>Your Settlements</h2><div class="sub">Only settlements belonging to your account are shown.</div></div></div><div class="panel"><div class="tablewrap"><table id="crm1PartnerSettlementsTable"><thead><tr><th>Period</th><th>Delivered</th><th>COD</th><th>Commission</th><th>Net Payable</th><th>Status</th></tr></thead><tbody id="crm1PartnerSettlementsBody"><tr><td colspan="6" class="empty">Loading...</td></tr></tbody></table></div></div></div>';
    var body=document.getElementById('crm1PartnerSettlementsBody');
    try{
      var p=await partner();
      if(!p){body.innerHTML='<tr><td colspan="6" class="empty">Partner profile not found.</td></tr>';return;}
      var q=window.sb.from('partner_settlements').select('period_from,period_to,delivered_orders,cod_amount,commission_amount,net_payable,status,partner_id,partner_type').eq('partner_id',p.id).order('period_from',{ascending:false}).limit(500);
      if(p.type==='dealer')q=q.eq('partner_type','dealer');else q=q.eq('partner_type','courier');
      var r=await q;
      if(r.error)throw r.error;
      body.innerHTML=(r.data||[]).map(function(x){return '<tr><td>'+esc(x.period_from||'-')+' to '+esc(x.period_to||'-')+'</td><td>'+Number(x.delivered_orders||0)+'</td><td>'+money(x.cod_amount)+'</td><td>'+money(x.commission_amount)+'</td><td><b>'+money(x.net_payable)+'</b></td><td><span class="pill">'+esc(x.status||'-')+'</span></td></tr>';}).join('')||'<tr><td colspan="6" class="empty">No settlements found</td></tr>';
    }catch(e){body.innerHTML='<tr><td colspan="6" class="empty">Unable to load settlements: '+esc(e.message||String(e))+'</td></tr>';}
  }

  function start(){
    var main=document.querySelector('main.main')||document.body;
    var obs=new MutationObserver(function(){if(active()){var root=document.getElementById('settlementsContent');if(root&&!root.querySelector('[data-crm1-partner-settlements="1"]')){clearTimeout(window.__crm1PartnerSettlementTimer);window.__crm1PartnerSettlementTimer=setTimeout(render,80);}}});
    obs.observe(main,{childList:true,subtree:true});
    var nav=document.getElementById('nav');
    if(nav)new MutationObserver(function(){if(active())setTimeout(render,60);}).observe(nav,{childList:true,subtree:true});
    document.addEventListener('click',function(e){var b=e.target&&e.target.closest?e.target.closest('#nav button'):null;if(b&&/settlements/i.test(String(b.textContent||'')))setTimeout(render,80);},true);
    setTimeout(render,300);
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
})();
