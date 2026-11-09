# Movo — implementation checklist

Status legend: [x] done · [~] partial / needs credentials · [ ] not started

## 0. Foundations
- [x] Next.js 16 + TypeScript + Tailwind v4 + Motion + Supabase client
- [x] One SQL source of truth: migrations hold tables, RLS and every mutation (RPC functions)
- [x] Demo mode runs the same migrations in-browser (PGlite) with fictional data, separate from production
- [x] i18n dictionary (Spanish default, structure ready for English)
- [x] Design tokens, typography, icon set, base components
- [x] Floating glass island (mobile) + sidebar (desktop), safe areas, blur fallback
- [x] Logo slot that loads the supplied asset from `public/brand/` (asset not yet provided → marked placeholder)

## 1. Signature experiences
- [x] Animated creator table (Home hero) with drag, tap, pause, cycling cards, reduced motion
- [x] Swipe deck with drag physics, overlays, spring-back, keyboard + buttons, failure recovery
- [x] Mutual match animation, "Hablar ahora" / "Seguir descubriendo"
- [x] Daily Connect allowance (server-enforced, fixed timezone, visible remaining/reset)

## 2. Accounts
- [x] Welcome screen, email sign-up/sign-in, Google when configured
- [x] Onboarding: 8 steps, progress, back, saved server-side, resumable
- [x] Private birth date (separate table, owner-only RLS), configurable eligibility policy
- [x] Join official community on completion; returning users skip onboarding

## 3. Social
- [x] Connection requests by @username / profile; acceptance = mutual connection
- [x] Direct messages only between connected, unblocked users (enforced in SQL)
- [x] Conversation list, unread counts, replies, reactions, attachments, voice notes
- [x] Pending / sent / read / failed states with retry
- [x] Block, report, remove connection

## 4. Groups
- [x] Official community (no cap), user groups (max 40, enforced in SQL with row locks + trigger)
- [x] Public (open / by request) and private (invitation only)
- [x] Owner / moderators, requests, invitations needing acceptance, removal, ownership transfer on leave
- [x] Pinned rules + resources, group chat, projects tab, sessions tab with RSVP

## 5. Projects, feedback, ranking
- [x] Projects with links, cover, stage, help needed, feedback type, updates
- [x] Share project into groups without duplication
- [x] Comments, saves, "useful" marks, edit/delete/report with permissions
- [x] Weekly + all-time ranking with configurable, capped, transparent rules

## 6. Calls
- [~] LiveKit integration (token route + room UI), disabled until credentials are configured
- [x] External meeting links for sessions, clearly labelled
- [x] Honest "unavailable" state; camera/mic only after explicit action

## 7. Quality
- [x] SQL test suite against real Postgres (RLS, allowance, match, caps, permissions)
- [x] Playwright browser tests (onboarding resume, swipe vs scroll, nav, reduced motion)
- [x] README with setup, `.env.example`, launch decisions
