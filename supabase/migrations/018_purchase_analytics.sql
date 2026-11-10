-- Consent-only checkout step, never checkout form heatmaps or customer data.
alter table public.analytics_events drop constraint analytics_events_kind_check;
alter table public.analytics_events add constraint analytics_events_kind_check check(kind in('pageview','click','scroll','cart_add','checkout_start'));
alter table public.analytics_events add constraint analytics_checkout_step check((kind='checkout_start')=(path='/odeme') and (kind<>'checkout_start' or (depth is null and referrer_host='')));
create or replace function public.append_analytics_events(input jsonb) returns void language plpgsql security definer set search_path=public as $$
declare e jsonb; keep_days int;
begin
 if input->>'consent' is distinct from 'true' then raise exception 'CONSENT_REQUIRED'; end if;
 select retention_days into keep_days from public.analytics_settings where id='site' and enabled;
 if keep_days is null then raise exception 'ANALYTICS_DISABLED'; end if;
 if jsonb_typeof(input->'events') is distinct from 'array' or jsonb_array_length(input->'events') not between 1 and 30 then raise exception 'INVALID_EVENTS'; end if;
 delete from public.analytics_events where created_at<now()-make_interval(days=>keep_days);
 for e in select value from jsonb_array_elements(input->'events') loop
  if exists(select 1 from jsonb_object_keys(e) k where k not in('id','session_id','kind','path','viewport_width','viewport_height','document_width','document_height','x','y','depth','referrer_host','revision')) or (e->>'path'<>'/odeme' and e->>'path' !~ '^/(|motosikletler(/[a-zA-Z0-9_-]{1,120}){0,3}|urunler(/[a-zA-Z0-9_-]{1,120})?|blog(/[a-zA-Z0-9_-]{1,120})?|hakkimizda|iletisim|sss|teslimat-iade|gizlilik|kosullar|kargo-takip)$') or ((e->>'kind'='checkout_start') is distinct from (e->>'path'='/odeme')) or (e->>'kind'='checkout_start' and (e->>'depth' is not null or coalesce(e->>'referrer_host','')<>'')) or length(coalesce(e->>'path',''))>400 or coalesce(e->>'revision','') !~ '^[a-zA-Z0-9_-]{1,64}$' or coalesce(e->>'referrer_host','') !~ '^([a-zA-Z0-9-]+\.)*[a-zA-Z0-9-]*$' or length(coalesce(e->>'referrer_host',''))>253 then raise exception 'INVALID_EVENTS'; end if;
  if (select count(*) from public.analytics_events where session_id=(e->>'session_id')::uuid and created_at>now()-interval '1 day')>=2000 then raise exception 'RATE_LIMITED'; end if;
  insert into public.analytics_events(id,session_id,kind,path,viewport_width,viewport_height,document_width,document_height,x,y,depth,referrer_host,revision) values((e->>'id')::uuid,(e->>'session_id')::uuid,e->>'kind',e->>'path',(e->>'viewport_width')::integer,(e->>'viewport_height')::integer,(e->>'document_width')::integer,(e->>'document_height')::integer,(e->>'x')::numeric,(e->>'y')::numeric,(e->>'depth')::numeric,coalesce(e->>'referrer_host',''),e->>'revision') on conflict(id) do nothing;
 end loop;
end $$;

create function public.admin_purchase_funnel(requested_days integer) returns jsonb language plpgsql security definer set search_path=public as $$
declare result jsonb; since_at timestamptz; orders_since timestamptz;
begin
 if not public.is_admin() then raise exception 'FORBIDDEN';end if;
 orders_since:=(date_trunc('day',now() at time zone 'Europe/Istanbul')-make_interval(days=>greatest(1,least(90,requested_days))-1)) at time zone 'Europe/Istanbul';
 since_at:=greatest(orders_since,now()-make_interval(days=>(select retention_days from public.analytics_settings where id='site')));
 with events as(select * from public.analytics_events where created_at>=since_at and created_at<=now()),
 cohort as(select session_id,min(created_at) at,(array_agg(viewport_width order by created_at))[1] width from events where kind='pageview' and path ~ '^/urunler/[a-zA-Z0-9_-]+$' group by session_id),
 journey as(select c.session_id,case when width<768 then 'Mobil' when width<1100 then 'Tablet' else 'Masaüstü' end device,array[true,a.at is not null,p.at is not null] reached from cohort c
 left join lateral(select min(created_at) at from events e where e.session_id=c.session_id and kind='cart_add' and created_at>=c.at) a on true
 left join lateral(select min(created_at) at from events e where e.session_id=c.session_id and kind='checkout_start' and created_at>=a.at) p on true)
 select jsonb_build_object('counts',(select jsonb_agg((select count(*) from journey where reached[i])) from generate_series(1,3)i),'byDevice',(select jsonb_agg(jsonb_build_object('device',d,'counts',(select jsonb_agg((select count(*) from journey where device=d and reached[i])) from generate_series(1,3)i))) from unnest(array['Mobil','Tablet','Masaüstü'])d),'orders',(select jsonb_build_object('created',count(*),'paid',count(*) filter(where payment_status='paid'),'revenue',coalesce(sum(total) filter(where payment_status='paid'),0)) from public.orders where not demo and payment_status<>'test_paid' and created_at>=orders_since and created_at<=now())) into result;
 return result;
end $$;
revoke all on function public.admin_purchase_funnel(integer) from public,anon;
grant execute on function public.admin_purchase_funnel(integer) to authenticated;
