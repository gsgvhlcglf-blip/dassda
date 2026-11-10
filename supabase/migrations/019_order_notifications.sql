-- Durable transactional outbox. No browser/catalog access and no historical backfill.
create table public.order_notifications(
 id text primary key,order_id text not null references public.orders(id) on delete cascade,
 kind text not null check(kind in('order_confirmed','shipment_shared')),version integer not null,
 status text not null default 'pending' check(status in('pending','sending','sent','failed','review')),
 attempts integer not null default 0,lease_token uuid,lease_until timestamptz,first_attempt_at timestamptz,
 next_attempt_at timestamptz not null default now(),sent_at timestamptz,provider_id text,error text,
 created_at timestamptz not null default now(),unique(order_id,kind,version)
);
create index order_notifications_pending on public.order_notifications(status,next_attempt_at);
alter table public.order_notifications enable row level security;
revoke all on public.order_notifications from public,anon,authenticated;

create function public.enqueue_order_notice() returns trigger language plpgsql security definer set search_path=public as $$
begin
 if not new.demo and new.payment_status='paid' then
  if old.payment_status is distinct from 'paid' then
   insert into public.order_notifications(id,order_id,kind,version) values('confirmation-'||new.id,new.id,'order_confirmed',0) on conflict do nothing;
  end if;
  if new.fulfillment_version is distinct from old.fulfillment_version and new.shipped_at is not null and coalesce(new.tracking_number,'')<>'' then
   insert into public.order_notifications(id,order_id,kind,version) values('shipment-'||new.id||'-'||new.fulfillment_version,new.id,'shipment_shared',new.fulfillment_version) on conflict do nothing;
  end if;
 end if;
 return new;
end $$;
revoke all on function public.enqueue_order_notice() from public,anon,authenticated;
create trigger enqueue_order_notice after update of payment_status,fulfillment_version on public.orders for each row execute function public.enqueue_order_notice();

create function public.claim_order_notice(lease uuid) returns jsonb language plpgsql security definer set search_path=public as $$
declare result public.order_notifications;
begin
 update public.order_notifications set status='review',error='EMAIL_RETRY_WINDOW_EXPIRED' where status in('pending','sending') and first_attempt_at<=now()-interval '23 hours';
 update public.order_notifications set status='sending',lease_token=lease,lease_until=now()+interval '2 minutes',first_attempt_at=coalesce(first_attempt_at,now()),attempts=attempts+1
 where id=(select id from public.order_notifications where ((status='pending' and next_attempt_at<=now()) or (status='sending' and lease_until<now())) and attempts<5 order by created_at limit 1 for update skip locked) returning * into result;
 if not found then return null;end if;return to_jsonb(result);
end $$;
create function public.finish_order_notice(notice_id text,lease uuid,provider_id text,failure text) returns void language plpgsql security definer set search_path=public as $$
begin
 update public.order_notifications n set status=case when finish_order_notice.provider_id is not null then 'sent' when failure in('NOTICE_NOT_ELIGIBLE','NOTICE_SUPERSEDED','EMAIL_CONFIGURATION_REJECTED') or attempts>=5 then 'review' else 'pending' end,
 provider_id=finish_order_notice.provider_id,sent_at=case when finish_order_notice.provider_id is not null then now() else null end,error=left(failure,100),next_attempt_at=now()+interval '1 minute',lease_until=null
 where n.id=notice_id and lease_token=lease and status='sending';
end $$;
create function public.retry_order_notices(target_order text) returns void language plpgsql security definer set search_path=public as $$
begin
 update public.order_notifications set status='pending',attempts=0,next_attempt_at=now() where order_id=target_order and status in('pending','review','failed') and (first_attempt_at is null or first_attempt_at>now()-interval '23 hours') and coalesce(error,'') not in('NOTICE_NOT_ELIGIBLE','NOTICE_SUPERSEDED');
 if not found then raise exception 'NOTICE_RETRY_UNAVAILABLE';end if;
end $$;
revoke all on function public.claim_order_notice(uuid),public.finish_order_notice(text,uuid,text,text),public.retry_order_notices(text) from public,anon,authenticated;
grant execute on function public.claim_order_notice(uuid),public.finish_order_notice(text,uuid,text,text),public.retry_order_notices(text) to service_role;
