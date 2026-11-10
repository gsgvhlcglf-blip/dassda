-- Private templates and invoices. No credentials or PDFs are stored in the public catalog.
alter table public.order_notifications drop constraint order_notifications_kind_check;
alter table public.order_notifications add constraint order_notifications_kind_check check(kind in('order_confirmed','shipment_shared','invoice_ready'));
alter table public.order_notifications add column email_payload jsonb;
create table public.order_email_design(id text primary key check(id='site'),revision integer not null default 0,settings jsonb not null);
insert into public.order_email_design(id,settings) values('site','{"brand":"KUZMIN","tagline":"CARBON MOTORCYCLE PARTS","senderEmail":"","replyTo":"","accent":"#a64a3c","templates":{"order_confirmed":{"subject":"Siparişiniz onaylandı · {siparis_no}","heading":"Siparişiniz onaylandı.","intro":"Ödemeniz başarıyla doğrulandı. Siparişinizin özeti aşağıda; üretim ve gönderim sürecinde sizi bilgilendireceğiz.","footer":"Sipariş numaranızı saklayın. Destek talebinizde bu numarayı belirtin.","button":""},"shipment_shared":{"subject":"Siparişiniz kargoya verildi · {siparis_no}","heading":"Siparişiniz yola çıktı.","intro":"Siparişiniz kargoya verildi. Takip numaranızla gönderinizi kontrol edebilirsiniz.","footer":"Takip hareketleri kargo firmasının sistemi güncellendikçe görünür.","button":"Kargomu takip et"},"invoice_ready":{"subject":"Faturanız hazır · {siparis_no}","heading":"Faturanız hazır.","intro":"Siparişinize ait faturanızı bu e-postaya PDF olarak ekledik.","footer":"Faturanızı ve sipariş numaranızı saklayabilirsiniz.","button":""}}}'::jsonb);
alter table public.order_email_design enable row level security;
revoke all on public.order_email_design from public,anon,authenticated;
create table public.order_invoices(
 id uuid primary key,order_id text not null references public.orders(id) on delete cascade,
 version integer not null check(version>0),file_name text not null check(length(file_name) between 1 and 140),
 storage_key text not null unique,size integer not null check(size between 1 and 4194304),sha256 text not null check(sha256 ~ '^[a-f0-9]{64}$'),
 created_at timestamptz not null default now(),unique(order_id,version),unique(order_id,sha256)
);
alter table public.order_invoices enable row level security;
revoke all on public.order_invoices from public,anon,authenticated;
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('order-invoices','order-invoices',false,4194304,array['application/pdf']) on conflict(id) do update set public=false,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;
-- Deliberately no public/authenticated Storage policies: server-authenticated private downloads only.

create function public.save_order_email_design(expected integer,config jsonb) returns jsonb language plpgsql security definer set search_path=public as $$
declare result public.order_email_design;
begin
 if jsonb_typeof(config)<>'object' or octet_length(config::text)>15000 then raise exception 'INVALID_EMAIL_DESIGN';end if;
 update public.order_email_design set settings=config,revision=revision+1 where id='site' and revision=expected returning * into result;
 if not found then raise exception 'EMAIL_DESIGN_CONFLICT';end if;
 return to_jsonb(result);
end $$;
create function public.freeze_order_notice(notice_id text,lease uuid,payload jsonb) returns jsonb language plpgsql security definer set search_path=public as $$
declare result jsonb;
begin
 if jsonb_typeof(payload)<>'object' or octet_length(payload::text)>250000 then raise exception 'INVALID_EMAIL_PAYLOAD';end if;
 update public.order_notifications n set email_payload=coalesce(email_payload,payload) where id=notice_id and lease_token=lease and status='sending'
 and payload->>'to'=(select email from public.orders where id=n.order_id) returning email_payload into result;
 if not found then raise exception 'NOTICE_LEASE_EXPIRED';end if;return result;
end $$;
create function public.enqueue_invoice_notice() returns trigger language plpgsql security definer set search_path=public as $$
begin
 if exists(select 1 from public.orders where id=new.order_id and not demo and payment_status='paid' and status<>'cancelled') then
  insert into public.order_notifications(id,order_id,kind,version) values('invoice-'||new.id::text,new.order_id,'invoice_ready',new.version) on conflict do nothing;
 end if;return new;
end $$;
create trigger enqueue_invoice_notice after insert on public.order_invoices for each row execute function public.enqueue_invoice_notice();
create function public.register_order_invoice(invoice_id uuid,target_order text,expected integer,filename text,object_key text,file_size integer,file_hash text) returns jsonb language plpgsql security definer set search_path=public as $$
declare o public.orders; current_invoice public.order_invoices; result public.order_invoices;
begin
 select * into o from public.orders where id=target_order for update;
 if not found or o.payment_status<>'paid' or o.status='cancelled' then raise exception 'INVOICE_PAYMENT_REQUIRED';end if;
 if object_key<>invoice_id::text||'.pdf' or filename !~* '\.pdf$' or file_size not between 1 and 4194304 or file_hash !~ '^[a-f0-9]{64}$' then raise exception 'INVALID_INVOICE';end if;
 select * into current_invoice from public.order_invoices where order_id=target_order order by version desc limit 1;
 if current_invoice.sha256=file_hash then return to_jsonb(current_invoice);end if;
 if coalesce(current_invoice.version,0)<>expected then raise exception 'INVOICE_CONFLICT';end if;
 if exists(select 1 from public.order_invoices where order_id=target_order and sha256=file_hash) then raise exception 'INVOICE_ALREADY_UPLOADED';end if;
 insert into public.order_invoices(id,order_id,version,file_name,storage_key,size,sha256) values(invoice_id,target_order,expected+1,filename,object_key,file_size,file_hash) returning * into result;
 return to_jsonb(result);
end $$;
revoke all on function public.save_order_email_design(integer,jsonb),public.freeze_order_notice(text,uuid,jsonb),public.enqueue_invoice_notice(),public.register_order_invoice(uuid,text,integer,text,text,integer,text) from public,anon,authenticated;
grant execute on function public.save_order_email_design(integer,jsonb),public.freeze_order_notice(text,uuid,jsonb),public.register_order_invoice(uuid,text,integer,text,text,integer,text) to service_role;
