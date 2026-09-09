create or replace function public.crm2_role() returns crm2_role language sql stable security invoker set search_path = public as $$ select role from public.crm2_user_profiles where id=auth.uid() and active=true limit 1 $$;
create or replace function public.crm2_is_manager() returns boolean language sql stable security invoker set search_path = public as $$ select public.crm2_role() in ('super_admin','admin','manager','assistant_manager','team_leader','qa','verification','warehouse','dispatch','dealer_manager','accounts','mis') $$;
revoke all on function public.crm2_handle_new_user() from public,anon,authenticated;
revoke all on function public.crm2_list_active_agents() from public,anon,authenticated;
grant execute on function public.crm2_role() to authenticated;
grant execute on function public.crm2_is_manager() to authenticated;
create or replace function public.crm2_touch() returns trigger language plpgsql set search_path = public as $$ begin new.updated_at = now(); return new; end; $$;
