/* CRM1 conversion finalizer: a Sales Order converts the source lead and closes its active callbacks. */
(()=>{
  'use strict';
  const db=()=>window.sb;
  let running=false;
  async function resolveLead(detail={}){
    const leadId=detail.lead_id||null;
    const customerId=detail.customer_id||detail.order?.customer_id||null;
    if(leadId){
      const r=await db().from('crm_leads').select('id,customer_id,mobile,lead_status').eq('id',leadId).maybeSingle();
      if(r.data)return r.data;
    }
    if(customerId){
      const r=await db().from('crm_leads').select('id,customer_id,mobile,lead_status').eq('customer_id',customerId).in('lead_status',['assigned','contacted','followup','qualified','converted']).order('updated_at',{ascending:false}).limit(1).maybeSingle();
      if(r.data)return r.data;
    }
    const mobile=String(detail.order?.mobile||'').replace(/\D/g,'');
    if(mobile){
      const r=await db().from('crm_leads').select('id,customer_id,mobile,lead_status').eq('mobile',mobile).in('lead_status',['assigned','contacted','followup','qualified','converted']).order('updated_at',{ascending:false}).limit(1).maybeSingle();
      if(r.data)return r.data;
    }
    return null;
  }
  async function finalize(detail={}){
    if(running||!db()||detail?.l1!=='sales'||!detail?.order?.id)return;
    running=true;
    try{
      const lead=await resolveLead(detail);
      const customerId=detail.customer_id||detail.order?.customer_id||lead?.customer_id||null;
      if(lead){
        await db().from('crm_leads').update({lead_status:'converted',customer_id:customerId||lead.customer_id,conversion_order_id:detail.order.id,next_followup_at:null,last_contact_at:new Date().toISOString(),updated_at:new Date().toISOString()}).eq('id',lead.id);
      }
      if(customerId){
        await db().from('followups').update({status:'completed'}).eq('customer_id',customerId).in('status',['pending','open','scheduled','followup']);
      }
      window.dispatchEvent(new CustomEvent('crm1DataChanged',{detail:{type:'conversion_finalized',lead_id:lead?.id||detail.lead_id||null,customer_id:customerId,order_id:detail.order.id}}));
    }catch(e){console.warn('CRM1 conversion finalizer failed',e)}
    finally{running=false}
  }
  window.addEventListener('crm1DispositionConfirmed',e=>finalize(e.detail||{}));
})();
