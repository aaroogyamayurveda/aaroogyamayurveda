/* CRM1 PIN Auto Assignment detailed: PIN-wise dealer/courier routing rules. */
(function(){
  'use strict';
  var started=false,guardInstalled=false,guardTimer=null;
  var $=function(id){return document.getElementById(id)};
  function esc(v){return String(v==null?'':v).replace(/[&<>\"']/g,function(m){return{'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',"'":'&#039;'}[m]})}
  function page(){return $('pinRules')}
  function content(){return $('pinRulesContent')}
  function build(){
    var p=page(),c=content();
    if(!p||!c||!p.classList.contains('active'))return false;
    c.innerHTML='<div id="crm1PinDetailedRoot">'+
      '<div class="panel"><div class="crm1-toolbar" style="display:flex;gap:10px;align-items:center;flex-wrap:wrap">'+
      '<input id="crm1PinSearch" inputmode="numeric" maxlength="6" placeholder="Search PIN">'+
      '<select id="crm1PinPartner"><option value="">All Partners</option></select>'+ 
      '<select id="crm1PinStatus"><option value="">All Status</option><option value="true">Active</option><option value="false">Inactive</option></select>'+ 
      '<button class="btn" id="crm1PinAdd">Add Rule</button><button class="btn alt" id="crm1PinRefresh">Refresh</button>'+ 
      '</div></div>'+
      '<div class="cards" id="crm1PinKpis"></div>'+
      '<div class="panel"><div class="tablewrap"><table><thead><tr><th>PIN</th><th>Partner</th><th>Type</th><th>Priority</th><th>Status</th><th>Created</th><th>Action</th></tr></thead><tbody id="crm1PinBody"></tbody></table></div></div>'+
      '<div class="panel hidden" id="crm1PinFormPanel"><h3 id="crm1PinFormTitle">Add PIN Rule</h3><div class="grid3">'+
      '<div class="field"><label>PIN Code *</label><input id="crm1PinCode" inputmode="numeric" maxlength="6"></div>'+ 
      '<div class="field"><label>Partner *</label><select id="crm1PinFormPartner"><option value="">Select Partner</option></select></div>'+ 
      '<div class="field"><label>Priority</label><input id="crm1PinPriority" type="number" min="1" value="1"></div></div>'+ 
      '<div class="actions"><button class="btn alt" id="crm1PinCancel">Cancel</button><button class="btn" id="crm1PinSave">Save Rule</button></div></div>'+
      '</div>';
    $('crm1PinSearch').oninput=function(){this.value=this.value.replace(/\D/g,'').slice(0,6);load()};
    $('crm1PinPartner').onchange=load;$('crm1PinStatus').onchange=load;
    $('crm1PinAdd').onclick=function(){openForm()};$('crm1PinRefresh').onclick=load;$('crm1PinCancel').onclick=closeForm;$('crm1PinSave').onclick=save;
    loadPartners().then(load);
    return true;
  }
  async function loadPartners(){
    var targets=[$('crm1PinPartner'),$('crm1PinFormPartner')];if(!targets[0]||!targets[1])return;
    try{
      var r=await window.sb.from('profiles').select('id,full_name,role').eq('is_active',true).in('role',['dealer','courier_manager']).order('full_name');
      if(r.error)throw r.error;
      var html='<option value="">Select Partner</option>'+(r.data||[]).map(function(x){return '<option value="'+esc(x.id)+'">'+esc(x.full_name)+' ('+esc(x.role)+')</option>'}).join('');
      targets[0].innerHTML='<option value="">All Partners</option>'+(r.data||[]).map(function(x){return '<option value="'+esc(x.id)+'">'+esc(x.full_name)+'</option>'}).join('');
      targets[1].innerHTML=html;
    }catch(e){targets[0].innerHTML='<option value="">Partner load error</option>';targets[1].innerHTML='<option value="">Partner load error</option>'}
  }
  async function load(){
    var body=$('crm1PinBody');if(!body)return;
    body.innerHTML='<tr><td colspan="7" class="empty">Loading...</td></tr>';
    try{
      var q=window.sb.from('pin_assignment_rules').select('id,pincode,partner_id,priority,is_active,created_at,profiles:partner_id(full_name,role)').order('pincode').order('priority');
      var pin=$('crm1PinSearch')?.value||'',partner=$('crm1PinPartner')?.value||'',status=$('crm1PinStatus')?.value||'';
      if(pin)q=q.ilike('pincode',pin+'%');if(partner)q=q.eq('partner_id',partner);if(status!=='')q=q.eq('is_active',status==='true');
      var r=await q;if(r.error)throw r.error;var rows=r.data||[];
      var active=rows.filter(function(x){return x.is_active}).length;
      $('crm1PinKpis').innerHTML='<div class="stat"><span>Total Rules</span><b>'+rows.length+'</b></div><div class="stat"><span>Active</span><b>'+active+'</b></div><div class="stat"><span>Inactive</span><b>'+(rows.length-active)+'</b></div><div class="stat"><span>Unique PINs</span><b>'+new Set(rows.map(function(x){return x.pincode})).size+'</b></div>';
      body.innerHTML=rows.map(function(x){return '<tr><td><b>'+esc(x.pincode)+'</b></td><td>'+esc(x.profiles?.full_name||'-')+'</td><td>'+esc(x.profiles?.role||'-')+'</td><td>'+Number(x.priority||1)+'</td><td><span class="pill">'+(x.is_active?'Active':'Inactive')+'</span></td><td>'+esc(new Date(x.created_at).toLocaleString('en-IN'))+'</td><td><button class="crm-clear-filters" data-edit="'+esc(x.id)+'">Edit</button> <button class="crm-clear-filters" data-toggle="'+esc(x.id)+'">'+(x.is_active?'Deactivate':'Activate')+'</button></td></tr>'}).join('')||'<tr><td colspan="7" class="empty">No PIN rules found</td></tr>';
      body.querySelectorAll('[data-edit]').forEach(function(b){b.onclick=function(){edit(b.dataset.edit)}});
      body.querySelectorAll('[data-toggle]').forEach(function(b){b.onclick=function(){toggle(b.dataset.toggle)}});
    }catch(e){body.innerHTML='<tr><td colspan="7" class="msg">'+esc(e.message||e)+'</td></tr>'}
  }
  async function edit(id){
    try{var r=await window.sb.from('pin_assignment_rules').select('id,pincode,partner_id,priority,is_active').eq('id',id).single();if(r.error)throw r.error;openForm(r.data)}catch(e){alert(e.message)}
  }
  function openForm(row){
    $('crm1PinFormPanel').classList.remove('hidden');$('crm1PinFormTitle').textContent=row?'Edit PIN Rule':'Add PIN Rule';$('crm1PinCode').value=row?.pincode||'';$('crm1PinFormPartner').value=row?.partner_id||'';$('crm1PinPriority').value=row?.priority||1;$('crm1PinFormPanel').dataset.id=row?.id||'';$('crm1PinFormPanel').scrollIntoView({behavior:'smooth',block:'center'});
  }
  function closeForm(){$('crm1PinFormPanel')?.classList.add('hidden')}
  async function save(){
    var panel=$('crm1PinFormPanel'),id=panel?.dataset.id||'',pin=$('crm1PinCode')?.value||'',partner=$('crm1PinFormPartner')?.value||'',priority=Number($('crm1PinPriority')?.value||1);
    if(!/^\d{6}$/.test(pin))return alert('6 digit PIN required');if(!partner)return alert('Partner required');if(priority<1)return alert('Priority must be 1 or more');
    var payload={pincode:pin,partner_id:partner,priority:priority,is_active:true};var r=id?await window.sb.from('pin_assignment_rules').update({pincode:pin,partner_id:partner,priority:priority,updated_at:new Date().toISOString()}).eq('id',id):await window.sb.from('pin_assignment_rules').insert(payload);
    if(r.error)return alert(r.error.message);closeForm();load();
  }
  async function toggle(id){
    var r=await window.sb.from('pin_assignment_rules').select('is_active').eq('id',id).single();if(r.error)return alert(r.error.message);var u=await window.sb.from('pin_assignment_rules').update({is_active:!r.data.is_active,updated_at:new Date().toISOString()}).eq('id',id);if(u.error)return alert(u.error.message);load();
  }
  function installGuard(){var c=content();if(!c||!window.MutationObserver||guardInstalled)return;guardInstalled=true;var obs=new MutationObserver(function(){var p=page();if(!p||!p.classList.contains('active'))return;if($('crm1PinDetailedRoot'))return;clearTimeout(guardTimer);guardTimer=setTimeout(function(){var pp=page();if(pp&&pp.classList.contains('active')&&!$('crm1PinDetailedRoot'))build()},40)});obs.observe(c,{childList:true,subtree:true});c._crm1PinObserver=obs}
  function ensure(){var p=page();if(!p||!p.classList.contains('active'))return;installGuard();if(!$('crm1PinDetailedRoot'))build()}
  function init(){if(started)return;started=true;var tries=0,t=setInterval(function(){var p=page();if(p&&p.classList.contains('active')){ensure();clearInterval(t)}if(++tries>120)clearInterval(t)},250);document.addEventListener('click',function(e){var b=e.target.closest('#nav button');if(b&&/pin auto assignment/i.test(String(b.textContent||''))){setTimeout(ensure,0);setTimeout(ensure,100);setTimeout(ensure,500)}})}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
