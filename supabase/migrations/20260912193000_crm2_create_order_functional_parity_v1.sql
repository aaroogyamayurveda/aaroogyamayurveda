create table if not exists public.crm2_agent_status (
  agent_id uuid primary key references auth.users(id) on delete cascade,
  status text not null default 'ready' check (status in ('ready','pause','aux','washroom','lunch')),
  updated_at timestamptz not null default now()
);

alter table public.crm2_agent_status enable row level security;
drop policy if exists crm2_agent_status_select on public.crm2_agent_status;
drop policy if exists crm2_agent_status_insert on public.crm2_agent_status;
drop policy if exists crm2_agent_status_update on public.crm2_agent_status;
create policy crm2_agent_status_select on public.crm2_agent_status for select to authenticated using (agent_id=auth.uid() or public.crm2_is_manager());
create policy crm2_agent_status_insert on public.crm2_agent_status for insert to authenticated with check (agent_id=auth.uid());
create policy crm2_agent_status_update on public.crm2_agent_status for update to authenticated using (agent_id=auth.uid()) with check (agent_id=auth.uid());
grant select,insert,update on public.crm2_agent_status to authenticated;

create or replace function public.crm2_start_manual_call(p_mobile text)
returns jsonb language plpgsql security definer set search_path=public
as $$
declare
  v_user uuid:=auth.uid(); v_mobile text:=regexp_replace(coalesce(p_mobile,''),'\\D','','g');
  v_customer public.customers%rowtype; v_lead public.leads%rowtype; v_call public.lead_calls%rowtype; v_started timestamptz:=now();
begin
  if v_user is null then raise exception 'AUTH_REQUIRED'; end if;
  if length(v_mobile)<>10 or left(v_mobile,1) not in ('6','7','8','9') then raise exception 'INVALID_MOBILE'; end if;
  if not exists(select 1 from public.crm2_user_profiles p where p.id=v_user and p.active=true and p.role in ('agent','team_leader','manager','admin','super_admin')) then raise exception 'AGENT_ACCESS_DENIED'; end if;
  select * into v_customer from public.customers where mobile=v_mobile limit 1;
  select * into v_lead from public.leads where mobile=v_mobile and deleted_at is null and (assigned_to=v_user or assigned_to is null) order by created_at desc limit 1;
  if v_lead.id is null then
    insert into public.leads(customer_id,customer_name,mobile,source,product_name,assigned_to,status,priority,notes)
    values(v_customer.id,coalesce(v_customer.name,''),v_mobile,'Manual',null,v_user,'assigned','normal','Manual mobile call') returning * into v_lead;
  elsif v_lead.assigned_to is null then
    update public.leads set assigned_to=v_user,status=case when status='new' then 'assigned' else status end,updated_at=now() where id=v_lead.id returning * into v_lead;
  end if;
  if exists(select 1 from public.lead_calls where agent_id=v_user and ended_at is null and call_source='manual_mobile') then raise exception 'ACTIVE_CALL_EXISTS'; end if;
  insert into public.lead_calls(lead_id,customer_id,agent_id,call_source,direction,started_at,ended_at,duration_seconds,outcome,notes)
  values(v_lead.id,v_customer.id,v_user,'manual_mobile','outbound',v_started,null,0,null,null) returning * into v_call;
  return jsonb_build_object('call_id',v_call.id,'lead_id',v_lead.id,'customer_id',v_customer.id,'started_at',v_started);
end; $$;

create or replace function public.crm2_end_manual_call(p_call_id uuid,p_outcome text default null,p_notes text default null)
returns public.lead_calls language plpgsql security definer set search_path=public
as $$
declare v_user uuid:=auth.uid(); v_call public.lead_calls%rowtype; v_ended timestamptz:=now();
begin
  if v_user is null then raise exception 'AUTH_REQUIRED'; end if;
  select * into v_call from public.lead_calls where id=p_call_id and agent_id=v_user for update;
  if v_call.id is null then raise exception 'CALL_NOT_FOUND'; end if;
  if v_call.ended_at is not null then return v_call; end if;
  update public.lead_calls set ended_at=v_ended,duration_seconds=greatest(0,round(extract(epoch from (v_ended-coalesce(started_at,v_ended))))::integer),outcome=nullif(trim(coalesce(p_outcome,'')),''),notes=nullif(trim(coalesce(p_notes,'')),'') where id=v_call.id returning * into v_call;
  return v_call;
end; $$;

create or replace function public.crm2_log_manual_call(p_mobile text,p_outcome text default 'Manual Call Logged',p_notes text default null,p_duration_seconds integer default 0)
returns public.lead_calls language plpgsql security definer set search_path=public
as $$
declare v_user uuid:=auth.uid(); v_mobile text:=regexp_replace(coalesce(p_mobile,''),'\\D','','g'); v_customer public.customers%rowtype; v_lead public.leads%rowtype; v_call public.lead_calls%rowtype;
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
  values(v_lead.id,v_customer.id,v_user,'manual_mobile','outbound',null,null,greatest(0,coalesce(p_duration_seconds,0)),coalesce(nullif(trim(p_outcome),''),'Manual Call Logged'),nullif(trim(coalesce(p_notes,'')),'')) returning * into v_call;
  return v_call;
end; $$;

create or replace function public.crm2_set_agent_status(p_status text)
returns public.crm2_agent_status language plpgsql security definer set search_path=public
as $$
declare v_user uuid:=auth.uid(); v_row public.crm2_agent_status%rowtype; v_status text:=lower(trim(coalesce(p_status,'')));
begin
  if v_user is null then raise exception 'AUTH_REQUIRED'; end if;
  if v_status not in ('ready','pause','aux','washroom','lunch') then raise exception 'INVALID_AGENT_STATUS'; end if;
  if not exists(select 1 from public.crm2_user_profiles where id=v_user and active=true and role in ('agent','team_leader','manager','admin','super_admin')) then raise exception 'AGENT_ACCESS_DENIED'; end if;
  insert into public.crm2_agent_status(agent_id,status,updated_at) values(v_user,v_status,now()) on conflict(agent_id) do update set status=excluded.status,updated_at=excluded.updated_at returning * into v_row;
  return v_row;
end; $$;

create or replace function public.crm2_get_agent_status()
returns public.crm2_agent_status language sql stable security definer set search_path=public
as $$ select * from public.crm2_agent_status where agent_id=auth.uid() $$;

create or replace function public.crm2_submit_disposition(p_payload jsonb)
returns jsonb language plpgsql security definer set search_path=public
as $$
declare
 v_user uuid:=auth.uid(); v_mobile text:=regexp_replace(coalesce(p_payload->>'mobile',''),'\\D','','g');
 v_l1 uuid:=nullif(p_payload->>'disposition_l1_id','')::uuid; v_l2 uuid:=nullif(p_payload->>'disposition_l2_id','')::uuid;
 v_l1name text; v_l2name text; v_customer public.customers%rowtype; v_lead public.leads%rowtype; v_call public.lead_calls%rowtype; v_order public.orders%rowtype;
 v_call_id uuid:=nullif(p_payload->>'call_id','')::uuid; v_due timestamptz; v_follow public.followups%rowtype;
begin
 if v_user is null then raise exception 'AUTH_REQUIRED'; end if;
 if length(v_mobile)<>10 then raise exception 'INVALID_MOBILE'; end if;
 if v_l1 is null or v_l2 is null then raise exception 'DISPOSITION_REQUIRED'; end if;
 select name into v_l1name from public.disposition_levels where id=v_l1 and active=true and level_no=1;
 select name into v_l2name from public.disposition_levels where id=v_l2 and active=true and level_no=2 and parent_id=v_l1;
 if v_l1name is null or v_l2name is null then raise exception 'INVALID_DISPOSITION'; end if;
 select * into v_customer from public.customers where mobile=v_mobile limit 1;
 select * into v_lead from public.leads where mobile=v_mobile and deleted_at is null and (assigned_to=v_user or assigned_to is null or public.crm2_is_manager()) order by created_at desc limit 1;
 if v_lead.id is null then
   insert into public.leads(customer_id,customer_name,mobile,source,assigned_to,status,priority,notes) values(v_customer.id,coalesce(v_customer.name,''),v_mobile,'Manual',v_user,'assigned','normal',nullif(p_payload->>'remarks','')) returning * into v_lead;
 elsif v_lead.assigned_to is null then
   update public.leads set assigned_to=v_user,status=case when status='new' then 'assigned' else status end,updated_at=now() where id=v_lead.id returning * into v_lead;
 end if;
 if v_call_id is null then
   insert into public.lead_calls(lead_id,customer_id,agent_id,call_source,direction,started_at,ended_at,duration_seconds,outcome,notes,disposition_id)
   values(v_lead.id,v_customer.id,v_user,'manual_mobile','outbound',null,now(),greatest(0,coalesce((p_payload->>'duration_seconds')::integer,0)),v_l2name,nullif(trim(coalesce(p_payload->>'remarks','')),''),v_l2) returning * into v_call;
 else
   update public.lead_calls set disposition_id=v_l2,outcome=v_l2name,notes=nullif(trim(coalesce(p_payload->>'remarks','')),'') where id=v_call_id and agent_id=v_user returning * into v_call;
   if v_call.id is null then raise exception 'CALL_NOT_FOUND'; end if;
 end if;
 update public.leads set disposition_id=v_l2,notes=coalesce(nullif(trim(coalesce(p_payload->>'remarks','')),''),notes),updated_at=now() where id=v_lead.id;
 if v_l2name='Call Back' then
   v_due=nullif(p_payload->>'callback_at','')::timestamptz;
   if v_due is null or v_due<=now() then raise exception 'CALLBACK_TIME_REQUIRED'; end if;
   insert into public.followups(lead_id,customer_id,order_id,assigned_to,due_at,priority,reason,status,reminder) values(v_lead.id,v_customer.id,null,v_user,v_due,coalesce(nullif(p_payload->>'callback_priority','')::crm2_priority,'normal'),coalesce(nullif(trim(coalesce(p_payload->>'remarks','')),''),'Callback requested'),'pending',true) returning * into v_follow;
   update public.leads set status='callback',next_followup=v_due where id=v_lead.id;
   return jsonb_build_object('type','callback','lead_id',v_lead.id,'call_id',v_call.id,'followup_id',v_follow.id,'disposition_id',v_l2);
 end if;
 if v_l1name='Sales' and v_l2name in ('Express Order','Urgent Order','Fresh Order') then
   select * into v_order from public.crm2_create_order_workspace(
     jsonb_build_object('name',coalesce(p_payload->>'name',v_customer.name),'mobile',v_mobile,'alternate_mobile',nullif(p_payload->>'alternate_mobile',''),'age',nullif(p_payload->>'age',''),'gender',nullif(p_payload->>'gender','')),
     jsonb_build_object('address',p_payload->>'address','city',p_payload->>'city','state',p_payload->>'state','pincode',p_payload->>'pincode'),
     jsonb_build_object('payment_mode',coalesce(p_payload->>'payment_mode','COD'),'priority',case v_l2name when 'Express Order' then 'express' when 'Urgent Order' then 'urgent' else 'normal' end,'discount',0,'source',coalesce(p_payload->>'source','Manual'),'campaign_id',nullif(p_payload->>'campaign_id',''),'remarks',nullif(trim(coalesce(p_payload->>'remarks','')),'')),
     jsonb_build_object('product_id',p_payload->>'product_id','product_name',p_payload->>'product_name','sku',p_payload->>'sku','quantity',greatest(1,coalesce((p_payload->>'quantity')::integer,1)),'unit_price',coalesce((p_payload->>'unit_price')::numeric,0)),v_lead.id);
   update public.lead_calls set disposition_id=v_l2,outcome=v_l2name where id=v_call.id;
   return jsonb_build_object('type','order','order_id',v_order.id,'order_code',v_order.order_code,'lead_id',v_lead.id,'call_id',v_call.id,'disposition_id',v_l2);
 end if;
 if v_l1name='Non Lead' then update public.leads set status='closed' where id=v_lead.id; end if;
 return jsonb_build_object('type','disposition','lead_id',v_lead.id,'call_id',v_call.id,'disposition_id',v_l2,'level_1',v_l1name,'level_2',v_l2name);
end; $$;

revoke all on function public.crm2_start_manual_call(text) from public;
revoke all on function public.crm2_end_manual_call(uuid,text,text) from public;
revoke all on function public.crm2_log_manual_call(text,text,text,integer) from public;
revoke all on function public.crm2_set_agent_status(text) from public;
revoke all on function public.crm2_get_agent_status() from public;
revoke all on function public.crm2_submit_disposition(jsonb) from public;
grant execute on function public.crm2_start_manual_call(text) to authenticated;
grant execute on function public.crm2_end_manual_call(uuid,text,text) to authenticated;
grant execute on function public.crm2_log_manual_call(text,text,text,integer) to authenticated;
grant execute on function public.crm2_set_agent_status(text) to authenticated;
grant execute on function public.crm2_get_agent_status() to authenticated;
grant execute on function public.crm2_submit_disposition(jsonb) to authenticated;
