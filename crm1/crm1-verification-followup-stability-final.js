/* CRM1 Verification Queue final interaction guard.
   Keeps exactly one Follow-up action present after any renderer replacement,
   without timers, attribute observers, mouse-move refreshes or full-page rerender.
*/
(function(){
  'use strict';
  if(window.__crm1VerificationFollowupFinalV2) return;
  window.__crm1VerificationFollowupFinalV2=true;

  var observer=null;
  var running=false;
  var idCache={};

  function page(){return document.getElementById('verification');}
  function root(){return document.getElementById('verificationContent');}
  function active(){var p=page();return !!(p&&p.classList.contains('active'));}

  function openFollowup(orderId){
    var db=window.sb||null;
    if(!db){alert('CRM session is not ready. Please try again.');return;}
    document.getElementById('crm1FinalFollowupModal')?.remove();
    var now=new Date(Date.now()+3600000);now.setSeconds(0,0);
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
      save.disabled=true;save.textContent='Saving...';
      try{
        var r=await db.from('orders').select('customer_id').eq('id',orderId).maybeSingle();
        if(r.error||!r.data)throw new Error(r.error?.message||'Order not found');
        var iso=new Date(dt).toISOString();
        var u=await db.auth.getUser();
        var ins=await db.from('followups').insert({
          order_id:orderId,
          customer_id:r.data.customer_id||null,
          assigned_to:u?.data?.user?.id||null,
          followup_at:iso,
          note:note,
          notes:note,
          status:'pending'
        });
        if(ins.error)throw ins.error;
        await db.from('orders').update({next_followup_at:iso}).eq('id',orderId);
        close();
        alert('Follow-up scheduled successfully.');
      }catch(e){
        alert(e?.message||String(e));
        save.disabled=false;save.textContent='Schedule';
      }
    };
  }

  async function resolveOrderId(row){
    var button=row.querySelector('button[data-id]');
    if(button&&button.getAttribute('data-id'))return button.getAttribute('data-id');
    var cells=row.querySelectorAll('td');
    var match=(cells[0]?.textContent||'').match(/\d+/);
    if(!match||!window.sb)return null;
    var orderNo=String(Number(match[0]));
    if(idCache[orderNo])return idCache[orderNo];
    var r=await window.sb.from('orders').select('id').eq('order_no',Number(orderNo)).maybeSingle();
    if(r.error||!r.data)return null;
    idCache[orderNo]=r.data.id;
    return r.data.id;
  }

  async function ensureButtons(){
    if(!active()||running)return;
    var r=root();
    if(!r)return;
    var rows=[...r.querySelectorAll('tbody tr')].filter(function(row){return row.querySelectorAll('td').length>0;});
    if(!rows.length)return;
    running=true;
    try{
      for(var i=0;i<rows.length;i++){
        var row=rows[i];
        var cells=row.querySelectorAll('td');
        var action=cells[cells.length-1];
        if(!action)continue;

        var buttons=[...action.querySelectorAll('button')];
        var followups=buttons.filter(function(b){
          return b.classList.contains('crm1FinalFollowupBtn') ||
                 b.classList.contains('crm1FollowFromVerify') ||
                 /^follow\s*-?\s*up$/i.test((b.textContent||'').trim());
        });

        if(followups.length>1){
          followups.slice(1).forEach(function(b){b.remove();});
          followups=followups.slice(0,1);
        }
        if(followups.length===1)continue;

        buttons=[...action.querySelectorAll('button')];
        var verify=buttons.find(function(b){return b.classList.contains('crm1VerifyFix')&&b.getAttribute('data-v')==='verified' || /^verify$/i.test((b.textContent||'').trim());});
        var reject=buttons.find(function(b){return b.classList.contains('crm1VerifyFix')&&b.getAttribute('data-v')==='failed' || /^reject$/i.test((b.textContent||'').trim());});
        if(!verify&&!reject)continue;

        var orderId=null;
        if(verify)orderId=verify.getAttribute('data-id');
        if(!orderId&&reject)orderId=reject.getAttribute('data-id');
        if(!orderId)orderId=await resolveOrderId(row);
        if(!orderId)continue;

        var follow=document.createElement('button');
        follow.type='button';
        follow.className='crm1-mini crm1FinalFollowupBtn';
        follow.setAttribute('data-id',orderId);
        follow.textContent='Follow-up';
        follow.style.marginLeft='4px';
        follow.onclick=function(id){return function(){openFollowup(id);};}(orderId);
        action.appendChild(follow);
      }
    }finally{running=false;}
  }

  function boot(){
    var p=page();
    if(!p)return;
    if(observer)observer.disconnect();
    observer=new MutationObserver(function(){
      if(active()&&!running)ensureButtons();
    });
    observer.observe(p,{childList:true,subtree:true});
    if(active())ensureButtons();
  }

  document.addEventListener('click',function(e){
    var b=e.target.closest('button');
    if(b&&/verification queue/i.test(b.textContent||''))setTimeout(boot,120);
  },true);

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});
  else boot();

  window.crm1EnsureVerificationFollowup=ensureButtons;
})();
