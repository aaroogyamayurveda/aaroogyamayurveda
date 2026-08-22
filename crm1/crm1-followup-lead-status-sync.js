/* CRM1 calling lead state synchronizer: active callbacks stay followup; any created order converts the lead and closes callbacks. */
(()=>{
'use strict';
let timer=null,running=false;
const db=()=>window.sb;
const activeStatus=['pending','open','scheduled','followup'];
async function sync(){
 if(running||!db())return;
 const user=(await db().auth.getUser()).data?.user;if(!user)return;
 running=true;
 try{
  const rLeads=await db().from('crm_leads').select('id,customer_id,mobile,lead_status,assigned_to,next_followup_at,conversion_order_id').eq('assigned_to',user.id).in('lead_status',['assigned','contacted','followup','qualified']);
  if(rLeads.error)throw rLeads.error;
  const leads=rLeads.data||[];
  if(!leads.length)return;
  const customerIds=leads.map(x=>x.customer_id).filter(Boolean);
  const mobiles=leads.map(x=>String(x.mobile||'').replace(/\D/g,'')).filter(x=>x.length===10);

  // Any order created for this lead's customer is the final conversion signal.
  const orderByCustomer=new Map();
  if(customerIds.length){
   const r=await db().from('orders').select('id,customer_id,created_at').in('customer_id',customerIds).order('created_at',{ascending:false}).limit(1000);
   if(!r.error)for(const o of (r.data||[]))if(!orderByCustomer.has(o.customer_id))orderByCustomer.set(o.customer_id,o);
  }

  const orderCustomerIds=[...orderByCustomer.keys()];
  const converted=[];
  for(const lead of leads){
   const o=lead.customer_id?orderByCustomer.get(lead.customer_id):null;
   if(o){
    const u=await db().from('crm_leads').update({lead_status:'converted',conversion_order_id:o.id,next_followup_at:null,last_contact_at:new Date().toISOString(),updated_at:new Date().toISOString()}).eq('id',lead.id);
    if(!u.error){
     await db().from('followups').update({status:'completed'}).eq('customer_id',lead.customer_id).in('status',activeStatus);
     converted.push(lead.id);
    }
   }
  }

  // Active callback synchronization for leads that are not yet converted.
  const remaining=leads.filter(x=>!converted.includes(x.id));
  if(!remaining.length){
   if(converted.length)window.dispatchEvent(new CustomEvent('crm1DataChanged',{detail:{type:'order_lead_finalized',lead_ids:converted}}));
   return;
  }
  const ids=remaining.map(x=>x.customer_id).filter(Boolean);
  let followups=[];
  if(ids.length){
   const r=await db().from('followups').select('id,customer_id,followup_at,status').in('customer_id',ids).in('status',activeStatus).gte('followup_at',new Date(Date.now()-86400000).toISOString()).order('followup_at',{ascending:true}).limit(1000);
   if(!r.error)followups=followups.concat(r.data||[]);
  }
  if(mobiles.length){
   const r=await db().from('followups').select('id,customer_id,followup_at,status,customers(mobile)').in('status',activeStatus).gte('followup_at',new Date(Date.now()-86400000).toISOString()).order('followup_at',{ascending:true}).limit(1000);
   if(!r.error){
    const set=new Set(mobiles);
    followups=followups.concat((r.data||[]).filter(x=>set.has(String(x.customers?.mobile||'').replace(/\D/g,''))));
   }
  }
  const byCustomer=new Map();
  for(const f of followups)if(f.customer_id&&!byCustomer.has(f.customer_id))byCustomer.set(f.customer_id,f.followup_at);
  const activeMobiles=new Map();
  for(const f of followups){const m=String(f.customers?.mobile||'').replace(/\D/g,'');if(m&&!activeMobiles.has(m))activeMobiles.set(m,f.followup_at)}
  const fixes=[];
  for(const lead of remaining){
   const m=String(lead.mobile||'').replace(/\D/g,'');
   const fu=(lead.customer_id&&byCustomer.get(lead.customer_id))||activeMobiles.get(m);
   if(fu&&lead.lead_status!=='followup')fixes.push({id:lead.id,followup_at:fu});
   else if(fu&&lead.lead_status==='followup'&&lead.next_followup_at!==fu)fixes.push({id:lead.id,followup_at:fu});
  }
  for(const fix of fixes){
   const now=new Date().toISOString();
   const u=await db().from('crm_leads').update({lead_status:'followup',next_followup_at:fix.followup_at,updated_at:now}).eq('id',fix.id);
   if(u.error)throw u.error;
  }
  if(converted.length||fixes.length)window.dispatchEvent(new CustomEvent('crm1DataChanged',{detail:{type:converted.length?'order_lead_finalized':'followup_status_sync',lead_ids:[...converted,...fixes.map(x=>x.id)]}}));
 }catch(e){console.warn('Calling lead state sync failed',e)}finally{running=false}
}
function schedule(ms=0){clearTimeout(timer);timer=setTimeout(sync,ms)}
document.addEventListener('click',e=>{const b=e.target.closest('button');if(b&&/follow-ups|today.?s calling queue|verification queue|order search/i.test(b.textContent||''))schedule(120)},true);
window.addEventListener('crm1DataChanged',e=>{if(e?.detail?.type!=='order_lead_finalized')schedule(100)});
window.addEventListener('crm1DispositionConfirmed',()=>schedule(100));
const boot=()=>schedule(250);
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
setInterval(()=>schedule(0),10000);
})();
