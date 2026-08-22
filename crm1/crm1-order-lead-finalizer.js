/* CRM1: whenever an order exists for a calling lead's customer, finalize that lead as converted and close active callbacks. */
(()=>{
'use strict';
let running=false,timer=null;
const db=()=>window.sb;
async function sync(){
 if(running||!db())return;
 const user=(await db().auth.getUser()).data?.user;if(!user)return;
 running=true;
 try{
  const lr=await db().from('crm_leads').select('id,customer_id,mobile,assigned_to,lead_status,conversion_order_id').eq('assigned_to',user.id).in('lead_status',['assigned','contacted','followup','qualified']);
  if(lr.error)throw lr.error;
  for(const lead of (lr.data||[])){
   let q=db().from('orders').select('id,created_at,customer_id').eq('customer_id',lead.customer_id).order('created_at',{ascending:false}).limit(1);
   const r=await q.maybeSingle();
   if(r.error||!r.data)continue;
   const order=r.data;
   const u=await db().from('crm_leads').update({lead_status:'converted',conversion_order_id:order.id,next_followup_at:null,last_contact_at:new Date().toISOString(),updated_at:new Date().toISOString()}).eq('id',lead.id);
   if(u.error)continue;
   await db().from('followups').update({status:'completed'}).eq('customer_id',lead.customer_id).in('status',['pending','open','scheduled','followup']);
  }
  window.dispatchEvent(new CustomEvent('crm1DataChanged',{detail:{type:'order_lead_finalized'}}));
 }catch(e){console.warn('Order lead finalizer failed',e)}finally{running=false}
}
function schedule(ms=0){clearTimeout(timer);timer=setTimeout(sync,ms)}
window.addEventListener('crm1DataChanged',()=>schedule(150));
window.addEventListener('crm1DispositionConfirmed',()=>schedule(150));
document.addEventListener('click',e=>{const b=e.target.closest('button');if(b&&/today.?s calling queue|verification queue|order search/i.test(b.textContent||''))schedule(150)},true);
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>schedule(500),{once:true});else schedule(500);
setInterval(()=>schedule(0),10000);
})();
