alter table public.lead_sources enable row level security;
alter table public.campaigns enable row level security;

drop policy if exists "lead_sources_read" on public.lead_sources;
drop policy if exists "lead_sources_manage" on public.lead_sources;
drop policy if exists "campaigns_read" on public.campaigns;
drop policy if exists "campaigns_manage" on public.campaigns;

create policy "lead_sources_read_authenticated" on public.lead_sources for select to authenticated using (true);
create policy "lead_sources_manage_admin" on public.lead_sources for all to authenticated using (crm2_role() in ('super_admin','admin')) with check (crm2_role() in ('super_admin','admin'));
create policy "campaigns_read_authenticated" on public.campaigns for select to authenticated using (true);
create policy "campaigns_manage_manager" on public.campaigns for all to authenticated using (crm2_role() in ('super_admin','admin','manager','assistant_manager')) with check (crm2_role() in ('super_admin','admin','manager','assistant_manager'));
