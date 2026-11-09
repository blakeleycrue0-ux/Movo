-- Movo · 0005 · API: onboarding, profiles, settings, search, blocks, reports
-- Every function: single jsonb argument, jsonb result, explicit authorisation.

-- ---------------------------------------------------------------------------
-- Shared validation
-- ---------------------------------------------------------------------------
create or replace function private.validate_avatar(u uuid, v text) returns text
language plpgsql immutable as $$
begin
  if v is null or v = '' then return null; end if;
  if v ~ '^gen:[a-z0-9-]{1,40}$' then return v; end if;
  if v ~ ('^storage:avatars/' || u::text || '/[A-Za-z0-9._-]{1,80}$') then return v; end if;
  raise exception 'invalid_avatar';
end $$;

create or replace function private.check_birth_date(d date) returns void
language plpgsql stable security definer set search_path = public, private as $$
declare min_age int := (private.cfg('eligibility') ->> 'min_age')::int;
begin
  if d is null then raise exception 'birth_date_required'; end if;
  if d > private.local_today() or d < private.local_today() - interval '120 years' then
    raise exception 'birth_date_invalid';
  end if;
  if min_age is not null and private.age_on(d, private.local_today()) < min_age then
    raise exception 'ineligible_age';
  end if;
end $$;

-- Applies a validated subset of profile fields. Keys that are absent are left unchanged.
create or replace function private.apply_profile_patch(u uuid, d jsonb) returns void
language plpgsql security definer set search_path = public, private as $$
declare uname text; v text;
begin
  if d ? 'display_name' then
    v := private.clean_text(d ->> 'display_name', 40);
    if v is null then raise exception 'display_name_required'; end if;
    update public.profiles set display_name = v where id = u;
  end if;
  if d ? 'username' then
    uname := lower(btrim(coalesce(d ->> 'username', ''), ' @'));
    if uname !~ '^[a-z0-9_]{3,20}$' then raise exception 'username_invalid'; end if;
    if uname in ('admin', 'movo', 'soporte', 'support', 'root', 'ayuda', 'help', 'moderador', 'official', 'oficial', 'null', 'me', 'yo') then
      raise exception 'username_taken';
    end if;
    if exists (select 1 from public.profiles where username = uname and id <> u) then
      raise exception 'username_taken';
    end if;
    update public.profiles set username = uname where id = u;
  end if;
  if d ? 'avatar_url' then
    update public.profiles set avatar_url = private.validate_avatar(u, d ->> 'avatar_url') where id = u;
  end if;
  if d ? 'headline' then
    update public.profiles set headline = private.clean_text(d ->> 'headline', 40) where id = u;
  end if;
  if d ? 'bio' then
    update public.profiles set bio = private.clean_text(d ->> 'bio', 280) where id = u;
  end if;
  if d ? 'interests' then
    update public.profiles set interests = private.clean_tags(d -> 'interests', 12) where id = u;
  end if;
  if d ? 'skills' then
    update public.profiles set skills = private.clean_tags(d -> 'skills', 12) where id = u;
  end if;
  if d ? 'stage' then
    if d ->> 'stage' not in ('exploring', 'starting', 'building') then raise exception 'invalid_stage'; end if;
    update public.profiles set stage = d ->> 'stage' where id = u;
  end if;
  if d ? 'seeking' then
    update public.profiles set seeking = (
      select coalesce(array_agg(distinct x), '{}') from jsonb_array_elements_text(d -> 'seeking') x
       where x in ('people', 'learning', 'feedback', 'collaboration')) where id = u;
  end if;
  if d ? 'birth_date' then
    perform private.check_birth_date((d ->> 'birth_date')::date);
    update public.profile_private set birth_date = (d ->> 'birth_date')::date where user_id = u;
  end if;
  update public.profiles set updated_at = now() where id = u;
exception
  when invalid_datetime_format or datetime_field_overflow then raise exception 'birth_date_invalid';
end $$;

create or replace function private.default_headline(stage text) returns text
language sql immutable as $$
  select case stage when 'building' then 'Trabajando en un proyecto'
                    when 'starting' then 'Empezando algo nuevo'
                    else 'Explorando ideas' end
$$;

-- ---------------------------------------------------------------------------
-- Onboarding
-- ---------------------------------------------------------------------------
create or replace function public.onboarding_state(p jsonb default '{}') returns jsonb
language plpgsql stable security definer set search_path = public, private as $$
declare u uuid := private.require_user(); pr public.profiles; pv public.profile_private;
begin
  select * into pr from public.profiles where id = u;
  select * into pv from public.profile_private where user_id = u;
  return jsonb_build_object(
    'profile', private.profile_card(pr),
    'birth_date', pv.birth_date,
    'draft', pv.onboarding_draft,
    'step', pr.onboarding_step,
    'completed', pr.onboarding_completed_at is not null,
    'eligibility', jsonb_build_object(
      'status', private.cfg('eligibility') ->> 'status',
      'min_age', private.cfg('eligibility') -> 'min_age',
      'registration_open', coalesce((private.cfg('eligibility') ->> 'registration_open')::boolean, true)));
end $$;

create or replace function public.onboarding_save(p jsonb) returns jsonb
language plpgsql security definer set search_path = public, private as $$
declare u uuid := private.require_user(); d jsonb := coalesce(p -> 'data', '{}'); step int := coalesce((p ->> 'step')::int, 0);
begin
  perform private.apply_profile_patch(u, d - 'project');
  if d ? 'project' then
    update public.profile_private
       set onboarding_draft = onboarding_draft || jsonb_build_object('project', jsonb_build_object(
         'title', private.clean_text(d #>> '{project,title}', 80),
         'description', private.clean_text(d #>> '{project,description}', 2000),
         'url', private.clean_text(d #>> '{project,url}', 500)))
     where user_id = u;
    if private.clean_text(d #>> '{project,url}', 500) is not null and not private.is_http_url(d #>> '{project,url}') then
      raise exception 'invalid_url';
    end if;
  end if;
  update public.profiles set onboarding_step = greatest(onboarding_step, least(step, 20)) where id = u;
  return public.onboarding_state('{}');
end $$;

create or replace function public.onboarding_complete(p jsonb default '{}') returns jsonb
language plpgsql security definer set search_path = public, private as $$
declare u uuid := private.require_user(); pr public.profiles; pv public.profile_private; proj jsonb; pid uuid;
begin
  select * into pr from public.profiles where id = u for update;
  if pr.onboarding_completed_at is not null then return jsonb_build_object('completed', true, 'already', true); end if;
  if not coalesce((private.cfg('eligibility') ->> 'registration_open')::boolean, true) then
    raise exception 'registration_closed';
  end if;
  select * into pv from public.profile_private where user_id = u;
  if pr.display_name is null then raise exception 'display_name_required'; end if;
  if pr.username is null then raise exception 'username_invalid'; end if;
  perform private.check_birth_date(pv.birth_date);
  if cardinality(pr.interests) = 0 then raise exception 'interests_required'; end if;
  if pr.stage is null then raise exception 'invalid_stage'; end if;
  if cardinality(pr.seeking) = 0 then raise exception 'seeking_required'; end if;

  proj := pv.onboarding_draft -> 'project';
  if proj is not null and proj ->> 'title' is not null and char_length(proj ->> 'title') >= 2 then
    insert into public.projects (owner_id, title, description, stage, links)
    values (u, proj ->> 'title', proj ->> 'description',
            case pr.stage when 'building' then 'building' else 'idea' end,
            case when proj ->> 'url' is not null and private.is_http_url(proj ->> 'url')
                 then jsonb_build_array(jsonb_build_object('label', 'Web', 'url', proj ->> 'url')) else '[]' end)
    returning id into pid;
  end if;

  update public.profiles
     set onboarding_completed_at = now(),
         headline = coalesce(headline, private.default_headline(stage)),
         updated_at = now()
   where id = u;
  update public.profile_private set onboarding_draft = '{}' where user_id = u;
  if private.official_group() is not null then
    perform private.add_group_member(private.official_group(), u, 'member');
  end if;
  return jsonb_build_object('completed', true, 'project_id', pid);
end $$;

create or replace function public.username_available(p jsonb) returns jsonb
language plpgsql stable security definer set search_path = public, private as $$
declare u uuid := private.require_user(); uname text := lower(btrim(coalesce(p ->> 'username', ''), ' @'));
begin
  if uname !~ '^[a-z0-9_]{3,20}$' then return jsonb_build_object('available', false, 'reason', 'username_invalid'); end if;
  if uname in ('admin', 'movo', 'soporte', 'support', 'root', 'ayuda', 'help', 'moderador', 'official', 'oficial', 'null', 'me', 'yo')
     or exists (select 1 from public.profiles where username = uname and id <> u) then
    return jsonb_build_object('available', false, 'reason', 'username_taken');
  end if;
  return jsonb_build_object('available', true);
end $$;

-- ---------------------------------------------------------------------------
-- Profiles
-- ---------------------------------------------------------------------------
create or replace function public.me(p jsonb default '{}') returns jsonb
language plpgsql stable security definer set search_path = public, private as $$
declare u uuid := private.require_user(); pr public.profiles;
begin
  select * into pr from public.profiles where id = u;
  return private.profile_card(pr) || jsonb_build_object(
    'onboarding_completed', pr.onboarding_completed_at is not null,
    'onboarding_step', pr.onboarding_step,
    'discoverable', pr.discoverable);
end $$;

create or replace function public.update_profile(p jsonb) returns jsonb
language plpgsql security definer set search_path = public, private as $$
declare u uuid := private.require_member();
begin
  perform private.apply_profile_patch(u, p - 'birth_date');
  return public.me('{}');
end $$;

create or replace function public.get_profile(p jsonb) returns jsonb
language plpgsql stable security definer set search_path = public, private as $$
declare
  u uuid := private.require_user();
  pr public.profiles;
  req public.connection_requests;
  v_status text := 'none';
  week_pts int; all_pts int;
begin
  if p ? 'id' then
    select * into pr from public.profiles where id = (p ->> 'id')::uuid;
  else
    select * into pr from public.profiles where username = lower(btrim(p ->> 'username', ' @'));
  end if;
  if not found or (pr.id <> u and (pr.onboarding_completed_at is null or not private.can_see(u, pr.id))) then
    raise exception 'not_found';
  end if;

  if pr.id = u then v_status := 'me';
  elsif private.are_connected(u, pr.id) then v_status := 'connected';
  else
    select * into req from public.connection_requests
     where status = 'pending' and ((from_id = u and to_id = pr.id) or (from_id = pr.id and to_id = u)) limit 1;
    if found then v_status := case when req.from_id = u then 'request_sent' else 'request_received' end; end if;
  end if;

  select coalesce(sum(points) filter (where created_at >= private.week_start()), 0), coalesce(sum(points), 0)
    into week_pts, all_pts from public.points_ledger where user_id = pr.id;

  return jsonb_build_object(
    'profile', private.profile_card(pr) || jsonb_build_object('created_at', pr.created_at),
    'status', v_status,
    'request_id', req.id,
    'conversation_id', case when v_status = 'connected' then private.direct_conversation(u, pr.id) end,
    'points', jsonb_build_object('week', week_pts, 'all', all_pts),
    'projects', coalesce((select jsonb_agg(jsonb_build_object(
        'id', pj.id, 'title', pj.title, 'description', pj.description, 'category', pj.category,
        'stage', pj.stage, 'cover_url', pj.cover_url, 'links', pj.links, 'help_needed', pj.help_needed,
        'feedback_kind', pj.feedback_kind, 'updated_at', pj.updated_at) order by pj.updated_at desc)
      from public.projects pj where pj.owner_id = pr.id), '[]'),
    'groups', coalesce((select jsonb_agg(jsonb_build_object('id', g.id, 'slug', g.slug, 'name', g.name,
        'image_url', g.image_url, 'is_official', g.is_official) order by g.is_official desc, g.name)
      from public.group_members gm join public.groups g on g.id = gm.group_id
      where gm.user_id = pr.id and g.archived_at is null
        and (g.visibility = 'public' or private.is_group_member(g.id, u))), '[]'),
    'connections_count', (select count(*) from public.connections c where pr.id in (c.user_a, c.user_b))
  );
end $$;

create or replace function public.search_users(p jsonb) returns jsonb
language plpgsql security definer set search_path = public, private as $$
declare u uuid := private.require_member(); q text := lower(btrim(coalesce(p ->> 'q', ''), ' @'));
begin
  if char_length(q) < 2 then return '[]'; end if;
  perform private.rate_limit(u, 'search', 60, interval '1 minute');
  q := replace(replace(replace(q, '\', ''), '%', ''), '_', '\_');
  return coalesce((
    select jsonb_agg(private.profile_card(pr) || jsonb_build_object(
             'connected', private.are_connected(u, pr.id)) order by (pr.username = q) desc, pr.username)
      from (select * from public.profiles
             where id <> u and onboarding_completed_at is not null
               and (username like q || '%' or lower(display_name) like '%' || q || '%')
               and private.can_see(u, id)
             limit 20) pr), '[]');
end $$;

-- ---------------------------------------------------------------------------
-- Settings
-- ---------------------------------------------------------------------------
create or replace function public.get_settings(p jsonb default '{}') returns jsonb
language plpgsql stable security definer set search_path = public, private as $$
declare u uuid := private.require_user(); pv public.profile_private; pr public.profiles;
begin
  select * into pv from public.profile_private where user_id = u;
  select * into pr from public.profiles where id = u;
  return jsonb_build_object(
    'birth_date', pv.birth_date,
    'notification_prefs', pv.notification_prefs,
    'discoverable', pr.discoverable,
    'email', (select email from auth.users where id = u),
    'eligibility', private.cfg('eligibility'),
    'blocked', coalesce((select jsonb_agg(private.profile_card(b2) order by b.created_at desc)
      from public.blocks b join public.profiles b2 on b2.id = b.blocked_id where b.blocker_id = u), '[]'));
end $$;

create or replace function public.update_settings(p jsonb) returns jsonb
language plpgsql security definer set search_path = public, private as $$
declare u uuid := private.require_user(); prefs jsonb;
begin
  if p ? 'notification_prefs' then
    select jsonb_object_agg(k, to_jsonb(coalesce((p -> 'notification_prefs' ->> k)::boolean, true)))
      into prefs from unnest(array['messages', 'matches', 'groups', 'feedback']) k;
    update public.profile_private set notification_prefs = prefs where user_id = u;
  end if;
  if p ? 'discoverable' then
    update public.profiles set discoverable = coalesce((p ->> 'discoverable')::boolean, true) where id = u;
  end if;
  if p ? 'birth_date' then
    perform private.apply_profile_patch(u, jsonb_build_object('birth_date', p ->> 'birth_date'));
  end if;
  return public.get_settings('{}');
end $$;

-- Hand ownership to the longest-standing moderator, else the longest-standing member,
-- else archive the group. Used when an owner leaves or deletes their account.
create or replace function private.transfer_or_archive(g uuid, leaving uuid) returns uuid
language plpgsql security definer set search_path = public, private as $$
declare heir uuid;
begin
  select user_id into heir from public.group_members
   where group_id = g and user_id <> leaving
   order by (role = 'moderator') desc, joined_at asc limit 1;
  update public.group_members set role = 'member' where group_id = g and user_id = leaving and role = 'owner';
  if heir is null then
    update public.groups set archived_at = now(), owner_id = null where id = g;
  else
    update public.group_members set role = 'owner' where group_id = g and user_id = heir;
    update public.groups set owner_id = heir where id = g;
  end if;
  return heir;
end $$;

create or replace function public.delete_my_account(p jsonb) returns jsonb
language plpgsql security definer set search_path = public, private as $$
declare u uuid := private.require_user(); g uuid;
begin
  if coalesce(p ->> 'confirm', '') <> 'ELIMINAR' then raise exception 'confirmation_required'; end if;
  for g in select group_id from public.group_members where user_id = u and role = 'owner' loop
    perform private.transfer_or_archive(g, u);
  end loop;
  delete from auth.users where id = u; -- cascades to profiles and all owned rows
  return jsonb_build_object('deleted', true);
end $$;

-- ---------------------------------------------------------------------------
-- Blocks & reports
-- ---------------------------------------------------------------------------
create or replace function public.block_user(p jsonb) returns jsonb
language plpgsql security definer set search_path = public, private as $$
declare u uuid := private.require_user(); t uuid := (p ->> 'user_id')::uuid;
begin
  if t is null or t = u then raise exception 'invalid_target'; end if;
  if not exists (select 1 from public.profiles where id = t) then raise exception 'not_found'; end if;
  insert into public.blocks (blocker_id, blocked_id) values (u, t) on conflict do nothing;
  delete from public.connections where user_a = least(u, t) and user_b = greatest(u, t);
  update public.connection_requests set status = 'cancelled', decided_at = now()
   where status = 'pending' and ((from_id = u and to_id = t) or (from_id = t and to_id = u));
  update public.group_invitations set status = 'revoked'
   where status = 'pending' and ((inviter_id = u and invitee_id = t) or (inviter_id = t and invitee_id = u));
  return jsonb_build_object('blocked', true);
end $$;

create or replace function public.unblock_user(p jsonb) returns jsonb
language plpgsql security definer set search_path = public, private as $$
declare u uuid := private.require_user();
begin
  delete from public.blocks where blocker_id = u and blocked_id = (p ->> 'user_id')::uuid;
  return jsonb_build_object('blocked', false);
end $$;

create or replace function public.report(p jsonb) returns jsonb
language plpgsql security definer set search_path = public, private as $$
declare u uuid := private.require_user(); tt text := p ->> 'target_type'; tid uuid := (p ->> 'target_id')::uuid;
begin
  if tt not in ('user', 'message', 'project', 'comment', 'group', 'update') or tid is null then raise exception 'invalid_target'; end if;
  if coalesce(p ->> 'reason', '') not in ('spam', 'harassment', 'inappropriate', 'impersonation', 'safety', 'other') then
    raise exception 'invalid_reason';
  end if;
  -- Reporters may only report things they can actually see.
  if (tt = 'user' and not exists (select 1 from public.profiles where id = tid))
     or (tt = 'message' and not exists (select 1 from public.messages m where m.id = tid and private.is_conversation_member(m.conversation_id, u)))
     or (tt = 'project' and not private.can_view_project(tid, u))
     or (tt = 'comment' and not exists (select 1 from public.project_comments c where c.id = tid and private.can_view_project(c.project_id, u)))
     or (tt = 'update' and not exists (select 1 from public.project_updates c where c.id = tid and private.can_view_project(c.project_id, u)))
     or (tt = 'group' and not private.can_view_group(tid, u)) then
    raise exception 'not_found';
  end if;
  perform private.rate_limit(u, 'report', private.cfg_int('reports_per_day'), interval '1 day');
  insert into public.reports (reporter_id, target_type, target_id, reason, details)
  values (u, tt, tid, p ->> 'reason', private.clean_text(p ->> 'details', 1000))
  on conflict (reporter_id, target_type, target_id) do update set reason = excluded.reason, details = excluded.details;
  return jsonb_build_object('reported', true);
end $$;
