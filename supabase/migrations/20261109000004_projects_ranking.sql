-- Movo · 0004 · Projects, updates, feedback, saves, group shares, ranking ledger

create table public.projects (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles (id) on delete cascade,
  title text not null check (char_length(title) between 2 and 80),
  description text check (description is null or char_length(description) <= 2000),
  category text check (category is null or category in ('app', 'web', 'youtube', 'faceless', 'edicion', 'diseno', 'musica', 'escritura', 'otro')),
  stage text not null default 'idea' check (stage in ('idea', 'building', 'launched', 'paused')),
  cover_url text check (cover_url is null or char_length(cover_url) <= 500),
  links jsonb not null default '[]' check (jsonb_typeof(links) = 'array' and jsonb_array_length(links) <= 5),
  help_needed text check (help_needed is null or char_length(help_needed) <= 280),
  feedback_kind text check (feedback_kind is null or feedback_kind in ('test_app', 'rate_design', 'review_video', 'seek_collab')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index projects_owner_idx on public.projects (owner_id);

create table public.project_updates (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  author_id uuid not null references public.profiles (id) on delete cascade,
  body text not null check (char_length(body) between 1 and 1000),
  created_at timestamptz not null default now()
);
create index project_updates_idx on public.project_updates (project_id, created_at desc);

create table public.project_comments (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  author_id uuid not null references public.profiles (id) on delete cascade,
  body text not null check (char_length(body) between 1 and 1000),
  created_at timestamptz not null default now(),
  edited_at timestamptz,
  useful_at timestamptz,
  useful_by uuid references public.profiles (id) on delete set null
);
create index project_comments_idx on public.project_comments (project_id, created_at);

create table public.project_saves (
  user_id uuid not null references public.profiles (id) on delete cascade,
  project_id uuid not null references public.projects (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, project_id)
);

create table public.group_project_shares (
  group_id uuid not null references public.groups (id) on delete cascade,
  project_id uuid not null references public.projects (id) on delete cascade,
  shared_by uuid references public.profiles (id) on delete set null,
  note text check (note is null or char_length(note) <= 200),
  created_at timestamptz not null default now(),
  primary key (group_id, project_id)
);

-- Every awarded point is a ledger row with a unique source, so nothing is counted twice
-- and removing the source (e.g. un-marking "useful") removes the points.
create table public.points_ledger (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  points int not null check (points > 0),
  reason text not null check (reason in ('useful_feedback', 'project_update')),
  source_id uuid not null,
  awarded_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  unique (reason, source_id),
  check (awarded_by is null or awarded_by <> user_id)
);
create index points_ledger_user_idx on public.points_ledger (user_id, created_at);

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------
create or replace function private.can_view_project(pid uuid, u uuid) returns boolean
language sql stable security definer set search_path = public, private as $$
  select exists (select 1 from public.projects p where p.id = pid and private.can_see(u, p.owner_id))
$$;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table public.projects enable row level security;
alter table public.project_updates enable row level security;
alter table public.project_comments enable row level security;
alter table public.project_saves enable row level security;
alter table public.group_project_shares enable row level security;
alter table public.points_ledger enable row level security;

create policy projects_visible on public.projects for select to authenticated
  using (private.can_see(auth.uid(), owner_id));
create policy project_updates_visible on public.project_updates for select to authenticated
  using (private.can_view_project(project_id, auth.uid()));
create policy project_comments_visible on public.project_comments for select to authenticated
  using (private.can_view_project(project_id, auth.uid()) and private.can_see(auth.uid(), author_id));
create policy project_saves_own on public.project_saves for select to authenticated
  using (user_id = auth.uid());
create policy shares_visible on public.group_project_shares for select to authenticated
  using (private.can_view_group(group_id, auth.uid()));
-- Points are public (they power the ranking); no private data in the ledger.
create policy points_visible on public.points_ledger for select to authenticated using (true);

grant select on public.projects, public.project_updates, public.project_comments, public.project_saves,
  public.group_project_shares, public.points_ledger to authenticated;
grant execute on all functions in schema private to authenticated;
