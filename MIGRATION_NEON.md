# Migrating off Supabase → Neon (free)

The app code is now backend-neutral: it talks to any Postgres via a single
`DATABASE_URL` connection string ([src/lib/db.ts](src/lib/db.ts)). No Supabase
libraries remain.

## Status

- [x] **Code migrated** — `@supabase/supabase-js` gone, all queries rewritten as SQL. Committed to `main`.
- [x] **Data copied to Neon** — all 7 tables, verified row-for-row
      (players 22, availability 166, motm_votes 30, games 14, matches 45, teams 6, ladder 6).
- [x] **Local dev wired** — `DATABASE_URL` added to `.env.local`.
- [x] **Vercel env set** — `DATABASE_URL` added to **Production** and **Development**.
- [x] **Deployed & verified in prod** — `bd4m.vercel.app` serving from Neon
      (`/api/briars-fixtures` reports `source: neon`; vote + season stats load).
- [ ] **Preview env** — couldn't set via CLI (version bug); add in dashboard if you use
      preview branch deploys (Settings → Env Vars → `DATABASE_URL`, Preview, all branches).
- [ ] **Rotate the Neon password** — it was shared in plaintext during setup. Neon dashboard
      → Reset password, then update `DATABASE_URL` in Vercel + `.env.local`.
- [ ] **Delete the Supabase project** → frees the seat. ← the whole point. See below.

The Neon project is `ep-falling-pine-a7z1be2y` (AWS ap-southeast-2). A full backup
of the original Supabase data is at `scratchpad/briars_backup.sql` if ever needed.

---

## Final teardown

Optional last check — trigger the ingest cron once and confirm `{ ok: true }`
(this exercises the scrape → Neon upsert path):
```bash
curl -s "https://bd4m.vercel.app/api/cron/ingest-legends/$CRON_SECRET"
```

Then:
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
