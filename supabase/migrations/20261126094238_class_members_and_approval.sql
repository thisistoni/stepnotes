-- Classes: the teacher sees who joined, and can ask to approve people before they get in.
--
-- - classes.approval: new people ask to join; they see the dances once the teacher accepted them.
-- - class_members.status: 'member' or 'pending' (asked, not accepted yet).
-- - Joining needs an account (join_class_v2), so the teacher's list is complete. People without
--   an account can still open a class without approval through its link.
-- - Builds that still call join_class() keep working: it now goes through join_class_v2().

alter table public.classes add column approval boolean not null default false;
grant insert (approval) on public.classes to authenticated;
grant update (approval) on public.classes to authenticated;

alter table public.class_members add column status text not null default 'member' check (status in ('member', 'pending'));

-- Approval switched off: everyone who was waiting is in.
create or replace function public.admit_pending_members()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.approval and not new.approval then
    update public.class_members set status = 'member', joined_at = now() where class_id = new.id and status = 'pending';
  end if;
  return null;
end;
$$;
revoke all on function public.admit_pending_members() from public, anon, authenticated;
create trigger classes_admit_pending after update of approval on public.classes for each row execute function public.admit_pending_members();

-- A class and its dances by its code. null when there is no such class. A class with approval
-- shows its dances only to the teacher and to accepted members ("locked" for everyone else).
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
    'mine', a.mine,
    'member', coalesce(a.status = 'member', false),
    'membership', coalesce(a.status, 'none'),
    'approval', c.approval,
    'locked', a.locked,
    'member_count', case when a.mine then (select count(*) from public.class_members m where m.class_id = c.id and m.status = 'member' and m.user_id <> c.owner) else 0 end,
    'request_count', case when a.mine then (select count(*) from public.class_members m where m.class_id = c.id and m.status = 'pending' and m.user_id <> c.owner) else 0 end,
    'updated_at', c.updated_at,
    'posts', case when a.locked then '[]'::jsonb else coalesce((
      select jsonb_agg(jsonb_build_object('id', cp.id, 'name', cp.name, 'note', cp.note, 'dance', cp.dance, 'created_at', cp.created_at, 'updated_at', cp.updated_at) order by cp.created_at desc)
      from public.class_posts cp where cp.class_id = c.id), '[]'::jsonb) end)
  from public.classes c
  left join public.profiles p on p.id = c.owner
  cross join lateral (
    select me.mine, me.status, (c.approval and not me.mine and me.status is distinct from 'member') as locked
    from (
      select coalesce(c.owner = (select auth.uid()), false) as mine,
             (select m.status from public.class_members m where m.class_id = c.id and m.user_id = (select auth.uid())) as status
    ) me
  ) a
  where c.code = lower(btrim(p_code)) and not c.hidden;
$$;

-- Short entries for "My classes": the classes whose codes the device knows, plus (signed in)
-- the classes the user owns, joined or asked to join. Newest activity first.
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
      'mine', a.mine,
      'member', coalesce(a.status = 'member', false),
      'membership', coalesce(a.status, 'none'),
      'approval', c.approval,
      'member_count', case when a.mine then (select count(*) from public.class_members m where m.class_id = c.id and m.status = 'member' and m.user_id <> c.owner) else 0 end,
      'request_count', case when a.mine then (select count(*) from public.class_members m where m.class_id = c.id and m.status = 'pending' and m.user_id <> c.owner) else 0 end,
      'updated_at', c.updated_at,
      'post_count', (select count(*) from public.class_posts cp where cp.class_id = c.id)) as row
    from public.classes c
    left join public.profiles p on p.id = c.owner
    cross join lateral (
      select coalesce(c.owner = (select auth.uid()), false) as mine,
             (select m.status from public.class_members m where m.class_id = c.id and m.user_id = (select auth.uid())) as status
    ) a
    where not c.hidden
      and (c.code = any (select lower(btrim(k)) from unnest(p_codes[1:100]) as k) or a.mine or a.status is not null)
  ) x;
$$;

-- Join a class with its code (signed in). Returns 'member', 'pending' (the teacher has to accept
-- first) or null when there is no such class.
create or replace function public.join_class_v2(p_code text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := auth.uid();
  cid uuid;
  teacher uuid;
  needs_approval boolean;
  st text;
begin
  if me is null then
    raise exception 'not signed in' using errcode = '28000';
  end if;
  select c.id, c.owner, c.approval into cid, teacher, needs_approval from public.classes c where c.code = lower(btrim(p_code)) and not c.hidden;
  if cid is null then
    return null;
  end if;
  if teacher = me then
    return 'member';
  end if;
  select m.status into st from public.class_members m where m.class_id = cid and m.user_id = me;
  if st is not null then
    return st;
  end if;
  if (select count(*) from public.class_members where user_id = me) >= 200 then
    raise exception 'too many classes' using errcode = '53400';
  end if;
  if (select count(*) from public.class_members where class_id = cid) >= 500 then
    raise exception 'this class is full' using errcode = '53400';
  end if;
  st := case when needs_approval then 'pending' else 'member' end;
  insert into public.class_members (class_id, user_id, status) values (cid, me, st) on conflict do nothing;
  return st;
end;
$$;
revoke all on function public.join_class_v2(text) from public, anon;
grant execute on function public.join_class_v2(text) to authenticated;

-- Older builds: the class id, null when there is no such class.
create or replace function public.join_class(p_code text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  cid uuid;
begin
  if public.join_class_v2(p_code) is null then
    return null;
  end if;
  select c.id into cid from public.classes c where c.code = lower(btrim(p_code)) and not c.hidden;
  return cid;
end;
$$;

-- The teacher's list: who asked to join (first) and who is in, with display names.
create or replace function public.class_member_list(p_class uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  me uuid := auth.uid();
begin
  if me is null then
    raise exception 'not signed in' using errcode = '28000';
  end if;
  if not exists (select 1 from public.classes c where c.id = p_class and c.owner = me) then
    raise exception 'no such class of yours' using errcode = 'P0002';
  end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object('id', m.user_id, 'name', coalesce(p.display_name, ''), 'status', m.status, 'joined_at', m.joined_at)
                     order by (m.status = 'pending') desc, m.joined_at desc)
    from public.class_members m
    left join public.profiles p on p.id = m.user_id
    where m.class_id = p_class and m.user_id <> me), '[]'::jsonb);
end;
$$;
revoke all on function public.class_member_list(uuid) from public, anon;
grant execute on function public.class_member_list(uuid) to authenticated;

-- The teacher accepts a request ('approve') or takes someone out / declines a request ('remove').
create or replace function public.class_member_set(p_class uuid, p_user uuid, p_action text)
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
  if not exists (select 1 from public.classes c where c.id = p_class and c.owner = me) then
    raise exception 'no such class of yours' using errcode = 'P0002';
  end if;
  if p_action = 'approve' then
    update public.class_members set status = 'member', joined_at = now() where class_id = p_class and user_id = p_user and status = 'pending';
  elsif p_action = 'remove' then
    delete from public.class_members where class_id = p_class and user_id = p_user;
  else
    raise exception 'unknown action' using errcode = '22023';
  end if;
end;
$$;
revoke all on function public.class_member_set(uuid, uuid, text) from public, anon;
grant execute on function public.class_member_set(uuid, uuid, text) to authenticated;
