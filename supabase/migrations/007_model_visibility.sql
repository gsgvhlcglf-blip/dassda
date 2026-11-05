-- Visibility is separate from deletion: keep models, years and fitments editable.
alter table public.models add column if not exists published boolean not null default true;

-- Older private drafts/version snapshots predate this column. jsonb_populate_recordset
-- supplies NULL for their missing flag; preserve their previous visible behavior.
create function public.default_model_publication() returns trigger
language plpgsql set search_path=public as $$
begin
  new.published := coalesce(new.published, true);
  return new;
end $$;
create trigger default_model_publication before insert or update on public.models
for each row execute function public.default_model_publication();

drop policy public_read on public.models;
create policy public_read on public.models for select
using (published or public.is_staff());

drop policy public_read on public.generations;
create policy public_read on public.generations for select
using (public.is_staff() or exists (
  select 1 from public.models m where m.id=model_id and m.published
));

drop policy public_read on public.model_years;
create policy public_read on public.model_years for select
using (public.is_staff() or exists (
  select 1 from public.models m where m.id=model_id and m.published
));

drop policy public_read on public.compatibility;
create policy public_read on public.compatibility for select
using (public.is_staff() or (
  exists (select 1 from public.models m where m.id=model_id and m.published)
  and exists (select 1 from public.products p where p.id=product_id and p.published)
));
