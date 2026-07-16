# Migrating off Supabase → Neon (free)

The app code is now backend-neutral: it talks to any Postgres via a single
`DATABASE_URL` connection string ([src/lib/db.ts](src/lib/db.ts)). No Supabase
libraries remain.

## Status

- [x] **Code migrated** — `@supabase/supabase-js` gone, all queries rewritten as SQL.
- [x] **Data copied to Neon** — all 7 tables, verified row-for-row
      (players 22, availability 166, motm_votes 30, games 14, matches 45, teams 6, ladder 6).
- [x] **Local dev wired** — `DATABASE_URL` added to `.env.local`; app smoke-tested
      against Neon (reads, joins, season-stats, and availability upserts all green).
- [ ] **Vercel pointed at Neon** — you (step 1 below).
- [ ] **Supabase project deleted** — you, after verifying prod (step 2). ← frees the seat.

The Neon project is `ep-falling-pine-a7z1be2y` (AWS ap-southeast-2). A full backup
of the original Supabase data is saved at `scratchpad/briars_backup.sql` if ever needed.

---

## 1. Point Vercel at Neon

**Vercel → Project → Settings → Environment Variables:**
- Add `DATABASE_URL` = the Neon connection string (Production + Preview + Development).
  It's the same value now in your `.env.local`.
- Redeploy.

> The code prefers `DATABASE_URL`, then falls back to the old `POSTGRES_URL*`
> vars, so nothing breaks during the cutover.

## 2. Verify prod, then tear down Supabase

After redeploy, exercise each surface once:
- Load `/briars` — fixtures + ladder render (reads `teams`/`matches`/`ladder_latest`).
- Set your availability for a game, reload — status persists.
- `/vote` — nominees load; cast a vote during an open window.
- Trigger the ingest cron once and confirm `{ ok: true }`:
  ```bash
  curl -s "https://<your-app>/api/cron/ingest-legends/$CRON_SECRET"
  ```

Once all green:
1. **Delete the Supabase project** → frees your seat. ✅
2. In Vercel, remove the now-unused vars: `SUPABASE_*`, `NEXT_PUBLIC_SUPABASE_*`,
   `POSTGRES_URL`, `POSTGRES_URL_NON_POOLING`, `POSTGRES_HOST/USER/PASSWORD/DATABASE`,
   `POSTGRES_PRISMA_URL`. Keep `DATABASE_URL`, `TEAM_PIN`, `CRON_SECRET`.
3. Locally, delete the same Supabase lines from `.env.local` (keep `DATABASE_URL`).

## What changed in code (already done)

- `@supabase/supabase-js` removed; `@neondatabase/serverless` added.
- `src/lib/supabaseAdmin.ts` → replaced by `src/lib/db.ts` (`getSql()`).
- Every `.from().select().eq()…` call rewritten as plain parameterized SQL —
  same queries, same behavior, including the MOTM upserts, availability joins,
  and the daily ladder-ingest cron.
- `typecheck` + `build` pass.
