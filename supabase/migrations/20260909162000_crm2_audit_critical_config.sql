create or replace function public.crm2_audit_row_change() returns trigger language plpgsql security invoker as $$ begin insert into public.audit_logs(actor_id,action,entity_type,entity_id,metadata) values (auth.uid(), TG_OP, TG_TABLE_NAME, coalesce(new.id,old.id), jsonb_build_object('source','database_trigger')); return coalesce(new,old); end; $$;

drop trigger if exists crm2_audit_profile_change on public.crm2_user_profiles;
create trigger crm2_audit_profile_change after update on public.crm2_user_profiles for each row execute function public.crm2_audit_row_change();

drop trigger if exists crm2_audit_team_change on public.crm2_teams;
create trigger crm2_audit_team_change after insert or update on public.crm2_teams for each row execute function public.crm2_audit_row_change();

drop trigger if exists crm2_audit_disposition_change on public.disposition_levels;
create trigger crm2_audit_disposition_change after insert or update on public.disposition_levels for each row execute function public.crm2_audit_row_change();

drop trigger if exists crm2_audit_campaign_change on public.campaigns;
create trigger crm2_audit_campaign_change after insert or update on public.campaigns for each row execute function public.crm2_audit_row_change();

drop trigger if exists crm2_audit_product_change on public.products;
create trigger crm2_audit_product_change after insert or update on public.products for each row execute function public.crm2_audit_row_change();

drop trigger if exists crm2_audit_warehouse_change on public.warehouses;
create trigger crm2_audit_warehouse_change after insert or update on public.warehouses for each row execute function public.crm2_audit_row_change();

drop trigger if exists crm2_audit_courier_change on public.couriers;
create trigger crm2_audit_courier_change after insert or update on public.couriers for each row execute function public.crm2_audit_row_change();

drop trigger if exists crm2_audit_assignment_change on public.lead_assignments;
create trigger crm2_audit_assignment_change after insert or update on public.lead_assignments for each row execute function public.crm2_audit_row_change();
