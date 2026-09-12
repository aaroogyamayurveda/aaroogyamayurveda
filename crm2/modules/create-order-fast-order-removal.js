// CRM2 intentionally has one Create Order workflow. Remove legacy Fast Order UI
// wherever an older renderer still injects it; do not intercept normal Create Order clicks.
const removeLegacyFastOrder=()=>{
  document.querySelectorAll('#fastOrder, button').forEach(el=>{
    const label=(el.textContent||'').trim();
    if(el.id==='fastOrder'||label==='Fast Order')el.remove();
  });
};
const observer=new MutationObserver(removeLegacyFastOrder);
if(document.body)observer.observe(document.body,{subtree:true,childList:true});
removeLegacyFastOrder();
