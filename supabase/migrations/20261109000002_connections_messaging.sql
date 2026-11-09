-- Movo · 0002 · Swipes, connections, requests, conversations, messages

create table public.swipes (
  swiper_id uuid not null references public.profiles (id) on delete cascade,
  target_id uuid not null references public.profiles (id) on delete cascade,
  direction text not null check (direction in ('connect', 'pass')),
  local_day date not null,
  created_at timestamptz not null default now(),
  primary key (swiper_id, target_id),
  check (swiper_id <> target_id)
);
create index swipes_allowance_idx on public.swipes (swiper_id, local_day) where direction = 'connect';
create index swipes_target_idx on public.swipes (target_id, swiper_id) where direction = 'connect';

-- One row per mutual connection, stored with the smaller uuid first.
create table public.connections (
  user_a uuid not null references public.profiles (id) on delete cascade,
  user_b uuid not null references public.profiles (id) on delete cascade,
  source text not null check (source in ('match', 'request')),
  created_at timestamptz not null default now(),
  primary key (user_a, user_b),
  check (user_a < user_b)
);
create index connections_b_idx on public.connections (user_b);

create table public.connection_requests (
  id uuid primary key default gen_random_uuid(),
  from_id uuid not null references public.profiles (id) on delete cascade,
  to_id uuid not null references public.profiles (id) on delete cascade,
  message text check (message is null or char_length(message) <= 200),
  status text not null default 'pending' check (status in ('pending', 'accepted', 'declined', 'cancelled')),
  created_at timestamptz not null default now(),
  decided_at timestamptz,
  check (from_id <> to_id)
);
create unique index connection_requests_pending_uidx on public.connection_requests (from_id, to_id) where status = 'pending';
create index connection_requests_to_idx on public.connection_requests (to_id) where status = 'pending';

create table public.conversations (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('direct', 'group')),
  user_a uuid references public.profiles (id) on delete cascade,
  user_b uuid references public.profiles (id) on delete cascade,
  group_id uuid, -- FK added in 0003
  created_at timestamptz not null default now(),
  last_message_at timestamptz,
  check ((kind = 'direct' and user_a is not null and user_b is not null and user_a < user_b and group_id is null)
      or (kind = 'group' and group_id is not null and user_a is null and user_b is null))
);
create unique index conversations_direct_uidx on public.conversations (user_a, user_b) where kind = 'direct';
create unique index conversations_group_uidx on public.conversations (group_id) where kind = 'group';

create table public.conversation_members (
  conversation_id uuid not null references public.conversations (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  last_read_at timestamptz not null default now(),
  muted boolean not null default false,
  joined_at timestamptz not null default now(),
  primary key (conversation_id, user_id)
);
create index conversation_members_user_idx on public.conversation_members (user_id);

create table public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations (id) on delete cascade,
  sender_id uuid references public.profiles (id) on delete set null,
  client_id uuid not null,
  body text check (body is null or char_length(body) <= 4000),
  reply_to uuid references public.messages (id) on delete set null,
  attachment jsonb,
  created_at timestamptz not null default now(),
  edited_at timestamptz,
  deleted_at timestamptz,
  unique (sender_id, client_id)
);
create index messages_conv_idx on public.messages (conversation_id, created_at desc);

create table public.message_reactions (
  message_id uuid not null references public.messages (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  emoji text not null check (emoji in ('👍', '❤️', '😂', '🔥', '👏', '🙌', '💡', '😮')),
  created_at timestamptz not null default now(),
  primary key (message_id, user_id, emoji)
);

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------
create or replace function private.pair(a uuid, b uuid, out lo uuid, out hi uuid)
language sql immutable as $$ select least(a, b), greatest(a, b) $$;

create or replace function private.are_connected(a uuid, b uuid) returns boolean
language sql stable security definer set search_path = public, private as $$
  select exists (select 1 from public.connections where user_a = least(a, b) and user_b = greatest(a, b))
$$;

create or replace function private.is_conversation_member(conv uuid, u uuid) returns boolean
language sql stable security definer set search_path = public, private as $$
  select exists (select 1 from public.conversation_members where conversation_id = conv and user_id = u)
$$;

-- Creates (or returns) the single connection + direct conversation for a pair.
-- Serialised per pair with an advisory lock so concurrent matches cannot duplicate.
create or replace function private.ensure_connection(a uuid, b uuid, src text) returns uuid
language plpgsql security definer set search_path = public, private as $$
declare lo uuid := least(a, b); hi uuid := greatest(a, b); conv uuid;
begin
  perform pg_advisory_xact_lock(hashtext('pair:' || lo::text || hi::text));
  insert into public.connections (user_a, user_b, source) values (lo, hi, src) on conflict do nothing;
  select id into conv from public.conversations where kind = 'direct' and user_a = lo and user_b = hi;
  if conv is null then
    insert into public.conversations (kind, user_a, user_b) values ('direct', lo, hi) returning id into conv;
  end if;
  insert into public.conversation_members (conversation_id, user_id)
    values (conv, lo), (conv, hi) on conflict do nothing;
  -- Close any pending requests between the pair.
  update public.connection_requests set status = 'accepted', decided_at = now()
   where status = 'pending' and ((from_id = a and to_id = b) or (from_id = b and to_id = a));
  return conv;
end $$;

create or replace function private.direct_conversation(a uuid, b uuid) returns uuid
language sql stable security definer set search_path = public, private as $$
  select id from public.conversations where kind = 'direct' and user_a = least(a, b) and user_b = greatest(a, b)
$$;

-- Can user `u` post into conversation `conv` right now?
create or replace function private.can_send(conv uuid, u uuid) returns boolean
language plpgsql stable security definer set search_path = public, private as $$
declare c public.conversations; other uuid;
begin
  select * into c from public.conversations where id = conv;
  if not found then return false; end if;
  if not private.is_conversation_member(conv, u) then return false; end if;
  if c.kind = 'direct' then
    other := case when c.user_a = u then c.user_b else c.user_a end;
    return private.are_connected(u, other) and not private.is_blocked_pair(u, other) and private.can_interact(u, other);
  end if;
  return exists (select 1 from public.group_members gm join public.groups g on g.id = gm.group_id
                  where gm.group_id = c.group_id and gm.user_id = u and g.archived_at is null);
end $$;

create or replace function private.allowance(u uuid) returns jsonb
language plpgsql stable security definer set search_path = public, private as $$
declare lim int := private.cfg_int('daily_connect_limit'); used int;
begin
  select count(*) into used from public.swipes
   where swiper_id = u and direction = 'connect' and local_day = private.local_today();
  return jsonb_build_object('limit', lim, 'used', used, 'remaining', greatest(lim - used, 0),
                            'resets_at', private.next_reset(), 'timezone', private.tz());
end $$;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table public.swipes enable row level security;
alter table public.connections enable row level security;
alter table public.connection_requests enable row level security;
alter table public.conversations enable row level security;
alter table public.conversation_members enable row level security;
alter table public.messages enable row level security;
alter table public.message_reactions enable row level security;

-- Users see only their own swipes (never who passed on them).
create policy swipes_own on public.swipes for select to authenticated using (swiper_id = auth.uid());
create policy connections_own on public.connections for select to authenticated
  using (auth.uid() in (user_a, user_b));
create policy requests_own on public.connection_requests for select to authenticated
  using (auth.uid() in (from_id, to_id));
create policy conversations_member on public.conversations for select to authenticated
  using (private.is_conversation_member(id, auth.uid()));
create policy conv_members_member on public.conversation_members for select to authenticated
  using (private.is_conversation_member(conversation_id, auth.uid()));
create policy messages_member on public.messages for select to authenticated
  using (private.is_conversation_member(conversation_id, auth.uid()));
create policy reactions_member on public.message_reactions for select to authenticated
  using (exists (select 1 from public.messages m where m.id = message_id
                  and private.is_conversation_member(m.conversation_id, auth.uid())));

grant select on public.swipes, public.connections, public.connection_requests, public.conversations,
  public.conversation_members, public.messages, public.message_reactions to authenticated;
grant execute on all functions in schema private to authenticated;
