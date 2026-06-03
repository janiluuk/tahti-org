# Future improvements and efficiency backlog

Living document for work **deferred** from the current roadmap pass, plus engineering
efficiency items. Update this when closing milestones or discovering new gaps.

Last reviewed: 2026-06-03

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
| P1 | Stripe Customer Portal for renewals and receipt history |
| P1 | Renewal reminder emails before lapse |
| P2 | Membership lapse → downgrade tier to `FREE` automatically |

### M19 — Fan subscriptions
| P | Item |
|---|---|
| P0 | ~~**Stripe Connect Express** onboarding + live Checkout~~ — wired (REST API); payout cron still open |
| P1 | ~~`charges_enabled` gate on subscribe page~~ — done (Topic 10 option A) |
| P1 | Payout transfer cron + failed-payout retry |
| P2 | Fan-only chat / newsletter perks enforcement |
| P2 | Churn handling (`customer.subscription.deleted` → grace period UX) |

### M20 — Tier gating
| P | Item |
|---|---|
| P2 | 45 / 55-minute warning copy polish |
| ~~P1~~ | ~~60-second grace + orchestrator stop~~ — done (2026-06-03) |
| ~~P1~~ | ~~Archive FLAC for paid broadcast archives~~ — done |
| ~~P2~~ | ~~Post-broadcast upgrade CTA~~ — done |
| P2 | Reconcile docs: `FREE/ARTIST/STUDIO` in code vs `FREE/PAID` in AGENT.md |

### M18 — Downloads
| P | Item |
|---|---|
| ~~P1~~ | ~~24h net-new-IP threshold~~ — done |
| P2 | Tor exit / datacenter IP allowlist |
| P2 | Nightly fraud-scan cron (velocity anomalies) |
| P2 | Release-track + FLAC/source download formats |

### M11 — Hardening (remaining)
| P | Item |
|---|---|
| P1 | pgBackRest + MinIO offsite backup **runbooks** wired and tested (`ops/RUNBOOK.md`) |
| P1 | Self-hosted **Upptime** pointing at `/api/v1/status` |
| P2 | hCaptcha on first chat message (signup only today) |
| P2 | ACRCloud cost watchdog |
| P2 | Rate-limit tuning per route from config |

### M12 — Profile + releases (remaining)
| P | Item |
|---|---|
| P1 | Release audio upload pipeline (WAV/FLAC → Opus/HLS/FLAC derivatives per AGENT.md) |
| P1 | Link `ReleaseTrack.archiveItemId` to playable audio on profile |
| ~~P1~~ | ~~Open Graph on `/u/[username]`~~ — done |
| P2 | Smart link targets JSON + DSP buttons (M14); artwork upload to MinIO |
| ~~P2~~ | ~~Basic smart links `/r/:slug`~~ — done |
| P2 | Press kit (Studio tier) |

### Not started (Phase 5+)
| Milestone | Notes |
|---|---|
| **M7** | Mixcloud + Revelator distribution — large external integration |
| **M13–M17** | Newsletter, promo, tagging, radio, venues |
| **M21** | Browser audio editor |
| **M22–M25** | hearthis parity (metadata, collections, visuals, commentary) |

---

## Engineering efficiency

### Testing
| P | Item | Benefit |
|---|---|---|
| P1 | **Playwright** smoke tests for dashboard + `/u/[username]` + `/c/[slug]` | Catches RSC/regression bugs bash e2e misses |
| P1 | Document local test DB in README (`docker compose up postgres -d`) | Faster onboarding; pairs with CI Postgres |
| ~~P2~~ | ~~Vitest coverage for embed, newsletter, venues, Connect, webhooks~~ | Done: 191 API/workspace tests (2026-06-03) |
| P2 | Shared `TestContext` fixture (single `beforeAll` app + cleanup registry) | Less boilerplate across 40+ test files |
| P2 | Ephemeral DB per Vitest worker (Testcontainers) | Eliminates `memberNumber` collision hacks |
| P2 | Contract tests for public `/api/v1/*` JSON shapes | Safe mobile/third-party consumers |

### CI / DX
| P | Item | Benefit |
|---|---|---|
| P1 | ~~Merge e2e-api into CI~~ | Done: `vital-flows-e2e` job in `ci.yml` |
| P2 | Turbo remote cache in CI | Faster `typecheck` / `lint` on large diffs |
| P2 | `pnpm test --coverage` threshold gate (e.g. 60% on `apps/api`) | Prevents untested money paths |
| P3 | Preview deployments per PR | Stakeholder review without local setup |

### Code quality
| P | Item | Benefit |
|---|---|---|
| P1 | **Zod** on all route bodies (governance, ledger, fansubs, releases done ad-hoc) | Consistent validation + types |
| P2 | Extract CSV export routes to shared `exportCsv(reply, rows)` helper | DRY for admin exports |
| P2 | Centralise `memberNumber` allocation with retry (serialisable transaction) | Remove test-only number ranges |
| P2 | OpenAPI spec generated from routes | Docs + client SDKs |

### Runtime / ops
| P | Item | Benefit |
|---|---|---|
| P1 | Redis connection pool singleton (status + rate-limit share one client) | Fewer connections, faster cold checks |
| P2 | Graceful Redis-down mode for rate limit (fail open vs closed — policy decision) | Dev without Redis |
| P2 | Structured logging (pino) with request IDs | Incident debugging |
| P3 | Read replicas for transparency aggregates | Scale public read load |

### Frontend
| P | Item | Benefit |
|---|---|---|
| P1 | Shared design tokens / component library | Consistent dashboard + public pages |
| P2 | Server-side profile markdown rendering (sanitised) | Rich bios without XSS |
| P2 | Image optimisation for `avatarUrl` / `artworkUrl` | Profile LCP < 1.5s target |

---

## Infrastructure (non-code)

These stay in `docs/project-roadmap.md` Phases 0–2 but are listed here for visibility:

- Tahti ry PRH registration and bank account
- Grant applications (Tempo, Koneen, SKR)
- Production hardware + Helsinki fiber
- Staging environment mirroring prod
- DPAs with Stripe, Mixcloud, Revelator, UpCloud

---

## Completed recently (for context)

- M8/M9/M10, M18 core, M19 core, M1 membership checkout, M20 cap + HLS tier split
- Vitest journey tests + `tests/e2e/vital-flows.sh` + CI `ci.yml` (lint + vital-flows-e2e)
- M11 partial: audit CSV, ledger CSV, `/api/v1/status`
- M12 partial: release schema, profile API, `/u/[username]` page, dashboard drafts
- M14 embed web pages; M19 Connect + Checkout; +48 Vitest files (embed, newsletter, venues, Connect, webhooks, RTMP, etc.)
