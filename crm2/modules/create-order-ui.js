import {sb,esc,money,normalizeMobile,getProducts,getSources,currentProfile} from '../data.js';

const $=id=>document.getElementById(id);
const root=()=>document.querySelector('#main');
const WORKSPACE='[data-crm2-create-order]';
let busy=false;

const errorText=e=>{
  const m=e?.message||String(e||'Order create failed.');
  const map={
    AUTH_REQUIRED:'Session expired. Please login again.',
    INVALID_MOBILE:'Mobile number invalid hai.',
    CUSTOMER_NAME_REQUIRED:'Customer name required hai.',
    INVALID_ALTERNATE_MOBILE:'Alternate mobile invalid hai.',
    DELIVERY_ADDRESS_REQUIRED:'Complete delivery address required hai.',
    LEAD_NOT_FOUND:'Selected lead nahi mila.',
    LEAD_ACCESS_DENIED:'Aapko is lead par order create karne ki permission nahi hai.'
  };
  return map[m]||m;
};

function normalizeName(v){return String(v||'').trim().replace(/\s+/g,' ')}
function validMobile(v){const x=normalizeMobile(v);return /^[6-9]\d{9}$/.test(x)}
function moneyNumber(v){const n=Number(v);return Number.isFinite(n)?Math.max(0,n):0}

async function lookupCustomer(mobile){
  const normalized=normalizeMobile(mobile);
  if(!validMobile(normalized))return {customer:null,leads:[],addresses:[]};
  const [{data:customer},{data:leads}]=await Promise.all([
    sb.from('customers').select('id,customer_code,name,mobile,alternate_mobile,age,gender,state,city,pincode').eq('mobile',normalized).limit(1).maybeSingle(),
    sb.from('leads').select('id,lead_code,customer_id,customer_name,mobile,alternate_mobile,age,gender,address,state,city,pincode,source,campaign_id,product_name,assigned_to,team_id,status,priority,notes').eq('mobile',normalized).is('deleted_at',null).order('created_at',{ascending:false}).limit(20)
  ]);
  const c=customer||null;
  let addresses=[];
  if(c?.id){const r=await sb.from('customer_addresses').select('id,label,address,city,state,pincode,is_default,created_at').eq('customer_id',c.id).order('is_default',{ascending:false}).order('created_at',{ascending:false}).limit(20);addresses=r.data||[]}
  return {customer:c,leads:leads||[],addresses};
}

async function lookupPincode(pin){
  const p=String(pin||'').replace(/\D/g,'').slice(0,6);
  if(p.length!==6)return [];
  try{
    const response=await fetch(`https://api.postalpincode.in/pincode/${encodeURIComponent(p)}`,{headers:{accept:'application/json'}});
    if(!response.ok)throw new Error('Pincode service unavailable');
    const json=await response.json();
    const rows=Array.isArray(json?.[0]?.PostOffice)?json[0].PostOffice:[];
    return rows.map(x=>({state:x.State||'',city:x.District||x.Block||'',post:x.Name||'',pincode:p})).filter(x=>x.state&&x.city&&x.post);
  }catch(e){return []}
}

function options(items, valueKey='value', labelKey='label'){
  return items.map(x=>`<option value="${esc(x[valueKey])}">${esc(x[labelKey])}</option>`).join('');
}

function workspaceShell(ctx={},products=[],sources=[],campaigns=[]){
  const lead=ctx.lead||{};
  const customer=ctx.customer||{};
  const defaultMobile=normalizeMobile(ctx.mobile||lead.mobile||customer.mobile||'');
  const defaultName=customer.name||lead.customer_name||'';
  const defaultAlt=customer.alternate_mobile||lead.alternate_mobile||'';
  const defaultAddress=lead.address||'';
  const defaultCity=lead.city||customer.city||'';
  const defaultState=lead.state||customer.state||'';
  const defaultPin=lead.pincode||customer.pincode||'';
  const defaultProduct=lead.product_name||'';
  return `<section class="erp-order-workspace" data-crm2-create-order>
    <div class="order-workspace-head">
      <div><div class="eyebrow">Agent Order Entry</div><h2>Create Order</h2><p class="muted">Call, confirm customer, select address and create the order in one fast workspace.</p></div>
      <div class="order-head-actions"><span class="pill" id="crm2OrderMode">${ctx.lead?'Lead Order':'New Order'}</span><button class="btn alt" id="crm2OrderBack">Back</button></div>
    </div>
    <div class="order-workspace-grid">
      <div class="order-main-column">
        <section class="panel order-section"><div class="order-section-title"><div><h3>1. Customer</h3><span class="muted">Mobile is the primary customer key.</span></div><span id="crm2CustomerBadge" class="status-chip">New</span></div>
          <div class="grid2">
            <div class="field"><label>Mobile Number *</label><input id="crm2OrderMobile" inputmode="numeric" maxlength="10" autocomplete="tel" value="${esc(defaultMobile)}" placeholder="10 digit mobile"><div class="field-error" id="crm2OrderMobileError"></div></div>
            <div class="field"><label>Customer Name *</label><input id="crm2OrderName" maxlength="80" value="${esc(defaultName)}" autocomplete="name"><div class="field-error" id="crm2OrderNameError"></div></div>
            <div class="field"><label>Alternate Mobile</label><input id="crm2OrderAlt" inputmode="numeric" maxlength="10" value="${esc(defaultAlt)}"><div class="field-error" id="crm2OrderAltError"></div></div>
            <div class="field"><label>Age</label><input id="crm2OrderAge" inputmode="numeric" maxlength="3" value="${esc(customer.age??lead.age??'')}"></div>
            <div class="field"><label>Gender</label><select id="crm2OrderGender"><option value="">Select</option><option ${String(customer.gender||lead.gender||'')==='Male'?'selected':''}>Male</option><option ${String(customer.gender||lead.gender||'')==='Female'?'selected':''}>Female</option><option ${String(customer.gender||lead.gender||'')==='Other'?'selected':''}>Other</option></select></div>
          </div>
          <div id="crm2CustomerHistory" class="order-history compact"></div>
        </section>

        <section class="panel order-section"><div class="order-section-title"><div><h3>2. Calling</h3><span class="muted">Manual mobile calling always works; telephony can plug into the same action.</span></div><span class="pill" id="crm2CallSource">Manual Mobile</span></div>
          <div class="call-strip"><div><b id="crm2CallNumber">${esc(defaultMobile||'Enter mobile')}</b><div class="muted" id="crm2CallStatus">Ready to call</div></div><div class="order-call-actions"><a class="btn" id="crm2CallMobile" href="tel:${encodeURIComponent(defaultMobile)}">📞 Call Mobile</a><button class="btn alt" id="crm2CallTelephony" type="button">☎ Telephony</button></div></div>
          <div class="grid2 call-log-fields">
            <div class="field"><label>Call Outcome</label><select id="crm2CallOutcome"><option value="">Not logged yet</option><option>Connected</option><option>No Response</option><option>Busy</option><option>Call Drop</option><option>Wrong Number</option><option>Callback</option><option>Interested</option><option>Not Interested</option><option>Order Confirmed</option><option>Other</option></select></div>
            <div class="field"><label>Call Duration (seconds)</label><input id="crm2CallDuration" type="number" min="0" value="0"></div>
            <div class="field full"><label>Call Notes</label><textarea id="crm2CallNotes" maxlength="500" placeholder="Customer confirmation / call notes"></textarea></div>
          </div>
        </section>

        <section class="panel order-section"><div class="order-section-title"><div><h3>3. Delivery Address</h3><span class="muted">Pincode suggests State, City and Post/Area. Saved addresses can be reused.</span></div><span id="crm2AddressBadge" class="status-chip">New Address</span></div>
          <div id="crm2SavedAddresses" class="saved-addresses"></div>
          <div class="grid2">
            <div class="field"><label>Pincode *</label><input id="crm2OrderPincode" inputmode="numeric" maxlength="6" value="${esc(defaultPin)}" placeholder="6 digit pincode"><div class="field-error" id="crm2OrderPinError"></div></div>
            <div class="field"><label>State *</label><select id="crm2OrderState"><option value="">Select State</option></select></div>
            <div class="field"><label>City *</label><select id="crm2OrderCity" disabled><option value="">Select City</option></select></div>
            <div class="field"><label>Area / Post *</label><select id="crm2OrderPost" disabled><option value="">Select Area / Post</option></select></div>
            <div class="field full"><label>Complete Delivery Address *</label><textarea id="crm2OrderAddress" maxlength="300" placeholder="House / Flat / Street / Landmark">${esc(defaultAddress)}</textarea><div class="field-error" id="crm2OrderAddressError"></div></div>
          </div>
          <div class="address-actions"><button class="btn alt" type="button" id="crm2UseLeadAddress">Use current lead address</button><button class="btn alt" type="button" id="crm2NewAddress">New Address</button></div>
        </section>

        <section class="panel order-section"><div class="order-section-title"><div><h3>4. Product & Pricing</h3><span class="muted">Product price is loaded from CRM2 product master.</span></div></div>
          <div class="grid2">
            <div class="field"><label>Product *</label><select id="crm2OrderProduct"><option value="">Select Product</option>${products.map(x=>`<option value="${x.id}" data-price="${x.selling_price}" data-sku="${esc(x.sku)}" data-name="${esc(x.name)}" ${defaultProduct&&String(x.name).toLowerCase()===String(defaultProduct).toLowerCase()?'selected':''}>${esc(x.name)} · ${esc(x.sku)} · ${money(x.selling_price)}</option>`).join('')}</select></div>
            <div class="field"><label>Quantity *</label><input id="crm2OrderQty" inputmode="numeric" type="number" min="1" max="99" value="1"></div>
            <div class="field"><label>Unit Price (₹) *</label><input id="crm2OrderPrice" type="number" min="0" step="0.01" value="0"></div>
            <div class="field"><label>Discount (₹)</label><input id="crm2OrderDiscount" type="number" min="0" step="0.01" value="0"></div>
          </div>
        </section>

        <section class="panel order-section"><div class="order-section-title"><div><h3>5. Order Information</h3><span class="muted">Preserve lead and campaign attribution.</span></div></div>
          <div class="grid2">
            <div class="field"><label>Lead Source</label><select id="crm2OrderSource">${sources.map(x=>`<option ${String(x.name).toLowerCase()===String(lead.source||'Manual').toLowerCase()?'selected':''}>${esc(x.name)}</option>`).join('')}</select></div>
            <div class="field"><label>Campaign</label><select id="crm2OrderCampaign"><option value="">No Campaign</option>${campaigns.map(x=>`<option value="${x.id}" ${lead.campaign_id===x.id?'selected':''}>${esc(x.name)}</option>`).join('')}</select></div>
            <div class="field"><label>Payment Mode *</label><select id="crm2OrderPayment"><option value="COD">COD</option><option value="Prepaid">Prepaid</option><option value="Other">Other</option></select></div>
            <div class="field"><label>Priority</label><select id="crm2OrderPriority"><option>normal</option><option>high</option><option>urgent</option><option>express</option></select></div>
            <div class="field full"><label>Order Remarks</label><textarea id="crm2OrderRemarks" maxlength="500" placeholder="Delivery or customer instructions">${esc(lead.notes||'')}</textarea></div>
          </div>
        </section>
      </div>
      <aside class="order-summary-card">
        <div class="summary-sticky">
          <div class="eyebrow">Order Summary</div><h3 id="crm2SummaryCustomer">${esc(defaultName||'New Customer')}</h3><div class="summary-mobile" id="crm2SummaryMobile">${esc(defaultMobile||'No mobile')}</div>
          <div class="summary-address" id="crm2SummaryAddress">${esc([defaultAddress,defaultCity,defaultState,defaultPin].filter(Boolean).join(', ')||'Address not selected')}</div>
          <div class="summary-lines"><div><span>Product</span><b id="crm2SummaryProduct">—</b></div><div><span>Qty</span><b id="crm2SummaryQty">1</b></div><div><span>Subtotal</span><b id="crm2SummarySubtotal">₹0</b></div><div><span>Discount</span><b id="crm2SummaryDiscount">₹0</b></div><div class="summary-total"><span>Total</span><strong id="crm2SummaryTotal">₹0</strong></div></div>
          <div id="crm2DuplicateWarning" class="erp-alert warning" hidden></div>
          <div id="crm2OrderMessage" class="msg"></div>
          <button class="btn order-submit" id="crm2CreateOrder" type="button">Create Order</button>
          <button class="btn alt order-followup" id="crm2SaveFollowup" type="button">Save & Follow-up</button>
        </div>
      </aside>
    </div>
  </section>`;
}

function stateSelect(rows,selected=''){
  const states=[...new Set(rows.map(x=>x.state).filter(Boolean))].sort();
  const s=$('crm2OrderState');if(!s)return;
  s.innerHTML='<option value="">Select State</option>'+states.map(x=>`<option value="${esc(x)}" ${x===selected?'selected':''}>${esc(x)}</option>`).join('');
}
function citySelect(rows,state,selected=''){
  const vals=[...new Set(rows.filter(x=>!state||x.state===state).map(x=>x.city).filter(Boolean))].sort();
  const s=$('crm2OrderCity');if(!s)return;
  s.disabled=!vals.length;s.innerHTML='<option value="">Select City</option>'+vals.map(x=>`<option value="${esc(x)}" ${x===selected?'selected':''}>${esc(x)}</option>`).join('');
}
function postSelect(rows,state,city,selected=''){
  const vals=rows.filter(x=>(!state||x.state===state)&&(!city||x.city===city));
  const unique=[...new Map(vals.map(x=>[x.post,x])).values()].sort((a,b)=>a.post.localeCompare(b.post));
  const s=$('crm2OrderPost');if(!s)return;
  s.disabled=!unique.length;s.innerHTML='<option value="">Select Area / Post</option>'+unique.map(x=>`<option value="${esc(x.post)}" ${x.post===selected?'selected':''}>${esc(x.post)}</option>`).join('');
}

function recalc(){
  const p=$('crm2OrderProduct')?.selectedOptions?.[0];
  const price=p?moneyNumber($('crm2OrderPrice').value||p.dataset.price):moneyNumber($('crm2OrderPrice')?.value);
  const qty=Math.max(1,Math.min(99,parseInt($('crm2OrderQty')?.value,10)||1));
  const discount=Math.min(price*qty,moneyNumber($('crm2OrderDiscount')?.value));
  const subtotal=price*qty,total=Math.max(0,subtotal-discount);
  if($('crm2OrderQty'))$('crm2OrderQty').value=qty;
  if($('crm2SummaryProduct'))$('crm2SummaryProduct').textContent=p?.dataset?.name||p?.textContent?.split(' · ')[0]||'—';
  if($('crm2SummaryQty'))$('crm2SummaryQty').textContent=String(qty);
  if($('crm2SummarySubtotal'))$('crm2SummarySubtotal').textContent=money(subtotal);
  if($('crm2SummaryDiscount'))$('crm2SummaryDiscount').textContent=money(discount);
  if($('crm2SummaryTotal'))$('crm2SummaryTotal').textContent=money(total);
  return {price,qty,discount,total,product:p};
}

function updateSummary(){
  const name=normalizeName($('crm2OrderName')?.value),mobile=normalizeMobile($('crm2OrderMobile')?.value);
  const address=normalizeName($('crm2OrderAddress')?.value),city=$('crm2OrderCity')?.value,state=$('crm2OrderState')?.value,pin=$('crm2OrderPincode')?.value;
  if($('crm2SummaryCustomer'))$('crm2SummaryCustomer').textContent=name||'New Customer';
  if($('crm2SummaryMobile'))$('crm2SummaryMobile').textContent=mobile||'No mobile';
  if($('crm2CallNumber'))$('crm2CallNumber').textContent=mobile||'Enter mobile';
  if($('crm2CallMobile'))$('crm2CallMobile').href=mobile?`tel:${encodeURIComponent(mobile)}`:'#';
  if($('crm2SummaryAddress'))$('crm2SummaryAddress').textContent=[address,city,state,pin].filter(Boolean).join(', ')||'Address not selected';
  recalc();
}

async function loadHistory(customerId,addresses,leads){
  const host=$('crm2CustomerHistory');if(!host)return;
  if(!customerId){host.innerHTML='<div class="muted">No existing customer matched yet.</div>';return}
  const {data:orders}=await sb.from('orders').select('id,order_code,total,status,created_at').eq('customer_id',customerId).order('created_at',{ascending:false}).limit(5);
  host.innerHTML=`<div class="history-grid"><div><b>${orders?.length||0}</b><span>Recent Orders</span></div><div><b>${addresses.length}</b><span>Saved Addresses</span></div><div><b>${leads.length}</b><span>Lead Records</span></div></div>${orders?.length?`<details><summary>Previous orders</summary>${orders.map(o=>`<div class="history-row"><span>${esc(o.order_code)}</span><span>${money(o.total)}</span><span class="pill">${esc(o.status)}</span></div>`).join('')}</details>`:''}`;
}

function renderSavedAddresses(addresses){
  const host=$('crm2SavedAddresses');if(!host)return;
  if(!addresses.length){host.innerHTML='';return}
  host.innerHTML='<div class="saved-address-label">Saved addresses</div>'+addresses.map((a,i)=>`<button type="button" class="saved-address" data-address-id="${a.id}"><b>${esc(a.label||`Address ${i+1}`)}${a.is_default?' · Default':''}</b><span>${esc([a.address,a.city,a.state,a.pincode].filter(Boolean).join(', '))}</span></button>`).join('');
  host.querySelectorAll('[data-address-id]').forEach(btn=>btn.onclick=()=>{
    const a=addresses.find(x=>x.id===btn.dataset.addressId);if(!a)return;
    $('crm2OrderAddress').value=a.address||'';$('crm2OrderPincode').value=a.pincode||'';
    stateSelect([{state:a.state,city:a.city,post:''}],a.state);citySelect([{state:a.state,city:a.city,post:''}],a.state,a.city);postSelect([],a.state,a.city,'');
    $('crm2AddressBadge').textContent='Saved Address';updateSummary();
  });
}

async function checkDuplicate(customerId,productId,total){
  if(!customerId||!productId)return null;
  const since=new Date(Date.now()-10*60*1000).toISOString();
  const {data}=await sb.from('orders').select('order_code,total,created_at,status').eq('customer_id',customerId).gte('created_at',since).order('created_at',{ascending:false}).limit(20);
  if(!data?.length)return null;
  const match=data.find(o=>Math.abs(Number(o.total)-Number(total))<0.01);
  return match||null;
}

async function logManualCall(leadId,customerId){
  if(!leadId)return null;
  const outcome=$('crm2CallOutcome')?.value||null;
  if(!outcome)return null;
  const user=(await currentProfile())?.id||null;
  const {data,error}=await sb.from('lead_calls').insert({lead_id:leadId,customer_id:customerId||null,agent_id:user,call_source:'manual_mobile',direction:'outbound',started_at:null,ended_at:null,duration_seconds:Math.max(0,Number($('crm2CallDuration')?.value)||0),outcome,notes:normalizeName($('crm2CallNotes')?.value)||null}).select().single();
  if(error)throw error;
  return data;
}

async function openWorkspace(ctx={}){
  const m=root();if(!m)return;
  const [pr,sr,cr]=await Promise.all([getProducts(),getSources(),sb.from('campaigns').select('id,name').eq('active',true).order('name').limit(200)]);
  const products=pr.data||[],sources=sr.data||[],campaigns=cr.data||[];
  m.innerHTML=workspaceShell(ctx,products,sources,campaigns);
  bindWorkspace(ctx,products);
  if(ctx.mobile||ctx.lead?.mobile||ctx.customer?.mobile) await hydrateMobile(normalizeMobile(ctx.mobile||ctx.lead?.mobile||ctx.customer?.mobile),ctx);
  updateSummary();
}

async function hydrateMobile(mobile,ctx={}){
  if(!validMobile(mobile))return;
  const result=await lookupCustomer(mobile);
  const lead=result.leads.find(x=>ctx.lead?.id?x.id===ctx.lead.id:true)||ctx.lead||result.leads[0]||null;
  if(result.customer){
    const c=result.customer;
    $('crm2CustomerBadge').textContent='Existing Customer';
    $('crm2CustomerBadge').classList.add('success');
    $('crm2OrderName').value=c.name||lead?.customer_name||'';$('crm2OrderAlt').value=c.alternate_mobile||lead?.alternate_mobile||'';$('crm2OrderAge').value=c.age??lead?.age??'';$('crm2OrderGender').value=c.gender||lead?.gender||'';
  }else if(lead){
    $('crm2OrderName').value=lead.customer_name||'';$('crm2OrderAlt').value=lead.alternate_mobile||'';$('crm2OrderAge').value=lead.age??'';$('crm2OrderGender').value=lead.gender||'';
  }
  if(lead){
    $('crm2OrderSource').value=lead.source||'Manual';$('crm2OrderCampaign').value=lead.campaign_id||'';$('crm2OrderPriority').value=lead.priority||'normal';$('crm2OrderRemarks').value=lead.notes||$('crm2OrderRemarks').value;
    const productSelect=$('crm2OrderProduct');if(productSelect&&lead.product_name){const opt=[...productSelect.options].find(o=>String(o.dataset.name||'').toLowerCase()===String(lead.product_name).toLowerCase());if(opt){productSelect.value=opt.value;}}
    if(lead.address){$('crm2OrderAddress').value=lead.address}
    if(lead.pincode){$('crm2OrderPincode').value=lead.pincode}
  }
  renderSavedAddresses(result.addresses);
  await loadHistory(result.customer?.id||lead?.customer_id,result.addresses,result.leads);
  const pin=$('crm2OrderPincode')?.value;if(pin&&/^\d{6}$/.test(pin))await hydratePincode(pin);
  updateSummary();
  window.crm2CreateOrderContext={lead,customer:result.customer,addresses:result.addresses};
}

async function hydratePincode(pin,preferredState='',preferredCity='',preferredPost=''){
  const status=$('crm2OrderPinError');if(status)status.textContent='Searching pincode…';
  const rows=await lookupPincode(pin);
  if(rows.length){
    stateSelect(rows,preferredState||rows[0].state);
    const state=$('crm2OrderState').value;citySelect(rows,state,preferredCity||rows[0].city);
    const city=$('crm2OrderCity').value;postSelect(rows,state,city,preferredPost||rows[0].post);
    if(status)status.textContent='Pincode matched.';
  }else if(status)status.textContent='Pincode lookup unavailable. You can enter address manually.';
  updateSummary();
}

function validate(){
  const mobile=normalizeMobile($('crm2OrderMobile').value),name=normalizeName($('crm2OrderName').value),alt=normalizeMobile($('crm2OrderAlt').value),pin=$('crm2OrderPincode').value.replace(/\D/g,''),address=normalizeName($('crm2OrderAddress').value),state=$('crm2OrderState').value,city=$('crm2OrderCity').value,post=$('crm2OrderPost').value,product=$('crm2OrderProduct').value;
  document.querySelectorAll(`${WORKSPACE} .field-error`).forEach(x=>x.textContent='');
  let ok=true;
  if(!validMobile(mobile)){ $('crm2OrderMobileError').textContent='10 digit valid mobile required.';ok=false }
  if(!name){$('crm2OrderNameError').textContent='Customer name required.';ok=false}
  if(alt && !validMobile(alt)){$('crm2OrderAltError').textContent='Valid 10 digit alternate mobile required.';ok=false}
  if(!/^\d{6}$/.test(pin)){$('crm2OrderPinError').textContent='6 digit pincode required.';ok=false}
  if(!state||!city||!post){$('crm2OrderPinError').textContent='State, City and Area/Post select karein.';ok=false}
  if(address.length<5){$('crm2OrderAddressError').textContent='Complete delivery address required.';ok=false}
  if(!product){ok=false}
  const calc=recalc();if(calc.price<0||calc.qty<1){ok=false}
  return {ok,mobile,name,alt,pin,address,state,city,post,calc};
}

async function createOrder(){
  if(busy)return;
  const v=validate();if(!v.ok){$('crm2OrderMessage').textContent='Please correct highlighted fields.';return}
  const ctx=window.crm2CreateOrderContext||{};
  const customerId=ctx.customer?.id||null;
  const duplicate=await checkDuplicate(customerId,v.calc.product?.value,v.calc.total);
  if(duplicate){
    const w=$('crm2DuplicateWarning');w.hidden=false;w.textContent=`Possible duplicate: ${duplicate.order_code} was created recently for this customer. Click Create Order again only if this is a genuine repeat order.`;
    if(w.dataset.confirmed!=='true'){w.dataset.confirmed='true';return}
  }
  busy=true;$('crm2CreateOrder').disabled=true;$('crm2CreateOrder').textContent='Creating…';$('crm2OrderMessage').textContent='';
  try{
    const itemOption=v.calc.product;
    const lead=ctx.lead||{};
    const {data,error}=await sb.rpc('crm2_create_order_workspace',{p_customer:{name:v.name,mobile:v.mobile,alternate_mobile:v.alt,age:$('crm2OrderAge').value||null,gender:$('crm2OrderGender').value||null},p_address:{address:v.address,city:v.city,state:v.state,pincode:v.pin},p_order:{payment_mode:$('crm2OrderPayment').value,priority:$('crm2OrderPriority').value,discount:v.calc.discount,source:$('crm2OrderSource').value,campaign_id:$('crm2OrderCampaign').value||null,remarks:$('crm2OrderRemarks').value.trim()||null},p_item:{product_id:itemOption?.value||null,product_name:itemOption?.dataset?.name||itemOption?.textContent?.split(' · ')[0]||'Product',sku:itemOption?.dataset?.sku||null,quantity:v.calc.qty,unit_price:v.calc.price},p_lead_id:lead.id||null});
    if(error)throw error;
    const order=Array.isArray(data)?data[0]:data;
    try{await logManualCall(order?.lead_id||lead.id,customerId)}catch(callError){console.warn('Call log skipped:',callError)}
    $('crm2OrderMessage').textContent=`Order ${order?.order_code||'created'} successfully.`;
    $('crm2OrderMessage').classList.add('success-msg');
    $('crm2CreateOrder').textContent='Order Created ✓';
    setTimeout(()=>{if(root()?.querySelector(WORKSPACE))window.dispatchEvent(new CustomEvent('crm2OrderCreated',{detail:{order}}));},250);
  }catch(e){$('crm2OrderMessage').textContent=errorText(e);$('crm2CreateOrder').disabled=false;$('crm2CreateOrder').textContent='Create Order';}
  finally{busy=false}
}

function bindWorkspace(ctx){
  const back=()=>window.dispatchEvent(new CustomEvent('crm2CreateOrderBack'));
  $('crm2OrderBack').onclick=back;
  $('crm2NewAddress').onclick=()=>{$('crm2OrderAddress').value='';$('crm2AddressBadge').textContent='New Address';updateSummary()};
  $('crm2UseLeadAddress').onclick=()=>{const l=window.crm2CreateOrderContext?.lead;if(!l)return;$('crm2OrderAddress').value=l.address||'';$('crm2OrderPincode').value=l.pincode||'';hydratePincode(l.pincode||'',l.state||'',l.city||'');updateSummary()};
  $('crm2OrderMobile').addEventListener('input',async e=>{e.target.value=e.target.value.replace(/\D/g,'').slice(0,10);updateSummary();if(e.target.value.length===10){await hydrateMobile(e.target.value,ctx)}});
  ['crm2OrderName','crm2OrderAlt','crm2OrderAddress','crm2OrderPincode'].forEach(id=>$(id)?.addEventListener('input',()=>updateSummary()));
  $('crm2OrderPincode').addEventListener('input',async e=>{e.target.value=e.target.value.replace(/\D/g,'').slice(0,6);if(e.target.value.length===6)await hydratePincode(e.target.value);});
  $('crm2OrderState').addEventListener('change',()=>{if(window.crm2PincodeRows){citySelect(window.crm2PincodeRows,$('crm2OrderState').value);postSelect(window.crm2PincodeRows,$('crm2OrderState').value,$('crm2OrderCity').value)}updateSummary()});
  $('crm2OrderCity').addEventListener('change',()=>{if(window.crm2PincodeRows)postSelect(window.crm2PincodeRows,$('crm2OrderState').value,$('crm2OrderCity').value);updateSummary()});
  $('crm2OrderPost').addEventListener('change',updateSummary);
  $('crm2OrderProduct').addEventListener('change',()=>{const p=$('crm2OrderProduct').selectedOptions[0];if(p)$('crm2OrderPrice').value=p.dataset.price||0;recalc();updateSummary()});
  ['crm2OrderQty','crm2OrderPrice','crm2OrderDiscount'].forEach(id=>$(id).addEventListener('input',()=>{recalc();updateSummary()}));
  $('crm2CallMobile').addEventListener('click',()=>{if(!validMobile($('crm2OrderMobile').value)){event?.preventDefault?.();$('crm2OrderMobileError').textContent='Pehle valid mobile number enter karein.'}});
  $('crm2CallTelephony').onclick=()=>{const number=normalizeMobile($('crm2OrderMobile').value);window.dispatchEvent(new CustomEvent('crm2StartTelephonyCall',{detail:{mobile:number,leadId:window.crm2CreateOrderContext?.lead?.id||null}}));$('crm2CallStatus').textContent='Telephony adapter requested. Manual Mobile remains available.'};
  $('crm2CreateOrder').onclick=createOrder;
  $('crm2SaveFollowup').onclick=()=>window.dispatchEvent(new CustomEvent('crm2CreateOrderFollowup',{detail:{leadId:window.crm2CreateOrderContext?.lead?.id||null,customerId:window.crm2CreateOrderContext?.customer?.id||null,mobile:normalizeMobile($('crm2OrderMobile').value)}}));
}

function addOrderActions(){
  const m=root();if(!m||m.querySelector('[data-crm2-create-order-action]'))return;
  const heading=[...m.querySelectorAll('h2')].find(x=>/Orders|Calling Workspace|Customer 360|Leads/i.test(x.textContent||''));
  if(!heading)return;
  const host=heading.closest('.title')||heading.parentElement;
  if(!host)return;
  const btn=document.createElement('button');btn.className='btn';btn.dataset.crm2CreateOrderAction='true';btn.textContent='+ Create Order';btn.onclick=()=>openWorkspace();
  host.appendChild(btn);
}

function enhanceCallingRows(){
  const m=root();if(!m)return;
  m.querySelectorAll('[data-log]').forEach(log=>{
    if(log.parentElement?.querySelector('[data-crm2-row-order]'))return;
    const b=document.createElement('button');b.className='btn alt';b.dataset.crm2RowOrder='true';b.textContent='Create Order';b.onclick=async()=>{const id=log.dataset.log;const {data:lead}=await sb.from('leads').select('id,customer_id,customer_name,mobile,alternate_mobile,age,gender,address,state,city,pincode,source,campaign_id,product_name,priority,notes').eq('id',id).single();const {data:customer}=lead?.customer_id?await sb.from('customers').select('*').eq('id',lead.customer_id).maybeSingle():{data:null};await openWorkspace({lead,customer,mobile:lead?.mobile});};log.parentElement?.appendChild(b);
  });
}

function start(){
  const observer=new MutationObserver(()=>{const m=root();if(!m)return;const text=m.textContent||'';if(m.querySelector(WORKSPACE))return;if(/Orders|Calling Workspace|Customer 360|Leads/i.test(text)){addOrderActions();enhanceCallingRows()}});
  observer.observe(document.body,{subtree:true,childList:true});
  window.addEventListener('crm2CreateOrderBack',()=>{const m=root();if(m&&!m.querySelector(WORKSPACE))return;window.location.reload()});
  window.addEventListener('crm2OrderCreated',()=>{setTimeout(()=>window.location.reload(),700)});
  window.addEventListener('crm2CreateOrderFollowup',e=>{if(e.detail?.leadId)window.dispatchEvent(new CustomEvent('crm2OpenFollowup',{detail:e.detail}))});
}

window.crm2OpenCreateOrder=openWorkspace;
window.crm2CreateOrderUI=true;
start();
