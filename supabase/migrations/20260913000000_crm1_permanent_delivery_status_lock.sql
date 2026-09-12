create or replace function public.crm1_guard_final_delivery_status()
returns trigger
language plpgsql
security definer
set search_path=public
as $$
begin
  if OLD.order_status in ('delivered','rto','cancelled')
     and NEW.order_status is distinct from OLD.order_status then
    raise exception 'FINAL_ORDER_STATUS_LOCKED: Delivered/RTO/Cancelled orders cannot have their status changed.';
  end if;
  return NEW;
end;
$$;

drop trigger if exists crm1_final_delivery_status_lock on public.orders;
create trigger crm1_final_delivery_status_lock
before update on public.orders
for each row
execute function public.crm1_guard_final_delivery_status();
