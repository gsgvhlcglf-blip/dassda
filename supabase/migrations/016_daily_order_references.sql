-- Customer-facing order numbers: #DDMMYY + daily sequence, Istanbul time.
-- Existing order references, IDs and payment-provider merchant references stay intact.
create table if not exists public.order_daily_counters (
  day date primary key,
  last_number bigint not null check(last_number between 1 and 9007199254740991)
);
alter table public.order_daily_counters enable row level security;
revoke all on public.order_daily_counters from public,anon,authenticated;

insert into public.order_daily_counters(day,last_number)
select (created_at at time zone 'Europe/Istanbul')::date,
 greatest(count(*),coalesce(max(case when reference ~ '^#[0-9]{6}[1-9][0-9]{0,15}$'
 and substring(reference from 2 for 6)=to_char(created_at at time zone 'Europe/Istanbul','DDMMYY')
 then case when substring(reference from 8)::bigint<=9007199254740991
 then substring(reference from 8)::bigint else 0 end else 0 end),0))
from public.orders group by 1
on conflict(day) do update set last_number=greatest(public.order_daily_counters.last_number,excluded.last_number);

create or replace function public.next_order_reference(p_at timestamptz default now())
returns text language plpgsql security definer set search_path=public as $$
declare d date:=(p_at at time zone 'Europe/Istanbul')::date; n bigint;
begin
 if p_at is null then raise exception 'INVALID_ORDER_DATE'; end if;
 update public.order_daily_counters set last_number=last_number+1 where day=d returning last_number into n;
 if not found then
   insert into public.order_daily_counters(day,last_number) values(d,1)
   on conflict(day) do update set last_number=public.order_daily_counters.last_number+1 returning last_number into n;
 end if;
 return '#'||to_char(d,'DDMMYY')||n::text;
end $$;
revoke all on function public.next_order_reference(timestamptz) from public,anon,authenticated;

create or replace function public.create_order_request(input jsonb) returns jsonb language plpgsql security definer set search_path=public as $$
declare result jsonb; customer_email text; ref text;
begin
 if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
 select email into customer_email from auth.users where id=auth.uid() and email_confirmed_at is not null;
 if customer_email is null then raise exception 'AUTH_REQUIRED'; end if;
 ref:=public.next_order_reference(now());
 result:=public.create_order_request_internal(jsonb_set(input,'{email}',to_jsonb(customer_email)));
 update public.orders set customer_id=auth.uid(),reference=ref where reference=result->>'reference';
 return jsonb_set(result,'{reference}',to_jsonb(ref));
end $$;
revoke all on function public.create_order_request(jsonb) from public,anon;
grant execute on function public.create_order_request(jsonb) to authenticated;
