-- CRM2 agents must not be able to apply an order discount.
-- Keep the field visible/frozen in the Create Order UI and enforce the same rule server-side.
create or replace function public.crm2_force_zero_order_discount()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.discount := 0;
  return new;
end;
$$;

drop trigger if exists trg_crm2_force_zero_order_discount on public.orders;
create trigger trg_crm2_force_zero_order_discount
before insert or update of discount on public.orders
for each row execute function public.crm2_force_zero_order_discount();

update public.orders set discount = 0 where coalesce(discount,0) <> 0;
