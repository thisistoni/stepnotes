-- "mine" is false (not null) for people without an account.
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
    'mine', coalesce(s.owner = (select auth.uid()), false))
  from public.shares s
  left join public.profiles p on p.id = s.owner
  where s.id = lower(btrim(p_id)) and not s.hidden;
$$;

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
    'mine', coalesce(c.owner = (select auth.uid()), false),
    'member', exists (select 1 from public.class_members m where m.class_id = c.id and m.user_id = (select auth.uid())),
    'updated_at', c.updated_at,
    'posts', coalesce((
      select jsonb_agg(jsonb_build_object('id', cp.id, 'name', cp.name, 'note', cp.note, 'dance', cp.dance, 'created_at', cp.created_at, 'updated_at', cp.updated_at) order by cp.created_at desc)
      from public.class_posts cp where cp.class_id = c.id), '[]'::jsonb))
  from public.classes c
  left join public.profiles p on p.id = c.owner
  where c.code = lower(btrim(p_code)) and not c.hidden;
$$;

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
      'mine', coalesce(c.owner = (select auth.uid()), false),
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
