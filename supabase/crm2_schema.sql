-- Canonical CRM2 database migration. Applied to Supabase project ukpfmlhkvwgoqrrgdump.
-- Keep this file in source control as the auditable schema reference.
-- The live migration is managed by Supabase migrations.

create table if not exists public.crm2_schema_marker(id integer primary key, applied_at timestamptz not null default now());
insert into public.crm2_schema_marker(id) values (2) on conflict(id) do nothing;
