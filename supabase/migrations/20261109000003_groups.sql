-- Movo · 0003 · Groups, membership, invitations, resources, sessions

create table public.groups (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9-]{3,60}$'),
  name text not null check (char_length(name) between 3 and 50),
  description text check (description is null or char_length(description) <= 500),
  topic text check (topic is null or char_length(topic) <= 32),
  image_url text check (image_url is null or char_length(image_url) <= 500),
  visibility text not null default 'public' check (visibility in ('public', 'private')),
  join_policy text not null default 'open' check (join_policy in ('open', 'request', 'invite')),
  is_official boolean not null default false,
  owner_id uuid references public.profiles (id) on delete set null,
  member_limit int check (member_limit is null or member_limit between 2 and 40),
  rules text check (rules is null or char_length(rules) <= 2000),
  created_at timestamptz not null default now(),
  archived_at timestamptz,
  -- Private groups are invitation-only. Only the official community may be uncapped.
  check (visibility = 'public' or join_policy = 'invite'),
  check (is_official or member_limit is not null)
);
create unique index groups_single_official_uidx on public.groups (is_official) where is_official;

alter table public.conversations
  add constraint conversations_group_fk foreign key (group_id) references public.groups (id) on delete cascade;

create table public.group_members (
  group_id uuid not null references public.groups (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  role text not null default 'member' check (role in ('owner', 'moderator', 'member')),
  joined_at timestamptz not null default now(),
  primary key (group_id, user_id)
);
create index group_members_user_idx on public.group_members (user_id);
create unique index group_members_one_owner_uidx on public.group_members (group_id) where role = 'owner';

create table public.group_join_requests (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  message text check (message is null or char_length(message) <= 200),
  status text not null default 'pending' check (status in ('pending', 'approved', 'declined', 'cancelled')),
  decided_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);
create unique index group_join_requests_pending_uidx on public.group_join_requests (group_id, user_id) where status = 'pending';

create table public.group_invitations (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups (id) on delete cascade,
  inviter_id uuid references public.profiles (id) on delete set null,
  invitee_id uuid not null references public.profiles (id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'declined', 'revoked')),
  created_at timestamptz not null default now()
);
create unique index group_invitations_pending_uidx on public.group_invitations (group_id, invitee_id) where status = 'pending';

create table public.group_resources (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups (id) on delete cascade,
  title text not null check (char_length(title) between 1 and 80),
  url text not null,
  added_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

create table public.group_sessions (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups (id) on delete cascade,
  title text not null check (char_length(title) between 3 and 80),
  description text check (description is null or char_length(description) <= 500),
  starts_at timestamptz not null,
  duration_minutes int not null default 60 check (duration_minutes between 15 and 480),
  -- External meeting link supplied by the organiser (shown as an external link).
  meeting_url text,
  created_by uuid references public.profiles (id) on delete set null,
  cancelled_at timestamptz,
  created_at timestamptz not null default now()
);
create index group_sessions_upcoming_idx on public.group_sessions (group_id, starts_at);

create table public.session_rsvps (
  session_id uuid not null references public.group_sessions (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  status text not null check (status in ('going', 'maybe', 'no')),
  updated_at timestamptz not null default now(),
  primary key (session_id, user_id)
);

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------
create or replace function private.group_role(g uuid, u uuid) returns text
language sql stable security definer set search_path = public, private as $$
  select role from public.group_members where group_id = g and user_id = u
$$;

create or replace function private.is_group_member(g uuid, u uuid) returns boolean
language sql stable security definer set search_path = public, private as $$
  select exists (select 1 from public.group_members where group_id = g and user_id = u)
$$;

create or replace function private.is_group_mod(g uuid, u uuid) returns boolean
language sql stable security definer set search_path = public, private as $$
  select exists (select 1 from public.group_members where group_id = g and user_id = u and role in ('owner', 'moderator'))
$$;

create or replace function private.can_view_group(g uuid, u uuid) returns boolean
language sql stable security definer set search_path = public, private as $$
  select exists (
    select 1 from public.groups gr where gr.id = g and gr.archived_at is null and (
      gr.visibility = 'public'
      or private.is_group_member(g, u)
      or exists (select 1 from public.group_invitations i where i.group_id = g and i.invitee_id = u and i.status = 'pending')
    )
  )
$$;

create or replace function private.official_group() returns uuid
language sql stable security definer set search_path = public, private as $$
  select id from public.groups where is_official limit 1
$$;

-- Adds a member, enforcing the cap under a row lock. Also adds them to the group chat.
create or replace function private.add_group_member(g uuid, u uuid, r text default 'member') returns void
language plpgsql security definer set search_path = public, private as $$
declare gr public.groups; n int; conv uuid;
begin
  select * into gr from public.groups where id = g for update;
  if not found or gr.archived_at is not null then raise exception 'group_not_found'; end if;
  if private.is_group_member(g, u) then return; end if;
  if gr.member_limit is not null then
    select count(*) into n from public.group_members where group_id = g;
    if n >= gr.member_limit then raise exception 'group_full'; end if;
  end if;
  insert into public.group_members (group_id, user_id, role) values (g, u, r);
  select id into conv from public.conversations where kind = 'group' and group_id = g;
  if conv is not null then
    insert into public.conversation_members (conversation_id, user_id) values (conv, u) on conflict do nothing;
  end if;
end $$;

-- Backstop: the cap holds even if a future code path inserts directly.
create or replace function private.enforce_group_cap() returns trigger
language plpgsql security definer set search_path = public, private as $$
declare lim int; n int;
begin
  select member_limit into lim from public.groups where id = new.group_id for update;
  if lim is not null then
    select count(*) into n from public.group_members where group_id = new.group_id;
    if n >= lim then raise exception 'group_full'; end if;
  end if;
  return new;
end $$;

create trigger group_members_cap before insert on public.group_members
  for each row execute function private.enforce_group_cap();

create or replace function private.remove_group_member(g uuid, u uuid) returns void
language plpgsql security definer set search_path = public, private as $$
begin
  delete from public.group_members where group_id = g and user_id = u;
  delete from public.conversation_members cm using public.conversations c
   where cm.conversation_id = c.id and c.kind = 'group' and c.group_id = g and cm.user_id = u;
end $$;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table public.groups enable row level security;
alter table public.group_members enable row level security;
alter table public.group_join_requests enable row level security;
alter table public.group_invitations enable row level security;
alter table public.group_resources enable row level security;
alter table public.group_sessions enable row level security;
alter table public.session_rsvps enable row level security;

create policy groups_visible on public.groups for select to authenticated
  using (private.can_view_group(id, auth.uid()));
-- Member lists of public groups are visible; private group members only to members.
create policy group_members_visible on public.group_members for select to authenticated
  using (private.can_view_group(group_id, auth.uid()) and private.can_see(auth.uid(), user_id));
create policy join_requests_visible on public.group_join_requests for select to authenticated
  using (user_id = auth.uid() or private.is_group_mod(group_id, auth.uid()));
create policy invitations_visible on public.group_invitations for select to authenticated
  using (invitee_id = auth.uid() or private.is_group_mod(group_id, auth.uid()));
create policy resources_visible on public.group_resources for select to authenticated
  using (private.is_group_member(group_id, auth.uid())
         or exists (select 1 from public.groups g where g.id = group_id and g.visibility = 'public' and g.archived_at is null));
create policy sessions_members on public.group_sessions for select to authenticated
  using (private.is_group_member(group_id, auth.uid()));
create policy rsvps_members on public.session_rsvps for select to authenticated
  using (exists (select 1 from public.group_sessions s where s.id = session_id and private.is_group_member(s.group_id, auth.uid())));

grant select on public.groups, public.group_members, public.group_join_requests, public.group_invitations,
  public.group_resources, public.group_sessions, public.session_rsvps to authenticated;
grant execute on all functions in schema private to authenticated;

-- The official community. Created once; has no owner and no member cap.
insert into public.groups (slug, name, description, topic, visibility, join_policy, is_official, member_limit, rules)
values ('comunidad-movo', 'Comunidad Movo',
        'El punto de encuentro de todas las personas de Movo. Preséntate, comparte lo que estás creando y encuentra gente con quien avanzar.',
        'comunidad', 'public', 'open', true, null,
        E'1. Trata a todo el mundo con respeto.\n2. Comparte con generosidad: feedback concreto y honesto.\n3. Nada de spam ni autopromoción repetida.\n4. Protege tu privacidad y la de los demás.\n5. Si algo no está bien, repórtalo.');
insert into public.conversations (kind, group_id) select 'group', id from public.groups where is_official;
