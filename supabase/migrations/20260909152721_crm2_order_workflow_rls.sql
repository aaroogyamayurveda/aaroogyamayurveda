drop policy if exists order_items_write on public.order_items;
create policy order_items_write on public.order_items for all to authenticated using (public.crm2_is_manager() or exists (select 1 from public.orders o where o.id=order_items.order_id and o.agent_id=auth.uid())) with check (public.crm2_is_manager() or exists (select 1 from public.orders o where o.id=order_items.order_id and o.agent_id=auth.uid()));
drop policy if exists order_history_read on public.order_status_history;
create policy order_history_read on public.order_status_history for select to authenticated using (public.crm2_is_manager() or exists (select 1 from public.orders o where o.id=order_status_history.order_id and o.agent_id=auth.uid()));
create policy order_history_insert on public.order_status_history for insert to authenticated with check (public.crm2_is_manager() or exists (select 1 from public.orders o where o.id=order_status_history.order_id and o.agent_id=auth.uid()));
