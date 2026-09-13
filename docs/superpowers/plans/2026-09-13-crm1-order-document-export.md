# CRM1 Order Document Export Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restore CRM1 to `f026e58672ea7393741b9bc008a267f47973d56d` and add an isolated Order Document / Export workspace without changing Dealer/Courier Orders renderers.

**Architecture:** The known-good `f026e586...` state is the baseline. The document workspace is a separate self-contained module loaded by the existing CRM1 bootstrap. Dealer Orders, Courier Orders, Reports and Settlements remain untouched by the feature. Search accepts order number or mobile number and then offers independent PDF and Excel exports.

**Tech Stack:** Existing CRM1 JavaScript, Supabase client, jsPDF/html2canvas for PDF, SheetJS loaded only when Excel export is requested.

**Spec:** Approved 2026-09-13 design: no Print Order column in Dealer/Courier Orders; separate Order Document / Export page; search by Order Number or Mobile Number; PDF packing document with Aaroogyam Ayurveda header, order/date, customer/mobile/alternate mobile, complete address, product/qty/unit price/amount, total, payment mode, and “Not a GST Tax Invoice”; filename `Order-<order_no>.pdf`; Excel export of the same structured data.

## Global Constraints
- `f026e58672ea7393741b9bc008a267f47973d56d` remains the rollback anchor.
- Do not add observers or refresh loops to existing Orders, Reports or Settlements pages.
- Do not weaken DB final-status protection.
- Do not claim completion until fresh deployment tests are green.

### Task 1: Restore baseline
- [x] Move `main` back to `f026e586...`.
- [x] Create a backup branch for the pre-rollback state.
- [x] Start deployment verification from the restored baseline.

### Task 2: Add isolated document workspace
- [x] Create `crm1/crm1-order-document-export.js`.
- [x] Load it from `crm1/advanced-business-layer.js`.
- [x] Keep it out of Dealer/Courier renderer logic.
- [x] Gate the page so `super_admin`, `management`, `order_manager`, `agent`, `dealer`, and `courier_manager` do not receive it.
- [x] Search by order number or customer mobile.

### Task 3: PDF export
- [x] Generate an independent A4 packing/document PDF from the searched order data.
- [x] Use filename `Order-<order_no>.pdf`.
- [x] Include customer/address/items/payment/total and non-GST wording.

### Task 4: Excel export
- [x] Generate a real `.xlsx` workbook using SheetJS loaded on demand.
- [x] Include one row per order item with order/customer/payment/total context.

### Task 5: Verification
- [ ] Fresh CRM1 Playwright green.
- [ ] Final Audit green.
- [ ] Dealer/Courier Orders unchanged from baseline.
- [ ] Live manual smoke test of the new workspace for an allowed role.
