/* CRM1 Customer360 timeline cleanup: normalizes duplicate status rows, creation status and order type. */
(function(){
  'use strict';
  var started=false;
  function getMobile(){
    var inputs=document.querySelectorAll('input');
    for(var i=0;i<inputs.length;i++){
      var p=String(inputs[i].placeholder||'').toLowerCase();
      var v=String(inputs[i].value||'').replace(/\D/g,'');
      if(p.indexOf('10 digit mobile')>=0 && /^[6-9]\d{9}$/.test(v))return v;
    }
    return '';
  }
  function cleanTimeline(){
    var box=document.getElementById('crm1C360CompleteTimeline');
    if(!box)return false;
    var table=box.querySelector('table');
    if(!table||!table.tBodies[0])return false;
    var rows=[].slice.call(table.tBodies[0].rows);
    var seen={};
    rows.forEach(function(row){
      var cells=row.cells;if(!cells||cells.length<5)return;
      var event=String(cells[1].textContent||'').trim();
      var status=String(cells[2].textContent||'').trim();
      var order=String(cells[3].textContent||'').trim();
      var dt=String(cells[0].textContent||'').trim();
      /* Creation event must always show the initial order status, never the current status. */
      if(event==='Order Created') cells[2].textContent='new';
      var m=status.match(/^(.+)\s*→\s*(.+)$/);
      if(!m)return;
      var old=m[1].trim(),nxt=m[2].trim();
      var key=order+'|'+dt+'|'+nxt;
      if(!seen[key]){seen[key]={row:row,old:old};return;}
      var prior=seen[key];
      var priorSynthetic=(prior.old==='—'||prior.old==='-');
      var currentSynthetic=(old==='—'||old==='-');
      /* Keep the real old->new transition and remove only its synthetic duplicate. */
      if(priorSynthetic&&!currentSynthetic){prior.row.remove();seen[key]={row:row,old:old};}
      else if(!priorSynthetic&&currentSynthetic){row.remove();}
      else{row.remove();}
    });
    return true;
  }
  async function fillOrderType(){
    var mobile=getMobile();if(!mobile||!window.sb)return;
    var box=document.getElementById('crm1C360CompleteTimeline');if(!box)return;
    var table=box.querySelector('table');if(!table||!table.tBodies[0])return;
    var headers=[].slice.call((table.tHead&&table.tHead.rows&&table.tHead.rows[0]&&table.tHead.rows[0].cells)||[]);
    var typeIndex=headers.findIndex(function(h){return /order type/i.test(h.textContent||'')});
    var cr=await window.sb.from('customers').select('id').eq('mobile',mobile).maybeSingle();
    if(cr.error||!cr.data)return;
    var or=await window.sb.from('orders').select('id,order_no,order_type,order_priority').eq('customer_id',cr.data.id).order('created_at',{ascending:false});
    if(or.error)return;
    var types={};(or.data||[]).forEach(function(o){types['#'+o.order_no]=o.order_type||o.order_priority||'-'});
    [].slice.call(table.tBodies[0].rows).forEach(function(row){
      var order=String(row.cells[3]&&row.cells[3].textContent||'').trim();
      if(typeIndex>=0 && types[order]) row.cells[typeIndex].textContent=types[order];
    });
  }
  function run(){
    if(cleanTimeline())fillOrderType().catch(function(){});
  }
  function start(){
    if(started)return;started=true;
    var tries=0,t=setInterval(function(){if(getMobile())run();if(++tries>180)clearInterval(t)},500);
    var mo=new MutationObserver(function(){if(getMobile())run()});
    mo.observe(document.body,{childList:true,subtree:true});
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
})();
