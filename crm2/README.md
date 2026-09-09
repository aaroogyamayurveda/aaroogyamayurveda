# Aaroogyam CRM2

CRM2 is the isolated next-generation teleshopping business ERP. It uses the dedicated Supabase project configured in `config.js` and is independent of CRM1.

## Zero-cost core
The core uses static hosting, browser APIs, Supabase Free-tier database/auth/RLS, and the Supabase JS CDN. Paid dialers, courier APIs, WhatsApp/SMS, ads and accounting integrations are optional adapters only.

## Initial user provisioning
Create the first Supabase Auth user in the CRM2 Supabase dashboard. The database trigger creates an `agent` profile automatically. Promote the first trusted user to `super_admin` using the SQL editor, then create additional users through the Supabase Auth dashboard. Never put passwords or service-role keys in this repository.
