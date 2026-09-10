create policy calls_update on public.lead_calls
for update
using ((agent_id = auth.uid()) or crm2_is_manager())
with check ((agent_id = auth.uid()) or crm2_is_manager());

create index if not exists lead_calls_active_agent_idx
on public.lead_calls(agent_id, started_at)
where started_at is not null and ended_at is null;

create index if not exists followups_due_status_idx
on public.followups(due_at, status);
