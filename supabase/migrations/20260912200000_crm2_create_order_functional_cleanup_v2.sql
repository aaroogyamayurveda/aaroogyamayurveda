update public.lead_calls set started_at=coalesce(started_at,created_at),ended_at=coalesce(ended_at,created_at),duration_seconds=coalesce(duration_seconds,0) where call_source='manual_mobile' and ended_at is null and started_at is null;

drop function if exists public.crm2_get_agent_status();
create or replace function public.crm2_get_agent_status()
returns jsonb language sql stable security definer set search_path=public
as $$ select coalesce((select jsonb_build_object('agent_id',agent_id,'status',status,'updated_at',updated_at) from public.crm2_agent_status where agent_id=auth.uid()), jsonb_build_object('agent_id',auth.uid(),'status','ready','updated_at',null::timestamptz)) $$;
revoke all on function public.crm2_get_agent_status() from public;
grant execute on function public.crm2_get_agent_status() to authenticated;

create or replace function public.crm2_log_manual_call(p_mobile text,p_outcome text default 'Manual Call Logged',p_notes text default null,p_duration_seconds integer default 0)
returns public.lead_calls language plpgsql security definer set search_path=public
as $$
declare v_user uuid:=auth.uid(); v_mobile text:=regexp_replace(coalesce(p_mobile,''),'\\D','','g'); v_customer public.customers%rowtype; v_lead public.leads%rowtype; v_call public.lead_calls%rowtype; v_ended timestamptz:=now(); v_started timestamptz:=v_ended-greatest(0,coalesce(p_duration_seconds,0))*interval '1 second';
begin
  if v_user is null then raise exception 'AUTH_REQUIRED'; end if;
  if length(v_mobile)<>10 or left(v_mobile,1) not in ('6','7','8','9') then raise exception 'INVALID_MOBILE'; end if;
  select * into v_customer from public.customers where mobile=v_mobile limit 1;
  select * into v_lead from public.leads where mobile=v_mobile and deleted_at is null and (assigned_to=v_user or assigned_to is null) order by created_at desc limit 1;
  if v_lead.id is null then
    insert into public.leads(customer_id,customer_name,mobile,source,assigned_to,status,priority,notes) values(v_customer.id,coalesce(v_customer.name,''),v_mobile,'Manual',v_user,'assigned','normal','Manual mobile call') returning * into v_lead;
  elsif v_lead.assigned_to is null then
    update public.leads set assigned_to=v_user,status=case when status='new' then 'assigned' else status end,updated_at=now() where id=v_lead.id returning * into v_lead;
  end if;
  insert into public.lead_calls(lead_id,customer_id,agent_id,call_source,direction,started_at,ended_at,duration_seconds,outcome,notes)
  values(v_lead.id,v_customer.id,v_user,'manual_mobile','outbound',v_started,v_ended,greatest(0,coalesce(p_duration_seconds,0)),coalesce(nullif(trim(p_outcome),''),'Manual Call Logged'),nullif(trim(coalesce(p_notes,'')),'')) returning * into v_call;
  return v_call;
end; $$;
