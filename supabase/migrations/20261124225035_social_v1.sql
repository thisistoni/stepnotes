-- Waltzy social v1: accounts, library sync, share links, classes, reports.
-- Principle: people who only receive (open a link, join a class) need no account. They read
-- through the functions below, which need the unguessable link id / class code. People who
-- publish need an account and manage their own rows under row level security.

create or replace function public.new_code(n int)
returns text
language plpgsql
volatile
set search_path = ''
as $$
declare
  alphabet constant text := 'abcdefghijkmnpqrstuvwxyz23456789'; -- 32 symbols, no l / o / 0 / 1
  bytes bytea := extensions.gen_random_bytes(n);
  out text := '';
begin
  for i in 0 .. n - 1 loop
    out := out || substr(alphabet, (get_byte(bytes, i) % 32) + 1, 1);
  end loop;
  return out;
end;
$$;
revoke all on function public.new_code(int) from public, anon, authenticated;

-- ---------------------------------------------------------------------------------- profiles
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null check (char_length(btrim(display_name)) between 1 and 40),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.profiles enable row level security;
create policy "own profile: read" on public.profiles for select to authenticated using (id = (select auth.uid()));
create policy "own profile: create" on public.profiles for insert to authenticated with check (id = (select auth.uid()));
create policy "own profile: change" on public.profiles for update to authenticated using (id = (select auth.uid())) with check (id = (select auth.uid()));
revoke all on public.profiles from anon, authenticated;
grant select on public.profiles to authenticated;
grant insert (id, display_name) on public.profiles to authenticated;
grant update (display_name, updated_at) on public.profiles to authenticated;

-- ----------------------------------------------------------------------------- library sync
-- One row per dance or collection of a user. `updated_at` is the client's clock (ms) and decides
-- which side wins; `server_updated_at` is the server's clock and is what a device asks "what
-- changed since" with. A deleted item stays as a row without data, so other devices learn of it.
create table public.library_items (
  owner uuid not null default auth.uid() references auth.users (id) on delete cascade,
  kind text not null check (kind in ('dance', 'collection')),
  id text not null check (char_length(id) between 1 and 80),
  data jsonb,
  updated_at bigint not null,
  deleted boolean not null default false,
  server_updated_at timestamptz not null default clock_timestamp(),
  primary key (owner, kind, id),
  check (deleted or data is not null),
  check (data is null or pg_column_size(data) <= 262144)
);
create index library_items_changes on public.library_items (owner, server_updated_at);
alter table public.library_items enable row level security;
create policy "own library: read" on public.library_items for select to authenticated using (owner = (select auth.uid()));
create policy "own library: add" on public.library_items for insert to authenticated with check (owner = (select auth.uid()));
create policy "own library: change" on public.library_items for update to authenticated using (owner = (select auth.uid())) with check (owner = (select auth.uid()));
revoke all on public.library_items from anon, authenticated;
grant select, insert, update on public.library_items to authenticated;

-- Push changes: an item only replaces the stored one if it is newer (last writer wins).
create or replace function public.push_library_items(items jsonb)
returns int
language plpgsql
security invoker
set search_path = ''
as $$
declare
  me uuid := auth.uid();
  n int;
begin
  if me is null then
    raise exception 'not signed in' using errcode = '28000';
  end if;
  if jsonb_typeof(items) <> 'array' or jsonb_array_length(items) > 200 then
    raise exception 'items must be a list of at most 200' using errcode = '22023';
  end if;
  if (select count(*) from public.library_items where owner = me) + jsonb_array_length(items) > 3000 then
    raise exception 'library is full' using errcode = '53400';
  end if;
  insert into public.library_items as li (owner, kind, id, data, updated_at, deleted, server_updated_at)
  select me, i.kind, i.id, case when coalesce(i.deleted, false) then null else i.data end, i.updated_at, coalesce(i.deleted, false), clock_timestamp()
  from jsonb_to_recordset(items) as i (kind text, id text, data jsonb, updated_at bigint, deleted boolean)
  on conflict (owner, kind, id) do update
    set data = excluded.data, updated_at = excluded.updated_at, deleted = excluded.deleted, server_updated_at = clock_timestamp()
    where excluded.updated_at > li.updated_at;
  get diagnostics n = row_count;
  return n;
end;
$$;
revoke all on function public.push_library_items(jsonb) from public, anon;
grant execute on function public.push_library_items(jsonb) to authenticated;

-- ----------------------------------------------------------------------------------- shares
-- A dance published under a link. One link per dance of a user; publishing again updates it.
create table public.shares (
  id text primary key default public.new_code(12),
  owner uuid not null default auth.uid() references auth.users (id) on delete cascade,
  dance_id text not null check (char_length(dance_id) between 1 and 80),
  name text not null check (char_length(name) <= 120),
  dance jsonb not null check (jsonb_typeof(dance) = 'object' and pg_column_size(dance) <= 262144),
  hidden boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (owner, dance_id)
);
alter table public.shares enable row level security;
create policy "own shares: read" on public.shares for select to authenticated using (owner = (select auth.uid()));
create policy "own shares: publish" on public.shares for insert to authenticated with check (owner = (select auth.uid()));
create policy "own shares: update" on public.shares for update to authenticated using (owner = (select auth.uid())) with check (owner = (select auth.uid()));
create policy "own shares: stop" on public.shares for delete to authenticated using (owner = (select auth.uid()));
revoke all on public.shares from anon, authenticated;
grant select, delete on public.shares to authenticated;
grant insert (dance_id, name, dance) on public.shares to authenticated;
grant update (name, dance, updated_at) on public.shares to authenticated;

-- ---------------------------------------------------------------------------------- classes
create table public.classes (
  id uuid primary key default gen_random_uuid(),
  owner uuid not null default auth.uid() references auth.users (id) on delete cascade,
  code text not null unique default public.new_code(8),
  name text not null check (char_length(btrim(name)) between 1 and 60),
  description text not null default '' check (char_length(description) <= 500),
  hidden boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index classes_owner on public.classes (owner);
alter table public.classes enable row level security;
create policy "own classes: read" on public.classes for select to authenticated using (owner = (select auth.uid()));
create policy "own classes: create" on public.classes for insert to authenticated with check (owner = (select auth.uid()));
create policy "own classes: change" on public.classes for update to authenticated using (owner = (select auth.uid())) with check (owner = (select auth.uid()));
create policy "own classes: delete" on public.classes for delete to authenticated using (owner = (select auth.uid()));
revoke all on public.classes from anon, authenticated;
grant select, delete on public.classes to authenticated;
grant insert (name, description) on public.classes to authenticated;
grant update (name, description, updated_at) on public.classes to authenticated;

create table public.class_posts (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references public.classes (id) on delete cascade,
  name text not null check (char_length(name) <= 120),
  note text not null default '' check (char_length(note) <= 300),
  dance jsonb not null check (jsonb_typeof(dance) = 'object' and pg_column_size(dance) <= 262144),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index class_posts_class on public.class_posts (class_id, created_at);
alter table public.class_posts enable row level security;
create policy "posts of own classes: read" on public.class_posts for select to authenticated
  using (exists (select 1 from public.classes c where c.id = class_id and c.owner = (select auth.uid())));
create policy "posts of own classes: add" on public.class_posts for insert to authenticated
  with check (exists (select 1 from public.classes c where c.id = class_id and c.owner = (select auth.uid())));
create policy "posts of own classes: change" on public.class_posts for update to authenticated
  using (exists (select 1 from public.classes c where c.id = class_id and c.owner = (select auth.uid())))
  with check (exists (select 1 from public.classes c where c.id = class_id and c.owner = (select auth.uid())));
create policy "posts of own classes: remove" on public.class_posts for delete to authenticated
  using (exists (select 1 from public.classes c where c.id = class_id and c.owner = (select auth.uid())));
revoke all on public.class_posts from anon, authenticated;
grant select, delete on public.class_posts to authenticated;
grant insert (class_id, name, note, dance) on public.class_posts to authenticated;
grant update (name, note, dance, updated_at) on public.class_posts to authenticated;

-- Members with an account (guests keep their classes on the device). Joining goes through
-- join_class(), which needs the class code.
create table public.class_members (
  class_id uuid not null references public.classes (id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  joined_at timestamptz not null default now(),
  primary key (class_id, user_id)
);
create index class_members_user on public.class_members (user_id);
alter table public.class_members enable row level security;
create policy "own memberships: read" on public.class_members for select to authenticated using (user_id = (select auth.uid()));
create policy "own memberships: leave" on public.class_members for delete to authenticated using (user_id = (select auth.uid()));
revoke all on public.class_members from anon, authenticated;
grant select, delete on public.class_members to authenticated;

-- ---------------------------------------------------------------------------------- reports
-- Written through report_content(); read only by the project owner (dashboard).
create table public.reports (
  id bigint generated always as identity primary key,
  reporter uuid references auth.users (id) on delete set null,
  kind text not null check (kind in ('share', 'class', 'post', 'user')),
  ref text not null check (char_length(ref) <= 120),
  reason text not null check (reason in ('offensive', 'spam', 'copyright', 'other')),
  details text not null default '' check (char_length(details) <= 1000),
  created_at timestamptz not null default now()
);
alter table public.reports enable row level security;
revoke all on public.reports from anon, authenticated;

-- ----------------------------------------------------------------------------------- limits
create or replace function public.enforce_limits()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_table_name = 'shares' then
    if (select count(*) from public.shares where owner = new.owner) >= 300 then
      raise exception 'too many shared dances' using errcode = '53400';
    end if;
  elsif tg_table_name = 'classes' then
    if (select count(*) from public.classes where owner = new.owner) >= 30 then
      raise exception 'too many classes' using errcode = '53400';
    end if;
  elsif tg_table_name = 'class_posts' then
    if (select count(*) from public.class_posts where class_id = new.class_id) >= 60 then
      raise exception 'too many dances in this class' using errcode = '53400';
    end if;
  end if;
  return new;
end;
$$;
revoke all on function public.enforce_limits() from public, anon, authenticated;
create trigger shares_limit before insert on public.shares for each row execute function public.enforce_limits();
create trigger classes_limit before insert on public.classes for each row execute function public.enforce_limits();
create trigger class_posts_limit before insert on public.class_posts for each row execute function public.enforce_limits();

-- updated_at is the server's clock, whatever the client sends; a class is "updated" when its posts change
create or replace function public.touch_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;
revoke all on function public.touch_updated_at() from public, anon, authenticated;
create trigger profiles_touch before update on public.profiles for each row execute function public.touch_updated_at();
create trigger shares_touch before update on public.shares for each row execute function public.touch_updated_at();
create trigger classes_touch before update on public.classes for each row execute function public.touch_updated_at();
create trigger class_posts_touch before update on public.class_posts for each row execute function public.touch_updated_at();

create or replace function public.touch_class()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.classes set updated_at = now() where id = coalesce(new.class_id, old.class_id);
  return null;
end;
$$;
revoke all on function public.touch_class() from public, anon, authenticated;
create trigger class_posts_touch_class after insert or update or delete on public.class_posts for each row execute function public.touch_class();

-- ------------------------------------------------------------------- reading without account
-- A shared dance by its link id. null when the link does not exist (any more).
create or replace function public.get_share(p_id text)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'id', s.id,
    'name', s.name,
    'dance', s.dance,
    'author', jsonb_build_object('id', s.owner, 'name', coalesce(p.display_name, '')),
    'updated_at', s.updated_at,
    'mine', s.owner = (select auth.uid()))
  from public.shares s
  left join public.profiles p on p.id = s.owner
  where s.id = lower(btrim(p_id)) and not s.hidden;
$$;
revoke all on function public.get_share(text) from public;
grant execute on function public.get_share(text) to anon, authenticated;

-- A class and its dances by its code. null when there is no such class.
create or replace function public.get_class(p_code text)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'id', c.id,
    'code', c.code,
    'name', c.name,
    'description', c.description,
    'owner', jsonb_build_object('id', c.owner, 'name', coalesce(p.display_name, '')),
    'mine', c.owner = (select auth.uid()),
    'member', exists (select 1 from public.class_members m where m.class_id = c.id and m.user_id = (select auth.uid())),
    'updated_at', c.updated_at,
    'posts', coalesce((
      select jsonb_agg(jsonb_build_object('id', cp.id, 'name', cp.name, 'note', cp.note, 'dance', cp.dance, 'created_at', cp.created_at, 'updated_at', cp.updated_at) order by cp.created_at desc)
      from public.class_posts cp where cp.class_id = c.id), '[]'::jsonb))
  from public.classes c
  left join public.profiles p on p.id = c.owner
  where c.code = lower(btrim(p_code)) and not c.hidden;
$$;
revoke all on function public.get_class(text) from public;
grant execute on function public.get_class(text) to anon, authenticated;

-- Short entries for "My classes": the classes whose codes the device knows, plus (signed in)
-- the classes the user owns or joined. Newest activity first.
create or replace function public.class_summaries(p_codes text[] default '{}')
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(jsonb_agg(x.row order by x.updated_at desc), '[]'::jsonb)
  from (
    select c.updated_at, jsonb_build_object(
      'id', c.id,
      'code', c.code,
      'name', c.name,
      'description', c.description,
      'owner', jsonb_build_object('id', c.owner, 'name', coalesce(p.display_name, '')),
      'mine', c.owner = (select auth.uid()),
      'member', exists (select 1 from public.class_members m where m.class_id = c.id and m.user_id = (select auth.uid())),
      'updated_at', c.updated_at,
      'post_count', (select count(*) from public.class_posts cp where cp.class_id = c.id)) as row
    from public.classes c
    left join public.profiles p on p.id = c.owner
    where not c.hidden
      and (c.code = any (select lower(btrim(k)) from unnest(p_codes[1:100]) as k)
        or c.owner = (select auth.uid())
        or exists (select 1 from public.class_members m where m.class_id = c.id and m.user_id = (select auth.uid())))
  ) x;
$$;
revoke all on function public.class_summaries(text[]) from public;
grant execute on function public.class_summaries(text[]) to anon, authenticated;

-- Join a class with its code (signed in). Returns the class id, null when there is no such class.
create or replace function public.join_class(p_code text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := auth.uid();
  cid uuid;
begin
  if me is null then
    raise exception 'not signed in' using errcode = '28000';
  end if;
  select c.id into cid from public.classes c where c.code = lower(btrim(p_code)) and not c.hidden;
  if cid is null then
    return null;
  end if;
  if (select count(*) from public.class_members where user_id = me) >= 200 then
    raise exception 'too many classes' using errcode = '53400';
  end if;
  insert into public.class_members (class_id, user_id) values (cid, me) on conflict do nothing;
  return cid;
end;
$$;
revoke all on function public.join_class(text) from public, anon;
grant execute on function public.join_class(text) to authenticated;

-- Report a dance, a class or a person. Open to everyone who can see the content.
create or replace function public.report_content(p_kind text, p_ref text, p_reason text, p_details text default '')
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select count(*) from public.reports where created_at > now() - interval '1 hour') >= 300 then
    raise exception 'too many reports right now, try again later' using errcode = '53400';
  end if;
  if auth.uid() is not null
     and (select count(*) from public.reports where reporter = auth.uid() and created_at > now() - interval '1 day') >= 30 then
    raise exception 'too many reports right now, try again later' using errcode = '53400';
  end if;
  insert into public.reports (reporter, kind, ref, reason, details)
  values (auth.uid(), p_kind, left(p_ref, 120), p_reason, left(coalesce(p_details, ''), 1000));
end;
$$;
revoke all on function public.report_content(text, text, text, text) from public;
grant execute on function public.report_content(text, text, text, text) to anon, authenticated;

-- Delete the signed-in account and everything it owns (required by the App Store).
create or replace function public.delete_account()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := auth.uid();
begin
  if me is null then
    raise exception 'not signed in' using errcode = '28000';
  end if;
  delete from auth.users where id = me;
end;
$$;
revoke all on function public.delete_account() from public, anon;
grant execute on function public.delete_account() to authenticated;
