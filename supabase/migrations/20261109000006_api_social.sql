-- Movo · 0006 · API: discover, swipes, allowance, requests, connections, messaging

-- ---------------------------------------------------------------------------
-- Discover
-- ---------------------------------------------------------------------------
-- Candidates: completed, discoverable, visible, not yet swiped by me, not connected.
-- Explanations are computed from real profile data only.
create or replace function public.discover_feed(p jsonb default '{}') returns jsonb
language plpgsql stable security definer set search_path = public, private as $$
declare u uuid := private.require_member(); me public.profiles; lim int := least(coalesce((p ->> 'limit')::int, 10), 30);
  excl uuid[] := coalesce((select array_agg(x::uuid) from jsonb_array_elements_text(coalesce(p -> 'exclude', '[]')) x), '{}');
begin
  select * into me from public.profiles where id = u;
  return jsonb_build_object(
    'allowance', private.allowance(u),
    'profiles', coalesce((
      select jsonb_agg(card order by score desc, tiebreak) from (
        select private.profile_card(c) || jsonb_build_object(
                 'shared_interests', to_jsonb(array(select unnest(c.interests) intersect select unnest(me.interests))),
                 'complementary_skills', to_jsonb(array(select unnest(c.skills) except select unnest(me.skills))),
                 'shared_seeking', to_jsonb(array(select unnest(c.seeking) intersect select unnest(me.seeking))),
                 'same_stage', c.stage = me.stage,
                 'project', (select jsonb_build_object('id', pj.id, 'title', pj.title, 'description', pj.description,
                                     'stage', pj.stage, 'help_needed', pj.help_needed, 'links', pj.links, 'cover_url', pj.cover_url)
                               from public.projects pj where pj.owner_id = c.id order by pj.updated_at desc limit 1)
               ) as card,
               (cardinality(array(select unnest(c.interests) intersect select unnest(me.interests))) * 3
                + cardinality(array(select unnest(c.seeking) intersect select unnest(me.seeking))) * 2
                + least(cardinality(array(select unnest(c.skills) except select unnest(me.skills))), 3)
                + case when c.stage = me.stage then 1 else 0 end) as score,
               md5(c.id::text || private.local_today()::text) as tiebreak
          from public.profiles c
         where c.id <> u
           and c.onboarding_completed_at is not null
           and c.discoverable
           and not (c.id = any (excl))
           and private.can_see(u, c.id)
           and not exists (select 1 from public.swipes s where s.swiper_id = u and s.target_id = c.id)
           and not private.are_connected(u, c.id)
         order by score desc, tiebreak
         limit lim
      ) ranked), '[]'));
end $$;

create or replace function public.connect_allowance(p jsonb default '{}') returns jsonb
language plpgsql stable security definer set search_path = public, private as $$
begin
  return private.allowance(private.require_user());
end $$;

-- Idempotent: a repeated swipe on the same target returns the original outcome and never
-- consumes allowance twice. Serialised per user so parallel devices cannot exceed the limit.
create or replace function public.swipe(p jsonb) returns jsonb
language plpgsql security definer set search_path = public, private as $$
declare
  u uuid := private.require_member();
  t uuid := (p ->> 'target_id')::uuid;
  dir text := p ->> 'direction';
  existing public.swipes;
  conv uuid;
  matched boolean := false;
  a jsonb;
begin
  if dir not in ('connect', 'pass') then raise exception 'invalid_direction'; end if;
  if t is null or t = u then raise exception 'invalid_target'; end if;
  if not exists (select 1 from public.profiles where id = t and onboarding_completed_at is not null)
     or not private.can_see(u, t) then
    raise exception 'not_found';
  end if;

  perform pg_advisory_xact_lock(hashtext('swipe:' || u::text));

  select * into existing from public.swipes where swiper_id = u and target_id = t;
  if found then
    conv := case when private.are_connected(u, t) then private.direct_conversation(u, t) end;
    return jsonb_build_object('status', 'duplicate', 'direction', existing.direction,
      'matched', conv is not null, 'conversation_id', conv, 'allowance', private.allowance(u));
  end if;

  if dir = 'connect' then
    a := private.allowance(u);
    if (a ->> 'remaining')::int <= 0 then
      raise exception 'allowance_exhausted' using detail = a::text;
    end if;
  end if;

  -- Serialise on the pair before checking the reverse swipe, so two simultaneous
  -- mutual connects cannot both miss each other.
  if dir = 'connect' then
    perform pg_advisory_xact_lock(hashtext('pair:' || least(u, t)::text || greatest(u, t)::text));
  end if;
  insert into public.swipes (swiper_id, target_id, direction, local_day) values (u, t, dir, private.local_today());

  if dir = 'connect' and (
       exists (select 1 from public.swipes where swiper_id = t and target_id = u and direction = 'connect')
       or exists (select 1 from public.connection_requests where from_id = t and to_id = u and status = 'pending')) then
    conv := private.ensure_connection(u, t, 'match');
    matched := true;
  end if;

  return jsonb_build_object('status', 'ok', 'direction', dir, 'matched', matched, 'conversation_id', conv,
    'other', case when matched then private.profile_card_by_id(t) end,
    'allowance', private.allowance(u));
end $$;

-- ---------------------------------------------------------------------------
-- Connection requests
-- ---------------------------------------------------------------------------
create or replace function public.send_connection_request(p jsonb) returns jsonb
language plpgsql security definer set search_path = public, private as $$
declare u uuid := private.require_member(); t uuid := (p ->> 'user_id')::uuid; rid uuid; conv uuid;
begin
  if t is null or t = u then raise exception 'invalid_target'; end if;
  if not exists (select 1 from public.profiles where id = t and onboarding_completed_at is not null)
     or not private.can_see(u, t) then raise exception 'not_found'; end if;
  if private.are_connected(u, t) then
    return jsonb_build_object('status', 'connected', 'conversation_id', private.direct_conversation(u, t));
  end if;
  perform pg_advisory_xact_lock(hashtext('pair:' || least(u, t)::text || greatest(u, t)::text));
  -- They already asked me: accepting is the natural outcome.
  if exists (select 1 from public.connection_requests where from_id = t and to_id = u and status = 'pending') then
    conv := private.ensure_connection(u, t, 'request');
    return jsonb_build_object('status', 'connected', 'conversation_id', conv);
  end if;
  select id into rid from public.connection_requests where from_id = u and to_id = t and status = 'pending';
  if rid is not null then return jsonb_build_object('status', 'request_sent', 'request_id', rid); end if;
  perform private.rate_limit(u, 'connection_request', private.cfg_int('connection_requests_per_day'), interval '1 day');
  insert into public.connection_requests (from_id, to_id, message)
  values (u, t, private.clean_text(p ->> 'message', 200)) returning id into rid;
  return jsonb_build_object('status', 'request_sent', 'request_id', rid);
end $$;

create or replace function public.respond_connection_request(p jsonb) returns jsonb
language plpgsql security definer set search_path = public, private as $$
declare u uuid := private.require_member(); r public.connection_requests; conv uuid;
begin
  select * into r from public.connection_requests where id = (p ->> 'request_id')::uuid for update;
  if not found or r.to_id <> u then raise exception 'not_found'; end if;
  if r.status <> 'pending' then raise exception 'request_not_pending'; end if;
  if coalesce((p ->> 'accept')::boolean, false) then
    if not private.can_see(u, r.from_id) then raise exception 'not_found'; end if;
    conv := private.ensure_connection(u, r.from_id, 'request');
    return jsonb_build_object('status', 'connected', 'conversation_id', conv);
  end if;
  update public.connection_requests set status = 'declined', decided_at = now() where id = r.id;
  return jsonb_build_object('status', 'declined');
end $$;

create or replace function public.cancel_connection_request(p jsonb) returns jsonb
language plpgsql security definer set search_path = public, private as $$
declare u uuid := private.require_user();
begin
  update public.connection_requests set status = 'cancelled', decided_at = now()
   where id = (p ->> 'request_id')::uuid and from_id = u and status = 'pending';
  return jsonb_build_object('status', 'cancelled');
end $$;

create or replace function public.list_connection_requests(p jsonb default '{}') returns jsonb
language plpgsql stable security definer set search_path = public, private as $$
declare u uuid := private.require_user();
begin
  return jsonb_build_object(
    'incoming', coalesce((select jsonb_agg(jsonb_build_object('id', r.id, 'message', r.message, 'created_at', r.created_at,
        'user', private.profile_card(pr)) order by r.created_at desc)
      from public.connection_requests r join public.profiles pr on pr.id = r.from_id
      where r.to_id = u and r.status = 'pending' and private.can_see(u, r.from_id)), '[]'),
    'outgoing', coalesce((select jsonb_agg(jsonb_build_object('id', r.id, 'message', r.message, 'created_at', r.created_at,
        'user', private.profile_card(pr)) order by r.created_at desc)
      from public.connection_requests r join public.profiles pr on pr.id = r.to_id
      where r.from_id = u and r.status = 'pending'), '[]'));
end $$;

create or replace function public.list_connections(p jsonb default '{}') returns jsonb
language plpgsql stable security definer set search_path = public, private as $$
declare u uuid := private.require_user();
begin
  return coalesce((select jsonb_agg(private.profile_card(pr) || jsonb_build_object(
      'connected_at', c.created_at, 'conversation_id', private.direct_conversation(u, pr.id)) order by c.created_at desc)
    from public.connections c join public.profiles pr on pr.id = case when c.user_a = u then c.user_b else c.user_a end
    where u in (c.user_a, c.user_b)), '[]');
end $$;

create or replace function public.remove_connection(p jsonb) returns jsonb
language plpgsql security definer set search_path = public, private as $$
declare u uuid := private.require_user(); t uuid := (p ->> 'user_id')::uuid;
begin
  delete from public.connections where user_a = least(u, t) and user_b = greatest(u, t);
  return jsonb_build_object('connected', false);
end $$;

-- ---------------------------------------------------------------------------
-- Conversations & messages
-- ---------------------------------------------------------------------------
create or replace function private.message_json(m public.messages, viewer uuid) returns jsonb
language sql stable security definer set search_path = public, private as $$
  select jsonb_build_object(
    'id', m.id, 'conversation_id', m.conversation_id, 'sender_id', m.sender_id, 'client_id', m.client_id,
    'body', case when m.deleted_at is null then m.body end,
    'attachment', case when m.deleted_at is null then m.attachment end,
    'reply_to', m.reply_to,
    'reply_preview', (select jsonb_build_object('id', r.id, 'sender_id', r.sender_id,
                         'body', case when r.deleted_at is null then left(r.body, 140) end,
                         'attachment_kind', r.attachment ->> 'kind')
                        from public.messages r where r.id = m.reply_to),
    'created_at', m.created_at, 'edited_at', m.edited_at, 'deleted', m.deleted_at is not null,
    'reactions', coalesce((select jsonb_agg(jsonb_build_object('emoji', emoji, 'count', n, 'mine', mine))
                            from (select emoji, count(*) n, bool_or(user_id = viewer) mine
                                    from public.message_reactions where message_id = m.id group by emoji) x), '[]'))
$$;

create or replace function public.list_conversations(p jsonb default '{}') returns jsonb
language plpgsql stable security definer set search_path = public, private as $$
declare u uuid := private.require_user();
begin
  return coalesce((select jsonb_agg(row order by coalesce((row ->> 'last_at')::timestamptz, (row ->> 'created_at')::timestamptz) desc) from (
    select jsonb_build_object(
      'id', c.id, 'kind', c.kind, 'created_at', c.created_at, 'last_at', c.last_message_at,
      'other', case when c.kind = 'direct' then private.profile_card_by_id(case when c.user_a = u then c.user_b else c.user_a end) end,
      'group', case when c.kind = 'group' then (select jsonb_build_object('id', g.id, 'slug', g.slug, 'name', g.name,
                  'image_url', g.image_url, 'is_official', g.is_official) from public.groups g where g.id = c.group_id) end,
      'last_message', (select jsonb_build_object('body', case when m.deleted_at is null then left(m.body, 120) end,
                         'sender_id', m.sender_id, 'attachment_kind', m.attachment ->> 'kind', 'created_at', m.created_at,
                         'deleted', m.deleted_at is not null)
                         from public.messages m where m.conversation_id = c.id order by m.created_at desc limit 1),
      'unread', (select count(*) from public.messages m where m.conversation_id = c.id and m.created_at > cm.last_read_at
                   and m.sender_id is distinct from u and m.deleted_at is null),
      'can_send', private.can_send(c.id, u),
      'muted', cm.muted) as row
    from public.conversation_members cm join public.conversations c on c.id = cm.conversation_id
    where cm.user_id = u
      and (c.kind = 'group' or not exists (select 1 from public.blocks b where b.blocker_id = u
                                             and b.blocked_id = case when c.user_a = u then c.user_b else c.user_a end))
      and (c.kind = 'group' or c.last_message_at is not null or private.are_connected(c.user_a, c.user_b))
  ) s), '[]');
end $$;

create or replace function public.get_conversation(p jsonb) returns jsonb
language plpgsql stable security definer set search_path = public, private as $$
declare u uuid := private.require_user(); c public.conversations; other uuid; reads jsonb;
begin
  select * into c from public.conversations where id = (p ->> 'conversation_id')::uuid;
  if not found or not private.is_conversation_member(c.id, u) then raise exception 'not_found'; end if;
  other := case when c.kind = 'direct' then case when c.user_a = u then c.user_b else c.user_a end end;
  -- Read receipts: only for direct conversations (the other participant's last read time).
  if c.kind = 'direct' then
    select jsonb_build_object('other_last_read_at', last_read_at) into reads
      from public.conversation_members where conversation_id = c.id and user_id = other;
  end if;
  return jsonb_build_object(
    'id', c.id, 'kind', c.kind,
    'other', case when other is not null then private.profile_card_by_id(other) end,
    'group', case when c.kind = 'group' then (select jsonb_build_object('id', g.id, 'slug', g.slug, 'name', g.name,
                'image_url', g.image_url, 'is_official', g.is_official, 'my_role', private.group_role(g.id, u))
                from public.groups g where g.id = c.group_id) end,
    'can_send', private.can_send(c.id, u),
    'connected', case when other is not null then private.are_connected(u, other) end,
    'blocked', case when other is not null then private.is_blocked_pair(u, other) end,
    'receipts', reads);
end $$;

create or replace function public.get_messages(p jsonb) returns jsonb
language plpgsql stable security definer set search_path = public, private as $$
declare u uuid := private.require_user(); conv uuid := (p ->> 'conversation_id')::uuid;
  before timestamptz := (p ->> 'before')::timestamptz; lim int := least(coalesce((p ->> 'limit')::int, 50), 100);
begin
  if not private.is_conversation_member(conv, u) then raise exception 'not_found'; end if;
  return coalesce((select jsonb_agg(private.message_json(m, u) order by m.created_at asc) from (
      select * from public.messages
       where conversation_id = conv and (before is null or created_at < before)
         and (sender_id is null or sender_id = u or not exists (select 1 from public.blocks b where b.blocker_id = u and b.blocked_id = sender_id))
       order by created_at desc limit lim) m), '[]');
end $$;

create or replace function private.validate_attachment(conv uuid, u uuid, a jsonb) returns jsonb
language plpgsql stable security definer set search_path = public, private as $$
declare path text := a ->> 'path'; mime text := lower(coalesce(a ->> 'mime', '')); size bigint := (a ->> 'size')::bigint;
  kind text;
begin
  if a is null or a = 'null'::jsonb then return null; end if;
  -- Files must live in this conversation's folder, under the sender's own prefix.
  if path is null or path !~ ('^' || conv::text || '/' || u::text || '/[A-Za-z0-9._-]{1,120}$') then
    raise exception 'invalid_attachment';
  end if;
  if size is null or size <= 0 or size > private.cfg_int('max_attachment_bytes') then raise exception 'attachment_too_large'; end if;
  kind := case
    when mime in ('image/jpeg', 'image/png', 'image/webp', 'image/gif') then 'image'
    when mime in ('audio/webm', 'audio/ogg', 'audio/mp4', 'audio/mpeg', 'audio/aac') then 'audio'
    when mime in ('application/pdf', 'text/plain', 'application/zip',
                  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
                  'application/vnd.openxmlformats-officedocument.presentationml.presentation') then 'file'
    else null end;
  if kind is null then raise exception 'attachment_type_not_allowed'; end if;
  return jsonb_build_object('path', path, 'mime', mime, 'size', size, 'kind', kind,
    'name', private.clean_text(a ->> 'name', 120),
    'duration', case when kind = 'audio' then least(greatest(coalesce((a ->> 'duration')::numeric, 0), 0), 600) end,
    'width', case when kind = 'image' then (a ->> 'width')::int end,
    'height', case when kind = 'image' then (a ->> 'height')::int end);
end $$;

-- Idempotent on (sender, client_id): retries after a network failure never duplicate.
create or replace function public.send_message(p jsonb) returns jsonb
language plpgsql security definer set search_path = public, private as $$
declare
  u uuid := private.require_member();
  conv uuid := (p ->> 'conversation_id')::uuid;
  cid uuid := (p ->> 'client_id')::uuid;
  body text := private.clean_text(p ->> 'body', 4000);
  att jsonb;
  rep uuid := (p ->> 'reply_to')::uuid;
  m public.messages;
begin
  if cid is null then raise exception 'client_id_required'; end if;
  select * into m from public.messages where sender_id = u and client_id = cid;
  if found then return private.message_json(m, u); end if;

  if not private.can_send(conv, u) then raise exception 'cannot_send'; end if;
  att := private.validate_attachment(conv, u, p -> 'attachment');
  if body is null and att is null then raise exception 'empty_message'; end if;
  if rep is not null and not exists (select 1 from public.messages where id = rep and conversation_id = conv) then
    rep := null;
  end if;
  perform private.rate_limit(u, 'message', private.cfg_int('messages_per_minute'), interval '1 minute');

  insert into public.messages (conversation_id, sender_id, client_id, body, reply_to, attachment)
  values (conv, u, cid, body, rep, att) returning * into m;
  update public.conversations set last_message_at = m.created_at where id = conv;
  update public.conversation_members set last_read_at = m.created_at where conversation_id = conv and user_id = u;
  return private.message_json(m, u);
end $$;

create or replace function public.mark_read(p jsonb) returns jsonb
language plpgsql security definer set search_path = public, private as $$
declare u uuid := private.require_user();
begin
  update public.conversation_members set last_read_at = now()
   where conversation_id = (p ->> 'conversation_id')::uuid and user_id = u;
  return jsonb_build_object('ok', true);
end $$;

create or replace function public.set_conversation_muted(p jsonb) returns jsonb
language plpgsql security definer set search_path = public, private as $$
declare u uuid := private.require_user();
begin
  update public.conversation_members set muted = coalesce((p ->> 'muted')::boolean, false)
   where conversation_id = (p ->> 'conversation_id')::uuid and user_id = u;
  return jsonb_build_object('ok', true);
end $$;

create or replace function public.toggle_reaction(p jsonb) returns jsonb
language plpgsql security definer set search_path = public, private as $$
declare u uuid := private.require_member(); m public.messages; e text := p ->> 'emoji';
begin
  select * into m from public.messages where id = (p ->> 'message_id')::uuid;
  if not found or not private.can_send(m.conversation_id, u) then raise exception 'cannot_send'; end if;
  if e not in ('👍', '❤️', '😂', '🔥', '👏', '🙌', '💡', '😮') then raise exception 'invalid_reaction'; end if;
  if exists (select 1 from public.message_reactions where message_id = m.id and user_id = u and emoji = e) then
    delete from public.message_reactions where message_id = m.id and user_id = u and emoji = e;
  else
    perform private.rate_limit(u, 'reaction', 120, interval '1 minute');
    insert into public.message_reactions (message_id, user_id, emoji) values (m.id, u, e);
  end if;
  return private.message_json(m, u);
end $$;

-- Senders can delete their own messages; group owners/moderators can delete any group message.
create or replace function public.delete_message(p jsonb) returns jsonb
language plpgsql security definer set search_path = public, private as $$
declare u uuid := private.require_user(); m public.messages; c public.conversations;
begin
  select * into m from public.messages where id = (p ->> 'message_id')::uuid;
  if not found then raise exception 'not_found'; end if;
  select * into c from public.conversations where id = m.conversation_id;
  if not (m.sender_id = u or (c.kind = 'group' and private.is_group_mod(c.group_id, u))) then
    raise exception 'forbidden';
  end if;
  update public.messages set deleted_at = now(), body = null, attachment = null where id = m.id returning * into m;
  delete from public.message_reactions where message_id = m.id;
  return private.message_json(m, u);
end $$;
