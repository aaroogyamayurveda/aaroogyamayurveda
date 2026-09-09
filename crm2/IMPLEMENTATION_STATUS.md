# CRM2 implementation status

## Foundation
- Dedicated Supabase project: `ukpfmlhkvwgoqrrgdump` (ap-south-1)
- Required project cost confirmed: ₹0/month
- CRM1 production baseline: `dd571edde337faf525ea79012e90b1ff793b6b0e`
- CRM2 is isolated on `crm2/erp-foundation`; CRM1 files are not part of the CRM2 change set.
- All 35 public CRM2 business tables have RLS enabled.
- Supabase Security Advisor currently returns **0 security lints**; function ACLs also remove anonymous execution of operational helpers.
- Foreign-key indexes were added for the operational schema.

## Operational UI implemented
- Authentication and active-profile gate
- Management dashboard KPI counts
- Lead search by mobile/name/lead code
- New lead creation with mobile duplicate protection
- Lead detail with call history and follow-ups
- Manual mobile calling via `tel:` and call outcome/disposition logging
- Follow-up creation plus due/overdue/upcoming/completed/missed/reschedule workflow
- Customer 360 with orders, addresses and notes
- Fast order workflow with customer mobile matching, product selector, pricing, payment and priority
- Order status lifecycle and status history
- Verification queue with decision history and role-gated decision UI
- Inventory visibility, SKU/warehouse selectors, movement history, low-stock attention and movement recording
- Dealer/distributor CRUD, territory, commission, status and performance view
- Shipment/delivery visibility plus NDR/RTO operation actions and queues
- NDR reattempt/close and RTO inspection/restock workflows
- Payments, COD remittance, dealer settlement and refund workflows
- MIS summary, management drilldown and agent target-vs-actual reporting
- Agent target create/edit with date-ranged order and revenue targets
- CSV/XLSX import: local parse → preview → column mapping → validation/duplicate check → staged import rows → lead import
- Import quality tools connected to actual staged-row errors, reusable mapping state and a 10 MB browser-side safety guard
- Audit log visibility for manager roles
- Admin/configuration workspace for users/roles, teams, dispositions, campaigns, products, warehouses and couriers
- Lead assignment workspace with individual and bulk assignment plus assignment history
- Role-aware navigation hides restricted workspaces

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

## Remaining blockers / final verification
- Authenticated browser QA is blocked until at least one CRM2 Supabase Auth user/profile exists; the connected Supabase tooling available here cannot create an Auth user with a password. Once an admin creates the first account and promotes its CRM2 profile to `super_admin`, authenticated browser QA can proceed.
- Final deployment verification remains pending; no production-ready claim should be made before the authenticated browser pass.
- RLS performance advisor still reports 30 `auth_rls_initplan` warnings and 15 multiple-permissive-policy warnings. These are performance findings, not security lints; changing them safely requires measuring policy behavior/query plans before consolidation.
- 64 unused-index INFO notices remain; these should not be removed blindly because the application is not yet exercised with representative production traffic.
- VICIdial/courier server-side adapters remain intentionally unprovisioned until real infrastructure/credentials are supplied.
