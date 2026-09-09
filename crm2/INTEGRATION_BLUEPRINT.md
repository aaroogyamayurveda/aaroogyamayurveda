# CRM2 Integration Blueprint

CRM2 is designed as the business ERP, with telephony and external systems treated as adapters rather than hard dependencies.

## Product patterns adopted

- **VICIdial:** list/campaign separation, column mapping, duplicate checks, priority/hopper concepts, callbacks, campaign-specific dispositions, time-window controls, API import/export, and call event synchronization.
- **NeoDove:** simple Excel bulk upload, campaign assignment, filters, real-time lead status, progressive/automated dialing, and multichannel-ready lead journey.
- **Teleshopping ERP pattern:** order verification, warehouse/stock, dealer/distributor routing, courier tracking, NDR/RTO, COD reconciliation, settlement and operational reports.

## CRM2 lead-import UX

1. Select source and campaign.
2. Upload CSV/Excel.
3. Preview rows before writing production data.
4. Map source columns to CRM2 fields.
5. Save mapping as a reusable template.
6. Validate required fields, phone formats, state/pincode and enum values.
7. Detect duplicates within the file and against existing CRM2 customer/lead records.
8. Show a clear summary: total, valid, duplicates, invalid, importable.
9. Import into staging first.
10. Require confirmation before production insert.
11. Record import batch, row-level result and error reason.
12. Offer a downloadable error report.
13. Optionally push accepted leads to a future VICIdial list/campaign adapter.

## Telephony adapter

CRM2 must work without a dialer. Manual mobile calling remains first-class. When VICIdial/Asterisk is available, the adapter synchronizes lead/list, agent, campaign, call event, disposition, callback and recording reference data. Credentials stay server-side.

## External adapters

Future adapters are intentionally interface-based for courier, payment/COD, WhatsApp/SMS/email, website/Meta lead capture, dealer feeds and accounting/Tally. No paid provider is required for the CRM2 core.

## Data ownership

CRM2 remains the system of record for customer, lead, order, verification, inventory, shipment, NDR/RTO, payment and audit state. External tools are integration endpoints, not alternate sources of truth.

## Zero-cost rule

Core workflows must run on the dedicated Supabase project plus static frontend/free hosting. Paid telephony, courier, WhatsApp/SMS, ad and accounting APIs are optional adapters and must never block CRM2 operation.
