create or replace function public.crm2_assert_no_duplicate_active_order(p_mobile text,p_product_id uuid,p_product_name text,p_unit_price numeric)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_mobile text := regexp_replace(coalesce(p_mobile,''),'\D','','g');
  v_key text;
  v_order_code text;
begin
  v_key := coalesce(v_mobile,'')||'|'||coalesce(p_product_id::text,lower(trim(coalesce(p_product_name,''))))||'|'||to_char(coalesce(p_unit_price,0),'FM999999999999990.00');
  perform pg_advisory_xact_lock(hashtextextended(v_key,0));
  select o.order_code into v_order_code
  from public.orders o
  join public.customers c on c.id=o.customer_id
  join public.order_items oi on oi.order_id=o.id
  where c.mobile=v_mobile
    and (case when p_product_id is not null then oi.product_id=p_product_id else lower(trim(oi.product_name))=lower(trim(coalesce(p_product_name,''))) end)
    and oi.unit_price=coalesce(p_unit_price,0)
    and o.status not in ('delivered','rto','cancelled')
  order by o.created_at desc limit 1;
  if v_order_code is not null then
    raise exception 'DUPLICATE_ACTIVE_ORDER:%',v_order_code;
  end if;
end;
$$;
revoke all on function public.crm2_assert_no_duplicate_active_order(text,uuid,text,numeric) from public,anon;
grant execute on function public.crm2_assert_no_duplicate_active_order(text,uuid,text,numeric) to authenticated;

create or replace function public.crm2_create_order_workspace(p_customer jsonb,p_address jsonb,p_order jsonb,p_item jsonb,p_lead_id uuid default null)
returns public.orders
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_customer_id uuid;
  v_lead_id uuid := p_lead_id;
  v_lead public.leads%rowtype;
  v_order public.orders%rowtype;
  v_mobile text;
  v_name text;
  v_alt text;
  v_qty integer;
  v_price numeric;
  v_discount numeric;
  v_total numeric;
  v_product_id uuid;
  v_product_name text;
  v_sku text;
  v_address text;
  v_city text;
  v_state text;
  v_pincode text;
  v_source text;
  v_priority crm2_priority;
  v_payment text;
begin
  if v_user is null then raise exception 'AUTH_REQUIRED'; end if;
  v_mobile := regexp_replace(coalesce(p_customer->>'mobile',''), '\D', '', 'g');
  if length(v_mobile) <> 10 or left(v_mobile,1) not in ('6','7','8','9') then raise exception 'INVALID_MOBILE'; end if;
  v_name := nullif(trim(coalesce(p_customer->>'name','')), '');
  if v_name is null then raise exception 'CUSTOMER_NAME_REQUIRED'; end if;
  v_alt := nullif(regexp_replace(coalesce(p_customer->>'alternate_mobile',''), '\D', '', 'g'), '');
  if v_alt = '' then v_alt := null; end if;
  if v_alt is not null and (length(v_alt) <> 10 or left(v_alt,1) not in ('6','7','8','9')) then raise exception 'INVALID_ALTERNATE_MOBILE'; end if;
  v_address := nullif(trim(coalesce(p_address->>'address','')), '');
  v_city := nullif(trim(coalesce(p_address->>'city','')), '');
  v_state := nullif(trim(coalesce(p_address->>'state','')), '');
  v_pincode := nullif(regexp_replace(coalesce(p_address->>'pincode',''), '\D', '', 'g'), '');
  if v_address is null or v_city is null or v_state is null or length(v_pincode) <> 6 then raise exception 'DELIVERY_ADDRESS_REQUIRED'; end if;
  select c.id into v_customer_id from public.customers c where c.mobile=v_mobile limit 1;
  if v_customer_id is null then
    insert into public.customers(name,mobile,alternate_mobile,age,gender,state,city,pincode)
    values(v_name,v_mobile,v_alt,nullif(p_customer->>'age','')::integer,nullif(p_customer->>'gender',''),v_state,v_city,v_pincode)
    returning id into v_customer_id;
  end if;
  if v_lead_id is not null then
    select * into v_lead from public.leads where id=v_lead_id for update;
    if not found then raise exception 'LEAD_NOT_FOUND'; end if;
    if not (public.crm2_is_manager() or v_lead.assigned_to=v_user) then raise exception 'LEAD_ACCESS_DENIED'; end if;
  else
    select * into v_lead from public.leads where mobile=v_mobile and deleted_at is null and (public.crm2_is_manager() or assigned_to=v_user) order by created_at desc limit 1;
    if found then v_lead_id:=v_lead.id; end if;
  end if;
  if v_lead_id is null then
    v_source:=coalesce(nullif(p_order->>'source',''),'Manual');
    insert into public.leads(customer_id,customer_name,mobile,alternate_mobile,age,gender,address,state,city,pincode,source,campaign_id,product_name,assigned_to,status,priority,notes)
    values(v_customer_id,v_name,v_mobile,v_alt,nullif(p_customer->>'age','')::integer,nullif(p_customer->>'gender',''),v_address,v_state,v_city,v_pincode,v_source,nullif(p_order->>'campaign_id','')::uuid,nullif(p_item->>'product_name',''),v_user,'assigned',coalesce(nullif(p_order->>'priority','')::crm2_priority,'normal'::crm2_priority),nullif(p_order->>'remarks',''))
    returning * into v_lead;
    v_lead_id:=v_lead.id;
  else
    update public.leads set customer_id=v_customer_id where id=v_lead_id;
    update public.customers set state=coalesce(v_state,state),city=coalesce(v_city,city),pincode=coalesce(v_pincode,pincode) where id=v_customer_id;
  end if;
  if v_lead.customer_id is null then update public.leads set customer_id=v_customer_id where id=v_lead_id; end if;
  insert into public.customer_addresses(customer_id,label,address,city,state,pincode,is_default)
  select v_customer_id,'Order Address',v_address,v_city,v_state,v_pincode,not exists(select 1 from public.customer_addresses where customer_id=v_customer_id and address=v_address and city=v_city and state=v_state and pincode=v_pincode)
  where not exists(select 1 from public.customer_addresses where customer_id=v_customer_id and address=v_address and city=v_city and state=v_state and pincode=v_pincode);
  v_qty:=greatest(1,coalesce(nullif(p_item->>'quantity','')::integer,1));
  v_price:=greatest(0,coalesce(nullif(p_item->>'unit_price','')::numeric,0));
  v_discount:=greatest(0,coalesce(nullif(p_order->>'discount','')::numeric,0));
  v_total:=greatest(0,(v_qty*v_price)-v_discount);
  v_product_id:=nullif(p_item->>'product_id','')::uuid;
  v_product_name:=coalesce(nullif(p_item->>'product_name',''),v_lead.product_name,'Product');
  v_sku:=nullif(p_item->>'sku','');
  v_payment:=coalesce(nullif(p_order->>'payment_mode',''),'COD');
  v_priority:=coalesce(nullif(p_order->>'priority','')::crm2_priority,'normal'::crm2_priority);
  perform public.crm2_assert_no_duplicate_active_order(v_mobile,v_product_id,v_product_name,v_price);
  insert into public.orders(customer_id,lead_id,agent_id,team_id,campaign_id,dealer_id,courier,total,discount,payment_mode,source,remarks,priority,status)
  values(v_customer_id,v_lead_id,v_user,v_lead.team_id,v_lead.campaign_id,nullif(p_order->>'dealer_id','')::uuid,nullif(p_order->>'courier',''),v_total,v_discount,v_payment,coalesce(nullif(p_order->>'source',''),v_lead.source),nullif(p_order->>'remarks',''),v_priority,'confirmed')
  returning * into v_order;
  insert into public.order_items(order_id,product_id,product_name,sku,quantity,unit_price,line_total)
  values(v_order.id,v_product_id,v_product_name,v_sku,v_qty,v_price,v_qty*v_price);
  insert into public.order_status_history(order_id,status,remarks) values(v_order.id,'confirmed','Created from CRM2 Create Order Workspace');
  update public.leads set status='ordered',customer_id=v_customer_id where id=v_lead_id;
  return v_order;
end;
$$;
revoke all on function public.crm2_create_order_workspace(jsonb,jsonb,jsonb,jsonb,uuid) from public,anon;
grant execute on function public.crm2_create_order_workspace(jsonb,jsonb,jsonb,jsonb,uuid) to authenticated;

create or replace function public.crm2_guard_closed_order_update() returns trigger language plpgsql security definer set search_path=public as $$ begin if OLD.status in ('delivered','rto','cancelled') then raise exception 'CLOSED_ORDER_LOCKED: Order is permanently locked after Delivered/RTO/Cancelled.'; end if; return NEW; end; $$;
create or replace function public.crm2_guard_closed_order_item_update() returns trigger language plpgsql security definer set search_path=public as $$ declare v_status crm2_order_status; v_role crm2_role; begin select status into v_status from public.orders where id=coalesce(NEW.order_id,OLD.order_id); if v_status in ('delivered','rto','cancelled') then raise exception 'CLOSED_ORDER_LOCKED: Order is permanently locked after Delivered/RTO/Cancelled.'; end if; if TG_OP='UPDATE' and (NEW.quantity is distinct from OLD.quantity or NEW.unit_price is distinct from OLD.unit_price) then select role into v_role from public.crm2_user_profiles where id=auth.uid(); if v_role not in ('dealer_manager','dispatch') then raise exception 'DELIVERY_QUANTITY_ROLE_REQUIRED: Only Dealer/Courier team can adjust delivery quantity.'; end if; if NEW.unit_price is distinct from OLD.unit_price then raise exception 'DELIVERY_PRICE_AUTO: Change quantity; scheme price is recalculated automatically.'; end if; NEW.line_total:=greatest(0,coalesce(NEW.quantity,0)*coalesce(NEW.unit_price,0)); end if; return NEW; end; $$;
create or replace function public.crm2_recalc_order_after_item_change() returns trigger language plpgsql security definer set search_path=public as $$ declare v_order_id uuid:=coalesce(NEW.order_id,OLD.order_id); v_status crm2_order_status; v_old_qty integer; v_new_qty integer; v_old_total numeric; v_new_total numeric; begin select status into v_status from public.orders where id=v_order_id; if v_status in ('delivered','rto','cancelled') then return coalesce(NEW,OLD); end if; select coalesce(OLD.quantity,0),coalesce(NEW.quantity,0),coalesce(OLD.line_total,0),coalesce(NEW.line_total,0) into v_old_qty,v_new_qty,v_old_total,v_new_total; if TG_OP='UPDATE' and (v_old_qty<>v_new_qty or v_old_total<>v_new_total) then update public.orders o set total=greatest(0,(select coalesce(sum(oi.line_total),0) from public.order_items oi where oi.order_id=v_order_id)-o.discount),updated_at=now() where o.id=v_order_id; insert into public.audit_logs(actor_id,action,entity_type,entity_id,metadata) values(auth.uid(),'delivery_quantity_updated','order',v_order_id,jsonb_build_object('old_quantity',v_old_qty,'new_quantity',v_new_qty,'old_line_total',v_old_total,'new_line_total',v_new_total,'reason','Dealer/Courier delivery adjustment')); end if; return coalesce(NEW,OLD); end; $$;

drop trigger if exists crm2_closed_order_lock on public.orders;
create trigger crm2_closed_order_lock before update on public.orders for each row execute function public.crm2_guard_closed_order_update();
drop trigger if exists crm2_closed_order_item_lock on public.order_items;
create trigger crm2_closed_order_item_lock before update or delete on public.order_items for each row execute function public.crm2_guard_closed_order_item_update();
drop trigger if exists crm2_delivery_quantity_audit on public.order_items;
create trigger crm2_delivery_quantity_audit after update on public.order_items for each row execute function public.crm2_recalc_order_after_item_change();
drop policy if exists order_items_delivery_adjustment on public.order_items;
create policy order_items_delivery_adjustment on public.order_items for update to authenticated using (exists(select 1 from public.orders o where o.id=order_items.order_id and o.status not in ('delivered','rto','cancelled')) and exists(select 1 from public.crm2_user_profiles p where p.id=auth.uid() and p.role in ('dealer_manager','dispatch'))) with check (exists(select 1 from public.orders o where o.id=order_items.order_id and o.status not in ('delivered','rto','cancelled')) and exists(select 1 from public.crm2_user_profiles p where p.id=auth.uid() and p.role in ('dealer_manager','dispatch')));
create index if not exists orders_customer_status_idx on public.orders(customer_id,status);
create index if not exists order_items_product_price_idx on public.order_items(product_id,unit_price,order_id);