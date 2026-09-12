create or replace function public.crm2_submit_disposition(p_payload jsonb)
returns jsonb language plpgsql security definer set search_path=public
as $$
declare
 v_user uuid:=auth.uid(); v_mobile text:=regexp_replace(coalesce(p_payload->>'mobile',''),'\\D','','g');
 v_l1 uuid:=nullif(p_payload->>'disposition_l1_id','')::uuid; v_l2 uuid:=nullif(p_payload->>'disposition_l2_id','')::uuid;
 v_l1name text; v_l2name text; v_customer public.customers%rowtype; v_lead public.leads%rowtype; v_call public.lead_calls%rowtype; v_order public.orders%rowtype; v_product public.products%rowtype;
 v_call_id uuid:=nullif(p_payload->>'call_id','')::uuid; v_due timestamptz; v_follow public.followups%rowtype; v_price numeric; v_address text;
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
   select * into v_product from public.products where id=nullif(p_payload->>'product_id','')::uuid and active=true;
   if v_product.id is null then raise exception 'PRODUCT_NOT_FOUND'; end if;
   v_price:=v_product.selling_price;
   v_address:=concat_ws(', ',nullif(trim(coalesce(p_payload->>'address','')),''),nullif(trim(coalesce(p_payload->>'post','')),''));
   if nullif(trim(coalesce(p_payload->>'name','')),'') is null then raise exception 'CUSTOMER_NAME_REQUIRED'; end if;
   if v_address is null or nullif(trim(coalesce(p_payload->>'city','')),'') is null or nullif(trim(coalesce(p_payload->>'state','')),'') is null or length(regexp_replace(coalesce(p_payload->>'pincode',''),'\\D','','g'))<>6 then raise exception 'DELIVERY_ADDRESS_REQUIRED'; end if;
   select * into v_order from public.crm2_create_order_workspace(
     jsonb_build_object('name',coalesce(p_payload->>'name',v_customer.name),'mobile',v_mobile,'alternate_mobile',nullif(p_payload->>'alternate_mobile',''),'age',nullif(p_payload->>'age',''),'gender',nullif(p_payload->>'gender','')),
     jsonb_build_object('address',v_address,'city',p_payload->>'city','state',p_payload->>'state','pincode',regexp_replace(coalesce(p_payload->>'pincode',''),'\\D','','g')),
     jsonb_build_object('payment_mode',coalesce(p_payload->>'payment_mode','COD'),'priority',case v_l2name when 'Express Order' then 'express' when 'Urgent Order' then 'urgent' else 'normal' end,'discount',0,'source',coalesce(p_payload->>'source','Manual'),'campaign_id',nullif(p_payload->>'campaign_id',''),'remarks',nullif(trim(coalesce(p_payload->>'remarks','')),'')),
     jsonb_build_object('product_id',v_product.id::text,'product_name',v_product.name,'sku',v_product.sku,'quantity',greatest(1,coalesce((p_payload->>'quantity')::integer,1)),'unit_price',v_price),v_lead.id);
   update public.lead_calls set disposition_id=v_l2,outcome=v_l2name where id=v_call.id;
   return jsonb_build_object('type','order','order_id',v_order.id,'order_code',v_order.order_code,'lead_id',v_lead.id,'call_id',v_call.id,'disposition_id',v_l2,'product_id',v_product.id,'unit_price',v_price);
 end if;
 if v_l1name='Non Lead' then update public.leads set status='closed' where id=v_lead.id; end if;
 return jsonb_build_object('type','disposition','lead_id',v_lead.id,'call_id',v_call.id,'disposition_id',v_l2,'level_1',v_l1name,'level_2',v_l2name);
end; $$;

grant execute on function public.crm2_submit_disposition(jsonb) to authenticated;
