# Refactor sweep, beta CTA, and routing cleanup (2026-08-28)

## Scope

Rebased on latest `main`, replaced the homepage artist CTA with **Try beta
client** (`https://beta.tahti.live`), wrote this worklog from a codebase
sweep (invalid/mock/stale items, refactors, illogicalities), then shipped
**nine fixes in three slices** (3×3).

## Findings backlog (not all shipped this session)

| ID  | Category | Item                                                                        | Path / note                            |
| --- | -------- | --------------------------------------------------------------------------- | -------------------------------------- |
| R01 | Quick    | Flatten `/join` → `/signup` (was `/apply` → `/signup`)                      | `apps/web/src/app/join/page.tsx`       |
| R02 | Quick    | Homepage CTA → Try beta client                                              | `(marketing)/page.tsx`                 |
| R03 | Quick    | `/for-artists` static “registration closed” ignores `SIGNUP_OPEN`           | `(info)/for-artists/page.tsx`          |
| R04 | Quick    | About page CTAs link to `/join`                                             | `about/page.tsx`                       |
| R05 | Quick    | Delete deprecated root `scripts/seed-e2e-screenshots.ts` re-export          | `scripts/`                             |
| R06 | Quick    | `/apply/layout.tsx` no-op pass-through                                      | `apply/`                               |
| R07 | Quick    | `phase-4.sh` expects HTTP 200 on `/join` (redirect)                         | `tests/e2e/phase-4.sh`                 |
| R08 | Refactor | Orphaned `BetaApplyForm` — `/apply` redirects, form unreachable             | `apply/beta-apply-form.tsx`            |
| R09 | Refactor | Duplicate server `API_URL` fallbacks (`localhost:3001` vs `api:3001`)       | ~30 call sites                         |
| R10 | Refactor | Mix of `NEXT_PUBLIC_API_BASE` / `NEXT_PUBLIC_API_URL` on client             | `apps/web`                             |
| R11 | Refactor | Duplicate chat panel logic                                                  | `chat-panel.tsx`, `fan-chat-panel.tsx` |
| R12 | Refactor | Four overlapping e2e seed scripts                                           | `apps/api/scripts/seed-e2e-*`          |
| R13 | Stale    | Dual marketing home: `website/` apex vs `apps/web` on `app.tahti.live`      | `infra/Caddyfile`                      |
| R14 | Stale    | `website/index.html` “Open beta Aug 2026” + `/join` CTA                     | `website/` (off limits unless asked)   |
| R15 | Stale    | `docs/AGENT.md` says Lucia; code uses custom sessions                       | `docs/AGENT.md`                        |
| R16 | Stale    | Roadmap PLAT-041/046 still say `/apply`                                     | `docs/project-roadmap.md`              |
| R17 | Invalid  | `[BETA]` seed artists may appear in prod discover if scripts run on prod DB | `seed-beta-artists.ts`                 |
| R18 | Stale    | `@deprecated` `Stat` / `StatGrid` still exported, unused                    | `packages/ui`                          |
| R19 | Stale    | E2e manifest still lists `/join`, `/apply` routes                           | `docs/e2e-screenshots/`                |
| R20 | Stale    | Docs say register at `/join`                                                | `docs/user-flows.md`, guides           |

## Shipped — slice 1 (routing + homepage)

- [x] **R02** — Homepage: “Join as an artist” → external **Try beta client**
- [x] **R01** — `/join` redirects directly to `/signup`
- [x] **R03** — `/for-artists`: beta CTA + dynamic signup-closed copy via `isSignupOpen()`

## Shipped — slice 2 (about + script hygiene)

- [x] **R04** — About page CTAs: **Try beta client** + sign in (+ join when signup open)
- [x] **R06** — Remove no-op `apply/layout.tsx`; **R07** fix `phase-4.sh` join redirect check
- [x] **R05** — Remove deprecated `scripts/seed-e2e-screenshots.ts`; close P2 in `future-improvements.md`

## Shipped — slice 3 (docs + exports)

- [x] **R15** — `docs/AGENT.md`: auth stack → custom session + argon2
- [x] **R18** — Stop exporting deprecated `Stat` / `StatGrid` from `@tahti/ui`
- [x] **R23** — `AGENTS.md`: disambiguate `beta.tahti.live` (Nuclear client) vs `[BETA]` seed fixtures

## Shipped — slice 4 (docs routing)

- [x] **R16** — Roadmap PLAT-041/046: `/apply` CTAs → `/signup` / beta client
- [x] **R19** — E2e manifest + capture script: `/join`/`/apply` → `/signup`
- [x] **R20** — User flows, guides, flows packs: register at `/signup`

## Shipped — slice 5 (signup + prod guard + helper)

- [x] **R08** — `/signup` when closed shows `BetaApplyForm` (was unreachable orphan)
- [x] **R17** — `seed-beta-artists.ts` refuses production unless `ALLOW_BETA_SEED=1`
- [x] **R09** (start) — `apps/web/src/lib/api-url.ts` with `resolveServerApiUrl` / `resolveClientApiUrl`

## Shipped — slice 6 (server API URL migration)

- [x] **R09** — Migrate `lib/*-client.ts`, `session`, `dashboard-session`, `middleware`, `apply/actions`

## Deferred (next passes)

- R10 client `NEXT_PUBLIC_API_*` migration (~70 components)
- R11 duplicate chat panel logic
- R12 four overlapping e2e seed scripts
- R13–R14 marketing site / apex cutover (needs explicit `website/` task)
