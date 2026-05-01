# PRD — TimberLog Pro (Mobile) + TimberTrack (Web)

## Original Problem Statement (Summary)

The product comprises **two related apps** for timber trading workflow:

1. **TimberTrack (Web App)** — completed in earlier sessions. Lives in
   `/app/backend` (FastAPI + MongoDB) + `/app/frontend` (React + Tailwind).
   Handles BL/container CRUD, suppliers/countries lists, completion forms, dashboard
   KPIs, and Deal Sheet Excel export. **Status: COMPLETE & TESTED.**

2. **TimberLog Pro (Mobile App)** — cross-platform offline-first React Native
   (Expo) app. Lives in `/app/mobile-app`. Mirrors the web app but for field workers
   who need offline measurement entry, then sync. Tech stack: Expo + WatermelonDB +
   Supabase + RevenueCat + SheetJS + PostHog.

The user explicitly chose option (a) "Continue full mobile build (code-only)" in
this session — agent writes all code, user runs/tests locally with Expo Dev Client.

## User Personas

- **Field worker / Supervisor** — measures logs container-by-container at port; needs
  fast offline entry, auto-advance keyboard, vibration feedback.
- **Trader / Owner** — reviews KPIs, exports Deal Sheet to Excel for clients,
  manages subscription, sees per-supplier breakdown.

## Core Requirements (Mobile)

| # | Requirement | Status |
|---|---|---|
| 1 | Auth (signup/login, 14-day trial) | ✅ DONE |
| 2 | Purchases (BL) CRUD, multi-container forms | ✅ DONE |
| 3 | Dynamic supplier/country lists (add new on the fly) | ✅ DONE |
| 4 | Measurement entry with auto-advance + vibration | ✅ DONE |
| 5 | Container completion form (date, bend %, quality) | ✅ DONE |
| 6 | Dashboard with KPIs + filters | ✅ DONE |
| 7 | Excel Deal Sheet export | ✅ DONE |
| 8 | Bidirectional offline → cloud sync | ✅ DONE |
| 9 | RevenueCat paywall + entitlement gating | ✅ DONE (code) |
| 10 | Supabase Edge Function for RevenueCat webhooks | ✅ DONE |
| 11 | PostHog analytics | ✅ DONE |
| 12 | Play Store setup guide | ✅ DONE (PLAYSTORE_SETUP.md) |

## Architecture (Mobile)

```
React Native (Expo SDK 51) ─► WatermelonDB (local SQLite, offline-first)
                            │
                            ├─► Supabase (cloud Postgres + Auth + RLS)
                            │     └─► Edge Function: RevenueCat webhook → users table
                            │
                            ├─► RevenueCat SDK (subscription billing)
                            ├─► PostHog (analytics)
                            └─► XLSX + expo-sharing (Excel export)
```

## What's Implemented (Date: Feb 2026)

### Web App (`/app/backend` + `/app/frontend`) — DONE in earlier session
- Extended container fields (cbm gross/net, pcs, avg girth, l_avg, quality, bend %, etc.)
- Dynamic supplier/country APIs
- Container completion form with toggle
- Dashboard KPIs with filters
- Deal Sheet Excel export

### Mobile App (`/app/mobile-app`) — DONE this session
- Full Phase 1-5 (see `IMPLEMENTATION_STATUS.md`)
- TypeScript compiles cleanly
- All flows wired end-to-end (UI → store → DB → sync)

## Known Caveats

1. **Cannot live-test mobile here** — Emergent platform runs web preview (port 3000)
   only. User must run with Expo Dev Client locally.
2. **WatermelonDB requires native modules** — won't work in plain Expo Go; user
   needs `expo prebuild` + dev client.
3. **Supabase signup uses synthetic emails** — must disable email confirmation in
   Supabase dashboard.
4. **RevenueCat keys not configured** — paywall UI shows graceful fallback until
   user adds keys.

## Backlog (P0 / P1 / P2)

### P0 — Required before launch
- [ ] User runs Expo Dev Client and reports any runtime issues
- [ ] User configures Supabase project + runs migration
- [ ] User configures RevenueCat products + webhook (for real subs)

### P1 — Nice to have for launch
- [ ] Free-tier hard limits (3 BLs / 10 containers) enforced client-side
- [ ] Resolve sync conflicts (current strategy is "remote wins" implicit; should be explicit)
- [ ] Onboarding tour / first-run tutorial
- [ ] Empty-state illustrations (currently icon + text)
- [ ] App icon + splash screen polished assets (placeholders right now)

### P2 — Post-launch
- [ ] Image attachments for containers (Supabase Storage)
- [ ] Multi-user / team accounts (RLS policies need updating)
- [ ] Per-supplier / per-month analytics drilldown
- [ ] Push notifications via expo-notifications (already permissioned)
- [ ] Bulk import via CSV / Excel
- [ ] Web build (Expo can build a web version of the same app)

## Test Credentials

See `/app/memory/test_credentials.md` for any accounts created during testing.

## Files of Reference

- `/app/mobile-app/SETUP_CHECKLIST.md` — full setup steps
- `/app/mobile-app/IMPLEMENTATION_STATUS.md` — feature status
- `/app/mobile-app/PLAYSTORE_SETUP.md` — Play Store deployment
- `/app/mobile-app/supabase/migrations/001_initial_schema.sql` — DB schema
- `/app/mobile-app/services/sync.ts` — sync engine
- `/app/mobile-app/services/excel.ts` — Excel export
- `/app/mobile-app/supabase/functions/revenuecat-webhook/index.ts` — webhook
