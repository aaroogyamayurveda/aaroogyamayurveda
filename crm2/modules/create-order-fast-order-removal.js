// CRM2 intentionally has one Create Order workflow. Remove legacy Fast Order UI
// wherever an older renderer still injects it; never intercept the real Create Order action.
const removeLegacyFastOrder=()=>{
  document.querySelectorAll('#fastOrder').forEach(el=>el.remove());
  document.querySelectorAll('button').forEach(el=>{if((el.textContent||'').trim()==='Fast Order')el.remove()});
};
const observer=new MutationObserver(removeLegacyFastOrder);
if(document.body)observer.observe(document.body,{subtree:true,childList:true});
removeLegacyFastOrder();
