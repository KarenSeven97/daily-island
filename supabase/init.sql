-- Daily Island: run ONCE in the target Supabase project's SQL Editor.
-- If an object already exists, this transaction stops without replacing it.
-- Accounts/passwords are managed by Supabase Auth, not by this table.
begin;

create table public.daily_island_saves (
  user_id uuid primary key references auth.users(id) on delete cascade,
  snapshot jsonb not null,
  version bigint not null default 1 check (version > 0),
  updated_at timestamptz not null default now(),
  constraint daily_island_snapshot_shape check ((
    jsonb_typeof(snapshot) = 'object'
    and snapshot ->> 'schemaVersion' = '1'
    and jsonb_typeof(snapshot -> 'days') = 'object'
    and jsonb_typeof(snapshot -> 'preferences') = 'object'
  ) is true)
);

alter table public.daily_island_saves enable row level security;

revoke all on table public.daily_island_saves from public, anon, authenticated;
grant select, insert, update on table public.daily_island_saves to authenticated;

create policy daily_island_read_own
  on public.daily_island_saves for select to authenticated
  using ((select auth.uid()) = user_id);

create policy daily_island_insert_own
  on public.daily_island_saves for insert to authenticated
  with check ((select auth.uid()) = user_id);

create policy daily_island_update_own
  on public.daily_island_saves for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create function public.daily_island_stamp_save()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if TG_OP = 'INSERT' then
    NEW.version := 1;
  else
    NEW.version := OLD.version + 1;
  end if;
  NEW.updated_at := now();
  return NEW;
end;
$$;

create trigger daily_island_stamp_save
  before insert or update on public.daily_island_saves
  for each row execute function public.daily_island_stamp_save();

revoke all on function public.daily_island_stamp_save() from public, anon, authenticated;

-- Integration contract:
-- Read the cloud record before uploading an existing local record.
-- Update with BOTH user_id and the last-read version as filters.
-- If no row is updated, resolve the conflict instead of blindly overwriting.
-- Local browser saving must continue even when authentication/network fails.
commit;
