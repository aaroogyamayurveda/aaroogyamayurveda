/* CRM1 QA detailed: isolated QA page + creation/reporting. */
(function(){
  'use strict';
  var started=false,navObserver=null;
  var $=function(id){return document.getElementById(id)};
  var esc=function(v){return String(v==null?'':v).replace(/[&<>\"']/g,function(m){return{'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',"'":'&#039;'}[m]})};
  var todayIST=function(){return new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Kolkata',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date())};
  var dayStart=function(v){return new Date(v+'T00:00:00+05:30').toISOString()};
  var dayEnd=function(v){var d=new Date(v+'T00:00:00+05:30');d.setDate(d.getDate()+1);return d.toISOString()};

  function page(){return $('crm1QAPage')}
  function content(){return $('crm1QAStandaloneContent')}
  function isQAButton(b){return !!(b&&/QA.*Dispositions/i.test(String(b.textContent||'')))}

  function buildPage(){
    var main=document.querySelector('.main');
    if(!main)return false;
    var p=page();
    if(!p){
      p=document.createElement('section');
      p.id='crm1QAPage';
      p.className='page';
      p.innerHTML='<div class="title"><div><h2>QA &amp; Dispositions</h2><div class="sub">Call dispositions and quality review</div></div></div><div id="crm1QAStandaloneContent"></div>';
      main.appendChild(p);
    }
    var c=content();
    if(!c)return false;
    if(c.dataset.built==='1')return true;
    c.dataset.built='1';
    c.innerHTML='<div id="crm1QAStandaloneRoot">'+
      '<div class="panel"><div class="crm1-toolbar" style="display:flex;gap:10px;align-items:center;flex-wrap:wrap">'+
      '<label>From <input id="crm1QAFrom" type="date"></label>'+\
      '<label>To <input id="crm1QATo" type="date"></label>'+\
      '<select id="crm1QAAgent"><option value="">All Agents</option></select>'+\
      '<select id="crm1QADisp"><option value="">All Dispositions</option></select>'+\
      '<button class="btn" id="crm1QAApply" type="button">Apply</button>'+\
      '<button class="btn alt" id="crm1QAToday" type="button">Today</button>'+\
      '<button class="btn" id="crm1QANew" type="button">+ New QA Review</button></div></div>'+\
      '<div class="cards" id="crm1QAKpis"></div>'+\
      '<div class="panel"><h3>Agent Quality Performance</h3><div class="tablewrap"><table><thead><tr><th>Rank</th><th>Agent</th><th>Reviews</th><th>Avg Score</th><th>Pass</th><th>Fail</th><th>Pass %</th></tr></thead><tbody id="crm1QAAgentBody"></tbody></table></div></div>'+\
      '<div class="panel"><h3>QA Review Details</h3><div class="tablewrap"><table><thead><tr><th>Date</th><th>Agent</th><th>Order</th><th>Score</th><th>Disposition</th><th>Reviewer</th><th>Remarks</th></tr></thead><tbody id="crm1QABody"></tbody></table></div></div>'+\
      '<div class="panel hidden" id="crm1QAFormPanel"><h3>New QA Review</h3><div class="grid3">'+\
      '<div class="field"><label>Agent *</label><select id="crm1QAFormAgent"><option value="">Select Agent</option></select></div>'+\
      '<div class="field"><label>Order</label><select id="crm1QAFormOrder"><option value="">No Order</option></select></div>'+\
      '<div class="field"><label>Score *</label><input id="crm1QAFormScore" type="number" min="0" max="100" step="0.1" placeholder="0-100"></div>'+\
      '<div class="field"><label>Disposition</label><input id="crm1QAFormDisp" placeholder="Pass / Fail / Coaching etc."></div>'+\
      '<div class="field wide"><label>Reviewer Remarks</label><textarea id="crm1QAFormRemarks" rows="3" placeholder="QA observations"></textarea></div>'+\
      '</div><div class="actions"><button class="btn alt" id="crm1QACancel" type="button">Cancel</button><button class="btn" id="crm1QASave" type="button">Save Review</button></div></div>'+\
      '</div>';
    var t=todayIST();
    $('crm1QAFrom').value=t;$('crm1QATo').value=t;
    $('crm1QAApply').onclick=loadReport;
    $('crm1QAToday').onclick=function(){var d=todayIST();$('crm1QAFrom').value=d;$('crm1QATo').value=d;loadReport();};
    $('crm1QANew').onclick=openForm;
    $('crm1QACancel').onclick=closeForm;
    $('crm1QASave').onclick=saveReview;
    Promise.all([loadAgents(),loadDispositions(),loadOrdersForForm()]).then(loadReport).catch(function(e){console.warn('QA form data load:',e)});
    return true;
  }

  async function loadAgents(){
    var a=$('crm1QAAgent'),f=$('crm1QAFormAgent');if(!a||!f)return;
    var r=await window.sb.from('profiles').select('id,full_name').eq('is_active',true).eq('role','agent').order('full_name');
    if(r.error)throw r.error;
    a.innerHTML='<option value="">All Agents</option>'+(r.data||[]).map(function(x){return '<option value="'+esc(x.id)+'">'+esc(x.full_name)+'</option>'}).join('');
    f.innerHTML='<option value="">Select Agent</option>'+(r.data||[]).map(function(x){return '<option value="'+esc(x.id)+'">'+esc(x.full_name)+'</option>'}).join('');
  }

  async function loadDispositions(){
    var s=$('crm1QADisp');if(!s)return;
    var r=await window.sb.from('qa_reviews').select('disposition').not('disposition','is',null).order('disposition');
    if(r.error)throw r.error;
    var vals=[...new Set((r.data||[]).map(function(x){return x.disposition}).filter(Boolean))];
    s.innerHTML='<option value="">All Dispositions</option>'+vals.map(function(v){return '<option value="'+esc(v)+'">'+esc(v)+'</option>'}).join('');
  }

  async function loadOrdersForForm(){
    var s=$('crm1QAFormOrder');if(!s)return;
    var r=await window.sb.from('orders').select('id,order_no,order_status,customers(customer_name)').order('order_date',{ascending:false}).limit(300);
    if(r.error)throw r.error;
    s.innerHTML='<option value="">No Order</option>'+(r.data||[]).map(function(x){var label='#'+x.order_no+' · '+(x.customers?.customer_name||'-')+' · '+(x.order_status||'-');return '<option value="'+esc(x.id)+'">'+esc(label)+'</option>'}).join('');
  }

  function openForm(){var x=$('crm1QAFormPanel');if(x){x.classList.remove('hidden');x.scrollIntoView({behavior:'smooth',block:'center'})}}
  function closeForm(){
    $('crm1QAFormPanel')?.classList.add('hidden');
    if($('crm1QAFormScore'))$('crm1QAFormScore').value='';
    if($('crm1QAFormDisp'))$('crm1QAFormDisp').value='';
    if($('crm1QAFormRemarks'))$('crm1QAFormRemarks').value='';
    if($('crm1QAFormOrder'))$('crm1QAFormOrder').value='';
    if($('crm1QAFormAgent'))$('crm1QAFormAgent').value='';
  }

  async function saveReview(){
    var agent=$('crm1QAFormAgent')?.value||'',order=$('crm1QAFormOrder')?.value||null,score=$('crm1QAFormScore')?.value,disp=$('crm1QAFormDisp')?.value.trim()||null,remarks=$('crm1QAFormRemarks')?.value.trim()||null;
    if(!agent)return alert('Agent required');
    if(score===''||score==null||Number(score)<0||Number(score)>100)return alert('Score must be between 0 and 100');
    var btn=$('crm1QASave');btn.disabled=true;btn.textContent='Saving...';
    try{
      var r=await window.sb.rpc('crm1_create_qa_review',{p_agent_id:agent,p_order_id:order,p_score:Number(score),p_disposition:disp,p_remarks:remarks});
      if(r.error)throw r.error;
      var result=r.data||{};
      if(!result.ok)throw new Error(result.reason||'QA review could not be saved');
      closeForm();
      await loadReport();
      alert('QA review saved successfully');
    }catch(e){alert(e.message||e)}finally{btn.disabled=false;btn.textContent='Save Review'}
  }

  async function loadReport(){
    if(!page()||!page().classList.contains('active'))return;
    var body=$('crm1QABody');if(!body)return;
    var from=$('crm1QAFrom')?.value||todayIST(),to=$('crm1QATo')?.value||from;
    if(to<from){var z=from;from=to;to=z;$('crm1QAFrom').value=from;$('crm1QATo').value=to}
    body.innerHTML='<tr><td colspan="7" class="empty">Loading...</td></tr>';
    try{
      var q=window.sb.from('qa_reviews').select('id,agent_id,reviewed_by,order_id,score,remarks,created_at,disposition,reviewer_note,reviewed_at,profiles:agent_id(full_name),reviewer:reviewed_by(full_name)').gte('created_at',dayStart(from)).lt('created_at',dayEnd(to)).order('created_at',{ascending:false}).limit(1000);
      var agent=$('crm1QAAgent')?.value||'',disp=$('crm1QADisp')?.value||'';
      if(agent)q=q.eq('agent_id',agent);if(disp)q=q.eq('disposition',disp);
      var r=await q;if(r.error)throw r.error;var rows=r.data||[];
      var scores=rows.map(function(x){return Number(x.score)}).filter(Number.isFinite),avg=scores.length?scores.reduce(function(a,b){return a+b},0)/scores.length:0;
      var pass=rows.filter(function(x){return Number(x.score)>=80}).length,fail=rows.filter(function(x){return Number(x.score)<80}).length;
      $('crm1QAKpis').innerHTML='<div class="stat"><span>Reviews</span><b>'+rows.length+'</b></div><div class="stat"><span>Average Score</span><b>'+avg.toFixed(1)+'</b></div><div class="stat"><span>Pass</span><b>'+pass+'</b></div><div class="stat"><span>Fail</span><b>'+fail+'</b></div>';
      var map={};rows.forEach(function(x){var k=x.agent_id||'unassigned',n=x.profiles?.full_name||'Unassigned';if(!map[k])map[k]={name:n,reviews:0,total:0,pass:0,fail:0};map[k].reviews++;var s=Number(x.score);if(Number.isFinite(s)){map[k].total+=s;if(s>=80)map[k].pass++;else map[k].fail++}});
      var agents=Object.values(map).map(function(x){return {name:x.name,reviews:x.reviews,avg:x.reviews?x.total/x.reviews:0,pass:x.pass,fail:x.fail,pct:x.reviews?x.pass/x.reviews*100:0}}).sort(function(a,b){return b.avg-a.avg||b.pct-a.pct||b.reviews-a.reviews});
      $('crm1QAAgentBody').innerHTML=agents.map(function(x,i){return '<tr><td><b>'+(i+1)+'</b></td><td><b>'+esc(x.name)+'</b></td><td>'+x.reviews+'</td><td>'+x.avg.toFixed(1)+'</td><td>'+x.pass+'</td><td>'+x.fail+'</td><td>'+x.pct.toFixed(1)+'%</td></tr>'}).join('')||'<tr><td colspan="7" class="empty">No QA reviews for selected period</td></tr>';
      body.innerHTML=rows.map(function(x){var dt=x.reviewed_at||x.created_at;return '<tr><td>'+esc(dt?new Intl.DateTimeFormat('en-IN',{timeZone:'Asia/Kolkata',dateStyle:'medium',timeStyle:'short'}).format(new Date(dt)):'-')+'</td><td>'+esc(x.profiles?.full_name||'-')+'</td><td>'+(x.order_id?esc('#'+String(x.order_id).slice(0,8)):'-')+'</td><td><b>'+esc(x.score??'-')+'</b></td><td>'+esc(x.disposition||'-')+'</td><td>'+esc(x.reviewer?.full_name||'-')+'</td><td>'+esc(x.reviewer_note||x.remarks||'-')+'</td></tr>'}).join('')||'<tr><td colspan="7" class="empty">No QA reviews for selected period</td></tr>';
    }catch(e){
      body.innerHTML='<tr><td colspan="7" class="msg">QA report error: '+esc(e.message||e)+'</td></tr>';
      $('crm1QAAgentBody').innerHTML='';
    }
  }

  function openStandalone(){
    buildPage();
    document.querySelectorAll('.page').forEach(function(p){p.classList.remove('active')});
    page()?.classList.add('active');
    document.querySelectorAll('#nav button').forEach(function(b){b.classList.toggle('active',isQAButton(b))});
    loadReport();
  }

  function ensureNav(){
    var nav=$('nav');if(!nav)return;
    var existing=[...nav.querySelectorAll('button')].filter(isQAButton);
    existing.forEach(function(b){if(!b.dataset.crm1QAIntercept)b.dataset.crm1QAIntercept='1'});
    if(existing.length===0 && ['super_admin','management','order_manager'].includes(String(window.profile?.role||'').toLowerCase())){
      var b=document.createElement('button');b.type='button';b.id='crm1QANav';b.textContent='🎧 QA & Dispositions';b.dataset.crm1QAIntercept='1';nav.appendChild(b);
    }
  }

  function bind(){
    if(started)return;started=true;
    document.addEventListener('click',function(e){
      var b=e.target.closest('#nav button');
      if(isQAButton(b)){
        e.preventDefault();e.stopPropagation();e.stopImmediatePropagation();openStandalone();
      }
    },true);
    navObserver=new MutationObserver(function(){ensureNav()});
    var nav=$('nav');if(nav)navObserver.observe(nav,{childList:true,subtree:true});
    setTimeout(function(){buildPage();ensureNav()},300);
    setTimeout(ensureNav,1200);setTimeout(ensureNav,2500);setTimeout(ensureNav,5000);
  }

  window.crm1OpenQAPage=openStandalone;
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',bind,{once:true});else bind();
})();
