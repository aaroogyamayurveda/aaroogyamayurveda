# CRM2 implementation status

## Final verification snapshot
- CRM2 is the independent teleshopping ERP implementation under `crm2/`.
- Current repository HEAD: `4946b7303e1bd0a98e2bee4eca1d8f18d3d52b46` (documentation-only update after the verified application commit).
- Last application verification commit: `757bb74e5d25cca72357e7e5b6ba11733a1a1216`.
- CRM2 CI run `34441223847` completed successfully: syntax gate, smoke and authenticated Playwright browser QA all passed.
- A subsequent documentation-only HEAD commit triggered CRM2 CI run `34441461832`, which also completed successfully: syntax gate, smoke and authenticated Playwright browser QA all passed.
- Playwright evidence artifact was produced for the successful runs.
- GitHub Pages deployment run `34441461790` completed successfully; the browser suite exercises the deployed CRM2 URL `https://aaroogyamayurveda.in/crm2/`.

## Foundation
- Dedicated Supabase project: `ukpfmlhkvwgoqrrgdump` (ap-south-1).
- Required core project cost: ₹0/month.
- CRM1 production baseline: `dd571edde337faf525ea79012e90b1ff793b6b0e`.
- CRM1 source files remain outside the CRM2 change set; CRM2 uses its own frontend and Supabase project.
- 36 public CRM2 tables are present and all 36 have RLS enabled.
- CRM2 has independent Auth/profile roles, audit logging, operational RPCs, indexes and workflow history.

## Operational UI implemented
- Authentication and active-profile gate.
- Management dashboard KPI counts.
- Lead search by mobile/name/lead code.
- New lead creation with mobile duplicate protection.
- Lead detail with call history and follow-ups.
- Manual mobile calling via `tel:` and call outcome/disposition logging.
- Follow-up creation plus due/overdue/upcoming/completed/missed/reschedule workflow.
- Customer 360 with orders, addresses and notes.
- Fast order workflow with customer mobile matching, product selector, pricing, payment and priority.
- Order status lifecycle and status history.
- Verification queue with decision history and role-gated decision UI.
- Inventory visibility, SKU/warehouse selectors, movement history, low-stock attention and movement recording.
- Dealer/distributor CRUD, territory, commission, status and performance view.
- Shipment/delivery visibility plus NDR/RTO operation actions and queues.
- NDR reattempt/close and RTO inspection/restock workflows.
- Payments, COD remittance, dealer settlement and refund workflows.
- MIS summary, management drilldown and agent target-vs-actual reporting.
- Agent target create/edit with date-ranged order and revenue targets.
- CSV/XLSX import: local parse → preview → column mapping → validation/duplicate check → staged import rows → lead import.
- Import quality tools connected to staged-row errors, reusable mapping state and a 10 MB browser-side safety guard.
- Audit log visibility for manager roles.
- Admin/configuration workspace for users/roles, teams, dispositions, campaigns, products, warehouses and couriers.
- Lead assignment workspace with individual and bulk assignment plus assignment history.
- Role-aware navigation hides restricted workspaces.

## Operational backend hardening completed
- Fast-order workflow reuses an existing customer by mobile before creating a new customer.
- Fast-order workflow creates the corresponding order item and status history.
- Shipment status workflow validates supported states, writes the shipment-event timeline and synchronizes linked order status.
- NDR case creation avoids duplicate open cases; reattempt and close actions are implemented.
- RTO case creation avoids duplicate open cases; inspection and inventory-backed restock actions are implemented.
- Payment workflow maps to the actual payment schema.
- Finance adapters use server-side Supabase RPC functions for COD remittance, settlement, refund and inventory movement.
- Database audit triggers cover critical configuration, assignment, dealer and agent-target changes.
- Smoke coverage verifies operational workflow, finance, assignment, import, dealer, inventory, target and UI field mappings.
- Anonymous execution was revoked from operational helper functions including soft/permanent lead deletion, shipment transition and inventory movement helpers.

## Security / architecture
- Browser contains only the CRM2 publishable key.
- No service-role key or operational third-party credentials are stored in frontend code.
- Manual calling remains usable without a dialer integration.
- VICIdial/Asterisk and courier/payment integrations remain adapter boundaries for future server-side credentials.
- Lead/dealer removal is non-destructive by default; ordinary users do not have permanent-delete access.
- Google Drive is not part of CRM2 scope.
- Supabase Security Advisor currently has one external Auth warning: leaked-password protection is disabled. This is an Auth security configuration item, not a CRM2 application-code failure.
- Supabase Performance Advisor still reports policy/init-plan and unused-index findings; these are optimization items and have not been treated as security failures or changed blindly without representative workload evidence.

## External integrations
- VICIdial/Asterisk integration is architecturally isolated and can be provisioned later with server-side credentials.
- Courier/payment adapters are intentionally credential-free until real infrastructure/API credentials are funded and supplied.
- These optional integrations do not block the core CRM2 ERP, which operates with manual mobile calling and internal workflows.

## CRM1 isolation verification
- CRM1 baseline already had failing end-to-end audit results before CRM2 work (`dd571edde...`, run `34372212368`).
- Current CRM1 workflow failures therefore are not being attributed to CRM2 changes.
- CRM2 changes remain confined to CRM2/docs/workflow/migration files; CRM1 application source was not intentionally modified.

## Final acceptance
CRM2 core is considered release-ready after the successful current CRM2 CI smoke + authenticated Playwright pass, with the remaining Supabase Auth warning and optional external integrations explicitly documented above. Any future feature or integration change must re-enter the same test → commit → workflow → Playwright → verification cycle.