/* CRM1: Order Assignment must only show orders that have passed Verification. */
(()=>{
  'use strict';
  let timer=null, observer=null, running=false;
  const db=()=>window.sb;
  function findBody(){return document.getElementById('assignmentBody')||document.querySelector('[id$="assignmentBody"]');}
  async function apply(){
    if(running||!db())return;
    const body=findBody();
    if(!body)return;
    running=true;
    try{
      const {data,error}=await db().from('orders').select('order_no,verification_status').in('verification_status',['verified']);
      if(error)throw error;
      const verified=new Set((data||[]).map(x=>String(x.order_no)));
      let changed=false;
      for(const row of [...body.querySelectorAll('tr')]){
        const cells=[...row.querySelectorAll('td')];
        if(!cells.length)continue;
        const text=cells.map(c=>String(c.textContent||'')).join(' | ');
        const match=text.match(/#\s*(\d+)/)||text.match(/\b(\d{1,8})\b/);
        if(match && !verified.has(String(match[1]))){row.remove();changed=true;}
      }
      const rows=[...body.querySelectorAll('tr')].filter(r=>r.querySelectorAll('td').length>0);
      const hasReal=rows.some(r=>!r.querySelector('td.empty'));
      if(!hasReal){
        body.innerHTML='<tr><td colspan="10" class="empty">No verified orders available for assignment.</td></tr>';
      }else if(changed){
        // Keep the assignment table limited to verified orders after every renderer refresh.
      }
    }catch(e){console.warn('Order Assignment verification guard failed',e)}
    finally{running=false}
  }
  function schedule(ms=80){clearTimeout(timer);timer=setTimeout(apply,ms)}
  document.addEventListener('click',e=>{const b=e.target.closest('button');if(b&&/order assignment/i.test(b.textContent||''))schedule(120)},true);
  window.addEventListener('crm1DataChanged',()=>schedule(80));
  function boot(){
    const body=findBody();
    if(body&&!observer){observer=new MutationObserver(()=>schedule(40));observer.observe(body,{childList:true,subtree:true});}
    schedule(100);
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
  setInterval(schedule,5000);
})();
