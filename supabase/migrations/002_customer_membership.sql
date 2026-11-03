-- Require a verified customer for new order requests; existing orders remain intact.
alter table public.orders add column customer_id uuid references auth.users(id) on delete set null;
create index orders_customer_time on public.orders(customer_id,created_at desc);
create policy customer_orders on public.orders for select to authenticated using(customer_id=auth.uid());
create policy customer_order_items on public.order_items for select to authenticated using(exists(select 1 from public.orders o where o.id=order_id and o.customer_id=auth.uid()));
alter function public.create_order_request(jsonb) rename to create_order_request_internal;
-- Preserve the existing implementation while making its insert independent of appended columns.
do $$ declare definition text; begin
 select pg_get_functiondef('public.create_order_request_internal(jsonb)'::regprocedure) into definition;
 definition := replace(definition,'insert into public.orders values(','insert into public.orders(id,reference,customer_name,email,phone,address,note,status,total,currency,demo,created_at) values(');
 execute definition;
end $$;
revoke all on function public.create_order_request_internal(jsonb) from public,anon,authenticated;
create function public.create_order_request(input jsonb) returns jsonb language plpgsql security definer set search_path=public as $$
declare result jsonb; customer_email text;
begin
 if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
 select email into customer_email from auth.users where id=auth.uid() and email_confirmed_at is not null;
 if customer_email is null then raise exception 'AUTH_REQUIRED'; end if;
 result:=public.create_order_request_internal(jsonb_set(input,'{email}',to_jsonb(customer_email)));
 update public.orders set customer_id=auth.uid() where reference=result->>'reference';
 return result;
end $$;
revoke all on function public.create_order_request(jsonb) from public,anon;
grant execute on function public.create_order_request(jsonb) to authenticated;
