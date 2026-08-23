/* CRM1 Operations final owner guard - clean ES5 syntax. */
(function () {
  'use strict';

  if (window.__crm1OpsFinalGuardStarted) return;
  window.__crm1OpsFinalGuardStarted = true;

  var TZ = 'Asia/Kolkata';
  var timers = {};

  function byId(id) { return document.getElementById(id); }

  function esc(value) {
    return String(value == null ? '' : value).replace(/[&<>\"']/g, function (m) {
      if (m === '&') return '&amp;';
      if (m === '<') return '&lt;';
      if (m === '>') return '&gt;';
      if (m === '"') return '&quot;';
      return '&#039;';
    });
  }

  function money(value) {
    return '₹' + Number(value || 0).toLocaleString('en-IN');
  }

  function todayIST() {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: TZ,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    }).format(new Date());
  }

  function nextISTDate(value) {
    var d = new Date(value + 'T00:00:00+05:30');
    d.setUTCDate(d.getUTCDate() + 1);
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: TZ,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    }).format(d);
  }

  function dateRange(from, to) {
    from = from || todayIST();
    to = to || from;
    if (to < from) {
      var tmp = from;
      from = to;
      to = tmp;
    }
    return {
      from: new Date(from + 'T00:00:00+05:30').toISOString(),
      to: new Date(nextISTDate(to) + 'T00:00:00+05:30').toISOString(),
      fromDate: from,
      toDate: to
    };
  }

  function isActive(id) {
    var page = byId(id);
    return !!(page && page.classList.contains('active'));
  }

  function setVisible(el, visible) {
    if (el) el.style.visibility = visible ? 'visible' : 'hidden';
  }

  function hasMarker(el) {
    return !!(el && el.querySelector('[data-crm1-ops-final="1"]'));
  }

  function safeText(value) {
    return String(value == null ? '' : value);
  }

  async function renderPartnerPerformance() {
    var page = byId('partnerPerformance');
    var root = byId('partnerPerformanceContent');
    if (!page || !root || !page.classList.contains('active') || !window.sb) return;

    setVisible(root, false);
    root.innerHTML = '<div data-crm1-ops-final="1"><div class="panel"><div class="crm1-toolbar"><label>From <input type="date" id="opsFinalPPFrom"></label><label>To <input type="date" id="opsFinalPPTo"></label><button class="btn" id="opsFinalPPApply">Apply</button><button class="btn alt" id="opsFinalPPToday">Today</button><span id="opsFinalPPMsg" class="sub"></span></div></div><div id="opsFinalPPStats" class="cards"></div><div class="panel"><div class="tablewrap"><table><thead><tr><th>Rank</th><th>Delivery Partner</th><th>Type</th><th>Assigned</th><th>In Progress</th><th>Delivered</th><th>RTO</th><th>Cancelled</th><th>Delivery %</th><th>Order Value</th><th>Revenue</th></tr></thead><tbody id="opsFinalPPBody"></tbody></table></div></div></div>';

    var today = todayIST();
    var fromInput = byId('opsFinalPPFrom');
    var toInput = byId('opsFinalPPTo');
    fromInput.value = today;
    toInput.value = today;
    byId('opsFinalPPApply').onclick = load;
    byId('opsFinalPPToday').onclick = function () {
      fromInput.value = todayIST();
      toInput.value = todayIST();
      load();
    };

    await load();

    async function load() {
      if (!isActive('partnerPerformance')) return;
      var msg = byId('opsFinalPPMsg');
      var stats = byId('opsFinalPPStats');
      var body = byId('opsFinalPPBody');
      var r = dateRange(fromInput.value, toInput.value);
      if (!msg || !stats || !body) return;
      msg.textContent = 'Loading...';

      try {
        var result = await Promise.all([
          window.sb.from('orders').select('id,order_no,order_status,total_amount,dealer_id,courier_manager_id,order_date,remarks').gte('order_date', r.from).lt('order_date', r.to),
          window.sb.from('dealers').select('id,dealer_name,is_active'),
          window.sb.from('profiles').select('id,full_name,is_active').eq('role', 'courier_manager')
        ]);

        for (var i = 0; i < result.length; i++) {
          if (result[i].error) throw result[i].error;
        }

        var orders = result[0].data || [];
        var dealerMap = new Map();
        var courierMap = new Map();
        (result[1].data || []).forEach(function (row) { dealerMap.set(row.id, row.dealer_name || row.id); });
        (result[2].data || []).forEach(function (row) { courierMap.set(row.id, row.full_name || row.id); });

        var map = {};
        orders.forEach(function (order) {
          if (safeText(order.remarks).indexOf('[ENQUIRY]') >= 0) return;
          var type = order.dealer_id ? 'Dealer' : 'Courier';
          var partnerId = order.dealer_id || order.courier_manager_id;
          if (!partnerId) return;
          var key = type + ':' + partnerId;
          if (!map[key]) {
            map[key] = { name: type === 'Dealer' ? dealerMap.get(partnerId) : (courierMap.get(partnerId) || partnerId), type: type, assigned: 0, inprogress: 0, delivered: 0, rto: 0, cancelled: 0, value: 0, revenue: 0 };
          }
          var row = map[key];
          row.assigned += 1;
          row.value += Number(order.total_amount || 0);
          if (order.order_status === 'delivered') { row.delivered += 1; row.revenue += Number(order.total_amount || 0); }
          else if (order.order_status === 'rto') row.rto += 1;
          else if (order.order_status === 'cancelled') row.cancelled += 1;
          else row.inprogress += 1;
        });

        var partners = Object.keys(map).map(function (key) { return map[key]; });
        partners.sort(function (a, b) { if (b.revenue !== a.revenue) return b.revenue - a.revenue; if (b.delivered !== a.delivered) return b.delivered - a.delivered; return b.assigned - a.assigned; });
        var assignedTotal = partners.reduce(function (sum, x) { return sum + x.assigned; }, 0);
        var deliveredTotal = partners.reduce(function (sum, x) { return sum + x.delivered; }, 0);
        var revenueTotal = partners.reduce(function (sum, x) { return sum + x.revenue; }, 0);

        stats.innerHTML = '<div class="stat"><span>Partners</span><b>' + partners.length + '</b></div><div class="stat"><span>Assigned</span><b>' + assignedTotal + '</b></div><div class="stat"><span>Delivered</span><b>' + deliveredTotal + '</b></div><div class="stat"><span>Revenue</span><b>' + money(revenueTotal) + '</b></div>';
        body.innerHTML = partners.map(function (x, index) {
          var pct = x.assigned ? (x.delivered / x.assigned * 100).toFixed(1) : '0.0';
          return '<tr><td><b>' + (index + 1) + '</b></td><td><b>' + esc(x.name) + '</b></td><td>' + esc(x.type) + '</td><td>' + x.assigned + '</td><td>' + x.inprogress + '</td><td>' + x.delivered + '</td><td>' + x.rto + '</td><td>' + x.cancelled + '</td><td>' + pct + '%</td><td>' + money(x.value) + '</td><td><b>' + money(x.revenue) + '</b></td></tr>';
        }).join('') || '<tr><td colspan="11" class="empty">No delivery orders for selected period</td></tr>';

        msg.textContent = 'Report: ' + r.fromDate + ' to ' + r.toDate;
        setVisible(root, true);
      } catch (error) {
        msg.textContent = 'Report error: ' + safeText(error && error.message ? error.message : error);
        setVisible(root, true);
      }
    }
  }

  async function renderSettlement() {
    var page = byId('settlements');
    var root = byId('settlementsContent');
    if (!page || !root || !page.classList.contains('active') || !window.sb) return;

    setVisible(root, false);
    root.innerHTML = '<div data-crm1-ops-final="1"><div class="panel"><div class="crm1-toolbar"><label>From <input type="date" id="opsFinalSetFrom"></label><label>To <input type="date" id="opsFinalSetTo"></label><button class="btn" id="opsFinalSetApply">Apply</button><button class="btn alt" id="opsFinalSetToday">Today</button><span id="opsFinalSetMsg" class="sub"></span></div></div><div id="opsFinalSetKpis" class="cards"></div><div class="panel"><h3>Existing Settlements</h3><div class="tablewrap"><table><thead><tr><th>Partner</th><th>Period</th><th>Delivered</th><th>COD</th><th>Commission</th><th>Net Payable</th><th>Status</th></tr></thead><tbody id="opsFinalSetBody"></tbody></table></div></div><div class="panel"><h3>Delivered Orders — Pending Settlement</h3><div class="sub" style="margin-bottom:10px">Delivered orders for the selected IST date range that do not yet have a generated partner settlement record.</div><div class="tablewrap"><table><thead><tr><th>Order</th><th>Date / Time</th><th>Partner</th><th>Type</th><th>Customer</th><th>COD</th><th>Status</th></tr></thead><tbody id="opsFinalPending"></tbody></table></div></div></div>';

    var today = todayIST();
    var fromInput = byId('opsFinalSetFrom');
    var toInput = byId('opsFinalSetTo');
    fromInput.value = today;
    toInput.value = today;
    byId('opsFinalSetApply').onclick = load;
    byId('opsFinalSetToday').onclick = function () { fromInput.value = todayIST(); toInput.value = todayIST(); load(); };
    await load();

    async function load() {
      if (!isActive('settlements')) return;
      var msg = byId('opsFinalSetMsg');
      var kpis = byId('opsFinalSetKpis');
      var body = byId('opsFinalSetBody');
      var pendingBody = byId('opsFinalPending');
      var r = dateRange(fromInput.value, toInput.value);
      if (!msg || !kpis || !body || !pendingBody) return;
      msg.textContent = 'Loading...';

      try {
        var partnerData = await Promise.all([
          window.sb.from('dealers').select('id,dealer_name'),
          window.sb.from('profiles').select('id,full_name').eq('role', 'courier_manager')
        ]);
        if (partnerData[0].error) throw partnerData[0].error;
        if (partnerData[1].error) throw partnerData[1].error;

        var dealerMap = new Map();
        var courierMap = new Map();
        (partnerData[0].data || []).forEach(function (row) { dealerMap.set(row.id, row.dealer_name || row.id); });
        (partnerData[1].data || []).forEach(function (row) { courierMap.set(row.id, row.full_name || row.id); });

        var settlementResult = await window.sb.from('partner_settlements').select('id,partner_id,period_from,period_to,delivered_orders,cod_amount,commission_amount,net_payable,status,partner_type').gte('period_from', r.fromDate).lte('period_to', r.toDate).order('period_from', { ascending: false });
        if (settlementResult.error) throw settlementResult.error;

        var settlements = settlementResult.data || [];
        body.innerHTML = settlements.map(function (row) {
          var name = row.partner_type === 'dealer' ? dealerMap.get(row.partner_id) : courierMap.get(row.partner_id);
          return '<tr><td>' + esc(name || row.partner_id || '-') + '</td><td>' + esc(row.period_from) + ' to ' + esc(row.period_to) + '</td><td>' + Number(row.delivered_orders || 0) + '</td><td>' + money(row.cod_amount) + '</td><td>' + money(row.commission_amount) + '</td><td>' + money(row.net_payable) + '</td><td>' + esc(row.status || '-') + '</td></tr>';
        }).join('') || '<tr><td colspan="7" class="empty">No settlements for selected period</td></tr>';

        var orderResult = await window.sb.from('orders').select('id,order_no,order_status,total_amount,order_date,dealer_id,courier_manager_id,customers(customer_name),remarks').eq('order_status', 'delivered').gte('order_date', r.from).lt('order_date', r.to);
        if (orderResult.error) throw orderResult.error;

        var deliveredOrders = (orderResult.data || []).filter(function (row) { return safeText(row.remarks).indexOf('[ENQUIRY]') < 0; });
        var pending = deliveredOrders.filter(function (order) {
          var partnerId = order.dealer_id || order.courier_manager_id;
          return !settlements.some(function (settlement) {
            return String(settlement.partner_id) === String(partnerId) && settlement.period_from === r.fromDate && settlement.period_to === r.toDate;
          });
        });

        pendingBody.innerHTML = pending.map(function (order) {
          var partnerId = order.dealer_id || order.courier_manager_id;
          var partnerName = order.dealer_id ? dealerMap.get(partnerId) : courierMap.get(partnerId);
          var dt = new Intl.DateTimeFormat('en-IN', { timeZone: TZ, day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true }).format(new Date(order.order_date));
          return '<tr><td>#' + esc(order.order_no) + '</td><td>' + esc(dt) + '</td><td>' + esc(partnerName || '-') + '</td><td>' + esc(order.dealer_id ? 'Dealer' : 'Courier') + '</td><td>' + esc(order.customers && order.customers.customer_name ? order.customers.customer_name : '-') + '</td><td>' + money(order.total_amount) + '</td><td><span class="pill">delivered</span></td></tr>';
        }).join('') || '<tr><td colspan="7" class="empty">No delivered orders pending settlement</td></tr>';

        var cod = deliveredOrders.reduce(function (sum, row) { return sum + Number(row.total_amount || 0); }, 0);
        var commission = settlements.reduce(function (sum, row) { return sum + Number(row.commission_amount || 0); }, 0);
        var net = settlements.reduce(function (sum, row) { return sum + Number(row.net_payable || 0); }, 0);

        kpis.innerHTML = '<div class="stat"><span>Settlements</span><b>' + settlements.length + '</b></div><div class="stat"><span>Delivered</span><b>' + deliveredOrders.length + '</b></div><div class="stat"><span>Pending Settlement Orders</span><b>' + pending.length + '</b></div><div class="stat"><span>Delivered COD</span><b>' + money(cod) + '</b></div><div class="stat"><span>Commission</span><b>' + money(commission) + '</b></div><div class="stat"><span>Net Settlement</span><b>' + money(net) + '</b></div>';
        msg.textContent = 'Report: ' + r.fromDate + ' to ' + r.toDate;
        setVisible(root, true);
      } catch (error) {
        msg.textContent = 'Report error: ' + safeText(error && error.message ? error.message : error);
        setVisible(root, true);
      }
    }
  }

  function refresh(id) {
    clearTimeout(timers[id]);
    timers[id] = setTimeout(function () {
      if (id === 'partnerPerformance') renderPartnerPerformance();
      if (id === 'settlements') renderSettlement();
    }, 120);
  }

  function init() {
    var nav = byId('nav');
    if (nav) {
      nav.addEventListener('click', function (event) {
        var button = event.target.closest ? event.target.closest('#nav button') : null;
        if (!button) return;
        var text = String(button.textContent || '').toLowerCase();
        if (text.indexOf('delivery partners') >= 0) refresh('partnerPerformance');
        if (text.indexOf('settlements') >= 0) refresh('settlements');
      }, true);
    }

    var observer = new MutationObserver(function () {
      if (isActive('partnerPerformance')) {
        var pp = byId('partnerPerformanceContent');
        if (!hasMarker(pp)) refresh('partnerPerformance');
      }
      if (isActive('settlements')) {
        var st = byId('settlementsContent');
        if (!hasMarker(st)) refresh('settlements');
      }
    });

    observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['class'] });

    if (isActive('partnerPerformance')) refresh('partnerPerformance');
    if (isActive('settlements')) refresh('settlements');
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();
}());
