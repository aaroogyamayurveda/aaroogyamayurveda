/* CRM1 QA report runtime fix: explicit IST date window and direct rendering. */
(function(){
  'use strict';
  var started=false,timer=null;
  var $=function(id){return document.getElementById(id)};
  var esc=function(v){return String(v==null?'':v).replace(/[&<>\"']/g,function(m){return{'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',"'":'&#039;'}[m]})};
  function page(){return $('qa')}
  function active(){var p=page();return p&&p.classList.contains('active')}
  function istDate(v){return new Date(String(v)+'T00:00:00+05:30')}
  function dayStart(v){return istDate(v).toISOString()}
  function dayEnd(v){var d=istDate(v);d.setDate(d.getDate()+1);return d.toISOString()}
  async function loadReport(){
    if(!active()||!$('crm1QABody'))return;
    var body=$('crm1QABody');
    var from=$('crm1QAFrom')?.value||new Date().toLocaleDateString('en-CA',{timeZone:'Asia/Kolkata'});
    var to=$('crm1QATo')?.value||from;
    if(to<from){var z=from;from=to;to=z;$('crm1QAFrom').value=from;$('crm1QATo').value=to}
    body.innerHTML='<tr><td colspan="7" class="empty">Loading...</td></tr>';
    try{
      var q=window.sb.from('qa_reviews').select('id,agent_id,reviewed_by,order_id,score,remarks,created_at,disposition,reviewer_note,reviewed_at,profiles:agent_id(full_name),reviewer:reviewed_by(full_name)').gte('created_at',dayStart(from)).lt('created_at',dayEnd(to)).order('created_at',{ascending:false}).limit(1000);
      var agent=$('crm1QAAgent')?.value||'',disp=$('crm1QADisp')?.value||'';if(agent)q=q.eq('agent_id',agent);if(disp)q=q.eq('disposition',disp);
      var r=await q;if(r.error)throw r.error;var rows=r.data||[];
      var scores=rows.map(function(x){return Number(x.score)}).filter(Number.isFinite),avg=scores.length?scores.reduce(function(a,b){return a+b},0)/scores.length:0;
      var pass=rows.filter(x=>Number(x.score)>=80).length,fail=rows.filter(x=>Number(x.score)<80).length;
      $('crm1QAKpis').innerHTML='<div class="stat"><span>Reviews</span><b>'+rows.length+'</b></div><div class="stat"><span>Average Score</span><b>'+avg.toFixed(1)+'</b></div><div class="stat"><span>Pass</span><b>'+pass+'</b></div><div class="stat"><span>Fail</span><b>'+fail+'</b></div>';
      var map={};rows.forEach(function(x){var k=x.agent_id||'unassigned',n=x.profiles?.full_name||'Unassigned';if(!map[k])map[k]={name:n,reviews:0,total:0,pass:0,fail:0};map[k].reviews++;var s=Number(x.score);if(Number.isFinite(s)){map[k].total+=s;if(s>=80)map[k].pass++;else map[k].fail++}});
      var agents=Object.values(map).map(function(x){return {name:x.name,reviews:x.reviews,avg:x.reviews?x.total/x.reviews:0,pass:x.pass,fail:x.fail,pct:x.reviews?x.pass/x.reviews*100:0}}).sort(function(a,b){return b.avg-a.avg||b.pct-a.pct||b.reviews-a.reviews});
      $('crm1QAAgentBody').innerHTML=agents.map(function(x,i){return '<tr><td><b>'+(i+1)+'</b></td><td><b>'+esc(x.name)+'</b></td><td>'+x.reviews+'</td><td>'+x.avg.toFixed(1)+'</td><td>'+x.pass+'</td><td>'+x.fail+'</td><td>'+x.pct.toFixed(1)+'%</td></tr>'}).join('')||'<tr><td colspan="7" class="empty">No QA reviews for selected period</td></tr>';
      body.innerHTML=rows.map(function(x){var dt=x.reviewed_at||x.created_at;return '<tr><td>'+esc(dt?new Intl.DateTimeFormat('en-IN',{timeZone:'Asia/Kolkata',dateStyle:'medium',timeStyle:'short'}).format(new Date(dt)):'-')+'</td><td>'+esc(x.profiles?.full_name||'-')+'</td><td>'+(x.order_id?esc('#'+String(x.order_id).slice(0,8)):'-')+'</td><td><b>'+esc(x.score??'-')+'</b></td><td>'+esc(x.disposition||'-')+'</td><td>'+esc(x.reviewer?.full_name||'-')+'</td><td>'+esc(x.reviewer_note||x.remarks||'-')+'</td></tr>'}).join('')||'<tr><td colspan="7" class="empty">No QA reviews for selected period</td></tr>';
    }catch(e){body.innerHTML='<tr><td colspan="7" class="msg">QA report error: '+esc(e.message||e)+'</td></tr>';$('crm1QAAgentBody').innerHTML=''}
  }
  function bind(){
    if(started)return;started=true;
    document.addEventListener('click',function(e){var b=e.target.closest('#nav button');if(b&&/QA.*Dispositions/i.test(b.textContent||'')){setTimeout(loadReport,400);setTimeout(loadReport,1000)}if(e.target.closest('#crm1QAApply,#crm1QAToday'))setTimeout(loadReport,50);},true);
    var obs=new MutationObserver(function(){if(active()&&$('crm1QABody')&&!$('crm1QABody').dataset.qaFix){$('crm1QABody').dataset.qaFix='1';clearTimeout(timer);timer=setTimeout(loadReport,150)}});obs.observe(document.body,{subtree:true,childList:true});
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',bind,{once:true});else bind();window.crm1QAReportFix=loadReport;
})();
