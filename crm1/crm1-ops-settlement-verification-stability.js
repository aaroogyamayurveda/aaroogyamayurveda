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
    return safe(v).replace(/[&<>\"']/g, function (m) {
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
      if (last && now - last < 3000) {
        return realSetTimeout(function () {}, 0);
      }
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

  function addGenerationUI() {
    var page = byId('settlements');
    var root = byId('settlementsContent');
    if (!page || !root || !page.classList.contains('active') || !window.sb) return;
    if (root.querySelector('[data-crm1-settlement-generate="1"]')) return;

    var panel = document.createElement('div');
    panel.setAttribute('data-crm1-settlement-generate', '1');
    panel.className = 'panel';
    panel.innerHTML =
      '<h3 style="margin-bottom:10px">Generate Settlement</h3>' +
      '<div class="crm1-toolbar" style="display:flex;gap:10px;flex-wrap:wrap;align-items:end">' +
        '<label style="min-width:145px">From<input type="date" id="crm1SetGenFrom" style="display:block;width:100%;box-sizing:border-box"></label>' +
        '<label style="min-width:145px">To<input type="date" id="crm1SetGenTo" style="display:block;width:100%;box-sizing:border-box"></label>' +
        '<label style="min-width:210px">Select Partner<select id="crm1SetGenPartner" style="display:block;width:100%;box-sizing:border-box"><option value="">Loading…</option></select></label>' +
        '<label style="min-width:150px">Commission / Order<input id="crm1SetGenCommission" type="number" min="0" step="1" placeholder="e.g. 350" style="display:block;width:100%;box-sizing:border-box"></label>' +
        '<button class="btn" id="crm1SetGenGenerate" type="button">Generate</button>' +
        '<button class="btn alt" id="crm1SetGenRefresh" type="button">Refresh</button>' +
      '</div>' +
      '<div class="sub" style="margin-top:8px">Dealer: commission amount per delivered order. Courier: commission remains ₹0; courier freight/RTO charges are handled separately.</div>' +
      '<div id="crm1SetGenMsg" class="sub" style="margin-top:6px"></div>';

    root.insertBefore(panel, root.firstChild);

    var from = byId('crm1SetGenFrom');
    var to = byId('crm1SetGenTo');
    var partner = byId('crm1SetGenPartner');
    var commission = byId('crm1SetGenCommission');
    var msg = byId('crm1SetGenMsg');
    from.value = from.value || todayIST();
    to.value = to.value || todayIST();

    function loadPartners() {
      return Promise.all([
        window.sb.from('dealers').select('id,dealer_name,is_active').eq('is_active', true).order('dealer_name'),
        window.sb.from('profiles').select('id,full_name,is_active').eq('role', 'courier_manager').eq('is_active', true).order('full_name')
      ]).then(function (r) {
        if (r[0].error) throw r[0].error;
        if (r[1].error) throw r[1].error;
        var html = '<option value="">Select Partner</option>';
        html += (r[0].data || []).map(function (x) {
          return '<option value="' + esc(x.id) + '" data-type="dealer">' + esc(x.dealer_name || x.id) + ' — Dealer</option>';
        }).join('');
        html += (r[1].data || []).map(function (x) {
          return '<option value="' + esc(x.id) + '" data-type="courier">' + esc(x.full_name || x.id) + ' — Courier</option>';
        }).join('');
        partner.innerHTML = html;
      }).catch(function (e) {
        partner.innerHTML = '<option value="">Unable to load partners</option>';
        msg.textContent = 'Partner load error: ' + safe(e.message || e);
      });
    }

    partner.addEventListener('change', function () {
      var o = partner.options[partner.selectedIndex];
      var type = o ? o.getAttribute('data-type') : '';
      commission.disabled = type === 'courier';
      if (type === 'courier') commission.value = '0';
      if (type === 'dealer' && (!commission.value || commission.value === '0')) commission.value = '350';
    });

    byId('crm1SetGenRefresh').onclick = function () {
      var apply = byId('opsFinalSetApply');
      if (apply) apply.click();
      else window.dispatchEvent(new CustomEvent('crm1DataChanged', { detail: { type: 'settlement_refresh' } }));
      loadPartners();
    };

    byId('crm1SetGenGenerate').onclick = async function () {
      var p = partner.value;
      var f = from.value;
      var t = to.value;
      var c = Number(commission.value || 0);
      var opt = partner.options[partner.selectedIndex];
      var type = opt ? opt.getAttribute('data-type') : '';

      if (!p) { msg.textContent = 'Select Partner.'; return; }
      if (!f || !t) { msg.textContent = 'Select From and To dates.'; return; }
      if (t < f) { msg.textContent = 'To date cannot be before From date.'; return; }
      if (type === 'dealer' && c < 0) { msg.textContent = 'Commission cannot be negative.'; return; }

      var btn = byId('crm1SetGenGenerate');
      btn.disabled = true;
      btn.textContent = 'Generating…';
      msg.textContent = 'Generating settlement…';
      try {
        var rpc = await window.sb.rpc('generate_partner_settlement', {
          p_partner: p,
          p_from: f,
          p_to: t,
          p_commission: type === 'courier' ? 0 : c,
          p_forward_freight: 0,
          p_rto_charges: 0,
          p_other_charges: 0,
          p_cod_remitted: null,
          p_adjustment: 0
        });
        if (rpc.error) throw rpc.error;
        msg.textContent = 'Settlement generated successfully.';
        var apply = byId('opsFinalSetApply');
        if (apply) apply.click();
        await loadPartners();
      } catch (e) {
        msg.textContent = 'Generate error: ' + safe(e.message || e);
      } finally {
        btn.disabled = false;
        btn.textContent = 'Generate';
      }
    };

    loadPartners();
  }

  function bootObserver() {
    if (window.__crm1OpsSettlementVerificationObserver) return;
    window.__crm1OpsSettlementVerificationObserver = true;

    var observer = new MutationObserver(function () {
      addGenerationUI();
      if (verificationActive()) pauseVerificationTimers();
    });
    observer.observe(document.body, { childList: true, subtree: true });

    realSetInterval(function () {
      addGenerationUI();
      if (verificationActive()) pauseVerificationTimers();
    }, 700);

    document.addEventListener('pointerdown', function (e) {
      if (!verificationActive()) return;
      var b = e.target && e.target.closest ? e.target.closest('.crm1VerifyFix, button') : null;
      if (b) pauseVerificationTimers();
    }, true);

    setTimeout(addGenerationUI, 500);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', bootObserver, { once: true });
  else bootObserver();
})();
