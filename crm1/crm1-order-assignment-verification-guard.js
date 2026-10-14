/* CRM1: Order Assignment must only show orders that have passed Verification. */
(()=>{
  'use strict';
  let timer=null, observer=null, running=false;
  const db=()=>window.sb;
  function findBody(){return document.getElementById('assignmentBody')||document.querySelector('[id$="assignmentBody"]');}
  function getVisibleOrderNumbers(body){
    const numbers=[];
    for(const row of [...body.querySelectorAll('tr')]){
      const cells=[...row.querySelectorAll('td')];
      if(cells.length<2)continue;
      // The Order column is cell 2; do not accidentally parse a mobile, PIN or amount.
      const text=String(cells[1].textContent||'');
      const match=text.match(/#\s*(\d+)/)||text.match(/^\s*(\d{1,8})\b/);
      if(match)numbers.push(String(match[1]));
    }
    return [...new Set(numbers)];
  }
  async function apply(){
    if(running||!db())return;
    const body=findBody();
    if(!body)return;
    const orderNumbers=getVisibleOrderNumbers(body);
    // Avoid a database request while the table is empty/loading or only has a placeholder.
    if(!orderNumbers.length)return;
    running=true;
    try{
      // Query only orders currently rendered in the Assignment table; never scan every verified order.
      const {data,error}=await db().from('orders')
        .select('order_no,verification_status')
        .in('order_no',orderNumbers);
      if(error)throw error;
      const verified=new Set((data||[])
        .filter(x=>String(x.verification_status||'').toLowerCase()==='verified')
        .map(x=>String(x.order_no)));
      for(const row of [...body.querySelectorAll('tr')]){
        const cells=[...row.querySelectorAll('td')];
        if(cells.length<2)continue;
        const text=String(cells[1].textContent||'');
        const match=text.match(/#\s*(\d+)/)||text.match(/^\s*(\d{1,8})\b/);
        if(match&&!verified.has(String(match[1])))row.remove();
      }
      const remaining=[...body.querySelectorAll('tr')].filter(r=>r.querySelectorAll('td').length>0);
      const hasReal=remaining.some(r=>!r.querySelector('td.empty'));
      if(!hasReal){
        body.innerHTML='<tr><td colspan="10" class="empty">No verified orders available for assignment.</td></tr>';
      }
    }catch(e){console.warn('Order Assignment verification guard failed',e)}
    finally{running=false}
  }
  function schedule(ms=80){clearTimeout(timer);timer=setTimeout(apply,ms)}
  document.addEventListener('click',e=>{
    const b=e.target.closest('button');
    if(b&&/order assignment/i.test(b.textContent||''))schedule(120);
  },true);
  window.addEventListener('crm1DataChanged',()=>schedule(80));
  function boot(){
    const body=findBody();
    if(body&&!observer){
      observer=new MutationObserver(()=>schedule(80));
      observer.observe(body,{childList:true,subtree:true});
    }
    schedule(100);
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
  // Low-frequency recovery in case the table body is replaced without a CRM event.
  setInterval(schedule,30000);
})();
