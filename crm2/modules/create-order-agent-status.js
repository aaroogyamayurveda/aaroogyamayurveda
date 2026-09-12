// CRM1 parity: keep Agent Status to the five approved states without a
// document-wide MutationObserver. A DOM observer here caused a self-triggering
// mutation loop because syncing the <select> mutates the same document it watched.
const APPROVED=[['ready','Ready'],['pause','Pause'],['aux','AUX'],['washroom','Washroom'],['lunch','Lunch']];

function sync(){
  const select=document.getElementById('crm1ParityAgentStatus');
  if(!select||select.dataset.crm2ApprovedStatus==='true')return;
  const current=select.value||'ready';
  select.innerHTML=APPROVED.map(([value,label])=>`<option value="${value}">${label}</option>`).join('');
  select.value=APPROVED.some(([value])=>value===current)?current:'ready';
  select.dataset.crm2ApprovedStatus='true';
}

window.addEventListener('crm2CreateOrderParityReady',()=>setTimeout(sync,0));
setTimeout(sync,0);
setTimeout(sync,250);
