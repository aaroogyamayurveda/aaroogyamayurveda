# CRM2 implementation status

## Foundation
- Dedicated Supabase project: `ukpfmlhkvwgoqrrgdump` (ap-south-1)
- Required project cost confirmed: ₹0/month
- CRM1 production baseline: `dd571edde337faf525ea79012e90b1ff793b6b0e`
- CRM2 is isolated on `crm2/erp-foundation`; CRM1 files are not part of the CRM2 change set.
- All public CRM2 tables have RLS enabled.
- Supabase security advisor currently returns **0 security lints**.
- Foreign-key indexes were added for the operational schema.

## Operational UI now implemented
- Authentication and active-profile gate
- Management dashboard KPI counts
- Lead search by mobile/name/lead code
- New lead creation with mobile duplicate protection
- Lead detail with call history and follow-ups
- Manual mobile calling via `tel:` and call outcome/disposition logging
- Follow-up creation, overdue visibility and completion
- Customer 360 with orders, addresses and notes
- Fast order creation with product, quantity, pricing, payment and priority
- Order status lifecycle and status history
- Verification queue and decision updates
- Inventory visibility
- Dealer/distributor visibility
- Shipment/delivery visibility
- Payments, COD remittance and settlement views
- MIS summary and order-status distribution
- CSV/XLSX import: local parse → preview → column mapping → validation/duplicate check → staged import rows → lead import
- Audit log visibility for manager roles

## Operational backend hardening completed
- Fast-order workflow now reuses an existing customer by mobile before creating a new customer.
- Fast-order workflow creates the corresponding order item and status history.
- Shipment status workflow validates supported states and writes a correct shipment-event timeline.
- Shipment state changes synchronize the linked order status.
- NDR case creation uses the actual schema fields and avoids duplicate open cases.
- RTO case creation uses the actual schema fields and avoids duplicate open cases.
- Payment workflow maps to the actual payment schema.
- Smoke coverage now verifies shipment-event, NDR/RTO and order-item field mappings.
- `crm2_is_manager()` was changed back to SECURITY INVOKER and its execute privilege is explicitly controlled; Security Advisor is clean again.

## Security / architecture
- Browser contains only the CRM2 publishable key.
- No service-role key or operational third-party credentials are stored in frontend code.
- Manual calling remains usable without a dialer integration.
- VICIdial/Asterisk and courier/payment integrations remain adapter boundaries for future server-side credentials.
- Soft-delete is used for lead deletion; ordinary users do not have permanent-delete access.
- Google Drive is not part of CRM2 scope.

## Remaining build track
- Complete manager/admin configuration screens (users, teams, dispositions, campaigns, products, warehouses, couriers).
- Add richer drill-down reports, assignment controls, inventory movement UI, NDR/RTO action UI and reconciliation workflows.
- Optimize RLS policies using cached auth expressions and consolidate duplicate permissive policies where safe.
- Add server-side adapter endpoints for VICIdial/couriers only when the relevant credentials/infrastructure are intentionally provisioned.
- Complete end-to-end browser QA and deployment verification before calling CRM2 production-ready.
