-- Private guest/member enquiries, production CRM, evidence and versioned terms.
create table public.work_requests (
 id uuid primary key, reference text unique not null, kind text not null check(kind in('custom','demand')),
 brand_id text not null references public.brands(id), model_id text references public.models(id) on delete set null, model_year integer not null,
 submission_key uuid unique not null, fingerprint text not null, source_hash text not null,
 body jsonb not null, revision bigint not null default 1, created_at timestamptz not null default now()
);
create index work_requests_time on public.work_requests(created_at desc);
create index work_requests_source on public.work_requests(source_hash,created_at);
create table public.work_request_events(id uuid primary key,request_id uuid not null references public.work_requests(id),created_at timestamptz not null,actor text not null,type text not null,from_status text not null,to_status text not null,note text not null,detail jsonb);
create index work_event_request on public.work_request_events(request_id,created_at);
create table public.work_request_files(id uuid primary key,request_id uuid not null references public.work_requests(id),kind text not null check(kind in('customer','received')),path text unique not null,name text not null,mime text not null,size integer not null check(size between 1 and 5242880));
create table public.work_terms_versions(version integer primary key,body jsonb not null,created_at timestamptz not null default now());
insert into public.work_terms_versions(version,body) values(0,'{"version":0,"documents":{"ownership":{"text":"","approved":false},"damage":{"text":"","approved":false},"returns":{"text":"","approved":false},"mould":{"text":"","approved":false}}}');
do $$declare t text;begin
 foreach t in array array['work_requests','work_request_events','work_request_files','work_terms_versions'] loop
  execute format('alter table public.%I enable row level security',t);
  execute format('create policy admin_read on public.%I for select to authenticated using(public.is_admin())',t);
  execute format('revoke all on public.%I from anon,authenticated',t);
  execute format('grant select on public.%I to authenticated',t);
  execute format('grant all on public.%I to service_role',t);
 end loop;
end $$;

create function public.submit_work_request(record jsonb,photos jsonb,source text,submission uuid,digest text) returns jsonb
language plpgsql security definer set search_path=public as $$
declare existing public.work_requests;rid uuid:=(record->>'id')::uuid;
begin
 perform pg_advisory_xact_lock(hashtextextended('work-submission:'||submission::text,0));
 select * into existing from public.work_requests where submission_key=submission;
 if found then
  if existing.fingerprint<>digest then raise exception 'SUBMISSION_CONFLICT';end if;
  return jsonb_build_object('id',existing.id,'reference',existing.reference);
 end if;
 perform pg_advisory_xact_lock(hashtextextended('work-source:'||source,0));
 if (select count(*) from public.work_requests where source_hash=source and created_at>now()-interval '10 minutes')>=5 or
    (select count(*) from public.work_requests where created_at>now()-interval '10 minutes' and ((record#>>'{input,email}'<>'' and lower(body#>>'{input,email}')=lower(record#>>'{input,email}')) or (record#>>'{input,phone}'<>'' and body#>>'{input,phone}'=record#>>'{input,phone}')))>=3 then raise exception 'RATE_LIMITED';end if;
 if record->>'status'<>'new' or (record->>'revision')::integer<>1 or not exists(select 1 from public.models m join public.model_years y on y.model_id=m.id where m.id=record#>>'{input,model_id}' and m.brand_id=record#>>'{input,brand_id}' and m.published and y.year=(record#>>'{input,year}')::integer) then raise exception 'INVALID_REQUEST';end if;
 if jsonb_typeof(photos) is distinct from 'array' or jsonb_array_length(photos)>8 then raise exception 'INVALID_FILES';end if;
 insert into public.work_requests(id,reference,kind,brand_id,model_id,model_year,submission_key,fingerprint,source_hash,body) values(rid,record->>'reference',record->>'kind',record#>>'{input,brand_id}',record#>>'{input,model_id}',(record#>>'{input,year}')::integer,submission,digest,source,record);
 insert into public.work_request_events values(gen_random_uuid(),rid,now(),'customer','created','','new','Talep alındı',jsonb_build_object('consents',record->'consents','contact_permission',true));
 insert into public.work_request_files select * from jsonb_populate_recordset(null::public.work_request_files,photos);
 return jsonb_build_object('id',rid,'reference',record->>'reference');
end $$;
create function public.update_work_request(expected bigint,record jsonb,event jsonb) returns void
language plpgsql security definer set search_path=public as $$
begin
 update public.work_requests set body=record,revision=revision+1 where id=(record->>'id')::uuid and revision=expected and (record->>'revision')::bigint=expected+1;
 if not found then raise exception 'REQUEST_CONFLICT';end if;
 insert into public.work_request_events select * from jsonb_populate_record(null::public.work_request_events,event);
end $$;
create function public.save_work_terms(expected integer,documents jsonb) returns jsonb
language plpgsql security definer set search_path=public as $$
declare current_version integer;result jsonb;
begin
 perform pg_advisory_xact_lock(hashtextextended('work-terms',0));
 select max(version) into current_version from public.work_terms_versions;
 if current_version<>expected then raise exception 'REQUEST_CONFLICT';end if;
 result:=jsonb_build_object('version',current_version+1,'documents',documents);
 insert into public.work_terms_versions(version,body) values(current_version+1,result);return result;
end $$;
create function public.attach_work_files(expected bigint,record jsonb,event jsonb,photos jsonb) returns void
language plpgsql security definer set search_path=public as $$
begin
 perform public.update_work_request(expected,record,event);
 if (select count(*) from public.work_request_files where request_id=(record->>'id')::uuid)+jsonb_array_length(photos)>24 or exists(select 1 from jsonb_array_elements(photos) f where f->>'request_id'<>record->>'id' or f->>'kind'<>'received') then raise exception 'INVALID_FILES';end if;
 insert into public.work_request_files select * from jsonb_populate_recordset(null::public.work_request_files,photos);
end $$;
revoke all on function public.submit_work_request(jsonb,jsonb,text,uuid,text),public.update_work_request(bigint,jsonb,jsonb),public.save_work_terms(integer,jsonb) from public,anon,authenticated;
grant execute on function public.submit_work_request(jsonb,jsonb,text,uuid,text),public.update_work_request(bigint,jsonb,jsonb),public.save_work_terms(integer,jsonb) to service_role;
revoke all on function public.attach_work_files(bigint,jsonb,jsonb,jsonb) from public,anon,authenticated;
grant execute on function public.attach_work_files(bigint,jsonb,jsonb,jsonb) to service_role;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('work-requests','work-requests',false,5242880,array['image/jpeg','image/png','image/webp']) on conflict(id) do update set public=false,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;
create policy work_request_admin_files on storage.objects for select to authenticated using(bucket_id='work-requests' and public.is_admin());
