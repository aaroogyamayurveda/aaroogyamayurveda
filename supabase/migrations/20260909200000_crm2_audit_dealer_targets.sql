drop trigger if exists crm2_audit_dealer_change on public.dealers;
create trigger crm2_audit_dealer_change
after insert or update or delete on public.dealers
for each row execute function public.crm2_audit_row_change();

drop trigger if exists crm2_audit_agent_target_change on public.agent_targets;
create trigger crm2_audit_agent_target_change
after insert or update or delete on public.agent_targets
for each row execute function public.crm2_audit_row_change();
