-- Run in this app's Supabase project's SQL editor to enable the shared song library.
-- Every signed-in account may read/create/edit documents, including another
-- account's songs. This matches the app's shared-workspace editing behavior.
-- Anonymous users get no access through these policies. RLS stays enabled.
-- Delete rules, session admin rules, user roles, and existing rows are unchanged.
-- Safe to rerun. No service-role key belongs in the frontend.
begin;

alter table public.documents enable row level security;
grant select, insert, update on public.documents to authenticated;

drop policy if exists jammer_documents_shared_select on public.documents;
create policy jammer_documents_shared_select on public.documents
for select to authenticated
using ((select auth.uid()) is not null);

-- Saves use UPSERT and retain the original user_id on existing songs.
-- INSERT checks also run on the conflict/update path, so an owner-only INSERT
-- check would reject edits to shared songs even with an UPDATE policy.
drop policy if exists jammer_documents_shared_insert on public.documents;
create policy jammer_documents_shared_insert on public.documents
for insert to authenticated
with check ((select auth.uid()) is not null);

drop policy if exists jammer_documents_shared_update on public.documents;
create policy jammer_documents_shared_update on public.documents
for update to authenticated
using ((select auth.uid()) is not null)
with check ((select auth.uid()) is not null);

commit;

-- Inspect this output if saves still fail. Custom RESTRICTIVE policies also
-- have to pass; these shared policies do not bypass or remove such policies.
select policyname, permissive, roles, cmd, qual, with_check
from pg_policies
where schemaname = 'public' and tablename = 'documents'
order by policyname;
