drop policy if exists profile_self on public.crm2_user_profiles;
create policy profile_self on public.crm2_user_profiles for select to authenticated using (id=(select auth.uid()));
