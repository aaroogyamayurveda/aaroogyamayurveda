/* CRM1 QA detailed v6: isolated, stable QA page. */
(function(){
  'use strict';

  var started = false;
  var $ = function(id){ return document.getElementById(id); };
  var esc = function(v){
    return String(v == null ? '' : v).replace(/[&<>\"']/g,function(m){
      return {'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',"'":'&#039;'}[m];
    });
  };
  var isManagerRole = function(){
    return ['super_admin','management','order_manager'].indexOf(String(window.profile && window.profile.role || '').toLowerCase()) >= 0;
  };
  var nowISTDate = function(){
    return new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Kolkata',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
  };
  var istStart = function(v){ return new Date(v+'T00:00:00+05:30').toISOString(); };
  var istNextDay = function(v){
    var d = new Date(v+'T00:00:00+05:30');
    d.setDate(d.getDate()+1);
    return d.toISOString();
  };
  var fmtIST = function(v){
    if(!v) return '-';
    var d = new Date(v);
    if(Number.isNaN(d.getTime())) return String(v);
    return new Intl.DateTimeFormat('en-IN',{timeZone:'Asia/Kolkata',dateStyle:'medium',timeStyle:'short'}).format(d);
  };

  function getPage(){ return $('crm1QAV6Page'); }
  function getRoot(){ return $('crm1QAV6Root'); }

  function createPage(){
    var main = document.querySelector('.main');
    if(!main) return false;
    var page = getPage();
    if(!page){
      page = document.createElement('section');
      page.id = 'crm1QAV6Page';
      page.className = 'page';
      page.innerHTML = '<div class="title"><div><h2>🎧 QA &amp; Dispositions</h2><div class="sub">Call dispositions and quality review</div></div></div>'+
        '<div id="crm1QAV6Root"></div>';
      main.appendChild(page);
    }
    return true;
  }

  function buildUI(){
    if(!createPage()) return false;
    var root = getRoot();
    if(!root) return false;
    if(root.dataset.built === '1') return true;
    root.dataset.built = '1';
    root.innerHTML =
      '<div class="panel">'+
        '<div class="crm1qa-v6-toolbar">'+
          '<label>From <input id="crm1QAV6From" type="date"></label>'+
          '<label>To <input id="crm1QAV6To" type="date"></label>'+
          '<select id="crm1QAV6Agent"><option value="">All Agents</option></select>'+
          '<select id="crm1QAV6Disposition"><option value="">All Dispositions</option></select>'+
          '<button class="btn" id="crm1QAV6Apply" type="button">Apply</button>'+
          '<button class="btn alt" id="crm1QAV6Today" type="button">Today</button>'+
          '<button class="btn" id="crm1QAV6New" type="button">+ New QA Review</button>'+ 
        '</div>'+ 
      '</div>'+
      '<div class="cards crm1qa-v6-kpis" id="crm1QAV6Kpis"></div>'+ 
      '<div class="panel"><h3>Agent Quality Performance</h3><div class="tablewrap"><table><thead><tr><th>Rank</th><th>Agent</th><th>Reviews</th><th>Avg Score</th><th>Pass</th><th>Fail</th><th>Pass %</th></tr></thead><tbody id="crm1QAV6AgentBody"></tbody></table></div></div>'+
      '<div class="panel"><h3>QA Review Details</h3><div class="tablewrap"><table><thead><tr><th>Date</th><th>Agent</th><th>Order</th><th>Score</th><th>Disposition</th><th>Reviewer</th><th>Remarks</th></tr></thead><tbody id="crm1QAV6ReviewBody"></tbody></table></div></div>'+
      '<div class="panel hidden" id="crm1QAV6FormPanel">'+
        '<h3>New QA Review</h3>'+ 
        '<div class="grid3">'+
          '<div class="field"><label>Agent *</label><select id="crm1QAV6FormAgent"><option value="">Select Agent</option></select></div>'+ 
          '<div class="field"><label>Order</label><select id="crm1QAV6FormOrder"><option value="">No Order</option></select></div>'+ 
          '<div class="field"><label>Score *</label><input id="crm1QAV6FormScore" type="number" min="0" max="100" step="0.1" placeholder="0-100"></div>'+ 
          '<div class="field"><label>Disposition</label><input id="crm1QAV6FormDisposition" placeholder="Pass / Fail / Coaching etc."></div>'+ 
          '<div class="field wide"><label>Reviewer Remarks</label><textarea id="crm1QAV6FormRemarks" rows="3" placeholder="QA observations"></textarea></div>'+ 
        '</div>'+ 
        '<div class="actions"><button class="btn alt" id="crm1QAV6Cancel" type="button">Cancel</button><button class="btn" id="crm1QAV6Save" type="button">Save Review</button></div>'+ 
      '</div>';

    var t = nowISTDate();
    $('crm1QAV6From').value = t;
    $('crm1QAV6To').value = t;
    $('crm1QAV6Apply').onclick = loadReport;
    $('crm1QAV6Today').onclick = function(){
      var d = nowISTDate();
      $('crm1QAV6From').value = d;
      $('crm1QAV6To').value = d;
      loadReport();
    };
    $('crm1QAV6New').onclick = openForm;
    $('crm1QAV6Cancel').onclick = closeForm;
    $('crm1QAV6Save').onclick = saveReview;
    injectStyle();
    Promise.all([loadAgents(),loadDispositions(),loadOrders()]).then(loadReport).catch(function(e){ console.warn('QA v6 initial load:',e); loadReport(); });
    return true;
  }

  function injectStyle(){
    if($('crm1QAV6Style')) return;
    var s = document.createElement('style');
    s.id = 'crm1QAV6Style';
    s.textContent = '.crm1qa-v6-toolbar{display:flex;align-items:center;gap:10px;flex-wrap:wrap}.crm1qa-v6-toolbar label{display:flex;align-items:center;gap:6px;font-size:13px;color:#374151}.crm1qa-v6-toolbar input,.crm1qa-v6-toolbar select{height:38px;padding:7px 9px;border:1px solid #d9e1db;border-radius:9px;background:#fff}.crm1qa-v6-kpis{grid-template-columns:repeat(4,1fr)!important}.crm1qa-v6-kpis .stat{min-width:0}@media(max-width:850px){.crm1qa-v6-kpis{grid-template-columns:repeat(2,1fr)!important}}@media(max-width:520px){.crm1qa-v6-kpis{grid-template-columns:1fr!important}.crm1qa-v6-toolbar label{width:100%}.crm1qa-v6-toolbar input,.crm1qa-v6-toolbar select{flex:1}}';
    document.head.appendChild(s);
  }

  async function loadAgents(){
    var a = $('crm1QAV6Agent'), f = $('crm1QAV6FormAgent');
    if(!a || !f || !window.sb) return;
    var r = await window.sb.from('profiles').select('id,full_name').eq('is_active',true).eq('role','agent').order('full_name');
    if(r.error) throw r.error;
    var rows = r.data || [];
    a.innerHTML = '<option value="">All Agents</option>'+rows.map(function(x){return '<option value="'+esc(x.id)+'">'+esc(x.full_name||'-')+'</option>';}).join('');
    f.innerHTML = '<option value="">Select Agent</option>'+rows.map(function(x){return '<option value="'+esc(x.id)+'">'+esc(x.full_name||'-')+'</option>';}).join('');
  }

  async function loadDispositions(){
    var s = $('crm1QAV6Disposition');
    if(!s || !window.sb) return;
    var r = await window.sb.from('qa_reviews').select('disposition').not('disposition','is',null).order('disposition');
    if(r.error) throw r.error;
    var vals = Array.from(new Set((r.data||[]).map(function(x){return x.disposition;}).filter(Boolean)));
    s.innerHTML = '<option value="">All Dispositions</option>'+vals.map(function(v){return '<option value="'+esc(v)+'">'+esc(v)+'</option>';}).join('');
  }

  async function loadOrders(){
    var s = $('crm1QAV6FormOrder');
    if(!s || !window.sb) return;
    var r = await window.sb.from('orders').select('id,order_no,order_status,customer_id').order('order_date',{ascending:false}).limit(300);
    if(r.error) throw r.error;
    var orderRows = r.data || [];
    s.innerHTML = '<option value="">No Order</option>'+orderRows.map(function(x){return '<option value="'+esc(x.id)+'">#'+esc(x.order_no)+' · '+esc(x.order_status||'-')+'</option>';}).join('');
  }

  function openForm(){
    var p = $('crm1QAV6FormPanel');
    if(p){ p.classList.remove('hidden'); p.scrollIntoView({behavior:'smooth',block:'center'}); }
  }

  function closeForm(){
    var p = $('crm1QAV6FormPanel');
    if(p) p.classList.add('hidden');
    ['crm1QAV6FormScore','crm1QAV6FormDisposition','crm1QAV6FormRemarks'].forEach(function(id){if($(id))$(id).value='';});
    if($('crm1QAV6FormAgent'))$('crm1QAV6FormAgent').value='';
    if($('crm1QAV6FormOrder'))$('crm1QAV6FormOrder').value='';
  }

  async function saveReview(){
    var agent = $('crm1QAV6FormAgent') && $('crm1QAV6FormAgent').value;
    var order = $('crm1QAV6FormOrder') && $('crm1QAV6FormOrder').value;
    var score = $('crm1QAV6FormScore') && $('crm1QAV6FormScore').value;
    var disposition = (($('crm1QAV6FormDisposition') && $('crm1QAV6FormDisposition').value) || '').trim();
    var remarks = (($('crm1QAV6FormRemarks') && $('crm1QAV6FormRemarks').value) || '').trim();
    if(!agent){ alert('Agent required'); return; }
    if(score === '' || score == null || Number(score) < 0 || Number(score) > 100){ alert('Score must be between 0 and 100'); return; }
    var btn = $('crm1QAV6Save');
    btn.disabled = true; btn.textContent = 'Saving...';
    try{
      var r = await window.sb.rpc('crm1_create_qa_review',{
        p_agent_id: agent,
        p_order_id: order || null,
        p_score: Number(score),
        p_disposition: disposition || null,
        p_remarks: remarks || null
      });
      if(r.error) throw r.error;
      if(r.data && r.data.ok === false) throw new Error(r.data.reason || 'QA review could not be saved');
      closeForm();
      await loadReport();
      alert('QA review saved successfully');
    }catch(e){
      alert(e.message || String(e));
    }finally{
      btn.disabled = false; btn.textContent = 'Save Review';
    }
  }

  async function loadReport(){
    var page = getPage();
    if(!page || !page.classList.contains('active') || !window.sb) return;
    var body = $('crm1QAV6ReviewBody');
    if(!body) return;
    var from = ($('crm1QAV6From') && $('crm1QAV6From').value) || nowISTDate();
    var to = ($('crm1QAV6To') && $('crm1QAV6To').value) || from;
    if(to < from){ var swap = from; from = to; to = swap; $('crm1QAV6From').value = from; $('crm1QAV6To').value = to; }
    body.innerHTML = '<tr><td colspan="7" class="empty">Loading...</td></tr>';
    try{
      var q = window.sb.from('qa_reviews').select('id,agent_id,reviewed_by,order_id,score,remarks,created_at,disposition,reviewer_note,reviewed_at').gte('created_at',istStart(from)).lt('created_at',istNextDay(to)).order('created_at',{ascending:false}).limit(1000);
      var agentFilter = ($('crm1QAV6Agent') && $('crm1QAV6Agent').value) || '';
      var dispFilter = ($('crm1QAV6Disposition') && $('crm1QAV6Disposition').value) || '';
      if(agentFilter) q = q.eq('agent_id',agentFilter);
      if(dispFilter) q = q.eq('disposition',dispFilter);
      var r = await q;
      if(r.error) throw r.error;
      var rows = r.data || [];

      var ids = new Set();
      rows.forEach(function(x){ if(x.agent_id) ids.add(x.agent_id); if(x.reviewed_by) ids.add(x.reviewed_by); });
      var orderIds = rows.map(function(x){return x.order_id;}).filter(Boolean);
      var profiles = {}, orders = {};
      if(ids.size){
        var pr = await window.sb.from('profiles').select('id,full_name').in('id',Array.from(ids));
        if(pr.error) throw pr.error;
        (pr.data||[]).forEach(function(x){profiles[x.id]=x.full_name||x.id;});
      }
      if(orderIds.length){
        var or = await window.sb.from('orders').select('id,order_no').in('id',orderIds);
        if(or.error) throw or.error;
        (or.data||[]).forEach(function(x){orders[x.id]=x.order_no;});
      }

      var scores = rows.map(function(x){return Number(x.score);}).filter(function(x){return Number.isFinite(x);});
      var avg = scores.length ? scores.reduce(function(a,b){return a+b;},0)/scores.length : 0;
      var pass = rows.filter(function(x){return Number(x.score) >= 80;}).length;
      var fail = rows.filter(function(x){return Number(x.score) < 80;}).length;
      $('crm1QAV6Kpis').innerHTML =
        '<div class="stat"><span>Reviews</span><b>'+rows.length+'</b></div>'+ 
        '<div class="stat"><span>Average Score</span><b>'+avg.toFixed(1)+'</b></div>'+ 
        '<div class="stat"><span>Pass</span><b>'+pass+'</b></div>'+ 
        '<div class="stat"><span>Fail</span><b>'+fail+'</b></div>';

      var map = {};
      rows.forEach(function(x){
        var k = x.agent_id || 'unassigned';
        if(!map[k]) map[k] = {name:profiles[x.agent_id]||'Unassigned',reviews:0,total:0,pass:0,fail:0};
        map[k].reviews++;
        var s = Number(x.score);
        if(Number.isFinite(s)){ map[k].total += s; if(s >= 80) map[k].pass++; else map[k].fail++; }
      });
      var agents = Object.keys(map).map(function(k){
        var x = map[k];
        return {name:x.name,reviews:x.reviews,avg:x.reviews?x.total/x.reviews:0,pass:x.pass,fail:x.fail,pct:x.reviews?x.pass/x.reviews*100:0};
      }).sort(function(a,b){return b.avg-a.avg||b.pct-a.pct||b.reviews-a.reviews;});
      $('crm1QAV6AgentBody').innerHTML = agents.map(function(x,i){
        return '<tr><td><b>'+(i+1)+'</b></td><td><b>'+esc(x.name)+'</b></td><td>'+x.reviews+'</td><td>'+x.avg.toFixed(1)+'</td><td>'+x.pass+'</td><td>'+x.fail+'</td><td>'+x.pct.toFixed(1)+'%</td></tr>';
      }).join('') || '<tr><td colspan="7" class="empty">No QA reviews for selected period</td></tr>';

      body.innerHTML = rows.map(function(x){
        var orderLabel = x.order_id && orders[x.order_id] != null ? '#'+orders[x.order_id] : '-';
        return '<tr><td>'+esc(fmtIST(x.reviewed_at||x.created_at))+'</td><td>'+esc(profiles[x.agent_id]||'-')+'</td><td>'+esc(orderLabel)+'</td><td><b>'+esc(x.score)+'</b></td><td>'+esc(x.disposition||'-')+'</td><td>'+esc(profiles[x.reviewed_by]||'-')+'</td><td>'+esc(x.reviewer_note||x.remarks||'-')+'</td></tr>';
      }).join('') || '<tr><td colspan="7" class="empty">No QA reviews for selected period</td></tr>';
    }catch(e){
      body.innerHTML = '<tr><td colspan="7" class="msg">QA report error: '+esc(e.message||e)+'</td></tr>';
      if($('crm1QAV6AgentBody')) $('crm1QAV6AgentBody').innerHTML = '<tr><td colspan="7" class="empty">Unable to load QA performance.</td></tr>';
    }
  }

  function isQANavButton(b){ return !!(b && /QA\s*&\s*Dispositions/i.test(String(b.textContent||''))); }

  function openQA(){
    buildUI();
    document.querySelectorAll('.page').forEach(function(p){p.classList.remove('active');});
    var p = getPage(); if(p) p.classList.add('active');
    document.querySelectorAll('#nav button').forEach(function(b){b.classList.toggle('active',isQANavButton(b));});
    loadReport();
  }

  function ensureNav(){
    var nav = $('nav'); if(!nav) return;
    var found = false;
    nav.querySelectorAll('button').forEach(function(b){ if(isQANavButton(b)) found = true; });
    if(!found && isManagerRole()){
      var b = document.createElement('button');
      b.type = 'button';
      b.id = 'crm1QAV6Nav';
      b.textContent = '🎧 QA & Dispositions';
      nav.appendChild(b);
    }
  }

  function bind(){
    if(started) return;
    started = true;
    document.addEventListener('click',function(e){
      var b = e.target.closest('#nav button');
      if(isQANavButton(b)){
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        openQA();
      }
    },true);
    var observer = new MutationObserver(ensureNav);
    var nav = $('nav'); if(nav) observer.observe(nav,{childList:true,subtree:true});
    ensureNav();
    setTimeout(ensureNav,300);
    setTimeout(ensureNav,1200);
    setTimeout(ensureNav,2500);
  }

  window.crm1QAV6Open = openQA;
  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded',bind,{once:true}); else bind();
})();
