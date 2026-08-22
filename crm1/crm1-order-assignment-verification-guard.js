/* CRM1: Order Assignment must only show orders that have passed Verification. */
(()=>{
  'use strict';
  let timer=null, observer=null, running=false;
  const db=()=>window.sb;
  const pageActive=()=>document.getElementById('assignment')?.classList.contains('active');
  async function apply(){
    if(running||!pageActive()||!db())return;
    const body=document.getElementById('assignmentBody');
    if(!body)return;
    running=true;
    try{
      const {data,error}=await db().from('orders').select('order_no,verification_status').in('verification_status',['verified']);
      if(error)throw error;
      const verified=new Set((data||[]).map(x=>String(x.order_no)));
      for(const row of [...body.querySelectorAll('tr')]){
        const cells=row.querySelectorAll('td');
        if(!cells.length)continue;
        const raw=String(cells[0]?.textContent||'').replace(/\D/g,'');
        if(raw && !verified.has(raw)) row.remove();
      }
      const remaining=[...body.querySelectorAll('tr')].filter(r=>r.querySelectorAll('td').length>0).length;
      const empty=body.querySelector('tr td.empty');
      if(!remaining && !empty){
        body.innerHTML='<tr><td colspan="10" class="empty">No verified orders available for assignment.</td></tr>';
      }
    }catch(e){console.warn('Order Assignment verification guard failed',e)}
    finally{running=false}
  }
  function schedule(ms=120){clearTimeout(timer);timer=setTimeout(apply,ms)}
  document.addEventListener('click',e=>{const b=e.target.closest('button');if(b&&/order assignment/i.test(b.textContent||''))schedule(150)},true);
  window.addEventListener('crm1DataChanged',()=>schedule(150));
  const boot=()=>{
    const body=document.getElementById('assignmentBody');
    if(body&&!observer){observer=new MutationObserver(()=>{if(pageActive())schedule(50)});observer.observe(body,{childList:true,subtree:true});}
    if(pageActive())schedule(100);
  };
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
  setInterval(()=>{if(pageActive())schedule(0)},15000);
})();
