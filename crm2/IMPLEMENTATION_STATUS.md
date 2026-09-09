# CRM2 implementation status

## Foundation
- Dedicated Supabase project: `ukpfmlhkvwgoqrrgdump` (ap-south-1)
- Required project cost confirmed: ₹0/month
- CRM1 production baseline: `dd571edde337faf525ea79012e90b1ff793b6b0e`
- CRM2 is isolated on `crm2/erp-foundation`; CRM1 files are not part of the CRM2 change set.
- All 35 public CRM2 business tables have RLS enabled.
- Supabase Security Advisor previously returned **0 security lints**; function ACLs were additionally hardened to remove anonymous execution of operational helpers.
- Foreign-key indexes were added for the operational schema.

## Operational UI implemented
- Authentication and active-profile gate
- Management dashboard KPI counts
- Lead search by mobile/name/lead code
- New lead creation with mobile duplicate protection
- Lead detail with call history and follow-ups
- Manual mobile calling via `tel:` and call outcome/disposition logging
- Follow-up creation plus enhanced due/overdue/upcoming/completed/missed/reschedule workflow
- Customer 360 with orders, addresses and notes
- Fast order workflow with customer mobile matching, product selector, pricing, payment and priority
- Order status lifecycle and status history
- Verification queue with decision history and role-gated decision UI
- Inventory visibility plus movement history and movement recording
- Dealer/distributor visibility
- Shipment/delivery visibility plus NDR/RTO operation actions and queues
- Payments, COD remittance, dealer settlement and refund workflows
- MIS summary and management drilldown by agent/campaign
- CSV/XLSX import: local parse → preview → column mapping → validation/duplicate check → staged import rows → lead import
- Import quality tools connected to actual staged-row errors and reusable mapping state
- Audit log visibility for manager roles
- **Admin/configuration workspace:** existing user role/team/active management, teams, dispositions, campaigns, products, warehouses and couriers
- **Lead assignment workspace:** manager assignment/reassignment to active agents/team leaders with lead-assignment history and bulk assignment
- **Role-aware navigation:** restricted workspaces are hidden according to CRM2 role

## Operational backend hardening completed
- Fast-order workflow reuses an existing customer by mobile before creating a new customer.
- Fast-order workflow creates the corresponding order item and status history.
- Shipment status workflow validates supported states and writes a correct shipment-event timeline.
- Shipment state changes synchronize the linked order status.
- NDR case creation uses the actual schema fields and avoids duplicate open cases.
- RTO case creation uses the actual schema fields and avoids duplicate open cases.
- Payment workflow maps to the actual payment schema.
- Finance adapters use server-side Supabase RPC functions for COD remittance, settlement, refund and inventory movement.
- Smoke coverage verifies shipment-event, NDR/RTO, order-item, finance, assignment, import and UI field mappings.
- `crm2_is_manager()` is SECURITY INVOKER with controlled execute privilege.
- Anonymous execution was revoked from operational helper functions including soft/permanent lead deletion, shipment transition and inventory movement helpers.

## Security / architecture
- Browser contains only the CRM2 publishable key.
- No service-role key or operational third-party credentials are stored in frontend code.
- Manual calling remains usable without a dialer integration.
- VICIdial/Asterisk and courier/payment integrations remain adapter boundaries for future server-side credentials.
- Soft-delete is used for lead deletion; ordinary users do not have permanent-delete access.
- Google Drive is not part of CRM2 scope.

## Remaining build track
- Add richer customer/order operational actions and broader bulk filtering/pagination.
- Complete dealer/distributor CRUD, territory, stock, commission and settlement management UI.
- Expand warehouse/SKU selectors, low-stock workflows and stock reservation/transfer operations.
- Expand NDR reattempt/action tracking and RTO inspection/restock/refund workflow UI.
- Complete accounts reconciliation, margin, courier-charge and settlement reporting.
- Expand company → manager → team → agent → lead → order drilldown and campaign ROI reporting.
- Add complete audit writes for all critical frontend configuration/assignment actions.
- Optimize RLS policies using cached auth expressions and consolidate duplicate permissive policies where safe.
- Improve import staging for same-file duplicate prevention before staging and more efficient large-file duplicate checks.
- Add server-side adapter endpoints for VICIdial/couriers only when relevant credentials/infrastructure are intentionally provisioned.
- Complete end-to-end browser QA and deployment verification before calling CRM2 production-ready.
