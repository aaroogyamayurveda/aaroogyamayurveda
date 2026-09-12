// CRM1 parity: keep the agent availability dropdown to the five approved states.
const APPROVED=[['ready','Ready'],['pause','Pause'],['aux','AUX'],['washroom','Washroom'],['lunch','Lunch']];
function sync(){
  const select=document.getElementById('crm1ParityAgentStatus');
  if(!select)return;
  const current=select.value||'ready';
  select.innerHTML=APPROVED.map(([value,label])=>`<option value="${value}">${label}</option>`).join('');
  select.value=APPROVED.some(([value])=>value===current)?current:'ready';
}
new MutationObserver(sync).observe(document.body,{childList:true,subtree:true});
sync();
