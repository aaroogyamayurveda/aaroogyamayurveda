/* CRM1 Customer360 timeline cleanup: debounced, DOM-safe normalization only. */
(function(){
  'use strict';
  var started=false, running=false, timer=null, lastSignature='';
  function getMobile(){
    var inputs=document.querySelectorAll('input');
    for(var i=0;i<inputs.length;i++){
      var p=String(inputs[i].placeholder||'').toLowerCase();
      var v=String(inputs[i].value||'').replace(/\D/g,'');
      if(p.indexOf('10 digit mobile')>=0 && /^[6-9]\d{9}$/.test(v))return v;
    }
    return '';
  }
  function getTable(){
    var box=document.getElementById('crm1C360CompleteTimeline');
    return box&&box.querySelector('table');
  }
  function signature(table){
    if(!table||!table.tBodies[0])return '';
    return Array.prototype.map.call(table.tBodies[0].rows,function(r){
      return Array.prototype.map.call(r.cells,function(c){return String(c.textContent||'').trim()}).join('¦');
    }).join('¶');
  }
  function cleanTimeline(){
    var table=getTable();
    if(!table||!table.tBodies[0])return false;
    var rows=[].slice.call(table.tBodies[0].rows), changed=false, seen={};
    rows.forEach(function(row){
      var cells=row.cells;if(!cells||cells.length<5)return;
      var event=String(cells[1].textContent||'').trim();
      var status=String(cells[2].textContent||'').trim();
      var order=String(cells[3].textContent||'').trim();
      var dt=String(cells[0].textContent||'').trim();
      if(event==='Order Created' && status!=='new'){cells[2].textContent='new';changed=true;status='new';}
      var m=status.match(/^(.+)\s*→\s*(.+)$/); if(!m)return;
      var old=m[1].trim(),nxt=m[2].trim();
      var key=order+'|'+dt+'|'+nxt;
      if(!seen[key]){seen[key]={row:row,old:old};return;}
      var prior=seen[key];
      var priorSynthetic=(prior.old==='—'||prior.old==='-');
      var currentSynthetic=(old==='—'||old==='-');
      if(priorSynthetic&&!currentSynthetic){prior.row.remove();seen[key]={row:row,old:old};changed=true;}
      else if(!priorSynthetic&&currentSynthetic){row.remove();changed=true;}
      else{row.remove();changed=true;}
    });
    return changed;
  }
  async function fillOrderType(mobile){
    var table=getTable();if(!table||!window.sb||!mobile)return;
    var headers=[].slice.call((table.tHead&&table.tHead.rows&&table.tHead.rows[0]&&table.tHead.rows[0].cells)||[]);
    var typeIndex=headers.findIndex(function(h){return /order type/i.test(h.textContent||'')});
    if(typeIndex<0)return;
    var cr=await window.sb.from('customers').select('id').eq('mobile',mobile).maybeSingle();
    if(cr.error||!cr.data)return;
    var or=await window.sb.from('orders').select('id,order_no,order_type,order_priority').eq('customer_id',cr.data.id).order('created_at',{ascending:false});
    if(or.error)return;
    var types={};(or.data||[]).forEach(function(o){types['#'+o.order_no]=o.order_type||o.order_priority||'-'});
    var rows=[].slice.call(table.tBodies[0].rows), changed=false;
    rows.forEach(function(row){
      var order=String((row.cells[3]&&row.cells[3].textContent)||'').trim();
      if(order && typeIndex<row.cells.length && types[order] && row.cells[typeIndex].textContent!==types[order]){row.cells[typeIndex].textContent=types[order];changed=true;}
    });
    if(changed)lastSignature='';
  }
  async function run(){
    if(running)return;
    var table=getTable(),mobile=getMobile();
    if(!table||!mobile)return;
    var sig=signature(table);
    if(sig===lastSignature)return;
    running=true;
    try{
      cleanTimeline();
      await fillOrderType(mobile);
      var finalTable=getTable();
      if(finalTable)lastSignature=signature(finalTable);
    }finally{running=false;}
  }
  function schedule(){clearTimeout(timer);timer=setTimeout(run,180);}
  function start(){
    if(started)return;started=true;
    schedule();
    var mo=new MutationObserver(function(mutations){
      var relevant=false;
      for(var i=0;i<mutations.length;i++){
        var t=mutations[i].target;
        if(t && (t.id==='crm1C360CompleteTimeline' || (t.closest&&t.closest('#crm1C360CompleteTimeline')))){relevant=true;break;}
      }
      if(relevant)schedule();
    });
    mo.observe(document.body,{childList:true,subtree:true});
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
})();
