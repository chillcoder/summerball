@AGENTS.md

# Summer Ball — Softball Stats Tracker

## Stack
- Next.js 16 (App Router, Turbopack) + TypeScript strict
- Supabase (Postgres + Auth + Realtime) — client in `src/lib/supabase/`
- PostHog — analytics, session replay, feature flags
- Tailwind v4 + shadcn/ui (base-nova style)
- Zustand for ephemeral UI state (`src/stores/`)
- TanStack Query v5 for server state
- Dexie (offline, Phase 2)
- Anthropic Claude API (Phase 3)

## Key conventions
- **Proxy file** (not middleware): `src/proxy.ts` exports `proxy` function — this is Next.js 16's rename of middleware
- **Server Actions** for all mutations in `src/app/actions/` — no REST API routes for mutations
- **Stats computed in Postgres** via views (`player_season_stats`, `player_game_stats`, `game_box_score`) — never recompute in JS
- **Team ID** is hardcoded via `NEXT_PUBLIC_TEAM_ID` env var — single-team app
- **Dark mode always on** — `<html class="dark">` in root layout, recording screen uses `bg-zinc-950`

## Env vars required
See `.env.local` for all required vars. All `NEXT_PUBLIC_*` vars are needed at build time.

## Database
Migrations in `supabase/migrations/`. Run in order:
1. `001_initial_schema.sql` — all tables
2. `002_stats_views.sql` — computed stat views
3. `003_rls_policies.sql` — Row Level Security
4. `004_seed.sql` — dev seed (team + 11 players)

## Routes
- `/` — home, live game button, recent games
- `/login` — magic link auth
- `/roster` — manage players (auth required)
- `/games/new` — create game (auth required)
- `/games/[id]/lineup` — set batting order + DNP
- `/record/[gameId]` — in-game recording screen (auth required)
- `/games/[id]` — box score (public)
- `/games/[id]/summary` — post-game summary
- `/team` — season leaderboard (public)
- `/player/[id]` — individual player card (public)

## PostHog events
All 14 events defined in `src/lib/posthog/events.ts` — capture via `posthog.capture()` using those typed names.

## Phase status
- Phase 1 complete: full online single-device recording, stats pages, auth
- Phase 2 next: Dexie offline, PWA, pinch-recorder handoff, Realtime sync
- Phase 3: AI recap, rule-based lineup optimizer, self-AB flow

