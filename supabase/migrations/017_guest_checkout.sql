-- Account-free checkout. Session secrets stay in HttpOnly cookies; only SHA-256 hashes reach SQL.
-- Existing accounts/orders and their RLS policies remain; no anonymous table reads are enabled.
alter table public.orders add column guest_key text check(guest_key ~ '^[a-f0-9]{64}$');
create index orders_guest_time on public.orders(guest_key,created_at desc) where guest_key is not null;
alter table public.payment_attempts alter column customer_id drop not null;

create function public.create_guest_order_request(input jsonb,session_key text)
returns jsonb language plpgsql security definer set search_path=public as $$
declare result jsonb; ref text;
begin
 if session_key is null or session_key !~ '^[a-f0-9]{64}$' then raise exception 'AUTH_REQUIRED';end if;
 ref:=public.next_order_reference(now());
 result:=public.create_order_request_internal(input);
 update public.orders set customer_id=null,guest_key=session_key,reference=ref where reference=result->>'reference';
 return jsonb_set(result,'{reference}',to_jsonb(ref));
end $$;
-- Customer-facing HTTP routes no longer create authenticated-member orders either.
revoke execute on function public.create_order_request(jsonb) from authenticated;
revoke all on function public.create_guest_order_request(jsonb,text) from public,anon,authenticated;
grant execute on function public.create_guest_order_request(jsonb,text) to service_role;

create or replace function public.prepare_guest_payment(order_reference text,session_key text,expected_provider text default null,expected_mode text default null) returns jsonb language plpgsql security definer set search_path=public as $$
declare o public.orders; a public.payment_attempts; cfg public.payment_settings; row record; product public.products; variant public.variants; new_id uuid:=gen_random_uuid(); amount bigint;
begin
 select * into o from public.orders where reference=order_reference and guest_key=session_key for update;
 if not found or session_key is null or session_key !~ '^[a-f0-9]{64}$' then raise exception 'AUTH_REQUIRED';end if;
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
 insert into public.payment_attempts(id,order_id,customer_id,provider,mode,amount_minor,merchant_ref,reserved) values(new_id,o.id,null,cfg.provider,cfg.mode,amount,'KZ'||replace(new_id::text,'-',''),false) returning * into a;
 update public.orders set payment_status='pending',payment_provider=cfg.provider where id=o.id;insert into public.payment_events(attempt_id,kind) values(a.id,'created');return to_jsonb(a)||jsonb_build_object('created',true);
end $$;

revoke all on function public.prepare_guest_payment(text,text,text,text) from public,anon,authenticated;
grant execute on function public.prepare_guest_payment(text,text,text,text) to service_role;
