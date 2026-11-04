-- Only successful add-to-cart actions extend the anonymous public-page funnel.
alter table public.analytics_events drop constraint analytics_events_kind_check;
alter table public.analytics_events add constraint analytics_events_kind_check check(kind in('pageview','click','scroll','cart_add'));
alter table public.analytics_events add constraint analytics_cart_path check(kind<>'cart_add' or path ~ '^/urunler/[a-zA-Z0-9_-]+$');
create function public.admin_analytics_funnel(requested_days integer) returns jsonb language plpgsql security definer set search_path=public as $$
declare result jsonb; since_at timestamptz;
begin
 if not public.is_admin() then raise exception 'FORBIDDEN';end if;
 since_at:=greatest((date_trunc('day',now() at time zone 'Europe/Istanbul')-make_interval(days=>greatest(1,least(90,requested_days))-1)) at time zone 'Europe/Istanbul',now()-make_interval(days=>(select retention_days from public.analytics_settings where id='site')));
 with events as(select session_id,created_at,viewport_width,case when kind='cart_add' then 5 when kind='pageview' and path ~ '^/urunler/[a-zA-Z0-9_-]+$' then 4 when kind='pageview' and path ~ '^/motosikletler(/[a-zA-Z0-9_-]+){0,3}$' then cardinality(string_to_array(trim(both '/' from path),'/'))-1 else null end as stage from public.analytics_events where created_at>=since_at and created_at<=now()),
 cohort as(select session_id,min(created_at) as at,(array_agg(viewport_width order by created_at))[1] as width from events where stage=0 group by session_id),
 journey as(select c.session_id,case when c.width<768 then 'Mobil' when c.width<1100 then 'Tablet' else 'Masaüstü' end as device,array[true,b.at is not null,m.at is not null,y.at is not null,p.at is not null,a.at is not null] as reached from cohort c
 left join lateral(select min(created_at) as at from events e where e.session_id=c.session_id and stage=1 and created_at>=c.at)b on true
 left join lateral(select min(created_at) as at from events e where e.session_id=c.session_id and stage=2 and created_at>=b.at)m on true
 left join lateral(select min(created_at) as at from events e where e.session_id=c.session_id and stage=3 and created_at>=m.at)y on true
 left join lateral(select min(created_at) as at from events e where e.session_id=c.session_id and stage=4 and created_at>=y.at)p on true
 left join lateral(select min(created_at) as at from events e where e.session_id=c.session_id and stage=5 and created_at>=p.at)a on true)
 select jsonb_build_object('counts',(select jsonb_agg((select count(*) from journey where reached[i])) from generate_series(1,6)i),'byDevice',(select jsonb_agg(jsonb_build_object('device',d,'counts',(select jsonb_agg((select count(*) from journey where device=d and reached[i])) from generate_series(1,6)i))) from unnest(array['Mobil','Tablet','Masaüstü'])d),'directProductSessions',(select count(distinct session_id) from events e where stage=4 and not exists(select 1 from cohort c where c.session_id=e.session_id))) into result;
 return result;
end $$;
revoke all on function public.admin_analytics_funnel(integer) from public;
grant execute on function public.admin_analytics_funnel(integer) to authenticated;
