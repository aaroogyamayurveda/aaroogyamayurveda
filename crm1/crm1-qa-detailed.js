/* CRM1 QA detailed: QA review dashboard and agent-wise quality performance. */
(function(){
  'use strict';
  var started=false,guardInstalled=false,timer=null;
  var $=function(id){return document.getElementById(id)};
  var esc=function(v){return String(v==null?'':v).replace(/[&<>\"']/g,function(m){return{'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',"'":'&#039;'}[m]})};
  var money=function(v){return '₹'+Number(v||0).toLocaleString('en-IN')};
  var today=function(){return new Date().toISOString().slice(0,10)};
  var nextDay=function(v){var d=new Date(v+'T00:00:00');d.setDate(d.getDate()+1);return d.toISOString().slice(0,10)};
  function page(){return $('qa')}
  function content(){return $('qaContent')}
  function build(){
    var p=page(),c=content(); if(!p||!c||!p.classList.contains('active'))return false;
    c.innerHTML='<div id="crm1QADetailedRoot">'+
      '<div class="panel"><div class="crm1-toolbar" style="display:flex;gap:10px;align-items:center;flex-wrap:wrap">'+
      '<label>From <input id="crm1QAFrom" type="date"></label><label>To <input id="crm1QATo" type="date"></label>'+ 
      '<select id="crm1QAAgent"><option value="">All Agents</option></select><select id="crm1QADisp"><option value="">All Dispositions</option></select>'+ 
      '<button class="btn" id="crm1QAApply">Apply</button><button class="btn alt" id="crm1QAToday">Today</button></div></div>'+ 
      '<div class="cards" id="crm1QAKpis"></div>'+ 
      '<div class="panel"><h3>Agent Quality Performance</h3><div class="tablewrap"><table><thead><tr><th>Rank</th><th>Agent</th><th>Reviews</th><th>Avg Score</th><th>Pass</th><th>Fail</th><th>Pass %</th></tr></thead><tbody id="crm1QAAgentBody"></tbody></table></div></div>'+ 
      '<div class="panel"><h3>QA Review Details</h3><div class="tablewrap"><table><thead><tr><th>Date</th><th>Agent</th><th>Order</th><th>Score</th><th>Disposition</th><th>Reviewer</th><th>Remarks</th></tr></thead><tbody id="crm1QABody"></tbody></table></div></div>'+ 
      '</div>';
    var t=today(); $('crm1QAFrom').value=t;$('crm1QATo').value=t;
    $('crm1QAApply').onclick=load;$('crm1QAToday').onclick=function(){$('crm1QAFrom').value=today();$('crm1QATo').value=today();load()};
    loadAgents().then(function(){loadDispositions().then(load)});
    return true;
  }
  async function loadAgents(){var s=$('crm1QAAgent');if(!s)return;try{var r=await window.sb.from('profiles').select('id,full_name').eq('is_active',true).eq('role','agent').order('full_name');if(r.error)throw r.error;s.innerHTML='<option value="">All Agents</option>'+(r.data||[]).map(function(x){return '<option value="'+esc(x.id)+'">'+esc(x.full_name)+'</option>'}).join('')}catch(e){s.innerHTML='<option value="">Agent load error</option>'}}
  async function loadDispositions(){var s=$('crm1QADisp');if(!s)return;try{var r=await window.sb.from('qa_reviews').select('disposition').not('disposition','is',null).order('disposition');if(r.error)throw r.error;var vals=[...new Set((r.data||[]).map(function(x){return x.disposition}).filter(Boolean))];s.innerHTML='<option value="">All Dispositions</option>'+vals.map(function(v){return '<option value="'+esc(v)+'">'+esc(v)+'</option>'}).join('')}catch(e){s.innerHTML='<option value="">All Dispositions</option>'}}
  async function load(){
    var body=$('crm1QABody');if(!body)return; body.innerHTML='<tr><td colspan="7" class="empty">Loading...</td></tr>';
    var from=$('crm1QAFrom')?.value||today(),to=$('crm1QATo')?.value||from;if(to<from){var z=from;from=to;to=z;$('crm1QAFrom').value=from;$('crm1QATo').value=to}
    try{
      var q=window.sb.from('qa_reviews').select('id,agent_id,reviewed_by,reviewer_id,order_id,score,remarks,created_at,disposition,reviewer_note,reviewed_at,profiles:agent_id(full_name),reviewer:reviewed_by(full_name),reviewer2:reviewer_id(full_name)').gte('created_at',from+'T00:00:00').lt('created_at',nextDay(to));
      var agent=$('crm1QAAgent')?.value||'',disp=$('crm1QADisp')?.value||'';if(agent)q=q.eq('agent_id',agent);if(disp)q=q.eq('disposition',disp);
      var r=await q.order('created_at',{ascending:false}).limit(1000);if(r.error)throw r.error;var rows=r.data||[];
      var scores=rows.map(function(x){return Number(x.score)}).filter(function(x){return Number.isFinite(x)});var avg=scores.length?scores.reduce(function(a,b){return a+b},0)/scores.length:0;
      var passed=rows.filter(function(x){return Number(x.score)>=80}).length,failed=rows.filter(function(x){return Number(x.score)<80}).length;
      $('crm1QAKpis').innerHTML='<div class="stat"><span>Reviews</span><b>'+rows.length+'</b></div><div class="stat"><span>Average Score</span><b>'+avg.toFixed(1)+'</b></div><div class="stat"><span>Pass</span><b>'+passed+'</b></div><div class="stat"><span>Fail</span><b>'+failed+'</b></div>';
      var map={}; rows.forEach(function(x){var id=x.agent_id||'unassigned',name=x.profiles?.full_name||'Unassigned';if(!map[id])map[id]={name:name,reviews:0,total:0,pass:0,fail:0};map[id].reviews++;var sc=Number(x.score);if(Number.isFinite(sc)){map[id].total+=sc;if(sc>=80)map[id].pass++;else map[id].fail++}});
      var agents=Object.keys(map).map(function(k){var x=map[k];return {name:x.name,reviews:x.reviews,avg:x.reviews&&x.total?x.total/x.reviews:0,pass:x.pass,fail:x.fail,passPct:x.reviews?x.pass/x.reviews*100:0}}).sort(function(a,b){return b.avg-a.avg||b.passPct-a.passPct||b.reviews-a.reviews});
      $('crm1QAAgentBody').innerHTML=agents.map(function(x,i){return '<tr><td><b>'+(i+1)+'</b></td><td><b>'+esc(x.name)+'</b></td><td>'+x.reviews+'</td><td>'+x.avg.toFixed(1)+'</td><td>'+x.pass+'</td><td>'+x.fail+'</td><td>'+x.passPct.toFixed(1)+'%</td></tr>'}).join('')||'<tr><td colspan="7" class="empty">No QA reviews for selected period</td></tr>';
      body.innerHTML=rows.map(function(x){var date=x.reviewed_at||x.created_at;return '<tr><td>'+esc(date?new Date(date).toLocaleString('en-IN'):'-')+'</td><td>'+esc(x.profiles?.full_name||'-')+'</td><td>'+(x.order_id?esc(String(x.order_id).slice(0,8)):'-')+'</td><td><b>'+esc(x.score??'-')+'</b></td><td>'+esc(x.disposition||'-')+'</td><td>'+esc(x.reviewer?.full_name||x.reviewer2?.full_name||'-')+'</td><td>'+esc(x.reviewer_note||x.remarks||'-')+'</td></tr>'}).join('')||'<tr><td colspan="7" class="empty">No QA reviews for selected period</td></tr>';
    }catch(e){body.innerHTML='<tr><td colspan="7" class="msg">QA report error: '+esc(e.message||e)+'</td></tr>';$('crm1QAAgentBody').innerHTML=''}
  }
  function installGuard(){var c=content();if(!c||!window.MutationObserver||guardInstalled)return;guardInstalled=true;var obs=new MutationObserver(function(){var p=page();if(!p||!p.classList.contains('active'))return;if($('crm1QADetailedRoot'))return;clearTimeout(timer);timer=setTimeout(function(){var pp=page();if(pp&&pp.classList.contains('active')&&!$('crm1QADetailedRoot'))build()},40)});obs.observe(c,{childList:true,subtree:true});c._crm1QAObserver=obs}
  function ensure(){var p=page();if(!p||!p.classList.contains('active'))return;installGuard();if(!$('crm1QADetailedRoot'))build()}
  function init(){if(started)return;started=true;var n=0,t=setInterval(function(){var p=page();if(p&&p.classList.contains('active')){ensure();clearInterval(t)}if(++n>120)clearInterval(t)},250);document.addEventListener('click',function(e){var b=e.target.closest('#nav button');if(b&&/^.*QA.*Dispositions/i.test(String(b.textContent||''))){setTimeout(ensure,0);setTimeout(ensure,100);setTimeout(ensure,500)}})}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
