-- Movo · 0001 · Foundation
-- Config, profiles, private profile data, blocks, rate limiting, shared helpers.
--
-- Security model (applies to every migration):
--   * Tables have RLS enabled. The `authenticated` role gets SELECT only, filtered by policies.
--   * Every mutation goes through a SECURITY DEFINER function in `public` that validates
--     input and checks authorisation explicitly. No direct INSERT/UPDATE/DELETE grants.
--   * Helpers live in the `private` schema, which is not exposed through the API.
--   * All public functions take a single `p jsonb` argument and return jsonb, so the same
--     calls work through Supabase RPC and through the in-browser demo database.

create schema if not exists private;
grant usage on schema private to authenticated;

-- Functions are executable by PUBLIC by default in Postgres. Turn that off.
alter default privileges in schema public revoke execute on functions from public;
alter default privileges in schema private revoke execute on functions from public;

-- ---------------------------------------------------------------------------
-- Configuration (editable by operators with the service role / SQL editor)
-- ---------------------------------------------------------------------------
create table public.app_config (
  key text primary key,
  value jsonb not null,
  description text not null default '',
  updated_at timestamptz not null default now()
);

insert into public.app_config (key, value, description) values
  ('daily_connect_limit', '20', 'Positive Connect swipes per user per local day. Passing is free.'),
  ('allowance_timezone', '"Europe/Madrid"', 'Fixed IANA timezone used for daily resets and weekly rankings.'),
  ('connection_requests_per_day', '25', 'Connection requests a user can send per local day.'),
  ('messages_per_minute', '30', 'Messages a user can send per minute across all conversations.'),
  ('reports_per_day', '20', 'Reports a user can file per local day.'),
  ('groups_created_per_day', '3', 'Groups a user can create per local day.'),
  ('comments_per_hour', '30', 'Project comments a user can post per hour.'),
  ('group_member_limit', '40', 'Maximum members in a user-created group. The official community has no cap.'),
  ('max_attachment_bytes', '10485760', 'Maximum attachment size (10 MB).'),
  ('eligibility', '{
      "status": "pending_decision",
      "min_age": null,
      "minor_adult_interaction": "undecided",
      "registration_open": true
    }', 'LAUNCH BLOCKER: age eligibility and minor/adult interaction rules are not decided. '
        'min_age: integer or null. minor_adult_interaction: "undecided" | "allow" | "separate_under_18". '
        '"undecided" currently behaves like "allow" and must be decided before public registration.'),
  ('ranking', '{
      "useful_feedback_points": 10,
      "useful_feedback_daily_cap": 5,
      "useful_pair_weekly_cap": 3,
      "project_update_points": 3,
      "project_update_daily_cap": 2,
      "project_update_min_chars": 40,
      "project_update_per_project_daily": 1
    }', 'Ranking scoring rules. Shown to users on the ranking screen.');

create or replace function private.cfg(k text) returns jsonb
language sql stable security definer set search_path = public, private as $$
  select value from public.app_config where key = k
$$;

create or replace function private.cfg_int(k text) returns int
language sql stable security definer set search_path = public, private as $$
  select (value #>> '{}')::int from public.app_config where key = k
$$;

create or replace function private.tz() returns text
language sql stable security definer set search_path = public, private as $$
  select coalesce((select value #>> '{}' from public.app_config where key = 'allowance_timezone'), 'Europe/Madrid')
$$;

create or replace function private.local_today() returns date
language sql stable set search_path = public, private as $$
  select (now() at time zone private.tz())::date
$$;

create or replace function private.next_reset() returns timestamptz
language sql stable set search_path = public, private as $$
  select ((private.local_today() + 1)::timestamp at time zone private.tz())
$$;

create or replace function private.week_start() returns timestamptz
language sql stable set search_path = public, private as $$
  select (date_trunc('week', now() at time zone private.tz()) at time zone private.tz())
$$;

-- ---------------------------------------------------------------------------
-- Profiles (public-facing fields only — never birth dates)
-- ---------------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  username text unique check (username ~ '^[a-z0-9_]{3,20}$'),
  display_name text check (char_length(display_name) between 1 and 40),
  avatar_url text check (avatar_url is null or char_length(avatar_url) <= 500),
  headline text check (headline is null or char_length(headline) <= 40),
  bio text check (bio is null or char_length(bio) <= 280),
  interests text[] not null default '{}' check (cardinality(interests) <= 12),
  stage text check (stage in ('exploring', 'starting', 'building')),
  seeking text[] not null default '{}'
    check (seeking <@ array['people', 'learning', 'feedback', 'collaboration']::text[]),
  skills text[] not null default '{}' check (cardinality(skills) <= 12),
  discoverable boolean not null default true,
  onboarding_step int not null default 0,
  onboarding_completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index profiles_completed_idx on public.profiles (onboarding_completed_at) where onboarding_completed_at is not null;

-- Private data: readable only by the owner.
create table public.profile_private (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  birth_date date check (birth_date is null or (birth_date > date '1900-01-01')),
  onboarding_draft jsonb not null default '{}',
  notification_prefs jsonb not null default '{"messages": true, "matches": true, "groups": true, "feedback": true}',
  created_at timestamptz not null default now()
);

-- Create profile rows when an auth user is created.
create or replace function private.handle_new_user() returns trigger
language plpgsql security definer set search_path = public, private as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, nullif(left(coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name', ''), 40), ''))
  on conflict (id) do nothing;
  insert into public.profile_private (user_id) values (new.id) on conflict do nothing;
  return new;
end $$;

create trigger on_auth_user_created after insert on auth.users
  for each row execute function private.handle_new_user();

-- ---------------------------------------------------------------------------
-- Blocks
-- ---------------------------------------------------------------------------
create table public.blocks (
  blocker_id uuid not null references public.profiles (id) on delete cascade,
  blocked_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  check (blocker_id <> blocked_id)
);
create index blocks_blocked_idx on public.blocks (blocked_id);

-- ---------------------------------------------------------------------------
-- Reports (generic)
-- ---------------------------------------------------------------------------
create table public.reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references public.profiles (id) on delete cascade,
  target_type text not null check (target_type in ('user', 'message', 'project', 'comment', 'group', 'update')),
  target_id uuid not null,
  reason text not null check (reason in ('spam', 'harassment', 'inappropriate', 'impersonation', 'safety', 'other')),
  details text check (details is null or char_length(details) <= 1000),
  status text not null default 'open' check (status in ('open', 'reviewing', 'closed')),
  created_at timestamptz not null default now(),
  unique (reporter_id, target_type, target_id)
);

-- ---------------------------------------------------------------------------
-- Rate limiting
-- ---------------------------------------------------------------------------
create table private.rate_events (
  user_id uuid not null,
  action text not null,
  created_at timestamptz not null default now()
);
create index rate_events_idx on private.rate_events (user_id, action, created_at desc);

-- Raises 'rate_limited' if the user already performed `action` `max_count` times within `win`.
create or replace function private.rate_limit(u uuid, action text, max_count int, win interval) returns void
language plpgsql security definer set search_path = public, private as $$
declare n int;
begin
  perform pg_advisory_xact_lock(hashtext('rate:' || u::text || ':' || action));
  select count(*) into n from private.rate_events r
   where r.user_id = u and r.action = rate_limit.action and r.created_at > now() - win;
  if n >= max_count then
    raise exception 'rate_limited' using detail = json_build_object('action', action)::text;
  end if;
  insert into private.rate_events (user_id, action) values (u, action);
end $$;

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------
create or replace function private.require_user() returns uuid
language plpgsql stable set search_path = public, private as $$
declare u uuid := auth.uid();
begin
  if u is null then raise exception 'not_authenticated'; end if;
  return u;
end $$;

create or replace function private.require_member() returns uuid
language plpgsql stable security definer set search_path = public, private as $$
declare u uuid := private.require_user();
begin
  if not exists (select 1 from public.profiles where id = u and onboarding_completed_at is not null) then
    raise exception 'onboarding_required';
  end if;
  return u;
end $$;

create or replace function private.is_blocked_pair(a uuid, b uuid) returns boolean
language sql stable security definer set search_path = public, private as $$
  select exists (
    select 1 from public.blocks
     where (blocker_id = a and blocked_id = b) or (blocker_id = b and blocked_id = a)
  )
$$;

create or replace function private.age_on(d date, at_date date) returns int
language sql immutable as $$
  select extract(year from age(at_date, d))::int
$$;

-- Minor/adult interaction rule. Configurable; see app_config.eligibility.
create or replace function private.can_interact(a uuid, b uuid) returns boolean
language plpgsql stable security definer set search_path = public, private as $$
declare
  rule text := coalesce(private.cfg('eligibility') ->> 'minor_adult_interaction', 'undecided');
  da date; db date; today date := private.local_today();
begin
  if a = b then return true; end if;
  if rule in ('undecided', 'allow') then return true; end if;
  if rule = 'separate_under_18' then
    select birth_date into da from public.profile_private where user_id = a;
    select birth_date into db from public.profile_private where user_id = b;
    if da is null or db is null then return false; end if;
    return (private.age_on(da, today) >= 18) = (private.age_on(db, today) >= 18);
  end if;
  return false;
end $$;

-- Visible = not blocked either way and interaction allowed.
create or replace function private.can_see(viewer uuid, target uuid) returns boolean
language sql stable security definer set search_path = public, private as $$
  select viewer = target
      or (not private.is_blocked_pair(viewer, target) and private.can_interact(viewer, target))
$$;

create or replace function private.profile_card(p public.profiles) returns jsonb
language sql stable as $$
  select jsonb_build_object(
    'id', p.id, 'username', p.username, 'display_name', p.display_name,
    'avatar_url', p.avatar_url, 'headline', p.headline, 'bio', p.bio,
    'interests', to_jsonb(p.interests), 'stage', p.stage,
    'seeking', to_jsonb(p.seeking), 'skills', to_jsonb(p.skills)
  )
$$;

create or replace function private.profile_card_by_id(uid uuid) returns jsonb
language sql stable security definer set search_path = public, private as $$
  select private.profile_card(p) from public.profiles p where p.id = uid
$$;

create or replace function private.clean_text(t text, max_len int) returns text
language sql immutable as $$
  select nullif(left(btrim(regexp_replace(coalesce(t, ''), '[\u0000-\u0008\u000B\u000C\u000E-\u001F]', '', 'g')), max_len), '')
$$;

create or replace function private.clean_tags(arr jsonb, max_items int) returns text[]
language sql immutable as $$
  select coalesce(array_agg(distinct v), '{}')::text[] from (
    select left(lower(btrim(x)), 32) as v
      from jsonb_array_elements_text(coalesce(arr, '[]'::jsonb)) as x
     where btrim(x) <> ''
     limit max_items
  ) s
$$;

create or replace function private.is_http_url(u text) returns boolean
language sql immutable as $$
  select u ~* '^https?://[^\s/$.?#][^\s]*$' and char_length(u) <= 500
$$;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table public.app_config enable row level security;
alter table public.profiles enable row level security;
alter table public.profile_private enable row level security;
alter table public.blocks enable row level security;
alter table public.reports enable row level security;

create policy app_config_read on public.app_config for select to authenticated using (true);

create policy profiles_read on public.profiles for select to authenticated
  using (id = auth.uid() or (onboarding_completed_at is not null and private.can_see(auth.uid(), id)));

create policy profile_private_owner on public.profile_private for select to authenticated
  using (user_id = auth.uid());

create policy blocks_owner on public.blocks for select to authenticated
  using (blocker_id = auth.uid());

create policy reports_owner on public.reports for select to authenticated
  using (reporter_id = auth.uid());

revoke all on all tables in schema public from anon;
revoke all on all tables in schema private from anon, authenticated;
grant select on public.app_config, public.profiles, public.profile_private, public.blocks, public.reports to authenticated;
grant execute on all functions in schema private to authenticated;
