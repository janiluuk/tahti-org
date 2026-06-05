# Future improvements and efficiency backlog

Living document for work **deferred** from the current roadmap pass, plus engineering
efficiency items. Update this when closing milestones or discovering new gaps.

Last reviewed: 2026-06-05 (M21 audio editor v0–v2 + beta onboarding)

---

## Audit snapshot (2026-06-03)

**Shipped since last major roadmap update:**

- Phase 5–6 product: profiles, smart links, downloads, fan-subs (Connect, crons, perks), collections/RSS, archive metadata, embed pages, mentions, Tahti Radio, venues, newsletter API
- Quality: ~230 Vitest tests (56 files), OpenAPI `/docs`, journey + vital-flows + user-journey bash e2e in CI
- Platform: `ci.yml` lint gate, `scripts/ci-check.sh`, Docker full stack (`stack-up.sh`), `docs/scaling-node-distribution.md`, local Playwright screenshots (`e2e-screenshots.sh`)
- Design: `docs/design-system.md`, `packages/ui/` (tokens + React components — **not yet used by web**)
- Marketing: OG tags, apply form, bg-audio, favicons on `website/`

**Top gaps to close before beta:**

1. ~~Streaming scale blockers~~ — STREAM-001–010 done (see streaming backlog)
2. ~~Fan-sub live payout retry + M19 newsletter fan-only send UI~~ — done
3. ~~Wire `@tahti/ui` into dashboard/public pages~~ — PLAT-020 done
4. ~~Backup runbooks + Upptime (M11)~~ — backup age on `/metrics`; Upptime deploy still ops
5. **Beta onboarding** — apply form + `/admin/beta` approve + `/setup-password` (done 2026-06-05)
6. ~~**In-browser audio editor (M21 v0–v2)**~~ — trim/fade, multitrack sessions, LUFS/limiter bounce (`audio-editor.md`, done 2026-06-05)
7. Legal/infra Phase 0–2 (Tahti ry, hardware, staging)

---

## How to use this doc

| Priority | Meaning |
|---|---|
| **P0** | Blocks beta, money, or legal compliance |
| **P1** | High value before public launch |
| **P2** | Quality, scale, or operator ergonomics |
| **P3** | Nice-to-have / post-handover |

---

## Milestone completions still open

### M1 — Membership
| P | Item |
|---|---|
| ~~P1~~ | ~~Stripe Customer Portal~~ — `POST /api/me/membership/portal` (done) |
| ~~P1~~ | ~~Renewal reminder emails before lapse~~ — worker cron (done) |
| ~~P2~~ | ~~Membership lapse → downgrade tier to `FREE` automatically~~ — worker cron (done) |
| ~~P1~~ | ~~Stripe Checkout annual subscription + `invoice.paid` renewal ledger~~ — `createMembershipCheckoutSession`, `recordMembershipRenewal` |

### M19 — Fan subscriptions
| P | Item |
|---|---|
| ~~P1~~ | ~~Payout transfer cron: live Stripe transfer + failed-payout retry queue~~ — `@tahti/ledger` + worker transfer retry (done) |
| ~~P2~~ | ~~Fan-only chat / newsletter perks~~ — `FAN_CHAT` / `FAN_NEWSLETTER` codes (done) |
| ~~P2~~ | ~~Churn grace on `customer.subscription.deleted`~~ — worker + tests (done) |
| ~~P2~~ | ~~Dashboard UI: send newsletter draft to `audience: fans` only~~ — done |

### M20 — Tier gating
| P | Item |
|---|---|
| ~~P2~~ | ~~45 / 55-minute warning copy polish~~ — `warningLevel` on broadcast-usage API + dashboard (done) |
| ~~P1~~ | ~~60-second grace + orchestrator stop~~ — done |
| ~~P1~~ | ~~Archive FLAC for paid broadcast archives~~ — done |
| ~~P2~~ | ~~Post-broadcast upgrade CTA~~ — done |
| ~~P2~~ | ~~Reconcile docs: `FREE/ARTIST/STUDIO` in code vs `FREE/PAID` in AGENT.md~~ — `ArtistTier` enum in AGENT.md matches code |

### M18 — Downloads
| P | Item |
|---|---|
| ~~P1~~ | ~~24h net-new-IP threshold~~ — done |
| ~~P2~~ | ~~Release-track downloads~~ — done (basic) |
| ~~P2~~ | ~~Tor exit / datacenter IP allowlist~~ — `DOWNLOAD_NO_COUNT_CIDRS` + bot UA (done) |
| ~~P2~~ | ~~Nightly fraud-scan cron (velocity anomalies)~~ — done |
| ~~P2~~ | ~~FLAC/source formats for all release-track tiers (parity with archive)~~ — paid artist + fan-sub FLAC; fan-sub `format=source` |

### M11 — Hardening (remaining)
| P | Item |
|---|---|
| ~~P1~~ | ~~pgBackRest + MinIO offsite backup **runbooks** wired and tested (`ops/RUNBOOK.md`)~~ — unified `scripts/backup.sh` + `install-crons.sh` |
| ~~P1~~ | ~~Self-hosted **Upptime** pointing at `/api/v1/status`~~ — `ops/upptime/` example config + RUNBOOK (deploy is ops) |
| ~~P1~~ | ~~Stripe webhook failure metrics~~ — Prometheus counters on `/metrics` (done) |
| ~~P2~~ | ~~hCaptcha on first chat message~~ — token join marks Redis; publish proxy requires verification (done) |
| ~~P2~~ | ~~Backup age Prometheus alert~~ — `tahti_postgres_backup_age_hours` + `prometheus-tahti-alerts.yml` + Grafana panel |
| P2 | ACRCloud cost watchdog — `/metrics` counters + Prometheus alert (inactive until `ACRCLOUD_ENABLED=true`) | ~~done~~ — `tahti_acrcloud_identify_*` counters on `/metrics` + Prometheus burst alert |
| ~~P2~~ | ~~Rate-limit tuning per route from config~~ — `RATE_LIMIT_*` + `DOWNLOAD_RATE_*` env; see `docs/technical/rate-limit-policy.md` |
| ~~P2~~ | ~~Structured logging (pino) + request IDs~~ — `x-request-id` + JSON response logs (done) |

### M12 — Profile + releases (remaining)
| P | Item |
|---|---|
| ~~P1~~ | ~~Release track upload + transcode queue~~ — presigned upload + worker job (done) |
| ~~P1~~ | ~~Link `ReleaseTrack.archiveItemId` to playable audio on profile~~ — archive playback + `streamKey` presigned preview |
| ~~P1~~ | ~~Open Graph on `/u/[username]`~~ — done |
| ~~P2~~ | ~~Smart link + DSP editor~~ — done |
| ~~P2~~ | ~~Artwork upload to MinIO for releases~~ — presigned artwork routes |
| P2 | Press kit (Studio tier) |

### M22 — Archive metadata (remaining)
| P | Item |
|---|---|
| ~~P1~~ | ~~Hearthis-style metadata defaults on upload~~ — done |
| ~~P2~~ | ~~Editable tracklists on archive items~~ — dashboard `TracklistEditor` |
| ~~P2~~ | ~~Repost/follow download gates~~ — done |
| ~~P2~~ | ~~Channel gate funnel dashboard~~ — `GET /api/me/download-gate-stats` (done) |

### M23 — Collections (remaining)
| P | Item |
|---|---|
| ~~P1~~ | ~~Collections CRUD + RSS + profile page~~ — done |
| ~~P2~~ | ~~Per-artist archive RSS~~ — `/api/v1/u/:handle/rss.xml` + profile/dashboard links |
| ~~P2~~ | ~~Drag reorder in dashboard~~ — `PUT /api/me/collections/:slug/reorder` |
| ~~P2~~ | ~~Featured collections on smart-link landing~~ — `/r/:slug` + API |
| P3 | Per-collection video/slideshow themes (M26 deferred) | Backlog |

### Still largely open
| Milestone | Notes |
|---|---|
| **M7** | Production Mixcloud OAuth credentials (royalty sync + €8/release Stripe shipped) |
| ~~P2~~ | ~~Release ops toolkit~~ — MusicBrainz, ISRC/UPC/credits, checklist, export pack (M30 core done) |
| **M21** | Browser audio editor |
| **M24–M28** | Visuals, commentary, custom radio page, 24/7 scheduler, track version history |

---

## Hardening backlog (cross-cutting)

| P | Item | Tracks as |
|---|---|---|
| [~] | Branch protection: all `ci.yml` jobs required on merge | PLAT-002 — see `.github/BRANCH_PROTECTION.md` |
| [~] | Automate DB migrate in deploy (no manual `db push` after release) | OPS-002 — `scripts/db-migrate-deploy.sh`, `ops/DEPLOY.md` |
| P1 | PgBouncer before API horizontal scale | `scaling-node-distribution.md` |
| P2 | Swagger `/docs` auth from secrets, rotate default password | PLAT-005 |
| P2 | Redis-down policy for rate limit + sessions documented and tested | PLAT-006 |
| ~~P2~~ | ~~`@fastify/formbody` coverage for RTMP callbacks (Icecast done)~~ — `ingest.test.ts` (done) | PLAT-004 |

---

## Optimisations

| P | Item | Benefit |
|---|---|---|
| P2 | Turbo remote cache in CI | Faster lint/typecheck on large PRs |
| P2 | Redis connection singleton | Fewer connections under load |
| P2 | Vitest Testcontainers + parallel workers | Remove serial tests + memberNumber hacks |
| P2 | OpenAPI schemas from Zod (single source of truth) | `/docs` stays accurate |
| P3 | Website Docker: host-mount large media assets | Smaller images, faster builds |
| P3 | Read replica for transparency aggregate queries | Scale public ledger reads |

---

## Refactors

| P | Item | Benefit |
|---|---|---|
| P1 | Wire `@tahti/ui` into `apps/web` | One design system; delete duplicated CSS | **Done** (PLAT-020) |
| P1 | Zod on all route bodies | Consistent validation + types | PLAT-021 (partial) |
| P2 | Single e2e seed module (`apps/api/scripts/seed-e2e-screenshots.ts` only) | Less Docker/host confusion |
| P2 | Worker cron manifest (one registry file) | Easier ops audit of scheduled jobs |
| P2 | Shared Vitest `TestContext` fixture | Less boilerplate across 56 test files |
| P2 | `exportCsv()` helper for admin routes | DRY |
| P2 | `@tahti/ui` ESLint in Turbo | Same bar as other packages |
| P3 | Drop `eslint.ignoreDuringBuilds` in web Docker build | Lint enforced at build time |

---

## Engineering efficiency

### Testing
| P | Item | Benefit |
|---|---|---|
| ~~P1~~ | ~~Playwright page captures~~ — local `scripts/e2e-screenshots.sh` + `docs/e2e-screenshots/` (not CI) | Visual regression for docs/stakeholders |
| P1 | Playwright smoke in CI against `docker compose stack` (optional nightly, not every PR) | Catch RSC regressions without local-only flow |
| P1 | README: local test DB + `pnpm ci:check` one-liner | Onboarding |
| ~~P2~~ | ~~Broad API test coverage~~ — ~230 tests (2026-06-03) | — |
| ~~P2~~ | ~~Contract tests for public `/api/v1/*` JSON shapes~~ — `apps/api/src/routes/contracts/public-v1.test.ts` |
| P2 | Ephemeral DB per Vitest worker (Testcontainers) | Parallel CI |

### CI / DX
| P | Item | Benefit |
|---|---|---|
| ~~P1~~ | ~~Merge vital-flows into CI~~ — done | — |
| P1 | `user-journeys-e2e` required in branch protection | Guides-backed paths always verified |
| P2 | `pnpm test --coverage` threshold (e.g. 60% on `apps/api`) | Untested money paths visible |
| P2 | Docker stack smoke job in CI (build + health, weekly) | Catches Dockerfile drift | **Done** — `.github/workflows/stack-smoke.yml` + `scripts/stack-smoke.sh` |
| P3 | Preview deployments per PR | Stakeholder review |

### Code quality
| P | Item | Benefit |
|---|---|---|
| P2 | Centralise `memberNumber` allocation (serialisable txn + retry) | Remove test-only 97xxx/98xxx bands |
| P2 | Generate public OpenAPI from route Zod schemas | Docs + SDKs |

### Frontend
| P | Item | Benefit |
|---|---|---|
| ~~P1~~ | ~~Wire `@tahti/ui` into `apps/web`~~ — studio + public brand shells (PLAT-020) |
| P1 | Zod on all route bodies | PLAT-021 (partial) |
| ~~P2~~ | ~~Server-side profile markdown rendering (sanitised)~~ — plain-text escape on profile/channel/subscribe (`SafePlainText`) |
| P2 | Image optimisation for `avatarUrl` / `artworkUrl` | Profile LCP < 1.5s |

### Runtime / ops
| P | Item | Benefit |
|---|---|---|
| ~~P1~~ | ~~Redis connection pool singleton~~ — `apps/api/src/lib/redis.ts` (PLAT-011 partial) |
| P2 | Graceful Redis-down mode for rate limit (policy decision) | Dev without Redis |

---

## Infrastructure (non-code)

These stay in `docs/project-roadmap.md` Phases 0–2:

- Tahti ry PRH registration and bank account
- Grant applications (Tempo, Koneen, SKR)
- Production hardware + Helsinki fiber
- Staging environment mirroring prod Swarm topology
- DPAs with Stripe, Mixcloud, Revelator, UpCloud

---

## Completed recently (for context)

- M8/M9/M10, M18 core, M19 core (Connect, crons, perks), M1 membership + portal
- M12–M14 partial, M15–M17, M22–M23 partial, M20 cap + HLS + upgrade CTA
- OpenAPI/Swagger, fan-sub payout tests, collections/archive tests, user-journey e2e
- CI: lint job, vital-flows + user-journeys e2e, AGPL, website Docker
- Docker stack scripts, scaling doc, e2e screenshots (local), `packages/ui` scaffold
- Website: OG, apply form, audio unmute, design-system + phases 8–11 docs
