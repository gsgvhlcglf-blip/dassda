-- Preserve payment and customer data; only staff can publish tracking information.
alter table public.orders add column if not exists tracking_number text not null default '';
alter table public.orders add column if not exists shipping_carrier text not null default '';
alter table public.orders add column if not exists tracking_url text not null default '';
alter table public.orders add column if not exists shipped_at timestamptz;
alter table public.orders add column if not exists fulfillment_version integer not null default 0;

create or replace function public.share_order_tracking(p_order_id text,p_tracking_number text,p_carrier text,p_tracking_url text,p_expected_version integer)
returns void language plpgsql security definer set search_path=public as $$
declare o public.orders;
begin
  if not public.is_admin() then raise exception 'ADMIN_REQUIRED'; end if;
  if p_tracking_number is null or p_tracking_number !~ '^[a-zA-Z0-9-]{3,80}$' or p_carrier is null or length(p_carrier)>120 or p_tracking_url is null or length(p_tracking_url)>2000 or p_expected_version is null then raise exception 'INVALID_TRACKING'; end if;
  if p_tracking_url<>'' and (p_tracking_url !~ '^https://[^/@[:space:]]+(/[^[:space:]]*)?$') then raise exception 'INVALID_TRACKING_URL'; end if;
  select * into o from public.orders where id=p_order_id for update;
  if not found then raise exception 'ORDER_NOT_FOUND'; end if;
  if o.status='cancelled' then raise exception 'ORDER_CANCELLED'; end if;
  if o.payment_provider is not null and o.payment_status<>'paid' then raise exception 'PAYMENT_NOT_PAID'; end if;
  if o.fulfillment_version<>p_expected_version then raise exception 'ORDER_CONFLICT'; end if;
  update public.orders set tracking_number=p_tracking_number,shipping_carrier=p_carrier,tracking_url=p_tracking_url,shipped_at=coalesce(shipped_at,now()),status='shipped',fulfillment_version=fulfillment_version+1 where id=p_order_id;
end $$;
revoke all on function public.share_order_tracking(text,text,text,text,integer) from public,anon;
grant execute on function public.share_order_tracking(text,text,text,text,integer) to authenticated;
