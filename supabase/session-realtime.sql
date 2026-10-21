-- Run once in the Supabase SQL editor. Safe to rerun.
-- Existing RLS and admin-only write policies remain in force.
begin;
do $$
declare table_name text;
begin
  if not exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    create publication supabase_realtime;
  end if;
  foreach table_name in array array['session_songs', 'sessions', 'documents'] loop
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = table_name
    ) then
      execute format('alter publication supabase_realtime add table public.%I', table_name);
    end if;
  end loop;
end $$;
-- Delete events must identify both columns of the session_songs composite key.
alter table public.session_songs replica identity full;
commit;
