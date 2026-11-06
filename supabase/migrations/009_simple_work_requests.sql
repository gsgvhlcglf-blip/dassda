-- Enquiries describe the customer's motorcycle, independently of the shop catalog.
-- Historical records, links, quotations and audit evidence remain unchanged.
alter table public.work_requests alter column brand_id drop not null;
alter table public.work_requests add column brand_name text;
alter table public.work_requests add column model_name text;
alter table public.work_requests add column length_cm numeric check(length_cm>0 and length_cm<=10000);
alter table public.work_requests add column width_cm numeric check(width_cm>0 and width_cm<=10000);
update public.work_requests set brand_name=coalesce(body#>>'{input,brand_name}',body#>>'{snapshot,brand}'),model_name=coalesce(body#>>'{input,model_name}',body#>>'{snapshot,model}');

create or replace function public.submit_work_request(record jsonb,photos jsonb,source text,submission uuid,digest text) returns jsonb
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
 if record->>'status'<>'new' or (record->>'revision')::integer<>1 or
    coalesce(length(btrim(record#>>'{input,brand_name}')),0) not between 1 and 200 or
    coalesce(length(btrim(record#>>'{input,model_name}')),0) not between 1 and 200 or
    (record#>>'{input,year}')::integer not between 1900 and 2100 or
    jsonb_typeof(record#>'{input,length_cm}') is distinct from 'number' or
    jsonb_typeof(record#>'{input,width_cm}') is distinct from 'number' or
    (record#>>'{input,length_cm}')::numeric not between 0.01 and 10000 or
    (record#>>'{input,width_cm}')::numeric not between 0.01 and 10000 then raise exception 'INVALID_REQUEST';end if;
 if jsonb_typeof(photos) is distinct from 'array' or jsonb_array_length(photos) not between 3 and 8 or exists(select 1 from jsonb_array_elements(photos) f where f->>'request_id'<>rid::text or f->>'kind'<>'customer') then raise exception 'INVALID_FILES';end if;
 insert into public.work_requests(id,reference,kind,brand_id,model_id,model_year,brand_name,model_name,length_cm,width_cm,submission_key,fingerprint,source_hash,body)
 values(rid,record->>'reference',record->>'kind',nullif(record#>>'{input,brand_id}',''),nullif(record#>>'{input,model_id}',''),(record#>>'{input,year}')::integer,record#>>'{input,brand_name}',record#>>'{input,model_name}',(record#>>'{input,length_cm}')::numeric,(record#>>'{input,width_cm}')::numeric,submission,digest,source,record);
 insert into public.work_request_events values(gen_random_uuid(),rid,now(),'customer','created','','new','Talep alındı',jsonb_build_object('consents',record->'consents','contact_permission',true));
 insert into public.work_request_files select * from jsonb_populate_recordset(null::public.work_request_files,photos);
 return jsonb_build_object('id',rid,'reference',record->>'reference');
end $$;
revoke all on function public.submit_work_request(jsonb,jsonb,text,uuid,text) from public,anon,authenticated;
grant execute on function public.submit_work_request(jsonb,jsonb,text,uuid,text) to service_role;
