insert into public.disposition_levels (name, active, parent_id, level_no)
select v.name, true, p.id, 2
from (values ('Express Order'), ('Urgent Order'), ('Fresh Order')) as v(name)
join public.disposition_levels p on p.name = 'Sales' and p.parent_id is null
where not exists (
  select 1 from public.disposition_levels c
  where c.parent_id = p.id and lower(c.name) = lower(v.name)
);
