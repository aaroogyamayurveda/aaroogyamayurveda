/* CRM2 path compatibility: the latest stable CRM1 is /crm1/; /crm/ is the legacy archive. */
(function(){
  'use strict';
  const CRM1='../crm1/';
  function fixLink(){
    document.querySelectorAll('a[href="../crm/"],a[href="/crm/"],a[href="https://aaroogyamayurveda.in/crm/"]').forEach(a=>{a.href=CRM1;});
  }
  function installOpenLead(){
    if(typeof window.openLead!=='function') return;
    const original=window.openLead;
    window.openLead=async function(id){
      /* Prefer the CRM2 lead-aware implementation when available; otherwise fall back to the existing handler. */
      try{
        if(window.sb && id){
          const {data,error}=await sb.from('leads').select('id,mobile,customer_name,product_name,address,city,state,pincode,lead_status').eq('id',id).single();
          if(!error && data){
            const now=new Date().toISOString();
            await sb.from('leads').update({lead_status:'worked',worked_at:now,updated_at:now}).eq('id',id);
            sessionStorage.setItem('crm2_active_lead',id);
            sessionStorage.setItem('crm2_active_lead_data',JSON.stringify(data));
            window.location.href=CRM1+'?crm2_lead='+encodeURIComponent(id);
            return;
          }
        }
      }catch(e){ console.warn('CRM2 path/context bridge fallback:',e); }
      return original(id);
    };
  }
  function run(){
    fixLink();
    installOpenLead();
  }
  document.addEventListener('DOMContentLoaded',run);
  setTimeout(run,100);
  setTimeout(run,500);
  setTimeout(run,1200);
})();
