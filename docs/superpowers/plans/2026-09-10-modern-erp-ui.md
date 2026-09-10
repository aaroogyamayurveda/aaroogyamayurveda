# Modern ERP UI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Upgrade CRM2 from a basic centered interface into a top-aligned, reusable, modern teleshopping ERP workspace without changing CRM1 or the CRM2 business backend.

**Architecture:** Keep the existing vanilla CRM2 shell and Supabase workflows intact. Add a reusable visual layer (`ui-modern.css` + `ui-modern.js`) that enhances the existing DOM after module renders, so business modules remain isolated while all pages share one design system. Extend Playwright with UI regression checks before accepting the change.

**Tech Stack:** Existing HTML/CSS/vanilla ES modules, Supabase client already used by CRM2, Playwright browser QA, GitHub Actions.

**Spec:** User-approved CRM2 modern ERP UI/UX master prompt in the conversation.

## Global Constraints

- CRM1 source and backend remain untouched.
- CRM2 remains isolated on its existing Supabase project.
- No service-role or third-party secrets in frontend code.
- No fake production records are added for visual polish.
- Existing role restrictions and business workflows must continue to pass.
- Content is top-aligned; no vertically centered ERP workspace.
- UI uses reusable KPI, filter, chart, status, quick-action, table and empty-state patterns.
- Browser QA must pass before merging/deployment claims.

### Task 1: UI regression contract
**Files:** `crm2/tests/specs/roles-fast.spec.js`
- [x] Add Playwright assertions for top-aligned ERP workspace, page header, KPI grid, analytics grid, funnel, quick actions, dashboard chart containers, and Leads filter/header primitives.
- [x] Push the test-only change and verify the browser job fails against the current deployed UI because the required primitives do not yet exist.

### Task 2: Shared visual system
**Files:** `crm2/ui-modern.css`
- [x] Add the top-aligned workspace, responsive shell, KPI cards, analytics cards, CSS bar charts, funnel, status cards, quick actions, alerts, progress and timeline primitives.
- [x] Keep the existing CRM2 palette and role-hiding CSS compatible.

### Task 3: DOM enhancement layer
**Files:** `crm2/ui-modern.js`
- [x] Observe CRM2 page renders and add the shared `erp-workspace` class.
- [x] Convert Dashboard into a KPI/funnel/analytics/quick-action workspace using only live values already rendered by CRM2.
- [x] Convert existing page title/filter structures into reusable page-header/filter-bar primitives.
- [x] Keep navigation actions wired to existing CRM2 buttons and preserve existing module logic.

### Task 4: Load the UI layer
**Files:** `crm2/index.html`
- [x] Load the modern stylesheet and enhancement module with unique cache-busting versions.
- [x] Keep existing module loading order intact.

### Task 5: Full verification and refinement
**Files:** existing CRM2 files only as needed.
- [ ] Run smoke and Playwright QA on the deployed build.
- [ ] Fix any UI regression, selector, role, or runtime issue at root cause.
- [ ] Verify desktop/tablet/mobile layout and absence of horizontal overflow.
- [ ] Verify CRM1 source isolation against the accepted CRM1 baseline.
- [ ] Verify final deployment and browser evidence.
