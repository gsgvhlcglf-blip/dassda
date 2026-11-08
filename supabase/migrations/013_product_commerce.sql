-- Made-to-order catalog: no inventory entry or stock reservation; prices include VAT.
-- Membership, role checks, demo restrictions and verified payment callbacks remain.
alter table public.products add column discount_percent numeric(5,2) not null default 0 check(discount_percent between 0 and 100);
alter table public.products add column matte_enabled boolean not null default false;
alter table public.products alter column stock set default 0;
alter table public.variants alter column stock set default 0;
-- Old version snapshots have no new fields; restore them with safe defaults.
create function public.default_product_commerce() returns trigger language plpgsql set search_path=public as $$
begin
 new.discount_percent:=coalesce(new.discount_percent,0);
 new.matte_enabled:=coalesce(new.matte_enabled,false);
 new.stock:=coalesce(new.stock,0);
 return new;
end $$;
create trigger default_product_commerce before insert or update on public.products for each row execute function public.default_product_commerce();

create or replace function public.create_order_request_internal(input jsonb) returns jsonb language plpgsql security definer set search_path=public as $$
declare l record; p public.products; v public.variants;
 oid text:=gen_random_uuid()::text; ref text:='KZ-'||upper(substr(gen_random_uuid()::text,1,8));
 total_amount numeric:=0; demo_order boolean:=false; locale text:=input->>'locale'; unit_amount numeric;
begin
 if jsonb_typeof(input->'lines') is distinct from 'array' then raise exception 'Invalid cart';end if;
 if jsonb_array_length(input->'lines') not between 1 and 50 or input->>'consent' is distinct from 'true' then raise exception 'Invalid request';end if;
 if locale is null or locale not in ('tr','en','ru') or length(coalesce(input->>'customer_name','')) not between 2 and 120 or length(coalesce(input->>'email','')) not between 3 and 254 or (input->>'email') !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' or length(coalesce(input->>'phone','')) not between 7 and 30 or length(coalesce(input->>'address','')) not between 10 and 1000 or length(coalesce(input->>'note',''))>2000 then raise exception 'Invalid contact information';end if;
 if (select count(*) from public.orders where email=input->>'email' and created_at>now()-interval '1 minute')>=5 then raise exception 'Too many requests';end if;
 for l in select value from jsonb_array_elements(input->'lines') loop
  if jsonb_typeof(l.value->'quantity') is distinct from 'number' or (l.value->>'quantity')::numeric<>trunc((l.value->>'quantity')::numeric) or (l.value->>'quantity')::int not between 1 and 99 then raise exception 'INVALID_QUANTITY';end if;
 end loop;
 for l in select x->>'productId' pid,x->>'variantId' vid,sum((x->>'quantity')::int)::int qty from jsonb_array_elements(input->'lines') x group by 1,2 loop
  select * into p from public.products where id=l.pid and published for share;
  if not found then raise exception 'INVALID_VARIANT';end if;
  select * into v from public.variants where id=l.vid and product_id=p.id for share;
  if not found or (v.finish='matte' and not p.matte_enabled) then raise exception 'INVALID_VARIANT';end if;
  if l.qty not between 1 and 99 then raise exception 'INVALID_QUANTITY';end if;
  unit_amount:=round(p.price*(100-p.discount_percent)/100,2);
  total_amount:=total_amount+unit_amount*l.qty;demo_order:=demo_order or p.demo;
 end loop;
 insert into public.orders(id,reference,customer_name,email,phone,address,note,status,total,currency,demo,created_at)
 values(oid,ref,input->>'customer_name',input->>'email',input->>'phone',input->>'address',coalesce(input->>'note',''),case when demo_order then 'demo_request' else 'request_pending' end,total_amount,'TRY',demo_order,now());
 for l in select x->>'productId' pid,x->>'variantId' vid,sum((x->>'quantity')::int)::int qty from jsonb_array_elements(input->'lines') x group by 1,2 loop
  select * into p from public.products where id=l.pid;select * into v from public.variants where id=l.vid;
  unit_amount:=round(p.price*(100-p.discount_percent)/100,2);
  insert into public.order_items(id,order_id,product_id,variant_id,title,sku,quantity,unit_price)
  values(gen_random_uuid()::text,oid,p.id,v.id,coalesce(p.title->>locale,p.title->>'tr'),v.sku,l.qty,unit_amount);
 end loop;
 return jsonb_build_object('reference',ref,'demo',demo_order,'total',total_amount);
end $$;
revoke all on function public.create_order_request_internal(jsonb) from public,anon,authenticated;

create or replace function public.prepare_payment(order_reference text,buyer_id uuid,expected_provider text default null,expected_mode text default null) returns jsonb language plpgsql security definer set search_path=public as $$
declare o public.orders; a public.payment_attempts; cfg public.payment_settings; row record; product public.products; variant public.variants; new_id uuid:=gen_random_uuid(); amount bigint;
begin
 select * into o from public.orders where reference=order_reference and customer_id=buyer_id for update;
 if not found or not exists(select 1 from auth.users where id=buyer_id and email_confirmed_at is not null) then raise exception 'AUTH_REQUIRED';end if;
 select * into a from public.payment_attempts where order_id=o.id;if found then if a.provider is distinct from expected_provider or a.mode is distinct from expected_mode then raise exception 'PAYMENT_CONFIGURATION_CHANGED';end if;return to_jsonb(a)||jsonb_build_object('created',false);end if;
 select * into cfg from public.payment_settings where id='site' for share;
 if not cfg.enabled or cfg.provider='none' then raise exception 'PAYMENTS_DISABLED';end if;
 if cfg.provider is distinct from expected_provider or cfg.mode is distinct from expected_mode then raise exception 'PAYMENT_CONFIGURATION_CHANGED';end if;
 if o.status not in('request_pending','demo_request') or o.created_at<now()-interval '30 minutes' then raise exception 'ORDER_EXPIRED';end if;
 if cfg.mode='live' and o.demo then raise exception 'DEMO_PAYMENT_BLOCKED';end if;
 amount:=round(o.total*100)::bigint;if amount<=0 then raise exception 'INVALID_AMOUNT';end if;
 if not exists(select 1 from public.order_items where order_id=o.id) or (select round(sum(unit_price*quantity)*100)::bigint from public.order_items where order_id=o.id)<>amount then raise exception 'INVALID_AMOUNT';end if;
 for row in select product_id,sum(quantity)::int qty from public.order_items where order_id=o.id group by product_id order by product_id loop
  select * into product from public.products where id=row.product_id and published for update;
  if not found then raise exception 'INVALID_VARIANT';end if;
  if cfg.mode='live' and product.demo then raise exception 'DEMO_PAYMENT_BLOCKED';end if;
 end loop;
 for row in select variant_id,product_id,sum(quantity)::int qty from public.order_items where order_id=o.id group by variant_id,product_id order by variant_id loop
  select * into variant from public.variants where id=row.variant_id and product_id=row.product_id for update;
  if not found or (variant.finish='matte' and not (select matte_enabled from public.products where id=row.product_id)) then raise exception 'INVALID_VARIANT';end if;
 end loop;
 insert into public.payment_attempts(id,order_id,customer_id,provider,mode,amount_minor,merchant_ref,reserved) values(new_id,o.id,buyer_id,cfg.provider,cfg.mode,amount,'KZ'||replace(new_id::text,'-',''),false) returning * into a;
 update public.orders set payment_status='pending',payment_provider=cfg.provider where id=o.id;insert into public.payment_events(attempt_id,kind) values(a.id,'created');return to_jsonb(a)||jsonb_build_object('created',true);
end $$;

create or replace function public.settle_payment(attempt_id uuid,was_paid boolean,received_amount bigint,received_currency text,transaction_id text,requires_review boolean default false) returns text language plpgsql security definer set search_path=public as $$
declare a public.payment_attempts;final_state text;
begin
 select * into a from public.payment_attempts where id=attempt_id for update;
 if not found then raise exception 'PAYMENT_NOT_FOUND';end if;
 if a.state in('paid','test_paid','review') then return a.state;end if;
 if not was_paid and a.state in('failed','expired') then return a.state;end if;
 if not was_paid then
  -- Release only genuinely reserved legacy attempts; new made-to-order attempts never reserve.
  perform public.payment_release_stock(a.id);
  update public.payment_attempts set state='failed' where id=a.id;
  update public.orders set payment_status='failed',status='cancelled' where id=a.order_id;
  insert into public.payment_events(attempt_id,kind) values(a.id,'failed');return 'failed';
 end if;
 if requires_review or a.state in('failed','expired') or exists(select 1 from public.orders where id=a.order_id and status='cancelled') or received_amount is distinct from a.amount_minor or received_currency is distinct from 'TRY' then final_state:='review';
 elsif a.mode='test' then final_state:='test_paid';
 else final_state:='paid';end if;
 update public.payment_attempts set state=final_state,provider_payment_id=left(transaction_id,160),error_code=case when final_state='review' then 'PAYMENT_REVIEW_REQUIRED' else null end where id=a.id;
 update public.orders set payment_status=final_state,paid_at=now(),status=case when final_state='test_paid' then 'demo_request' when final_state='paid' then 'confirmed' else 'reviewing' end,demo=case when final_state='test_paid' then true else demo end where id=a.order_id;
 insert into public.payment_events(attempt_id,kind) values(a.id,final_state);return final_state;
end $$;
revoke all on function public.prepare_payment(text,uuid,text,text),public.settle_payment(uuid,boolean,bigint,text,text,boolean) from public,anon,authenticated;
grant execute on function public.prepare_payment(text,uuid,text,text),public.settle_payment(uuid,boolean,bigint,text,text,boolean) to service_role;
