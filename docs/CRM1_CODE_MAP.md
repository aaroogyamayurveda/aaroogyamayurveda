# CRM1 Code Map / Cleanup Audit

This document maps the CRM1 runtime to the JavaScript files that implement it and records files that should be reviewed for removal only after CI confirms they are not runtime dependencies.

## Runtime entry point

- `crm1/index.html` — CRM1 shell, login form, base CSS, core page markup/forms, and the only direct `<script>` entry for the advanced layer.
- `crm1/advanced-business-layer.js` — ordered, non-blocking runtime bootstrap. It is the authoritative list of advanced CRM1 modules currently loaded by CRM1.
- `crm1/advanced-business-layer.core.js` — core advanced business logic, data access helpers and the Campaigns / Lead Management / Customer 360 sections.

## Active modules loaded by `advanced-business-layer.js`

### Platform / runtime
- `crm1-supabase-runtime-init.js` — Supabase runtime initialization.
- `crm1-api-compat.js` — compatibility helpers between core/legacy APIs.
- `crm1-render-stability.js` — render/load stability guards.
- `crm1-theme-font-safe.js` — current safe theme/font layer. This is loaded; the older `crm1-ui-preferences.js` is not loaded by the bootstrap.

### Agent / calling / lead workflow
- `crm1-agent-workspace.js` — agent workspace behavior.
- `crm1-call-console.js` — manual call console and start/end call lifecycle UI.
- `crm1-call-disposition.js` — call disposition handling.
- `crm1-lead-call-bridge.js` — lead-to-call context bridge.
- `crm1-lead-workqueue.js` — lead work queue.
- `crm1-workforce-runtime.js` / `crm1-workforce-ui-bridge.js` — workforce runtime/UI bridge.
- `crm1-followup-verification-fix.js` — follow-up verification stability.
- `crm1-followups-queue-fix.js` — follow-up queue handling.
- `crm1-followup-customer-context-fix.js` — follow-up/customer context.
- `crm1-followup-lead-status-sync.js` — lead/follow-up status synchronization.

### Orders / delivery / operations
- `crm1-order-assignment-verification-guard.js` — order assignment and verification guard.
- `crm1-order-timeline.js` — order timeline.
- `crm1-delivery-workflow.js` — delivery lifecycle/workflow.
- `crm1-ist-ops-fix.js` / `crm1-ist-ops-final-guard.js` — IST operations fixes/guard.
- `crm1-ops-settlement-verification-stability.js` — settlements/verification stability.
- `crm1-pin-rules-detailed.js` — PIN rules.
- `crm1-inventory-detailed.js` — inventory.
- `crm1-priority-order-data-fix.js` — priority order data.
- `crm1-order-lead-finalizer.js` — order/lead finalization.
- `crm1-disposition-order-validation.js` — order validation from disposition.
- `crm1-preserve-edits-on-endcall.js` — preserve edits around end-call lifecycle.

### Reports / management / partner operations
- `crm1-manager-reports.js` — manager reports.
- `crm1-agent-performance-detailed.js` — agent performance.
- `crm1-advanced-reports-detailed.js` — advanced reports.
- `crm1-partner-data-isolation-final.js` — partner data isolation.
- `crm1-role-visibility-final.js` — role-specific visibility.
- `crm1-agent-dashboard-orders-scope-fix.js` — agent dashboard order scoping.
- `crm1-agent-order-search-customer-mobile-fix.js` — agent order-search customer/mobile resolution.
- `crm1-verification-followup-stability-final.js` — verification/follow-up stability.
- `crm1-qa-detailed-v6.js` — QA/report functionality.
- `crm1-production-suite.js` / `crm1-production-suite-retry-v2.js` — production regression/repair layer.
- `crm1-navigation-ui-v8.js` — current navigation UI layer.

## Files that are likely historical / redundant and should NOT be deleted blindly

These are strong cleanup candidates because their names indicate earlier revisions and they are not listed in the current bootstrap. They still need a reference scan before deletion because another module could load one dynamically.

- `crm1/crm1-ui-preferences.js` — older theme/font implementation; current bootstrap uses `crm1-theme-font-safe.js` instead.
- `crm1/crm1-navigation-ui.js`
- `crm1/crm1-navigation-ui-v6.js`
- `crm1/crm1-navigation-ui-v7.js`
- `crm1/crm1-ist-ops-fix-v3.js`
- `crm1/crm1-production-suite-retry.js`
- `crm1/crm1-qa-detailed.js`
- `crm1/crm1-followup-queue.js`
- `crm1/crm1-partner-orders-final.js`
- `crm1/crm1-partner-order-table-final-fallback.js`
- `crm1/crm1-partner-orders-loader.js`
- `crm1/crm1-partner-performance-date-filter.js`
- `crm1/crm1-partner-performance-final.js`
- `crm1/crm1-partner-performance-report.js`
- `crm1/crm1-partner-role-ui-final-guard.js`
- `crm1/crm1-settlements-detailed.js`
- `crm1/crm1-workforce.js`
- `crm1/crm1-workforce-v2.js`
- `crm1/crm1-workforce-ui-bridge.js` is active; do not confuse it with the older `crm1-workforce.js` / `crm1-workforce-v2.js` files.

## Non-runtime test / trigger files

These are not production CRM JavaScript. They exist only to trigger or support CI tests and should be kept only if their workflows still use them:

- `crm1/.playwright-trigger`
- `crm1/.playwright-trigger-20260825-1810`
- `crm1/.playwright-trigger-fresh-20260825-1905`
- `crm1/.playwright-trigger-nav-v4`
- `crm1/.playwright-trigger-nav-v5`
- `crm1/partner-orders-test-marker.txt`
- `tests/crm1/.partner-orders-final-trigger`
- `tests/crm1/partner-orders-final-trigger.txt`

## Important cleanup rule

Do not delete a JS file solely because it is absent from `advanced-business-layer.js`. The cleanup audit should first scan all CRM1 JS files for direct/dynamic references and then run the full Playwright regression suite. Only files that are both unreferenced and covered by passing regression tests should be removed.
