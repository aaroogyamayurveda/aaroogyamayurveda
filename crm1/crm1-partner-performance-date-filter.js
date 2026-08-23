/* CRM1 partner performance date-range enhancement. */
(function(){
  'use strict';
  var started=false;
  function pad(n){return String(n).padStart(2,'0')}
  function today(){var d=new Date();return d.getFullYear()+'-'+pad(d.getMonth()+1)+'-'+pad(d.getDate())}
  function toISOEnd(v){var d=new Date(v+'T00:00:00');d.setDate(d.getDate()+1);return d.getFullYear()+'-'+pad(d.getMonth()+1)+'-'+pad(d.getDate())}
  function esc(v){return String(v==null?'':v).replace(/[&<>\"']/g,function(m){return {'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',"'":'&#039;'}[m]})}
  function run(){
    var page=document.getElementById('partnerPerformance'),c=document.getElementById('partnerPerformanceContent');
    if(!page||!c||page.classList.contains('active')===false)return;
    var box=c.querySelector('.crm1PartnerDateFilter');
    if(box)return;
    var toolbar=c.querySelector('.crm1-toolbar');
    if(!toolbar)return;
    box=document.createElement('div');box.className='crm1PartnerDateFilter crm1-toolbar';
    box.innerHTML='<label>From <input type="date" id="crm1PPFrom" value="'+esc(today())+'"></label><label>To <input type="date" id="crm1PPTo" value="'+esc(today())+'"></label><button class="btn" id="crm1PPApply">Apply</button><button class="btn alt" id="crm1PPToday">Today</button><span class="sub">Filter partner metrics by order date.</span>';
    c.insertBefore(box,toolbar);
    function apply(){
      var from=document.getElementById('crm1PPFrom').value||today();
      var to=document.getElementById('crm1PPTo').value||from;
      if(to<from){var t=from;from=to;to=t;document.getElementById('crm1PPFrom').value=from;document.getElementById('crm1PPTo').value=to;}
      /* Re-render partner report through a scoped override of the underlying loader. */
      if(typeof window.__crm1RenderPartnerBase!=='function')return;
      window.__crm1RenderPartnerBase(from,to);
    }
    document.getElementById('crm1PPApply').onclick=apply;
    document.getElementById('crm1PPToday').onclick=function(){var t=today();document.getElementById('crm1PPFrom').value=t;document.getElementById('crm1PPTo').value=t;apply()};
  }
  function start(){
    if(started)return;started=true;
    var t=setInterval(function(){run();if(document.getElementById('partnerPerformance')?.classList.contains('active'))clearInterval(t)},500);
    document.addEventListener('click',function(e){if(e.target.closest('#nav button'))setTimeout(run,300)});
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
})();
