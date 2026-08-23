/* CRM1 Customer360 timeline cleanup: one-shot per rendered timeline, no MutationObserver. */
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
  function getBox(){return document.getElementById('crm1C360CompleteTimeline')||null;}
  function cleanTimeline(box){
    var table=box&&box.querySelector('table');
    if(!table||!table.tBodies[0])return;
    var rows=[].slice.call(table.tBodies[0].rows),seen={};
    rows.forEach(function(row){
      var cells=row.cells;if(!cells||cells.length<5)return;
      var event=String(cells[1].textContent||'').trim();
      var status=String(cells[2].textContent||'').trim();
      var order=String(cells[3].textContent||'').trim();
      var dt=String(cells[0].textContent||'').trim();
      if(event==='Order Created')cells[2].textContent='new';
      var m=status.match(/^(.+)\s*→\s*(.+)$/);if(!m)return;
      var old=m[1].trim(),nxt=m[2].trim();
      var key=order+'|'+dt+'|'+nxt;
      if(!seen[key]){seen[key]={row:row,old:old};return;}
      var prior=seen[key];
      var priorSynthetic=(prior.old==='—'||prior.old==='-');
      var currentSynthetic=(old==='—'||old==='-');
      if(priorSynthetic&&!currentSynthetic){prior.row.remove();seen[key]={row:row,old:old};}
      else if(!priorSynthetic&&currentSynthetic){row.remove();}
      else{row.remove();}
    });
  }
  async function fillOrderType(box,mobile){
    var table=box&&box.querySelector('table');if(!table||!window.sb||!mobile)return;
    var headers=[].slice.call((table.tHead&&table.tHead.rows&&table.tHead.rows[0]&&table.tHead.rows[0].cells)||[]);
    var typeIndex=headers.findIndex(function(h){return /order type/i.test(h.textContent||'')});
    if(typeIndex<0)return;
    try{
      var cr=await window.sb.from('customers').select('id').eq('mobile',mobile).maybeSingle();
      if(cr.error||!cr.data)return;
      var or=await window.sb.from('orders').select('id,order_no,order_type,order_priority').eq('customer_id',cr.data.id).order('created_at',{ascending:false});
      if(or.error)return;
      var types={};(or.data||[]).forEach(function(o){types['#'+o.order_no]=o.order_type||o.order_priority||'-'});
      [].slice.call(table.tBodies[0].rows).forEach(function(row){
        var order=String((row.cells[3]&&row.cells[3].textContent)||'').trim();
        if(typeIndex<row.cells.length&&types[order])row.cells[typeIndex].textContent=types[order];
      });
    }catch(e){console.warn('CRM1 Customer360 timeline order type cleanup skipped',e)}
  }
  async function process(){
    var mobile=getMobile(),box=getBox();
    if(!mobile||!box)return;
    if(box.dataset.crm1TimelineCleanedFor===mobile)return;
    var table=box.querySelector('table');
    if(!table||!table.tBodies[0])return;
    box.dataset.crm1TimelineCleanedFor=mobile;
    cleanTimeline(box);
    await fillOrderType(box,mobile);
  }
  function start(){
    if(started)return;started=true;
    var ticks=0;
    var timer=setInterval(function(){
      process().catch(function(){});
      if(++ticks>30)clearInterval(timer);
    },700);
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
})();
