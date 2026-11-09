-- Movo · 0008 · API: projects, updates, feedback, saves, sharing, ranking, home

create or replace function private.validate_links(arr jsonb) returns jsonb
language plpgsql immutable as $$
declare out jsonb := '[]'; el jsonb;
begin
  if arr is null or jsonb_typeof(arr) <> 'array' then return '[]'; end if;
  for el in select * from jsonb_array_elements(arr) limit 5 loop
    if not private.is_http_url(el ->> 'url') then raise exception 'invalid_url'; end if;
    out := out || jsonb_build_array(jsonb_build_object(
      'label', coalesce(private.clean_text(el ->> 'label', 40), 'Enlace'), 'url', el ->> 'url'));
  end loop;
  return out;
end $$;

create or replace function private.project_json(pj public.projects, u uuid) returns jsonb
language sql stable security definer set search_path = public, private as $$
  select jsonb_build_object(
    'id', pj.id, 'title', pj.title, 'description', pj.description, 'category', pj.category, 'stage', pj.stage,
    'cover_url', pj.cover_url, 'links', pj.links, 'help_needed', pj.help_needed, 'feedback_kind', pj.feedback_kind,
    'created_at', pj.created_at, 'updated_at', pj.updated_at,
    'owner', private.profile_card_by_id(pj.owner_id),
    'is_owner', pj.owner_id = u,
    'saved', exists (select 1 from public.project_saves s where s.project_id = pj.id and s.user_id = u),
    'saves_count', (select count(*) from public.project_saves s where s.project_id = pj.id),
    'comments_count', (select count(*) from public.project_comments c where c.project_id = pj.id),
    'last_update', (select jsonb_build_object('id', up.id, 'body', up.body, 'created_at', up.created_at)
                      from public.project_updates up where up.project_id = pj.id order by up.created_at desc limit 1))
$$;

create or replace function private.apply_project_fields(pid uuid, p jsonb) returns void
language plpgsql security definer set search_path = public, private as $$
begin
  if p ? 'title' then
    if private.clean_text(p ->> 'title', 80) is null or char_length(private.clean_text(p ->> 'title', 80)) < 2 then raise exception 'invalid_title'; end if;
    update public.projects set title = private.clean_text(p ->> 'title', 80) where id = pid;
  end if;
  if p ? 'description' then update public.projects set description = private.clean_text(p ->> 'description', 2000) where id = pid; end if;
  if p ? 'category' then
    if p ->> 'category' is not null and p ->> 'category' not in ('app', 'web', 'youtube', 'faceless', 'edicion', 'diseno', 'musica', 'escritura', 'otro') then
      raise exception 'invalid_category'; end if;
    update public.projects set category = p ->> 'category' where id = pid;
  end if;
  if p ? 'stage' then
    if p ->> 'stage' not in ('idea', 'building', 'launched', 'paused') then raise exception 'invalid_stage'; end if;
    update public.projects set stage = p ->> 'stage' where id = pid;
  end if;
  if p ? 'cover_url' then
    update public.projects set cover_url = case
      when p ->> 'cover_url' ~ '^(gen:[a-z0-9-]{1,40}|storage:project-media/[A-Za-z0-9/._-]{1,160})$' then p ->> 'cover_url' end where id = pid;
  end if;
  if p ? 'links' then update public.projects set links = private.validate_links(p -> 'links') where id = pid; end if;
  if p ? 'help_needed' then update public.projects set help_needed = private.clean_text(p ->> 'help_needed', 280) where id = pid; end if;
  if p ? 'feedback_kind' then
    if p ->> 'feedback_kind' is not null and p ->> 'feedback_kind' not in ('test_app', 'rate_design', 'review_video', 'seek_collab') then
      raise exception 'invalid_feedback_kind'; end if;
    update public.projects set feedback_kind = p ->> 'feedback_kind' where id = pid;
  end if;
  update public.projects set updated_at = now() where id = pid;
end $$;

create or replace function public.create_project(p jsonb) returns jsonb
language plpgsql security definer set search_path = public, private as $$
declare u uuid := private.require_member(); pid uuid; pj public.projects;
begin
  if private.clean_text(p ->> 'title', 80) is null or char_length(private.clean_text(p ->> 'title', 80)) < 2 then raise exception 'invalid_title'; end if;
  perform private.rate_limit(u, 'create_project', 10, interval '1 day');
  if (select count(*) from public.projects where owner_id = u) >= 20 then raise exception 'too_many_projects'; end if;
  insert into public.projects (owner_id, title) values (u, private.clean_text(p ->> 'title', 80)) returning id into pid;
  perform private.apply_project_fields(pid, p - 'title');
  select * into pj from public.projects where id = pid;
  return private.project_json(pj, u);
end $$;

create or replace function public.update_project(p jsonb) returns jsonb
language plpgsql security definer set search_path = public, private as $$
declare u uuid := private.require_member(); pj public.projects;
begin
  select * into pj from public.projects where id = (p ->> 'project_id')::uuid for update;
  if not found or pj.owner_id <> u then raise exception 'forbidden'; end if;
  perform private.apply_project_fields(pj.id, p - 'project_id');
  select * into pj from public.projects where id = pj.id;
  return private.project_json(pj, u);
end $$;

create or replace function public.delete_project(p jsonb) returns jsonb
language plpgsql security definer set search_path = public, private as $$
declare u uuid := private.require_member(); pj public.projects;
begin
  select * into pj from public.projects where id = (p ->> 'project_id')::uuid;
  if not found or pj.owner_id <> u then raise exception 'forbidden'; end if;
  delete from public.points_ledger where reason = 'project_update'
     and source_id in (select id from public.project_updates where project_id = pj.id);
  delete from public.points_ledger where reason = 'useful_feedback'
     and source_id in (select id from public.project_comments where project_id = pj.id);
  delete from public.projects where id = pj.id;
  return jsonb_build_object('deleted', true);
end $$;

create or replace function public.get_project(p jsonb) returns jsonb
language plpgsql stable security definer set search_path = public, private as $$
declare u uuid := private.require_user(); pj public.projects;
begin
  select * into pj from public.projects where id = (p ->> 'project_id')::uuid;
  if not found or not private.can_see(u, pj.owner_id) then raise exception 'not_found'; end if;
  return private.project_json(pj, u) || jsonb_build_object(
    'updates', coalesce((select jsonb_agg(jsonb_build_object('id', up.id, 'body', up.body, 'created_at', up.created_at)
        order by up.created_at desc) from public.project_updates up where up.project_id = pj.id), '[]'),
    'comments', coalesce((select jsonb_agg(jsonb_build_object('id', c.id, 'body', c.body, 'created_at', c.created_at,
        'edited_at', c.edited_at, 'useful', c.useful_at is not null, 'author', private.profile_card_by_id(c.author_id),
        'is_mine', c.author_id = u) order by c.created_at)
      from public.project_comments c where c.project_id = pj.id and private.can_see(u, c.author_id)), '[]'),
    'shared_in', coalesce((select jsonb_agg(jsonb_build_object('id', g.id, 'slug', g.slug, 'name', g.name))
      from public.group_project_shares s join public.groups g on g.id = s.group_id
      where s.project_id = pj.id and private.can_view_group(g.id, u)), '[]'));
end $$;

create or replace function public.list_projects(p jsonb default '{}') returns jsonb
language plpgsql stable security definer set search_path = public, private as $$
declare u uuid := private.require_user(); scope text := coalesce(p ->> 'scope', 'all'); q text := lower(coalesce(p ->> 'q', ''));
begin
  return coalesce((select jsonb_agg(private.project_json(pj, u) order by pj.updated_at desc) from (
    select pj.* from public.projects pj
     where private.can_see(u, pj.owner_id)
       and (scope <> 'mine' or pj.owner_id = u)
       and (scope <> 'saved' or exists (select 1 from public.project_saves s where s.project_id = pj.id and s.user_id = u))
       and (scope <> 'feedback' or pj.feedback_kind is not null)
       and (q = '' or lower(pj.title) like '%' || q || '%' or lower(coalesce(pj.description, '')) like '%' || q || '%')
     order by pj.updated_at desc limit 50) pj), '[]');
end $$;

-- Updates: owner only. Points awarded only for substantive updates, within caps.
create or replace function public.add_project_update(p jsonb) returns jsonb
language plpgsql security definer set search_path = public, private as $$
declare u uuid := private.require_member(); pj public.projects; body text := private.clean_text(p ->> 'body', 1000);
  uid uuid; r jsonb := private.cfg('ranking'); awarded boolean := false;
begin
  select * into pj from public.projects where id = (p ->> 'project_id')::uuid;
  if not found or pj.owner_id <> u then raise exception 'forbidden'; end if;
  if body is null then raise exception 'empty_update'; end if;
  perform private.rate_limit(u, 'project_update', 10, interval '1 day');
  insert into public.project_updates (project_id, author_id, body) values (pj.id, u, body) returning id into uid;
  update public.projects set updated_at = now() where id = pj.id;
  if char_length(body) >= (r ->> 'project_update_min_chars')::int
     and (select count(*) from public.points_ledger l join public.project_updates up on up.id = l.source_id
           where l.reason = 'project_update' and up.project_id = pj.id
             and l.created_at >= (private.local_today()::timestamp at time zone private.tz())) < (r ->> 'project_update_per_project_daily')::int
     and (select count(*) from public.points_ledger l where l.user_id = u and l.reason = 'project_update'
             and l.created_at >= (private.local_today()::timestamp at time zone private.tz())) < (r ->> 'project_update_daily_cap')::int then
    insert into public.points_ledger (user_id, points, reason, source_id) values (u, (r ->> 'project_update_points')::int, 'project_update', uid);
    awarded := true;
  end if;
  return jsonb_build_object('id', uid, 'points_awarded', awarded);
end $$;

create or replace function public.delete_project_update(p jsonb) returns jsonb
language plpgsql security definer set search_path = public, private as $$
declare u uuid := private.require_member(); up public.project_updates;
begin
  select * into up from public.project_updates where id = (p ->> 'update_id')::uuid;
  if not found or up.author_id <> u then raise exception 'forbidden'; end if;
  delete from public.points_ledger where reason = 'project_update' and source_id = up.id;
  delete from public.project_updates where id = up.id;
  return jsonb_build_object('deleted', true);
end $$;

create or replace function public.add_comment(p jsonb) returns jsonb
language plpgsql security definer set search_path = public, private as $$
declare u uuid := private.require_member(); pid uuid := (p ->> 'project_id')::uuid; body text := private.clean_text(p ->> 'body', 1000); cid uuid;
begin
  if not private.can_view_project(pid, u) then raise exception 'not_found'; end if;
  if body is null then raise exception 'empty_comment'; end if;
  perform private.rate_limit(u, 'comment', private.cfg_int('comments_per_hour'), interval '1 hour');
  insert into public.project_comments (project_id, author_id, body) values (pid, u, body) returning id into cid;
  return jsonb_build_object('id', cid);
end $$;

create or replace function public.edit_comment(p jsonb) returns jsonb
language plpgsql security definer set search_path = public, private as $$
declare u uuid := private.require_member(); c public.project_comments; body text := private.clean_text(p ->> 'body', 1000);
begin
  select * into c from public.project_comments where id = (p ->> 'comment_id')::uuid;
  if not found or c.author_id <> u then raise exception 'forbidden'; end if;
  if body is null then raise exception 'empty_comment'; end if;
  update public.project_comments set body = body, edited_at = now() where id = c.id;
  return jsonb_build_object('id', c.id);
end $$;

-- Authors delete their comments; project owners can remove comments on their project.
create or replace function public.delete_comment(p jsonb) returns jsonb
language plpgsql security definer set search_path = public, private as $$
declare u uuid := private.require_member(); c public.project_comments;
begin
  select * into c from public.project_comments where id = (p ->> 'comment_id')::uuid;
  if not found or not (c.author_id = u or exists (select 1 from public.projects pj where pj.id = c.project_id and pj.owner_id = u)) then
    raise exception 'forbidden';
  end if;
  delete from public.points_ledger where reason = 'useful_feedback' and source_id = c.id;
  delete from public.project_comments where id = c.id;
  return jsonb_build_object('deleted', true);
end $$;

-- Only the project owner can mark feedback on their project as useful, never their own comment.
-- Points go to the comment author, subject to a daily cap per author and a weekly cap per pair.
create or replace function public.mark_useful(p jsonb) returns jsonb
language plpgsql security definer set search_path = public, private as $$
declare u uuid := private.require_member(); c public.project_comments; pj public.projects; r jsonb := private.cfg('ranking');
  want boolean := coalesce((p ->> 'useful')::boolean, true); awarded boolean := false;
begin
  select * into c from public.project_comments where id = (p ->> 'comment_id')::uuid for update;
  if not found then raise exception 'not_found'; end if;
  select * into pj from public.projects where id = c.project_id;
  if pj.owner_id <> u then raise exception 'forbidden'; end if;
  if c.author_id = u then raise exception 'cannot_mark_own'; end if;
  if want then
    if c.useful_at is null then
      update public.project_comments set useful_at = now(), useful_by = u where id = c.id;
      perform pg_advisory_xact_lock(hashtext('points:' || c.author_id::text));
      if (select count(*) from public.points_ledger where user_id = c.author_id and reason = 'useful_feedback'
            and created_at >= (private.local_today()::timestamp at time zone private.tz())) < (r ->> 'useful_feedback_daily_cap')::int
         and (select count(*) from public.points_ledger where user_id = c.author_id and awarded_by = u and reason = 'useful_feedback'
            and created_at >= private.week_start()) < (r ->> 'useful_pair_weekly_cap')::int then
        insert into public.points_ledger (user_id, points, reason, source_id, awarded_by)
        values (c.author_id, (r ->> 'useful_feedback_points')::int, 'useful_feedback', c.id, u)
        on conflict do nothing;
        awarded := true;
      end if;
    end if;
  else
    update public.project_comments set useful_at = null, useful_by = null where id = c.id;
    delete from public.points_ledger where reason = 'useful_feedback' and source_id = c.id;
  end if;
  return jsonb_build_object('useful', want, 'points_awarded', awarded);
end $$;

create or replace function public.toggle_save_project(p jsonb) returns jsonb
language plpgsql security definer set search_path = public, private as $$
declare u uuid := private.require_member(); pid uuid := (p ->> 'project_id')::uuid;
begin
  if not private.can_view_project(pid, u) then raise exception 'not_found'; end if;
  if exists (select 1 from public.project_saves where user_id = u and project_id = pid) then
    delete from public.project_saves where user_id = u and project_id = pid;
    return jsonb_build_object('saved', false);
  end if;
  insert into public.project_saves (user_id, project_id) values (u, pid);
  return jsonb_build_object('saved', true);
end $$;

-- Share an existing project into a group (no copy). Owner only, must be a member.
create or replace function public.share_project_to_group(p jsonb) returns jsonb
language plpgsql security definer set search_path = public, private as $$
declare u uuid := private.require_member(); pid uuid := (p ->> 'project_id')::uuid; g uuid := (p ->> 'group_id')::uuid;
begin
  if not exists (select 1 from public.projects where id = pid and owner_id = u) then raise exception 'forbidden'; end if;
  if not private.is_group_member(g, u) then raise exception 'forbidden'; end if;
  insert into public.group_project_shares (group_id, project_id, shared_by, note)
  values (g, pid, u, private.clean_text(p ->> 'note', 200)) on conflict do nothing;
  return jsonb_build_object('shared', true);
end $$;

create or replace function public.unshare_project(p jsonb) returns jsonb
language plpgsql security definer set search_path = public, private as $$
declare u uuid := private.require_member(); pid uuid := (p ->> 'project_id')::uuid; g uuid := (p ->> 'group_id')::uuid;
begin
  if not (exists (select 1 from public.projects where id = pid and owner_id = u) or private.is_group_mod(g, u)) then
    raise exception 'forbidden';
  end if;
  delete from public.group_project_shares where group_id = g and project_id = pid;
  return jsonb_build_object('shared', false);
end $$;

create or replace function public.list_group_projects(p jsonb) returns jsonb
language plpgsql stable security definer set search_path = public, private as $$
declare u uuid := private.require_user(); g uuid := (p ->> 'group_id')::uuid;
begin
  if not private.can_view_group(g, u) then raise exception 'not_found'; end if;
  return coalesce((select jsonb_agg(private.project_json(pj, u) || jsonb_build_object(
      'shared_by', private.profile_card_by_id(s.shared_by), 'note', s.note, 'shared_at', s.created_at) order by s.created_at desc)
    from public.group_project_shares s join public.projects pj on pj.id = s.project_id
    where s.group_id = g and private.can_see(u, pj.owner_id)), '[]');
end $$;

-- ---------------------------------------------------------------------------
-- Ranking
-- ---------------------------------------------------------------------------
create or replace function public.ranking(p jsonb default '{}') returns jsonb
language plpgsql stable security definer set search_path = public, private as $$
declare u uuid := private.require_user(); period text := coalesce(p ->> 'period', 'week');
  since timestamptz := case when period = 'week' then private.week_start() else '-infinity'::timestamptz end;
  lim int := least(coalesce((p ->> 'limit')::int, 20), 50);
begin
  return jsonb_build_object(
    'period', period,
    'since', case when period = 'week' then since end,
    'timezone', private.tz(),
    'rules', private.cfg('ranking'),
    'entries', coalesce((select jsonb_agg(jsonb_build_object('rank', rnk, 'points', pts, 'useful', useful, 'updates', updates,
        'user', private.profile_card_by_id(user_id)) order by rnk) from (
      select user_id, sum(points) pts,
             count(*) filter (where reason = 'useful_feedback') useful,
             count(*) filter (where reason = 'project_update') updates,
             rank() over (order by sum(points) desc) rnk
        from public.points_ledger l
       where created_at >= since and private.can_see(u, user_id)
         and exists (select 1 from public.profiles pr where pr.id = l.user_id and pr.onboarding_completed_at is not null)
       group by user_id order by pts desc, user_id limit lim) x), '[]'),
    'me', (select jsonb_build_object('points', coalesce(sum(points), 0),
             'useful', count(*) filter (where reason = 'useful_feedback'),
             'updates', count(*) filter (where reason = 'project_update'))
             from public.points_ledger where user_id = u and created_at >= since));
end $$;

-- ---------------------------------------------------------------------------
-- Home
-- ---------------------------------------------------------------------------
-- Real profiles for the animated creator table. Never padded with invented people.
create or replace function public.creator_table(p jsonb default '{}') returns jsonb
language plpgsql stable security definer set search_path = public, private as $$
declare u uuid := private.require_user(); lim int := least(coalesce((p ->> 'limit')::int, 24), 40);
begin
  return coalesce((select jsonb_agg(card) from (
    select private.profile_card(pr) || jsonb_build_object(
             'project_title', (select title from public.projects pj where pj.owner_id = pr.id order by updated_at desc limit 1)) card
      from public.profiles pr
     where pr.id <> u and pr.onboarding_completed_at is not null and pr.discoverable and private.can_see(u, pr.id)
     order by md5(pr.id::text || to_char(now(), 'YYYYMMDDHH24')) limit lim) s), '[]');
end $$;

create or replace function public.home_feed(p jsonb default '{}') returns jsonb
language plpgsql stable security definer set search_path = public, private as $$
declare u uuid := private.require_user();
begin
  return jsonb_build_object(
    'groups', coalesce((select jsonb_agg(private.group_json(g, u) order by g.is_official desc, last_at desc nulls last) from (
        select g.*, c.last_message_at last_at from public.groups g
          join public.group_members gm on gm.group_id = g.id and gm.user_id = u
          left join public.conversations c on c.kind = 'group' and c.group_id = g.id
         where g.archived_at is null limit 8) g), '[]'),
    -- Updates from my connections, projects shared in my groups, projects I saved, and my own.
    'updates', coalesce((select jsonb_agg(row order by (row ->> 'created_at')::timestamptz desc) from (
        select jsonb_build_object('id', up.id, 'body', up.body, 'created_at', up.created_at,
                 'project', jsonb_build_object('id', pj.id, 'title', pj.title, 'stage', pj.stage, 'cover_url', pj.cover_url),
                 'author', private.profile_card_by_id(pj.owner_id)) row
          from public.project_updates up join public.projects pj on pj.id = up.project_id
         where private.can_see(u, pj.owner_id) and up.created_at > now() - interval '30 days' and (
               pj.owner_id = u
            or private.are_connected(u, pj.owner_id)
            or exists (select 1 from public.project_saves s where s.project_id = pj.id and s.user_id = u)
            or exists (select 1 from public.group_project_shares sh where sh.project_id = pj.id and private.is_group_member(sh.group_id, u)))
         order by up.created_at desc limit 6) s), '[]'),
    'sessions', public.list_sessions('{}'),
    'ranking', (select jsonb_build_object('top', coalesce(jsonb_agg(e) filter (where (e ->> 'rank')::int <= 3), '[]'), 'me', r -> 'me')
                  from (select public.ranking('{"period":"week","limit":3}') r) rr
                  left join lateral jsonb_array_elements(rr.r -> 'entries') e on true group by r),
    'requests_count', (select count(*) from public.connection_requests where to_id = u and status = 'pending'),
    'invitations_count', (select count(*) from public.group_invitations where invitee_id = u and status = 'pending'),
    'unread_count', (select count(*) from public.messages m join public.conversation_members cm on cm.conversation_id = m.conversation_id
                      where cm.user_id = u and not cm.muted and m.created_at > cm.last_read_at
                        and m.sender_id is distinct from u and m.deleted_at is null));
end $$;

-- ---------------------------------------------------------------------------
-- Final grants: only authenticated users may call API functions.
-- ---------------------------------------------------------------------------
revoke execute on all functions in schema public from public, anon;
grant execute on all functions in schema public to authenticated;
-- Private helpers run inside SECURITY DEFINER functions as the owner. The only ones the
-- `authenticated` role needs directly are those referenced by RLS policies.
revoke execute on all functions in schema private from public, anon, authenticated;
grant execute on function
  private.can_see(uuid, uuid),
  private.is_conversation_member(uuid, uuid),
  private.can_view_group(uuid, uuid),
  private.is_group_member(uuid, uuid),
  private.is_group_mod(uuid, uuid),
  private.can_view_project(uuid, uuid)
to authenticated;
