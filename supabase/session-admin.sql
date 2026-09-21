-- Run in the Supabase SQL editor before deploying the admin-only setlist UI.
-- No users are promoted by this migration. Existing read policies are preserved.
begin;

-- Read the protected role from the current account, not user-editable metadata
-- or a stale JWT. A role revocation takes effect on the next database request.
create or replace function public.jammer_is_session_admin()
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select exists (
    select 1 from auth.users
    where id = (select auth.uid())
      and raw_app_meta_data ->> 'role' = 'admin'
  );
$$;
revoke all on function public.jammer_is_session_admin() from public;
grant execute on function public.jammer_is_session_admin() to authenticated;

alter table public.session_songs enable row level security;

-- Restrictive policies also constrain older permissive shared-workspace policies.
drop policy if exists jammer_session_insert_admin_gate on public.session_songs;
create policy jammer_session_insert_admin_gate on public.session_songs
as restrictive for insert to public
with check ((select public.jammer_is_session_admin()));

drop policy if exists jammer_session_update_admin_gate on public.session_songs;
create policy jammer_session_update_admin_gate on public.session_songs
as restrictive for update to public
using ((select public.jammer_is_session_admin()))
with check ((select public.jammer_is_session_admin()));

drop policy if exists jammer_session_delete_admin_gate on public.session_songs;
create policy jammer_session_delete_admin_gate on public.session_songs
as restrictive for delete to public
using ((select public.jammer_is_session_admin()));

-- Allow admins to manage all songs in the existing shared workspace.
drop policy if exists jammer_session_insert_admin on public.session_songs;
create policy jammer_session_insert_admin on public.session_songs
for insert to authenticated with check ((select public.jammer_is_session_admin()));
drop policy if exists jammer_session_update_admin on public.session_songs;
create policy jammer_session_update_admin on public.session_songs
for update to authenticated using ((select public.jammer_is_session_admin()))
with check ((select public.jammer_is_session_admin()));
drop policy if exists jammer_session_delete_admin on public.session_songs;
create policy jammer_session_delete_admin on public.session_songs
for delete to authenticated using ((select public.jammer_is_session_admin()));

-- Foreign-key cascades bypass RLS. Check them too, so deleting a parent
-- document/session cannot be used by a regular user to remove session songs.
create or replace function public.jammer_guard_session_songs()
returns trigger language plpgsql security definer
set search_path = ''
as $$
begin
  if auth.role() in ('authenticated', 'anon')
     and not public.jammer_is_session_admin() then
    raise exception 'Only admins can change the songs in a session.' using errcode = '42501';
  end if;
  if TG_OP = 'DELETE' then return OLD; end if;
  return NEW;
end;
$$;
revoke all on function public.jammer_guard_session_songs() from public;
drop trigger if exists jammer_guard_session_songs on public.session_songs;
create trigger jammer_guard_session_songs
before insert or update or delete on public.session_songs
for each row execute function public.jammer_guard_session_songs();

commit;
