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
      const rLeads=await db().from('crm_leads').select('id,customer_id,mobile,lead_status,assigned_to,next_followup_at').eq('assigned_to',user.id).in('lead_status',['assigned','contacted','followup','qualified']);
      if(rLeads.error)throw rLeads.error;
      const leads=rLeads.data||[];
      if(!leads.length)return;
      const customerIds=leads.map(x=>x.customer_id).filter(Boolean);
      const mobiles=leads.map(x=>String(x.mobile||'').replace(/\D/g,'')).filter(x=>x.length===10);
      let followups=[];
      if(customerIds.length){
        const r=await db().from('followups').select('id,customer_id,followup_at,status').in('customer_id',customerIds).in('status',activeStatus).gte('followup_at',new Date(Date.now()-86400000).toISOString()).order('followup_at',{ascending:true}).limit(1000);
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
      for(const f of followups){if(f.customer_id&&!byCustomer.has(f.customer_id))byCustomer.set(f.customer_id,f.followup_at)}
      const activeMobiles=new Map();
      for(const f of followups){const m=String(f.customers?.mobile||'').replace(/\D/g,'');if(m&&!activeMobiles.has(m))activeMobiles.set(m,f.followup_at)}
      const fixes=[];
      for(const lead of leads){
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
      if(fixes.length){
        window.dispatchEvent(new CustomEvent('crm1FollowupLeadStatusSynced',{detail:{lead_ids:fixes.map(x=>x.id)}}));
        window.dispatchEvent(new CustomEvent('crm1DataChanged',{detail:{type:'followup_status_sync',lead_ids:fixes.map(x=>x.id)}}));
      }
    }catch(e){console.warn('Follow-up lead status sync failed',e)}
    finally{running=false}
  }
  function schedule(ms=0){clearTimeout(timer);timer=setTimeout(sync,ms)}
  document.addEventListener('click',e=>{const b=e.target.closest('button');if(b&&/follow-ups|today.?s calling queue/i.test(b.textContent||''))schedule(120)},true);
  window.addEventListener('crm1DataChanged',e=>{if(e?.detail?.type!=='followup_status_sync')schedule(100)});
  window.addEventListener('crm1DispositionConfirmed',()=>schedule(100));
  const boot=()=>schedule(250);
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
  setInterval(()=>schedule(0),15000);
})();
