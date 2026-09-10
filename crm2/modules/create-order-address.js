const workspace=()=>document.querySelector('[data-crm2-create-order]');
const $=id=>document.getElementById(id);
const esc=v=>String(v??'').replace(/[&<>\"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',"'":'&#39;'}[c]));
const setOptions=(select,items,placeholder,selected='')=>{if(!select)return;select.innerHTML=`<option value="">${placeholder}</option>`+items.map(x=>`<option value="${esc(x)}" ${x===selected?'selected':''}>${esc(x)}</option>`).join('');select.disabled=!items.length};
const fetchPincode=async pin=>{try{const r=await fetch(`https://api.postalpincode.in/pincode/${encodeURIComponent(pin)}`,{headers:{accept:'application/json'}});if(!r.ok)return [];const j=await r.json();return Array.isArray(j?.[0]?.PostOffice)?j[0].PostOffice.map(x=>({state:x.State||'',city:x.District||x.Block||'',post:x.Name||''})).filter(x=>x.state&&x.city&&x.post):[]}catch{return []}};
const wire=()=>{
  const m=workspace();if(!m||m.dataset.addressCascade==='true')return;
  m.dataset.addressCascade='true';
  let rows=[];
  const pin=$('crm2OrderPincode'),state=$('crm2OrderState'),city=$('crm2OrderCity'),post=$('crm2OrderPost'),msg=$('crm2OrderPinError');
  const refreshCities=()=>{const cities=[...new Set(rows.filter(x=>!state.value||x.state===state.value).map(x=>x.city))].sort();setOptions(city,cities,'Select City');refreshPosts()};
  const refreshPosts=()=>{const posts=[...new Set(rows.filter(x=>(!state.value||x.state===state.value)&&(!city.value||x.city===city.value)).map(x=>x.post))].sort();setOptions(post,posts,'Select Area / Post')};
  pin?.addEventListener('input',async e=>{e.target.value=e.target.value.replace(/\D/g,'').slice(0,6);if(e.target.value.length!==6){rows=[];setOptions(state,[],'Select State');setOptions(city,[],'Select City');setOptions(post,[],'Select Area / Post');return}if(msg)msg.textContent='Searching pincode…';rows=await fetchPincode(e.target.value);if(!rows.length){if(msg)msg.textContent='Pincode lookup unavailable. Enter State/City/Area manually.';return}const states=[...new Set(rows.map(x=>x.state))].sort();setOptions(state,states,'Select State',states[0]);refreshCities();if(city.options.length===2)city.value=rows[0].city;refreshPosts();if(post.options.length===2)post.value=rows[0].post;if(msg)msg.textContent='Pincode matched.';});
  state?.addEventListener('change',refreshCities);city?.addEventListener('change',refreshPosts);
};
new MutationObserver(wire).observe(document.body,{subtree:true,childList:true});
wire();
window.crm2CreateOrderAddress=true;
