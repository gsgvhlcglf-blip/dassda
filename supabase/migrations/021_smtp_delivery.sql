-- SMTP has no API idempotency guarantee. Lost acknowledgements/expired SMTP leases require review.
-- Never switch a frozen delivery to a different provider automatically.
create or replace function public.claim_order_notice(lease uuid) returns jsonb language plpgsql security definer set search_path=public as $$
declare result public.order_notifications;
begin
 update public.order_notifications set status='review',error='EMAIL_SMTP_RESULT_UNKNOWN' where status='sending' and lease_until<now() and email_payload->>'provider'='smtp';
 update public.order_notifications set status='review',error='EMAIL_RETRY_WINDOW_EXPIRED' where status in('pending','sending') and first_attempt_at<=now()-interval '23 hours';
 update public.order_notifications set status='sending',lease_token=lease,lease_until=now()+interval '2 minutes',first_attempt_at=coalesce(first_attempt_at,now()),attempts=attempts+1
 where id=(select id from public.order_notifications where ((status='pending' and next_attempt_at<=now()) or (status='sending' and lease_until<now())) and attempts<5 order by created_at limit 1 for update skip locked) returning * into result;
 if not found then return null;end if;return to_jsonb(result);
end $$;
create or replace function public.finish_order_notice(notice_id text,lease uuid,provider_id text,failure text) returns void language plpgsql security definer set search_path=public as $$
begin
 update public.order_notifications n set status=case when finish_order_notice.provider_id is not null then 'sent' when failure in('NOTICE_NOT_ELIGIBLE','NOTICE_SUPERSEDED','EMAIL_CONFIGURATION_REJECTED','EMAIL_SMTP_RESULT_UNKNOWN','EMAIL_PROVIDER_CHANGED') or attempts>=5 then 'review' else 'pending' end,
 provider_id=finish_order_notice.provider_id,sent_at=case when finish_order_notice.provider_id is not null then now() else null end,error=left(failure,100),next_attempt_at=now()+interval '1 minute',lease_until=null
 where n.id=notice_id and lease_token=lease and status='sending';
end $$;
create or replace function public.retry_order_notices(target_order text) returns void language plpgsql security definer set search_path=public as $$
begin
 update public.order_notifications set status='pending',attempts=0,next_attempt_at=now() where order_id=target_order and status in('pending','review','failed') and (first_attempt_at is null or first_attempt_at>now()-interval '23 hours') and coalesce(error,'') not in('NOTICE_NOT_ELIGIBLE','NOTICE_SUPERSEDED','EMAIL_SMTP_RESULT_UNKNOWN','EMAIL_PROVIDER_CHANGED');
 if not found then raise exception 'NOTICE_RETRY_UNAVAILABLE';end if;
end $$;

revoke all on function public.claim_order_notice(uuid),public.finish_order_notice(text,uuid,text,text),public.retry_order_notices(text) from public,anon,authenticated;
grant execute on function public.claim_order_notice(uuid),public.finish_order_notice(text,uuid,text,text),public.retry_order_notices(text) to service_role;
