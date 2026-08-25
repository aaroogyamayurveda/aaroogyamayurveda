/* CRM1 targeted stability patch: restore Settlement generation controls and stop
   Verification Queue from being rebuilt by short-lived verification refresh timers.
   Does not replace core renderers; it layers safe UI/interaction guards on top. */
(function () {
  'use strict';

  if (window.__crm1OpsSettlementVerificationStability) return;
  window.__crm1OpsSettlementVerificationStability = true;

  var TZ = 'Asia/Kolkata';
  var realSetInterval = window.setInterval.bind(window);
  var realClearInterval = window.clearInterval.bind(window);
  var realSetTimeout = window.setTimeout.bind(window);
  var realClearTimeout = window.clearTimeout.bind(window);
  var intervalMeta = new Map();
  var timeoutMeta = new Map();
  var verificationLastTimeout = {};

  function byId(id) { return document.getElementById(id); }
  function safe(v) { return String(v == null ? '' : v); }
  function money(v) { return '₹' + Number(v || 0).toLocaleString('en-IN'); }
  function esc(v) {
    return safe(v).replace(/[&<>\"]/g, function (m) {
      if (m === '&') return '&amp;';
      if (m === '<') return '&lt;';
      if (m === '>') return '&gt;';
      if (m === '"') return '&quot;';
      return '&#039;';
    });
  }
  function todayIST() {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit'
    }).format(new Date());
  }
  function nextISTDate(d) {
    var x = new Date(String(d) + 'T00:00:00+05:30');
    x.setUTCDate(x.getUTCDate() + 1);
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit'
    }).format(x);
  }
  function sourceOf(fn) {
    try { return Function.prototype.toString.call(fn); } catch (e) { return ''; }
  }
  function verificationActive() {
    var page = document.querySelector('.page.active');
    if (!page) return false;
    var id = String(page.id || '').toLowerCase();
    var text = String(page.innerText || '').toLowerCase();
    return /verification/.test(id) || /verification queue/.test(text);
  }
  function verificationCallback(fn) {
    var s = sourceOf(fn).toLowerCase();
    return /verification|verifyqueue|crm1verify|verificationstatus/.test(s);
  }

  window.setInterval = function (fn, delay) {
    var args = Array.prototype.slice.call(arguments, 2);
    var id = realSetInterval.apply(window, [fn, delay].concat(args));
    intervalMeta.set(id, { fn: fn, delay: Number(delay || 0) });
    return id;
  };
  window.clearInterval = function (id) {
    intervalMeta.delete(id);
    return realClearInterval(id);
  };
  window.setTimeout = function (fn, delay) {
    var args = Array.prototype.slice.call(arguments, 2);
    var d = Number(delay || 0);
    if (typeof fn === 'function' && verificationActive() && verificationCallback(fn) && d > 0 && d <= 15000) {
      var key = sourceOf(fn);
      var now = Date.now();
      var last = verificationLastTimeout[key] || 0;
      if (last && now - last < 3000) return realSetTimeout(function () {}, 0);
      verificationLastTimeout[key] = now;
    }
    var id = realSetTimeout.apply(window, [fn, delay].concat(args));
    timeoutMeta.set(id, { fn: fn, delay: d });
    return id;
  };
  window.clearTimeout = function (id) {
    timeoutMeta.delete(id);
    return realClearTimeout(id);
  };

  function pauseVerificationTimers() {
    intervalMeta.forEach(function (meta, id) {
      if (verificationCallback(meta.fn) && meta.delay <= 15000) {
        realClearInterval(id);
        intervalMeta.delete(id);
      }
    });
  }

  function partnerRole() {
    var r = safe(window.profile && window.profile.role).toLowerCase();
    return r === 'dealer' || r === 'courier_manager';
  }
  function currentRole() { return safe(window.profile && window.profile.role).toLowerCase(); }
  function activePartnerPage() { return document.querySelector('.page.active') || null; }
  async function getMe() {
    if (window.me && window.me.id) return window.me;
    if (!window.sb || !window.sb.auth) return null;
    try { var r = await window.sb.auth.getUser(); return r && r.data ? r.data.user : null; } catch (e) { return null; }
  }
  async function dealerId() {
    var me = await getMe();
    if (!me || !window.sb) return null;
    var r = await window.sb.from('dealers').select('id').eq('user_id', me.id).maybeSingle();
    if (r.error) throw r.error;
    return r.data ? r.data.id : null;
  }
  function orderProductText(order) {
    var items = Array.isArray(order.order_items) ? order.order_items : [];
    if (!items.length) return '-';
    return items.map(function (i) { return esc((i.products && (i.products.product_name || i.products.name)) || 'Product') + ' × ' + Number(i.quantity || i.qty || 0); }).join('<br>');
  }
  function statusOptions(current) {
    var vals = ['new', 'assigned', 'confirmed', 'dealer_pending', 'in_transit', 'delivered', 'rto', 'cancelled', 'hold'];
    current = safe(current).toLowerCase() || 'new';
    if (vals.indexOf(current) < 0) vals.unshift(current);
    return vals.map(function (v) { return '<option value="' + esc(v) + '"' + (v === current ? ' selected' : '') + '>' + esc(v) + '</option>'; }).join('');
  }

  async function renderPartnerOrders(page, role) {
    if (!page || !window.sb || !partnerRole()) return;
    var me = await getMe();
    if (!me) return;
    var q = window.sb.from('orders').select('id,order_no,order_status,total_amount,order_date,dealer_id,courier_manager_id,customers(customer_name,mobile),order_items(quantity,qty,products(product_name))').order('order_date', { ascending: false }).limit(500);
    if (role === 'dealer') {
      var did = await dealerId();
      q = did ? q.eq('dealer_id', did) : q.eq('dealer_id', '00000000-0000-0000-0000-000000000000');
    } else q = q.eq('courier_manager_id', me.id);
    var result = await q;
    if (result.error) throw result.error;
    var rows = result.data || [];
    page.innerHTML = '<div class="title"><div><h2>' + (role === 'dealer' ? 'Dealer Orders' : 'Courier Orders') + '</h2><div class="sub">Only orders assigned to your account</div></div></div><div class="panel" data-crm1-partner-orders="1"><div class="tablewrap"><table><thead><tr><th>Order</th><th>Customer</th><th>Mobile</th><th>Product</th><th>Amount</th><th>Date / Time</th><th>Status</th><th>Update</th></tr></thead><tbody>' + rows.map(function (o) {
      return '<tr data-order-id="' + esc(o.id) + '"><td>#' + esc(o.order_no) + '</td><td>' + esc(o.customers && o.customers.customer_name || '-') + '</td><td>' + esc(o.customers && o.customers.mobile || '-') + '</td><td>' + orderProductText(o) + '</td><td>' + money(o.total_amount) + '</td><td>' + esc(new Intl.DateTimeFormat('en-IN',{timeZone:TZ,day:'2-digit',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit',hour12:true}).format(new Date(o.order_date))) + '</td><td><span class="pill">' + esc(o.order_status || 'new') + '</span></td><td><select class="crm1PartnerStatus" data-id="' + esc(o.id) + '">' + statusOptions(o.order_status) + '</select> <button type="button" class="crm1-mini crm1PartnerSave" data-id="' + esc(o.id) + '">Save</button></td></tr>';
    }).join('') + (rows.length ? '' : '<tr><td colspan="8" class="empty">No assigned orders</td></tr>') + '</tbody></table></div></div>';
    page.querySelectorAll('.crm1PartnerSave').forEach(function (b) {
      b.onclick = async function () {
        var id = b.getAttribute('data-id');
        var select = page.querySelector('.crm1PartnerStatus[data-id="' + id + '"]');
        if (!select) return;
        b.disabled = true;
        try {
          var r = await window.sb.from('orders').update({ order_status: select.value }).eq('id', id);
          if (r.error) throw r.error;
          var row = b.closest('tr'); var pill = row && row.querySelector('.pill'); if (pill) pill.textContent = select.value;
          if (typeof window.toast === 'function') window.toast('Order status updated');
        } catch (e) { if (typeof window.toast === 'function') window.toast(safe(e.message || e)); else alert(safe(e.message || e)); }
        finally { b.disabled = false; }
      };
    });
  }

  async function renderPartnerReports() {
    var page = byId('advancedReports'); if (!page || !window.sb || !partnerRole()) return;
    var me = await getMe(); if (!me) return;
    var role = currentRole();
    var q = window.sb.from('orders').select('id,order_no,order_status,total_amount,order_date');
    if (role === 'dealer') { var did = await dealerId(); q = did ? q.eq('dealer_id', did) : q.eq('dealer_id', '00000000-0000-0000-0000-000000000000'); }
    else q = q.eq('courier_manager_id', me.id);
    var r = await q.order('order_date', { ascending: false }).limit(1000); if (r.error) throw r.error;
    var rows = r.data || [];
    var delivered = rows.filter(function (o) { return safe(o.order_status).toLowerCase() === 'delivered'; }).length;
    var transit = rows.filter(function (o) { return ['in_transit','assigned','confirmed','dealer_pending'].indexOf(safe(o.order_status).toLowerCase()) >= 0; }).length;
    var rto = rows.filter(function (o) { return safe(o.order_status).toLowerCase() === 'rto'; }).length;
    var cancelled = rows.filter(function (o) { return safe(o.order_status).toLowerCase() === 'cancelled'; }).length;
    var value = rows.reduce(function (s,o) { return s + Number(o.total_amount || 0); }, 0);
    page.innerHTML = '<div class="title"><div><h2>Advanced Reports</h2><div class="sub">Your ' + (role === 'dealer' ? 'dealer' : 'courier') + ' performance and delivery report</div></div></div><div class="cards"><div class="stat"><span>Total Assigned</span><b>' + rows.length + '</b></div><div class="stat"><span>Delivered</span><b>' + delivered + '</b></div><div class="stat"><span>In Progress</span><b>' + transit + '</b></div><div class="stat"><span>RTO</span><b>' + rto + '</b></div><div class="stat"><span>Cancelled</span><b>' + cancelled + '</b></div><div class="stat"><span>Order Value</span><b>' + money(value) + '</b></div></div><div class="panel"><h3>Status-wise Report</h3><div class="tablewrap"><table><thead><tr><th>Status</th><th>Orders</th></tr></thead><tbody>' + Object.keys(rows.reduce(function (m,o){var k=safe(o.order_status||'new');m[k]=(m[k]||0)+1;return m;},{})).map(function(k){var n=rows.filter(function(o){return safe(o.order_status||'new')===k;}).length;return '<tr><td>'+esc(k)+'</td><td>'+n+'</td></tr>';}).join('') + '</tbody></table></div></div>';
  }

  async function renderPartnerSettlements() {
    var page = byId('settlements'), root = byId('settlementsContent');
    if (!page || !root || !page.classList.contains('active') || !window.sb || !partnerRole()) return;
    var me = await getMe(); if (!me) return;
    var role = currentRole(), partnerId = role === 'dealer' ? await dealerId() : me.id;
    if (!partnerId) return;
    var r = await window.sb.from('partner_settlements').select('period_from,period_to,delivered_orders,cod_amount,commission_amount,net_payable,status').eq('partner_id', partnerId).order('period_from',{ascending:false}).limit(200);
    if (r.error) throw r.error;
    var rows = r.data || [];
    root.innerHTML = '<div data-crm1-partner-settlements="1"><div class="panel"><h3>Your Settlements</h3><div class="tablewrap"><table><thead><tr><th>Period</th><th>Delivered</th><th>COD</th><th>Commission</th><th>Net Payable</th><th>Status</th></tr></thead><tbody>' + rows.map(function(x){return '<tr><td>'+esc(x.period_from)+' to '+esc(x.period_to)+'</td><td>'+Number(x.delivered_orders||0)+'</td><td>'+money(x.cod_amount)+'</td><td>'+money(x.commission_amount)+'</td><td>'+money(x.net_payable)+'</td><td>'+esc(x.status||'-')+'</td></tr>';}).join('') + (rows.length?'':'<tr><td colspan="6" class="empty">No settlements found</td></tr>') + '</tbody></table></div></div></div>';
  }

  function showPartnerPage(page) { document.querySelectorAll('.page').forEach(function (p) { p.classList.remove('active'); }); page.classList.add('active'); }
  function navText(btn) { return safe(btn && btn.textContent).trim().toLowerCase(); }
  function removePartnerUnneededUI() {
    if (!partnerRole()) return;
    document.querySelectorAll('.side button,button').forEach(function (b) { var t = navText(b); if (t.indexOf('order timeline') >= 0 || t.indexOf('conversion workbench') >= 0) b.classList.add('hidden'); });
    var timeline = byId('timeline'); if (timeline) timeline.classList.add('hidden');
    var workbench = byId('conversionWorkbench'); if (workbench) workbench.classList.add('hidden');
    var settlements = byId('settlements'); if (settlements) settlements.querySelectorAll('[data-crm1-settlement-generate="1"]').forEach(function (x) { x.remove(); });
    var nav = byId('nav') || document.querySelector('.side');
    if (nav && !nav.querySelector('[data-crm1-partner-advanced="1"]')) {
      var b = document.createElement('button'); b.type = 'button'; b.textContent = '📈 Advanced Reports'; b.setAttribute('data-crm1-partner-advanced','1');
      b.onclick = function () { var p = byId('advancedReports'); if (!p) return; showPartnerPage(p); renderPartnerReports().catch(function(e){ console.warn('Partner reports:', e); }); };
      nav.appendChild(b);
    }
  }
  function interceptPartnerNavigation() {
    if (window.__crm1PartnerNavIntercept) return; window.__crm1PartnerNavIntercept = true;
    document.addEventListener('click', function (e) {
      if (!partnerRole()) return; var b = e.target && e.target.closest ? e.target.closest('button') : null; if (!b) return; var t = navText(b);
      if (t.indexOf('dealer orders') >= 0 || t.indexOf('courier orders') >= 0) realSetTimeout(function () { var p = activePartnerPage(); if (p) renderPartnerOrders(p, currentRole()).catch(function(err){ console.warn('Partner order render:', err); }); }, 0);
      else if (t.indexOf('settlements') >= 0) realSetTimeout(function(){ renderPartnerSettlements().catch(function(err){ console.warn('Partner settlement render:',err); }); },0);
    }, true);
  }

  function addGenerationUI() {
    var page = byId('settlements'), root = byId('settlementsContent');
    if (!page || !root || !page.classList.contains('active') || !window.sb) return;
    if (partnerRole()) { root.querySelectorAll('[data-crm1-settlement-generate="1"]').forEach(function (x) { x.remove(); }); return; }
    if (root.querySelector('[data-crm1-settlement-generate="1"]')) return;
    var panel = document.createElement('div'); panel.setAttribute('data-crm1-settlement-generate', '1'); panel.className = 'panel';
    panel.innerHTML = '<h3 style="margin-bottom:10px">Generate Settlement</h3><div class="crm1-toolbar" style="display:flex;gap:10px;flex-wrap:wrap;align-items:end"><label style="min-width:145px">From<input type="date" id="crm1SetGenFrom" style="display:block;width:100%;box-sizing:border-box"></label><label style="min-width:145px">To<input type="date" id="crm1SetGenTo" style="display:block;width:100%;box-sizing:border-box"></label><label style="min-width:210px">Select Partner<select id="crm1SetGenPartner" style="display:block;width:100%;box-sizing:border-box"><option value="">Loading…</option></select></label><label style="min-width:150px">Commission / Order<input id="crm1SetGenCommission" type="number" min="0" step="1" placeholder="e.g. 350" style="display:block;width:100%;box-sizing:border-box"></label><button class="btn" id="crm1SetGenGenerate" type="button">Generate</button><button class="btn alt" id="crm1SetGenRefresh" type="button">Refresh</button></div><div class="sub" style="margin-top:8px">Dealer: commission amount per delivered order. Courier: commission remains ₹0; courier freight/RTO charges are handled separately.</div><div id="crm1SetGenMsg" class="sub" style="margin-top:6px"></div>';
    root.insertBefore(panel, root.firstChild);
    var from = byId('crm1SetGenFrom'), to = byId('crm1SetGenTo'), partner = byId('crm1SetGenPartner'), commission = byId('crm1SetGenCommission'), msg = byId('crm1SetGenMsg');
    from.value = from.value || todayIST(); to.value = to.value || todayIST();
    function loadPartners() { return Promise.all([window.sb.from('dealers').select('id,dealer_name,is_active').eq('is_active', true).order('dealer_name'),window.sb.from('profiles').select('id,full_name,is_active').eq('role', 'courier_manager').eq('is_active', true).order('full_name')]).then(function (r) { if (r[0].error) throw r[0].error; if (r[1].error) throw r[1].error; var html = '<option value="">Select Partner</option>'; html += (r[0].data || []).map(function (x) { return '<option value="' + esc(x.id) + '" data-type="dealer">' + esc(x.dealer_name || x.id) + ' — Dealer</option>'; }).join(''); html += (r[1].data || []).map(function (x) { return '<option value="' + esc(x.id) + '" data-type="courier">' + esc(x.full_name || x.id) + ' — Courier</option>'; }).join(''); partner.innerHTML = html; }).catch(function (e) { partner.innerHTML = '<option value="">Unable to load partners</option>'; msg.textContent = 'Partner load error: ' + safe(e.message || e); }); }
    partner.addEventListener('change', function () { var o = partner.options[partner.selectedIndex], type = o ? o.getAttribute('data-type') : ''; commission.disabled = type === 'courier'; if (type === 'courier') commission.value = '0'; if (type === 'dealer' && (!commission.value || commission.value === '0')) commission.value = '350'; });
    byId('crm1SetGenRefresh').onclick = function () { var apply = byId('opsFinalSetApply'); if (apply) apply.click(); else window.dispatchEvent(new CustomEvent('crm1DataChanged', { detail: { type: 'settlement_refresh' } })); loadPartners(); };
    byId('crm1SetGenGenerate').onclick = async function () { var p = partner.value, f = from.value, t = to.value, c = Number(commission.value || 0), opt = partner.options[partner.selectedIndex], type = opt ? opt.getAttribute('data-type') : ''; if (!p) { msg.textContent = 'Select Partner.'; return; } if (!f || !t) { msg.textContent = 'Select From and To dates.'; return; } if (t < f) { msg.textContent = 'To date cannot be before From date.'; return; } if (type === 'dealer' && c < 0) { msg.textContent = 'Commission cannot be negative.'; return; } var btn = byId('crm1SetGenGenerate'); btn.disabled = true; btn.textContent = 'Generating…'; msg.textContent = 'Generating settlement…'; try { var rpc = await window.sb.rpc('generate_partner_settlement', { p_partner: p, p_from: f, p_to: t, p_commission: type === 'courier' ? 0 : c, p_forward_freight: 0, p_rto_charges: 0, p_other_charges: 0, p_cod_remitted: null, p_adjustment: 0 }); if (rpc.error) throw rpc.error; msg.textContent = 'Settlement generated successfully.'; var apply = byId('opsFinalSetApply'); if (apply) apply.click(); await loadPartners(); } catch (e) { msg.textContent = 'Generate error: ' + safe(e.message || e); } finally { btn.disabled = false; btn.textContent = 'Generate'; } };
    loadPartners();
  }

  function bootObserver() {
    if (window.__crm1OpsSettlementVerificationObserver) return; window.__crm1OpsSettlementVerificationObserver = true; interceptPartnerNavigation();
    var observer = new MutationObserver(function () { addGenerationUI(); removePartnerUnneededUI(); if (verificationActive()) pauseVerificationTimers(); }); observer.observe(document.body, { childList: true, subtree: true });
    realSetInterval(function () { addGenerationUI(); removePartnerUnneededUI(); if (verificationActive()) pauseVerificationTimers(); }, 700);
    document.addEventListener('pointerdown', function (e) { if (!verificationActive()) return; var b = e.target && e.target.closest ? e.target.closest('.crm1VerifyFix, button') : null; if (b) pauseVerificationTimers(); }, true);
    realSetTimeout(addGenerationUI, 500); realSetTimeout(removePartnerUnneededUI, 800);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', bootObserver, { once: true }); else bootObserver();
})();
