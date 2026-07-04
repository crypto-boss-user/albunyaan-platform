# Albunyaan Platform

Self-built OTT platform replacing Uscreen — web + mobile + TV. Program plan:
`~/.claude/plans/your-trial-has-expired-joyful-hammock.md`. Phase PRDs: `~/Funnel-Albunyaan-Upgrade/docs/prd/`.

## Status

**v0 scaffold (2026-07-04, overnight build).** Web app runs on mock data — no Supabase project,
no Bunny Stream, no Stripe wired yet. Schema in `supabase/migrations/` is a DRAFT pending PRD approval.

## Layout

```
apps/web        Next.js — member site + public SSR catalog + (later) /admin CMS
packages/core   shared TS: design tokens, domain types, parental-control logic, mock catalog
supabase/       SQL migrations (draft schema)
worker/         cron jobs: Uscreen export, Bunny uploader, webhook sync (stubs)
apps/mobile     (Phase 7 — not created yet)
apps/tv         (Phase 8 — not created yet)
```

## Run

```
pnpm install
pnpm dev        # → http://localhost:3000
```

Pages in v0: `/` (home), `/catalog`, `/watch/[slug]`, `/profiles`, `/parents` (parent dashboard, demo PIN **1234**).

## Rules

- Brand + manhaj constraints: `~/Funnel-Albunyaan-Upgrade/docs/brand-manhaj.md` — non-negotiable.
- Brand tokens live in `packages/core/src/tokens.ts` + `apps/web/app/globals.css` (@theme). Source: saraev rebuild.
- Money in cents, timestamps ISO-8601 UTC, IDs opaque strings (per API_CONTRACT.md).
- Never run the Uscreen scraper at scale before the Uscreen contract is reviewed (Phase 0).
