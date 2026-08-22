/* CRM1 follow-up customer context: always reconcile follow-up/customer with the originating lead. */
(()=>{'use strict';
  const repair=async detail=>{
    const db=window.sb;if(!db)return;
    try{
      let lead=null;
      if(detail?.lead_id){
        const r=await db.from('crm_leads').select('id,lead_name,mobile,customer_id').eq('id',detail.lead_id).maybeSingle();
        lead=r.data||null;
      }
      if(!lead && detail?.customer_id){
        const r=await db.from('crm_leads').select('id,lead_name,mobile,customer_id').eq('customer_id',detail.customer_id).order('updated_at',{ascending:false}).limit(1).maybeSingle();
        lead=r.data||null;
      }
      const mobile=String(detail?.mobile||lead?.mobile||'').replace(/\\D/g,'').slice(-10);
      if(!lead && mobile){
        const r=await db.from('crm_leads').select('id,lead_name,mobile,customer_id').eq('mobile',mobile).order('updated_at',{ascending:false}).limit(1).maybeSingle();
        lead=r.data||null;
      }
      if(!lead)return;
      let customerId=lead.customer_id||detail?.customer_id||null;
      if(!customerId && mobile){
        const c=await db.from('customers').select('id,customer_name,mobile').eq('mobile',mobile).limit(1).maybeSingle();
        customerId=c.data?.id||null;
      }
      if(!customerId && mobile && lead.lead_name){
        const c=await db.from('customers').insert({customer_name:lead.lead_name,mobile}).select('id').single();
        customerId=c.data?.id||null;
      }
      if(!customerId)return;
      if(lead.customer_id!==customerId)await db.from('crm_leads').update({customer_id:customerId}).eq('id',lead.id);
      if(lead.lead_name)await db.from('customers').update({customer_name:lead.lead_name,mobile:mobile||null}).eq('id',customerId);
      if(detail?.follow_up){
        const target=new Date(detail.follow_up).toISOString();
        const q=await db.from('followups').select('id').eq('assigned_to',detail?.assigned_to||detail?.agent_id||null).eq('followup_at',target).in('status',['pending','open','scheduled','followup']).order('created_at',{ascending:false}).limit(5);
        if(q.data?.length){
          const row=q.data[0];
          await db.from('followups').update({customer_id:customerId}).eq('id',row.id);
        }else{
          const q2=await db.from('followups').select('id').eq('customer_id',detail?.customer_id||'00000000-0000-0000-0000-000000000000').eq('followup_at',target).in('status',['pending','open','scheduled','followup']).order('created_at',{ascending:false}).limit(5);
          if(q2.data?.length)await db.from('followups').update({customer_id:customerId}).eq('id',q2.data[0].id);
        }
      }
      window.crm1CleanFollowups?.();
    }catch(e){console.warn('Follow-up customer reconciliation failed',e)}
  };
  window.addEventListener('crm1DispositionConfirmed',e=>repair(e.detail||{}));
  window.addEventListener('crm1DataChanged',e=>{if(e.detail?.follow_up)repair(e.detail)});
  const boot=async()=>{
    const db=window.sb;if(!db)return;
    try{
      const r=await db.from('crm_leads').select('id,lead_name,mobile,customer_id').is('customer_id',null).not('lead_name','is',null).limit(500);
      for(const l of (r.data||[])){
        if(!l.mobile)continue;
        const c=await db.from('customers').select('id').eq('mobile',l.mobile).limit(1).maybeSingle();
        if(c.data?.id){await db.from('crm_leads').update({customer_id:c.data.id}).eq('id',l.id);await db.from('customers').update({customer_name:l.lead_name,mobile:l.mobile}).eq('id',c.data.id);}
      }
    }catch(e){console.warn('Lead/customer reconciliation preload failed',e)}
  };
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
