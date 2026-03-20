-- Make post and gallery media private.
-- The application now serves these objects through signed URLs.

update storage.buckets
set public = false
where id in ('postagens', 'galeria');

drop policy if exists "storage: leitura publica postagens" on storage.objects;
drop policy if exists "storage: leitura publica galeria" on storage.objects;
drop policy if exists "storage postagens: leitura autenticados" on storage.objects;
drop policy if exists "storage galeria: leitura autenticados" on storage.objects;

create policy "storage postagens: leitura autenticados"
  on storage.objects for select
  to authenticated
  using (bucket_id = 'postagens');

create policy "storage galeria: leitura autenticados"
  on storage.objects for select
  to authenticated
  using (bucket_id = 'galeria');
