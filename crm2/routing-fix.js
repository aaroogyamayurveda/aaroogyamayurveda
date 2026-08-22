/* CRM2 routing fix: CRM1 lives at /crm1/, not legacy /crm/. */
(function(){
  'use strict';
  function apply(){
    try{
      const existing=[...document.querySelectorAll('a')].find(a=>/Existing CRM/i.test(a.textContent||''));
      if(existing) existing.href='../crm1/';
    }catch{}
    window.openLead=async function(id){
      try{
        const {data,error}=await sb.from('leads').select('id,mobile,customer_name,product_name,address,city,state,pincode,lead_status').eq('id',id).single();
        if(error) throw error;
        const now=new Date().toISOString();
        const {error:ue}=await sb.from('leads').update({lead_status:'worked',worked_at:now,updated_at:now}).eq('id',id);
        if(ue) throw ue;
        sessionStorage.setItem('crm2_active_lead',id);
        sessionStorage.setItem('crm2_active_lead_data',JSON.stringify(data));
        window.location.href='../crm1/?crm2_lead='+encodeURIComponent(id);
      }catch(e){
        alert('Lead open failed: '+(e.message||e));
      }
    };
  }
  setTimeout(apply,0);
  setTimeout(apply,250);
  setTimeout(apply,1000);
})();
