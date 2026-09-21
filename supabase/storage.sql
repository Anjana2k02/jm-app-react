-- Run once in the Supabase SQL editor if doc-images has not been configured.
-- The base and session table schemas remain in ../../docs/.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('doc-images', 'doc-images', true, 5242880,
        array['image/png', 'image/jpeg', 'image/gif', 'image/webp'])
on conflict (id) do nothing;

drop policy if exists "jammer_images_insert_own" on storage.objects;
create policy "jammer_images_insert_own" on storage.objects
for insert to authenticated
with check (bucket_id = 'doc-images' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "jammer_images_select_own" on storage.objects;
create policy "jammer_images_select_own" on storage.objects
for select to authenticated
using (bucket_id = 'doc-images' and (storage.foldername(name))[1] = auth.uid()::text);
