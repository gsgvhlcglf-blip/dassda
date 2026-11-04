-- Drafts remain private. Publication applies a reviewed snapshot atomically to relational catalog tables.
create table public.site_workspace(id text primary key check(id='site'),revision bigint not null default 1,catalog jsonb not null,design jsonb not null default '{"texts":{},"images":{}}',published_id uuid);
create table public.site_versions(id uuid primary key default gen_random_uuid(),created_at timestamptz not null default clock_timestamp(),label text not null,kind text not null check(kind in('published','draft_backup')),catalog jsonb not null,design jsonb not null);
create table public.site_presentation(id text primary key check(id='site'),design jsonb not null default '{"texts":{},"images":{}}');
insert into public.site_presentation(id) values('site');
alter table public.site_workspace enable row level security;
alter table public.site_versions enable row level security;
alter table public.site_presentation enable row level security;
create policy staff_workspace_read on public.site_workspace for select to authenticated using(public.is_staff());
create policy staff_versions_read on public.site_versions for select to authenticated using(public.is_staff());
create policy public_presentation_read on public.site_presentation for select to anon,authenticated using(true);
-- Table writes remain available only to the controlled security-definer operations below.
create function public.snapshot_site_catalog() returns jsonb language plpgsql security definer set search_path=public as $$
declare t text; result jsonb:='{}'; rows jsonb;
begin
 if not public.is_staff() then raise exception 'FORBIDDEN';end if;
 foreach t in array array['brands','categories','models','generations','model_years','products','variants','product_images','compatibility','content'] loop
  execute format('select coalesce(jsonb_agg(to_jsonb(r) order by r.id),''[]''::jsonb) from public.%I r',t) into rows;
  result:=result||jsonb_build_object(t,rows);
 end loop;return result;
end $$;
create function public.get_site_workspace() returns jsonb language plpgsql security definer set search_path=public as $$
declare result jsonb;
begin
 if not public.is_staff() then raise exception 'FORBIDDEN';end if;
 insert into public.site_workspace(id,catalog,design) select 'site',public.snapshot_site_catalog(),design from public.site_presentation where id='site' on conflict(id) do nothing;
 select to_jsonb(w)||jsonb_build_object('history',(select coalesce(jsonb_agg(to_jsonb(v)-'catalog'-'design' order by created_at desc),'[]'::jsonb) from public.site_versions v)) into result from public.site_workspace w where id='site';return result;
end $$;
create function public.save_site_workspace(expected bigint,new_catalog jsonb,new_design jsonb,inventory jsonb default null) returns bigint language plpgsql security definer set search_path=public as $$
declare t text; result bigint;
begin
 if not public.is_staff() then raise exception 'FORBIDDEN';end if;
 if jsonb_typeof(new_catalog) is distinct from 'object' or jsonb_typeof(new_design) is distinct from 'object' or octet_length(new_catalog::text)+octet_length(new_design::text)>20000000 then raise exception 'INVALID_SNAPSHOT';end if;
 foreach t in array array['brands','categories','models','generations','model_years','products','variants','product_images','compatibility','content'] loop
  if jsonb_typeof(new_catalog->t) is distinct from 'array' or jsonb_array_length(new_catalog->t)>10000 then raise exception 'INVALID_SNAPSHOT';end if;
 end loop;
 if jsonb_array_length(new_catalog->'brands')<>3 or exists(select 1 from jsonb_array_elements(new_catalog->'brands') b where b->>'id' not in('ducati','bmw','yamaha') or b->>'slug'<>b->>'id') then raise exception 'INVALID_BRANDS';end if;
 update public.site_workspace set catalog=new_catalog,design=new_design,revision=revision+1 where id='site' and revision=expected returning revision into result;
 if result is null then raise exception 'WORKSPACE_CONFLICT';end if;
 if inventory is not null then
  if inventory->>'table' not in('products','variants') or (inventory->>'stock')::integer not between 0 and 10000000 then raise exception 'INVALID_STOCK';end if;
  execute format('update public.%I set stock=$1 where id=$2',inventory->>'table') using (inventory->>'stock')::integer,inventory->>'id';
 end if;
 return result;
end $$;
create function public.publish_site_workspace(expected bigint,restore_id uuid default null) returns uuid language plpgsql security definer set search_path=public as $$
declare w public.site_workspace; target_catalog jsonb; target_design jsonb; t text; cols text; release_id uuid:=gen_random_uuid(); baseline_id uuid; saved_catalog jsonb;
begin
 if not public.is_admin() then raise exception 'FORBIDDEN';end if;
 perform public.get_site_workspace();
 select * into w from public.site_workspace where id='site' for update;
 if expected is null or w.revision<>expected then raise exception 'WORKSPACE_CONFLICT';end if;
 if w.published_id is null then
  baseline_id:=gen_random_uuid();insert into public.site_versions(id,label,kind,catalog,design) select baseline_id,'İlk yayın öncesi','published',public.snapshot_site_catalog(),design from public.site_presentation where id='site';
 end if;
 target_catalog:=w.catalog;target_design:=w.design;
 if restore_id is not null then
  select catalog,design into target_catalog,target_design from public.site_versions where id=restore_id;
  if target_catalog is null then raise exception 'VERSION_NOT_FOUND';end if;
  insert into public.site_versions(label,kind,catalog,design) values('Geri almadan önceki taslak','draft_backup',w.catalog,w.design);
 end if;
 -- These child tables have no order references; rebuilding avoids transient generation-range conflicts.
 delete from public.compatibility;delete from public.model_years;
 foreach t in array array['brands','categories','models','generations','model_years','products','variants','product_images','compatibility','content'] loop
  select string_agg(format('%I=excluded.%I',column_name,column_name),',') into cols from information_schema.columns where table_schema='public' and table_name=t and column_name<>'id' and not(t in('products','variants') and column_name='stock');
  execute format('insert into public.%I select * from jsonb_populate_recordset(null::public.%I,$1) on conflict(id) do update set %s',t,t,cols) using target_catalog->t;
 end loop;
 foreach t in array array['compatibility','product_images','variants','products','model_years','generations','models','categories','content'] loop
  execute format('delete from public.%I where id not in(select value->>''id'' from jsonb_array_elements($1))',t) using target_catalog->t;
 end loop;
 saved_catalog:=public.snapshot_site_catalog();
 insert into public.site_versions(id,label,kind,catalog,design) values(release_id,case when restore_id is null then 'Yayın' else 'Geri yüklenen yayın' end,'published',saved_catalog,target_design);
 update public.site_presentation set design=target_design where id='site';
 update public.site_workspace set catalog=saved_catalog,design=target_design,published_id=release_id,revision=revision+1 where id='site';
 delete from public.site_versions where id in(select id from public.site_versions order by created_at desc offset 12);
 return release_id;
end $$;
revoke all on function public.snapshot_site_catalog(),public.get_site_workspace(),public.save_site_workspace(bigint,jsonb,jsonb,jsonb),public.publish_site_workspace(bigint,uuid) from public;
grant execute on function public.get_site_workspace(),public.save_site_workspace(bigint,jsonb,jsonb,jsonb),public.publish_site_workspace(bigint,uuid) to authenticated;
-- Catalog mutations must go through drafts. Orders retain their existing status-only policy.
revoke insert,update,delete on public.brands,public.categories,public.models,public.generations,public.model_years,public.products,public.variants,public.product_images,public.compatibility,public.content from anon,authenticated;

grant select on public.site_presentation to anon,authenticated;
grant select on public.site_workspace,public.site_versions to authenticated;
