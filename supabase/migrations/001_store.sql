-- Run once in a new Supabase project. No service role key is required by the application.
create table public.brands (id text primary key, slug text unique not null check (slug in ('ducati','bmw','yamaha')), name text not null, position integer not null);
create table public.models (id text primary key, brand_id text not null references public.brands(id), slug text not null, name text not null, image text not null default '', unique(brand_id,slug));
create table public.generations (id text primary key, model_id text not null references public.models(id) on delete cascade, name text not null, start_year integer not null check(start_year between 1900 and 2100), end_year integer not null check(end_year between start_year and 2100), unique(id,model_id));
create table public.model_years (id text primary key, model_id text not null references public.models(id) on delete cascade, generation_id text not null, year integer not null check(year between 1900 and 2100), unique(model_id,year), foreign key(generation_id,model_id) references public.generations(id,model_id) on delete cascade);
create table public.categories (id text primary key, slug text unique not null, name jsonb not null);
create table public.products (id text primary key, slug text unique not null, sku text unique not null, title jsonb not null, description jsonb not null, specifications jsonb not null, category_id text not null references public.categories(id), material text not null check(material in ('full_carbon','hybrid','forged','carbon_finish')), price numeric(12,2) not null check(price>=0), stock integer not null check(stock>=0), featured boolean not null default false, published boolean not null default false, demo boolean not null default true, weight numeric check(weight>0), installation jsonb not null, video_url text not null default '', viewer_url text not null default '');
create table public.variants (id text primary key, product_id text not null references public.products(id) on delete cascade, name jsonb not null, sku text unique not null, price numeric(12,2) not null check(price>=0), stock integer not null check(stock>=0), finish text not null check(finish in ('gloss','matte')));
create table public.product_images (id text primary key, product_id text not null references public.products(id) on delete cascade, url text not null, alt jsonb not null, position integer not null default 0 check(position>=0));
create table public.compatibility (id text primary key, product_id text not null references public.products(id) on delete cascade, model_id text not null references public.models(id) on delete cascade, generation_id text, year_from integer not null check(year_from between 1900 and 2100), year_to integer not null check(year_to between year_from and 2100), foreign key(generation_id,model_id) references public.generations(id,model_id) on delete cascade, unique(product_id,model_id,year_from,year_to));
create index compatibility_lookup on public.compatibility(model_id,year_from,year_to);
create index published_products on public.products(published,category_id);
create index product_variant_lookup on public.variants(product_id);
create index model_brand_lookup on public.models(brand_id);
create table public.content (id text primary key, key text unique not null, title jsonb not null, body jsonb not null);
create table public.admin_users (user_id uuid primary key references auth.users(id) on delete cascade, role text not null check(role in ('admin','editor')));
create table public.orders (id text primary key, reference text unique not null, customer_name text not null, email text not null, phone text not null, address text not null, note text not null default '', status text not null check(status in ('request_pending','reviewing','confirmed','shipped','cancelled','demo_request')), total numeric(12,2) not null check(total>=0), currency text not null check(currency='TRY'), demo boolean not null, created_at timestamptz not null default now());
create index orders_email_time on public.orders(email,created_at);
create table public.order_items (id text primary key, order_id text not null references public.orders(id) on delete cascade, product_id text not null references public.products(id), variant_id text not null references public.variants(id), title text not null, sku text not null, quantity integer not null check(quantity between 1 and 99), unit_price numeric(12,2) not null check(unit_price>=0));

create function public.is_staff() returns boolean language sql stable security definer set search_path=public as $$ select exists(select 1 from public.admin_users where user_id=auth.uid() and role in ('admin','editor')); $$;
create function public.is_admin() returns boolean language sql stable security definer set search_path=public as $$ select exists(select 1 from public.admin_users where user_id=auth.uid() and role='admin'); $$;
revoke all on function public.is_staff() from public;
revoke all on function public.is_admin() from public;
grant execute on function public.is_staff(), public.is_admin() to anon, authenticated;
alter table public.admin_users enable row level security;
create policy own_role on public.admin_users for select to authenticated using(user_id=auth.uid());
-- No API insert/update/delete policy on admin_users. Provision roles only in SQL Editor.

DO $$ declare t text; begin
 foreach t in array array['brands','models','generations','model_years','categories','products','variants','product_images','compatibility','content','orders','order_items'] loop
 execute format('alter table public.%I enable row level security',t);
 if t not in ('orders','order_items') then
   if t in ('brands','models','generations','model_years','categories','content') then
     execute format('create policy public_read on public.%I for select using(true)',t);
   elsif t='products' then
     execute 'create policy public_read on public.products for select using(published or public.is_staff())';
   else
     execute format('create policy public_read on public.%I for select using(public.is_staff() or exists(select 1 from public.products p where p.id=product_id and p.published))',t);
   end if;
   if t<>'brands' then
     execute format('create policy staff_insert on public.%I for insert to authenticated with check(public.is_staff())',t);
     execute format('create policy staff_update on public.%I for update to authenticated using(public.is_staff()) with check(public.is_staff())',t);
     execute format('create policy admin_delete on public.%I for delete to authenticated using(public.is_admin())',t);
   end if;
 else
   execute format('create policy admin_read on public.%I for select to authenticated using(public.is_admin())',t);
 end if;
 end loop;
end $$;
-- Only status is editable through the API. Prices and customer information stay immutable.
revoke update on public.orders from anon,authenticated;
grant update(status) on public.orders to authenticated;
create policy admin_order_status on public.orders for update to authenticated using(public.is_admin()) with check(public.is_admin());

create function public.check_generation_years() returns trigger language plpgsql set search_path=public as $$
declare g public.generations;
begin
 if NEW.generation_id is null then return NEW; end if;
 select * into g from public.generations where id=NEW.generation_id and model_id=NEW.model_id;
 if not found then raise exception 'Generation must belong to selected model'; end if;
 if TG_TABLE_NAME='model_years' then
   if NEW.year not between g.start_year and g.end_year then raise exception 'Year outside generation range'; end if;
 else
   if NEW.year_from<g.start_year or NEW.year_to>g.end_year then raise exception 'Compatibility outside generation range'; end if;
 end if;
 return NEW;
end $$;
create trigger valid_model_year before insert or update on public.model_years for each row execute function public.check_generation_years();
create trigger valid_compatibility before insert or update on public.compatibility for each row execute function public.check_generation_years();

create function public.create_order_request(input jsonb) returns jsonb language plpgsql security definer set search_path=public as $$
declare l record; p public.products; v public.variants; order_id text:=gen_random_uuid()::text; ref text:='KZ-'||upper(substr(gen_random_uuid()::text,1,8)); total_amount numeric:=0; demo_order boolean:=false; locale text:=input->>'locale';
begin
 if jsonb_typeof(input->'lines') is distinct from 'array' then raise exception 'Invalid cart'; end if;
 if jsonb_array_length(input->'lines') not between 1 and 50 or input->>'consent' is distinct from 'true' then raise exception 'Invalid request'; end if;
 if locale is null or locale not in ('tr','en','ru') or length(coalesce(input->>'customer_name','')) not between 2 and 120 or length(coalesce(input->>'email','')) not between 3 and 254 or (input->>'email') !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' or length(coalesce(input->>'phone','')) not between 7 and 30 or length(coalesce(input->>'address','')) not between 10 and 1000 or length(coalesce(input->>'note',''))>2000 then raise exception 'Invalid contact information'; end if;
 if (select count(*) from public.orders where email=input->>'email' and created_at>now()-interval '1 minute')>=5 then raise exception 'Too many requests'; end if;
 for l in select value from jsonb_array_elements(input->'lines') loop
   if jsonb_typeof(l.value->'quantity') is distinct from 'number' or (l.value->>'quantity')::numeric <> trunc((l.value->>'quantity')::numeric) or (l.value->>'quantity')::int not between 1 and 99 then raise exception 'Invalid quantity'; end if;
 end loop;
 for l in select x->>'productId' as pid, x->>'variantId' as vid, sum((x->>'quantity')::int)::int as qty from jsonb_array_elements(input->'lines') x group by 1,2 loop
   select * into p from public.products where id=l.pid and published for share;
   if not found then raise exception 'Product unavailable'; end if;
   select * into v from public.variants where id=l.vid and product_id=p.id for share;
   if not found or l.qty>v.stock or l.qty>p.stock or l.qty>99 then raise exception 'OUT_OF_STOCK'; end if;
   if (select sum((x->>'quantity')::int) from jsonb_array_elements(input->'lines') x where x->>'productId'=p.id)>p.stock then raise exception 'OUT_OF_STOCK'; end if;
   total_amount:=total_amount+v.price*l.qty; demo_order:=demo_order or p.demo;
 end loop;
 insert into public.orders values(order_id,ref,input->>'customer_name',input->>'email',input->>'phone',input->>'address',coalesce(input->>'note',''),case when demo_order then 'demo_request' else 'request_pending' end,total_amount,'TRY',demo_order,now());
 for l in select x->>'productId' as pid,x->>'variantId' as vid,sum((x->>'quantity')::int)::int as qty from jsonb_array_elements(input->'lines') x group by 1,2 loop
   select * into p from public.products where id=l.pid; select * into v from public.variants where id=l.vid;
   insert into public.order_items values(gen_random_uuid()::text,order_id,p.id,v.id,coalesce(p.title->>locale,p.title->>'tr'),v.sku,l.qty,v.price);
 end loop;
 return jsonb_build_object('reference',ref,'demo',demo_order,'total',total_amount);
end $$;
revoke all on function public.create_order_request(jsonb) from public;
grant execute on function public.create_order_request(jsonb) to anon,authenticated;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values ('catalog','catalog',true,5242880,array['image/jpeg','image/png','image/webp']) on conflict(id) do nothing;
create policy catalog_public_read on storage.objects for select using(bucket_id='catalog');
create policy catalog_staff_upload on storage.objects for insert to authenticated with check(bucket_id='catalog' and public.is_staff());
create policy catalog_staff_update on storage.objects for update to authenticated using(bucket_id='catalog' and public.is_staff()) with check(bucket_id='catalog' and public.is_staff());
create policy catalog_admin_delete on storage.objects for delete to authenticated using(bucket_id='catalog' and public.is_admin());

create function public.protect_generation_bounds() returns trigger language plpgsql set search_path=public as $$
begin
 if exists(select 1 from public.model_years where generation_id=OLD.id and (model_id<>NEW.model_id or year<NEW.start_year or year>NEW.end_year)) or exists(select 1 from public.compatibility where generation_id=OLD.id and (model_id<>NEW.model_id or year_from<NEW.start_year or year_to>NEW.end_year)) then raise exception 'Existing years or fitments would fall outside this generation. Update them first.'; end if;
 return NEW;
end $$;
create trigger protect_generation before update on public.generations for each row execute function public.protect_generation_bounds();
