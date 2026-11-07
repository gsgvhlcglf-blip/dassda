-- Public storefront videos; uploads remain limited to authenticated staff.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('site-media','site-media',true,52428800,array['video/mp4','video/webm'])
on conflict(id) do update set public=true,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;
create policy site_media_public_read on storage.objects for select using(bucket_id='site-media');
create policy site_media_staff_upload on storage.objects for insert to authenticated with check(bucket_id='site-media' and public.is_staff());
create policy site_media_admin_delete on storage.objects for delete to authenticated using(bucket_id='site-media' and public.is_admin());
