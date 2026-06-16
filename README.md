# Tahti ry — implementation package

A Finnish nonprofit, open-source, channel-first broadcasting platform for independent artists.

## Read first

**[`docs/CONSTITUTION.md`](docs/CONSTITUTION.md)** — the three rules that govern every other document in this repository:

1. This is for artists, not for corporate. Administration paid fairly. No profit motive.
2. Highest quality, useful, community-driven platform — by design.
3. The artist shines brightest. We don't rip off anyone in the chain.

These rules are constitutional. They are not changeable by management decision. Everything else in `docs/` implements them.

## What this is

- **Legal form:** Finnish *yhdistys* (registered nonprofit association)
- **License:** AGPL-3.0
- **Audio quality:** lossless FLAC for paid members (all their listeners); MP3 192 kbps for free
- **Grant distribution:** annual, weighted by engagement units (downloads + fan-sub euros, not listener-hours)
- **Direct artist revenue:** fan-to-artist subscriptions with 0% org take (2% operational fee covers Stripe + GDPR + ops)
- **Hosting:** owned hardware in Helsinki + UpCloud Helsinki spillover; no CDN
- **Pricing:** single paid tier €40/year; free tier with MP3 + 1 hr/week live broadcasting

## Package structure

### Foundation documents (read these to understand the project)

| File | Purpose |
|---|---|
| [`docs/CONSTITUTION.md`](docs/CONSTITUTION.md) | **Start here.** The three rules. Constitutional. |
| [`docs/business-evaluation.md`](docs/business-evaluation.md) | Honest "is this worth doing" memo for founder, board, grant officers |
| [`docs/strategy-and-product.md`](docs/strategy-and-product.md) | Positioning, competitive critique (SoundCloud/Mixcloud/Spotify/Bandcamp), retention thesis |
| [`docs/roadmap-and-plan.md`](docs/roadmap-and-plan.md) | Phase 0 (pre-incorporation), Phase 1 (Months 1-9), Phase 2 (10-24), Phase 3 (25-36) |
| [`docs/financial-model.md`](docs/financial-model.md) | Headline 3-year model — revenue, cost, surplus, grant pool |
| [`docs/budget-detailed.md`](docs/budget-detailed.md) | Line-item monthly budget + break-even sensitivity analysis |

### User guides (plain language)

| File | Purpose |
|---|---|
| [`docs/guides/README.md`](docs/guides/README.md) | Index — who should read which guide |
| [`docs/guides/for-viewers.md`](docs/guides/for-viewers.md) | Listeners & fans: listen, chat, subscribe, smart links |
| [`docs/guides/for-artists.md`](docs/guides/for-artists.md) | Members: dashboard, profile, releases, fan tiers |
| [`docs/guides/for-streamers.md`](docs/guides/for-streamers.md) | Going live: OBS, RTMP, limits, multistream |
| [`docs/guides/multistream-simulcast.md`](docs/guides/multistream-simulcast.md) | Simulcast to Twitch, YouTube, Kick, etc. (stream keys per platform) |

### Implementation documents (for the agent + director)

| File | Purpose |
|---|---|
| [`docs/AGENT.md`](docs/AGENT.md) | Coding-agent brief — repo, milestones M0-M20, data model, anti-patterns |
| [`docs/style-guide.md`](docs/style-guide.md) | UI component library (`@/components/ui`), tokens, typography, patterns |
| [`docs/project-roadmap.md`](docs/project-roadmap.md) | Build audit, phase checklist, milestone status |
| [`docs/future-improvements.md`](docs/future-improvements.md) | Deferred milestones + engineering efficiency backlog |
| [`docs/governance-and-legal.md`](docs/governance-and-legal.md) | Yhdistys structure, bylaws (§1-12), AGPL implications, AGM mechanics |
| [`docs/profile-and-promo-toolkit.md`](docs/profile-and-promo-toolkit.md) | Profile, release model, embed/smartlink/social/newsletter/analytics specs |
| [`docs/engagement-and-fansubs.md`](docs/engagement-and-fansubs.md) | Engagement-unit grant formula + fan-to-artist subscription product spec |
| [`docs/tahti-radio-and-venues.md`](docs/tahti-radio-and-venues.md) | Meta-stream architecture + venue calendar API |
| [`docs/infra-strategy.md`](docs/infra-strategy.md) | Self-hosted Helsinki + UpCloud spillover, no CDN, GDPR posture |
| [`docs/funding-strategy.md`](docs/funding-strategy.md) | Foundation grant pipeline (Tempo, Koneen, SKR, Creative Europe), donations, sponsorship |
| [`docs/transparency-policy.md`](docs/transparency-policy.md) | Public ledger, annual report commitment, financial visibility |
| [`docs/storage-policy.md`](docs/storage-policy.md) | Soft-target 500MB, no enforcement, hidden 50GB abuse safeguard |
| [`docs/obs-and-broadcasting-guides.md`](docs/obs-and-broadcasting-guides.md) | Per-tool onboarding for OBS, Mixxx, Traktor, butt, browser ingest |

### Infrastructure templates

| File | Purpose |
|---|---|
| `infra/docker-stack.yml` | Production Swarm stack |
| `infra/docker-compose.dev.yml` | Local development |
| `infra/Caddyfile` | Edge TLS + reverse proxy |
| `infra/liquidsoap-channel.liq.template` | Per-channel broadcaster template |

### Presentations

| File | Purpose |
|---|---|
| [`slides/Tahti-Community.pptx`](slides/Tahti-Community.pptx) | Artist-facing deck — for founding-cohort recruitment + scene press |
| [`slides/Tahti-Business.pptx`](slides/Tahti-Business.pptx) | Governance + sustainability deck — for board candidates, grant officers, auditors |

## Running tests

**Node.js 24+** is required (`engines` in root `package.json`, `.nvmrc`, `.node-version`). With [nvm](https://github.com/nvm-sh/nvm): `nvm install && nvm use`.

API and package tests need **Postgres** and **Redis** with the Prisma schema applied:

```bash
docker compose -f infra/docker-compose.dev.yml up -d postgres redis
cd packages/db && pnpm db:push   # or pnpm db:migrate:test in CI
cd ../.. && pnpm test
```

Run the same lint, format, and typecheck gates as CI locally:

```bash
pnpm ci:check
```

Full app stack in Docker (API, web, worker, postgres, redis, minio — ports **3010** / **3011**):

```bash
make stack-up          # or ./scripts/stack-up.sh --seed for demo fixtures
make stack-deploy      # rsync + stack-up on lab host (SSH required)
```

Optional bash e2e against a running API:

```bash
API_URL=http://localhost:3001 pnpm test:e2e
SEED_JOURNEY_FIXTURES=1 DATABASE_URL=postgres://tahti:tahti_dev@localhost:5432/tahti \
  API_URL=http://localhost:3001 APP_URL=http://localhost:3010 pnpm test:e2e:journeys
# With web up: pnpm test:e2e:journeys:web
# Dashboard + player (web): pnpm test:e2e:dashboard-player:web
# Persona scripts (source helpers + fixtures first): journeys/listener|artist|member.sh
```

## CI releases

Every merge to **`main`** runs [`.github/workflows/ci.yml`](.github/workflows/ci.yml). When all checks pass, CI creates a GitHub release tagged **`YYYY-MM-DD-buildnr`** (UTC calendar date + daily increment), e.g. `2026-06-03-1`, `2026-06-03-2`.

Preview the next tag locally:

```bash
scripts/next-release-tag.sh
```

Manual semver production deploys still use `v*.*.*` tags via [`.github/workflows/deploy.yml`](.github/workflows/deploy.yml).

## Headline numbers (base case)

| | Y1 | Y2 | Y3 | 3-yr cum. |
|---|---|---|---|---|
| Paid members | 200 | 1,200 | 4,000 | — |
| Total org revenue | €35,426 | €107,700 | €290,872 | €433,998 |
| Total costs (incl. director salary) | €54,572 | €86,092 | €148,220 | €288,884 |
| **Org surplus** | **-€19,146** | **+€21,608** | **+€141,500** | **+€143,962** |
| **Artist grant pool (90% of surplus)** | **€0** | **€19,447** | **€129,737** | **€149,184** |
| **Fan-sub direct to artists** | €1,622 | €22,705 | €138,394 | €162,721 |
| **Total artist money** | €1,622 | €42,152 | €268,131 | **€311,905** |
| Director compensation | €30,000 | €40,000 | €45,000 | €115,000 |

Break-even threshold: ~600 paid members in Y1 absent grant funding, ~775 in Y2, ~1,100 in Y3 (Y3 jump is the 10 Gbps fiber upgrade).

## Three things that must go right

1. A founding grant of €20-25k lands in Year 1 (Tempo, Koneen, or SKR).
2. The org reaches at least 100 paid members by end of Year 1 (200 modeled).
3. The director does not burn out or quit.

If all three: Tahti is operationally self-funding by Y2 and distributes meaningful grants by Y3.
If any one fails: the org pauses, retrenches, or terminates. See `business-evaluation.md` for honest scenarios.

## What's on record from the design process

This package is the seventh major iteration of a multi-session design process. The accumulated honest observations:

1. **Year 1 deficit is real and unavoidable** without grant funding. €19k modeled. Apply to Tempo + Koneen + SKR in parallel before incorporating.

2. **The grant-distribution model concentrates pay-out.** Top-decile artists by engagement units receive ~€260/year at Y3 scale; mid-tier ~€19; active rest ~€4. This is intentional ("reward [...]

3. **Fan-subs at 0% org take is unusual.** Patreon takes 8-12%, Bandcamp takes 10-15%. The 2% Tahti operational fee is bounded by costs (Stripe + GDPR + customer support); surplus rolls into the [...]

4. **AGPL is a moat *and* a vulnerability.** Anyone can fork. The defense is the hosted instance + the network on it, not the code. Be at peace with this.

5. **Director salary is real and modest.** €30-45k cumulative €115k. This is the founder's three-year compensation; there is no equity upside downstream.

6. **No CDN is a trade.** UpCloud Helsinki handles spillover. Y3 requires a 10 Gbps business fiber pipe (~€18k/yr). If fiber pricing changes materially, revisit the CDN decision at AGM — but [...]

7. **Listener-hours are vanity metrics only.** Grant share comes from engagement units. The constitution forbids designing around listener metrics.

8. **The audio quality story is verifiable, not aspirational.** SoundCloud caps free listeners at 128 kbps Opus. Mixcloud caps free listeners at 64 kbps AAC. Tahti's paid members stream FLAC to a[...]

— Generated 2026-05-17
