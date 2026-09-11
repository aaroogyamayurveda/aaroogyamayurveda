import { sb, currentProfile, normalizeMobile } from '../data.js';

const $ = id => document.getElementById(id);
const WS = '[data-crm2-create-order]';
let pendingDisposition = null;
let lastWorkspace = null;

const hide = el => { if (el) el.style.display = 'none'; };
const show = el => { if (el) el.style.display = ''; };
const validMobile = v => /^[6-9]\d{9}$/.test(normalizeMobile(v || ''));
const text = v => String(v ?? '').trim();

function setError(id, message) {
  const el = $(id);
  if (el) el.textContent = message || '';
}

function field(label, node) {
  const wrap = document.createElement('div');
  wrap.className = 'field crm1-parity-field';
  const lab = document.createElement('label');
  lab.textContent = label;
  wrap.append(lab, node);
  return wrap;
}

function syncValidationFields() {
  const mobile = $('crm2OrderMobile');
  const name = $('crm2OrderName');
  const alt = $('crm2OrderAlt');
  const age = $('crm2OrderAge');
  const pin = $('crm2OrderPincode');
  const qty = $('crm2OrderQty');
  if (mobile) { mobile.maxLength = 10; mobile.inputMode = 'numeric'; mobile.addEventListener('input', () => { mobile.value = mobile.value.replace(/\D/g, '').slice(0, 10); }); }
  if (alt) { alt.maxLength = 10; alt.inputMode = 'numeric'; alt.addEventListener('input', () => { alt.value = alt.value.replace(/\D/g, '').slice(0, 10); }); }
  if (age) { age.maxLength = 3; age.inputMode = 'numeric'; age.addEventListener('input', () => { age.value = age.value.replace(/\D/g, '').slice(0, 3); }); }
  if (pin) { pin.maxLength = 6; pin.inputMode = 'numeric'; pin.addEventListener('input', () => { pin.value = pin.value.replace(/\D/g, '').slice(0, 6); }); }
  if (qty) { qty.min = '1'; qty.max = '99'; qty.step = '1'; qty.inputMode = 'numeric'; }
  if (name) name.maxLength = 80;
}

function freezePricing() {
  const price = $('crm2OrderPrice');
  const discount = $('crm2OrderDiscount');
  if (price) {
    price.readOnly = true;
    price.setAttribute('aria-readonly', 'true');
    price.title = 'Product master price — agent cannot edit';
  }
  if (discount) {
    discount.value = '0';
    discount.readOnly = true;
    discount.disabled = true;
    discount.setAttribute('aria-disabled', 'true');
    discount.title = 'Discount is fixed at ₹0';
  }
}

function validateCreateOrder() {
  let ok = true;
  const name = text($('crm2OrderName')?.value);
  const mobile = normalizeMobile($('crm2OrderMobile')?.value || '');
  const alt = normalizeMobile($('crm2OrderAlt')?.value || '');
  const ageRaw = text($('crm2OrderAge')?.value);
  const age = ageRaw ? Number(ageRaw) : null;
  const pin = text($('crm2OrderPincode')?.value);
  const state = text($('crm2OrderState')?.value);
  const city = text($('crm2OrderCity')?.value);
  const post = text($('crm2OrderPost')?.value);
  const address = text($('crm2OrderAddress')?.value);
  const product = $('crm2OrderProduct')?.value;
  const qty = Number($('crm2OrderQty')?.value);

  setError('crm2OrderMobileError', ''); setError('crm2OrderNameError', ''); setError('crm2OrderPinError', ''); setError('crm2OrderAddressError', '');
  if (!validMobile(mobile)) { setError('crm2OrderMobileError', 'Mobile exactly 10 digits होना चाहिए।'); ok = false; }
  if (!/^[\p{L} .\'-]+$/u.test(name)) { setError('crm2OrderNameError', 'Valid customer name required है।'); ok = false; }
  if (alt && !validMobile(alt)) { setError('crm2OrderAltError', 'Alternate mobile exactly 10 digits होना चाहिए।'); ok = false; }
  if (ageRaw && (!Number.isInteger(age) || age < 1 || age > 120)) { ok = false; }
  if (!/^\d{6}$/.test(pin)) { setError('crm2OrderPinError', 'Pincode exactly 6 digits होना चाहिए।'); ok = false; }
  if (!state || !city || !post) { setError('crm2OrderPinError', 'State, City and Area/Post select karein.'); ok = false; }
  if (address.length < 5) { setError('crm2OrderAddressError', 'Complete delivery address required.'); ok = false; }
  if (!product) { ok = false; }
  if (!Number.isInteger(qty) || qty < 1 || qty > 99) { ok = false; }
  freezePricing();
  return ok;
}

async function logManualCall() {
  const mobile = normalizeMobile($('crm1ParityMobile')?.value || $('crm2OrderMobile')?.value || '');
  const lead = window.crm2CreateOrderContext?.lead;
  if (!validMobile(mobile) || !lead?.id) return;
  const user = (await currentProfile())?.id;
  if (!user) return;
  const outcome = $('crm2CallOutcome')?.value || 'Connected';
  const notes = text($('crm2CallNotes')?.value) || null;
  const { error } = await sb.from('lead_calls').insert({ lead_id: lead.id, customer_id: window.crm2CreateOrderContext?.customer?.id || lead.customer_id || null, agent_id: user, call_source: 'manual_mobile', direction: 'outbound', started_at: null, ended_at: null, duration_seconds: 0, outcome, notes });
  if (error) console.warn('CRM2 parity manual call log failed', error);
}

function makeConsole(workspace) {
  if (document.querySelector('[data-crm1-order-parity-console]')) return;
  const panel = document.createElement('section');
  panel.className = 'panel crm1-parity-console';
  panel.setAttribute('data-crm1-order-parity-console', 'true');
  panel.innerHTML = '<div class="crm1-parity-panel-title"><div><h3>☎ Manual Phone Call Console</h3><div class="sub">Call customers from your personal keypad phone. CRM records call timing, disposition and follow-up only.</div></div><span class="status-chip" id="crm1ParityReady">Ready</span></div><div class="grid3 crm1-parity-call-grid"><div id="crm1ParityMobileField"></div><div id="crm1ParityStatusField"></div><div id="crm1ParityTimerField"></div></div><div class="actions crm1-parity-actions"></div>';
  workspace.parentElement.insertBefore(panel, workspace);
  const originalMobile = $('crm2OrderMobile'), status = $('crm2CallStatus'), timer = $('crm2CallTimer');
  if (originalMobile) {
    const clone = originalMobile.cloneNode(true); clone.id = 'crm1ParityMobile'; clone.value = originalMobile.value; clone.className = ''; clone.placeholder = '10 digit mobile';
    clone.addEventListener('input', e => { e.target.value = e.target.value.replace(/\D/g, '').slice(0, 10); originalMobile.value = e.target.value; originalMobile.dispatchEvent(new Event('input', { bubbles: true })); });
    $('crm1ParityMobileField').append(field('Customer Mobile', clone));
  }
  if (status) { const input = document.createElement('input'); input.id = 'crm1ParityAgentStatus'; input.readOnly = true; input.value = status.textContent || 'Ready to call'; input.className = 'crm1-parity-readonly'; $('crm1ParityStatusField').append(field('Agent Status', input)); }
  if (timer) { const input = document.createElement('input'); input.id = 'crm1ParityTimer'; input.readOnly = true; input.value = timer.textContent || '00:00'; input.className = 'crm1-parity-readonly'; $('crm1ParityTimerField').append(field('Call Timer', input)); hide(timer); }
  const start = $('crm2CallStart'), end = $('crm2CallEnd');
  if (start) { start.textContent = 'Start Call'; start.className = 'btn'; panel.querySelector('.crm1-parity-actions').append(start); }
  if (end) { end.textContent = 'End Call'; end.className = 'btn red crm1-parity-end'; panel.querySelector('.crm1-parity-actions').append(end); }
  const log = document.createElement('button'); log.type = 'button'; log.className = 'btn alt'; log.textContent = 'Log Manual Call'; log.id = 'crm1ParityLogCall'; log.onclick = logManualCall; panel.querySelector('.crm1-parity-actions').append(log);
  const sync = () => { if ($('crm1ParityAgentStatus')) $('crm1ParityAgentStatus').value = status?.textContent || 'Ready to call'; if ($('crm1ParityTimer')) $('crm1ParityTimer').value = timer?.textContent || '00:00'; if ($('crm1ParityMobile') && originalMobile) $('crm1ParityMobile').value = originalMobile.value; if ($('crm1ParityReady')) $('crm1ParityReady').textContent = (status?.textContent || 'Ready').replace('Ready to call', 'Ready'); };
  if (status) new MutationObserver(sync).observe(status, { childList: true, subtree: true, characterData: true });
  setInterval(sync, 500);
}

function makeTelephony(workspace) {
  if (document.querySelector('[data-crm1-order-parity-telephony]')) return;
  const panel = document.createElement('section'); panel.className = 'panel crm1-parity-telephony'; panel.setAttribute('data-crm1-order-parity-telephony', 'true');
  panel.innerHTML = '<div class="crm1-parity-panel-title"><div><h3>☎ Telephony</h3><div class="sub">Call control inside order workspace · SIP / X-Lite / VICIdial ready</div></div><span class="crm1-parity-unconfigured">Telephony not configured</span></div><div class="crm1-parity-tele-row"><input id="crm2ParityPhone" class="crm1-parity-phone" inputmode="numeric" maxlength="10" placeholder="10 digit mobile"><button class="btn alt" id="crm1ParitySip" type="button">Call via SIP</button><button class="btn alt" id="crm1ParityPhone" type="button">Call via Phone</button><button class="btn alt" id="crm1ParityLog" type="button">Log Call</button></div><div class="sub crm1-parity-admin-note">Admin needs to configure this agent in Telephony Agents.</div>';
  workspace.parentElement.insertBefore(panel, workspace);
  $('crm2ParityPhone').addEventListener('input', e => e.target.value = e.target.value.replace(/\D/g, '').slice(0, 10));
  $('crm1ParitySip').onclick = () => { const n = normalizeMobile($('crm2ParityPhone').value); window.dispatchEvent(new CustomEvent('crm2StartTelephonyCall', { detail: { mobile: n, leadId: window.crm2CreateOrderContext?.lead?.id || null } })); };
  $('crm1ParityPhone').onclick = () => { const n = normalizeMobile($('crm2ParityPhone').value); if (validMobile(n)) window.location.href = `tel:${encodeURIComponent(n)}`; };
  $('crm1ParityLog').onclick = logManualCall;
}

async function loadDispositions() {
  const l1 = $('crm1Disposition1'), l2 = $('crm1Disposition2'); if (!l1 || !l2) return;
  l1.innerHTML = '<option value="">Select</option>'; l2.innerHTML = '<option value="">Select Level 1 first</option>'; l2.disabled = true;
  const { data, error } = await sb.from('disposition_levels').select('id,name,parent_id').eq('active', true).is('parent_id', null).order('name'); if (error) return;
  const display = { Lead: 'Lead Case', 'Non Lead': 'Non-Lead', Sales: 'Sales Order', 'Not Connected': 'Not Connected', Transfer: 'Transfer', Language: 'Language' };
  (data || []).forEach(x => { const o = document.createElement('option'); o.value = x.id; o.textContent = display[x.name] || x.name; l1.append(o); });
  l1.onchange = async () => { l2.innerHTML = '<option value="">Loading…</option>'; l2.disabled = true; if (!l1.value) { l2.innerHTML = '<option value="">Select Level 1 first</option>'; return; } const r = await sb.from('disposition_levels').select('id,name').eq('active', true).eq('parent_id', l1.value).order('name'); l2.innerHTML = '<option value="">Select</option>' + (r.data || []).map(x => `<option value="${x.id}">${String(x.name).replace(/[&<>\"]/g, m => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '\"':'&quot;' }[m]))}</option>`).join(''); l2.disabled = !(r.data || []).length; };
}

async function saveDisposition() {
  if (!pendingDisposition) return;
  const lead = window.crm2CreateOrderContext?.lead; if (!lead?.id) { pendingDisposition = null; return; }
  const user = (await currentProfile())?.id; if (!user) return;
  const { error } = await sb.from('leads').update({ disposition_id: pendingDisposition.level2, notes: pendingDisposition.remarks }).eq('id', lead.id);
  const m = $('crm1DispositionMessage'); if (error) { if (m) m.textContent = 'Disposition save failed.'; return; } if (m) m.textContent = 'Disposition submitted successfully.'; pendingDisposition = null;
}

function addDisposition(workspace) {
  if (document.querySelector('[data-crm1-disposition-panel]')) return;
  const panel = document.createElement('section'); panel.className = 'panel crm1-parity-section crm1-disposition-panel'; panel.setAttribute('data-crm1-disposition-panel', 'true');
  panel.innerHTML = '<h3>Disposition & Follow-up</h3><div class="grid2 crm1-disposition-grid"><div class="field"><label>Disposition Level 1 *</label><select id="crm1Disposition1"><option value="">Select</option></select></div><div class="field"><label>Disposition Level 2 *</label><select id="crm1Disposition2" disabled><option value="">Select Level 1 first</option></select></div></div><div id="crm1CallbackHost" class="crm1-callback-host"></div><div id="crm1DispositionMessage" class="field-error"></div><div class="actions crm1-disposition-actions"><button class="btn" id="crm1SubmitDisposition" type="button">Submit Disposition</button></div></div>';
  workspace.parentElement.append(panel);
  const callbackHost = panel.querySelector('#crm1CallbackHost');
  ['crm2CallbackAt','crm2CallbackPriority','crm2CallbackNotes','crm2CallbackSave','crm2CallbackError'].forEach(id => { const n = $(id); if (n) callbackHost.append(n.closest('.field') || n); }); hide(callbackHost);
  loadDispositions();
  $('crm1Disposition1').addEventListener('change', () => { const t = $('crm1Disposition1').selectedOptions[0]?.textContent || ''; if (/callback/i.test(t)) show(callbackHost); else hide(callbackHost); });
  $('crm1SubmitDisposition').onclick = async () => { const l1 = $('crm1Disposition1')?.value, l2 = $('crm1Disposition2')?.value, msg = $('crm1DispositionMessage'); if (!l1) { msg.textContent = 'Disposition Level 1 select karein.'; return; } if (!l2) { msg.textContent = 'Disposition Level 2 select karein.'; return; } if (!validateCreateOrder()) { msg.textContent = 'Order details complete karein.'; return; } pendingDisposition = { level1: l1, level2: l2, remarks: text($('crm2OrderRemarks')?.value) || null }; const create = $('crm2CreateOrder'); if (create) create.click(); else await saveDisposition(); };
}

function reorganize(workspace) {
  if (!workspace || workspace.dataset.crm1ParityApplied === 'true') return true;
  const mainCol = workspace.querySelector('.order-main-column');
  const sections = mainCol?.querySelectorAll('.order-section');
  if (!mainCol || !sections || sections.length < 5) return false;
  const [customer, calling, address, pricing, info] = sections;
  const head = workspace.querySelector('.order-workspace-head');
  if (head) { head.querySelector('.eyebrow')?.remove(); const h = head.querySelector('h2'); if (h) h.textContent = '+ Create Order'; const p = head.querySelector('p'); if (p) p.textContent = 'Enter customer and order details'; }
  hide(calling);

  const customerPanel = document.createElement('section'); customerPanel.className = 'panel crm1-parity-section'; customerPanel.innerHTML = '<h3>Customer Details</h3><div class="grid2 crm1-parity-customer-grid"></div><div class="crm1-parity-address-grid"></div><div class="crm1-parity-history"></div>';
  const cg = customerPanel.querySelector('.crm1-parity-customer-grid'), ag = customerPanel.querySelector('.crm1-parity-address-grid');
  const customerGrid = customer.querySelector('.grid2'); if (customerGrid) [...customerGrid.children].forEach(n => cg.append(n));
  const pincode = address.querySelector('#crm2OrderPincode')?.closest('.field'); if (pincode) cg.append(pincode);
  const addressGrid = address.querySelector('.grid2'); if (addressGrid) [...addressGrid.children].forEach(n => { if (n !== pincode) ag.append(n); });
  const saved = address.querySelector('#crm2SavedAddresses'); if (saved) customerPanel.insertBefore(saved, ag);
  const addressActions = address.querySelector('.address-actions'); if (addressActions) customerPanel.append(addressActions);
  const history = customer.querySelector('#crm2CustomerHistory'); if (history) customerPanel.querySelector('.crm1-parity-history').append(history);

  const orderPanel = document.createElement('section'); orderPanel.className = 'panel crm1-parity-section'; orderPanel.innerHTML = '<h3>Order Details</h3><div class="grid2 crm1-parity-order-grid"></div>'; const og = orderPanel.querySelector('.crm1-parity-order-grid');
  const pgrid = pricing.querySelector('.grid2');
  if (pgrid) [...pgrid.children].forEach(n => { const id = n.querySelector?.('input,select')?.id; if (id === 'crm2OrderPrice') { og.append(n); } else if (id === 'crm2OrderDiscount') { og.append(n); } else og.append(n); });
  const igrid = info.querySelector('.grid2');
  if (igrid) [...igrid.children].forEach(n => { const id = n.querySelector?.('input,select,textarea')?.id; if (['crm2OrderCampaign','crm2OrderPriority'].includes(id)) hide(n); else if (id === 'crm2OrderRemarks') { /* moved below */ } else og.append(n); });
  const amount = document.createElement('div'); amount.className = 'field'; amount.innerHTML = '<label>Total Amount (₹) *</label><input id="crm1ParityTotalAmount" type="number" readonly value="0">';
  const payment = og.querySelector('#crm2OrderPayment')?.closest('.field'); if (payment) og.insertBefore(amount, payment); else og.append(amount);
  mainCol.innerHTML = ''; mainCol.append(customerPanel, orderPanel);

  const remarks = document.createElement('section'); remarks.className = 'panel crm1-parity-section crm1-remarks-panel'; remarks.innerHTML = '<h3>Remarks</h3><div class="crm1-remarks-host"></div>';
  const remarkNode = info.querySelector('#crm2OrderRemarks')?.closest('.field'); if (remarkNode) { const label = remarkNode.querySelector('label'); if (label) label.textContent = ''; const textarea = remarkNode.querySelector('textarea'); if (textarea) textarea.setAttribute('aria-label', 'Remarks'); remarks.querySelector('.crm1-remarks-host').append(remarkNode); }
  workspace.insertAdjacentElement('afterend', remarks);

  const summary = workspace.querySelector('.order-summary-card'); if (summary) { hide(summary); summary.setAttribute('aria-hidden', 'true'); }
  const create = $('crm2CreateOrder'), follow = $('crm2SaveFollowup'); if (create) { create.dataset.crm2HiddenSubmit = 'true'; create.style.display = 'none'; } if (follow) { follow.dataset.crm2HiddenSubmit = 'true'; follow.style.display = 'none'; }
  addDisposition(workspace); workspace.dataset.crm1ParityApplied = 'true'; makeConsole(workspace); makeTelephony(workspace); syncValidationFields(); freezePricing();
  const syncAmount = () => { const source = $('crm2SummaryTotal'); if ($('crm1ParityTotalAmount')) $('crm1ParityTotalAmount').value = (source?.textContent || '₹0').replace(/[^0-9.]/g, '') || 0; freezePricing(); };
  setInterval(syncAmount, 300); window.addEventListener('crm2OrderCreated', saveDisposition);
  return true;
}

function apply() {
  const ws = document.querySelector(WS); if (!ws) return;
  if (ws !== lastWorkspace) { lastWorkspace = ws; }
  if (reorganize(ws)) { syncValidationFields(); freezePricing(); }
}

new MutationObserver(apply).observe(document.body, { subtree: true, childList: true });
apply();
setInterval(apply, 250);
window.addEventListener('crm2CreateOrderWorkspaceReady', apply);
