# CRM2 Market Pattern Notes

Research-driven design notes for the CRM2 teleshopping ERP/call-center architecture.

## Import and campaign patterns

VICIdial supports API lead insertion, duplicate checking, custom fields, list/campaign organisation, callbacks and data export. NeoDove documents Excel-based bulk lead upload, campaign upload/update workflows and lead filtering/assignment.

CRM2 therefore uses a staged import pipeline: **Upload -> Preview -> Mapping -> Validation -> Duplicate Check -> Staging -> Approval -> Production -> Optional Dialer Push**.

## Dialer architecture

CRM2 supports two operating modes:

1. **Manual mobile:** lead -> tel: call -> return to CRM2 -> call outcome -> disposition -> follow-up/order.
2. **VICIdial/Asterisk:** CRM2 -> adapter/API -> campaign/list -> agent call -> event/disposition/callback -> CRM2.

The adapter must tolerate dialer downtime so agents can continue manual calling.

## Operational ERP pattern

The target business chain is:

**Lead -> Customer -> Call -> Follow-up -> Order -> Verification -> Warehouse -> Dealer/Courier -> Delivery -> NDR/RTO -> COD/Payment -> Settlement -> Accounts -> Reporting**.

## Design consequence

Every module should expose shared identifiers such as customer_id, lead_id, order_id, shipment_id, dealer_id, campaign_id, agent_id and audit_id. This enables drill-down from management dashboard to agent, lead, customer and order without duplicating business records.

## Scope boundary

CRM2 has **no Google Drive integration or Google Drive historical-data dependency**. All imports are through CRM2's own CSV/Excel staging workflow or explicitly configured future adapters.
