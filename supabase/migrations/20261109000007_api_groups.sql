-- Movo · 0007 · API: groups, membership, moderation, resources, sessions

create or replace function private.group_json(g public.groups, u uuid) returns jsonb
language sql stable security definer set search_path = public, private as $$
  select jsonb_build_object(
    'id', g.id, 'slug', g.slug, 'name', g.name, 'description', g.description, 'topic', g.topic,
    'image_url', g.image_url, 'visibility', g.visibility, 'join_policy', g.join_policy,
    'is_official', g.is_official, 'member_limit', g.member_limit, 'rules', g.rules, 'created_at', g.created_at,
    'member_count', (select count(*) from public.group_members gm where gm.group_id = g.id),
    'my_role', private.group_role(g.id, u),
    'request_pending', exists (select 1 from public.group_join_requests r where r.group_id = g.id and r.user_id = u and r.status = 'pending'),
    'invitation_id', (select i.id from public.group_invitations i where i.group_id = g.id and i.invitee_id = u and i.status = 'pending' limit 1))
$$;

create or replace function private.slugify(t text) returns text
language sql immutable as $$
  select trim(both '-' from regexp_replace(lower(translate(t, 'áéíóúüñÁÉÍÓÚÜÑ', 'aeiouunaeiouun')), '[^a-z0-9]+', '-', 'g'))
$$;

create or replace function public.list_groups(p jsonb default '{}') returns jsonb
language plpgsql stable security definer set search_path = public, private as $$
declare u uuid := private.require_user(); q text := lower(coalesce(p ->> 'q', ''));
begin
  return jsonb_build_object(
    'mine', coalesce((select jsonb_agg(private.group_json(g, u) order by g.is_official desc, g.name)
      from public.groups g join public.group_members gm on gm.group_id = g.id and gm.user_id = u
      where g.archived_at is null), '[]'),
    -- Discovery returns metadata only; group messages are never exposed here.
    'discover', coalesce((select jsonb_agg(private.group_json(g, u) order by g.created_at desc)
      from (select * from public.groups g
             where g.visibility = 'public' and g.archived_at is null and not g.is_official
               and not private.is_group_member(g.id, u)
               and (q = '' or lower(g.name) like '%' || q || '%' or lower(coalesce(g.topic, '')) like '%' || q || '%')
             order by g.created_at desc limit 40) g), '[]'),
    'invitations', coalesce((select jsonb_agg(jsonb_build_object('id', i.id, 'group', private.group_json(g, u),
        'inviter', private.profile_card_by_id(i.inviter_id), 'created_at', i.created_at) order by i.created_at desc)
      from public.group_invitations i join public.groups g on g.id = i.group_id
      where i.invitee_id = u and i.status = 'pending' and g.archived_at is null), '[]'));
end $$;

create or replace function public.get_group(p jsonb) returns jsonb
language plpgsql stable security definer set search_path = public, private as $$
declare u uuid := private.require_user(); g public.groups; is_member boolean; is_mod boolean;
begin
  if p ? 'id' then select * into g from public.groups where id = (p ->> 'id')::uuid;
  else select * into g from public.groups where slug = p ->> 'slug'; end if;
  if not found or not private.can_view_group(g.id, u) then raise exception 'not_found'; end if;
  is_member := private.is_group_member(g.id, u);
  is_mod := private.is_group_mod(g.id, u);
  return private.group_json(g, u) || jsonb_build_object(
    'conversation_id', case when is_member then (select id from public.conversations where kind = 'group' and group_id = g.id) end,
    'owner', private.profile_card_by_id(g.owner_id),
    'members', case when g.visibility = 'public' or is_member then coalesce((
        select jsonb_agg(private.profile_card(pr) || jsonb_build_object('role', gm.role, 'joined_at', gm.joined_at)
                         order by case gm.role when 'owner' then 0 when 'moderator' then 1 else 2 end, gm.joined_at)
          from (select * from public.group_members where group_id = g.id order by joined_at limit 60) gm
          join public.profiles pr on pr.id = gm.user_id
         where private.can_see(u, gm.user_id)), '[]') else '[]' end,
    'resources', coalesce((select jsonb_agg(jsonb_build_object('id', r.id, 'title', r.title, 'url', r.url, 'created_at', r.created_at)
        order by r.created_at) from public.group_resources r where r.group_id = g.id), '[]'),
    'pending_requests', case when is_mod then coalesce((select jsonb_agg(jsonb_build_object('id', r.id, 'message', r.message,
        'created_at', r.created_at, 'user', private.profile_card_by_id(r.user_id)) order by r.created_at)
      from public.group_join_requests r where r.group_id = g.id and r.status = 'pending'), '[]') end,
    'pending_invitations', case when is_mod then coalesce((select jsonb_agg(jsonb_build_object('id', i.id,
        'created_at', i.created_at, 'user', private.profile_card_by_id(i.invitee_id)) order by i.created_at)
      from public.group_invitations i where i.group_id = g.id and i.status = 'pending'), '[]') end);
end $$;

create or replace function public.create_group(p jsonb) returns jsonb
language plpgsql security definer set search_path = public, private as $$
declare u uuid := private.require_member(); g public.groups; base text; s text; i int := 0;
  vis text := coalesce(p ->> 'visibility', 'public'); jp text := coalesce(p ->> 'join_policy', 'open');
  nm text := private.clean_text(p ->> 'name', 50);
begin
  if nm is null or char_length(nm) < 3 then raise exception 'invalid_name'; end if;
  if vis not in ('public', 'private') then raise exception 'invalid_visibility'; end if;
  if vis = 'private' then jp := 'invite'; elsif jp not in ('open', 'request') then raise exception 'invalid_join_policy'; end if;
  perform private.rate_limit(u, 'create_group', private.cfg_int('groups_created_per_day'), interval '1 day');
  base := left(coalesce(nullif(private.slugify(nm), ''), 'grupo'), 50);
  if char_length(base) < 3 then base := base || '-grupo'; end if;
  s := base;
  while exists (select 1 from public.groups where slug = s) loop
    i := i + 1; s := base || '-' || i;
  end loop;
  insert into public.groups (slug, name, description, topic, image_url, visibility, join_policy, owner_id, member_limit, rules)
  values (s, nm, private.clean_text(p ->> 'description', 500), private.clean_text(lower(p ->> 'topic'), 32),
          case when p ->> 'image_url' ~ '^(gen:[a-z0-9-]{1,40}|storage:group-images/[A-Za-z0-9/._-]{1,160})$' then p ->> 'image_url' end,
          vis, jp, u, private.cfg_int('group_member_limit'), private.clean_text(p ->> 'rules', 2000))
  returning * into g;
  insert into public.conversations (kind, group_id) values ('group', g.id);
  perform private.add_group_member(g.id, u, 'owner');
  return private.group_json(g, u);
end $$;

create or replace function public.update_group(p jsonb) returns jsonb
language plpgsql security definer set search_path = public, private as $$
declare u uuid := private.require_member(); g public.groups;
begin
  select * into g from public.groups where id = (p ->> 'group_id')::uuid for update;
  if not found or not private.is_group_mod(g.id, u) then raise exception 'forbidden'; end if;
  if g.is_official and p ?| array['name', 'visibility', 'join_policy'] then raise exception 'forbidden'; end if;
  if p ? 'name' then
    if private.clean_text(p ->> 'name', 50) is null or char_length(private.clean_text(p ->> 'name', 50)) < 3 then raise exception 'invalid_name'; end if;
    update public.groups set name = private.clean_text(p ->> 'name', 50) where id = g.id;
  end if;
  if p ? 'description' then update public.groups set description = private.clean_text(p ->> 'description', 500) where id = g.id; end if;
  if p ? 'topic' then update public.groups set topic = private.clean_text(lower(p ->> 'topic'), 32) where id = g.id; end if;
  if p ? 'rules' then update public.groups set rules = private.clean_text(p ->> 'rules', 2000) where id = g.id; end if;
  if p ? 'image_url' then
    update public.groups set image_url = case when p ->> 'image_url' ~ '^(gen:[a-z0-9-]{1,40}|storage:group-images/[A-Za-z0-9/._-]{1,160})$'
                                              then p ->> 'image_url' end where id = g.id;
  end if;
  -- Visibility/join policy changes are owner-only.
  if p ?| array['visibility', 'join_policy'] then
    if private.group_role(g.id, u) <> 'owner' then raise exception 'forbidden'; end if;
    update public.groups set
      visibility = coalesce(p ->> 'visibility', visibility),
      join_policy = case when coalesce(p ->> 'visibility', visibility) = 'private' then 'invite'
                         else coalesce(nullif(p ->> 'join_policy', 'invite'), case when join_policy = 'invite' then 'open' else join_policy end) end
     where id = g.id;
  end if;
  select * into g from public.groups where id = g.id;
  return private.group_json(g, u);
end $$;

create or replace function public.join_group(p jsonb) returns jsonb
language plpgsql security definer set search_path = public, private as $$
declare u uuid := private.require_member(); g public.groups; rid uuid;
begin
  select * into g from public.groups where id = (p ->> 'group_id')::uuid;
  if not found or g.archived_at is not null or not private.can_view_group(g.id, u) then raise exception 'not_found'; end if;
  if private.is_group_member(g.id, u) then return jsonb_build_object('status', 'member'); end if;
  if g.join_policy = 'open' then
    perform private.add_group_member(g.id, u, 'member');
    return jsonb_build_object('status', 'member');
  elsif g.join_policy = 'request' then
    select id into rid from public.group_join_requests where group_id = g.id and user_id = u and status = 'pending';
    if rid is null then
      perform private.rate_limit(u, 'group_request', 20, interval '1 day');
      insert into public.group_join_requests (group_id, user_id, message)
      values (g.id, u, private.clean_text(p ->> 'message', 200)) returning id into rid;
    end if;
    return jsonb_build_object('status', 'requested', 'request_id', rid);
  end if;
  raise exception 'invitation_required';
end $$;

create or replace function public.cancel_join_request(p jsonb) returns jsonb
language plpgsql security definer set search_path = public, private as $$
declare u uuid := private.require_user();
begin
  update public.group_join_requests set status = 'cancelled' where group_id = (p ->> 'group_id')::uuid and user_id = u and status = 'pending';
  return jsonb_build_object('status', 'cancelled');
end $$;

create or replace function public.respond_join_request(p jsonb) returns jsonb
language plpgsql security definer set search_path = public, private as $$
declare u uuid := private.require_member(); r public.group_join_requests;
begin
  select * into r from public.group_join_requests where id = (p ->> 'request_id')::uuid for update;
  if not found or not private.is_group_mod(r.group_id, u) then raise exception 'forbidden'; end if;
  if r.status <> 'pending' then raise exception 'request_not_pending'; end if;
  if coalesce((p ->> 'approve')::boolean, false) then
    perform private.add_group_member(r.group_id, r.user_id, 'member');
    update public.group_join_requests set status = 'approved', decided_by = u where id = r.id;
    return jsonb_build_object('status', 'approved');
  end if;
  update public.group_join_requests set status = 'declined', decided_by = u where id = r.id;
  return jsonb_build_object('status', 'declined');
end $$;

-- Members of public groups and mods of private groups can invite. Invitee must accept.
create or replace function public.invite_to_group(p jsonb) returns jsonb
language plpgsql security definer set search_path = public, private as $$
declare u uuid := private.require_member(); g public.groups; t uuid := (p ->> 'user_id')::uuid; iid uuid;
begin
  select * into g from public.groups where id = (p ->> 'group_id')::uuid;
  if not found or g.archived_at is not null or g.is_official then raise exception 'not_found'; end if;
  if not (private.is_group_mod(g.id, u) or (g.visibility = 'public' and private.is_group_member(g.id, u))) then
    raise exception 'forbidden';
  end if;
  if t is null or t = u or not exists (select 1 from public.profiles where id = t and onboarding_completed_at is not null)
     or not private.can_see(u, t) then raise exception 'not_found'; end if;
  if private.is_group_member(g.id, t) then return jsonb_build_object('status', 'member'); end if;
  select id into iid from public.group_invitations where group_id = g.id and invitee_id = t and status = 'pending';
  if iid is null then
    perform private.rate_limit(u, 'group_invite', 50, interval '1 day');
    insert into public.group_invitations (group_id, inviter_id, invitee_id) values (g.id, u, t) returning id into iid;
  end if;
  return jsonb_build_object('status', 'invited', 'invitation_id', iid);
end $$;

create or replace function public.respond_invitation(p jsonb) returns jsonb
language plpgsql security definer set search_path = public, private as $$
declare u uuid := private.require_member(); i public.group_invitations;
begin
  select * into i from public.group_invitations where id = (p ->> 'invitation_id')::uuid for update;
  if not found or i.invitee_id <> u then raise exception 'not_found'; end if;
  if i.status <> 'pending' then raise exception 'request_not_pending'; end if;
  if coalesce((p ->> 'accept')::boolean, false) then
    perform private.add_group_member(i.group_id, u, 'member');
    update public.group_invitations set status = 'accepted' where id = i.id;
    update public.group_join_requests set status = 'approved' where group_id = i.group_id and user_id = u and status = 'pending';
    return jsonb_build_object('status', 'member', 'group_id', i.group_id);
  end if;
  update public.group_invitations set status = 'declined' where id = i.id;
  return jsonb_build_object('status', 'declined');
end $$;

create or replace function public.revoke_invitation(p jsonb) returns jsonb
language plpgsql security definer set search_path = public, private as $$
declare u uuid := private.require_member(); i public.group_invitations;
begin
  select * into i from public.group_invitations where id = (p ->> 'invitation_id')::uuid;
  if not found or not (i.inviter_id = u or private.is_group_mod(i.group_id, u)) then raise exception 'forbidden'; end if;
  update public.group_invitations set status = 'revoked' where id = i.id and status = 'pending';
  return jsonb_build_object('status', 'revoked');
end $$;

create or replace function public.leave_group(p jsonb) returns jsonb
language plpgsql security definer set search_path = public, private as $$
declare u uuid := private.require_user(); g public.groups; heir uuid;
begin
  select * into g from public.groups where id = (p ->> 'group_id')::uuid for update;
  if not found or not private.is_group_member(g.id, u) then raise exception 'not_found'; end if;
  if g.is_official then raise exception 'cannot_leave_official'; end if;
  if private.group_role(g.id, u) = 'owner' then heir := private.transfer_or_archive(g.id, u); end if;
  perform private.remove_group_member(g.id, u);
  return jsonb_build_object('status', 'left', 'new_owner', heir);
end $$;

create or replace function public.remove_group_member(p jsonb) returns jsonb
language plpgsql security definer set search_path = public, private as $$
declare u uuid := private.require_member(); g uuid := (p ->> 'group_id')::uuid; t uuid := (p ->> 'user_id')::uuid;
  my_role text; their_role text;
begin
  my_role := private.group_role(g, u); their_role := private.group_role(g, t);
  if their_role is null then raise exception 'not_found'; end if;
  -- Owners remove anyone but themselves; moderators remove regular members only.
  if not ((my_role = 'owner' and t <> u) or (my_role = 'moderator' and their_role = 'member')) then
    raise exception 'forbidden';
  end if;
  perform private.remove_group_member(g, t);
  return jsonb_build_object('status', 'removed');
end $$;

create or replace function public.set_member_role(p jsonb) returns jsonb
language plpgsql security definer set search_path = public, private as $$
declare u uuid := private.require_member(); g uuid := (p ->> 'group_id')::uuid; t uuid := (p ->> 'user_id')::uuid; r text := p ->> 'role';
begin
  if private.group_role(g, u) <> 'owner' or t = u then raise exception 'forbidden'; end if;
  if private.group_role(g, t) is null then raise exception 'not_found'; end if;
  if r = 'owner' then
    perform 1 from public.groups where id = g for update;
    update public.group_members set role = 'moderator' where group_id = g and user_id = u;
    update public.group_members set role = 'owner' where group_id = g and user_id = t;
    update public.groups set owner_id = t where id = g;
  elsif r in ('moderator', 'member') then
    update public.group_members set role = r where group_id = g and user_id = t;
  else
    raise exception 'invalid_role';
  end if;
  return jsonb_build_object('status', 'ok');
end $$;

create or replace function public.add_group_resource(p jsonb) returns jsonb
language plpgsql security definer set search_path = public, private as $$
declare u uuid := private.require_member(); g uuid := (p ->> 'group_id')::uuid; rid uuid;
begin
  if not private.is_group_mod(g, u) then raise exception 'forbidden'; end if;
  if not private.is_http_url(p ->> 'url') then raise exception 'invalid_url'; end if;
  if private.clean_text(p ->> 'title', 80) is null then raise exception 'invalid_title'; end if;
  if (select count(*) from public.group_resources where group_id = g) >= 20 then raise exception 'too_many_resources'; end if;
  insert into public.group_resources (group_id, title, url, added_by)
  values (g, private.clean_text(p ->> 'title', 80), p ->> 'url', u) returning id into rid;
  return jsonb_build_object('id', rid);
end $$;

create or replace function public.remove_group_resource(p jsonb) returns jsonb
language plpgsql security definer set search_path = public, private as $$
declare u uuid := private.require_member(); r public.group_resources;
begin
  select * into r from public.group_resources where id = (p ->> 'resource_id')::uuid;
  if not found or not private.is_group_mod(r.group_id, u) then raise exception 'forbidden'; end if;
  delete from public.group_resources where id = r.id;
  return jsonb_build_object('status', 'removed');
end $$;

-- ---------------------------------------------------------------------------
-- Sessions
-- ---------------------------------------------------------------------------
create or replace function private.session_json(s public.group_sessions, u uuid) returns jsonb
language sql stable security definer set search_path = public, private as $$
  select jsonb_build_object(
    'id', s.id, 'group_id', s.group_id, 'title', s.title, 'description', s.description,
    'starts_at', s.starts_at, 'duration_minutes', s.duration_minutes, 'meeting_url', s.meeting_url,
    'cancelled', s.cancelled_at is not null, 'created_by', s.created_by,
    'group', (select jsonb_build_object('id', g.id, 'slug', g.slug, 'name', g.name) from public.groups g where g.id = s.group_id),
    'going', (select count(*) from public.session_rsvps r where r.session_id = s.id and r.status = 'going'),
    'maybe', (select count(*) from public.session_rsvps r where r.session_id = s.id and r.status = 'maybe'),
    'my_rsvp', (select r.status from public.session_rsvps r where r.session_id = s.id and r.user_id = u),
    'can_manage', s.created_by = u or private.is_group_mod(s.group_id, u))
$$;

create or replace function public.create_session(p jsonb) returns jsonb
language plpgsql security definer set search_path = public, private as $$
declare u uuid := private.require_member(); g uuid := (p ->> 'group_id')::uuid; s public.group_sessions;
  url text := private.clean_text(p ->> 'meeting_url', 500); starts timestamptz := (p ->> 'starts_at')::timestamptz;
begin
  if not private.is_group_member(g, u) then raise exception 'forbidden'; end if;
  if starts is null or starts < now() - interval '5 minutes' or starts > now() + interval '1 year' then raise exception 'invalid_date'; end if;
  if url is not null and not private.is_http_url(url) then raise exception 'invalid_url'; end if;
  if private.clean_text(p ->> 'title', 80) is null or char_length(private.clean_text(p ->> 'title', 80)) < 3 then raise exception 'invalid_title'; end if;
  perform private.rate_limit(u, 'create_session', 10, interval '1 day');
  insert into public.group_sessions (group_id, title, description, starts_at, duration_minutes, meeting_url, created_by)
  values (g, private.clean_text(p ->> 'title', 80), private.clean_text(p ->> 'description', 500), starts,
          least(greatest(coalesce((p ->> 'duration_minutes')::int, 60), 15), 480), url, u)
  returning * into s;
  insert into public.session_rsvps (session_id, user_id, status) values (s.id, u, 'going');
  return private.session_json(s, u);
end $$;

create or replace function public.cancel_session(p jsonb) returns jsonb
language plpgsql security definer set search_path = public, private as $$
declare u uuid := private.require_member(); s public.group_sessions;
begin
  select * into s from public.group_sessions where id = (p ->> 'session_id')::uuid;
  if not found or not (s.created_by = u or private.is_group_mod(s.group_id, u)) then raise exception 'forbidden'; end if;
  update public.group_sessions set cancelled_at = now() where id = s.id returning * into s;
  return private.session_json(s, u);
end $$;

create or replace function public.rsvp_session(p jsonb) returns jsonb
language plpgsql security definer set search_path = public, private as $$
declare u uuid := private.require_member(); s public.group_sessions; st text := p ->> 'status';
begin
  select * into s from public.group_sessions where id = (p ->> 'session_id')::uuid;
  if not found or not private.is_group_member(s.group_id, u) then raise exception 'not_found'; end if;
  if s.cancelled_at is not null then raise exception 'session_cancelled'; end if;
  if st not in ('going', 'maybe', 'no') then raise exception 'invalid_status'; end if;
  insert into public.session_rsvps (session_id, user_id, status) values (s.id, u, st)
  on conflict (session_id, user_id) do update set status = excluded.status, updated_at = now();
  return private.session_json(s, u);
end $$;

create or replace function public.list_sessions(p jsonb default '{}') returns jsonb
language plpgsql stable security definer set search_path = public, private as $$
declare u uuid := private.require_user(); g uuid := (p ->> 'group_id')::uuid;
begin
  if g is not null and not private.is_group_member(g, u) then raise exception 'not_found'; end if;
  return coalesce((select jsonb_agg(private.session_json(s, u) order by s.starts_at) from (
    select * from public.group_sessions s
     where (g is null and private.is_group_member(s.group_id, u) or s.group_id = g)
       and s.starts_at + make_interval(mins => s.duration_minutes) > now()
       and (g is not null or s.cancelled_at is null)
     order by s.starts_at limit 30) s), '[]');
end $$;
