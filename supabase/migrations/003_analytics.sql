-- First-party aggregate analytics. Event rows and reports are private to admins.
create table public.analytics_settings(id text primary key check(id='site'),enabled boolean not null default false,retention_days integer not null default 30 check(retention_days in(7,30,90)));
insert into public.analytics_settings(id) values('site');
create table public.analytics_events(id uuid primary key,session_id uuid not null,kind text not null check(kind in('pageview','click','scroll')),path text not null,viewport_width integer not null check(viewport_width between 240 and 7680),viewport_height integer not null check(viewport_height between 200 and 4320),document_width integer not null check(document_width between 240 and 16384),document_height integer not null check(document_height between 200 and 100000),x numeric check(x between 0 and 1),y numeric check(y between 0 and 1),depth numeric check(depth between 0 and 1),referrer_host text not null default '',revision text not null,created_at timestamptz not null default now(),check((kind='click' and x is not null and y is not null) or(kind<>'click' and x is null and y is null)));
create index analytics_event_time on public.analytics_events(created_at);
create index analytics_event_path on public.analytics_events(path,viewport_width,viewport_height,created_at);
create index analytics_session_time on public.analytics_events(session_id,created_at);
alter table public.analytics_settings enable row level security;
alter table public.analytics_events enable row level security;
create policy analytics_admin_settings on public.analytics_settings for all to authenticated using(public.is_admin()) with check(public.is_admin());
create policy analytics_admin_read on public.analytics_events for select to authenticated using(public.is_admin());
create function public.analytics_public_settings() returns jsonb language sql stable security definer set search_path=public as $$select jsonb_build_object('enabled',enabled,'retentionDays',retention_days) from public.analytics_settings where id='site'$$;
revoke all on function public.analytics_public_settings() from public;
grant execute on function public.analytics_public_settings() to anon,authenticated;
create function public.append_analytics_events(input jsonb) returns void language plpgsql security definer set search_path=public as $$
declare e jsonb; keep_days int;
begin
 if input->>'consent' is distinct from 'true' then raise exception 'CONSENT_REQUIRED'; end if;
 select retention_days into keep_days from public.analytics_settings where id='site' and enabled;
 if keep_days is null then raise exception 'ANALYTICS_DISABLED'; end if;
 if jsonb_typeof(input->'events') is distinct from 'array' or jsonb_array_length(input->'events') not between 1 and 30 then raise exception 'INVALID_EVENTS'; end if;
 delete from public.analytics_events where created_at<now()-make_interval(days=>keep_days);
 for e in select value from jsonb_array_elements(input->'events') loop
  if exists(select 1 from jsonb_object_keys(e) k where k not in('id','session_id','kind','path','viewport_width','viewport_height','document_width','document_height','x','y','depth','referrer_host','revision')) or e->>'path' !~ '^/(|motosikletler(/[a-zA-Z0-9_-]{1,120}){0,3}|urunler(/[a-zA-Z0-9_-]{1,120})?|blog(/[a-zA-Z0-9_-]{1,120})?|hakkimizda|iletisim|sss|teslimat-iade|gizlilik|kosullar|kargo-takip)$' or length(coalesce(e->>'path',''))>400 or coalesce(e->>'revision','') !~ '^[a-zA-Z0-9_-]{1,64}$' or coalesce(e->>'referrer_host','') !~ '^([a-zA-Z0-9-]+\.)*[a-zA-Z0-9-]*$' or length(coalesce(e->>'referrer_host',''))>253 then raise exception 'INVALID_EVENTS'; end if;
  if (select count(*) from public.analytics_events where session_id=(e->>'session_id')::uuid and created_at>now()-interval '1 day')>=2000 then raise exception 'RATE_LIMITED'; end if;
  insert into public.analytics_events(id,session_id,kind,path,viewport_width,viewport_height,document_width,document_height,x,y,depth,referrer_host,revision) values((e->>'id')::uuid,(e->>'session_id')::uuid,e->>'kind',e->>'path',(e->>'viewport_width')::integer,(e->>'viewport_height')::integer,(e->>'document_width')::integer,(e->>'document_height')::integer,(e->>'x')::numeric,(e->>'y')::numeric,(e->>'depth')::numeric,coalesce(e->>'referrer_host',''),e->>'revision') on conflict(id) do nothing;
 end loop;
end $$;
revoke all on function public.append_analytics_events(jsonb) from public;
grant execute on function public.append_analytics_events(jsonb) to anon,authenticated;
create function public.admin_analytics_summary(requested_days integer) returns jsonb language plpgsql security definer set search_path=public as $$
declare result jsonb; keep_days integer; days integer:=greatest(1,least(90,requested_days)); since_at timestamptz;
begin
 if not public.is_admin() then raise exception 'FORBIDDEN'; end if;
 select retention_days into keep_days from public.analytics_settings where id='site';
 delete from public.analytics_events where created_at<now()-make_interval(days=>keep_days);
 since_at:=(date_trunc('day',now() at time zone 'Europe/Istanbul')-make_interval(days=>days-1)) at time zone 'Europe/Istanbul';
 with filtered as(select * from public.analytics_events where created_at>=since_at and created_at<=now()),depths as(select session_id,path,max(depth) as maximum from filtered where depth is not null group by session_id,path)
 select jsonb_build_object(
 'totals',(select jsonb_build_object('sessions',count(distinct session_id) filter(where kind='pageview'),'pageviews',count(*) filter(where kind='pageview'),'clicks',count(*) filter(where kind='click'),'averageDepth',coalesce((select avg(maximum) from depths),0)) from filtered),
 'daily',(select coalesce(jsonb_agg(to_jsonb(d) order by d.date),'[]'::jsonb) from(select to_char(day,'YYYY-MM-DD') as date,(select count(*) from filtered where kind='pageview' and (created_at at time zone 'Europe/Istanbul')::date=day::date) as views,(select count(distinct session_id) from filtered where kind='pageview' and (created_at at time zone 'Europe/Istanbul')::date=day::date) as sessions,(select count(*) from filtered where kind='click' and (created_at at time zone 'Europe/Istanbul')::date=day::date) as clicks from generate_series((now() at time zone 'Europe/Istanbul')::date-days+1,(now() at time zone 'Europe/Istanbul')::date,interval '1 day') day)d),
 'pages',(select coalesce(jsonb_agg(to_jsonb(p)),'[]'::jsonb) from(select path,count(*) filter(where kind='pageview') as views,count(distinct session_id) filter(where kind='pageview') as sessions,count(*) filter(where kind='click') as clicks,coalesce((select avg(maximum) from depths where depths.path=f.path),0) as "averageDepth" from filtered f group by path order by views desc,clicks desc limit 50)p),
 'devices',(select coalesce(jsonb_agg(to_jsonb(d)),'[]'::jsonb) from(select case when viewport_width<768 then 'Mobil' when viewport_width<1100 then 'Tablet' else 'Masaüstü' end as device,count(*) as views from filtered where kind='pageview' group by 1 order by views desc)d),
 'sources',(select coalesce(jsonb_agg(to_jsonb(s)),'[]'::jsonb) from(select coalesce(nullif(referrer_host,''),'Doğrudan') as host,count(*) as views from filtered where kind='pageview' group by 1 order by views desc limit 20)s)
 ) into result;
 return result;
end $$;
create function public.admin_analytics_heatmap(requested_days integer,selected_path text,selected_width integer default null,selected_height integer default null,selected_revision text default null) returns jsonb language plpgsql security definer set search_path=public as $$
declare result jsonb; since_at timestamptz;
begin
 if not public.is_admin() then raise exception 'FORBIDDEN'; end if;
 since_at:=greatest((date_trunc('day',now() at time zone 'Europe/Istanbul')-make_interval(days=>greatest(1,least(90,requested_days))-1)) at time zone 'Europe/Istanbul',now()-make_interval(days=>(select retention_days from public.analytics_settings where id='site')));
 with filtered as(select * from public.analytics_events where path=selected_path and kind='click' and created_at>=since_at and created_at<=now()),chosen as(select * from filtered where(selected_width is null or viewport_width=selected_width)and(selected_height is null or viewport_height=selected_height)and(selected_revision is null or revision=selected_revision)),cells as(select least(39,floor(x*40)) as ix,least(99,floor(y*100)) as iy,count(*) as count from chosen group by 1,2)
 select jsonb_build_object('screens',(select coalesce(jsonb_agg(to_jsonb(s)),'[]'::jsonb) from(select viewport_width as width,viewport_height as height,revision,count(*) as clicks from filtered group by 1,2,3 order by clicks desc limit 100)s),'points',(select coalesce(jsonb_agg(jsonb_build_object('x',(ix+.5)/40,'y',(iy+.5)/100,'count',count)),'[]'::jsonb) from cells),'total',(select count(*) from chosen)) into result;
 return result;
end $$;
create function public.clear_analytics_events() returns void language plpgsql security definer set search_path=public as $$begin if not public.is_admin() then raise exception 'FORBIDDEN';end if;delete from public.analytics_events;end$$;
revoke all on function public.admin_analytics_summary(integer),public.admin_analytics_heatmap(integer,text,integer,integer,text),public.clear_analytics_events() from public;
grant execute on function public.admin_analytics_summary(integer),public.admin_analytics_heatmap(integer,text,integer,integer,text),public.clear_analytics_events() to authenticated;
