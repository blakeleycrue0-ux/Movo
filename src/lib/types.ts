export type Stage = "exploring" | "starting" | "building";
export type Seeking = "people" | "learning" | "feedback" | "collaboration";

export interface ProfileCard {
  id: string;
  username: string | null;
  display_name: string | null;
  avatar_url: string | null;
  headline: string | null;
  bio: string | null;
  interests: string[];
  stage: Stage | null;
  seeking: Seeking[];
  skills: string[];
}

export interface Me extends ProfileCard {
  onboarding_completed: boolean;
  onboarding_step: number;
  discoverable: boolean;
}

export interface ProjectLite {
  id: string;
  title: string;
  description: string | null;
  stage: string;
  help_needed: string | null;
  links: { label: string; url: string }[];
  cover_url: string | null;
}

export interface DiscoverCard extends ProfileCard {
  shared_interests: string[];
  complementary_skills: string[];
  shared_seeking: Seeking[];
  same_stage: boolean;
  project: ProjectLite | null;
}

export interface Allowance {
  limit: number;
  used: number;
  remaining: number;
  resets_at: string;
  timezone: string;
}

export interface SwipeResult {
  status: "ok" | "duplicate";
  direction: "connect" | "pass";
  matched: boolean;
  conversation_id: string | null;
  other: ProfileCard | null;
  allowance: Allowance;
}

export interface TableCard extends ProfileCard {
  project_title: string | null;
}

export interface GroupInfo {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  topic: string | null;
  image_url: string | null;
  visibility: "public" | "private";
  join_policy: "open" | "request" | "invite";
  is_official: boolean;
  member_limit: number | null;
  rules: string | null;
  created_at: string;
  member_count: number;
  my_role: "owner" | "moderator" | "member" | null;
  request_pending: boolean;
  invitation_id: string | null;
}

export interface GroupDetail extends GroupInfo {
  conversation_id: string | null;
  owner: ProfileCard | null;
  members: (ProfileCard & { role: string; joined_at: string })[];
  resources: { id: string; title: string; url: string }[];
  pending_requests: { id: string; message: string | null; created_at: string; user: ProfileCard }[] | null;
  pending_invitations: { id: string; created_at: string; user: ProfileCard }[] | null;
}

export interface SessionInfo {
  id: string;
  group_id: string;
  title: string;
  description: string | null;
  starts_at: string;
  duration_minutes: number;
  meeting_url: string | null;
  cancelled: boolean;
  group: { id: string; slug: string; name: string };
  going: number;
  maybe: number;
  my_rsvp: "going" | "maybe" | "no" | null;
  can_manage: boolean;
}

export interface Attachment {
  path: string;
  mime: string;
  size: number;
  kind: "image" | "audio" | "file";
  name: string | null;
  duration?: number | null;
  width?: number | null;
  height?: number | null;
}

export interface Message {
  id: string;
  conversation_id: string;
  sender_id: string | null;
  client_id: string;
  body: string | null;
  attachment: Attachment | null;
  reply_to: string | null;
  reply_preview: { id: string; sender_id: string | null; body: string | null; attachment_kind: string | null } | null;
  created_at: string;
  edited_at: string | null;
  deleted: boolean;
  reactions: { emoji: string; count: number; mine: boolean }[];
}

export interface ConversationSummary {
  id: string;
  kind: "direct" | "group";
  created_at: string;
  last_at: string | null;
  other: ProfileCard | null;
  group: { id: string; slug: string; name: string; image_url: string | null; is_official: boolean } | null;
  last_message: { body: string | null; sender_id: string | null; attachment_kind: string | null; created_at: string; deleted: boolean } | null;
  unread: number;
  can_send: boolean;
  muted: boolean;
}

export interface ConversationDetail {
  id: string;
  kind: "direct" | "group";
  other: ProfileCard | null;
  group: { id: string; slug: string; name: string; image_url: string | null; is_official: boolean; my_role: string | null } | null;
  can_send: boolean;
  connected: boolean | null;
  blocked: boolean | null;
  receipts: { other_last_read_at: string } | null;
}

export interface Project {
  id: string;
  title: string;
  description: string | null;
  category: string | null;
  stage: string;
  cover_url: string | null;
  links: { label: string; url: string }[];
  help_needed: string | null;
  feedback_kind: string | null;
  created_at: string;
  updated_at: string;
  owner: ProfileCard;
  is_owner: boolean;
  saved: boolean;
  saves_count: number;
  comments_count: number;
  last_update: { id: string; body: string; created_at: string } | null;
}

export interface ProjectDetail extends Project {
  updates: { id: string; body: string; created_at: string }[];
  comments: { id: string; body: string; created_at: string; edited_at: string | null; useful: boolean; author: ProfileCard; is_mine: boolean }[];
  shared_in: { id: string; slug: string; name: string }[];
}

export interface RankingRules {
  useful_feedback_points: number;
  useful_feedback_daily_cap: number;
  useful_pair_weekly_cap: number;
  project_update_points: number;
  project_update_daily_cap: number;
  project_update_min_chars: number;
  project_update_per_project_daily: number;
}

export interface RankingData {
  period: "week" | "all";
  since: string | null;
  timezone: string;
  rules: RankingRules;
  entries: { rank: number; points: number; useful: number; updates: number; user: ProfileCard }[];
  me: { points: number; useful: number; updates: number };
}

export interface HomeFeed {
  groups: GroupInfo[];
  updates: { id: string; body: string; created_at: string; project: { id: string; title: string; stage: string; cover_url: string | null }; author: ProfileCard }[];
  sessions: SessionInfo[];
  ranking: { top: RankingData["entries"]; me: RankingData["me"] };
  requests_count: number;
  invitations_count: number;
  unread_count: number;
}

export interface ProfilePage {
  profile: ProfileCard & { created_at: string };
  status: "me" | "connected" | "request_sent" | "request_received" | "none";
  request_id: string | null;
  conversation_id: string | null;
  points: { week: number; all: number };
  projects: (Omit<Project, "owner" | "is_owner" | "saved" | "saves_count" | "comments_count" | "last_update" | "created_at">)[];
  groups: { id: string; slug: string; name: string; image_url: string | null; is_official: boolean }[];
  connections_count: number;
}

export interface OnboardingState {
  profile: ProfileCard;
  birth_date: string | null;
  draft: { project?: { title: string | null; description: string | null; url: string | null } };
  step: number;
  completed: boolean;
  eligibility: { status: string; min_age: number | null; registration_open: boolean };
}
