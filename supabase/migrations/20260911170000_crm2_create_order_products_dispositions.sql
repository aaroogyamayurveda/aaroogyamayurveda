-- CRM2 Create Order master data: two requested products and CRM1-style disposition hierarchy.
-- Idempotent by business names/SKUs; no CRM1 objects are modified.

insert into public.products (sku,name,active,cost,mrp,selling_price)
select 'ORTHO-GOLD','Ortho Gold',true,0,1999,1999
where not exists (select 1 from public.products where lower(name)='ortho gold');

insert into public.products (sku,name,active,cost,mrp,selling_price)
select 'NASHA-NAASHAM','Nasha Naasham',true,0,1999,1999
where not exists (select 1 from public.products where lower(name)='nasha naasham');

insert into public.disposition_levels (name,parent_id,active)
select 'Language',null,true
where not exists (select 1 from public.disposition_levels where lower(name)='language' and parent_id is null);

insert into public.disposition_levels (name,parent_id,active)
select 'Call Back',(select id from public.disposition_levels where name='Lead' and parent_id is null limit 1),true
where exists (select 1 from public.disposition_levels where name='Lead' and parent_id is null)
  and not exists (select 1 from public.disposition_levels d where lower(d.name)='call back' and d.parent_id=(select id from public.disposition_levels where name='Lead' and parent_id is null limit 1));

insert into public.disposition_levels (name,parent_id,active)
select v.name,(select id from public.disposition_levels where name='Lead' and parent_id is null limit 1),true
from (values ('Dealer Enquiry'),('High Price'),('Just Enquiry'),('Online Enquiry'),('PNA')) v(name)
where exists (select 1 from public.disposition_levels where name='Lead' and parent_id is null)
  and not exists (select 1 from public.disposition_levels d where lower(d.name)=lower(v.name) and d.parent_id=(select id from public.disposition_levels where name='Lead' and parent_id is null limit 1));

insert into public.disposition_levels (name,parent_id,active)
select v.name,(select id from public.disposition_levels where name='Non Lead' and parent_id is null limit 1),true
from (values ('Already Ordered'),('Child Call'),('Delivered'),('Not Interested')) v(name)
where exists (select 1 from public.disposition_levels where name='Non Lead' and parent_id is null)
  and not exists (select 1 from public.disposition_levels d where lower(d.name)=lower(v.name) and d.parent_id=(select id from public.disposition_levels where name='Non Lead' and parent_id is null limit 1));

insert into public.disposition_levels (name,parent_id,active)
select v.name,(select id from public.disposition_levels where name='Not Connected' and parent_id is null limit 1),true
from (values ('Call Drop'),('No Response')) v(name)
where exists (select 1 from public.disposition_levels where name='Not Connected' and parent_id is null)
  and not exists (select 1 from public.disposition_levels d where lower(d.name)=lower(v.name) and d.parent_id=(select id from public.disposition_levels where name='Not Connected' and parent_id is null limit 1));

insert into public.disposition_levels (name,parent_id,active)
select v.name,(select id from public.disposition_levels where name='Sales' and parent_id is null limit 1),true
from (values ('Order Confirmed'),('Order Cancelled')) v(name)
where exists (select 1 from public.disposition_levels where name='Sales' and parent_id is null)
  and not exists (select 1 from public.disposition_levels d where lower(d.name)=lower(v.name) and d.parent_id=(select id from public.disposition_levels where name='Sales' and parent_id is null limit 1));

insert into public.disposition_levels (name,parent_id,active)
select 'Transferred',(select id from public.disposition_levels where name='Transfer' and parent_id is null limit 1),true
where exists (select 1 from public.disposition_levels where name='Transfer' and parent_id is null)
  and not exists (select 1 from public.disposition_levels d where lower(d.name)='transferred' and d.parent_id=(select id from public.disposition_levels where name='Transfer' and parent_id is null limit 1));

insert into public.disposition_levels (name,parent_id,active)
select v.name,(select id from public.disposition_levels where name='Language' and parent_id is null limit 1),true
from (values ('Hindi'),('English'),('Other Language')) v(name)
where exists (select 1 from public.disposition_levels where name='Language' and parent_id is null)
  and not exists (select 1 from public.disposition_levels d where lower(d.name)=lower(v.name) and d.parent_id=(select id from public.disposition_levels where name='Language' and parent_id is null limit 1));
