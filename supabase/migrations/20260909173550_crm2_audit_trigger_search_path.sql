-- Keep the audit trigger deterministic even if a caller changes search_path.
alter function public.crm2_audit_row_change() set search_path = public, pg_temp;
