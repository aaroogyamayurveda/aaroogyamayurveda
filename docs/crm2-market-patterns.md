# CRM2 Market Pattern Notes

Research-driven design notes for the CRM2 ERP/call-center architecture.

## Import and campaign patterns

VICIdial supports API lead insertion, duplicate checking, custom fields, list/campaign organisation, callbacks and data export. Its broader data model treats lists as a key campaign input and supports external event synchronization.

NeoDove documents Excel-based bulk lead upload, campaign upload/update workflows and lead filtering/assignment.

CRM2 therefore uses a staged import pipeline instead of a simple file-to-table upload: **Upload -> Preview -> Mapping -> Validation -> Duplicate Check -> Staging -> Approval -> Production -> Optional Dialer Push**.

## Dialer architecture

CRM2 will support two operating modes:

1. **Manual mobile:** lead -> tel: call -> return to CRM2 -> call outcome -> disposition -> follow-up/order.
2. **VICIdial/Asterisk:** CRM2 -> adapter/API -> campaign/list -> agent call -> event/disposition/callback -> CRM2.

The adapter must tolerate dialer downtime so agents can continue manual calling.

## Operational ERP pattern

The application is intentionally broader than a telecalling CRM. The target business chain is:

**Lead -> Customer -> Call -> Follow-up -> Order -> Verification -> Warehouse -> Dealer/Courier -> Delivery -> NDR/RTO -> COD/Payment -> Settlement -> Accounts -> Reporting**.

## Design consequence

Every module should expose the same identifiers and timeline links: customer_id, lead_id, order_id, shipment_id, dealer_id, campaign_id, agent_id and audit_id. This makes drill-down possible from company dashboard to agent, lead, customer and order without duplicating business records.

## Sources consulted

- VICIdial official features/API documentation
- NeoDove official Excel upload and CRM feature material
- Teleshopping CRM/ERP patterns already researched for Kansoft ATS, LeadSquared, Jugnu, Storedum, Saptel, Cratio, Runo and TeleCRM
