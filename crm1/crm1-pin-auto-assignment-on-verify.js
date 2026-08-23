/* CRM1 PIN Auto Assignment: verified order -> active PIN rule -> priority-based dealer/courier assignment. */
(function(){
  'use strict';
  let running=false;
  const db=()=>window.sb;
  async function assignOrder(orderId){
    if(!db()||!orderId||running)return {ok:false,reason:'busy'};
    running=true;
    try{
      const {data:o,error:oe}=await db().from('orders').select('id,order_no,order_status,verification_status,dealer_id,courier_manager_id,customers(pincode)').eq('id',orderId).maybeSingle();
      if(oe)throw oe;
      if(!o)return {ok:false,reason:'order_not_found'};
      if(String(o.verification_status||'').toLowerCase()!=='verified')return {ok:false,reason:'not_verified'};
      if(o.dealer_id||o.courier_manager_id)return {ok:false,reason:'already_assigned'};
      const pin=String(o.customers?.pincode||'').trim();
      if(!/^\d{6}$/.test(pin))return {ok:false,reason:'invalid_pin'};
      const {data:rules,error:re}=await db().from('pin_assignment_rules').select('id,pincode,partner_id,priority,is_active,created_at').eq('pincode',pin).eq('is_active',true).order('priority',{ascending:true}).order('created_at',{ascending:true});
      if(re)throw re;
      if(!rules?.length)return {ok:false,reason:'no_active_rule'};
      for(const rule of rules){
        const {data:p,error:pe}=await db().from('profiles').select('id,full_name,role,is_active').eq('id',rule.partner_id).maybeSingle();
        if(pe)throw pe;
        if(!p||!p.is_active)continue;
        if(p.role==='dealer'){
          const {data:d,error:de}=await db().from('dealers').select('id,dealer_name,user_id,is_active').eq('user_id',p.id).eq('is_active',true).maybeSingle();
          if(de)throw de;
          if(!d)continue;
          const {error:ue}=await db().from('orders').update({dealer_id:d.id,courier_manager_id:null,order_status:'assigned'}).eq('id',o.id);
          if(ue)throw ue;
          await db().from('order_status_history').insert({order_id:o.id,new_status:'assigned',changed_by:null});
          window.dispatchEvent(new CustomEvent('crm1DataChanged'));
          return {ok:true,orderNo:o.order_no,partner:p.full_name,type:'dealer',pin,priority:rule.priority};
        }
        if(p.role==='courier_manager'){
          const {error:ue}=await db().from('orders').update({dealer_id:null,courier_manager_id:p.id,order_status:'assigned'}).eq('id',o.id);
          if(ue)throw ue;
          await db().from('order_status_history').insert({order_id:o.id,new_status:'assigned',changed_by:null});
          window.dispatchEvent(new CustomEvent('crm1DataChanged'));
          return {ok:true,orderNo:o.order_no,partner:p.full_name,type:'courier',pin,priority:rule.priority};
        }
      }
      return {ok:false,reason:'rule_partner_unavailable'};
    }catch(e){
      console.warn('CRM1 PIN auto assignment failed',e);
      return {ok:false,reason:'error',error:e};
    }finally{running=false;}
  }
  window.crm1AutoAssignVerifiedOrder=assignOrder;
  document.addEventListener('click',e=>{
    const b=e.target.closest('.crm1VerifyFix[data-v="verified"]');
    if(!b)return;
    const id=b.dataset.id;
    setTimeout(async()=>{
      const r=await assignOrder(id);
      if(r.ok){
        console.log(`CRM1 PIN auto-assigned Order #${r.orderNo} to ${r.partner} (${r.type}), PIN ${r.pin}, priority ${r.priority}`);
      }
    },450);
  },true);
  async function repairExistingVerified(){
    try{
      const {data,error}=await db().from('orders').select('id').eq('verification_status','verified').is('dealer_id',null).is('courier_manager_id',null).limit(500);
      if(error)throw error;
      for(const o of (data||[]))await assignOrder(o.id);
    }catch(e){console.warn('CRM1 PIN auto assignment repair scan failed',e)}
  }
  function boot(){setTimeout(repairExistingVerified,700)}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
