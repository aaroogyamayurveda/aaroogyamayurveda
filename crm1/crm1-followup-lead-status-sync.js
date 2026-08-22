/* CRM1 Follow-up -> Lead status synchronizer. Keeps an active callback visible as followup in Today's Calling Queue. */
(()=>{
  'use strict';
  let timer=null, running=false;
  const db=()=>window.sb;
  const activeStatus=['pending','open','scheduled','followup'];
  async function sync(){
    if(running||!db())return;
    const user=(await db().auth.getUser()).data?.user;
    if(!user)return;
    running=true;
    try{
      const {data:leads,error:le=undefined}=await db().from('crm_leads')
        .select('id,customer_id,mobile,lead_status,assigned_to')
        .eq('assigned_to',user.id)
        .in('lead_status',['assigned','contacted','followup','qualified']);
      if(leads?.length){
        const customerIds=leads.map(x=>x.customer_id).filter(Boolean);
        const mobiles=leads.map(x=>String(x.mobile||'').replace(/\D/g,'')).filter(x=>x.length===10);
        let followups=[];
        if(customerIds.length){
          const r=await db().from('followups').select('id,customer_id,followup_at,status').in('customer_id',customerIds).in('status',activeStatus).gte('followup_at',new Date(Date.now()-86400000).toISOString()).limit(1000);
          if(!r.error)followups=followups.concat(r.data||[]);
        }
        // Also match by phone for leads that were created before customer/lead linkage was complete.
        if(mobiles.length){
          const r=await db().from('followups').select('id,customer_id,followup_at,status,customers(mobile)').in('status',activeStatus).gte('followup_at',new Date(Date.now()-86400000).toISOString()).limit(1000);
          if(!r.error){
            const set=new Set(mobiles);
            followups=followups.concat((r.data||[]).filter(x=>set.has(String(x.customers?.mobile||'').replace(/\D/g,''))));
          }
        }
        const byCustomer=new Set((followups||[]).map(x=>x.customer_id).filter(Boolean));
        const updates=[];
        for(const lead of leads){
          if(lead.customer_id && byCustomer.has(lead.customer_id) && lead.lead_status!=='followup')updates.push(lead.id);
        }
        // Phone fallback for leads without a customer_id match.
        if(mobiles.length){
          const activeMobiles=new Set((followups||[]).map(x=>String(x.customers?.mobile||'').replace(/\D/g,'')).filter(Boolean));
          for(const lead of leads){
            if(lead.lead_status==='followup')continue;
            const m=String(lead.mobile||'').replace(/\D/g,'');
            if(m&&activeMobiles.has(m)&&!updates.includes(lead.id))updates.push(lead.id);
          }
        }
        if(updates.length){
          const now=new Date().toISOString();
          await db().from('crm_leads').update({lead_status:'followup',updated_at:now}).in('id',updates);
          window.dispatchEvent(new CustomEvent('crm1FollowupLeadStatusSynced',{detail:{lead_ids:updates}}));
        }
      }
    }catch(e){console.warn('Follow-up lead status sync failed',e)}
    finally{running=false}
  }
  function schedule(ms=0){clearTimeout(timer);timer=setTimeout(sync,ms)}
  document.addEventListener('click',e=>{const b=e.target.closest('button');if(b&&/follow-ups|today.?s calling queue/i.test(b.textContent||''))schedule(120)},true);
  window.addEventListener('crm1DataChanged',()=>schedule(100));
  window.addEventListener('crm1DispositionConfirmed',()=>schedule(100));
  const boot=()=>schedule(250);
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
  setInterval(()=>schedule(0),15000);
})();
