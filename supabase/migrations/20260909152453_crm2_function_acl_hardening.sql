revoke execute on function public.crm2_role() from anon;
revoke execute on function public.crm2_is_manager() from anon;
grant execute on function public.crm2_role() to authenticated;
grant execute on function public.crm2_is_manager() to authenticated;
