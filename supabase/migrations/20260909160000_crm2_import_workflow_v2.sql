alter table public.imports add column if not exists status text not null default 'uploaded';
alter table public.imports add column if not exists column_mapping jsonb not null default '{}'::jsonb;
alter table public.imports add column if not exists validation_summary jsonb not null default '{}'::jsonb;
alter table public.imports add column if not exists approved_by uuid references auth.users(id);
alter table public.imports add column if not exists approved_at timestamptz;
alter table public.imports add column if not exists source_campaign_id uuid references public.campaigns(id);

create table if not exists public.import_mapping_templates (
 id uuid primary key default gen_random_uuid(),
 name text not null,
 source text not null,
 mapping jsonb not null default '{}'::jsonb,
 created_by uuid not null references auth.users(id),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 unique(name, source)
);

alter table public.import_mapping_templates enable row level security;
drop policy if exists "import_mapping_templates_read" on public.import_mapping_templates;
drop policy if exists "import_mapping_templates_manage" on public.import_mapping_templates;
create policy "import_mapping_templates_read" on public.import_mapping_templates for select to authenticated using (true);
create policy "import_mapping_templates_manage" on public.import_mapping_templates for all to authenticated using (crm2_role() in ('super_admin','admin','manager','assistant_manager')) with check (crm2_role() in ('super_admin','admin','manager','assistant_manager'));
create index if not exists idx_imports_status_created on public.imports(status, created_at desc);
create index if not exists idx_import_rows_import_status on public.import_rows(import_id, status);
