-- Payment secrets stay on the server. Only the service role may reserve stock or settle verified payments.
create table public.payment_settings(id text primary key check(id='site'),provider text not null default 'none' check(provider in('none','paytr','iyzico')),mode text not null default 'test' check(mode in('test','live')),enabled boolean not null default false,check(not enabled or provider<>'none'));
insert into public.payment_settings(id) values('site');
alter table public.orders add column payment_status text not null default 'request_only';
alter table public.orders add column payment_provider text;
alter table public.orders add column paid_at timestamptz;
create table public.payment_attempts(id uuid primary key default gen_random_uuid(),order_id text not null unique references public.orders(id),customer_id uuid not null references auth.users(id),provider text not null check(provider in('paytr','iyzico')),mode text not null check(mode in('test','live')),state text not null default 'creating' check(state in('creating','ready','unknown','paid','test_paid','failed','expired','review')),amount_minor bigint not null check(amount_minor>0),currency text not null default 'TRY' check(currency='TRY'),merchant_ref text not null unique,token text unique,checkout_url text,provider_payment_id text,reserved boolean not null default false,created_at timestamptz not null default clock_timestamp(),expires_at timestamptz not null default now()+interval '30 minutes',error_code text);
create index payment_expiry on public.payment_attempts(expires_at) where reserved;
create table public.payment_events(id uuid primary key default gen_random_uuid(),attempt_id uuid not null references public.payment_attempts(id),kind text not null,created_at timestamptz not null default clock_timestamp());
alter table public.payment_settings enable row level security;
alter table public.payment_attempts enable row level security;
alter table public.payment_events enable row level security;
create policy payment_admin_settings on public.payment_settings for all to authenticated using(public.is_admin()) with check(public.is_admin());
create policy payment_admin_attempts on public.payment_attempts for select to authenticated using(public.is_admin());
create policy payment_admin_events on public.payment_events for select to authenticated using(public.is_admin());
create function public.payment_public_settings() returns jsonb language sql stable security definer set search_path=public as $$select jsonb_build_object('provider',provider,'mode',mode,'enabled',enabled) from public.payment_settings where id='site'$$;
revoke all on function public.payment_public_settings() from public;grant execute on function public.payment_public_settings() to anon,authenticated;
create function public.payment_release_stock(attempt_id uuid) returns void language plpgsql security definer set search_path=public as $$
declare a public.payment_attempts; row record;
begin
 select * into a from public.payment_attempts where id=attempt_id for update;if not found or not a.reserved then return;end if;
 for row in select product_id,sum(quantity)::int qty from public.order_items where order_id=a.order_id group by product_id order by product_id loop update public.products set stock=stock+row.qty where id=row.product_id;end loop;
 for row in select variant_id,sum(quantity)::int qty from public.order_items where order_id=a.order_id group by variant_id order by variant_id loop update public.variants set stock=stock+row.qty where id=row.variant_id;end loop;
 update public.payment_attempts set reserved=false where id=a.id;
end $$;
create function public.expire_payment_attempts() returns integer language plpgsql security definer set search_path=public as $$
declare a record; n integer:=0;
begin
 for a in select id,order_id from public.payment_attempts where state in('creating','ready','unknown') and expires_at<now() order by expires_at limit 100 for update skip locked loop
  perform public.payment_release_stock(a.id);update public.payment_attempts set state='expired' where id=a.id;update public.orders set payment_status='expired',status='cancelled' where id=a.order_id;insert into public.payment_events(attempt_id,kind) values(a.id,'expired');n:=n+1;
 end loop;return n;
end $$;
create function public.prepare_payment(order_reference text,buyer_id uuid,expected_provider text default null,expected_mode text default null) returns jsonb language plpgsql security definer set search_path=public as $$
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
  if not found or product.stock<row.qty then raise exception 'OUT_OF_STOCK';end if;
  if cfg.mode='live' and product.demo then raise exception 'DEMO_PAYMENT_BLOCKED';end if;
 end loop;
 for row in select variant_id,product_id,sum(quantity)::int qty from public.order_items where order_id=o.id group by variant_id,product_id order by variant_id loop
  select * into variant from public.variants where id=row.variant_id and product_id=row.product_id for update;
  if not found or variant.stock<row.qty then raise exception 'OUT_OF_STOCK';end if;
 end loop;
 insert into public.payment_attempts(id,order_id,customer_id,provider,mode,amount_minor,merchant_ref,reserved) values(new_id,o.id,buyer_id,cfg.provider,cfg.mode,amount,'KZ'||replace(new_id::text,'-',''),cfg.mode='live') returning * into a;
 if cfg.mode='live' then
  for row in select product_id,sum(quantity)::int qty from public.order_items where order_id=o.id group by product_id order by product_id loop update public.products set stock=stock-row.qty where id=row.product_id;end loop;
  for row in select variant_id,sum(quantity)::int qty from public.order_items where order_id=o.id group by variant_id order by variant_id loop update public.variants set stock=stock-row.qty where id=row.variant_id;end loop;
 end if;
 update public.orders set payment_status='pending',payment_provider=cfg.provider where id=o.id;insert into public.payment_events(attempt_id,kind) values(a.id,'created');return to_jsonb(a)||jsonb_build_object('created',true);
end $$;
create function public.ready_payment(attempt_id uuid,provider_token text,provider_url text) returns void language plpgsql security definer set search_path=public as $$
begin
 update public.payment_attempts set token=provider_token,checkout_url=provider_url,state='ready' where id=attempt_id and state='creating';if found then insert into public.payment_events(attempt_id,kind) values(attempt_id,'ready');end if;
end $$;
create function public.payment_initialization_failed(attempt_id uuid,ambiguous boolean) returns void language plpgsql security definer set search_path=public as $$
declare a public.payment_attempts;
begin
 select * into a from public.payment_attempts where id=attempt_id for update;if not found or a.state<>'creating' then return;end if;
 if ambiguous then update public.payment_attempts set state='unknown',error_code='INITIALIZATION_UNKNOWN' where id=a.id;else perform public.payment_release_stock(a.id);update public.payment_attempts set state='failed',error_code='INITIALIZATION_REJECTED' where id=a.id;update public.orders set payment_status='failed',status='cancelled' where id=a.order_id;end if;
 insert into public.payment_events(attempt_id,kind) values(a.id,case when ambiguous then 'initialization_unknown' else 'initialization_failed' end);
end $$;
create function public.settle_payment(attempt_id uuid,was_paid boolean,received_amount bigint,received_currency text,transaction_id text,requires_review boolean default false) returns text language plpgsql security definer set search_path=public as $$
declare a public.payment_attempts; row record; available boolean:=true; final_state text;
begin
 select * into a from public.payment_attempts where id=attempt_id for update;if not found then raise exception 'PAYMENT_NOT_FOUND';end if;
 if a.state in('paid','test_paid','review') then return a.state;end if;
 if not was_paid and a.state in('failed','expired') then return a.state;end if;
 if not was_paid then perform public.payment_release_stock(a.id);update public.payment_attempts set state='failed' where id=a.id;update public.orders set payment_status='failed',status='cancelled' where id=a.order_id;insert into public.payment_events(attempt_id,kind) values(a.id,'failed');return 'failed';end if;
 if exists(select 1 from public.orders where id=a.order_id and status='cancelled') and a.state not in('failed','expired') then requires_review:=true;end if;
 if requires_review or received_amount is distinct from a.amount_minor or received_currency is distinct from 'TRY' then final_state:='review';
 elsif a.mode='test' then final_state:='test_paid';
 else
  if not a.reserved then
   for row in select product_id,sum(quantity)::int qty from public.order_items where order_id=a.order_id group by product_id order by product_id loop perform 1 from public.products where id=row.product_id for update;if not exists(select 1 from public.products where id=row.product_id and stock>=row.qty) then available:=false;end if;end loop;
   for row in select variant_id,sum(quantity)::int qty from public.order_items where order_id=a.order_id group by variant_id order by variant_id loop perform 1 from public.variants where id=row.variant_id for update;if not exists(select 1 from public.variants where id=row.variant_id and stock>=row.qty) then available:=false;end if;end loop;
   if available then
    for row in select product_id,sum(quantity)::int qty from public.order_items where order_id=a.order_id group by product_id order by product_id loop update public.products set stock=stock-row.qty where id=row.product_id;end loop;
    for row in select variant_id,sum(quantity)::int qty from public.order_items where order_id=a.order_id group by variant_id order by variant_id loop update public.variants set stock=stock-row.qty where id=row.variant_id;end loop;
   end if;
  end if;
  final_state:=case when available then 'paid' else 'review' end;
 end if;
 update public.payment_attempts set state=final_state,provider_payment_id=left(transaction_id,160),error_code=case when final_state='review' then 'PAYMENT_REVIEW_REQUIRED' else null end where id=a.id;
 update public.orders set payment_status=final_state,paid_at=now(),status=case when final_state='test_paid' then 'demo_request' when final_state='paid' then 'confirmed' else 'reviewing' end,demo=case when final_state='test_paid' then true else demo end where id=a.order_id;
 insert into public.payment_events(attempt_id,kind) values(a.id,final_state);return final_state;
end $$;
revoke all on function public.payment_release_stock(uuid),public.expire_payment_attempts(),public.prepare_payment(text,uuid,text,text),public.ready_payment(uuid,text,text),public.payment_initialization_failed(uuid,boolean),public.settle_payment(uuid,boolean,bigint,text,text,boolean) from public,anon,authenticated;
grant execute on function public.expire_payment_attempts(),public.prepare_payment(text,uuid,text,text),public.ready_payment(uuid,text,text),public.payment_initialization_failed(uuid,boolean),public.settle_payment(uuid,boolean,bigint,text,text,boolean) to service_role;
grant select,insert,update,delete on public.payment_attempts,public.payment_events to service_role;
grant select on public.orders,public.order_items,public.payment_settings to service_role;
grant select,insert,update on public.payment_settings to authenticated;
