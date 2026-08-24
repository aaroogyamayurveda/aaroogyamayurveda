/* CRM1 Verification Queue final interaction guard.
   Keeps Verify + Reject + Follow-up actions present even if another renderer
   replaces the table, without re-rendering the whole page and without timers.
*/
(function(){
  'use strict';
  if(window.__crm1VerificationFollowupFinal) return;
  window.__crm1VerificationFollowupFinal=true;

  var db=window.sb||null;
  var observer=null;
  var adding=false;

  function root(){ return document.getElementById('verificationContent'); }
  function active(){
    var p=document.getElementById('verification');
    return !!(p && p.classList.contains('active'));
  }
  function esc(v){
    return String(v==null?'':v).replace(/[&<>\"']/g,function(m){
      return {'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;'}[m];
    });
  }

  function openFollowup(orderId){
    if(!db) return;
    document.getElementById('crm1FinalFollowupModal')?.remove();
    var now=new Date(Date.now()+3600000); now.setSeconds(0,0);
    var modal=document.createElement('div');
    modal.id='crm1FinalFollowupModal';
    modal.style.cssText='position:fixed;inset:0;background:rgba(0,0,0,.45);z-index:99999;display:flex;align-items:center;justify-content:center;padding:16px';
    modal.innerHTML='<div style="background:#fff;width:min(430px,96vw);border-radius:14px;padding:22px;box-shadow:0 20px 50px rgba(0,0,0,.28)">'+
      '<div style="font-size:20px;font-weight:700;margin-bottom:6px">Schedule Follow-up</div>'+ 
      '<div style="font-size:13px;color:#6b7280;margin-bottom:18px">Select follow-up date, time and note.</div>'+ 
      '<label style="display:block;font-size:13px;font-weight:600;margin-bottom:6px">Date & Time</label>'+ 
      '<input id="crm1FinalFollowupDate" type="datetime-local" step="60" value="'+now.toISOString().slice(0,16)+'" style="width:100%;box-sizing:border-box;padding:10px;border:1px solid #cbd5e1;border-radius:8px;margin-bottom:14px">'+ 
      '<label style="display:block;font-size:13px;font-weight:600;margin-bottom:6px">Note</label>'+ 
      '<textarea id="crm1FinalFollowupNote" rows="3" style="width:100%;box-sizing:border-box;padding:10px;border:1px solid #cbd5e1;border-radius:8px">Customer follow-up</textarea>'+ 
      '<div style="display:flex;justify-content:flex-end;gap:8px;margin-top:16px">'+ 
      '<button id="crm1FinalFollowupCancel" type="button" class="btn alt">Cancel</button>'+ 
      '<button id="crm1FinalFollowupSave" type="button" class="btn">Schedule</button>'+ 
      '</div></div>';
    document.body.appendChild(modal);
    function close(){modal.remove();}
    document.getElementById('crm1FinalFollowupCancel').onclick=close;
    modal.onclick=function(e){if(e.target===modal)close();};
    document.getElementById('crm1FinalFollowupSave').onclick=async function(){
      var save=this;
      var dt=document.getElementById('crm1FinalFollowupDate').value;
      var note=(document.getElementById('crm1FinalFollowupNote').value||'').trim()||'Customer follow-up';
      if(!dt){alert('Please select follow-up date and time.');return;}
      save.disabled=true; save.textContent='Saving...';
      try{
        var r=await db.from('orders').select('customer_id').eq('id',orderId).maybeSingle();
        if(r.error||!r.data) throw new Error(r.error?.message||'Order not found');
        var iso=new Date(dt).toISOString();
        var ins=await db.from('followups').insert({
          order_id:orderId,
          customer_id:r.data.customer_id||null,
          assigned_to:(await db.auth.getUser()).data.user?.id||null,
          followup_at:iso,
          note:note,
          notes:note,
          status:'pending'
        });
        if(ins.error) throw ins.error;
        await db.from('orders').update({next_followup_at:iso}).eq('id',orderId);
        close();
        alert('Follow-up scheduled successfully.');
      }catch(e){
        alert(e?.message||String(e));
        save.disabled=false; save.textContent='Schedule';
      }
    };
  }

  function ensureButtons(){
    if(!active()||adding) return;
    var r=root(); if(!r) return;
    var rows=r.querySelectorAll('tbody tr');
    if(!rows.length) return;
    adding=true;
    try{
      rows.forEach(function(row){
        var cells=row.querySelectorAll('td');
        if(!cells.length) return;
        var verify=row.querySelector('button.crm1VerifyFix[data-id]');
        var reject=row.querySelector('button.crm1VerifyFix[data-v="failed"]');
        if(!verify && !reject) return;
        var action=cells[cells.length-1];
        if(!action) return;
        var existing=action.querySelector('.crm1FinalFollowupBtn');
        if(existing) return;
        var orderId=(verify||reject)?.getAttribute('data-id');
        if(!orderId) return;
        var b=document.createElement('button');
        b.type='button';
        b.className='crm1-mini crm1FinalFollowupBtn';
        b.setAttribute('data-id',orderId);
        b.textContent='Follow-up';
        b.style.marginLeft='4px';
        b.onclick=function(){openFollowup(orderId);};
        action.appendChild(b);
      });
    }finally{adding=false;}
  }

  function boot(){
    var r=root();
    if(!r) return;
    if(observer) return;
    observer=new MutationObserver(function(){
      if(!adding) ensureButtons();
    });
    observer.observe(r,{childList:true,subtree:true});
    ensureButtons();
  }

  document.addEventListener('click',function(e){
    var b=e.target.closest('button');
    if(!b) return;
    if(/verification queue/i.test(b.textContent||'')){
      setTimeout(boot,120);
    }
  },true);

  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',boot,{once:true});
  else boot();

  window.crm1EnsureVerificationFollowup=ensureButtons;
})();
